# Corre gradlew assembleDebug com JDK 21 (ignora JAVA_HOME=17 do sistema).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

. (Join-Path $PSScriptRoot "resolve-jdk21.ps1")

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = "$env:LOCALAPPDATA\Android\Sdk" }
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:Path = "$sdk\platform-tools;$env:Path"

Write-Host "ANDROID_HOME=$env:ANDROID_HOME"
Push-Location (Join-Path $root "android")
try {
  & .\gradlew.bat @args
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}
