# Resolve e exporta JAVA_HOME para JDK 21 (nunca Java 17).
# Dot-source: . .\scripts\resolve-jdk21.ps1

function Get-JavaVersionText([string]$javaExe) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $lines = & $javaExe -version 2>&1
    return ($lines | ForEach-Object { "$_" }) -join "`n"
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Get-BiblosJdk21Home {
  $roots = @(
    'C:\Program Files\Eclipse Adoptium',
    'C:\Program Files\Java',
    'C:\Program Files\Microsoft',
    'C:\Program Files\Amazon Corretto',
    (Join-Path $env:LOCALAPPDATA 'Programs\Eclipse Adoptium')
  )

  $dirs = @()
  foreach ($root in $roots) {
    if (-not (Test-Path $root)) { continue }
    $dirs += Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match '(?i)jdk-?21|jdk.?21|21[\.\-]' }
  }

  foreach ($dir in ($dirs | Sort-Object FullName -Descending)) {
    $java = Join-Path $dir.FullName 'bin\java.exe'
    if (-not (Test-Path $java)) { continue }
    $ver = Get-JavaVersionText $java
    if ($ver -match 'version ["'']?21') {
      return $dir.FullName
    }
  }

  return $null
}

$jdk21 = Get-BiblosJdk21Home
if (-not $jdk21) {
  Write-Host 'JDK 21 obrigatorio para o build Android. Java 17 nao e suportado.' -ForegroundColor Red
  Write-Host 'Instala Temurin 21 (Eclipse Adoptium) e volta a tentar.' -ForegroundColor Yellow
  exit 1
}

$env:JAVA_HOME = $jdk21
$jdkBin = Join-Path $env:JAVA_HOME 'bin'
$env:Path = ($jdkBin + ';' + (
  ($env:Path -split ';' | Where-Object {
    $_ -and ($_ -notmatch '(?i)\\(?:jdk|jre)-?17') -and ($_ -ne $jdkBin)
  }) -join ';'
))

$javaExe = Join-Path $jdkBin 'java.exe'
$probe = Get-JavaVersionText $javaExe
if ($probe -match 'version ["'']?1[78]') {
  Write-Host 'JAVA_HOME ainda aponta para Java 17/18 - abortado.' -ForegroundColor Red
  Write-Host ('JAVA_HOME={0}' -f $env:JAVA_HOME) -ForegroundColor Yellow
  exit 1
}

Write-Host ('JAVA_HOME={0} (JDK 21)' -f $env:JAVA_HOME)
