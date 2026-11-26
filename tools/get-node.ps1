# Downloads a private copy of Node.js (free, from nodejs.org) into Kin Relay's "runtime" folder, checking its
# SHA-256 against nodejs.org's published list. Nothing is installed system-wide and nothing else is changed.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $root "runtime"
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
$base = "https://nodejs.org/dist/latest-v24.x/"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Write-Host "Finding the current Node.js 24 LTS for Windows ($arch)..."
$sums = (Invoke-WebRequest -UseBasicParsing ($base + "SHASUMS256.txt")).Content
$line = ($sums -split "`n") | Where-Object { $_ -match "node-v24\.[0-9.]+-win-$arch\.zip$" } | Select-Object -First 1
if (-not $line) { throw "Couldn't find Node.js on nodejs.org." }
$hash, $file = ($line.Trim() -split "\s+")
$zip = Join-Path $env:TEMP $file
Write-Host "Downloading $file (about 30 MB)..."
Invoke-WebRequest -UseBasicParsing ($base + $file) -OutFile $zip
if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLower() -ne $hash.ToLower()) { Remove-Item $zip; throw "The download didn't match nodejs.org's checksum, so it was deleted." }
$tmp = Join-Path $env:TEMP ("kin-node-" + [guid]::NewGuid())
Expand-Archive $zip -DestinationPath $tmp
New-Item -ItemType Directory -Force $runtime | Out-Null
Copy-Item (Join-Path (Get-ChildItem $tmp | Select-Object -First 1).FullName "node.exe") $runtime -Force
Remove-Item $zip, $tmp -Recurse -Force
Write-Host "Node.js is ready in $runtime"
