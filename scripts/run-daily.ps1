$ErrorActionPreference = "Stop"
Set-Location "C:\Users\Elroi\OneDrive\Desktop\New Job"

# Ensure Node is on PATH for Scheduled Tasks
$nodeDir = Split-Path (Get-Command node -ErrorAction SilentlyContinue).Source -Parent
if ($nodeDir) { $env:Path = "$nodeDir;$env:Path" }

npm run daily 2>&1 | Tee-Object -FilePath "data\daily-last-run.log"
