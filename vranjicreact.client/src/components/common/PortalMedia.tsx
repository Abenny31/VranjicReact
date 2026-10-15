import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/lib/api-client';

export default function PortalMedia({ id, title, mediaType = 'Image', inline = false }: {
    id: number; title: string; mediaType?: 'Image' | 'Video'; inline?: boolean;
}) {
    const { ui } = useUiTranslation();
    const { getAccessToken } = useAuth();
    const [open, setOpen] = useState(inline);
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        let objectUrl: string | null = null;
        setUrl(null); setError(null);
        getAccessToken().then(async token => {
            if (!token) throw new Error('Sesija je istekla.');
            const response = await fetch(`${API_BASE_URL}/api/gallery/${id}/media`, {
                headers: { Authorization: token }, signal: controller.signal, cache: 'no-store', credentials: 'omit',
            });
            if (!response.ok) throw new Error('Medij nije dostupan.');
            const blob = await response.blob();
            if (controller.signal.aborted) return;
            objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
        }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Medij nije dostupan.'); });
        return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [getAccessToken, id, open]);
    return <div>
        {!inline && <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-blue-700 underline">{open ? ui("Zatvori medij") : ui("Pregledaj medij")}</button>}
        {open && error && <p role="alert" className="text-sm text-red-600">{ui(error)}</p>}
        {open && url && (mediaType === 'Video' ? <video src={url} controls aria-label={title} className="max-h-80 w-full" /> : <img src={url} alt={title} className="max-h-80 w-full object-contain" />)}
    </div>;
}
