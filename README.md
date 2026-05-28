# Ruster AI Provider for ivLyrics

## 한국어

이 저장소는 로컬 `ruster` 프록시를 ivLyrics AI Provider로 연결하는 addon입니다.

addon은 ivLyrics에 `Ruster AI Provider`를 등록하고, ruster의 OpenAI 호환 API를 호출합니다.

- Base URL: `http://localhost:5000/v1`
- Chat endpoint: `/chat/completions`
- Models endpoint: `/models`
- 기본 API Key: `localhost`

지원 기능:

- 가사 번역
- 메타데이터 번역
- TMI 생성
- 학습 모드 생성
- 글자 발음 생성

### 요구 사항

- ivLyrics 4.0.0 이상
- HTTP 서버가 켜진 상태로 실행 중인 ruster
- 기본 ruster 주소: `http://localhost:5000/v1`

### ivLyrics 마켓플레이스

ivLyrics 마켓플레이스는 `ivlyrics-addon` topic이 붙은 공개 GitHub 저장소를 검색하고, 루트의 `manifest.json`을 읽습니다.

이 저장소는 해당 규격에 맞춰 구성되어 있습니다.

- 루트 `manifest.json`
- `addons[0].type`: `ai`
- `downloadUrl`: `Addon_AI_Ruster.js` raw URL

GitHub 인덱싱 후 ivLyrics 마켓플레이스에서 `Ruster AI Provider`를 검색해 설치하면 됩니다.

### 빠른 설치

PowerShell에서 raw GitHub 스크립트를 바로 실행합니다.

```powershell
irm https://raw.githubusercontent.com/hohofught/ruster-ai-provider/main/install.ps1 | iex
```

ivLyrics 앱 경로를 직접 지정해야 하면 스크립트를 임시 파일로 내려받아 실행합니다.

```powershell
$script = Join-Path $env:TEMP "install-ruster-ai-provider.ps1"
irm https://raw.githubusercontent.com/hohofught/ruster-ai-provider/main/install.ps1 -OutFile $script
powershell -NoProfile -ExecutionPolicy Bypass -File $script -AppDir "$env:APPDATA\spicetify\CustomApps\ivLyrics"
```

설치 스크립트는 `Addon_AI_Ruster.js`를 ivLyrics 앱 폴더로 복사하고, ivLyrics `manifest.json`의 `subfiles_extension`에 등록합니다.

제거:

```powershell
irm https://raw.githubusercontent.com/hohofught/ruster-ai-provider/main/uninstall.ps1 | iex
```

### Provider 설정

ivLyrics AI Provider 설정에서 `Ruster AI Provider`를 활성화합니다.

권장값:

- API Key(s): ruster 인증을 껐다면 `localhost`, 인증을 켰다면 설정한 ruster API key
- Base URL: `http://localhost:5000/v1`
- Model: 모델 목록에서 선택하거나 custom model ID 입력

사용 중에는 ruster가 실행 중이어야 합니다. 이 addon은 ivLyrics와 로컬 ruster backend를 연결만 하며, ruster를 직접 실행하지는 않습니다.

## English

This repository contains an ivLyrics AI Provider addon for the local ruster proxy.

The addon registers `Ruster AI Provider` in ivLyrics and calls ruster through its OpenAI-compatible API.

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

### Requirements

- ivLyrics 4.0.0 or newer
- ruster running locally with its HTTP server enabled
- Default ruster address: `http://localhost:5000/v1`

### ivLyrics Marketplace

The ivLyrics marketplace discovers public GitHub repositories tagged with the `ivlyrics-addon` topic and reads the root `manifest.json`.

This repository is structured for that rule:

- Root `manifest.json`
- `addons[0].type` set to `ai`
- Raw `downloadUrl` pointing to `Addon_AI_Ruster.js`

After GitHub indexes the repository, search for `Ruster AI Provider` in the ivLyrics marketplace and install it there.

### Quick Install

Run the raw GitHub install script from PowerShell:

```powershell
irm https://raw.githubusercontent.com/hohofught/ruster-ai-provider/main/install.ps1 | iex
```

If you need to pass the ivLyrics app directory explicitly, download the script to a temporary file first:

```powershell
$script = Join-Path $env:TEMP "install-ruster-ai-provider.ps1"
irm https://raw.githubusercontent.com/hohofught/ruster-ai-provider/main/install.ps1 -OutFile $script
powershell -NoProfile -ExecutionPolicy Bypass -File $script -AppDir "$env:APPDATA\spicetify\CustomApps\ivLyrics"
```

The installer copies `Addon_AI_Ruster.js` into the ivLyrics app directory and adds it to `subfiles_extension` in ivLyrics `manifest.json`.

To remove it:

```powershell
irm https://raw.githubusercontent.com/hohofught/ruster-ai-provider/main/uninstall.ps1 | iex
```

### Provider Settings

In ivLyrics, open AI Provider settings and enable `Ruster AI Provider`.

Recommended values:

- API Key(s): `localhost` if ruster auth is disabled, or your configured ruster API key
- Base URL: `http://localhost:5000/v1`
- Model: select one from the model list or enter a custom model ID

Keep ruster running while using the provider. The addon only bridges ivLyrics to the local ruster backend; it does not start ruster by itself.
