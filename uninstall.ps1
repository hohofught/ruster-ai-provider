[CmdletBinding()]
param(
    [string]$AppDir = "",
    [switch]$NoApply
)

$ErrorActionPreference = "Stop"

$AddonFile = "Addon_AI_Ruster.js"

function Get-CandidateAppDirs {
    $paths = New-Object System.Collections.Generic.List[string]

    if ($env:APPDATA) {
        $paths.Add((Join-Path $env:APPDATA "spicetify\CustomApps\ivLyrics"))
    }
    if ($env:LOCALAPPDATA) {
        $paths.Add((Join-Path $env:LOCALAPPDATA "spicetify\CustomApps\ivLyrics"))
    }
    if ($HOME) {
        $paths.Add((Join-Path $HOME ".spicetify\CustomApps\ivLyrics"))
    }

    $paths | Select-Object -Unique
}

function Resolve-IvLyricsAppDir {
    if ($AppDir) {
        $resolved = Resolve-Path -LiteralPath $AppDir -ErrorAction Stop
        $manifest = Join-Path $resolved.Path "manifest.json"
        if (-not (Test-Path -LiteralPath $manifest)) {
            throw "manifest.json was not found in $($resolved.Path)"
        }
        return $resolved.Path
    }

    foreach ($candidate in Get-CandidateAppDirs) {
        $manifest = Join-Path $candidate "manifest.json"
        if (Test-Path -LiteralPath $manifest) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw "Could not find ivLyrics. Pass -AppDir with the ivLyrics CustomApps directory."
}

function Write-JsonFile {
    param(
        [string]$Path,
        [object]$Value
    )

    $json = $Value | ConvertTo-Json -Depth 64
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, $utf8NoBom)
}

function Invoke-SpicetifyApply {
    if ($NoApply) {
        Write-Host "Skipped spicetify apply because -NoApply was set."
        return
    }

    $spicetify = Get-Command spicetify -ErrorAction SilentlyContinue
    if (-not $spicetify) {
        Write-Warning "spicetify was not found in PATH. Run 'spicetify apply' manually."
        return
    }

    & $spicetify.Source apply
}

$appPath = Resolve-IvLyricsAppDir
$manifestPath = Join-Path $appPath "manifest.json"
$addonPath = Join-Path $appPath $AddonFile

if (Test-Path -LiteralPath $addonPath) {
    Remove-Item -LiteralPath $addonPath -Force
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($null -ne $manifest.subfiles_extension) {
    $manifest.subfiles_extension = @($manifest.subfiles_extension | Where-Object { $_ -ne $AddonFile })
    Write-JsonFile -Path $manifestPath -Value $manifest
}

Write-Host "Removed $AddonFile from $appPath"
Invoke-SpicetifyApply
