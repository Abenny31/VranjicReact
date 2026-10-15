import { useUiTranslation } from '@/hooks/useUiTranslation';
import circle from '@/assets/images/ab31-circle.svg';
import circleLight from '@/assets/images/ab31-circle-light.svg';

// Set a real https:// or mailto: destination when the owner supplies it.
export const creatorCredit: { href: string | null } = { href: null };

export default function CreatorCredit() {
    const { ui } = useUiTranslation();
    const logo = <>
        <img src={circle} alt="AB31" width={28} height={28} className="h-7 w-7 dark:hidden" />
        <img src={circleLight} alt="AB31" width={28} height={28} className="hidden h-7 w-7 dark:block" />
    </>;
    return creatorCredit.href
        ? <a href={creatorCredit.href} aria-label={ui("AB31 — autor web-stranice")} className="inline-flex shrink-0 rounded-full opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">{logo}</a>
        : <span aria-label={ui("AB31 — autor web-stranice")} className="inline-flex shrink-0 opacity-70">{logo}</span>;
}
