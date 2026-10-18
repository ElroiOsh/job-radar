$ErrorActionPreference = "Continue"
$root = "C:\Users\Elroi\OneDrive\Desktop\New Job"
Set-Location $root

$logDir = Join-Path $root "data"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$log = Join-Path $logDir "daily-last-run.log"
$stampFile = Join-Path $logDir "last-success-day.txt"
$today = Get-Date -Format "yyyy-MM-dd"

function Write-Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Add-Content -Path $log -Value $line -Encoding utf8
  Write-Host $line
}

# Once per calendar day — on login / wake we only send if not already done today
if (Test-Path $stampFile) {
  $last = (Get-Content $stampFile -Raw).Trim()
  if ($last -eq $today) {
    "" | Set-Content -Path $log -Encoding utf8
    Write-Log "Already ran successfully today ($today) — skip (no duplicate email)."
    exit 0
  }
}

"" | Set-Content -Path $log -Encoding utf8
Write-Log "Job Radar daily start (login/wake trigger)"

$nodePaths = @(
  "C:\Program Files\nodejs",
  "C:\Program Files (x86)\nodejs",
  "$env:LOCALAPPDATA\Programs\nodejs",
  "$env:APPDATA\npm"
)
$env:Path = ($nodePaths + @($env:Path)) -join ";"

$npm = "C:\Program Files\nodejs\npm.cmd"
$node = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $npm)) {
  Write-Log "ERROR: npm.cmd not found at $npm"
  exit 1
}

Write-Log ("node={0}" -f (& $node -v))

try {
  $output = & $npm run daily 2>&1 | ForEach-Object { $_.ToString() }
  $output | ForEach-Object { Add-Content -Path $log -Value $_ -Encoding utf8 }
  $code = $LASTEXITCODE
  if ($null -eq $code) { $code = 0 }
  Write-Log "npm run daily exit=$code"
  if ($code -ne 0) { exit $code }
} catch {
  Write-Log ("ERROR running daily: {0}" -f $_)
  exit 1
}

# Mark today done only after a successful run (prevents duplicate emails)
Set-Content -Path $stampFile -Value $today -Encoding utf8
Write-Log "Marked success day=$today"

# Refresh permanent GitHub Pages link
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
$git = if ($gitCmd) { $gitCmd.Source } else { "C:\Program Files\Git\cmd\git.exe" }

if ((Test-Path $git) -and (Test-Path (Join-Path $root "web\index.html"))) {
  try {
    Write-Log "Updating GitHub Pages from web/"
    & $git -C $root add web/index.html data/latest.json data/live-jobs.json data/feedback.json 2>$null
    $status = & $git -C $root status --porcelain
    if ($status) {
      & $git -C $root -c user.email="elroiosh@gmail.com" -c user.name="ElroiOsh" commit -m "Daily dashboard refresh $today" 2>$null
      & $git -C $root push origin main 2>$null
      Write-Log "Pushed dashboard to GitHub Pages"
    } else {
      Write-Log "No web changes to push"
    }
  } catch {
    Write-Log ("WARN: Pages push skipped: {0}" -f $_)
  }
}

Write-Log "Job Radar daily done"
exit 0
