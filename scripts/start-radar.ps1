$ErrorActionPreference = "Continue"
$root = "C:\Users\Elroi\OneDrive\Desktop\New Job"
$port = 8787
$url = "http://localhost:$port"

$nodePaths = @(
  "C:\Program Files\nodejs",
  "C:\Program Files (x86)\nodejs",
  "$env:LOCALAPPDATA\Programs\nodejs"
)
$env:Path = ($nodePaths + @($env:Path)) -join ";"

function Port-Open {
  try {
    $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    return [bool]$c
  } catch {
    try {
      $r = Test-NetConnection -ComputerName 127.0.0.1 -Port $port -WarningAction SilentlyContinue
      return [bool]$r.TcpTestSucceeded
    } catch { return $false }
  }
}

Set-Location $root

if (-not (Port-Open)) {
  $npm = "C:\Program Files\nodejs\npm.cmd"
  Start-Process -FilePath $npm -ArgumentList "run","serve" -WorkingDirectory $root -WindowStyle Minimized
  $deadline = (Get-Date).AddSeconds(25)
  while (-not (Port-Open) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 400
  }
}

Start-Process $url
