# Run once per day when the PC is opened (logon).
# Skips automatically if already succeeded today (data/last-success-day.txt).

$taskName = "JobRadarDaily"
$script = Join-Path $PSScriptRoot "run-daily.ps1"
$workDir = Split-Path $PSScriptRoot -Parent

$action = New-ScheduledTaskAction `
  -Execute "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`"" `
  -WorkingDirectory $workDir

$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$triggerMorning = New-ScheduledTaskTrigger -Daily -At 8:00AM

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -WakeToRun `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1)

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger @($triggerLogon, $triggerMorning) `
  -Settings $settings `
  -Principal $principal `
  -Description "Job Radar: on logon (+ 08:00 backup), once per day" | Out-Null

Write-Host "Scheduled task JobRadarDaily ready:"
Write-Host "  - At logon (when you open/sign into the PC)"
Write-Host "  - Daily 08:00 backup if PC is already on"
Write-Host "  - At most once per calendar day"
Get-ScheduledTask -TaskName $taskName | Format-List TaskName, State
Get-ScheduledTaskInfo -TaskName $taskName | Format-List NextRunTime, LastRunTime, LastTaskResult
