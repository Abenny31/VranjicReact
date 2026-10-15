import { apiFetch } from './api-client';

export function translateText(text: string, targetLanguage: string, authorization: string, signal: AbortSignal) {
    return apiFetch<{ text: string }>('/api/moderation/translate', {
        method: 'POST', headers: { Authorization: authorization }, signal,
        body: JSON.stringify({ text, sourceLanguage: 'hr', targetLanguage }),
    });
}
