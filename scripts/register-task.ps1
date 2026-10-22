# Start the local RADAR dashboard on logon (live search on page refresh).
# No email - the page is the daily workflow.

$taskName = "JobRadarDaily"
$script = Join-Path $PSScriptRoot "start-radar.ps1"
$workDir = Split-Path $PSScriptRoot -Parent

$action = New-ScheduledTaskAction `
  -Execute "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`"" `
  -WorkingDirectory $workDir

$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $triggerLogon `
  -Settings $settings `
  -Principal $principal `
  -Description "Job Radar: open live dashboard on logon. Refresh the page to search." | Out-Null

$desktop = [Environment]::GetFolderPath("Desktop")
$lnk = Join-Path $desktop "RADAR Jobs.lnk"
$w = New-Object -ComObject WScript.Shell
$sc = $w.CreateShortcut($lnk)
$sc.TargetPath = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
$sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$sc.WorkingDirectory = $workDir
$sc.Description = "Open RADAR - refresh the page to search jobs"
$sc.Save()

Write-Host "RADAR is now a live page, not an email:"
Write-Host "  Open http://localhost:8787  (or the Desktop shortcut RADAR Jobs)"
Write-Host "  Refresh = search LinkedIn + AllJobs + JobMaster"
Write-Host "  Task JobRadarDaily opens it at logon"
Get-ScheduledTask -TaskName $taskName | Format-List TaskName, State
