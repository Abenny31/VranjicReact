import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { ListPage } from '@/lib/api-client';

type LoadPage<T> = (options: {
    page: number; authorization: string; includeUnpublished: boolean; includeExpired: boolean; signal: AbortSignal;
}) => Promise<ListPage<T>>;

/** Shared lifecycle for the authenticated, paginated editorial lists. */
export function useEditorialList<T>(loadPage: LoadPage<T>) {
    const { getAccessToken } = useAuth();
    const [page, setPage] = useState(1);
    const [items, setItems] = useState<T[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const refresh = useCallback(() => setRevision(value => value + 1), []);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError(null);
        getAccessToken().then(async authorization => {
            if (controller.signal.aborted) return;
            if (!authorization) throw new Error('Sesija je istekla. Prijavite se ponovno.');
            const result = await loadPage({ page, authorization, includeUnpublished: true, includeExpired: true, signal: controller.signal });
            if (!controller.signal.aborted) { setItems(result.items); setHasMore(result.hasMore); }
        }).catch(reason => {
            if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Lista se ne može učitati.');
        }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [getAccessToken, loadPage, page, revision]);

    const refreshAfterDelete = () => {
        if (items.length === 1 && page > 1) setPage(page - 1);
        else refresh();
    };
    return { items, page, setPage, hasMore, loading, error, setError, refresh, refreshAfterDelete };
}
