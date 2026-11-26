import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, Search, ShoppingBag, Wrench, PackageSearch } from 'lucide-react';
import { Link, navigate, useRoute } from '../../router';
import { getCategories, getServices, searchServices } from '../../lib/catalog';
import { trackFunnelStep } from '../../lib/tracking';
import type { Service } from '../../lib/types';
import { useCatalog, ProductCard, ProductCardSkeleton, searchProducts } from '../market/shared';
import type { MarketProductPublic } from '../../lib/market';
import { SITE_CITY } from '../../lib/site';

interface CollectionPublic {
  slug: string;
  name: string;
  description: string | null;
  products: MarketProductPublic[];
}

const FEATURED_SERVICE_SLUGS = [
  'creation-cv-professionnel',
  'reparation-telephone',
  'livraison-courses-express',
];

const SERVICE_CATEGORY_ORDER = [
  'maison-travaux',
  'reparation-maintenance',
  'numerique-documents',
  'transport-logistique',
  'auto-moto',
];

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  'maison-travaux': 'Maison',
  'reparation-maintenance': 'Réparation',
  'numerique-documents': 'Numérique',
  'transport-logistique': 'Transport',
  'auto-moto': 'Auto & Moto',
};

function CategoryChip({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-8 shrink-0 items-center rounded-full border border-brand-border bg-white px-3.5 py-1.5 text-xs font-bold text-brand-text transition-colors hover:border-brand-accent/40 hover:bg-brand-accent/5 hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
    >
      {children}
    </Link>
  );
}

function ServiceShortcutCard({ service }: { service: Service }) {
  return (
    <Link
      to={'/service/' + service.slug}
      onClick={() => trackFunnelStep('PATH_SELECTED', { universe: 'services' })}
      className="group flex min-h-[104px] flex-col justify-between rounded-2xl border border-brand-border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-accent/35 hover:shadow-premium-hover sm:p-5"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-bg text-brand-accent">
        <Wrench className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="mt-3 block">
        <span className="block text-sm font-extrabold leading-snug text-brand-text">{service.name}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-accent">
          Voir le service
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-12 w-full rounded-full border border-brand-border bg-white pl-11 pr-5 text-sm font-medium text-brand-text shadow-[0_5px_20px_-14px_rgba(25,24,23,0.24)] outline-none transition-all placeholder:text-brand-text-muted/80 focus:border-brand-accent/40 focus:ring-2 focus:ring-brand-accent/10 sm:h-[54px] sm:text-base"
      />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-accent">{eyebrow}</p>
        <h2 className="mt-1 font-heading text-lg font-extrabold tracking-tight text-brand-text sm:text-xl">{title}</h2>
      </div>
      {href && (
        <Link to={href} className="shrink-0 text-xs font-bold text-brand-accent hover:underline sm:text-sm">
          {linkLabel ?? 'Tout voir'} <ArrowRight className="inline h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export function EntryPage() {
  const { anchor } = useRoute();
  const [serviceQuery, setServiceQuery] = useState('');
  const [marketQuery, setMarketQuery] = useState('');
  const [collections, setCollections] = useState<CollectionPublic[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const { data, error, loading } = useCatalog();

  useEffect(() => {
    if (anchor === 'services') navigate('/services#services');
    else if (anchor === 'market' || anchor === 'boutique') navigate('/boutique');
    else if (anchor === 'faq' || anchor === 'questions') navigate('/a-propos#questions');
    else if (anchor === 'comment-ca-marche' || anchor === 'fonctionnement') navigate('/a-propos#fonctionnement');
  }, [anchor]);

  useEffect(() => {
    let alive = true;
    fetch('/api/market/collections')
      .then(async (response) => (response.ok ? (await response.json()) as CollectionPublic[] : []))
      .then((items) => { if (alive) setCollections(items); })
      .catch(() => { if (alive) setCollections([]); })
      .finally(() => { if (alive) setCollectionsLoading(false); });
    return () => { alive = false; };
  }, []);

  const services = getServices();
  const serviceCategories = getCategories().sort(
    (a, b) => SERVICE_CATEGORY_ORDER.indexOf(a.slug) - SERVICE_CATEGORY_ORDER.indexOf(b.slug),
  );
  const featuredServices = FEATURED_SERVICE_SLUGS
    .map((slug) => services.find((service) => service.slug === slug))
    .filter((service): service is Service => Boolean(service));
  const serviceMatches = serviceQuery.trim() ? searchServices(serviceQuery).slice(0, 4) : [];
  const visibleServices = serviceQuery.trim() ? serviceMatches : featuredServices;

  const products = data?.products ?? [];
  const discoverProducts = products.filter((product) => product.availability !== 'UNAVAILABLE');
  const marketMatches = useMemo(
    () => (marketQuery.trim() ? searchProducts(discoverProducts, marketQuery).slice(0, 6) : []),
    [discoverProducts, marketQuery],
  );
  const marketCategories = (data?.categories ?? []).filter((category) =>
    products.some((product) => product.category.slug === category.slug),
  );
  const newestProducts = [...discoverProducts]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  const submitServiceSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = serviceQuery.trim();
    trackFunnelStep('PATH_SELECTED', { universe: 'services' });
    navigate(query ? '/services?q=' + encodeURIComponent(query) : '/services');
  };

  const submitMarketSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = marketQuery.trim();
    navigate(query ? '/boutique/tous?q=' + encodeURIComponent(query) : '/boutique');
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-5 sm:px-6 sm:pb-16 sm:pt-8 lg:px-8">
        <section id="fika-services" aria-labelledby="services-title" className="scroll-mt-24">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="font-heading text-sm font-extrabold tracking-tight text-brand-text sm:text-base">Fika Services</p>
            <span className="rounded-full bg-brand-surface px-3 py-1 text-[10px] font-bold text-brand-text-muted ring-1 ring-brand-border">
              {SITE_CITY}
            </span>
          </div>

          <h1 id="services-title" className="mb-3 font-heading text-xl font-extrabold tracking-tight text-brand-text sm:text-2xl">
            Quel service recherchez-vous ?
          </h1>

          <form onSubmit={submitServiceSearch} role="search" aria-label="Rechercher un service">
            <SearchField
              value={serviceQuery}
              onChange={setServiceQuery}
              placeholder="Rechercher une prestation..."
              label="Rechercher une prestation"
            />
          </form>

          <nav aria-label="Catégories de services" className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {serviceCategories.map((category) => (
              <CategoryChip key={category.slug} to={'/univers/' + category.slug}>
                {SERVICE_CATEGORY_LABELS[category.slug] ?? category.title}
              </CategoryChip>
            ))}
          </nav>

          <div className="mt-5">
            <SectionHeading
              eyebrow={serviceQuery.trim() ? 'Recherche' : 'Sélection Fika'}
              title={serviceQuery.trim() ? 'Résultats dans nos services' : 'Services recommandés'}
              href="/services"
              linkLabel="Tous les services"
            />
            {visibleServices.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleServices.map((service) => <ServiceShortcutCard key={service.id} service={service} />)}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-brand-border bg-white px-5 py-6 text-center">
                <p className="text-sm font-bold text-brand-text">Aucun service trouvé pour cette recherche.</p>
                <p className="mt-1 text-xs text-brand-text-muted">Essayez un autre terme ou décrivez directement votre besoin à Fika.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Link to="/demande" className="rounded-full bg-brand-text px-4 py-2 text-xs font-bold text-white hover:bg-black">Décrire mon besoin</Link>
                  <button type="button" onClick={() => setServiceQuery('')} className="rounded-full border border-brand-border px-4 py-2 text-xs font-bold text-brand-text hover:bg-brand-bg">Effacer la recherche</button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <Link to="/services" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-accent hover:underline">
              Explorer tout le catalogue <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <div className="my-8 border-t border-brand-border sm:my-10" aria-hidden="true" />

        <section id="fika-market" aria-labelledby="market-title" className="scroll-mt-24">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="font-heading text-sm font-extrabold tracking-tight text-brand-text sm:text-base">Fika Market</p>
            <span className="rounded-full bg-brand-surface px-3 py-1 text-[10px] font-bold text-brand-text-muted ring-1 ring-brand-border">
              Catalogue Fika
            </span>
          </div>

          <h2 id="market-title" className="mb-3 font-heading text-xl font-extrabold tracking-tight text-brand-text sm:text-2xl">
            Découvrez les produits Fika
          </h2>

          <form onSubmit={submitMarketSearch} role="search" aria-label="Rechercher un produit">
            <SearchField
              value={marketQuery}
              onChange={setMarketQuery}
              placeholder="Que recherchez-vous ?"
              label="Rechercher un produit"
            />
          </form>

          <nav aria-label="Catégories de produits" className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {marketCategories.map((category) => (
              <CategoryChip key={category.slug} to={'/boutique/categorie/' + category.slug}>
                {category.name}
              </CategoryChip>
            ))}
          </nav>

          <div className="mt-5">
            {marketQuery.trim() ? (
              <>
                <SectionHeading eyebrow="Fika Market" title="Produits correspondants" href="/boutique/tous" linkLabel="Voir tout" />
                {marketMatches.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {marketMatches.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-brand-border bg-white px-5 py-6 text-center">
                    <p className="text-sm font-bold text-brand-text">Ce produit n’est pas encore dans le catalogue.</p>
                    <p className="mt-1 text-xs text-brand-text-muted">Fika peut vérifier s’il est possible de le trouver et de vous le faire livrer à {SITE_CITY}.</p>
                    <Link to="/demande-produit" className="mt-4 inline-flex rounded-full bg-brand-text px-4 py-2 text-xs font-bold text-white hover:bg-black">Demander ce produit</Link>
                  </div>
                )}
              </>
            ) : (
              <>
                {collections.length > 0 ? (
                  <div className="space-y-7">
                    {collections.slice(0, 2).map((collection) => (
                      <section key={collection.slug} aria-labelledby={'collection-' + collection.slug}>
                        <SectionHeading
                          eyebrow="Sélection Fika"
                          title={collection.name}
                          href="/boutique/tous"
                          linkLabel="Tout voir"
                        />
                        {collection.description && <p className="-mt-2 mb-3 max-w-2xl text-xs text-brand-text-muted">{collection.description}</p>}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                          {collection.products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : loading || collectionsLoading ? (
                  <section aria-label="Chargement des nouveautés" aria-busy="true">
                    <SectionHeading eyebrow="Fika Market" title="Collections et nouveautés" />
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, index) => <ProductCardSkeleton key={index} />)}
                    </div>
                  </section>
                ) : newestProducts.length > 0 ? (
                  <section aria-labelledby="market-newest">
                    <SectionHeading
                      eyebrow="À découvrir"
                      title="Collections et nouveautés"
                      href="/boutique/tous"
                      linkLabel="Tous les produits"
                    />
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {newestProducts.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}
                    </div>
                  </section>
                ) : (
                  <section className="rounded-2xl border border-dashed border-brand-border bg-white px-5 py-7 text-center">
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand-bg text-brand-accent">
                      <PackageSearch className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-3 font-heading text-base font-extrabold text-brand-text">Le catalogue se prépare.</h3>
                    <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-brand-text-muted">Les produits seront présentés ici dès leur publication. Vous pouvez déjà demander un article précis.</p>
                    <Link to="/demande-produit" className="mt-4 inline-flex rounded-full bg-brand-text px-4 py-2 text-xs font-bold text-white hover:bg-black">Demander un produit</Link>
                  </section>
                )}
              </>
            )}
          </div>

          <div className="mt-5 flex justify-end">
            <Link to="/boutique" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-accent hover:underline">
              Explorer Fika Market <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-brand-border pt-5 text-[11px] font-semibold text-brand-text-muted">
          <span>Deux univers, une équipe.</span>
          <span>Prix et conditions confirmés avant engagement.</span>
          <span>Disponible à {SITE_CITY}.</span>
        </div>
      </div>
    </div>
  );
}
