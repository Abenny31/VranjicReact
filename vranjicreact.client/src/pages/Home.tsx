import { useLocalizedContentState } from '@/hooks/useLocalizedContentState';
import { useEffect, useState } from 'react';
import Hero from '@/components/widgets/Hero';
import HomeTopNews from '@/components/widgets/HomeTopNews';
import HomeDiscovery from '@/components/widgets/HomeDiscovery';
import { fetchHome } from '@/lib/home-api';
import type { HomeResponse } from '@/lib/types';
import { homeHead } from '@/shared/data/pages/home.data';
import { useUiTranslation } from '@/hooks/useUiTranslation';

export default function Page() {
    const { ui } = useUiTranslation();
    const [response, setResponse] = useLocalizedContentState<HomeResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        fetchHome()
            .then(result => {
                if (active) {
                    setResponse(result);
                }
            })
            .catch(reason => {
                if (active) {
                    setError(reason instanceof Error ? reason.message : 'Sadržaj početne stranice nije dostupan.');
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, [setResponse]);

    return (
        <>
            <Hero {...homeHead}
                title={<>{ui('Dobrodošli na stranice')} <span className="hidden md:inline">{ui('Udruge Don Frane Bulić Vranjic')}</span></>}
                subtitle={<><span className="hidden md:inline">{ui('Udruga')} {ui('sa ciljem očuvanja kulturne baštine stare Dalmacije i Vranjica.')} </span>{ui('Za sve ljude dobre volje koji žele pomoći u ostvarenju naših ciljeva.')}</>}
                image={homeHead.image ? { ...homeHead.image, alt: ui('Udruga DFB Vranjic') } : undefined}
            />
            <HomeTopNews response={response} loading={loading} error={error} />
            <HomeDiscovery response={response} loading={loading} error={error} />
            {/*<Features {...featuresHome} />*/}
            {/*<Content {...contentHomeOne} />*/}
            {/*<Content {...contentHomeTwo} />*/}
            {/*<Steps {...stepsHome} />*/}
            {/*<Testimonials {...testimonialsHome} />*/}
            {/*<FAQs2 {...faqs2Home} />*/}
            {/*<Pricing {...pricingHome} />*/}
            {/*<Team {...teamHome} />*/}
            {/*<Contact {...contactHome} />*/}
            {/*<CallToAction2 {...callToAction2Home} />*/}
        </>
    );
}
