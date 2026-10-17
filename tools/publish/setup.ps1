# Sets up publishing from this folder (or removes it again).
#
#   powershell -ExecutionPolicy Bypass -File tools\publish\setup.ps1
#   powershell -ExecutionPolicy Bypass -File tools\publish\setup.ps1 -Remove
#
# - A "Publish Shop" shortcut on the desktop: runs tools\publish\publish.py in a
#   window that explains each step and asks before anything goes live.
# - A Task Scheduler task, "Attic & Ember shop download", for the current user:
#   at sign-in and every 2 hours, tools\publish\autosync.py brings changes made on
#   GitHub down to this folder, but only when nothing here is being edited. It
#   uploads nothing unless automatic publishing of app-confirmed price/bundle
#   changes has been switched on (see sitechanges.py). A run missed while asleep happens on wake; never two at once.

param([switch]$Remove)

$ErrorActionPreference = "Stop"
$task = "Attic & Ember shop download"
$lnk = Join-Path ([Environment]::GetFolderPath("Desktop")) "Publish Shop.lnk"

if ($Remove) {
    if (Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $task -Confirm:$false
        Write-Output "Removed the automatic download."
    }
    if (Test-Path -LiteralPath $lnk) {
        Remove-Item -LiteralPath $lnk
        Write-Output "Removed the Publish Shop shortcut."
    }
    return
}

$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$pyDir = Join-Path $env:LOCALAPPDATA "Programs\Python\Python314"
$python = Join-Path $pyDir "python.exe"
$pythonw = Join-Path $pyDir "pythonw.exe"
if (-not (Test-Path $python)) {
    $python = (Get-Command py -ErrorAction SilentlyContinue).Source
    if (-not $python) { Write-Error "Python isn't installed where expected ($pyDir)." }
    $pythonw = $python   # the py launcher: a console flashes briefly on each download
}

$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$shortcut.TargetPath = $python
$shortcut.Arguments = '"' + (Join-Path $PSScriptRoot "publish.py") + '"'
$shortcut.WorkingDirectory = $repo
$shortcut.IconLocation = (Join-Path $repo "favicon.ico") + ",0"
$shortcut.Description = "Put changes made in the shop folder live on atticandember.com"
$shortcut.Save()
Write-Output "Desktop shortcut: $lnk"

$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$now = Get-Date
$action    = New-ScheduledTaskAction -Execute $pythonw -Argument ('"' + (Join-Path $PSScriptRoot "autosync.py") + '"') -WorkingDirectory $repo
$atLogon   = New-ScheduledTaskTrigger -AtLogOn -User $user
$every2h   = New-ScheduledTaskTrigger -Once -At $now.Date.AddHours([math]::Floor($now.Hour / 2) * 2 + 1).AddMinutes(30) `
               -RepetitionInterval (New-TimeSpan -Hours 2)
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
               -ExecutionTimeLimit (New-TimeSpan -Minutes 20) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $task -Action $action -Trigger @($atLogon, $every2h) -Principal $principal `
    -Settings $settings -Description "Brings shop changes made on GitHub down to $repo, and publishes price/bundle changes confirmed in the sourcing app when automatic publishing is switched on." -Force | Out-Null
Write-Output "Automatic download: at sign-in and every 2 hours, while $user is logged on."
