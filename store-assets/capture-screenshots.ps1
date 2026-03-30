# Regenerates Chrome Web Store screenshots (1280x800, 24-bit PNG, no alpha).
# Requires Google Chrome at the default install path.

$chrome = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) {
  Write-Error "Chrome not found at $chrome"
  exit 1
}

$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$jobs = @(
  @{ html = "ytm-top-songs.html"; png = "01-ytm-top-songs-1280x800.png" },
  @{ html = "ytm-up-next.html"; png = "02-ytm-up-next-1280x800.png" },
  @{ html = "youtube-grid.html"; png = "03-youtube-grid-1280x800.png" }
)

foreach ($j in $jobs) {
  $out = Join-Path $base $j.png
  $url = "file:///" + ($base -replace "\\", "/") + "/" + $j.html
  & $chrome --headless=new --hide-scrollbars --window-size=1280,800 --force-device-scale-factor=1 --screenshot=$out $url
  Write-Host "Wrote $out"
}
