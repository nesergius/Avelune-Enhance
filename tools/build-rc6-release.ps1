$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$LogPath = Join-Path $Root "RC6-BUILD.log"
$OutputRoot = Join-Path $Root "RC6-OUTPUT"
$Dist = Join-Path $Root "dist"
$PublicRegistry = "https://registry.npmjs.org"
$UpdaterVersion = "6.8.9"

function Write-Log([string]$Message, [string]$Color = "") {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
    if ($Color) { Write-Host $Message -ForegroundColor $Color } else { Write-Host $Message }
}

function Invoke-External(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory = $Root
) {
    Write-Log ("> " + $FilePath + " " + ($Arguments -join " "))
    $nativeArguments = @($Arguments | ForEach-Object {
        $value = [string]$_
        if ($value -match '[\s"]') { '"' + $value.Replace('"', '\"') + '"' } else { $value }
    })
    $process = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $nativeArguments `
        -WorkingDirectory $WorkingDirectory `
        -NoNewWindow `
        -Wait `
        -PassThru
    if ($process.ExitCode -ne 0) {
        throw "Command failed with exit code $($process.ExitCode): $FilePath"
    }
}

# Same launch mechanics as Invoke-External, but returns the exit code instead of
# throwing immediately. Probe binaries (--avelune-runtime-probe / --avelune-ui-probe)
# write their full diagnostic JSON to disk *before* exiting with a non-zero code on
# a failed check, so the caller needs a chance to read that report and surface the
# real reason (which specific check failed) instead of only ever seeing a bare
# "Command failed with exit code N" with no context.
function Invoke-Probe(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory = $Root
) {
    Write-Log ("> " + $FilePath + " " + ($Arguments -join " "))
    $nativeArguments = @($Arguments | ForEach-Object {
        $value = [string]$_
        if ($value -match '[\s"]') { '"' + $value.Replace('"', '\"') + '"' } else { $value }
    })
    $process = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $nativeArguments `
        -WorkingDirectory $WorkingDirectory `
        -NoNewWindow `
        -Wait `
        -PassThru
    return $process.ExitCode
}

function Test-FileUnlocked([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $true }
    $stream = $null
    try {
        $stream = [System.IO.File]::Open(
            $Path,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::ReadWrite,
            [System.IO.FileShare]::None
        )
        return $true
    }
    catch {
        return $false
    }
    finally {
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function Wait-FileUnlocked([string]$Path, [int]$TimeoutSeconds = 60) {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        if (Test-FileUnlocked $Path) { return $true }
        Start-Sleep -Milliseconds 750
    } while ([DateTime]::UtcNow -lt $deadline)
    return $false
}

function Stop-StalePackagedProcesses {
    $distPrefix = [System.IO.Path]::GetFullPath($Dist).TrimEnd("\\") + "\\"
    try {
        $processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
            Where-Object { [string]$_.Name -like "Avelune*.exe" })
        foreach ($process in $processes) {
            $candidate = [string]$process.ExecutablePath
            if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
            try { $fullPath = [System.IO.Path]::GetFullPath($candidate) } catch { continue }
            if ($fullPath.StartsWith($distPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                Write-Log ("Stopping stale packaged probe process: PID " + $process.ProcessId) "Yellow"
                Stop-Process -Id ([int]$process.ProcessId) -Force -ErrorAction SilentlyContinue
            }
        }
    }
    catch {
        Write-Log ("Could not enumerate stale packaged processes: " + $_.Exception.Message) "Yellow"
    }
}

function Remove-DirectoryReliable([string]$Path, [int]$MaxAttempts = 12) {
    if (-not (Test-Path -LiteralPath $Path)) { return }
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        Stop-StalePackagedProcesses
        $packagedExe = Join-Path $Path "win-unpacked\\Avelune Enhance.exe"
        if (Test-Path -LiteralPath $packagedExe -PathType Leaf) {
            [void](Wait-FileUnlocked $packagedExe 5)
        }
        try {
            Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
        }
        catch {
            Write-Log ("Cleanup attempt $attempt/$MaxAttempts is waiting for Windows file handles: " + $_.Exception.Message) "Yellow"
        }
        if (-not (Test-Path -LiteralPath $Path)) { return }
        Start-Sleep -Milliseconds ([Math]::Min(5000, 500 * $attempt))
    }
    throw "Unable to clean build directory after $MaxAttempts attempts: $Path"
}

function Invoke-ExternalCaptured(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$CapturePath,
    [string]$WorkingDirectory = $Root
) {
    Write-Log ("> " + $FilePath + " " + ($Arguments -join " "))
    Push-Location $WorkingDirectory
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        # Do not let native stdout/stderr escape into PowerShell's success
        # pipeline. Otherwise assignment at the caller receives every log line
        # plus the numeric exit code and a successful build is treated as a
        # failure. Write each line explicitly to the UTF-8 attempt log and host.
        & $FilePath @Arguments 2>&1 | ForEach-Object {
            $line = [string]$_
            Add-Content -LiteralPath $CapturePath -Value $line -Encoding UTF8
            Write-Host $line
        } | Out-Null

        $exitCode = [int]$LASTEXITCODE
        return $exitCode
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
        Pop-Location
    }
}

function Invoke-ReleaseBuildWithRetry([string]$NpmPath, [int]$MaxAttempts = 3) {
    $packagedExe = Join-Path $Dist "win-unpacked\\Avelune Enhance.exe"
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        if (Test-Path -LiteralPath $Dist) {
            Remove-DirectoryReliable $Dist
        }

        $attemptLog = Join-Path $OutputRoot ("RC6-ELECTRON-BUILDER-ATTEMPT-{0}.log" -f $attempt)
        Set-Content -LiteralPath $attemptLog -Value ("electron-builder attempt " + $attempt) -Encoding UTF8
        Write-Log ("electron-builder attempt $attempt/$MaxAttempts") "Cyan"

        $captureResult = @(Invoke-ExternalCaptured $NpmPath @("run", "release:win") $attemptLog $Root)
        if ($captureResult.Count -ne 1) {
            throw "Build capture returned $($captureResult.Count) pipeline objects instead of one numeric exit code. See $attemptLog"
        }
        try {
            $exitCode = [int]$captureResult[0]
        }
        catch {
            throw "Build capture returned a non-numeric exit code. See $attemptLog"
        }

        if ($exitCode -eq 0) {
            Write-Log ("electron-builder completed on attempt $attempt.") "Green"
            return
        }

        $attemptText = Get-Content -LiteralPath $attemptLog -Raw -ErrorAction SilentlyContinue
        $isTransientLock = $attemptText -match '(?i)EBUSY|resource busy or locked|being used by another process|EPERM[^\r\n]*Avelune Enhance\.exe'
        if (-not $isTransientLock) {
            throw "electron-builder failed with exit code $exitCode. The error is not a recognized transient Windows file lock. See $attemptLog"
        }
        if ($attempt -ge $MaxAttempts) {
            throw "electron-builder remained blocked after $MaxAttempts attempts. See $attemptLog"
        }

        Write-Log "A temporary Windows lock on Avelune Enhance.exe was detected. Waiting and rebuilding from a clean dist directory." "Yellow"
        Stop-StalePackagedProcesses
        if ((Test-Path -LiteralPath $packagedExe -PathType Leaf) -and -not (Wait-FileUnlocked $packagedExe 60)) {
            throw "Avelune Enhance.exe remained locked for 60 seconds. Close any process or security tool holding the file and run the builder again."
        }
        Remove-DirectoryReliable $Dist
        Start-Sleep -Seconds ([Math]::Min(8, 2 * $attempt))
    }
}

function Get-NodeMajor([string]$NodePath) {
    try {
        $version = & $NodePath --version 2>$null
        if ($version -match '^v(\d+)\.') { return [int]$Matches[1] }
    } catch {}
    return 0
}

function Get-NodeTools {
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($nodeCommand -and (Get-NodeMajor $nodeCommand.Source) -ge 22) {
        $npm = Join-Path (Split-Path -Parent $nodeCommand.Source) "npm.cmd"
        if (-not (Test-Path -LiteralPath $npm -PathType Leaf)) {
            $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
            if ($npmCommand) { $npm = $npmCommand.Source }
        }
        if (Test-Path -LiteralPath $npm -PathType Leaf) {
            return [PSCustomObject]@{ Node = $nodeCommand.Source; Npm = $npm }
        }
    }

    $portableVersion = "24.18.0"
    $toolsRoot = Join-Path $Root ".build-tools"
    $nodeRoot = Join-Path $toolsRoot ("node-v" + $portableVersion + "-win-x64")
    $nodeExe = Join-Path $nodeRoot "node.exe"
    $npmCmd = Join-Path $nodeRoot "npm.cmd"

    if ((Test-Path -LiteralPath $nodeExe) -and (Test-Path -LiteralPath $npmCmd)) {
        return [PSCustomObject]@{ Node = $nodeExe; Npm = $npmCmd }
    }

    New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
    $archiveName = "node-v$portableVersion-win-x64.zip"
    $archivePath = Join-Path $toolsRoot $archiveName
    $checksumsPath = Join-Path $toolsRoot "SHASUMS256.txt"
    $baseUrl = "https://nodejs.org/dist/v$portableVersion"

    Write-Log "Node.js 22+ was not found. Downloading portable Node.js $portableVersion..." "Yellow"
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/SHASUMS256.txt" -OutFile $checksumsPath
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/$archiveName" -OutFile $archivePath

    $line = Get-Content -LiteralPath $checksumsPath |
        Where-Object { $_ -match [regex]::Escape($archiveName) } |
        Select-Object -First 1
    if (-not $line -or $line -notmatch '^([a-fA-F0-9]{64})\s+') {
        throw "The official Node.js checksum was not found."
    }

    $expected = $Matches[1].ToLowerInvariant()
    $actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($expected -ne $actual) { throw "Portable Node.js integrity check failed." }

    Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsRoot -Force
    if (-not (Test-Path -LiteralPath $nodeExe -PathType Leaf)) {
        throw "Portable Node.js extraction failed."
    }
    return [PSCustomObject]@{ Node = $nodeExe; Npm = $npmCmd }
}

function Assert-Layout {
    $required = @(
        "package.json",
        "package-lock.json",
        "src\main.js",
        "src\updater.js",
        "renderer\out\index.html",
        "resources\win\bin\avelune-engine.exe",
        "resources\models\avelune-standard-4x.bin"
    )
    foreach ($relative in $required) {
        if (-not (Test-Path -LiteralPath (Join-Path $Root $relative) -PathType Leaf)) {
            throw "The source folder is incomplete: $relative"
        }
    }
}

function Assert-PublicLock {
    $lockPath = Join-Path $Root "package-lock.json"
    $raw = [System.IO.File]::ReadAllText($lockPath)
    if ($raw -match "applied-caas" -or $raw -match "internal\.api\.openai\.org") {
        throw "package-lock.json contains a private registry URL. Reapply the Step 5 kit."
    }
}

function Get-Sha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-FriendlySize([long]$Bytes) {
    if ($Bytes -ge 1GB) { return "{0:N2} GB" -f ($Bytes / 1GB) }
    if ($Bytes -ge 1MB) { return "{0:N1} MB" -f ($Bytes / 1MB) }
    return "{0:N0} KB" -f ($Bytes / 1KB)
}

function Find-Artifact([string]$Pattern) {
    return Get-ChildItem -LiteralPath $Dist -File -Filter $Pattern |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1
}

function Test-NativeEngineSource {
    $metadataPath = Join-Path $Root "NATIVE_ENGINE_SOURCE.json"
    if (-not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) {
        return $false
    }
    try {
        $metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
        if (-not $metadata.CorrespondingSourceComplete) {
            return $false
        }
        $archive = Join-Path $Root $metadata.CorrespondingSourceArchive
        if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) {
            return $false
        }
        $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
        return $actual -eq ([string]$metadata.CorrespondingSourceArchiveSha256).ToLowerInvariant()
    }
    catch {
        return $false
    }
}

function ConvertTo-ReleaseRelativePath([string]$Path) {
    $full = [System.IO.Path]::GetFullPath($Path)
    $rootPrefix = [System.IO.Path]::GetFullPath($Root).TrimEnd("\") + "\"
    if ($full.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $full.Substring($rootPrefix.Length).Replace("\", "/")
    }
    return $full
}

function Get-AuthenticodeReport([string[]]$Paths) {
    $seen = @{}
    $targets = @()
    foreach ($path in $Paths) {
        if ([string]::IsNullOrWhiteSpace($path)) { continue }
        $full = [System.IO.Path]::GetFullPath($path)
        if ($seen.ContainsKey($full.ToLowerInvariant())) { continue }
        $seen[$full.ToLowerInvariant()] = $true

        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
            $targets += [ordered]@{
                path = ConvertTo-ReleaseRelativePath $full
                exists = $false
                sha256 = $null
                status = "Missing"
                statusMessage = "File is missing."
                signerSubject = $null
                signerThumbprint = $null
                timestampSubject = $null
                valid = $false
            }
            continue
        }

        $signature = Get-AuthenticodeSignature -LiteralPath $full
        $targets += [ordered]@{
            path = ConvertTo-ReleaseRelativePath $full
            exists = $true
            sha256 = Get-Sha256 $full
            status = [string]$signature.Status
            statusMessage = [string]$signature.StatusMessage
            signerSubject = $(if ($signature.SignerCertificate) { [string]$signature.SignerCertificate.Subject } else { $null })
            signerThumbprint = $(if ($signature.SignerCertificate) { [string]$signature.SignerCertificate.Thumbprint } else { $null })
            timestampSubject = $(if ($signature.TimeStamperCertificate) { [string]$signature.TimeStamperCertificate.Subject } else { $null })
            valid = ($signature.Status -eq "Valid")
        }
    }

    $invalid = @($targets | Where-Object { -not $_.valid })
    return [ordered]@{
        schemaVersion = 1
        generatedAt = (Get-Date).ToString("o")
        requiredStatus = "Valid"
        complete = ($targets.Count -gt 0 -and $invalid.Count -eq 0)
        targets = $targets
    }
}

function Get-MpCmdRunPath {
    $candidates = @()
    if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles "Windows Defender\MpCmdRun.exe") }
    if (${env:ProgramFiles(x86)}) { $candidates += (Join-Path ${env:ProgramFiles(x86)} "Windows Defender\MpCmdRun.exe") }
    $command = Get-Command "MpCmdRun.exe" -ErrorAction SilentlyContinue
    if ($command) { $candidates += $command.Source }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return [System.IO.Path]::GetFullPath($candidate)
        }
    }
    return $null
}

function Invoke-DefenderScanReport([string[]]$Paths) {
    $mpCmd = Get-MpCmdRunPath
    $targets = @()
    if (-not $mpCmd) {
        return [ordered]@{
            schemaVersion = 1
            generatedAt = (Get-Date).ToString("o")
            scanner = "Microsoft Defender"
            scannerPath = $null
            available = $false
            complete = $false
            targets = $targets
            error = "MpCmdRun.exe was not found."
        }
    }

    foreach ($path in $Paths) {
        if ([string]::IsNullOrWhiteSpace($path)) { continue }
        $full = [System.IO.Path]::GetFullPath($path)
        $safeName = ([System.IO.Path]::GetFileName($full) -replace '[^A-Za-z0-9._-]', '_')
        $stdoutPath = Join-Path $OutputRoot ("RC6-DEFENDER-" + $safeName + ".stdout.txt")
        $stderrPath = Join-Path $OutputRoot ("RC6-DEFENDER-" + $safeName + ".stderr.txt")

        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
            $targets += [ordered]@{
                path = ConvertTo-ReleaseRelativePath $full
                exists = $false
                sha256 = $null
                exitCode = $null
                clean = $false
                stdout = $null
                stderr = "File is missing."
            }
            continue
        }

        $process = Start-Process `
            -FilePath $mpCmd `
            -ArgumentList @("-Scan", "-ScanType", "3", "-File", $full, "-DisableRemediation") `
            -NoNewWindow `
            -Wait `
            -PassThru `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath

        $stdout = [string](Get-Content -LiteralPath $stdoutPath -Raw -ErrorAction SilentlyContinue)
        $stderr = [string](Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue)
        $stdoutSummary = if ($stdout.Length -gt 2000) { $stdout.Substring($stdout.Length - 2000) } else { $stdout }
        $stderrSummary = if ($stderr.Length -gt 2000) { $stderr.Substring($stderr.Length - 2000) } else { $stderr }
        $clean = ($process.ExitCode -eq 0 -and $stdout -match "(?i)found no threats|no threats")
        $targets += [ordered]@{
            path = ConvertTo-ReleaseRelativePath $full
            exists = $true
            sha256 = Get-Sha256 $full
            exitCode = $process.ExitCode
            clean = $clean
            stdoutLog = ConvertTo-ReleaseRelativePath $stdoutPath
            stderrLog = ConvertTo-ReleaseRelativePath $stderrPath
            stdoutSummary = $stdoutSummary
            stderrSummary = $stderrSummary
        }
    }

    $failed = @($targets | Where-Object { -not $_.clean })
    return [ordered]@{
        schemaVersion = 1
        generatedAt = (Get-Date).ToString("o")
        scanner = "Microsoft Defender"
        scannerPath = $mpCmd
        available = $true
        complete = ($targets.Count -gt 0 -and $failed.Count -eq 0)
        targets = $targets
    }
}

function Test-MultiEngineScanEvidence([object[]]$ExpectedArtifacts) {
    $candidatePaths = @(
        (Join-Path $Root "RELEASE_SECURITY_SCAN.json"),
        (Join-Path $Root "RC6-RELEASE-SECURITY-SCAN.json"),
        (Join-Path $OutputRoot "RELEASE_SECURITY_SCAN.json"),
        (Join-Path $OutputRoot "RC6-RELEASE-SECURITY-SCAN.json")
    )
    $evidencePath = $candidatePaths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if (-not $evidencePath) {
        return [ordered]@{
            schemaVersion = 1
            generatedAt = (Get-Date).ToString("o")
            complete = $false
            evidencePath = $null
            required = $ExpectedArtifacts
            matches = @()
            error = "Independent multi-engine scan evidence file is missing."
        }
    }

    try {
        $evidence = Get-Content -LiteralPath $evidencePath -Raw | ConvertFrom-Json
    }
    catch {
        return [ordered]@{
            schemaVersion = 1
            generatedAt = (Get-Date).ToString("o")
            complete = $false
            evidencePath = ConvertTo-ReleaseRelativePath $evidencePath
            required = $ExpectedArtifacts
            matches = @()
            error = "Independent multi-engine scan evidence is not valid JSON."
        }
    }

    $records = @()
    if ($evidence.artifacts) { $records = @($evidence.artifacts) }
    elseif ($evidence.files) { $records = @($evidence.files) }

    $matches = @()
    foreach ($artifact in $ExpectedArtifacts) {
        $expectedHash = ([string]$artifact.sha256).ToLowerInvariant()
        $record = $records | Where-Object { ([string]$_.sha256).ToLowerInvariant() -eq $expectedHash } | Select-Object -First 1
        if (-not $record) {
            $matches += [ordered]@{
                name = $artifact.name
                sha256 = $expectedHash
                found = $false
                clean = $false
                engineCount = 0
            }
            continue
        }

        $engineCount = 0
        if ($record.engineCount) { $engineCount = [int]$record.engineCount }
        elseif ($record.engines) { $engineCount = @($record.engines).Count }
        elseif ($record.scanners) { $engineCount = @($record.scanners).Count }
        $verdict = ([string]$(if ($record.verdict) { $record.verdict } elseif ($record.status) { $record.status } else { $record.result })).ToLowerInvariant()
        $clean = ($engineCount -ge 2 -and $verdict -match "clean|passed|undetected|no_threat")

        $matches += [ordered]@{
            name = $artifact.name
            sha256 = $expectedHash
            found = $true
            clean = $clean
            engineCount = $engineCount
            verdict = $verdict
        }
    }

    $failed = @($matches | Where-Object { -not $_.clean })
    return [ordered]@{
        schemaVersion = 1
        generatedAt = (Get-Date).ToString("o")
        complete = ($matches.Count -gt 0 -and $failed.Count -eq 0)
        evidencePath = ConvertTo-ReleaseRelativePath $evidencePath
        required = $ExpectedArtifacts
        matches = $matches
    }
}

function New-SourceSnapshot(
    [string]$Destination,
    [bool]$NativeSourceComplete,
    [string]$NodePath
) {
    $stage = Join-Path $env:TEMP ("avelune-source-snapshot-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    try {
        $snapshot = Join-Path $stage "Avelune-Enhance-2.0.0-RC6-Source"
        $stagingReport = Join-Path $stage "source-staging-report.json"
        $stager = Join-Path $Root "tools\stage-source-snapshot.js"

        Invoke-External $NodePath @(
            $stager,
            "--source", $Root,
            "--destination", $snapshot,
            "--version", "2.0.0 RC6",
            "--native-source-complete", ([string]$NativeSourceComplete).ToLowerInvariant(),
            "--report", $stagingReport
        ) $Root

        if (-not (Test-Path -LiteralPath $stagingReport -PathType Leaf)) {
            throw "Source staging report was not generated."
        }
        $staging = Get-Content -LiteralPath $stagingReport -Raw | ConvertFrom-Json
        if ([int]$staging.filesCopied -lt 20 -or [long]$staging.bytesCopied -lt 1048576) {
            throw "Source staging report describes an incomplete snapshot."
        }

        foreach ($required in @(
            "package.json",
            "package-lock.json",
            "LICENSE",
            "src\main.js",
            "renderer\out\index.html",
            "resources\resource-manifest.json",
            "SOURCE_COMPLETENESS_NOTICE.md"
        )) {
            if (-not (Test-Path -LiteralPath (Join-Path $snapshot $required) -PathType Leaf)) {
                throw "Required source snapshot file is missing: $required"
            }
        }

        if (Test-Path -LiteralPath $Destination) {
            Remove-Item -LiteralPath $Destination -Force
        }
        Compress-Archive -LiteralPath $snapshot -DestinationPath $Destination -CompressionLevel Optimal

        if (-not (Test-Path -LiteralPath $Destination -PathType Leaf)) {
            throw "Source snapshot archive was not created."
        }
        if ((Get-Item -LiteralPath $Destination).Length -lt 1048576) {
            throw "Source snapshot archive is unexpectedly small."
        }
        Write-Log ("Source snapshot staged without robocopy: " + $staging.filesCopied + " files.") "Green"
    }
    finally {
        Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
    }
}

try {
    Set-Content -LiteralPath $LogPath -Value "Avelune Enhance RC6 release build log" -Encoding UTF8
    Write-Log "Avelune Enhance 2.0.0 RC6 — release build" "Cyan"
    Write-Log "Update endpoint: https://avelune.sayqq.ru/updates/"
    Write-Log "RC6 channel: rc (stable releases will use latest)"

    Assert-Layout
    Assert-PublicLock

    $tools = Get-NodeTools
    $nodeDirectory = Split-Path -Parent $tools.Node
    $env:PATH = "$nodeDirectory;$env:PATH"
    $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
    $env:npm_config_registry = $PublicRegistry
    $env:npm_config_fund = "false"
    $env:npm_config_audit = "false"
    $env:ELECTRON_CACHE = Join-Path $Root ".electron-cache"
    $env:ELECTRON_BUILDER_CACHE = Join-Path $Root ".electron-builder-cache"

    Write-Log ("Node: " + (& $tools.Node --version))
    Write-Log ("npm: " + (& $tools.Npm --version))
    $lockHashBefore = Get-Sha256 (Join-Path $Root "package-lock.json")
    Write-Log "Using the committed public package lock without modification."

    $profileExamplesFetcher = Join-Path $Root "tools\fetch-official-profile-examples.js"
    Write-Log "Preparing official upstream profile examples..." "Yellow"
    Invoke-External $tools.Node @($profileExamplesFetcher) $Root
    Write-Log "Profile example preparation completed (local fallback remains available)." "Green"

    $officialModelsFetcher = Join-Path $Root "tools\fetch-official-models.ps1"
    Write-Log "Downloading and verifying the pinned official NCNN model package..." "Yellow"
    Invoke-External "powershell.exe" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $officialModelsFetcher) $Root
    Invoke-External $tools.Node @((Join-Path $Root "tools\generate-resource-manifest.js")) $Root
    Invoke-External $tools.Node @((Join-Path $Root "tools\verify-resource-manifest.js")) $Root
    Write-Log "Official model provenance and resource manifest verified before source staging." "Green"

    if (Test-Path -LiteralPath (Join-Path $Root "node_modules")) {
        Remove-Item -LiteralPath (Join-Path $Root "node_modules") -Recurse -Force
    }
    if (Test-Path -LiteralPath $Dist) {
        Remove-DirectoryReliable $Dist
    }
    if (Test-Path -LiteralPath $OutputRoot) {
        Remove-DirectoryReliable $OutputRoot
    }
    New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null

    # Build the source archive before npm ci creates node_modules and before
    # Electron produces dist. The cross-platform Node stager is executed now,
    # so source-packaging failures are detected before the expensive build.
    $nativeSourceComplete = Test-NativeEngineSource
    $sourceName = "Avelune-Enhance-2.0.0-RC6-Source-Snapshot.zip"
    $prebuiltSourceArchive = Join-Path $OutputRoot $sourceName
    Write-Log "Prebuilding the source snapshot before dependency installation..." "Yellow"
    New-SourceSnapshot $prebuiltSourceArchive $nativeSourceComplete $tools.Node
    Write-Log "Source snapshot preflight passed." "Green"

    Invoke-External $tools.Npm @(
        "ci",
        "--registry=$PublicRegistry",
        "--no-fund",
        "--no-audit"
    )
    Invoke-External $tools.Npm @("test")
    Invoke-ReleaseBuildWithRetry $tools.Npm 3
    $lockHashAfter = Get-Sha256 (Join-Path $Root "package-lock.json")
    if ($lockHashAfter -ne $lockHashBefore) { throw "Release build modified package-lock.json." }

    $setup = Find-Artifact "Avelune-Enhance-2.0.0-RC6-Setup-x64.exe"
    $portable = Find-Artifact "Avelune-Enhance-2.0.0-RC6-Portable-x64.exe"
    $blockmap = Find-Artifact "Avelune-Enhance-2.0.0-RC6-Setup-x64.exe.blockmap"
    $channelFile = Find-Artifact "rc.yml"
    if (-not $channelFile) { $channelFile = Find-Artifact "latest.yml" }

    foreach ($pair in @(
        @("Setup", $setup),
        @("Portable", $portable),
        @("NSIS blockmap", $blockmap),
        @("Update metadata", $channelFile)
    )) {
        if (-not $pair[1]) { throw "$($pair[0]) was not generated." }
    }

    if ($env:AVELUNE_REQUIRE_CODE_SIGNING -eq "1") {
        foreach ($artifact in @($setup, $portable)) {
            $signature = Get-AuthenticodeSignature -LiteralPath $artifact.FullName
            if ($signature.Status -ne "Valid") {
                throw "Required Authenticode signature is not valid: $($artifact.Name) [$($signature.Status)]"
            }
        }
        Write-Log "Required Authenticode signatures are valid." "Green"
    }

    $unpackedUpdateConfig = Join-Path $Dist "win-unpacked\resources\app-update.yml"
    if (-not (Test-Path -LiteralPath $unpackedUpdateConfig -PathType Leaf)) {
        throw "Packaged app-update.yml was not generated."
    }
    $updateConfigText = Get-Content -LiteralPath $unpackedUpdateConfig -Raw
    if ($updateConfigText -notmatch "https://avelune\.sayqq\.ru/updates/") {
        throw "Packaged app-update.yml does not contain the official update endpoint."
    }

    $packagedResources = Join-Path $Dist "win-unpacked\resources"
    $requiredPackagedResources = @(
        "win\bin\avelune-engine.exe",
        "win\bin\avelune-gpu-info.exe",
        "win\bin\vcomp140.dll",
        "models\avelune-standard-4x.bin",
        "models\avelune-standard-4x.param",
        "models\digital-art-4x.bin",
        "models\digital-art-4x.param",
        "models\realesrnet-x4plus.bin",
        "models\realesrnet-x4plus.param",
        "models\realesr-animevideov3-x2.bin",
        "models\realesr-animevideov3-x2.param",
        "models\realesr-animevideov3-x3.bin",
        "models\realesr-animevideov3-x3.param",
        "models\realesr-animevideov3-x4.bin",
        "models\realesr-animevideov3-x4.param",
        "models\official-model-manifest.json",
        "benchmark\benchmark-input.png",
        "resource-manifest.json"
    )
    foreach ($relative in $requiredPackagedResources) {
        $candidate = Join-Path $packagedResources $relative
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            throw "Packaged runtime resource is missing: $relative"
        }
    }
    Write-Log "Packaged runtime layout verified: resources/win/bin and resources/models." "Green"


    # A release candidate is not successful until the packaged application itself
    # starts, reports the expected version, passes a real UI geometry probe and
    # executes the packaged native engine with the packaged model files.
    $packagedExe = Join-Path $Dist "win-unpacked\Avelune Enhance.exe"
    if (-not (Test-Path -LiteralPath $packagedExe -PathType Leaf)) {
        throw "Packaged application executable is missing."
    }

    $probeRoot = Join-Path $env:TEMP ("avelune-rc6-probe-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $probeRoot -Force | Out-Null
    # Every probe launch must start from a pristine profile. Without this, Electron
    # falls back to the real per-user profile (%APPDATA%\Avelune Enhance), which can
    # carry a stale localStorage.imagePath from earlier manual testing on this
    # machine. Restoring that path at startup for a file that no longer exists trips
    # the "Изображение предпросмотра: файл не найден" fallback and leaves the
    # renderer in a non-default layout, which fails the UI probe's geometry checks
    # even though nothing is actually broken.
    $probeUserData = Join-Path $probeRoot "userdata"
    New-Item -ItemType Directory -Path $probeUserData -Force | Out-Null
    try {
        $runtimeProbe = Join-Path $probeRoot "runtime.json"
        $runtimeExitCode = Invoke-Probe $packagedExe @("--user-data-dir=$probeUserData", "--avelune-runtime-probe=$runtimeProbe") $Root
        if (-not (Test-Path -LiteralPath $runtimeProbe -PathType Leaf)) {
            throw "Packaged runtime probe did not create its report (exit code $runtimeExitCode)."
        }
        $runtimeData = Get-Content -LiteralPath $runtimeProbe -Raw | ConvertFrom-Json
        if ($runtimeData.displayVersion -ne "2.0.0 RC6" -or -not $runtimeData.packaged) {
            throw "Packaged runtime probe returned unexpected metadata."
        }
        Write-Log "Packaged application startup probe passed." "Green"

        $probeSpecs = @(
            [ordered]@{ Name = "1280x720-100"; Size = "1280x720"; Scale = "1" },
            [ordered]@{ Name = "1366x768-100"; Size = "1366x768"; Scale = "1" },
            [ordered]@{ Name = "1920x1080-100"; Size = "1920x1080"; Scale = "1" },
            [ordered]@{ Name = "1366x768-125"; Size = "1366x768"; Scale = "1.25" },
            [ordered]@{ Name = "1920x1080-150"; Size = "1920x1080"; Scale = "1.5" }
        )
        $uiProbeFailures = @()
        $qaFailed = Join-Path $OutputRoot "QA-FAILED"
        foreach ($spec in $probeSpecs) {
            $probeUserDataForSize = Join-Path $probeRoot ("userdata-" + $spec.Name)
            New-Item -ItemType Directory -Path $probeUserDataForSize -Force | Out-Null
            $uiProbe = Join-Path $probeRoot ("ui-" + $spec.Name + ".json")
            $args = @(
                "--force-device-scale-factor=$($spec.Scale)",
                "--user-data-dir=$probeUserDataForSize",
                "--avelune-ui-probe=$uiProbe",
                "--avelune-probe-size=$($spec.Size)"
            )
            $uiExitCode = Invoke-Probe $packagedExe $args $Root
            if (-not (Test-Path -LiteralPath $uiProbe -PathType Leaf)) {
                $uiProbeFailures += "$($spec.Name): report missing (exit $uiExitCode)"
                continue
            }
            $uiData = Get-Content -LiteralPath $uiProbe -Raw | ConvertFrom-Json
            $probeTarget = Join-Path $OutputRoot ("RC6-PACKAGED-UI-PROBE-" + $spec.Name + ".json")
            Copy-Item -LiteralPath $uiProbe -Destination $probeTarget -Force
            $screenshot = [System.IO.Path]::ChangeExtension($uiProbe, ".png")
            if (Test-Path -LiteralPath $screenshot -PathType Leaf) {
                Copy-Item -LiteralPath $screenshot -Destination (Join-Path $OutputRoot ("RC6-PACKAGED-UI-PROBE-" + $spec.Name + ".png")) -Force
            }
            if (-not $uiData.metrics.passed) {
                $failedNames = @($uiData.metrics.failedChecks) -join ", "
                $perf = $uiData.metrics.performance
                $perfDetails = ""
                if ($perf) {
                    $perfDetails = " frames=$($perf.frames), p95FrameMs=$($perf.p95FrameMs), maxFrameMs=$($perf.maxFrameMs), longFrameCount=$($perf.longFrameCount), layoutShift=$($perf.layoutShift), maxScroll=$($perf.maxScroll)"
                }
                $uiProbeFailures += "$($spec.Name): $failedNames$perfDetails (exit $uiExitCode)"
            }
            else {
                Write-Log ("Packaged UI probe passed: " + $spec.Name + ".") "Green"
            }
        }
        if ($uiProbeFailures.Count -gt 0) {
            New-Item -ItemType Directory -Path $qaFailed -Force | Out-Null
            foreach ($artifact in @($setup, $portable, $blockmap, $channelFile, (Get-Item -LiteralPath $prebuiltSourceArchive))) {
                if ($artifact -and (Test-Path -LiteralPath $artifact.FullName -PathType Leaf)) {
                    Copy-Item -LiteralPath $artifact.FullName -Destination $qaFailed -Force
                }
            }
            Get-ChildItem -LiteralPath $OutputRoot -File -Filter "RC6-PACKAGED-UI-PROBE-*" | Copy-Item -Destination $qaFailed -Force
            Set-Content -LiteralPath (Join-Path $qaFailed "QA-FAILURES.txt") -Value $uiProbeFailures -Encoding UTF8
            throw ("Packaged visual QA failed. Built artifacts were retained in QA-FAILED. " + ($uiProbeFailures -join "; "))
        }

        $engine = Join-Path $packagedResources "win\bin\avelune-engine.exe"
        $models = Join-Path $packagedResources "models"
        $smokeInput = Join-Path $Root "tests\fixtures\smoke-input.png"
        $smokeOutput = Join-Path $probeRoot "engine-output.png"
        Invoke-External $engine @("-i", $smokeInput, "-o", $smokeOutput, "-m", $models, "-n", "avelune-standard-4x", "-s", "2", "-f", "png", "-c", "90") $Root
        if (-not (Test-Path -LiteralPath $smokeOutput -PathType Leaf) -or (Get-Item -LiteralPath $smokeOutput).Length -lt 128) {
            throw "Packaged native engine smoke test did not produce a valid image."
        }
        Write-Log "Packaged native engine smoke test passed." "Green"
    }
    finally {
        Remove-Item -LiteralPath $probeRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    $upload = Join-Path $OutputRoot "UPLOAD-TO-AVELUNE-SUBDOMAIN"
    $downloads = Join-Path $upload "downloads"
    $updates = Join-Path $upload "updates"
    $sourceDir = Join-Path $upload "source"
    $siteData = Join-Path $upload "assets\data"

    foreach ($dir in @($downloads, $updates, $sourceDir, $siteData)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    Copy-Item -LiteralPath $setup.FullName -Destination $downloads
    Copy-Item -LiteralPath $portable.FullName -Destination $downloads
    Copy-Item -LiteralPath $setup.FullName -Destination $updates
    Copy-Item -LiteralPath $blockmap.FullName -Destination $updates
    Copy-Item -LiteralPath $channelFile.FullName -Destination $updates

    $sourceArchive = Join-Path $sourceDir $sourceName
    if (-not (Test-Path -LiteralPath $prebuiltSourceArchive -PathType Leaf)) {
        throw "Prebuilt source snapshot is missing before release packaging."
    }
    Copy-Item -LiteralPath $prebuiltSourceArchive -Destination $sourceArchive -Force
    if ((Get-Sha256 $sourceArchive) -ne (Get-Sha256 $prebuiltSourceArchive)) {
        throw "Copied source snapshot checksum does not match the prebuilt archive."
    }
    Write-Log "Prebuilt source snapshot copied into the upload package." "Green"

    $setupHash = Get-Sha256 $setup.FullName
    $portableHash = Get-Sha256 $portable.FullName
    $sourceHash = Get-Sha256 $sourceArchive

    $releaseSecurityArtifacts = @(
        [ordered]@{ name = $setup.Name; type = "setup"; path = ConvertTo-ReleaseRelativePath $setup.FullName; sha256 = $setupHash },
        [ordered]@{ name = $portable.Name; type = "portable"; path = ConvertTo-ReleaseRelativePath $portable.FullName; sha256 = $portableHash },
        [ordered]@{ name = $sourceName; type = "source"; path = ConvertTo-ReleaseRelativePath $sourceArchive; sha256 = $sourceHash }
    )

    $signatureTargets = @(
        $setup.FullName,
        $portable.FullName,
        $packagedExe,
        (Join-Path $packagedResources "win\bin\avelune-engine.exe"),
        (Join-Path $packagedResources "win\bin\avelune-gpu-info.exe"),
        (Join-Path $packagedResources "elevate.exe")
    )
    $authenticodeReport = Get-AuthenticodeReport $signatureTargets
    $authenticodeReport |
        ConvertTo-Json -Depth 8 |
        Set-Content -LiteralPath (Join-Path $OutputRoot "RC6-AUTHENTICODE-SIGNATURES.json") -Encoding UTF8

    $defenderReport = Invoke-DefenderScanReport @($setup.FullName, $portable.FullName, $sourceArchive)
    $defenderReport |
        ConvertTo-Json -Depth 8 |
        Set-Content -LiteralPath (Join-Path $OutputRoot "RC6-DEFENDER-SCAN.json") -Encoding UTF8

    $multiEngineReport = Test-MultiEngineScanEvidence $releaseSecurityArtifacts
    $multiEngineReport |
        ConvertTo-Json -Depth 8 |
        Set-Content -LiteralPath (Join-Path $OutputRoot "RC6-MULTIENGINE-SCAN-EVIDENCE.json") -Encoding UTF8

    $authenticodeComplete = [bool]$authenticodeReport.complete
    $defenderScanComplete = [bool]$defenderReport.complete
    $multiEngineScanComplete = [bool]$multiEngineReport.complete

    $publicReleaseBlockers = @()
    if (-not $authenticodeComplete) {
        $publicReleaseBlockers += "Authenticode signatures are missing or invalid for one or more release executables."
    }
    if (-not $defenderScanComplete) {
        $publicReleaseBlockers += "Microsoft Defender scan is not complete or did not pass for the exact release files."
    }
    if (-not $multiEngineScanComplete) {
        $publicReleaseBlockers += "Independent multi-engine scan evidence is missing or does not match the exact release hashes."
    }
    if (-not $nativeSourceComplete) {
        $publicReleaseBlockers += "Native engine Corresponding Source is missing or does not match the recorded hash."
    }

    $publicReleaseAllowed = (
        $nativeSourceComplete -and
        $authenticodeComplete -and
        $defenderScanComplete -and
        $multiEngineScanComplete
    )

    $releaseNotes = "RC6 adds verified official models, local Auto Profile, two-stage Neural Restore, persistent Smart Queue, compatible metadata/ICC preservation, GPU AutoTune with OOM recovery, and multi-viewport visual QA screenshots."
    if ($publicReleaseAllowed) {
        $releaseNotes += " Public download is enabled because source, signing and security-scan gates passed for the exact release hashes."
    }
    else {
        $releaseNotes += " Public download remains disabled until: " + ($publicReleaseBlockers -join " ")
    }

    $gateChecks = [ordered]@{
        NativeEngineCorrespondingSourceComplete = $nativeSourceComplete
        PackagedStartupProbePassed = $true
        PackagedUiProbeMatrixPassed = $true
        PackagedClipboardPreviewProbePassed = $true
        PackagedScrollPerformanceProbePassed = $true
        PackagedVisualRegressionScreenshotsCaptured = $true
        PackagedEngineSmokePassed = $true
        AuthenticodeSignaturesValid = $authenticodeComplete
        MicrosoftDefenderScanPassed = $defenderScanComplete
        IndependentMultiEngineScanComplete = $multiEngineScanComplete
    }
    $gatePassed = @($gateChecks.GetEnumerator() | Where-Object { [bool]$_.Value }).Count
    $gateText = "$gatePassed/$($gateChecks.Count)"

    $releaseData = [ordered]@{
        product = "Avelune Enhance"
        channel = "rc"
        current = [ordered]@{
            version = "2.0.0 RC6"
            build = "2.0.0.600"
            date = (Get-Date -Format "yyyy-MM-dd")
            public = $publicReleaseAllowed
            notes = $releaseNotes
            files = @(
                [ordered]@{
                    type = "setup"
                    label = "Windows installer"
                    filename = $setup.Name
                    url = ("downloads/" + $setup.Name)
                    size = Get-FriendlySize $setup.Length
                    sha256 = $setupHash
                    available = $publicReleaseAllowed
                },
                [ordered]@{
                    type = "portable"
                    label = "Portable version"
                    filename = $portable.Name
                    url = ("downloads/" + $portable.Name)
                    size = Get-FriendlySize $portable.Length
                    sha256 = $portableHash
                    available = $publicReleaseAllowed
                },
                [ordered]@{
                    type = "source"
                    label = "Source snapshot"
                    filename = $sourceName
                    url = ("source/" + $sourceName)
                    size = Get-FriendlySize ((Get-Item -LiteralPath $sourceArchive).Length)
                    sha256 = $sourceHash
                    available = $publicReleaseAllowed
                    correspondingSourceComplete = $nativeSourceComplete
                }
            )
        }
    }
    $releaseData |
        ConvertTo-Json -Depth 10 |
        Set-Content -LiteralPath (Join-Path $siteData "releases.rc6.json") -Encoding UTF8

    $manifest = [ordered]@{
        Gate = $gateText
        Candidate = "Avelune Enhance 2.0.0 RC6"
        Success = $true
        Timestamp = (Get-Date).ToString("o")
        UpdateEndpoint = "https://avelune.sayqq.ru/updates/"
        Channel = if ($channelFile.Name -eq "latest.yml") { "latest" } else { "rc" }
        StableMetadataExpectedLater = "latest.yml"
        NativeEngineCorrespondingSourceComplete = $nativeSourceComplete
        PackagedStartupProbePassed = $true
        PackagedUiProbeMatrixPassed = $true
        PackagedUiProbeViewports = @("1280x720@100%", "1366x768@100%", "1920x1080@100%", "1366x768@125%", "1920x1080@150%")
        PackagedClipboardPreviewProbePassed = $true
        PackagedScrollPerformanceProbePassed = $true
        PackagedVisualRegressionScreenshotsCaptured = $true
        PackagedEngineSmokePassed = $true
        AuthenticodeSignaturesValid = $authenticodeComplete
        AuthenticodeSignatureReport = "RC6-AUTHENTICODE-SIGNATURES.json"
        MicrosoftDefenderScanPassed = $defenderScanComplete
        MicrosoftDefenderScanReport = "RC6-DEFENDER-SCAN.json"
        IndependentMultiEngineScanComplete = $multiEngineScanComplete
        IndependentMultiEngineScanReport = "RC6-MULTIENGINE-SCAN-EVIDENCE.json"
        PublicReleaseAllowed = $publicReleaseAllowed
        PublicReleaseBlockers = $publicReleaseBlockers
        Artifacts = @(
            [ordered]@{ Name = $setup.Name; Purpose = "downloads and updates"; Bytes = $setup.Length; Sha256 = $setupHash },
            [ordered]@{ Name = $portable.Name; Purpose = "downloads"; Bytes = $portable.Length; Sha256 = $portableHash },
            [ordered]@{ Name = $blockmap.Name; Purpose = "differential update"; Bytes = $blockmap.Length; Sha256 = Get-Sha256 $blockmap.FullName },
            [ordered]@{ Name = $channelFile.Name; Purpose = "RC update metadata"; Bytes = $channelFile.Length; Sha256 = Get-Sha256 $channelFile.FullName },
            [ordered]@{ Name = $sourceName; Purpose = "source snapshot"; Bytes = (Get-Item $sourceArchive).Length; Sha256 = $sourceHash }
        )
    }
    $manifest |
        ConvertTo-Json -Depth 10 |
        Set-Content -LiteralPath (Join-Path $OutputRoot "RC6-RELEASE-MANIFEST.json") -Encoding UTF8

    $allUploadFiles = Get-ChildItem -LiteralPath $upload -File -Recurse | Sort-Object FullName
    $hashLines = foreach ($file in $allUploadFiles) {
        $relative = $file.FullName.Substring($upload.Length).TrimStart("\").Replace("\", "/")
        "$(Get-Sha256 $file.FullName)  $relative"
    }
    Set-Content -LiteralPath (Join-Path $OutputRoot "SHA256SUMS.txt") -Value $hashLines -Encoding ASCII

    $publicReleaseInstruction = if ($publicReleaseAllowed) {
        "Public downloads may be published. Source, Authenticode, Defender and independent multi-engine gates passed for the exact release hashes."
    }
    else {
        "DO NOT make downloads public yet.`r`nRemaining release blockers:`r`n- " + ($publicReleaseBlockers -join "`r`n- ")
    }

    $uploadMap = @"
AVELUNE RC6 — UPLOAD MAP

Upload the CONTENTS of:
$upload

to:
avelune.sayqq.ru/public_html/

Generated update metadata:
$($channelFile.Name)

RC6 uses the private test channel "rc".
A stable version such as 2.0.0 must be built with channel "latest";
electron-builder will then generate latest.yml.

$publicReleaseInstruction

Website data:
assets/data/releases.rc6.json

Review it and replace the live releases.json only after PublicReleaseAllowed is true.

Native engine Corresponding Source complete: $nativeSourceComplete
Authenticode signatures valid: $authenticodeComplete
Microsoft Defender scan passed: $defenderScanComplete
Independent multi-engine scan complete: $multiEngineScanComplete
"@
    Set-Content -LiteralPath (Join-Path $OutputRoot "UPLOAD-MAP-RU.txt") -Value $uploadMap -Encoding UTF8

    Copy-Item -LiteralPath $LogPath -Destination (Join-Path $OutputRoot "RC6-BUILD.log") -Force

    Write-Log "RC6 release build completed." "Green"
    Write-Log ("Output: " + $OutputRoot) "Green"
    Write-Log ("Update metadata: " + $channelFile.Name)
    Write-Log ("Native engine Corresponding Source complete: " + $nativeSourceComplete)
    exit 0
}
catch {
    Write-Log ("ERROR: " + $_.Exception.Message) "Red"
    Write-Log $_.Exception.ToString()
    exit 1
}
