$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$NativeSourceDir = Join-Path $Root "native-engine-source"
$OutputArchive = Join-Path $NativeSourceDir "Avelune-Native-Engine-Corresponding-Source-2.0.0-RC6.zip"

$MainCommit = "22774bc42e2bc3c785b5b585d213d960b1348ad5"
$NcnnCommit = "6125c9f47cd14b589de0521350668cf9d3d37e3c"
$LibwebpCommit = "8ea81561d2fdd382da60f57958741a7c23a18eb6"

function New-Directory([string]$Path) {
    [System.IO.Directory]::CreateDirectory($Path) | Out-Null
}

function Download-File([string]$Uri, [string]$Destination) {
    Write-Host "Downloading $Uri"
    Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $Destination
}

function Get-Sha256([string]$Path) {
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try {
            $hash = $sha.ComputeHash($stream)
            return (($hash | ForEach-Object { $_.ToString("x2") }) -join "")
        }
        finally {
            $sha.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

function Get-FirstDirectory([string]$Path) {
    $directory = Get-ChildItem -LiteralPath $Path -Directory | Select-Object -First 1
    if (-not $directory) { throw "No extracted directory found in $Path" }
    return $directory.FullName
}

function Test-SkippedPath([string]$RelativePath, [string[]]$Skipped) {
    $normalized = $RelativePath.Replace("/", "\")
    foreach ($skip in $Skipped) {
        if ($normalized.Equals($skip, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
        if ($normalized.StartsWith($skip + "\", [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
    return $false
}

function Copy-DirectoryFiltered(
    [string]$Source,
    [string]$Destination,
    [string[]]$Skipped
) {
    $sourceFull = [System.IO.Path]::GetFullPath($Source).TrimEnd("\")
    New-Directory $Destination
    foreach ($entry in [System.IO.Directory]::EnumerateFileSystemEntries($sourceFull, "*", [System.IO.SearchOption]::AllDirectories)) {
        $relative = $entry.Substring($sourceFull.Length).TrimStart("\")
        if (Test-SkippedPath $relative $Skipped) { continue }

        $target = Join-Path $Destination $relative
        if ([System.IO.Directory]::Exists($entry)) {
            New-Directory $target
        }
        elseif ([System.IO.File]::Exists($entry)) {
            New-Directory ([System.IO.Path]::GetDirectoryName($target))
            [System.IO.File]::Copy($entry, $target, $false)
        }
    }
}

if (Test-Path -LiteralPath $OutputArchive -PathType Leaf) {
    throw "Output archive already exists: $OutputArchive"
}

$work = Join-Path $env:TEMP ("avelune-native-source-" + [guid]::NewGuid().ToString("N"))
$downloads = Join-Path $work "downloads"
$extract = Join-Path $work "extract"
$packageRoot = Join-Path $work "package"
$sourceRoot = Join-Path $packageRoot "source"

New-Directory $downloads
New-Directory $extract
New-Directory $packageRoot

$mainZip = Join-Path $downloads "upscayl-ncnn.zip"
$ncnnZip = Join-Path $downloads "ncnn.zip"
$libwebpZip = Join-Path $downloads "libwebp.zip"

Download-File "https://codeload.github.com/upscayl/upscayl-ncnn/zip/$MainCommit" $mainZip
Download-File "https://codeload.github.com/Tencent/ncnn/zip/$NcnnCommit" $ncnnZip
Download-File "https://codeload.github.com/webmproject/libwebp/zip/$LibwebpCommit" $libwebpZip

Expand-Archive -LiteralPath $mainZip -DestinationPath (Join-Path $extract "main") -Force
Expand-Archive -LiteralPath $ncnnZip -DestinationPath (Join-Path $extract "ncnn") -Force
Expand-Archive -LiteralPath $libwebpZip -DestinationPath (Join-Path $extract "libwebp") -Force

$mainDir = Get-FirstDirectory (Join-Path $extract "main")
$ncnnDir = Get-FirstDirectory (Join-Path $extract "ncnn")
$libwebpDir = Get-FirstDirectory (Join-Path $extract "libwebp")

Copy-DirectoryFiltered $mainDir $sourceRoot @("src\ncnn", "src\libwebp")
Copy-DirectoryFiltered $ncnnDir (Join-Path $sourceRoot "src\ncnn") @()
Copy-DirectoryFiltered $libwebpDir (Join-Path $sourceRoot "src\libwebp") @()

$mainCpp = Join-Path $sourceRoot "src\main.cpp"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$text = [System.IO.File]::ReadAllText($mainCpp, $utf8NoBom)
$text = $text.Replace(
    "Usage: upscayl-bin -i infile -o outfile [options]...",
    "Usage: avelune-bin -i infile -o outfile [options]..."
)
$successEmoji = [char]::ConvertFromUtf32(0x1F64C)
$text = $text.Replace(
    "\n$successEmoji Upscayled Successfully!\n",
    "\n[OK] Avelune task completed!\n"
)
[System.IO.File]::WriteAllText($mainCpp, $text, $utf8NoBom)

foreach ($file in @(
    "avelune-engine-source.patch",
    "avelune-engine.binary-patch.json",
    "AVELUNE_ENGINE_MODIFICATIONS.md",
    "REBUILD-AVELUNE-ENGINE.md"
)) {
    [System.IO.File]::Copy((Join-Path $NativeSourceDir $file), (Join-Path $packageRoot $file), $false)
}

$manifest = [ordered]@{
    schemaVersion = 1
    package = "Avelune Native Engine Corresponding Source"
    release = "2.0.0 RC6"
    upstreamRepository = "https://github.com/upscayl/upscayl-ncnn"
    upstreamCommit = $MainCommit
    sourceRoot = "source"
    submodules = @(
        [ordered]@{ path = "source/src/ncnn"; repository = "https://github.com/Tencent/ncnn"; commit = $NcnnCommit },
        [ordered]@{ path = "source/src/libwebp"; repository = "https://github.com/webmproject/libwebp"; commit = $LibwebpCommit }
    )
    appliedPatch = "avelune-engine-source.patch"
    binaryPatchEvidence = "avelune-engine.binary-patch.json"
    buildInstructions = "REBUILD-AVELUNE-ENGINE.md"
    modificationDocumentation = "AVELUNE_ENGINE_MODIFICATIONS.md"
    generatedAt = (Get-Date).ToString("o")
}

[System.IO.File]::WriteAllText(
    (Join-Path $packageRoot "SOURCE_MANIFEST.json"),
    (($manifest | ConvertTo-Json -Depth 8) + "`n"),
    $utf8NoBom
)

Push-Location $packageRoot
try {
    Compress-Archive -Path * -DestinationPath $OutputArchive -CompressionLevel Optimal
}
finally {
    Pop-Location
}

$archiveHash = Get-Sha256 $OutputArchive
$patchHash = Get-Sha256 (Join-Path $NativeSourceDir "avelune-engine-source.patch")
$binaryPatchHash = Get-Sha256 (Join-Path $NativeSourceDir "avelune-engine.binary-patch.json")

[PSCustomObject]@{
    Archive = $OutputArchive
    Sha256 = $archiveHash
    PatchSha256 = $patchHash
    BinaryPatchSha256 = $binaryPatchHash
    WorkDirectory = $work
    Bytes = (Get-Item -LiteralPath $OutputArchive).Length
} | Format-List
