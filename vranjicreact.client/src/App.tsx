import { Outlet } from 'react-router-dom';
import Header from '@/components/widgets/Header';
import Footer2 from '@/components/widgets/Footer2';
import { PublicContactProvider } from '@/contexts/PublicContactContext';
import { PublicDisplayProvider } from '@/contexts/PublicDisplayContext';

export default function App() {
    return (
        <PublicContactProvider><PublicDisplayProvider>
            <Header />          {/* TailNext header renders its own menu */}
            <main style={{ padding: '1rem' }}>
                <Outlet />
            </main>
            <Footer2 />
        </PublicDisplayProvider></PublicContactProvider>
    );
}
