#Requires -Version 5.1
<#
.SYNOPSIS
    Builds DirtOS on Windows 11.

.DESCRIPTION
    Checks prerequisites, installs frontend dependencies, and runs a full
    Tauri production build (pnpm vite build + cargo release).

.PARAMETER SkipPrereqCheck
    Skip the prerequisite version checks and proceed directly to the build.

.PARAMETER SkipInstall
    Skip `pnpm install` (useful when deps are already up-to-date).

.PARAMETER Clean
    Remove the dist/ and src-tauri/target/release/ directories before building.
#>
[CmdletBinding()]
param(
    [switch]$SkipPrereqCheck,
    [switch]$SkipInstall,
    [switch]$Clean
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Helpers ───────────────────────────────────────────────────────────────────

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Success([string]$Message) {
    Write-Host "    OK  $Message" -ForegroundColor Green
}

function Write-Fail([string]$Message) {
    Write-Host "    FAIL $Message" -ForegroundColor Red
}

function Assert-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Fail "$Name not found on PATH"
        throw "Missing prerequisite: $Name"
    }
}

function Get-SemVer([string]$Raw) {
    # Extract first x.y.z from a version string like "v20.11.0" or "rustc 1.78.0 (...)"
    if ($Raw -match '(\d+)\.(\d+)\.(\d+)') {
        return [Version]"$($Matches[1]).$($Matches[2]).$($Matches[3])"
    }
    return $null
}

# ── Ensure Rust/cargo is on PATH (rustup installs to ~\.cargo\bin) ────────────

if (-not (Get-Command 'cargo' -ErrorAction SilentlyContinue)) {
    $cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
    if (Test-Path (Join-Path $cargoBin 'cargo.exe')) {
        Write-Host "    INFO cargo not on PATH; adding $cargoBin for this session" -ForegroundColor DarkGray
        $env:PATH = "$cargoBin;$env:PATH"
    }
}

# ── Resolve project root ──────────────────────────────────────────────────────

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Push-Location $ProjectRoot
try {

# ── Prerequisite checks ───────────────────────────────────────────────────────

if (-not $SkipPrereqCheck) {
    Write-Step "Checking prerequisites"

    # Node.js >= 20.19.0
    Assert-Command 'node'
    $nodeVer = Get-SemVer (node --version 2>&1)
    $nodeMin = [Version]'20.19.0'
    if ($null -eq $nodeVer -or $nodeVer -lt $nodeMin) {
        Write-Fail "Node.js $nodeMin+ required (found: $nodeVer)"
        throw "Node.js version too old"
    }
    Write-Success "Node.js $nodeVer"

    # pnpm
    Assert-Command 'pnpm'
    $pnpmVer = Get-SemVer (pnpm --version 2>&1)
    Write-Success "pnpm $pnpmVer"

    # Rust toolchain
    Assert-Command 'cargo'
    $rustcVer = Get-SemVer (rustc --version 2>&1)
    $rustMin = [Version]'1.77.0'
    if ($null -eq $rustcVer -or $rustcVer -lt $rustMin) {
        Write-Fail "Rust $rustMin+ required (found: $rustcVer). Run: rustup update"
        throw "Rust version too old"
    }
    Write-Success "Rust $rustcVer"

    # WebView2 – Windows 11 ships it by default, warn if registry key is absent
    $wv2Key = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
    if (-not (Test-Path $wv2Key)) {
        Write-Host "    WARN WebView2 registry key not found. " -ForegroundColor Yellow -NoNewline
        Write-Host "It is normally pre-installed on Windows 11; if the app fails to run, install it from https://developer.microsoft.com/microsoft-edge/webview2/" -ForegroundColor Yellow
    } else {
        Write-Success "WebView2 runtime present"
    }
}

# ── Sync git tags so version numbers stay current ────────────────────────────

Write-Step "Fetching git tags"
if (Get-Command 'git' -ErrorAction SilentlyContinue) {
    git fetch --tags --prune-tags 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    WARN git fetch --tags failed (offline or no remote?). Continuing with local tags." -ForegroundColor Yellow
    } else {
        $latestTag = git describe --tags --abbrev=0 2>$null
        if ($latestTag) { Write-Success "Latest tag: $latestTag" }
        else             { Write-Success "Tags fetched (no tags found yet)" }
    }
} else {
    Write-Host "    WARN git not found; skipping tag sync" -ForegroundColor Yellow
}

# ── Optional clean ────────────────────────────────────────────────────────────

if ($Clean) {
    Write-Step "Cleaning previous build artefacts"

    $dirsToRemove = @(
        (Join-Path $ProjectRoot 'dist'),
        (Join-Path $ProjectRoot 'src-tauri\target\release')
    )
    foreach ($dir in $dirsToRemove) {
        if (Test-Path $dir) {
            Remove-Item $dir -Recurse -Force
            Write-Success "Removed $dir"
        }
    }
}

# ── Install frontend dependencies ─────────────────────────────────────────────

if (-not $SkipInstall) {
    Write-Step "Installing frontend dependencies (pnpm install)"
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }
    Write-Success "Dependencies installed"
}

# ── Tauri build ───────────────────────────────────────────────────────────────

Write-Step "Running Tauri production build  (pnpm build)"
Write-Host "    This compiles the Vite frontend then the Rust backend." -ForegroundColor DarkGray
Write-Host "    First-time builds download Rust crates and may take several minutes." -ForegroundColor DarkGray

pnpm build
if ($LASTEXITCODE -ne 0) { throw "Tauri build failed (exit code $LASTEXITCODE)" }

# ── Report output location ────────────────────────────────────────────────────

Write-Step "Build complete"

$bundleDir = Join-Path $ProjectRoot 'src-tauri\target\release\bundle'
if (Test-Path $bundleDir) {
    Write-Host "`n    Installer bundles written to:" -ForegroundColor Green
    Get-ChildItem $bundleDir -Recurse -File |
        Where-Object { $_.Extension -in '.exe', '.msi' } |
        ForEach-Object { Write-Host "      $($_.FullName)" -ForegroundColor Green }
} else {
    Write-Host "    Build artefacts are in src-tauri\target\release\" -ForegroundColor Green
}

} finally {
    Pop-Location
}
