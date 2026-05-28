/**
 * Ruster AI Provider for ivLyrics
 * Connects ivLyrics to the local ruster proxy.
 *
 * @author hohofught
 * @version 1.0.1
 */

(() => {
    'use strict';

    if (typeof window === 'undefined') return;

    const ADDON_INFO = {
        id: 'ruster',
        name: 'Ruster AI Provider',
        author: 'hohofught',
        description: {
            en: 'Local ruster proxy provider for ivLyrics translation, pronunciation, metadata, TMI, study, and character pronunciation.'
        },
        version: '1.0.1',
        apiKeyUrl: 'https://github.com/hohofught/ruster/releases/latest',
        supports: {
            translate: true,
            metadata: true,
            tmi: true,
            lyricsStudy: true,
            characterPronunciation: true
        },
        models: []
    };

    const DEFAULT_BASE_URL = 'http://127.0.0.1:5000/v1';
    const DEFAULT_API_KEY = 'localhost';
    const DEFAULT_MODEL = 'gpt-4o-mini';
    const REGISTER_RETRY_LIMIT = 100;

    const LANGUAGE_DATA = {
        ko: { name: 'Korean', native: '한국어', phoneticDesc: 'Korean Hangul pronunciation' },
        en: { name: 'English', native: 'English', phoneticDesc: 'Latin alphabet romanization' },
        ja: { name: 'Japanese', native: '日本語', phoneticDesc: 'Japanese Katakana pronunciation' },
        'zh-CN': { name: 'Simplified Chinese', native: '简体中文', phoneticDesc: 'Simplified Chinese pronunciation' },
        'zh-TW': { name: 'Traditional Chinese', native: '繁體中文', phoneticDesc: 'Traditional Chinese pronunciation' },
        es: { name: 'Spanish', native: 'Español', phoneticDesc: 'Spanish phonetic spelling' },
        fr: { name: 'French', native: 'Français', phoneticDesc: 'French phonetic spelling' },
        de: { name: 'German', native: 'Deutsch', phoneticDesc: 'German phonetic spelling' },
        ru: { name: 'Russian', native: 'Русский', phoneticDesc: 'Russian Cyrillic pronunciation' },
        pt: { name: 'Portuguese', native: 'Português', phoneticDesc: 'Portuguese phonetic spelling' },
        it: { name: 'Italian', native: 'Italiano', phoneticDesc: 'Italian phonetic spelling' },
        th: { name: 'Thai', native: 'ไทย', phoneticDesc: 'Thai script pronunciation' },
        vi: { name: 'Vietnamese', native: 'Tiếng Việt', phoneticDesc: 'Vietnamese phonetic spelling' },
        id: { name: 'Indonesian', native: 'Bahasa Indonesia', phoneticDesc: 'Indonesian phonetic spelling' },
        ms: { name: 'Malay', native: 'Bahasa Melayu', phoneticDesc: 'Malay phonetic spelling' },
        hi: { name: 'Hindi', native: 'हिन्दी', phoneticDesc: 'Hindi Devanagari pronunciation' },
        ar: { name: 'Arabic', native: 'العربية', phoneticDesc: 'Arabic script pronunciation' },
        fa: { name: 'Persian', native: 'فارسی', phoneticDesc: 'Persian script pronunciation' },
        bn: { name: 'Bengali', native: 'বাংলা', phoneticDesc: 'Bengali script pronunciation' },
        sv: { name: 'Swedish', native: 'Svenska', phoneticDesc: 'Swedish phonetic spelling' }
    };

    function getSetting(key, defaultValue = null) {
        return window.AIAddonManager?.getAddonSetting(ADDON_INFO.id, key, defaultValue) ?? defaultValue;
    }

    function setSetting(key, value) {
        window.AIAddonManager?.setAddonSetting(ADDON_INFO.id, key, value);
    }

    function getApiKeys() {
        let raw = getSetting('api-keys', '') || getSetting('api-key', '') || DEFAULT_API_KEY;
        if (Array.isArray(raw)) {
            return raw.map((key) => String(key || '').trim()).filter(Boolean);
        }
        if (typeof raw !== 'string') return [];
        raw = raw.trim();
        if (!raw) return [];
        try {
            if (raw.startsWith('[')) {
                return JSON.parse(raw).map((key) => String(key || '').trim()).filter(Boolean);
            }
        } catch {
            // Fall back to the raw text below.
        }
        return [raw].filter(Boolean);
    }

    function getBaseUrl() {
        return (getSetting('base-url', DEFAULT_BASE_URL) || DEFAULT_BASE_URL).replace(/\/+$/, '');
    }

    function getSelectedModel() {
        return getSetting('model', '') || getSetting('custom-model', '') || DEFAULT_MODEL;
    }

    function getLangInfo(lang) {
        if (!lang) return LANGUAGE_DATA.en;
        const shortLang = String(lang).split('-')[0].toLowerCase();
        return LANGUAGE_DATA[lang] || LANGUAGE_DATA[shortLang] || LANGUAGE_DATA.en;
    }

    function requestHeaders(apiKey) {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
        return headers;
    }

    async function fetchModels(apiKey = getApiKeys()[0]) {
        if (!apiKey) return [];
        const response = await fetch(`${getBaseUrl()}/models`, {
            method: 'GET',
            headers: requestHeaders(apiKey),
            cache: 'no-cache'
        });
        if (!response.ok) return [];
        const data = await response.json();
        const rawModels = Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.models)
                ? data.models
                : [];
        const models = rawModels
            .map((model) => {
                const id = String(model.id || model.name || '').replace(/^models\//, '');
                return id ? { id, name: model.displayName || id } : null;
            })
            .filter(Boolean);
        return models;
    }

    async function callRusterRaw(prompt, { stream = false, jsonMode = false } = {}) {
        const apiKeys = getApiKeys();
        if (apiKeys.length === 0) {
            throw new Error('[Ruster] API Key(s) is required. Use the ruster local API key or localhost when auth is disabled.');
        }
        const model = getSelectedModel();
        if (!model) {
            throw new Error('[Ruster] Model is not selected.');
        }

        let lastError = null;
        for (const apiKey of apiKeys) {
            try {
                const body = {
                    model,
                    stream,
                    temperature: 0.2,
                    max_completion_tokens: 16384,
                    messages: [{ role: 'user', content: prompt }]
                };
                if (jsonMode) {
                    body.response_format = { type: 'json_object' };
                }

                const response = await fetch(`${getBaseUrl()}/chat/completions`, {
                    method: 'POST',
                    headers: requestHeaders(apiKey),
                    cache: 'no-cache',
                    body: JSON.stringify(body)
                });

                if (response.status === 401 || response.status === 403 || response.status === 429) {
                    lastError = new Error(`[Ruster] HTTP ${response.status}`);
                    continue;
                }
                if (!response.ok) {
                    let message = `HTTP ${response.status}`;
                    try {
                        const errorData = await response.json();
                        if (errorData?.error?.message) message = errorData.error.message;
                    } catch {
                        // Keep HTTP status message.
                    }
                    throw new Error(`[Ruster] ${message}`);
                }

                const data = await response.json();
                const rawText = data?.choices?.[0]?.message?.content || data?.output_text || '';
                if (!rawText) throw new Error('[Ruster] Empty response from API');
                return rawText;
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error('[Ruster] All API keys failed');
    }

    async function callRusterJson(prompt) {
        return extractJSON(await callRusterRaw(prompt, { jsonMode: true }));
    }

    function stripCodeFences(text) {
        return String(text || '').replace(/```json\s*/gi, '').replace(/```[a-z]*\s*/gi, '').replace(/```\s*/g, '').trim();
    }

    function extractJSON(text) {
        const cleaned = stripCodeFences(text);
        try {
            return JSON.parse(cleaned);
        } catch {
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (!match) throw new Error('[Ruster] No valid JSON found in response');
            return JSON.parse(match[0]);
        }
    }

    function parseTextLines(text, expectedLineCount) {
        const cleaned = stripCodeFences(text);
        const lines = cleaned.split(/\r?\n/);
        if (lines.length === expectedLineCount) return lines;
        if (lines.length > expectedLineCount) return lines.slice(-expectedLineCount);
        while (lines.length < expectedLineCount) lines.push('');
        return lines;
    }

    function buildTranslationPrompt(text, lang) {
        const langInfo = getLangInfo(lang);
        const lineCount = String(text).split('\n').length;
        return `You are a lyrics translator. Translate these ${lineCount} lines of song lyrics into ${langInfo.name} (${langInfo.native}).

RULES:
- Output EXACTLY ${lineCount} lines, one translation per line
- Keep empty lines as empty
- Keep symbols like [Chorus], (Yeah), and ♪ as-is
- Do NOT add numbering, quotes, notes, or explanations
- Do NOT use markdown or code blocks
- Return only the translated lines

INPUT:
${text}`;
    }

    function buildPhoneticPrompt(text, lang) {
        const langInfo = getLangInfo(lang);
        const lineCount = String(text).split('\n').length;
        return `Convert these ${lineCount} lines of lyrics into pronunciation for ${langInfo.name} speakers.

RULES:
- Output EXACTLY ${lineCount} lines, one pronunciation per line
- Keep empty lines as empty
- Keep symbols like [Chorus], (Yeah), and ♪ as-is
- Do NOT translate the meaning
- Do NOT add numbering, quotes, notes, or explanations
- Do NOT use markdown or code blocks
- Use ${langInfo.phoneticDesc}
- Return only the pronunciation lines

INPUT:
${text}`;
    }

    function buildMetadataPrompt(title, artist, lang) {
        const langInfo = getLangInfo(lang);
        return `Translate the song title and artist name to ${langInfo.name}.

Return ONLY valid JSON:
{
  "translatedTitle": "translated title",
  "translatedArtist": "translated artist",
  "romanizedTitle": "romanized title",
  "romanizedArtist": "romanized artist"
}

Title: ${title}
Artist: ${artist}`;
    }

    function buildTMIPrompt(title, artist, lang) {
        const langInfo = getLangInfo(lang);
        return `Generate concise music trivia about the song "${title}" by "${artist}" in ${langInfo.name}.

Return ONLY valid JSON:
{
  "track": {
    "description": "2-3 sentence description",
    "trivia": ["fact 1", "fact 2", "fact 3"],
    "sources": { "verified": [], "related": [], "other": [] },
    "reliability": {
      "confidence": "medium",
      "has_verified_sources": false,
      "verified_source_count": 0,
      "related_source_count": 0,
      "total_source_count": 0
    }
  }
}`;
    }

    function buildCharacterPronunciationPrompt(lines, lang, sourceLang, unitMode) {
        const langInfo = getLangInfo(lang);
        const isWordMode = unitMode === 'word';
        const payload = lines.map((line, index) => {
            const text = typeof line === 'string' ? line : String(line?.text || line?.line || '');
            const chars = Array.from(text);
            return isWordMode
                ? { i: Number(line?.index ?? index), t: text, n: chars.length }
                : { i: Number(line?.index ?? index), a: chars, n: chars.length };
        });
        const shape = isWordMode
            ? '{"l":[{"i":0,"u":[{"s":0,"e":4,"p":"pronunciation"}]}]}'
            : '{"l":[{"i":0,"p":["pronunciation"]}]}';
        return `You are a multilingual lyrics pronunciation aligner.

Return ONLY compact JSON. No markdown.
Target pronunciation language: ${langInfo.name}
Source language: ${sourceLang || 'auto'}
Mode: ${unitMode || 'char'}

Rules:
- Preserve each input line i.
- In character mode, output top key l; each item has i and p.
- In character mode, p must contain exactly n strings, aligned to input character array a.
- In word mode, output top key l; each item has i and u; each u item has s, e, p.
- Use empty strings for unpronounced helper characters.

Return shape:
${shape}

Input lines:
${JSON.stringify(payload)}`;
    }

    function buildLyricsStudyPrompt(params) {
        const langInfo = getLangInfo(params.lang || params.targetLang || 'ko');
        const category = ['summary', 'lines', 'expressions', 'quiz'].includes(params.category)
            ? params.category
            : 'lines';
        const lines = Array.isArray(params.lines) ? params.lines : [];
        const payload = lines
            .map((line, index) => ({
                index: Number(line.index ?? index),
                text: String(line.text || line.line || line.lyric || '')
            }))
            .filter((line) => Number.isFinite(line.index) && line.text.trim());

        const outputShapes = {
            summary: '{"summary":"summary text","keyPoints":["point"]}',
            lines: '{"lines":[{"index":0,"reading":"","pronunciation":"","translation":"","explanation":"","grammar":[],"vocabulary":[]}]}',
            expressions: '{"keyExpressions":[{"expression":"","meaning":"","note":"","alternatives":[],"forms":[],"relatedWords":[],"lineIndexes":[0]}]}',
            quiz: '{"quiz":[{"type":"meaning","question":"","choices":["A","B","C","D"],"answerIndex":0,"explanation":"","lineIndex":0,"reading":"","pronunciation":""}]}'
        };

        return `You are a language learning tutor inside a lyrics app. Build one category of a compact study pack from the provided song lyrics.

Target explanation language: ${langInfo.name}
Song: ${params.title || ''}
Artist: ${params.artist || ''}
Category: ${category}
Difficulty: ${params.difficulty || 'normal'}
Chunk: ${params.chunkIndex || 1}/${params.chunkTotal || 1}

Rules:
- Return ONLY valid JSON. No markdown, no code fences, no extra text.
- Generate only the requested category.
- Preserve original line indexes exactly.
- Write explanations and questions in ${langInfo.name}.
- Keep original lyric fragments short.

Output JSON shape:
${outputShapes[category]}

Input lines:
${JSON.stringify(payload)}`;
    }

    function buildSettingsUI() {
        const React = Spicetify.React;
        const { useCallback, useEffect, useState } = React;

        return function RusterSettings() {
            const initialApiKeys = getSetting('api-keys', '') || getSetting('api-key', '') || DEFAULT_API_KEY;
            const [apiKeys, setApiKeys] = useState(Array.isArray(initialApiKeys) ? JSON.stringify(initialApiKeys) : initialApiKeys);
            const [baseUrl, setBaseUrl] = useState(getBaseUrl());
            const [model, setModel] = useState(getSelectedModel());
            const [customModel, setCustomModel] = useState(getSetting('custom-model', ''));
            const [availableModels, setAvailableModels] = useState([]);
            const [modelsLoading, setModelsLoading] = useState(false);
            const [testStatus, setTestStatus] = useState('');

            const loadModels = useCallback(async () => {
                setModelsLoading(true);
                try {
                    const models = await fetchModels();
                    setAvailableModels(models);
                    ADDON_INFO.models = models;
                    if (!getSetting('model', '') && models[0]?.id) {
                        setSetting('model', models[0].id);
                        setModel(models[0].id);
                    }
                } catch {
                    setAvailableModels([]);
                } finally {
                    setModelsLoading(false);
                }
            }, [apiKeys, baseUrl]);

            useEffect(() => {
                loadModels();
            }, [loadModels]);

            const handleApiKeyChange = useCallback((event) => {
                const value = event.target.value;
                setApiKeys(value);
                setSetting('api-keys', value);
            }, []);

            const handleBaseUrlChange = useCallback((event) => {
                const value = event.target.value;
                setBaseUrl(value);
                setSetting('base-url', value);
            }, []);

            const handleModelChange = useCallback((event) => {
                const value = event.target.value;
                setModel(value);
                setSetting('model', value);
            }, []);

            const handleCustomModelChange = useCallback((event) => {
                const value = event.target.value;
                setCustomModel(value);
                setSetting('custom-model', value);
                if (value) {
                    setModel(value);
                    setSetting('model', value);
                }
            }, []);

            const handleTest = useCallback(async () => {
                setTestStatus('Testing...');
                try {
                    await callRusterRaw('Reply with just "OK" if you receive this.');
                    setTestStatus('Connection successful');
                } catch (error) {
                    setTestStatus(`Error: ${error.message || error}`);
                }
            }, []);

            const isModelInList = availableModels.some((item) => item.id === model);
            const hasApiKey = getApiKeys().length > 0;

            return React.createElement('div', { className: 'ai-addon-settings ruster-settings' },
                React.createElement('div', { className: 'ai-addon-setting' },
                    React.createElement('label', null, 'API Key(s)'),
                    React.createElement('div', { className: 'ai-addon-input-group' },
                        React.createElement('input', {
                            type: 'text',
                            value: apiKeys,
                            onChange: handleApiKeyChange,
                            placeholder: 'ruster local API key, or localhost when auth is disabled'
                        }),
                        React.createElement('button', {
                            onClick: () => window.open(ADDON_INFO.apiKeyUrl, '_blank'),
                            className: 'ai-addon-btn-secondary'
                        }, 'Get ruster')
                    ),
                    React.createElement('small', null, 'Use the ruster local API key. If ruster auth is disabled, any non-empty value works.')
                ),
                React.createElement('div', { className: 'ai-addon-setting' },
                    React.createElement('label', null, 'Base URL'),
                    React.createElement('input', {
                        type: 'text',
                        value: baseUrl,
                        onChange: handleBaseUrlChange,
                        placeholder: DEFAULT_BASE_URL
                    }),
                    React.createElement('small', null, 'Use the OpenAI-compatible ruster base URL ending with /v1.')
                ),
                React.createElement('div', { className: 'ai-addon-setting' },
                    React.createElement('label', null, 'Model'),
                    React.createElement('div', { className: 'ai-addon-input-group' },
                        React.createElement('select', {
                            value: isModelInList ? model : '',
                            onChange: handleModelChange,
                            disabled: modelsLoading
                        },
                            modelsLoading
                                ? React.createElement('option', { value: '' }, 'Loading models...')
                                : availableModels.length > 0
                                    ? [
                                        ...availableModels.map((item) => React.createElement('option', { key: item.id, value: item.id }, item.name || item.id)),
                                        React.createElement('option', { key: 'custom', value: '' }, 'Custom...')
                                    ]
                                    : [
                                        React.createElement('option', { key: 'empty', value: '' }, hasApiKey ? 'No models found' : 'Enter API key first'),
                                        React.createElement('option', { key: 'custom', value: '' }, 'Custom...')
                                    ]
                        ),
                        React.createElement('button', {
                            onClick: loadModels,
                            className: 'ai-addon-btn-secondary',
                            disabled: modelsLoading,
                            title: 'Refresh model list'
                        }, modelsLoading ? '...' : 'Refresh')
                    ),
                    availableModels.length > 0 && React.createElement('small', null, `${availableModels.length} models available`)
                ),
                (!isModelInList || customModel) && React.createElement('div', { className: 'ai-addon-setting' },
                    React.createElement('label', null, 'Custom Model ID'),
                    React.createElement('input', {
                        type: 'text',
                        value: customModel,
                        onChange: handleCustomModelChange,
                        placeholder: 'gpt-4o-mini'
                    })
                ),
                React.createElement('div', { className: 'ai-addon-setting' },
                    React.createElement('button', { onClick: handleTest, className: 'ai-addon-btn-primary' }, 'Test Connection'),
                    testStatus && React.createElement('span', {
                        className: `ai-addon-test-status ${testStatus.startsWith('Connection') ? 'success' : testStatus.startsWith('Error') ? 'error' : ''}`
                    }, testStatus)
                )
            );
        };
    }

    const RusterAddon = {
        ...ADDON_INFO,

        async init() {
            window.__ivLyricsDebugLog?.('[Ruster Addon] Initialized');
        },

        async testConnection() {
            await callRusterRaw('Reply with just "OK" if you receive this.');
        },

        getSettingsUI() {
            return buildSettingsUI();
        },

        async translateLyrics({ text, lang, wantSmartPhonetic }) {
            if (!text?.trim()) throw new Error('No text provided');
            const expectedLineCount = text.split('\n').length;
            const prompt = wantSmartPhonetic
                ? buildPhoneticPrompt(text, lang)
                : buildTranslationPrompt(text, lang);
            const rawResponse = await callRusterRaw(prompt);
            const lines = parseTextLines(rawResponse, expectedLineCount);
            return wantSmartPhonetic ? { phonetic: lines } : { translation: lines };
        },

        async translateMetadata({ title, artist, lang }) {
            if (!title || !artist) throw new Error('Title and artist are required');
            const result = await callRusterJson(buildMetadataPrompt(title, artist, lang));
            return {
                translated: {
                    title: result.translatedTitle || result.title || title,
                    artist: result.translatedArtist || result.artist || artist
                },
                romanized: {
                    title: result.romanizedTitle || title,
                    artist: result.romanizedArtist || artist
                }
            };
        },

        async generateTMI({ title, artist, lang }) {
            if (!title || !artist) throw new Error('Title and artist are required');
            return await callRusterJson(buildTMIPrompt(title, artist, lang));
        },

        async generateLyricsStudy(params) {
            if (!Array.isArray(params?.lines) || params.lines.length === 0) {
                throw new Error('No lyrics lines provided');
            }
            return await callRusterJson(buildLyricsStudyPrompt(params));
        },

        async generateCharacterPronunciation({ lines, lang = 'ko', sourceLang = 'auto', unitMode = 'char' }) {
            if (!Array.isArray(lines) || lines.length === 0) {
                throw new Error('No lines provided');
            }
            const result = await callRusterJson(buildCharacterPronunciationPrompt(lines, lang, sourceLang, unitMode));
            if (!result || !(Array.isArray(result.l) || Array.isArray(result.lines))) {
                throw new Error('Invalid character pronunciation response');
            }
            return result;
        }
    };

    let attempts = 0;
    const registerAddon = () => {
        if (window.AIAddonManager && typeof window.AIAddonManager.register === 'function') {
            window.AIAddonManager.register(RusterAddon);
            window.__ivLyricsDebugLog?.('[Ruster Addon] Registered');
        } else if (++attempts < REGISTER_RETRY_LIMIT) {
            setTimeout(registerAddon, 100);
        } else {
            console.error('[Ruster Addon] AIAddonManager not found after retries');
        }
    };

    registerAddon();
})();
