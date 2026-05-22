$batPath = "C:\Users\muham\handleliste\run.bat"
$taskName = "Handleliste-oppdatering"

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batPath`""

$triggerBoot = New-ScheduledTaskTrigger -AtStartup
$triggerBoot.Delay = "PT60S"

$triggerDaily = New-ScheduledTaskTrigger -Daily -At "07:00"

$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
  -StartWhenAvailable `
  -RunOnlyIfNetworkAvailable

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $triggerBoot, $triggerDaily `
  -Settings $settings `
  -Principal $principal `
  -Description "Handleliste: behandler ventende lenker og oppdaterer priser" `
  -Force

Write-Host "Task Scheduler OK: $taskName" -ForegroundColor Green
Write-Host "Kjoeres: ved oppstart + daglig kl. 07:00" -ForegroundColor Cyan
