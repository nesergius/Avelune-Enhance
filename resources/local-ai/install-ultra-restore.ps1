param(
  [Parameter(Mandatory=$true)][string]$InstallRoot,
  [ValidateSet('auto','cpu','cuda')][string]$Backend = 'auto',
  [object]$percent = 0
)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Normalize-Percent {
  param([object]$Value)
  try {
    if ($null -eq $Value) { return 0 }
    $Text = [string]$Value
    if ([string]::IsNullOrWhiteSpace($Text)) { return 0 }
    $Match = [regex]::Match($Text,'-?\d+(?:[\.,]\d+)?')
    if ($Match.Success) {
      $NumberText = $Match.Value.Replace(',', '.')
      $N = [int][Math]::Round([double]::Parse($NumberText, [Globalization.CultureInfo]::InvariantCulture))
      if ($N -lt 0) { return 0 }
      if ($N -gt 100) { return 100 }
      return $N
    }
  } catch {}
  return 0
}
$percent = Normalize-Percent $percent
$PipInstallArgs = @('-m','pip','install','--disable-pip-version-check','--no-warn-script-location','--timeout','120','--retries','5')
$env:HF_HUB_DOWNLOAD_TIMEOUT = '120'
$env:HF_HUB_ETAG_TIMEOUT = '60'
function Write-Stage {
  param(
    [Parameter(Mandatory=$true, Position=0)][string]$Text,
    [Parameter(Position=1)][object]$StagePercent = 0
  )
  $SafePercent = Normalize-Percent $StagePercent
  Write-Output ("AVELUNE_STAGE:{0}:{1}" -f $SafePercent,$Text)
}
function Download([string]$Url,[string]$Target,[int64]$MinimumBytes = 32){
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Target) | Out-Null
  function Test-ExistingDownload([string]$Path,[int64]$MinBytes) {
    if (!(Test-Path -LiteralPath $Path)) { return $false }
    try {
      $Length = (Get-Item -LiteralPath $Path).Length
      if ($Length -lt $MinBytes) { return $false }
      if ([IO.Path]::GetExtension($Path) -ieq '.zip') {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
        $Zip = [IO.Compression.ZipFile]::OpenRead($Path)
        $Zip.Dispose()
      }
      return $true
    } catch {
      return $false
    }
  }
  if (Test-ExistingDownload $Target $MinimumBytes) { return }
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      if (Test-Path -LiteralPath $Target) { Remove-Item -LiteralPath $Target -Force }
      $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
      $response = $null
      if ($curl) {
        & $curl.Source --location --fail --silent --show-error --retry 5 --retry-delay 5 --connect-timeout 30 --max-time 3600 --speed-limit 1024 --speed-time 60 --output $Target $Url
        if ($LASTEXITCODE -ne 0) { throw "curl failed with exit code $LASTEXITCODE" }
      } else {
        $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 120 -Uri $Url -OutFile $Target
      }
      if (!(Test-Path $Target)) { throw "Downloaded file is missing: $Target" }
      $actualLength = (Get-Item $Target).Length
      if ($actualLength -lt $MinimumBytes) { throw "Downloaded file is too small: $Target" }
      $expectedLength = 0L
      if ($null -ne $response -and $null -ne $response.Headers) {
        $contentLength = $response.Headers['Content-Length']
        if ($contentLength -is [array]) { $contentLength = $contentLength[0] }
        [void][int64]::TryParse([string]$contentLength, [ref]$expectedLength)
      }
      if ($expectedLength -gt 0 -and $actualLength -ne $expectedLength) {
        throw "Downloaded file size mismatch: $Target ($actualLength of $expectedLength bytes)"
      }
      if ([IO.Path]::GetExtension($Target) -ieq '.zip') {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
        $zip = [IO.Compression.ZipFile]::OpenRead($Target)
        $zip.Dispose()
      }
      return
    } catch {
      if ($attempt -ge 3) { throw "Download failed after $attempt attempts: $Url. $($_.Exception.Message)" }
      Start-Sleep -Seconds (5 * $attempt)
    }
  }
}
function Run {
  param(
    [Parameter(Mandatory=$true)][string]$Exe,
    [object[]]$Arguments = @()
  )
  if ([string]::IsNullOrWhiteSpace($Exe)) { throw "Command path is empty." }
  $argv = @()
  if ($null -ne $Arguments) { $argv = @($Arguments) }
  & $Exe @argv
  if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $Exe $($argv -join ' ')" }
}
function Get-InstalledTorchBackend {
  param([Parameter(Mandatory=$true)][string]$PythonExe)
  try {
    $Output = & $PythonExe -c "import torch; print('cuda' if getattr(torch.version, 'cuda', None) else 'cpu')" 2>$null
    if ($LASTEXITCODE -eq 0) { return ([string]$Output).Trim().ToLowerInvariant() }
  } catch {}
  return ''
}
$InstallRoot = [IO.Path]::GetFullPath($InstallRoot)
$TempRoot = Join-Path $env:TEMP ("avelune-ultra-" + [guid]::NewGuid().ToString('N'))
$PythonRoot = Join-Path $InstallRoot 'python'
$ModelsRoot = Join-Path $InstallRoot 'models'
$FaceWeightsRoot = Join-Path $ModelsRoot 'gfpgan\weights'
$RuntimeRoot = Join-Path $InstallRoot 'runtime'
$RepoRoot = Join-Path $InstallRoot 'DiffBIR'
New-Item -ItemType Directory -Force -Path $TempRoot,$InstallRoot,$ModelsRoot,$FaceWeightsRoot,$RuntimeRoot | Out-Null
try {
  Write-Stage -Text 'Preparing Python 3.10' -StagePercent 2
  $Python = Join-Path $PythonRoot 'python.exe'
  if (!(Test-Path -LiteralPath $Python)) {
    $PythonZip = Join-Path $TempRoot 'python.zip'
    Download 'https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip' $PythonZip
    if (Test-Path $PythonRoot) { Remove-Item -Recurse -Force $PythonRoot }
    New-Item -ItemType Directory -Force -Path $PythonRoot | Out-Null
    Expand-Archive -Force $PythonZip $PythonRoot
  }
  $Pth = Join-Path $PythonRoot 'python310._pth'
  if (Test-Path -LiteralPath $Pth) {
    (Get-Content $Pth) -replace '#import site','import site' | Set-Content -Encoding ascii $Pth
  }

  Write-Stage -Text 'Installing pip' -StagePercent 8
  $GetPip = Join-Path $TempRoot 'get-pip.py'
  Download 'https://bootstrap.pypa.io/get-pip.py' $GetPip
  Run -Exe $Python -Arguments @($GetPip,'--disable-pip-version-check')
  Run -Exe $Python -Arguments ($PipInstallArgs + @('--upgrade','pip==24.3.1','setuptools==75.6.0','wheel==0.45.1'))

  if ($Backend -eq 'auto') { $Backend = if (Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue) { 'cuda' } else { 'cpu' } }
  Write-Stage -Text ("Installing PyTorch ($Backend)") -StagePercent 15
  $TorchInstallArgs = @($PipInstallArgs)
  $ExistingTorchBackend = Get-InstalledTorchBackend -PythonExe $Python
  if ($ExistingTorchBackend -and $ExistingTorchBackend -ne $Backend) {
    $TorchInstallArgs += @('--force-reinstall')
  }
  if ($Backend -eq 'cuda') {
    Run -Exe $Python -Arguments ($TorchInstallArgs + @('--index-url','https://download.pytorch.org/whl/cu121','torch==2.1.2','torchvision==0.16.2'))
  } else {
    Run -Exe $Python -Arguments ($TorchInstallArgs + @('--index-url','https://download.pytorch.org/whl/cpu','torch==2.1.2','torchvision==0.16.2'))
  }

  Write-Stage -Text 'Downloading DiffBIR v2.1' -StagePercent 30
  if (!(Test-Path -LiteralPath (Join-Path $RepoRoot 'inference.py'))) {
    $RepoZip = Join-Path $TempRoot 'diffbir.zip'
    Download 'https://github.com/XPixelGroup/DiffBIR/archive/refs/tags/v2.1.0.zip' $RepoZip
    $ExtractRoot = Join-Path $TempRoot 'extract'
    Expand-Archive -Force $RepoZip $ExtractRoot
    if (Test-Path $RepoRoot) { Remove-Item -Recurse -Force $RepoRoot }
    Move-Item (Join-Path $ExtractRoot 'DiffBIR-2.1.0') $RepoRoot
  }

  Write-Stage -Text 'Installing Ultra support wheels' -StagePercent 38
  Run -Exe $Python -Arguments ($PipInstallArgs + @('--prefer-binary','--use-pep517','numpy==1.26.4','scipy==1.12.0','matplotlib==3.8.4','filterpy==1.4.5'))

  Write-Stage -Text 'Installing diffusion runtime' -StagePercent 42
  Run -Exe $Python -Arguments ($PipInstallArgs + @('--prefer-binary','numpy==1.26.4','pandas==2.2.2','opencv-python-headless==4.9.0.80','pillow==10.4.0','einops==0.8.0','omegaconf==2.3.0','timm==0.9.16','transformers==4.39.3','accelerate==0.28.0','safetensors==0.4.3','huggingface_hub==0.23.4','scipy==1.12.0','pytorch-lightning==2.2.1','clean-fid==0.1.35','basicsr==1.4.2','facexlib==0.3.0','gfpgan==1.3.8','realesrgan==0.3.0','ftfy==6.2.0','regex==2023.12.25','torchsde==0.2.6'))

  Write-Stage -Text 'Downloading DiffBIR IRControlNet' -StagePercent 62
  $DiffBIRModelCode = "from huggingface_hub import hf_hub_download; hf_hub_download(repo_id='lxq007/DiffBIR-v2', filename='DiffBIR_v2.1.pt', local_dir=r'$($ModelsRoot.Replace("'","''"))', local_dir_use_symlinks=False)"
  Run -Exe $Python -Arguments @('-c',$DiffBIRModelCode)
  Download 'https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth' (Join-Path $ModelsRoot 'GFPGANv1.4.pth') 300000000
  Download 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth' (Join-Path $ModelsRoot 'RealESRGAN_x4plus.pth') 60000000
  Download 'https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_Resnet50_Final.pth' (Join-Path $FaceWeightsRoot 'detection_Resnet50_Final.pth') 100000000
  Download 'https://github.com/xinntao/facexlib/releases/download/v0.2.2/parsing_parsenet.pth' (Join-Path $FaceWeightsRoot 'parsing_parsenet.pth') 80000000

  Write-Stage -Text 'Preparing DiffBIR local weights' -StagePercent 76
  $WeightsRoot = Join-Path $RepoRoot 'weights'
  New-Item -ItemType Directory -Force -Path $WeightsRoot | Out-Null
  Copy-Item -Force (Join-Path $ModelsRoot 'DiffBIR_v2.1.pt') (Join-Path $WeightsRoot 'DiffBIR_v2.1.pt')
  $Code = "import os; from huggingface_hub import hf_hub_download; root=r'$($WeightsRoot.Replace("'","''"))'; specs=[('sd2.1-base-zsnr-laionaes5.ckpt',5000000000),('realesrgan_s4_swinir_100k.pth',80000000)]; [hf_hub_download(repo_id='lxq007/DiffBIR-v2', filename=name, local_dir=root, local_dir_use_symlinks=False, resume_download=True) for name,min_size in specs if (not os.path.exists(os.path.join(root,name)) or os.path.getsize(os.path.join(root,name)) < min_size)]"
  Run -Exe $Python -Arguments @('-c',$Code)

  Copy-Item -Force (Join-Path $PSScriptRoot 'ultra_restore_runner.py') (Join-Path $RuntimeRoot 'ultra_restore_runner.py')
  Write-Stage -Text 'Verifying Ultra package' -StagePercent 96
  $VerifyCode = "import os, sys; sys.path.insert(0, r'$($RepoRoot.Replace("'","''"))'); import torch, cv2, pandas, ftfy, regex, torchsde, transformers, basicsr, gfpgan, realesrgan, diffbir; root=r'$($FaceWeightsRoot.Replace("'","''"))'; assert os.path.exists(os.path.join(root,'detection_Resnet50_Final.pth')) and os.path.exists(os.path.join(root,'parsing_parsenet.pth')), 'GFPGAN face helper weights are missing'; assert ('$Backend' != 'cuda' or torch.version.cuda), 'CUDA backend requested but CPU torch wheel is active'; print(torch.__version__)"
  Run -Exe $Python -Arguments @('-c',$VerifyCode)
  $ManifestJson = [ordered]@{ schema=3; runtimePatch=3; version='DiffBIR 2.1'; installedAt=(Get-Date).ToUniversalTime().ToString('o'); backend=$Backend; license='Apache-2.0 + OpenRAIL++'; torch='2.1.2'; torchvision='0.16.2'; models=@('DiffBIR_v2.1.pt','GFPGANv1.4.pth','RealESRGAN_x4plus.pth','detection_Resnet50_Final.pth','parsing_parsenet.pth','Stable Diffusion 2.1') } | ConvertTo-Json -Depth 5
  [IO.File]::WriteAllText((Join-Path $InstallRoot 'installed.json'), $ManifestJson, (New-Object System.Text.UTF8Encoding $false))
  Write-Stage -Text 'Photo Restore Ultra ready' -StagePercent 100
} finally { Remove-Item -Recurse -Force $TempRoot -ErrorAction SilentlyContinue }
