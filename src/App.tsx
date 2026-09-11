import { Suspense, lazy, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, MessageCircle } from 'lucide-react';
import { useRoute, Link } from './router';
import { Header, Footer } from './components/layout';
import { HomePage } from './components/HomePage';
import { UniversePage } from './components/UniversePage';
import { ServicePage } from './components/ServicePage';
import { ServicesPage } from './components/ServicesPage';
import { DemandePage } from './components/DemandePage';
import { LegalPage, type LegalKind } from './components/LegalPage';
import { Button } from './components/ui';
import { getWALink } from './lib/whatsapp';
import { applyRouteMeta, seoForRoute } from './lib/seo';

// L'espace admin est chargé à la demande : il ne pèse jamais sur le First Load
// des visiteurs publics (objectif performance P09).
const AdminRouter = lazy(() => import('./components/admin/index'));

const LEGAL_ROUTES: LegalKind[] = ['mentions-legales', 'cgv', 'confidentialite'];

function usePageSeo(path: string) {
  useEffect(() => {
    applyRouteMeta(seoForRoute(path));

    // L'espace d'administration ne doit jamais être indexé.
    const existing = document.querySelector('meta[name="robots"]');
    if (path.startsWith('/admin')) {
      if (existing) existing.setAttribute('content', 'noindex, nofollow');
      else {
        const meta = document.createElement('meta');
        meta.name = 'robots';
        meta.content = 'noindex, nofollow';
        document.head.appendChild(meta);
      }
    } else if (existing) {
      existing.remove();
    }
  }, [path]);
}

function NotFound() {
  return (
    <div className="min-h-[60vh] pt-24 pb-16 flex flex-col items-center justify-center text-center px-4">
      <p className="font-heading text-sm font-bold uppercase tracking-widest text-brand-text-muted mb-4">Erreur 404</p>
      <p className="font-signature text-6xl text-brand-accent mb-2">Oups.</p>
      <h1 className="font-heading text-3xl font-bold text-brand-text mb-4">Page introuvable</h1>
      <p className="text-brand-text-muted mb-10 max-w-md">
        La page que vous cherchez n&apos;existe pas ou a été déplacée. Revenez à l&apos;accueil, on s&apos;occupe du reste.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button asChild variant="primary" className="rounded-full px-8">
          <Link to="/">Retour à l&apos;accueil</Link>
        </Button>
        <Button asChild variant="whatsapp" className="rounded-full px-8">
          <a href={getWALink('Bonjour Fika 👋, je cherchais une page introuvable sur le site.')} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="w-4 h-4 mr-2" /> Nous contacter
          </a>
        </Button>
      </div>
    </div>
  );
}

function AdminFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <Loader2 className="w-6 h-6 animate-spin text-brand-accent" aria-label="Chargement de l'espace administration" />
    </div>
  );
}

export default function App() {
  const { path } = useRoute();
  const isAdmin = path.startsWith('/admin');
  usePageSeo(path);

  let page: React.ReactNode;
  if (isAdmin) {
    page = (
      <Suspense fallback={<AdminFallback />}>
        <AdminRouter path={path} />
      </Suspense>
    );
  } else if (path === '/') {
    page = <HomePage />;
  } else if (path === '/services') {
    page = <ServicesPage />;
  } else if (path === '/demande') {
    page = <DemandePage />;
  } else if (LEGAL_ROUTES.includes(path.slice(1) as LegalKind)) {
    page = <LegalPage kind={path.slice(1) as LegalKind} />;
  } else if (path.startsWith('/univers/')) {
    page = <UniversePage slug={decodeURIComponent(path.slice('/univers/'.length))} />;
  } else if (path.startsWith('/service/')) {
    page = <ServicePage slug={decodeURIComponent(path.slice('/service/'.length))} />;
  } else {
    page = <NotFound />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg text-brand-text font-sans">
      {/* Navigation clavier : accès direct au contenu principal */}
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-brand-text focus:text-white focus:px-4 focus:py-2 focus:rounded-xl focus:font-bold"
      >
        Aller au contenu
      </a>
      <Header />
      <main id="contenu" tabIndex={-1} className={`flex-grow outline-none ${isAdmin ? '' : 'pt-8'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={path}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            {page}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}
