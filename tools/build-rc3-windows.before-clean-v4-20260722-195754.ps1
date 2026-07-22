$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$LogPath = Join-Path $Root "RC3-BUILD.log"
$OutputDirectory = Join-Path $Root "RC3-OUTPUT"
$ExpectedElectron = "43.1.1"
$ExpectedAppVersion = "2.0.0-rc.3"
$ExpectedBuildVersion = "2.0.0.3"
$PortableNodeVersion = "24.18.0"

function Write-Log([string]$Message) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
    Write-Host $Message
}

function Invoke-External(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory = $Root
) {
    Write-Log ("> " + $FilePath + " " + ($Arguments -join " "))
    $process = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $Arguments `
        -WorkingDirectory $WorkingDirectory `
        -NoNewWindow `
        -Wait `
        -PassThru
    if ($process.ExitCode -ne 0) {
        throw "Command failed with exit code $($process.ExitCode): $FilePath"
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
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($command -and (Get-NodeMajor $command.Source) -ge 22) {
        $npm = Join-Path (Split-Path -Parent $command.Source) "npm.cmd"
        if (-not (Test-Path -LiteralPath $npm -PathType Leaf)) {
            $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
            if ($npmCommand) { $npm = $npmCommand.Source }
        }
        if (Test-Path -LiteralPath $npm -PathType Leaf) {
            return [PSCustomObject]@{ Node = $command.Source; Npm = $npm; Portable = $false }
        }
    }

    $toolsRoot = Join-Path $Root ".build-tools"
    $nodeRoot = Join-Path $toolsRoot ("node-v" + $PortableNodeVersion + "-win-x64")
    $nodeExe = Join-Path $nodeRoot "node.exe"
    $npmCmd = Join-Path $nodeRoot "npm.cmd"
    if ((Test-Path -LiteralPath $nodeExe) -and (Test-Path -LiteralPath $npmCmd)) {
        return [PSCustomObject]@{ Node = $nodeExe; Npm = $npmCmd; Portable = $true }
    }

    New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
    $archiveName = "node-v$PortableNodeVersion-win-x64.zip"
    $archivePath = Join-Path $toolsRoot $archiveName
    $checksumsPath = Join-Path $toolsRoot "SHASUMS256.txt"
    $baseUrl = "https://nodejs.org/dist/v$PortableNodeVersion"

    Write-Log "Node.js 22+ was not found. Downloading portable Node.js $PortableNodeVersion LTS..."
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/SHASUMS256.txt" -OutFile $checksumsPath
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/$archiveName" -OutFile $archivePath

    $checksumLine = Get-Content -LiteralPath $checksumsPath | Where-Object { $_ -match [regex]::Escape($archiveName) } | Select-Object -First 1
    if (-not $checksumLine -or $checksumLine -notmatch '^([a-fA-F0-9]{64})\s+') {
        throw "Could not find the official Node.js SHA-256 value."
    }
    $expected = $Matches[1].ToLowerInvariant()
    $actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
        throw "Portable Node.js integrity check failed."
    }

    Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsRoot -Force
    if (-not (Test-Path -LiteralPath $nodeExe -PathType Leaf)) {
        throw "Portable Node.js extraction failed."
    }
    return [PSCustomObject]@{ Node = $nodeExe; Npm = $npmCmd; Portable = $true }
}

function Assert-SourceLayout {
    $required = @(
        "package.json",
        "package-lock.json",
        "src\main.js",
        "src\preload.js",
        "renderer\out\index.html",
        "resources\win\bin\avelune-engine.exe",
        "resources\win\bin\avelune-gpu-info.exe",
        "resources\models\avelune-standard-4x.bin"
    )
    foreach ($relative in $required) {
        $target = Join-Path $Root $relative
        if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
            throw "Source package is incomplete: $relative"
        }
    }
}

function Assert-PackageMetadata {
    $package = Get-Content -LiteralPath (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
    if ($package.version -ne $ExpectedAppVersion) { throw "Unexpected package version: $($package.version)" }
    if ($package.buildVersion -ne $ExpectedBuildVersion) { throw "Unexpected build version: $($package.buildVersion)" }
    if ($package.devDependencies.electron -ne $ExpectedElectron) { throw "Unexpected Electron version: $($package.devDependencies.electron)" }
}

function Test-Runtime([string]$Executable) {
    $probePath = Join-Path $env:TEMP ("avelune-rc3-runtime-" + [guid]::NewGuid().ToString("N") + ".json")
    try {
        $process = Start-Process -FilePath $Executable -ArgumentList @( "--avelune-runtime-probe=$probePath" ) -PassThru
        if (-not $process.WaitForExit(30000)) {
            try { $process.Kill() } catch {}
            throw "Runtime probe timed out."
        }
        if ($process.ExitCode -ne 0) { throw "Runtime probe exited with code $($process.ExitCode)." }
        if (-not (Test-Path -LiteralPath $probePath -PathType Leaf)) { throw "Runtime probe did not create a report." }
        $probe = Get-Content -LiteralPath $probePath -Raw | ConvertFrom-Json
        if ($probe.product -ne "Avelune Enhance") { throw "Unexpected product in runtime probe." }
        if ($probe.displayVersion -ne "2.0.0 RC3") { throw "Unexpected display version in runtime probe." }
        if ($probe.buildVersion -ne $ExpectedBuildVersion) { throw "Unexpected build version in runtime probe." }
        if ($probe.electron -ne $ExpectedElectron) { throw "The package uses Electron $($probe.electron), expected $ExpectedElectron." }
        if (-not $probe.packaged) { throw "Runtime probe reports a development build." }
        return $probe
    } finally {
        Remove-Item -LiteralPath $probePath -Force -ErrorAction SilentlyContinue
    }
}

function Write-ArtifactHashes([string]$Directory) {
    $files = Get-ChildItem -LiteralPath $Directory -File | Sort-Object Name
    $lines = foreach ($file in $files) {
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        "$hash  $($file.Name)"
    }
    Set-Content -LiteralPath (Join-Path $Directory "SHA256SUMS.txt") -Value $lines -Encoding ASCII
}


function Repair-PackageLock {
    $lockPath = Join-Path $Root "package-lock.json"
    $backupPath = Join-Path $Root "package-lock.before-public-registry.json"
    $internalPrefix = "https://packages.applied-caas-gateway1.internal.api.openai.org/artifactory/api/npm/npm-public/"
    $officialPrefix = "https://registry.npmjs.org/"

    $raw = [System.IO.File]::ReadAllText($lockPath)
    if ($raw.Contains($internalPrefix)) {
        if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
            Copy-Item -LiteralPath $lockPath -Destination $backupPath -Force
        }

        $raw = $raw.Replace($internalPrefix, $officialPrefix)
        [System.IO.File]::WriteAllText(
            $lockPath,
            $raw,
            (New-Object System.Text.UTF8Encoding($false))
        )
        Write-Log "Replaced private build-registry URLs with the official npm registry."
    }

    $updated = [System.IO.File]::ReadAllText($lockPath)
    if (
        $updated -match "applied-caas" -or
        $updated -match "internal\.api\.openai\.org"
    ) {
        throw "Private build-registry URLs remain in package-lock.json."
    }

    try {
        $null = $updated | ConvertFrom-Json
    } catch {
        throw "package-lock.json is not valid JSON after registry repair."
    }
}

function Stop-ProjectBuildProcesses {
    try {
        $rootPattern = [regex]::Escape($Root)
        $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Name -match "^(node|electron|Avelune Enhance|AveluneRuntime)\.exe$" -and
                $_.CommandLine -and
                $_.CommandLine -match $rootPattern
            }

        foreach ($process in $processes) {
            try {
                Invoke-CimMethod -InputObject $process -MethodName Terminate | Out-Null
                Write-Log ("Stopped stale build process: " + $process.Name + " PID " + $process.ProcessId)
            } catch {}
        }
    } catch {}
}

function Remove-DirectoryRobust([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    Stop-ProjectBuildProcesses

    for ($attempt = 1; $attempt -le 8; $attempt++) {
        try {
            Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
        } catch {
            Write-Log (
                "Cleanup attempt " + $attempt +
                " could not fully remove " + $Path +
                ": " + $_.Exception.Message
            )
        }

        if (-not (Test-Path -LiteralPath $Path)) {
            return
        }

        Start-Sleep -Seconds 2
    }

    $stalePath = $Path + ".stale-" + (Get-Date -Format "yyyyMMdd-HHmmss")
    try {
        Move-Item -LiteralPath $Path -Destination $stalePath -Force -ErrorAction Stop
        Write-Log ("Locked directory moved aside: " + $stalePath)
    } catch {
        throw (
            "Could not clean the incomplete dependency directory: " + $Path +
            ". Close editors, Explorer preview windows, Node/Electron processes, " +
            "and temporarily pause real-time antivirus scanning for this source folder, then retry."
        )
    }
}

function Write-CleanNpmConfig {
    $configPath = Join-Path $Root ".npmrc.avelune-build"
    $config = @(
        "registry=https://registry.npmjs.org/"
        "audit=false"
        "fund=false"
        "strict-ssl=true"
        "prefer-online=true"
        "fetch-retries=5"
        "fetch-retry-factor=2"
        "fetch-retry-mintimeout=20000"
        "fetch-retry-maxtimeout=120000"
        "fetch-timeout=300000"
    )
    Set-Content -LiteralPath $configPath -Value $config -Encoding ASCII
    return $configPath
}

try {
    Set-Content -LiteralPath $LogPath -Value "Avelune Enhance 2.0.0 RC3 Windows build log" -Encoding UTF8
    Write-Log "Avelune Enhance 2.0.0 RC3 Windows builder - public registry fix"
    Write-Log "Step 2/7 production-runtime candidate"

    Assert-SourceLayout
    Repair-PackageLock
    Assert-PackageMetadata
    $tools = Get-NodeTools
    $nodeDirectory = Split-Path -Parent $tools.Node
    $env:PATH = "$nodeDirectory;$env:PATH"
    $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
    $env:npm_config_fund = "false"
    $env:npm_config_audit = "false"
    $env:npm_config_registry = "https://registry.npmjs.org/"
    $env:npm_config_fetch_retries = "5"
    $env:npm_config_fetch_retry_factor = "2"
    $env:npm_config_fetch_retry_mintimeout = "20000"
    $env:npm_config_fetch_retry_maxtimeout = "120000"
    $env:npm_config_fetch_timeout = "300000"
    $env:NPM_CONFIG_USERCONFIG = Write-CleanNpmConfig
    $env:ELECTRON_CACHE = Join-Path $Root ".electron-cache"
    $env:ELECTRON_BUILDER_CACHE = Join-Path $Root ".electron-builder-cache"

    Write-Log ("Node: " + (& $tools.Node --version))
    Write-Log ("npm: " + (& $tools.Npm --version))

    Remove-DirectoryRobust (Join-Path $Root "node_modules")
    Remove-DirectoryRobust (Join-Path $Root "dist")

    Invoke-External $tools.Npm @(
        "ping",
        "--registry=https://registry.npmjs.org/"
    )

    Invoke-External $tools.Npm @(
        "ci",
        "--no-fund",
        "--no-audit",
        "--registry=https://registry.npmjs.org/",
        "--fetch-retries=5",
        "--fetch-retry-factor=2",
        "--fetch-retry-mintimeout=20000",
        "--fetch-retry-maxtimeout=120000",
        "--fetch-timeout=300000"
    )

    $electronCommand = Join-Path $Root "node_modules\.bin\electron.cmd"
    if (-not (Test-Path -LiteralPath $electronCommand -PathType Leaf)) {
        throw "Electron command was not installed by npm ci."
    }
    $electronVersion = (& $electronCommand --version).Trim()
    if ($electronVersion -ne ("v" + $ExpectedElectron)) {
        throw "Installed Electron version is $electronVersion, expected v$ExpectedElectron."
    }
    Write-Log ("Verified development Electron: " + $electronVersion)

    Invoke-External $tools.Npm @("test")
    Invoke-External $tools.Npm @("run", "dist:win")

    $unpacked = Join-Path $Root "dist\win-unpacked"
    $unpackedExe = Join-Path $unpacked "Avelune Enhance.exe"
    $setup = Join-Path $Root "dist\Avelune-Enhance-2.0.0-RC3-Setup-x64.exe"
    $portable = Join-Path $Root "dist\Avelune-Enhance-2.0.0-RC3-Portable-x64.exe"
    foreach ($required in @($unpackedExe, $setup, $portable)) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
            throw "Expected build artifact is missing: $required"
        }
    }

    $runtime = Test-Runtime $unpackedExe
    Write-Log ("Verified packaged runtime: Electron " + $runtime.electron + ", Chromium " + $runtime.chrome + ", Node " + $runtime.node)

    $engine = Join-Path $unpacked "resources\bin\avelune-engine.exe"
    $gpuInfo = Join-Path $unpacked "resources\bin\avelune-gpu-info.exe"
    foreach ($required in @($engine, $gpuInfo, (Join-Path $unpacked "resources\app.asar"))) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Packaged resource is missing: $required" }
    }
    $engineBytes = [System.IO.File]::ReadAllBytes($engine)
    $engineText = [System.Text.Encoding]::GetEncoding(28591).GetString($engineBytes)
    if ($engineText -match '(?i)upscayl') { throw "Previous product branding was found in the packaged engine." }
    if ($engineText -notmatch '\[OK\] Avelune task completed!') { throw "Clean Avelune completion message was not found in the packaged engine." }

    if (Test-Path -LiteralPath $OutputDirectory) { Remove-Item -LiteralPath $OutputDirectory -Recurse -Force }
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
    Copy-Item -LiteralPath $setup -Destination $OutputDirectory
    Copy-Item -LiteralPath $portable -Destination $OutputDirectory
    $runtime | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $OutputDirectory "RUNTIME-VERIFICATION.json") -Encoding UTF8

    Write-Log "RC3 Setup and Portable builds passed local packaging verification."
    Write-Log ("Output: " + $OutputDirectory)
    Copy-Item -LiteralPath $LogPath -Destination (Join-Path $OutputDirectory "RC3-BUILD.log") -Force
    Write-ArtifactHashes $OutputDirectory
    exit 0
} catch {
    Write-Log ("ERROR: " + $_.Exception.Message)
    Write-Log $_.Exception.ToString()
    exit 1
}
