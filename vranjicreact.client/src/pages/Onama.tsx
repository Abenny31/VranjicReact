import { useLanguage } from '@/contexts/LanguageContext';

const Onama = () => {
    const { t } = useLanguage();

    return (
        <div className="mx-auto max-w-4xl space-y-4 py-10 px-4">
            <h1 className="text-3xl font-semibold text-slate-800">{t('about.title', 'O nama')}</h1>
            <p className="text-slate-700">
                {t(
                    'about.content',
                    'Vranjic je mjesto s dugom pomorskom i ribarskom tradicijom. Okupljeni oko udruge Don Frane Bulic organiziramo kulturne manifestacije, sportske susrete i radionice za djecu i mlade.'
                )}
            </p>
            <p className="text-slate-700">
                {t(
                    'about.extra',
                    'Nasa mala zajednica zimi mirise na more, a ljeti na festu. Volonteri uredjuju setnicu, skupljamo stare fotografije za digitalni arhiv i osluskujemo ideje nasih sumjestana kako bi Vranjic ostao zivahan i gostoljubiv.'
                )}
            </p>
        </div>
    );
};

export default Onama;
