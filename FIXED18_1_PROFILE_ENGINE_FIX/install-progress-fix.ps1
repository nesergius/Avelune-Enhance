# FIXED18.1 PowerShell progress handling
param([object]$percent = 0)
$percent = [int]$percent
Write-Progress -Activity "Installing AI package" -PercentComplete $percent
