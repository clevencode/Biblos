# Resolve e exporta JAVA_HOME para o JDK mais recente (>= 21).
# Nunca usa Java 17/18. Dot-source: . .\scripts\resolve-jdk21.ps1

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

function Get-JavaMajor([string]$versionText) {
  if ($versionText -match 'version ["'']?(1[7-9]|2[0-9]|3[0-9])') {
    return [int]$Matches[1]
  }
  return 0
}

function Get-BiblosLatestJdkHome {
  $roots = @(
    'C:\Program Files\Eclipse Adoptium',
    'C:\Program Files\Java',
    'C:\Program Files\Microsoft',
    'C:\Program Files\Amazon Corretto',
    (Join-Path $env:LOCALAPPDATA 'Programs\Eclipse Adoptium')
  )

  $candidates = @()
  foreach ($root in $roots) {
    if (-not (Test-Path $root)) { continue }
    $dirs = Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match '(?i)jdk' }
    foreach ($dir in $dirs) {
      $java = Join-Path $dir.FullName 'bin\java.exe'
      if (-not (Test-Path $java)) { continue }
      $ver = Get-JavaVersionText $java
      $major = Get-JavaMajor $ver
      if ($major -lt 21) { continue }
      $candidates += [pscustomobject]@{
        Home = $dir.FullName
        Major = $major
        Name = $dir.Name
      }
    }
  }

  if (-not $candidates.Count) { return $null }
  return ($candidates | Sort-Object Major, Name -Descending | Select-Object -First 1).Home
}

$jdkHome = Get-BiblosLatestJdkHome
if (-not $jdkHome) {
  Write-Host 'JDK 21+ obrigatorio para o build Android. Java 17 nao e suportado.' -ForegroundColor Red
  Write-Host 'Instala Temurin 21+ (Eclipse Adoptium) e volta a tentar.' -ForegroundColor Yellow
  exit 1
}

$env:JAVA_HOME = $jdkHome
$jdkBin = Join-Path $env:JAVA_HOME 'bin'
$env:Path = ($jdkBin + ';' + (
  ($env:Path -split ';' | Where-Object {
    $_ -and ($_ -notmatch '(?i)\\(?:jdk|jre)-?1[78]') -and ($_ -ne $jdkBin)
  }) -join ';'
))

$javaExe = Join-Path $jdkBin 'java.exe'
$probe = Get-JavaVersionText $javaExe
$major = Get-JavaMajor $probe
if ($major -lt 21) {
  Write-Host 'JAVA_HOME ainda aponta para Java < 21 - abortado.' -ForegroundColor Red
  Write-Host ('JAVA_HOME={0}' -f $env:JAVA_HOME) -ForegroundColor Yellow
  exit 1
}

Write-Host ('JAVA_HOME={0} (JDK {1})' -f $env:JAVA_HOME, $major)
