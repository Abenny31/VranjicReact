import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useAuth } from '@/contexts/AuthContext';

export default function PublicationHelp() {
    const { ui } = useUiTranslation();
    const { hasRole } = useAuth();
    const manager = hasRole('Administrator') || hasRole('SuperUser');
    return <aside className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
        <p className="font-semibold">{ui("Kako sadržaj postaje javan?")}</p>
        <p className="mt-1">{ui("Spremite nacrt → pošaljite na pregled → ovlaštena osoba pregledava sadržaj → administrator ga objavljuje.")}</p>
        <p className="mt-1">{ui("Nacrt je privatan. Odobrenje pregleda još nije javna objava. Za slanje na pregled odaberite područje.")}</p>
        {manager && <p className="mt-1">{ui("Kao administrator možete i izravno objaviti sadržaj; ta se radnja bilježi u povijesti.")}</p>}
    </aside>;
}
