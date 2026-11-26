# Puts the relay running on this PC (port 8787) online for friends anywhere, with a free Cloudflare "quick tunnel".
# No account needed. Downloads Cloudflare's official cloudflared.exe from GitHub into the runtime folder once.
# The address changes every time you start it, and quick tunnels are meant for trying things, not uptime.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "runtime\cloudflared.exe"
$port = if ($args.Count -gt 0) { $args[0] } else { "8787" }
if (-not (Test-Path $exe)) {
  New-Item -ItemType Directory -Force (Join-Path $root "runtime") | Out-Null
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "amd64" }
  Write-Host "Downloading cloudflared (Cloudflare's free tunnel tool)..."
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -UseBasicParsing "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-$arch.exe" -OutFile $exe
}
Write-Host ""
Write-Host "Starting the tunnel. Look below for a line with https://....trycloudflare.com"
Write-Host "That is your relay address: paste it in Kin Relay > Settings > Relay address and send it to your friends."
Write-Host "Keep this window open while people play."
Write-Host ""
& $exe tunnel --no-autoupdate --url ("http://localhost:" + $port)
