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


function Assert-PackageLock {
    $lockPath = Join-Path $Root "package-lock.json"

    if (-not (Test-Path -LiteralPath $lockPath -PathType Leaf)) {
        throw "package-lock.json is missing."
    }

    $raw = [System.IO.File]::ReadAllText($lockPath)

    if (
        $raw -match "applied-caas" -or
        $raw -match "internal\.api\.openai\.org"
    ) {
        throw "package-lock.json still contains a private build registry URL."
    }

    $validationScript = @'
const fs = require("fs");
const file = process.argv[2];

try {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const lock = JSON.parse(text);

  if (lock.lockfileVersion !== 3) {
    console.error("Unexpected lockfileVersion: " + lock.lockfileVersion);
    process.exit(12);
  }

  if (!lock.packages || typeof lock.packages !== "object") {
    console.error("The packages section is missing.");
    process.exit(13);
  }

  console.log(
    "Valid package-lock.json: " +
    Object.keys(lock.packages).length +
    " package entries."
  );
  process.exit(0);
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(11);
}
'@

    $validationPath = Join-Path $env:TEMP (
        "avelune-lock-check-" +
        [guid]::NewGuid().ToString("N") +
        ".js"
    )

    try {
        [System.IO.File]::WriteAllText(
            $validationPath,
            $validationScript,
            (New-Object System.Text.UTF8Encoding($false))
        )

        # Use the call operator to preserve paths containing spaces
        # and non-ASCII characters.
        Push-Location $Root
        try {
            & $tools.Node $validationPath $lockPath
            $nodeExitCode = $LASTEXITCODE
        }
        finally {
            Pop-Location
        }

        if ($nodeExitCode -ne 0) {
            throw (
                "package-lock.json failed Node.js validation. Exit code: " +
                $nodeExitCode
            )
        }
    }
    finally {
        Remove-Item -LiteralPath $validationPath -Force -ErrorAction SilentlyContinue
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
    Write-Log "Avelune Enhance 2.0.0 RC3 Windows builder - resilient Electron probe v5"
    Write-Log "Step 2/7 production-runtime candidate"

    Assert-SourceLayout
    Assert-PackageMetadata
    $tools = Get-NodeTools
    Assert-PackageLock
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

    $nodeModules = Join-Path $Root "node_modules"
    $electronPackagePath = Join-Path $nodeModules "electron\package.json"
    $electronCommand = Join-Path $nodeModules ".bin\electron.cmd"
    $electronExecutable = Join-Path $nodeModules "electron\dist\electron.exe"
    $electronBuilderCommand = Join-Path $nodeModules ".bin\electron-builder.cmd"

    $reuseDependencies = $false
    if (
        (Test-Path -LiteralPath $electronPackagePath -PathType Leaf) -and
        (Test-Path -LiteralPath $electronCommand -PathType Leaf) -and
        (Test-Path -LiteralPath $electronBuilderCommand -PathType Leaf)
    ) {
        try {
            $installedElectronPackage = Get-Content `
                -LiteralPath $electronPackagePath `
                -Raw |
                ConvertFrom-Json

            if ($installedElectronPackage.version -eq $ExpectedElectron) {
                $reuseDependencies = $true
            }
        }
        catch {
            $reuseDependencies = $false
        }
    }

    Remove-DirectoryRobust (Join-Path $Root "dist")

    Invoke-External $tools.Npm @(
        "ping",
        "--registry=https://registry.npmjs.org/"
    )

    if ($reuseDependencies) {
        Write-Log (
            "Reusing the installed dependency tree. Electron package: " +
            $ExpectedElectron
        )
    }
    else {
        Remove-DirectoryRobust $nodeModules

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
    }

    if (-not (Test-Path -LiteralPath $electronCommand -PathType Leaf)) {
        throw "Electron command is missing after dependency installation."
    }

    $electronOutput = @(
        & $electronCommand --version 2>&1 |
            ForEach-Object { [string]$_ }
    )
    $electronExitCode = $LASTEXITCODE

    foreach ($line in $electronOutput) {
        $cleanLine = $line.Trim()
        if (-not [string]::IsNullOrWhiteSpace($cleanLine)) {
            Write-Log ("Electron probe: " + $cleanLine)
        }
    }

    if ($electronExitCode -ne 0) {
        throw (
            "Electron version probe failed with exit code " +
            $electronExitCode +
            "."
        )
    }

    $expectedVersionToken = "v" + $ExpectedElectron
    $detectedVersions = New-Object System.Collections.Generic.List[string]
    $versionPattern = '(?<![0-9])v?(\d+\.\d+\.\d+)(?![0-9])'

    foreach ($line in $electronOutput) {
        foreach ($match in [regex]::Matches([string]$line, $versionPattern)) {
            $detectedVersions.Add("v" + $match.Groups[1].Value)
        }
    }

    $electronVersion = $detectedVersions |
        Where-Object { $_ -eq $expectedVersionToken } |
        Select-Object -Last 1

    if (-not $electronVersion) {
        $capturedOutput = ($electronOutput -join " | ").Trim()
        throw (
            "Electron " +
            $expectedVersionToken +
            " was not found in the version probe output. Captured: " +
            $capturedOutput
        )
    }

    if (-not (Test-Path -LiteralPath $electronExecutable -PathType Leaf)) {
        throw (
            "Electron " +
            $ExpectedElectron +
            " was reported, but electron.exe is missing from node_modules."
        )
    }

    $electronFileVersion = (
        Get-Item -LiteralPath $electronExecutable
    ).VersionInfo.FileVersion

    Write-Log (
        "Verified development Electron: " +
        $electronVersion +
        "; binary file version: " +
        $electronFileVersion
    )

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
