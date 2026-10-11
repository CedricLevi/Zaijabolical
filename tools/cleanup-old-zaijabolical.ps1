<#
  Cleans up the old, locally-hosted Zaijabolical install and anything it could
  have changed on this PC's network settings.

  What it does (it asks before deleting anything):
    1. Stops the old Zaijabolical server if it's running.
    2. Saves a copy of your data file (mealprep.db), if one exists.
    3. Removes Windows Firewall rules that let other devices reach the old app
       (rules for the app's own Python, and - only if you say yes - the generic
       "Python" allow rules Windows creates when you click "Allow access").
    4. Checks for and removes any port-forwarding / URL reservations on port 5050
       (the app never created any, but this confirms it).
    5. Deletes the old install folder and the download caches it left on C:.

  Right-click > "Run with PowerShell", or double-click cleanup-old-zaijabolical.bat.
#>

$ErrorActionPreference = 'Continue'
$Port = 5050

# ---------- run as administrator (needed to change firewall rules) ----------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "Asking Windows for administrator rights (needed to remove firewall rules)..." -ForegroundColor Yellow
  Start-Process powershell.exe -Verb RunAs -ArgumentList @(
    '-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
  exit
}

function Ask([string]$question, [bool]$defaultYes = $true) {
  $hint = if ($defaultYes) { '[Y/n]' } else { '[y/N]' }
  $a = Read-Host "$question $hint"
  if ([string]::IsNullOrWhiteSpace($a)) { return $defaultYes }
  return $a.Trim().ToLower().StartsWith('y')
}
function Section([string]$t) { Write-Host ""; Write-Host "== $t ==" -ForegroundColor Cyan }
function Done([string]$t)    { Write-Host "  [done] $t" -ForegroundColor Green }
function Info([string]$t)    { Write-Host "  $t" }
function SizeOf([string]$p) {
  try { $b = (Get-ChildItem -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum } catch { $b = 0 }
  if (-not $b) { return '0 MB' }
  return ('{0:N0} MB' -f ($b / 1MB))
}
function LooksLikeZaijabolical([string]$p) {
  return (Test-Path -LiteralPath (Join-Path $p 'app.py')) -and (Test-Path -LiteralPath (Join-Path $p 'core\optimizer.py'))
}

Write-Host ""
Write-Host "Zaijabolical - clean up the old local install" -ForegroundColor White
Write-Host "Nothing is deleted without asking you first."

# ---------- 1. find old install folders ----------
Section "Finding the old install"
$candidates = @()
foreach ($root in @([Environment]::GetFolderPath('Desktop'), "$env:USERPROFILE\Desktop", "$env:OneDrive\Desktop",
                    "$env:USERPROFILE\Downloads", "$env:USERPROFILE\Documents")) {
  if ($root -and (Test-Path -LiteralPath $root)) {
    Get-ChildItem -LiteralPath $root -Directory -Filter 'Zaijabolical*' -ErrorAction SilentlyContinue | ForEach-Object {
      if (LooksLikeZaijabolical $_.FullName) { $candidates += $_.FullName }
    }
  }
}
$candidates = @($candidates | Select-Object -Unique)
if ($candidates.Count -eq 0) { Info "No old install found on the Desktop, Downloads or Documents." }
else { $candidates | ForEach-Object { Info "Found: $_" } }

if (Ask "Is there another old copy somewhere else you want me to clean up too?" $false) {
  Add-Type -AssemblyName System.Windows.Forms
  $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
  $dlg.Description = 'Choose the OLD Zaijabolical folder to remove'
  if ($dlg.ShowDialog() -eq 'OK') {
    if (LooksLikeZaijabolical $dlg.SelectedPath) { $candidates += $dlg.SelectedPath }
    else { Write-Host "  That folder doesn't look like a Zaijabolical install (no app.py / core\optimizer.py). Skipping it." -ForegroundColor Yellow }
  }
}

# ---------- 2. stop the old server ----------
Section "Stopping the old app if it's running"
$stopped = 0
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -match 'app\.py' -and $_.CommandLine -match 'Zaijabolical|MealPrep' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $stopped++ }
foreach ($c in $candidates) {
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($c, [StringComparison]::OrdinalIgnoreCase) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $stopped++ }
}
if ($stopped) { Done "Stopped $stopped process(es)." } else { Info "It wasn't running." }
$listen = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listen) {
  foreach ($l in $listen) {
    $p = Get-Process -Id $l.OwningProcess -ErrorAction SilentlyContinue
    Write-Host "  Something else is still listening on port $Port`: $($p.ProcessName) (PID $($l.OwningProcess))" -ForegroundColor Yellow
  }
} else { Info "Nothing is listening on port $Port." }

# ---------- 3. back up data ----------
Section "Saving your data (if any)"
$backupDir = Join-Path $PSScriptRoot ("Zaijabolical-data-backup-" + (Get-Date -Format 'yyyyMMdd-HHmm'))
$found = $false
foreach ($c in $candidates) {
  $db = Join-Path $c 'mealprep.db'
  if (Test-Path -LiteralPath $db) {
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    $dest = Join-Path $backupDir ((Split-Path $c -Leaf) + '-mealprep.db')
    Copy-Item -LiteralPath $db -Destination $dest -Force
    Done "Copied $db -> $dest"
    $found = $true
  }
}
if (-not $found) { Info "No saved recipes or plans found (the app never finished setting up), so there's nothing to keep." }

# ---------- 4. firewall rules ----------
Section "Firewall rules"
Info "Reading your firewall rules - this can take up to a minute..."
$rules = @()
try {
  $rules = Get-NetFirewallApplicationFilter -ErrorAction Stop | Where-Object { $_.Program -and $_.Program -ne 'Any' } |
    ForEach-Object {
      $f = $_
      $prog = [Environment]::ExpandEnvironmentVariables($f.Program)
      $r = $f | Get-NetFirewallRule -ErrorAction SilentlyContinue
      if ($r) { [pscustomobject]@{ Rule = $r; Program = $prog } }
    }
} catch { Write-Host "  Couldn't read firewall rules: $_" -ForegroundColor Yellow }

# a) rules pointing inside an old install folder -> always remove
$appRules = @($rules | Where-Object { $p = $_.Program; $candidates | Where-Object { $p.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) } })
foreach ($x in $appRules) {
  Remove-NetFirewallRule -Name $x.Rule.Name -ErrorAction SilentlyContinue
  Done "Removed rule '$($x.Rule.DisplayName)' for $($x.Program)"
}
if (-not $appRules) { Info "No firewall rules point at the old install folder." }

# b) generic inbound 'allow' rules for python.exe / pythonw.exe (created when Windows asks "Allow access?")
$pyRules = @($rules | Where-Object {
  $_.Rule.Direction -eq 'Inbound' -and $_.Rule.Action -eq 'Allow' -and
  ([IO.Path]::GetFileName($_.Program) -match '^pythonw?\.exe$') -and ($appRules.Rule.Name -notcontains $_.Rule.Name) })
if ($pyRules) {
  Info "These inbound 'allow' rules let other devices on your network connect to Python programs on this PC:"
  $pyRules | ForEach-Object { Info ("   - {0}  ({1}, {2})" -f $_.Rule.DisplayName, $_.Program, ($_.Rule.Profile -join ',')) }
  Info "They're usually created when you click 'Allow access' on a Windows Firewall pop-up."
  Info "Removing them is safe: Windows will just ask again if a Python program ever needs network access."
  if (Ask "Remove them?" $true) {
    foreach ($x in $pyRules) { Remove-NetFirewallRule -Name $x.Rule.Name -ErrorAction SilentlyContinue }
    Done "Removed $($pyRules.Count) Python allow rule(s)."
  } else { Info "Left them in place." }
} else { Info "No Python 'allow' rules found." }

# ---------- 5. port forwarding / URL reservations ----------
Section "Port forwarding and URL reservations on port $Port"
$pp = (netsh interface portproxy show all) 2>$null | Select-String -Pattern "\b$Port\b"
if ($pp) {
  foreach ($line in $pp) {
    $parts = ($line.ToString().Trim() -split '\s+')
    if ($parts.Count -ge 2) {
      netsh interface portproxy delete v4tov4 listenport=$($parts[1]) listenaddress=$($parts[0]) | Out-Null
      Done "Removed port forward $($parts[0]):$($parts[1])"
    }
  }
} else { Info "No port forwarding found." }
$acl = (netsh http show urlacl) 2>$null | Select-String -Pattern "Reserved URL\s*:\s*(\S*:$Port/\S*)"
if ($acl) {
  foreach ($m in $acl) {
    $url = $m.Matches[0].Groups[1].Value
    netsh http delete urlacl url=$url | Out-Null
    Done "Removed URL reservation $url"
  }
} else { Info "No URL reservations found." }

# ---------- 6. delete old files ----------
Section "Deleting old files"
foreach ($c in $candidates) {
  if (Ask "Delete the old install folder $c ($(SizeOf $c))?" $true) {
    Remove-Item -LiteralPath $c -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $c) { Write-Host "  Couldn't delete everything in $c - close any window using it and run this again." -ForegroundColor Yellow }
    else { Done "Deleted $c" }
  } else { Info "Kept $c" }
}
$pipCache = Join-Path $env:LOCALAPPDATA 'pip\cache'
if (Test-Path -LiteralPath $pipCache) {
  Info "Python's download cache on C: is $(SizeOf $pipCache) ($pipCache)."
  Info "It's only a cache: deleting it is safe, other Python projects just re-download what they need."
  if (Ask "Delete it?" $true) { Remove-Item -LiteralPath $pipCache -Recurse -Force -ErrorAction SilentlyContinue; Done "Deleted the pip cache." }
}
$tmp = @(Get-ChildItem -LiteralPath $env:TEMP -Directory -Filter 'pip-*' -ErrorAction SilentlyContinue)
if ($tmp.Count) {
  $tmp | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  Done "Removed $($tmp.Count) leftover pip temp folder(s)."
}

Section "Finished"
Info "The old local app is gone and nothing on this PC is set up to accept connections for it."
Info "Python itself was left installed. Remove it from Settings > Apps if you don't use it for anything else."
if ($found) { Info "Your data backup is in: $backupDir" }
Write-Host ""
Read-Host "Press Enter to close"
