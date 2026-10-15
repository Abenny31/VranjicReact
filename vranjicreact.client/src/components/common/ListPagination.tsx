import { useUiTranslation } from '@/hooks/useUiTranslation';
interface Props {
    page: number;
    hasMore: boolean;
    onPageChange: (page: number) => void;
    disabled?: boolean;
}

export default function ListPagination({ page, hasMore, onPageChange, disabled = false }: Props) {
    const { ui } = useUiTranslation();
    return <nav aria-label={ui("Stranice rezultata")} className="mt-6 flex items-center gap-4 text-sm">
        <button type="button" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)} className="rounded border px-3 py-2 disabled:opacity-40">{ui("Prethodna")}</button>
        <span aria-current="page">{ui("Stranica")} {page}</span>
        <button type="button" disabled={disabled || !hasMore || page >= 10000} onClick={() => onPageChange(page + 1)} className="rounded border px-3 py-2 disabled:opacity-40">{ui("Sljedeća")}</button>
    </nav>;
}
