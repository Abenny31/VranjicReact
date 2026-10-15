import { apiFetch } from './api-client';
import type { HomeResponse } from './types';

export function fetchHome() {
    return apiFetch<HomeResponse>('/api/home');
}
