import { useUiTranslation } from '@/hooks/useUiTranslation';
import { Link } from "react-router-dom";
import { IconArrowLeft, IconTools } from "@tabler/icons-react";

export function UIzradi() {
    const { ui } = useUiTranslation();
    return (
        <section className="relative">
            {/* suptilna pozadina */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-slate-50 to-transparent dark:from-slate-900/30"
            />

            {/* watermark "WIP" u pozadini */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 flex select-none items-center justify-center opacity-10"
            >
                <span className="text-[18rem] leading-none font-extrabold text-slate-900/30 dark:text-white/10">
                    WIP
                </span>
            </div>

            <div className="mx-auto max-w-3xl px-4 py-20 text-center">
                <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-wider text-blue-600">
                    <IconTools className="h-5 w-5" />  {ui("U izradi")} </p>

                <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
                    {ui("Stranica je u izradi")} </h1>

                <p className="mt-6 text-base leading-7 text-slate-600 dark:text-slate-400">
                    {ui("Uskoro stiže sadržaj. Ako nešto hitno trebaš, javi nam se ili se vrati na početnu.")} </p>

                <div className="mt-10 flex items-center justify-center gap-3">
                    <Link
                        to="/"
                        className="inline-flex items-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        <IconArrowLeft className="mr-2 h-5 w-5" />
                        {ui("Na početnu")} </Link>

                    <Link
                        to="/kontakt"
                        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                        {ui("Kontakt")} </Link>
                </div>
            </div>
        </section>
    );
}