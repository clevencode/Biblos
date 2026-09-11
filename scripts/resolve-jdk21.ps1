# Resolve e exporta JAVA_HOME para JDK 21 (nunca Java 17).
# Dot-source: . .\scripts\resolve-jdk21.ps1

function Get-BiblosJdk21Home {
  $roots = @(
    "C:\Program Files\Eclipse Adoptium",
    "C:\Program Files\Java",
    "C:\Program Files\Microsoft",
    "C:\Program Files\Amazon Corretto",
    "$env:LOCALAPPDATA\Programs\Eclipse Adoptium"
  )

  $dirs = @()
  foreach ($root in $roots) {
    if (-not (Test-Path $root)) { continue }
    $dirs += Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match '(?i)jdk-?21|jdk.?21|21[\.\-]' }
  }

  foreach ($dir in ($dirs | Sort-Object FullName -Descending)) {
    $java = Join-Path $dir.FullName "bin\java.exe"
    if (-not (Test-Path $java)) { continue }
    $ver = & $java -version 2>&1 | Out-String
    if ($ver -match 'version "21') {
      return $dir.FullName
    }
  }

  return $null
}

$jdk21 = Get-BiblosJdk21Home
if (-not $jdk21) {
  Write-Host "JDK 21 obrigatório para o build Android. Java 17 não é suportado." -ForegroundColor Red
  Write-Host "Instala Temurin 21 (Eclipse Adoptium) e volta a tentar." -ForegroundColor Yellow
  exit 1
}

$env:JAVA_HOME = $jdk21
# Garante que java/javac do 21 ficam à frente de qualquer JDK 17 no PATH.
$env:Path = "$env:JAVA_HOME\bin;" + (
  ($env:Path -split ';' | Where-Object {
    $_ -and ($_ -notmatch '(?i)\\(?:jdk|jre)-?17') -and ($_ -ne "$env:JAVA_HOME\bin")
  }) -join ';'
)

$probe = & "$env:JAVA_HOME\bin\java.exe" -version 2>&1 | Out-String
if ($probe -match 'version "1[78]') {
  Write-Host "JAVA_HOME ainda aponta para Java 17/18 — abortado." -ForegroundColor Red
  Write-Host "JAVA_HOME=$env:JAVA_HOME" -ForegroundColor Yellow
  exit 1
}

Write-Host "JAVA_HOME=$env:JAVA_HOME (JDK 21)"
