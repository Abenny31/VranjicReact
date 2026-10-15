import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useContactItems } from '@/hooks/useContactItems';
import CreatorCredit from '@/components/common/CreatorCredit';

const Footer2 = () => {
  const { ui } = useUiTranslation();
  const items = useContactItems();

  return (
    <footer className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="xs:gap-8 grid grid-cols-4 gap-4 gap-y-8 py-8 md:py-12">
        {items.map(({ title, description, href, icon: Icon }, index) => (
          <div
            key={`item-column-${index}`}
            className="col-span-4 sm:col-span-2 md:col-span-2 lg:col-span-1 xl:col-span-1"
          >
            <div className="mb-2 font-medium text-gray-800 dark:text-gray-300">{typeof title === 'string' ? ui(title) : title}</div>
            <p className="break-words text-gray-600 dark:text-slate-400">
              {href && href.startsWith('https://') && Icon ? <a href={href} target="_blank" rel="noopener noreferrer"
                aria-label={typeof description === 'string' ? description : undefined}
                className="-ml-2 inline-flex rounded-lg p-2.5 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-gray-700">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </a> : href ? <a href={href} className="underline"
                target={href.startsWith('https://') ? '_blank' : undefined}
                rel={href.startsWith('https://') ? 'noopener noreferrer' : undefined}>{description}</a> : description}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-6 text-sm text-gray-700 dark:text-slate-400 md:py-8">
        <div className="min-w-0 flex-1">
          <p>{ui('Izradila udruga Don Frane Bulić - Vranjic')}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">© {new Date().getFullYear()}. {ui('Sva prava pridržana.')}</p>
        </div>
        <div className="ml-auto shrink-0"><CreatorCredit /></div>
      </div>
    </footer>
  );
};

export default Footer2;
