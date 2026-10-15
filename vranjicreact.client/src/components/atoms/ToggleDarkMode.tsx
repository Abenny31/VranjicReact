import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useEffect, useState } from 'react';
import { IconMoon, IconSun } from '@tabler/icons-react';

export default function ToggleDarkMode() {
    const { ui } = useUiTranslation();
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        setIsDark(document.documentElement.classList.contains('dark'));
    }, []);

    const toggleTheme = () => {
        setIsDark(current => {
            const next = !current;
            document.documentElement.classList.toggle('dark', next);
            return next;
        });
    };

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex rounded-lg p-2.5 text-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
            aria-label={isDark ? ui("Uključi svijetlu temu") : ui("Uključi tamnu temu")}
        >
            {isDark ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
        </button>
    );
}
