import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { API_BASE_URL } from '@/lib/api-client';

// Only our media endpoints receive authorization; arbitrary image URLs never receive a token.
export function isProtectedMediaPath(src: string) {
    return /^\/api\/(content-images\/(blog|news)\/\d+\/\d+|gallery\/\d+\/media)$/.test(src);
}

export default function ContentImage({ src, alt }: { src: string; alt: string }) {
    const { getAccessToken } = useAuth();
    const { ui } = useUiTranslation();
    const [preview, setPreview] = useState<{ src: string; url: string } | null>(null);
    const [error, setError] = useState(false);
    const protectedPath = isProtectedMediaPath(src);
    useEffect(() => {
        setError(false);
        if (!protectedPath) return;
        const controller = new AbortController();
        let objectUrl: string | undefined;
        getAccessToken().then(async token => {
            if (controller.signal.aborted) return;
            const response = await fetch(`${API_BASE_URL}${src}`, {
                headers: token ? { Authorization: token } : {}, signal: controller.signal,
                credentials: 'omit', cache: 'no-store', redirect: 'error',
            });
            if (!response.ok) throw new Error('Fotografija nije dostupna.');
            const blob = await response.blob();
            if (controller.signal.aborted) return;
            objectUrl = URL.createObjectURL(blob);
            setPreview({ src, url: objectUrl });
        }).catch(() => { if (!controller.signal.aborted) setError(true); });
        return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [src, protectedPath, getAccessToken]);
    const url = protectedPath ? (preview?.src === src ? preview.url : undefined) : src;
    if (error) return <p role="alert" className="text-sm text-red-700">{ui('Fotografija nije dostupna.')}</p>;
    return url ? <img src={url} alt={alt} className="max-h-80 w-full rounded object-contain" /> : null;
}
