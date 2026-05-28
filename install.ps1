[CmdletBinding()]
param(
    [string]$AppDir = "",
    [string]$AddonUrl = "https://raw.githubusercontent.com/hohofught/ruster-ai-provider/main/Addon_AI_Ruster.js",
    [string]$RusterInstallDir = "",
    [switch]$DownloadRuster,
    [switch]$SkipRusterPrompt,
    [switch]$NoApply
)

$ErrorActionPreference = "Stop"

$AddonFile = "Addon_AI_Ruster.js"
$RusterReleaseApiUrl = "https://api.github.com/repos/hohofught/ruster/releases/latest"
$RusterFallbackPortableUrl = "https://github.com/hohofught/ruster/releases/latest/download/ruster-v1.0-windows-x86_64-portable.zip"
$RusterExeFile = "ruster.exe"

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

function Resolve-RusterInstallDir {
    if ($RusterInstallDir) {
        return $RusterInstallDir
    }
    if ($env:LOCALAPPDATA) {
        return (Join-Path $env:LOCALAPPDATA "ruster")
    }
    if ($HOME) {
        return (Join-Path $HOME "ruster")
    }
    return (Join-Path (Get-Location) "ruster")
}

function Find-RusterExecutable {
    $command = Get-Command ruster -ErrorAction SilentlyContinue
    if ($command -and $command.Source) {
        return $command.Source
    }

    $candidateDirs = @()
    if ($RusterInstallDir) {
        $candidateDirs += $RusterInstallDir
    }
    if ($env:LOCALAPPDATA) {
        $candidateDirs += (Join-Path $env:LOCALAPPDATA "ruster")
    }
    if ($HOME) {
        $candidateDirs += (Join-Path $HOME "ruster")
    }

    foreach ($dir in ($candidateDirs | Select-Object -Unique)) {
        $exe = Join-Path $dir $RusterExeFile
        if (Test-Path -LiteralPath $exe) {
            return $exe
        }
    }

    return $null
}

function Get-RusterPortableDownloadUrl {
    try {
        $release = Invoke-RestMethod -Uri $RusterReleaseApiUrl -Headers @{
            "User-Agent" = "ruster-ai-provider-installer"
            "Accept" = "application/vnd.github+json"
        }
        $assets = @($release.assets)
        $asset = $assets |
            Where-Object {
                $_.name -match "windows[-_]x86_64[-_]portable\.zip$" -or
                $_.name -match "windows.*x86_64.*portable.*\.zip$"
            } |
            Select-Object -First 1

        if ($asset -and $asset.browser_download_url) {
            return $asset.browser_download_url
        }
    } catch {
        Write-Warning "Could not query the latest ruster release: $($_.Exception.Message)"
    }

    return $RusterFallbackPortableUrl
}

function Install-RusterPortable {
    $installDir = Resolve-RusterInstallDir
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null

    $url = Get-RusterPortableDownloadUrl
    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("ruster-install-" + [Guid]::NewGuid().ToString("N"))
    $zipPath = Join-Path $tempRoot "ruster-portable.zip"
    $extractDir = Join-Path $tempRoot "extract"

    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
    try {
        Write-Host "Downloading ruster portable from $url"
        Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing

        New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
        Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force

        $exe = Get-ChildItem -LiteralPath $extractDir -Recurse -Filter $RusterExeFile -File |
            Select-Object -First 1
        if (-not $exe) {
            throw "$RusterExeFile was not found in the downloaded portable package."
        }

        $sourceRoot = $exe.Directory.FullName
        Get-ChildItem -LiteralPath $sourceRoot -Force |
            Copy-Item -Destination $installDir -Recurse -Force

        $installedExe = Join-Path $installDir $RusterExeFile
        Write-Host "Installed ruster portable into $installDir"
        Write-Host "Run ruster with:"
        Write-Host "  & `"$installedExe`""
    } finally {
        if (Test-Path -LiteralPath $tempRoot) {
            Remove-Item -LiteralPath $tempRoot -Recurse -Force
        }
    }
}

function Should-DownloadRuster {
    if ($DownloadRuster) {
        return $true
    }
    if ($SkipRusterPrompt) {
        return $false
    }

    $existing = Find-RusterExecutable
    if ($existing) {
        Write-Host "ruster executable already found: $existing"
        return $false
    }

    try {
        $answer = Read-Host "ruster backend was not found. Download ruster portable now? [y/N]"
        return $answer -match "^(y|yes)$"
    } catch {
        Write-Warning "Could not prompt for ruster download. Skipping backend download."
        return $false
    }
}

$appPath = Resolve-IvLyricsAppDir
$manifestPath = Join-Path $appPath "manifest.json"
$destination = Join-Path $appPath $AddonFile

$localAddon = if ($PSScriptRoot) { Join-Path $PSScriptRoot $AddonFile } else { "" }
if ($localAddon -and (Test-Path -LiteralPath $localAddon)) {
    Copy-Item -LiteralPath $localAddon -Destination $destination -Force
} else {
    Invoke-WebRequest -Uri $AddonUrl -OutFile $destination -UseBasicParsing
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($null -eq $manifest.subfiles_extension) {
    $manifest | Add-Member -NotePropertyName subfiles_extension -NotePropertyValue @()
}

$extensions = @($manifest.subfiles_extension)
if ($extensions -notcontains $AddonFile) {
    $manifest.subfiles_extension = @($extensions + $AddonFile)
    Write-JsonFile -Path $manifestPath -Value $manifest
}

Write-Host "Installed $AddonFile into $appPath"
Invoke-SpicetifyApply

if (Should-DownloadRuster) {
    Install-RusterPortable
} else {
    Write-Host "Skipped ruster portable download."
}
