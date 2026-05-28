# Ruster AI Provider for ivLyrics

This repository contains an ivLyrics AI Provider addon for the local ruster proxy.

The addon registers one provider in ivLyrics and calls ruster through the OpenAI-compatible API:

- Base URL: `http://localhost:5000/v1`
- Chat endpoint: `/chat/completions`
- Models endpoint: `/models`
- Default API key: `localhost`

Supported ivLyrics features:

- Lyrics translation
- Metadata translation
- TMI generation
- Lyrics study mode
- Character pronunciation

## Requirements

- ivLyrics 4.0.0 or newer
- ruster running locally with its HTTP server enabled
- Default ruster address: `http://localhost:5000/v1`

## ivLyrics Marketplace

The ivLyrics marketplace discovers public GitHub repositories tagged with the `ivlyrics-addon` topic. This repository is structured for that rule:

- Root `manifest.json`
- `addons[0].type` set to `ai`
- Raw `downloadUrl` pointing to `Addon_AI_Ruster.js`

After the repository is public and indexed by GitHub, search for `Ruster AI Provider` in the ivLyrics marketplace and install it there.

## Manual Install

Run PowerShell from this repository folder:

```powershell
.\install.ps1
```

Or pass the ivLyrics app directory explicitly:

```powershell
.\install.ps1 -AppDir "$env:APPDATA\spicetify\CustomApps\ivLyrics"
```

The installer copies `Addon_AI_Ruster.js` into the ivLyrics app directory and adds it to `subfiles_extension` in ivLyrics `manifest.json`.

To remove it:

```powershell
.\uninstall.ps1
```

## Provider Settings

In ivLyrics, open AI provider settings and enable `Ruster AI Provider`.

Recommended values:

- API Key(s): `localhost` if ruster auth is disabled, or your configured ruster API key
- Base URL: `http://localhost:5000/v1`
- Model: select one from the model list or enter a custom model ID

Keep ruster running while using the provider. The addon only bridges ivLyrics to the local ruster backend; it does not start ruster by itself.
