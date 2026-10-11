<#
  Sets up Zaijabolical inside the folder where you keep your GitHub repositories,
  linked to your GitHub repo so you can pull updates and push your own edits.

  Nothing is installed on C: and no network settings are changed: the app itself
  runs on your website (cedriclevi.com/zaijabolical), so this is just your
  editable copy of the code.

  Right-click > "Run with PowerShell", or double-click install-zaijabolical.bat.
#>

$ErrorActionPreference = 'Continue'

function Info([string]$t) { Write-Host "  $t" }
function Done([string]$t) { Write-Host "  [done] $t" -ForegroundColor Green }
function Warn([string]$t) { Write-Host "  $t" -ForegroundColor Yellow }

Write-Host ""
Write-Host "Zaijabolical - set up your copy in your GitHub folder" -ForegroundColor White
Write-Host ""

# ---------- 1. where do your GitHub repos live? ----------
Add-Type -AssemblyName System.Windows.Forms
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = 'Choose the folder where you keep your GitHub repositories'
$dlg.ShowNewFolderButton = $true
if ($dlg.ShowDialog() -ne 'OK') { Warn "No folder chosen - nothing was changed."; Read-Host "Press Enter to close"; exit 1 }
$parent = $dlg.SelectedPath
Info "GitHub folder: $parent"

# ---------- 2. which repo? ----------
$user = ''
while ([string]::IsNullOrWhiteSpace($user)) { $user = Read-Host "  Your GitHub username (the account that owns the zaijabolical repo)" }
$repo = Read-Host "  Repository name (press Enter for zaijabolical)"
if ([string]::IsNullOrWhiteSpace($repo)) { $repo = 'zaijabolical' }
$repo = $repo.Trim().TrimEnd('/')
if ($repo -notmatch '/') { $repo = "$($user.Trim())/$repo" }
if ($repo -notmatch '^https?://') { $repo = "https://github.com/$repo" }   # allow "owner/name"
$repo = $repo -replace '\.git$', ''
$name = ($repo -split '/')[-1]
$target = Join-Path $parent $name

# ---------- 3. already there? ----------
$git = (Get-Command git -ErrorAction SilentlyContinue).Source
if (Test-Path -LiteralPath $target) {
  if ((Test-Path -LiteralPath (Join-Path $target '.git')) -and $git) {
    Info "$target already exists and is a Git repository - pulling the latest version instead."
    & $git -C $target pull
    Start-Process explorer.exe $target
    Read-Host "Press Enter to close"; exit 0
  }
  Warn "A folder named '$name' already exists in $parent but isn't a clone of the repo."
  Warn "Rename or move it, then run this again."
  Read-Host "Press Enter to close"; exit 1
}

# ---------- 4. clone ----------
$cloned = $false
if ($git) {
  Info "Cloning $repo"
  Info "(If a GitHub sign-in window appears, sign in.)"
  & $git clone "$repo.git" $target
  if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath (Join-Path $target '.git'))) { $cloned = $true; Done "Cloned into $target" }
  else { Warn "Git couldn't clone it (see the message above). Trying GitHub Desktop instead..." }
}

if (-not $cloned) {
  $desktop = Test-Path -LiteralPath "$env:LOCALAPPDATA\GitHubDesktop\GitHubDesktop.exe"
  if (-not $desktop) {
    Warn "Neither Git nor GitHub Desktop was found."
    Warn "Install GitHub Desktop from https://desktop.github.com (or Git from https://git-scm.com), then run this again."
    Read-Host "Press Enter to close"; exit 1
  }
  Set-Clipboard -Value $parent
  Start-Process "x-github-client://openRepo/$repo"
  Write-Host ""
  Info "GitHub Desktop is opening its Clone window for $repo."
  Info "In that window, set 'Local path' to your GitHub folder - it's already copied,"
  Info "so click the Local path box, select all, and press Ctrl+V:"
  Info "    $parent"
  Info "Then click Clone. The repo will end up in: $target"
  Read-Host "Press Enter to close"; exit 0
}

# ---------- 5. next steps ----------
Write-Host ""
Info "Your editable copy is at: $target"
Info "- To get the latest changes: open GitHub Desktop and click 'Fetch origin', then 'Pull'."
Info "- To publish your own edits: commit and push them in GitHub Desktop."
Info "  The website (cedriclevi.com/zaijabolical) updates by itself a minute or two after each push."
Info "- To try edits before pushing: double-click index.html in that folder to open it in your browser."
Info "If GitHub Desktop doesn't list it yet: File > Add local repository > choose $target"
Start-Process explorer.exe $target
Write-Host ""
Read-Host "Press Enter to close"
