# Instala e abre o Biblos no telemóvel via ADB (APK debug Capacitor).
# Uso:
#   npm run mobile:install              # instala APK existente (ou gera se faltar) e abre
#   npm run mobile:install -- -rebuild  # rebuild completo + abre
#   npm run mobile:install -- -live     # Vite local + adb reverse + abre (teste rápido UX)
#
# Pré-requisitos: USB debugging activo, JDK 21 (não Java 17), ANDROID_HOME.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

. (Join-Path $PSScriptRoot "resolve-jdk21.ps1")

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = "$env:LOCALAPPDATA\Android\Sdk" }
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:Path = "$sdk\platform-tools;$env:Path"

$pkg = "app.biblos.mobile"
$activity = ".MainActivity"
$live = $args -contains "-live"
$rebuild = $args -contains "-rebuild" -or $live

Write-Host "ANDROID_HOME=$env:ANDROID_HOME"

$devices = adb devices | Select-String "`tdevice$"
if (-not $devices) {
  Write-Host "Nenhum telemóvel detectado. Liga o cabo USB e activa Depuração USB." -ForegroundColor Yellow
  adb devices -l
  exit 1
}

$configPath = Join-Path $root "capacitor.config.ts"
$configBackup = Join-Path $root "capacitor.config.ts.adb-bak"
$configOriginal = $null

function Restore-CapConfig {
  if ($configOriginal -ne $null -and (Test-Path $configBackup)) {
    Move-Item -Force $configBackup $configPath
    $script:configOriginal = $null
    Write-Host "capacitor.config.ts restaurado."
  }
}

try {
  if ($live) {
    Write-Host "Modo live: http://localhost:5173 via adb reverse" -ForegroundColor Cyan
    adb reverse tcp:5173 tcp:5173 | Out-Null
    adb reverse --list

    $viteUp = $false
    try {
      $null = Invoke-WebRequest -Uri "http://127.0.0.1:5173/" -UseBasicParsing -TimeoutSec 2
      $viteUp = $true
    } catch { $viteUp = $false }

    if (-not $viteUp) {
      Write-Host "A arrancar Vite (npm run dev)…" -ForegroundColor Cyan
      Start-Process -FilePath "npx" -ArgumentList "vite", "--host", "127.0.0.1", "--port", "5173" -WorkingDirectory $root -WindowStyle Minimized
      $deadline = (Get-Date).AddSeconds(45)
      do {
        Start-Sleep -Seconds 1
        try {
          $null = Invoke-WebRequest -Uri "http://127.0.0.1:5173/" -UseBasicParsing -TimeoutSec 2
          $viteUp = $true
        } catch { $viteUp = $false }
      } while (-not $viteUp -and (Get-Date) -lt $deadline)
      if (-not $viteUp) {
        Write-Host "Vite não respondeu em :5173" -ForegroundColor Red
        exit 1
      }
    }

    Copy-Item $configPath $configBackup -Force
    $configOriginal = Get-Content $configPath -Raw
    $liveConfig = @'
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.biblos.mobile",
  appName: "Biblos",
  webDir: "dist",
  server: {
    url: "http://localhost:5173",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#FFFFFF",
      overlaysWebView: false,
    },
  },
};

export default config;
'@
    Set-Content -Path $configPath -Value $liveConfig -Encoding utf8
  }

  $apk = Join-Path $root "android\app\build\outputs\apk\debug\app-debug.apk"
  if (-not (Test-Path $apk) -or $rebuild) {
    Write-Host "A gerar APK…"
    $env:CAPACITOR = "1"
    npm run build:mobile
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npx cap sync android
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    # Reaplica JDK 21 (npm/cap podem herdar JAVA_HOME=17 do sistema).
    . (Join-Path $PSScriptRoot "resolve-jdk21.ps1")
    Push-Location (Join-Path $root "android")
    try {
      .\gradlew.bat assembleDebug --no-daemon
      if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } finally {
      Pop-Location
    }
  }

  if (-not (Test-Path $apk)) {
    Write-Host "APK não encontrado: $apk" -ForegroundColor Red
    exit 1
  }

  Write-Host "A instalar $apk…"
  adb install -r $apk
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "A abrir $pkg…"
  adb shell am start -n "$pkg/$activity"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host ""
  Write-Host "Biblos aberto no telemóvel." -ForegroundColor Green
  if ($live) {
    Write-Host "DevTools: chrome://inspect/#devices (WebView)." -ForegroundColor Cyan
    Write-Host "Mantém o Vite a correr. Ctrl+C no terminal do Vite para parar." -ForegroundColor Cyan
  }
}
finally {
  Restore-CapConfig
}
