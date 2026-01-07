# Devora Updater for Windows
# Usage: Right-click -> Run with PowerShell, or: powershell -ExecutionPolicy Bypass -File update.ps1

$ErrorActionPreference = "Stop"
$GITHUB_REPO = "rucnyz/devora"
$GITHUB_API = "https://api.github.com/repos/$GITHUB_REPO/releases/latest"

# Get script directory (where devora.exe is located)
$APP_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$VERSION_FILE = Join-Path $APP_DIR "VERSION"

function Write-Header {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Devora Updater" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Get-CurrentVersion {
    if (Test-Path $VERSION_FILE) {
        return (Get-Content $VERSION_FILE -Raw).Trim()
    }
    return "0.0.0"
}

function Compare-Versions {
    param([string]$current, [string]$latest)

    $c = $current -replace '^v', '' -split '\.' | ForEach-Object { [int]$_ }
    $l = $latest -replace '^v', '' -split '\.' | ForEach-Object { [int]$_ }

    for ($i = 0; $i -lt [Math]::Max($c.Length, $l.Length); $i++) {
        $cv = if ($i -lt $c.Length) { $c[$i] } else { 0 }
        $lv = if ($i -lt $l.Length) { $l[$i] } else { 0 }
        if ($cv -lt $lv) { return -1 }
        if ($cv -gt $lv) { return 1 }
    }
    return 0
}

function Get-LatestRelease {
    try {
        $headers = @{
            "Accept" = "application/vnd.github.v3+json"
            "User-Agent" = "Devora-Updater"
        }
        $response = Invoke-RestMethod -Uri $GITHUB_API -Headers $headers -Method Get
        return $response
    }
    catch {
        Write-Host "Failed to check for updates: $_" -ForegroundColor Red
        return $null
    }
}

function Download-WithProgress {
    param([string]$url, [string]$destPath, [long]$totalSize)

    $webClient = New-Object System.Net.WebClient
    $webClient.Headers.Add("User-Agent", "Devora-Updater")

    $lastPercent = 0
    $webClient.DownloadProgressChanged = {
        param($sender, $e)
        if ($e.ProgressPercentage -ne $lastPercent) {
            $lastPercent = $e.ProgressPercentage
            $mb = [math]::Round($e.BytesReceived / 1MB, 1)
            $totalMb = [math]::Round($e.TotalBytesToReceive / 1MB, 1)
            Write-Host "`rDownloading: $($e.ProgressPercentage)% ($mb/$totalMb MB)" -NoNewline
        }
    }

    # Use synchronous download with progress display
    $uri = New-Object System.Uri($url)

    Write-Host "Downloading..." -ForegroundColor Yellow

    # Simple download with Invoke-WebRequest (shows progress automatically)
    Invoke-WebRequest -Uri $url -OutFile $destPath -Headers @{"User-Agent"="Devora-Updater"}

    Write-Host "Download complete!" -ForegroundColor Green
}

function Install-Update {
    param([string]$extractedDir)

    Write-Host "Installing update..." -ForegroundColor Yellow

    # Find the source directory (might be in a subdirectory)
    $sourceDir = $extractedDir
    $entries = Get-ChildItem -Path $extractedDir

    if ($entries.Count -eq 1 -and $entries[0].PSIsContainer) {
        $sourceDir = $entries[0].FullName
    }

    # Paths
    $newExePath = Join-Path $sourceDir "devora.exe"
    $newDistPath = Join-Path $sourceDir "dist"
    $newVersionPath = Join-Path $sourceDir "VERSION"

    $currentExePath = Join-Path $APP_DIR "devora.exe"
    $currentDistPath = Join-Path $APP_DIR "dist"
    $backupExePath = Join-Path $APP_DIR "devora.exe.old"

    # Backup current executable
    if (Test-Path $currentExePath) {
        if (Test-Path $backupExePath) {
            Remove-Item $backupExePath -Force
        }
        Rename-Item $currentExePath $backupExePath
        Write-Host "  Backed up devora.exe" -ForegroundColor Gray
    }

    # Copy new executable
    if (Test-Path $newExePath) {
        Copy-Item $newExePath $currentExePath
        Write-Host "  Updated devora.exe" -ForegroundColor Green
    }

    # Copy new dist folder
    if (Test-Path $newDistPath) {
        if (Test-Path $currentDistPath) {
            Remove-Item $currentDistPath -Recurse -Force
        }
        Copy-Item $newDistPath $currentDistPath -Recurse
        Write-Host "  Updated dist/" -ForegroundColor Green
    }

    # Copy VERSION file
    if (Test-Path $newVersionPath) {
        Copy-Item $newVersionPath $VERSION_FILE -Force
        Write-Host "  Updated VERSION" -ForegroundColor Green
    }

    # Clean up backup
    if (Test-Path $backupExePath) {
        Remove-Item $backupExePath -Force -ErrorAction SilentlyContinue
    }

    Write-Host "Installation complete!" -ForegroundColor Green
}

# Main
Write-Header

$currentVersion = Get-CurrentVersion
Write-Host "Current version: $currentVersion"
Write-Host "Checking for updates..." -ForegroundColor Yellow
Write-Host ""

$release = Get-LatestRelease
if (-not $release) {
    Write-Host "Could not check for updates. Please try again later." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$latestVersion = $release.tag_name -replace '^v', ''
Write-Host "Latest version:  $latestVersion"

$comparison = Compare-Versions $currentVersion $latestVersion
if ($comparison -ge 0) {
    Write-Host ""
    Write-Host "You are already on the latest version!" -ForegroundColor Green
    Read-Host "Press Enter to exit"
    exit 0
}

Write-Host ""
Write-Host "New version available: $currentVersion -> $latestVersion" -ForegroundColor Cyan

# Find Windows asset
$assetName = "devora-windows-x64.zip"
$asset = $release.assets | Where-Object { $_.name -eq $assetName }

if (-not $asset) {
    Write-Host "No download available for Windows" -ForegroundColor Red
    Write-Host "Available assets: $($release.assets.name -join ', ')"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Downloading $assetName..." -ForegroundColor Yellow

# Create temp directory
$tempDir = Join-Path $env:TEMP "devora-update-$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$zipPath = Join-Path $tempDir $assetName
$extractDir = Join-Path $tempDir "extracted"

try {
    # Download
    Download-WithProgress $asset.browser_download_url $zipPath $asset.size

    # Extract
    Write-Host "Extracting..." -ForegroundColor Yellow
    Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
    Write-Host "Extraction complete!" -ForegroundColor Green

    # Install
    Install-Update $extractDir

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Update successful!" -ForegroundColor Green
    Write-Host "  Please restart Devora to use the new version." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "Update failed: $_" -ForegroundColor Red
}
finally {
    # Clean up temp directory
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Read-Host "Press Enter to exit"
