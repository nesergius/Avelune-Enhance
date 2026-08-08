$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$Models = Join-Path $Root "resources\models"
$Cache = Join-Path $Root ".build-tools\official-models"

# The newest official portable package contains the current AnimeVideo-v3
# files, but the Windows archive published for v0.2.5.0 does not contain
# realesrnet-x4plus. RealESRNet is therefore sourced from the older official
# v0.2.3.0 package and verified by pinned per-file SHA-256 values.
$PrimaryArchive = Join-Path $Cache "realesrgan-ncnn-vulkan-20220424-windows.zip"
$PrimaryExtracted = Join-Path $Cache "extracted-20220424"
$PrimaryUrl = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip"
$PrimaryArchiveSha256 = "abc02804e17982a3be33675e4d471e91ea374e65b70167abc09e31acb412802d"

$LegacyArchive = Join-Path $Cache "realesrgan-ncnn-vulkan-20211212-windows.zip"
$LegacyExtracted = Join-Path $Cache "extracted-20211212"
$LegacyUrl = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.3.0/realesrgan-ncnn-vulkan-20211212-windows.zip"
$RealEsrNetHashes = @{
  "realesrnet-x4plus.bin" = "26bccfcc82d9e8260c0c6b0dffb34ab297982740882d1f33c6d423f70b562c40"
  "realesrnet-x4plus.param" = "35330ececcea33b6c397a72548e788d5d53becee4734c50b7fada36e89f10a86"
}

$PrimaryRequired = @(
  "realesrgan-x4plus.bin", "realesrgan-x4plus.param",
  "realesrgan-x4plus-anime.bin", "realesrgan-x4plus-anime.param",
  "realesr-animevideov3-x2.bin", "realesr-animevideov3-x2.param",
  "realesr-animevideov3-x3.bin", "realesr-animevideov3-x3.param",
  "realesr-animevideov3-x4.bin", "realesr-animevideov3-x4.param"
)

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

function Download-With-Retry([string]$Url, [string]$Destination, [string]$Label) {
  $downloaded = $false
  for ($attempt = 1; $attempt -le 3 -and -not $downloaded; $attempt++) {
    try {
      Remove-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
      Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing -TimeoutSec 240
      $downloaded = $true
    }
    catch {
      Remove-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
      if ($attempt -ge 3) { throw }
      Write-Host "$Label download attempt $attempt failed. Retrying..." -ForegroundColor Yellow
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
}

function Find-Model([string]$RootPath, [string]$Name) {
  $found = Get-ChildItem -LiteralPath $RootPath -File -Recurse |
    Where-Object { $_.Name -eq $Name } |
    Select-Object -First 1
  if (-not $found) { throw "Official model package is missing $Name" }
  return $found.FullName
}

function Expand-Fresh([string]$Archive, [string]$Destination) {
  Remove-Item -LiteralPath $Destination -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Archive -LiteralPath $Archive -DestinationPath $Destination -Force
}

New-Item -ItemType Directory -Path $Cache -Force | Out-Null
New-Item -ItemType Directory -Path $Models -Force | Out-Null

# Primary package: current AnimeVideo-v3 and the two existing Avelune models.
$needPrimaryDownload = -not (Test-Path -LiteralPath $PrimaryArchive -PathType Leaf)
if (-not $needPrimaryDownload -and (Get-Sha256 $PrimaryArchive) -ne $PrimaryArchiveSha256) {
  Remove-Item -LiteralPath $PrimaryArchive -Force
  $needPrimaryDownload = $true
}
if ($needPrimaryDownload) {
  Write-Host "Downloading pinned official Real-ESRGAN NCNN model package (v0.2.5.0)..." -ForegroundColor Cyan
  Download-With-Retry $PrimaryUrl $PrimaryArchive "Primary official model package"
}
if ((Get-Sha256 $PrimaryArchive) -ne $PrimaryArchiveSha256) {
  throw "Primary official model archive SHA-256 mismatch. Download rejected."
}

Expand-Fresh $PrimaryArchive $PrimaryExtracted
foreach ($name in $PrimaryRequired) { [void](Find-Model $PrimaryExtracted $name) }

# The two models already distributed by Avelune must remain byte-identical to
# their official upstream files. This prevents accidental rebranding or drift.
$pairs = @(
  @{ Avelune = "avelune-standard-4x.bin"; Official = "realesrgan-x4plus.bin" },
  @{ Avelune = "avelune-standard-4x.param"; Official = "realesrgan-x4plus.param" },
  @{ Avelune = "digital-art-4x.bin"; Official = "realesrgan-x4plus-anime.bin" },
  @{ Avelune = "digital-art-4x.param"; Official = "realesrgan-x4plus-anime.param" }
)
foreach ($pair in $pairs) {
  $local = Join-Path $Models $pair.Avelune
  $official = Find-Model $PrimaryExtracted $pair.Official
  if (-not (Test-Path -LiteralPath $local -PathType Leaf)) {
    throw "Missing existing Avelune model: $($pair.Avelune)"
  }
  if ((Get-Sha256 $local) -ne (Get-Sha256 $official)) {
    throw "Avelune model is not byte-identical to official $($pair.Official)"
  }
}

# Copy current AnimeVideo-v3 variants from the newest package.
$animeFiles = @(
  "realesr-animevideov3-x2.bin", "realesr-animevideov3-x2.param",
  "realesr-animevideov3-x3.bin", "realesr-animevideov3-x3.param",
  "realesr-animevideov3-x4.bin", "realesr-animevideov3-x4.param"
)
foreach ($name in $animeFiles) {
  Copy-Item -LiteralPath (Find-Model $PrimaryExtracted $name) -Destination (Join-Path $Models $name) -Force
}

# RealESRNet fallback: the v0.2.5.0 Windows archive omits these files even
# though the NCNN runtime supports the model. Fetch the older official archive
# only when a verified local copy is not already available.
$realEsrNetReady = $true
foreach ($name in $RealEsrNetHashes.Keys) {
  $target = Join-Path $Models $name
  if (-not (Test-Path -LiteralPath $target -PathType Leaf) -or
      (Get-Sha256 $target) -ne $RealEsrNetHashes[$name]) {
    $realEsrNetReady = $false
    break
  }
}

if (-not $realEsrNetReady) {
  Write-Host "Current package omits RealESRNet. Downloading pinned official fallback (v0.2.3.0)..." -ForegroundColor Cyan
  if (-not (Test-Path -LiteralPath $LegacyArchive -PathType Leaf)) {
    Download-With-Retry $LegacyUrl $LegacyArchive "RealESRNet fallback package"
  }

  # Do not trust a cached archive merely because it exists. The extracted model
  # files are independently pinned below; a stale/corrupt cache is redownloaded once.
  $legacyValid = $false
  for ($pass = 1; $pass -le 2 -and -not $legacyValid; $pass++) {
    try {
      Expand-Fresh $LegacyArchive $LegacyExtracted
      foreach ($name in $RealEsrNetHashes.Keys) {
        $source = Find-Model $LegacyExtracted $name
        if ((Get-Sha256 $source) -ne $RealEsrNetHashes[$name]) {
          throw "Official RealESRNet file SHA-256 mismatch: $name"
        }
      }
      $legacyValid = $true
    }
    catch {
      if ($pass -ge 2) { throw }
      Write-Host "Cached fallback package failed verification. Downloading it again..." -ForegroundColor Yellow
      Remove-Item -LiteralPath $LegacyArchive -Force -ErrorAction SilentlyContinue
      Download-With-Retry $LegacyUrl $LegacyArchive "RealESRNet fallback package"
    }
  }

  foreach ($name in $RealEsrNetHashes.Keys) {
    Copy-Item -LiteralPath (Find-Model $LegacyExtracted $name) -Destination (Join-Path $Models $name) -Force
  }
}

$installedFiles = @(
  "realesrnet-x4plus.bin", "realesrnet-x4plus.param"
) + $animeFiles

# Final verification is performed on the exact files that will be packaged.
foreach ($name in $RealEsrNetHashes.Keys) {
  $target = Join-Path $Models $name
  if ((Get-Sha256 $target) -ne $RealEsrNetHashes[$name]) {
    throw "Installed RealESRNet verification failed: $name"
  }
}
foreach ($name in $animeFiles) {
  $target = Join-Path $Models $name
  if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "Installed AnimeVideo model is missing: $name"
  }
}

$manifest = [ordered]@{
  release = "Real-ESRGAN NCNN official model set"
  sources = @(
    [ordered]@{
      url = $PrimaryUrl
      release = "Real-ESRGAN v0.2.5.0 / NCNN 20220424"
      archiveSha256 = $PrimaryArchiveSha256
      purpose = "Current RealESRGAN and AnimeVideo-v3 models"
    },
    [ordered]@{
      url = $LegacyUrl
      release = "Real-ESRGAN v0.2.3.0 / NCNN 20211212"
      archiveSha256 = $null
      purpose = "RealESRNet x4plus fallback; exact model files are SHA-256 pinned"
    }
  )
  fetchedAt = (Get-Date).ToUniversalTime().ToString("o")
  files = @($installedFiles | ForEach-Object {
    $target = Join-Path $Models $_
    [ordered]@{
      name = $_
      bytes = (Get-Item -LiteralPath $target).Length
      sha256 = Get-Sha256 $target
      source = if ($_.StartsWith("realesrnet-")) { $LegacyUrl } else { $PrimaryUrl }
    }
  })
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Models "official-model-manifest.json") -Encoding UTF8
Write-Host "Official model packages verified and installed." -ForegroundColor Green
