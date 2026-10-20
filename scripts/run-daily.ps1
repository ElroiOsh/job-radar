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

function Invoke-NpmDaily([string]$extraArgs, [int]$timeoutMs) {
  $cmd = "C:\Windows\System32\cmd.exe"
  $arg = "/c `"C:\Program Files\nodejs\npm.cmd`" run daily -- $extraArgs"
  $outFile = Join-Path $logDir "daily-npm-out.txt"
  $errFile = Join-Path $logDir "daily-npm-err.txt"
  Remove-Item $outFile, $errFile -ErrorAction SilentlyContinue

  $p = Start-Process -FilePath $cmd `
    -ArgumentList $arg `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput $outFile `
    -RedirectStandardError $errFile

  $finished = $p.WaitForExit($timeoutMs)
  if (-not $finished) {
    Write-Log "TIMEOUT after $($timeoutMs / 1000)s - killing npm/node"
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -match "run-daily|tsx src/run-daily" } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    return 124
  }

  if (Test-Path $outFile) { Get-Content $outFile -ErrorAction SilentlyContinue | ForEach-Object { Add-Content -Path $log -Value $_ -Encoding utf8 } }
  if (Test-Path $errFile) { Get-Content $errFile -ErrorAction SilentlyContinue | ForEach-Object { Add-Content -Path $log -Value $_ -Encoding utf8 } }
  return $p.ExitCode
}

# Once per calendar day
if (Test-Path $stampFile) {
  $last = (Get-Content $stampFile -Raw).Trim()
  if ($last -eq $today) {
    "" | Set-Content -Path $log -Encoding utf8
    Write-Log "Already ran successfully today ($today) - skip (no duplicate email)."
    exit 0
  }
}

"" | Set-Content -Path $log -Encoding utf8
Write-Log "Job Radar daily start (login/wake trigger)"

# Give Wi-Fi a moment after logon
Start-Sleep -Seconds 12

$nodePaths = @(
  "C:\Program Files\nodejs",
  "C:\Program Files (x86)\nodejs",
  "$env:LOCALAPPDATA\Programs\nodejs",
  "$env:APPDATA\npm"
)
$env:Path = ($nodePaths + @($env:Path)) -join ";"

$node = "C:\Program Files\nodejs\node.exe"
$npm = "C:\Program Files\nodejs\npm.cmd"
if (-not (Test-Path $npm)) {
  Write-Log "ERROR: npm.cmd not found at $npm"
  exit 1
}

Write-Log ("node={0}" -f (& $node -v))

$code = Invoke-NpmDaily "" 480000
Write-Log "npm run daily exit=$code"

if ($code -ne 0) {
  Write-Log "Primary run failed/timed out - sending email from last saved jobs"
  $fallback = Invoke-NpmDaily "--skip-fetch" 120000
  Write-Log "fallback skip-fetch exit=$fallback"
  if ($fallback -ne 0) { exit $fallback }
}

Set-Content -Path $stampFile -Value $today -Encoding utf8
Write-Log "Marked success day=$today"

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
