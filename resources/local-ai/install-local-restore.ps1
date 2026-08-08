param(
  [Parameter(Mandatory=$true)][string]$InstallRoot,
  [ValidateSet('auto','cpu','cuda')][string]$Backend = 'auto',
  [object]$percent = 0
)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

function Normalize-Percent {
  param([object]$value)
  try {
    if ($null -eq $value) { return 0 }
    $text = [string]$value
    if ([string]::IsNullOrWhiteSpace($text)) { return 0 }
    $match = [regex]::Match($text,'-?\d+(?:[\.,]\d+)?')
    if ($match.Success) {
      $numberText = $match.Value.Replace(',', '.')
      $n = [int][Math]::Round([double]::Parse($numberText, [Globalization.CultureInfo]::InvariantCulture))
      if ($n -lt 0) { return 0 }
      if ($n -gt 100) { return 100 }
      return $n
    }
  } catch {}
  return 0
}
$percent = Normalize-Percent $percent
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$pipInstallArgs = @('-m','pip','install','--disable-pip-version-check','--no-warn-script-location','--timeout','120','--retries','5')

function Write-Stage {
  param(
    [Parameter(Mandatory=$true, Position=0)][string]$stage,
    [Parameter(Position=1)][object]$stagePercent = 0
  )
  $safePercent = Normalize-Percent $stagePercent
  Write-Output ("AVELUNE_STAGE:{0}:{1}" -f $safePercent,$stage)
}
function Download([string]$url,[string]$target,[int64]$minimumBytes = 32){
  $parent = Split-Path -Parent $target
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  function Test-ExistingDownload([string]$path,[int64]$minBytes) {
    if (!(Test-Path -LiteralPath $path)) { return $false }
    try {
      $length = (Get-Item -LiteralPath $path).Length
      if ($length -lt $minBytes) { return $false }
      if ([IO.Path]::GetExtension($path) -ieq '.zip') {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
        $zip = [IO.Compression.ZipFile]::OpenRead($path)
        $zip.Dispose()
      }
      return $true
    } catch {
      return $false
    }
  }
  if (Test-ExistingDownload $target $minimumBytes) { return }
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }
      $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
      $response = $null
      if ($curl) {
        & $curl.Source --location --fail --silent --show-error --retry 5 --retry-delay 5 --connect-timeout 30 --max-time 3600 --speed-limit 1024 --speed-time 60 --output $target $url
        if ($LASTEXITCODE -ne 0) { throw "curl failed with exit code $LASTEXITCODE" }
      } else {
        $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 120 -Uri $url -OutFile $target
      }
      if (!(Test-Path $target)) { throw "Downloaded file is missing: $target" }
      $actualLength = (Get-Item $target).Length
      if ($actualLength -lt $minimumBytes) { throw "Downloaded file is too small: $target" }
      $expectedLength = 0L
      if ($null -ne $response -and $null -ne $response.Headers) {
        $contentLength = $response.Headers['Content-Length']
        if ($contentLength -is [array]) { $contentLength = $contentLength[0] }
        [void][int64]::TryParse([string]$contentLength, [ref]$expectedLength)
      }
      if ($expectedLength -gt 0 -and $actualLength -ne $expectedLength) {
        throw "Downloaded file size mismatch: $target ($actualLength of $expectedLength bytes)"
      }
      if ([IO.Path]::GetExtension($target) -ieq '.zip') {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
        $zip = [IO.Compression.ZipFile]::OpenRead($target)
        $zip.Dispose()
      }
      return
    } catch {
      if ($attempt -ge 3) { throw "Download failed after $attempt attempts: $url. $($_.Exception.Message)" }
      Start-Sleep -Seconds (5 * $attempt)
    }
  }
}
function Run {
  param(
    [Parameter(Mandatory=$true)][string]$exe,
    [object[]]$arguments = @()
  )
  if ([string]::IsNullOrWhiteSpace($exe)) { throw "Command path is empty." }
  $argv = @()
  if ($null -ne $arguments) { $argv = @($arguments) }
  & $exe @argv
  if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $exe $($argv -join ' ')" }
}
function Get-InstalledTorchBackend {
  param([Parameter(Mandatory=$true)][string]$pythonExe)
  try {
    $output = & $pythonExe -c "import torch; print('cuda' if getattr(torch.version, 'cuda', None) else 'cpu')" 2>$null
    if ($LASTEXITCODE -eq 0) { return ([string]$output).Trim().ToLowerInvariant() }
  } catch {}
  return ''
}

$InstallRoot = [IO.Path]::GetFullPath($InstallRoot)
$TempRoot = Join-Path $env:TEMP ("avelune-local-restore-" + [guid]::NewGuid().ToString('N'))
$PythonRoot = Join-Path $InstallRoot 'python'
$ModelsRoot = Join-Path $InstallRoot 'models'
$FaceWeightsRoot = Join-Path $ModelsRoot 'gfpgan\weights'
$RunnerRoot = Join-Path $InstallRoot 'runtime'
New-Item -ItemType Directory -Force -Path $TempRoot,$InstallRoot,$ModelsRoot,$FaceWeightsRoot,$RunnerRoot | Out-Null
try {
  Write-Stage -stage 'Preparing local Python' -stagePercent 3
  $python = Join-Path $PythonRoot 'python.exe'
  if (!(Test-Path -LiteralPath $python)) {
    $pythonZip = Join-Path $TempRoot 'python.zip'
    Download 'https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip' $pythonZip
    if (Test-Path $PythonRoot) { Remove-Item -Recurse -Force $PythonRoot }
    New-Item -ItemType Directory -Force -Path $PythonRoot | Out-Null
    Expand-Archive -Force $pythonZip $PythonRoot
  }
  $pth = Join-Path $PythonRoot 'python310._pth'
  if (Test-Path -LiteralPath $pth) {
    (Get-Content $pth) -replace '#import site','import site' | Set-Content -Encoding ascii $pth
  }

  Write-Stage -stage 'Installing package manager' -stagePercent 10
  $getPip = Join-Path $TempRoot 'get-pip.py'
  Download 'https://bootstrap.pypa.io/get-pip.py' $getPip
  Run -exe $python -arguments @($getPip,'--disable-pip-version-check')
  Run -exe $python -arguments ($pipInstallArgs + @('--upgrade','pip==24.3.1','setuptools==75.6.0','wheel==0.45.1'))

  if ($Backend -eq 'auto') {
    $Backend = if (Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue) { 'cuda' } else { 'cpu' }
  }
  Write-Stage -stage ("Installing AI runtime ($Backend)") -stagePercent 20
  $torchInstallArgs = @($pipInstallArgs)
  $existingTorchBackend = Get-InstalledTorchBackend -pythonExe $python
  if ($existingTorchBackend -and $existingTorchBackend -ne $Backend) {
    $torchInstallArgs += @('--force-reinstall')
  }
  if ($Backend -eq 'cuda') {
    Run -exe $python -arguments ($torchInstallArgs + @('--index-url','https://download.pytorch.org/whl/cu121','torch==2.1.2','torchvision==0.16.2'))
  } else {
    Run -exe $python -arguments ($torchInstallArgs + @('--index-url','https://download.pytorch.org/whl/cpu','torch==2.1.2','torchvision==0.16.2'))
  }
  Write-Stage -stage 'Installing GFPGAN and Real-ESRGAN' -stagePercent 56
  Run -exe $python -arguments ($pipInstallArgs + @('--prefer-binary','numpy==1.26.4','opencv-python-headless==4.9.0.80','basicsr==1.4.2','facexlib==0.3.0','gfpgan==1.3.8','realesrgan==0.3.0'))

  Write-Stage -stage 'Downloading heavy models' -stagePercent 76
  Download 'https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth' (Join-Path $ModelsRoot 'GFPGANv1.4.pth') 300000000
  Download 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth' (Join-Path $ModelsRoot 'RealESRGAN_x4plus.pth') 60000000
  Download 'https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_Resnet50_Final.pth' (Join-Path $FaceWeightsRoot 'detection_Resnet50_Final.pth') 100000000
  Download 'https://github.com/xinntao/facexlib/releases/download/v0.2.2/parsing_parsenet.pth' (Join-Path $FaceWeightsRoot 'parsing_parsenet.pth') 80000000
  Copy-Item -Force (Join-Path $PSScriptRoot 'local_restore_runner.py') (Join-Path $RunnerRoot 'local_restore_runner.py')

  Write-Stage -stage 'Verifying installed package' -stagePercent 94
  $verifyCode = "import os, torch, cv2, gfpgan, realesrgan; root=r'$($FaceWeightsRoot.Replace("'","''"))'; assert os.path.exists(os.path.join(root,'detection_Resnet50_Final.pth')) and os.path.exists(os.path.join(root,'parsing_parsenet.pth')), 'GFPGAN face helper weights are missing'; assert ('$Backend' != 'cuda' or torch.version.cuda), 'CUDA backend requested but CPU torch wheel is active'; print(torch.__version__)"
  Run -exe $python -arguments @('-c',$verifyCode)
  $manifest = [ordered]@{
    schema = 3
    runtimePatch = 3
    installedAt = (Get-Date).ToUniversalTime().ToString('o')
    backend = $Backend
    python = '3.10.11'
    gfpgan = '1.3.8'
    models = @('GFPGANv1.4.pth','RealESRGAN_x4plus.pth','detection_Resnet50_Final.pth','parsing_parsenet.pth')
  }
  $manifestJson = $manifest | ConvertTo-Json -Depth 4
  [IO.File]::WriteAllText((Join-Path $InstallRoot 'installed.json'), $manifestJson, (New-Object System.Text.UTF8Encoding $false))
  Write-Stage -stage 'Ready' -stagePercent 100
} finally {
  Remove-Item -Recurse -Force $TempRoot -ErrorAction SilentlyContinue
}
