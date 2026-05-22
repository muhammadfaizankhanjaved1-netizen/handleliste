# Kjøres én gang for å sette opp automatisk prisoppdatering og kø-behandling
$batPath = "C:\Users\muham\handleliste\run.bat"
$taskName = "Handleliste-oppdatering"

# Fjern gammel task hvis den finnes
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batPath`""

# Trigger 1: ved PC-oppstart (etter 60 sek for å la nettverk starte)
$triggerBoot = New-ScheduledTaskTrigger -AtStartup
$triggerBoot.Delay = "PT60S"

# Trigger 2: daglig kl. 07:00
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
  -Description "Behandler ventende ønskeliste-lenker og oppdaterer priser" `
  -Force

Write-Host "✓ Task Scheduler satt opp: '$taskName'" -ForegroundColor Green
Write-Host "  Kjøres: ved oppstart (etter 60 sek) + daglig kl. 07:00" -ForegroundColor Cyan
