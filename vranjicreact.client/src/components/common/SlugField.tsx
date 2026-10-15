import { useUiTranslation } from '@/hooks/useUiTranslation';
interface Props {
    value: string;
    onChange: (value: string) => void;
}

export default function SlugField({ value, onChange }: Props) {
    const { ui } = useUiTranslation();
    return <details className="rounded border border-slate-200 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-600">{ui("Web-adresa — neobavezno")}</summary>
        <label className="mt-3 flex flex-col gap-2">
            <span>{ui("Dio web-adrese (slug)")}</span>
            <input value={value} onChange={event => onChange(event.target.value)} placeholder={ui("Automatski iz naslova")} className="rounded border border-slate-300 p-2" />
            <span className="text-xs text-slate-500">{ui("Primjer: „Torcida Vranjic” → torcida-vranjic. Ostavite prazno za automatsku izradu. Promjena postojeće adrese mijenja poveznicu na sadržaj.")}</span>
        </label>
    </details>;
}
