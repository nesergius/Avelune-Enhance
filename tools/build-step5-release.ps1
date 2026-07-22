$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$LogPath = Join-Path $Root "STEP5-BUILD.log"
$OutputRoot = Join-Path $Root "STEP5-OUTPUT"
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
    $candidates = @(
        (Join-Path $Root "native-engine-source"),
        (Join-Path $Root "third_party\engine-source"),
        (Join-Path $Root "resources\win\engine-source")
    )
    foreach ($candidate in $candidates) {
        if (
            (Test-Path -LiteralPath $candidate -PathType Container) -and
            (
                (Get-ChildItem -LiteralPath $candidate -Recurse -File -Include *.c,*.cc,*.cpp,*.h,*.hpp,CMakeLists.txt -ErrorAction SilentlyContinue |
                    Select-Object -First 1)
            )
        ) {
            return $true
        }
    }
    return $false
}

function New-SourceSnapshot([string]$Destination, [bool]$NativeSourceComplete) {
    $stage = Join-Path $env:TEMP ("avelune-step5-source-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    try {
        $snapshot = Join-Path $stage "Avelune-Enhance-2.0.0-RC3-Source"
        New-Item -ItemType Directory -Path $snapshot -Force | Out-Null

        $excludeDirectories = @(
            "node_modules", "dist", "RC3-OUTPUT", "STEP5-OUTPUT",
            ".build-tools", ".electron-cache", ".electron-builder-cache",
            ".git", ".idea", ".vscode"
        )
        $excludeFiles = @(
            "RC3-BUILD.log", "STEP5-BUILD.log", "package-lock.before-*",
            "*.tmp", "*.bak"
        )

        $arguments = @(
            $Root,
            $snapshot,
            "/E", "/COPY:DAT", "/DCOPY:DAT", "/R:1", "/W:1",
            "/NFL", "/NDL", "/NJH", "/NJS", "/NP"
        )
        foreach ($dir in $excludeDirectories) {
            $arguments += @("/XD", (Join-Path $Root $dir))
        }
        foreach ($file in $excludeFiles) {
            $arguments += @("/XF", $file)
        }

        & robocopy @arguments | Out-Null
        if ($LASTEXITCODE -ge 8) {
            throw "Source staging failed with robocopy code $LASTEXITCODE."
        }

        $notice = @"
# Source completeness notice

This archive is an Avelune Enhance 2.0.0 RC3 source snapshot.

Native engine corresponding source detected: $NativeSourceComplete

The packaged application contains resources/win/bin/avelune-engine.exe.
If Native engine corresponding source detected is False, this archive must
not be represented as complete AGPL Corresponding Source. Before public
distribution, add the exact source code and reproducible build instructions
for the distributed native engine, or document a legally valid independent
third-party component and its licence.

The AI model-weight licence and provenance must also remain documented in
MODEL_PROVENANCE.md and THIRD_PARTY_NOTICES.md.
"@
        Set-Content -LiteralPath (Join-Path $snapshot "SOURCE_COMPLETENESS_NOTICE.md") -Value $notice -Encoding UTF8

        if (Test-Path -LiteralPath $Destination) {
            Remove-Item -LiteralPath $Destination -Force
        }
        Compress-Archive -LiteralPath $snapshot -DestinationPath $Destination -CompressionLevel Optimal
    }
    finally {
        Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
    }
}

try {
    Set-Content -LiteralPath $LogPath -Value "Avelune Enhance Step 5/7 release build log" -Encoding UTF8
    Write-Log "Avelune Enhance — Step 5/7 release infrastructure" "Cyan"
    Write-Log "Update endpoint: https://avelune.sayqq.ru/updates/"
    Write-Log "RC3 channel: rc (stable releases will use latest)"

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

    Write-Log "Updating the public package lock for electron-updater $UpdaterVersion..." "Yellow"
    Invoke-External $tools.Npm @(
        "install",
        "--package-lock-only",
        "--ignore-scripts",
        "--save-exact",
        "electron-updater@$UpdaterVersion",
        "--registry=$PublicRegistry",
        "--no-fund",
        "--no-audit"
    )
    Assert-PublicLock

    if (Test-Path -LiteralPath (Join-Path $Root "node_modules")) {
        Remove-Item -LiteralPath (Join-Path $Root "node_modules") -Recurse -Force
    }
    if (Test-Path -LiteralPath $Dist) {
        Remove-Item -LiteralPath $Dist -Recurse -Force
    }
    if (Test-Path -LiteralPath $OutputRoot) {
        Remove-Item -LiteralPath $OutputRoot -Recurse -Force
    }

    Invoke-External $tools.Npm @(
        "ci",
        "--registry=$PublicRegistry",
        "--no-fund",
        "--no-audit"
    )
    Invoke-External $tools.Npm @("test")
    Invoke-External $tools.Npm @("run", "release:win")

    $setup = Find-Artifact "Avelune-Enhance-2.0.0-RC3-Setup-x64.exe"
    $portable = Find-Artifact "Avelune-Enhance-2.0.0-RC3-Portable-x64.exe"
    $blockmap = Find-Artifact "Avelune-Enhance-2.0.0-RC3-Setup-x64.exe.blockmap"
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

    $unpackedUpdateConfig = Join-Path $Dist "win-unpacked\resources\app-update.yml"
    if (-not (Test-Path -LiteralPath $unpackedUpdateConfig -PathType Leaf)) {
        throw "Packaged app-update.yml was not generated."
    }
    $updateConfigText = Get-Content -LiteralPath $unpackedUpdateConfig -Raw
    if ($updateConfigText -notmatch "https://avelune\.sayqq\.ru/updates/") {
        throw "Packaged app-update.yml does not contain the official update endpoint."
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

    $nativeSourceComplete = Test-NativeEngineSource
    $sourceName = "Avelune-Enhance-2.0.0-RC3-Source-Snapshot.zip"
    $sourceArchive = Join-Path $sourceDir $sourceName
    Write-Log "Creating the source snapshot. This can take several minutes..." "Yellow"
    New-SourceSnapshot $sourceArchive $nativeSourceComplete

    $setupHash = Get-Sha256 $setup.FullName
    $portableHash = Get-Sha256 $portable.FullName
    $sourceHash = Get-Sha256 $sourceArchive

    $releaseData = [ordered]@{
        product = "Avelune Enhance"
        channel = "rc"
        current = [ordered]@{
            version = "2.0.0 RC3"
            build = "2.0.0.3"
            date = (Get-Date -Format "yyyy-MM-dd")
            public = $false
            notes = "RC3 release infrastructure is prepared. Public download remains disabled until Authenticode signing and final security scanning."
            files = @(
                [ordered]@{
                    type = "setup"
                    label = "Windows installer"
                    filename = $setup.Name
                    url = ("downloads/" + $setup.Name)
                    size = Get-FriendlySize $setup.Length
                    sha256 = $setupHash
                    available = $false
                },
                [ordered]@{
                    type = "portable"
                    label = "Portable version"
                    filename = $portable.Name
                    url = ("downloads/" + $portable.Name)
                    size = Get-FriendlySize $portable.Length
                    sha256 = $portableHash
                    available = $false
                },
                [ordered]@{
                    type = "source"
                    label = "Source snapshot"
                    filename = $sourceName
                    url = ("source/" + $sourceName)
                    size = Get-FriendlySize ((Get-Item -LiteralPath $sourceArchive).Length)
                    sha256 = $sourceHash
                    available = $false
                    correspondingSourceComplete = $nativeSourceComplete
                }
            )
        }
    }
    $releaseData |
        ConvertTo-Json -Depth 10 |
        Set-Content -LiteralPath (Join-Path $siteData "releases.step5.json") -Encoding UTF8

    $manifest = [ordered]@{
        Gate = "5/7"
        Candidate = "Avelune Enhance 2.0.0 RC3"
        Success = $true
        Timestamp = (Get-Date).ToString("o")
        UpdateEndpoint = "https://avelune.sayqq.ru/updates/"
        Channel = if ($channelFile.Name -eq "latest.yml") { "latest" } else { "rc" }
        StableMetadataExpectedLater = "latest.yml"
        NativeEngineCorrespondingSourceComplete = $nativeSourceComplete
        PublicReleaseAllowed = $false
        PublicReleaseBlockers = @(
            "Authenticode signing is not complete.",
            "Final Defender and multi-engine scanning is not complete.",
            $(if (-not $nativeSourceComplete) { "Native engine Corresponding Source is missing." } else { $null })
        ) | Where-Object { $_ }
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
        Set-Content -LiteralPath (Join-Path $OutputRoot "STEP5-RELEASE-MANIFEST.json") -Encoding UTF8

    $allUploadFiles = Get-ChildItem -LiteralPath $upload -File -Recurse | Sort-Object FullName
    $hashLines = foreach ($file in $allUploadFiles) {
        $relative = $file.FullName.Substring($upload.Length).TrimStart("\").Replace("\", "/")
        "$(Get-Sha256 $file.FullName)  $relative"
    }
    Set-Content -LiteralPath (Join-Path $OutputRoot "SHA256SUMS.txt") -Value $hashLines -Encoding ASCII

    $uploadMap = @"
AVELUNE STEP 5/7 — UPLOAD MAP

Upload the CONTENTS of:
$upload

to:
avelune.sayqq.ru/public_html/

Generated update metadata:
$($channelFile.Name)

RC3 uses the private test channel "rc".
A stable version such as 2.0.0 must be built with channel "latest";
electron-builder will then generate latest.yml.

DO NOT make downloads public yet.
The generated assets are unsigned and final antivirus scanning is pending.

Website data:
assets/data/releases.step5.json

Review it and replace the live releases.json only after the signed artifacts
have been generated and verified.

Native engine Corresponding Source complete: $nativeSourceComplete
"@
    Set-Content -LiteralPath (Join-Path $OutputRoot "UPLOAD-MAP-RU.txt") -Value $uploadMap -Encoding UTF8

    Copy-Item -LiteralPath $LogPath -Destination (Join-Path $OutputRoot "STEP5-BUILD.log") -Force

    Write-Log "Step 5/7 build completed." "Green"
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
