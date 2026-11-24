import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, PackageSearch, Store, Truck } from 'lucide-react';
import { Button } from '../ui';
import { Link } from '../../router';
import { type MarketProductPublic } from '../../lib/market';
import { trackMarketEvent } from '../../lib/market-analytics';
import { getWALink } from '../../lib/whatsapp';
import { ProductCard, ProductCardSkeleton, ProductImage, useCatalog } from './shared';

interface CollectionPublic { slug: string; name: string; description: string | null; products: MarketProductPublic[] }

function HeroProductTile({ product, prominent = false }: { product: MarketProductPublic; prominent?: boolean }) {
  return (
    <Link
      to={"/boutique/produit/" + product.slug}
      className={"group relative block min-h-[132px] overflow-hidden rounded-2xl border border-white/60 bg-[#E5DDD0] shadow-sm " + (prominent ? "h-full min-h-[300px] sm:min-h-[390px]" : "h-full")}
    >
      <ProductImage src={product.images[0]} alt={product.name} loading="eager" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" iconClassName="h-10 w-10 text-slate-400" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/35 to-transparent p-3 sm:p-4">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">{product.category.name}{product.brand ? " · " + product.brand : ""}</p>
        <p className={"mt-1 line-clamp-2 font-heading font-extrabold leading-snug text-white " + (prominent ? "text-lg sm:text-xl" : "text-sm")}>{product.name}</p>
        <p className="mt-1 text-sm font-extrabold text-white">{product.priceSale.toLocaleString('fr-FR')} F</p>
      </div>
      {prominent && <span className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-800 shadow-sm">À découvrir</span>}
    </Link>
  );
}

export function MarketHomePage() {
  const { data, error, loading } = useCatalog();
  const [collections, setCollections] = useState<CollectionPublic[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);

  useEffect(() => { trackMarketEvent('SHOP_VIEWED'); }, []);
  useEffect(() => {
    let alive = true;
    fetch('/api/market/collections')
      .then(async (res) => (res.ok ? (await res.json()) as CollectionPublic[] : []))
      .then((items) => { if (alive) setCollections(items); })
      .catch(() => { if (alive) setCollections([]); })
      .finally(() => { if (alive) setCollectionsLoading(false); });
    return () => { alive = false; };
  }, []);

  const products = data?.products ?? [];
  const discoverProducts = products.filter((product) => product.availability !== 'UNAVAILABLE');
  const heroProducts = discoverProducts.slice(0, 3);
  const categoryCards = (data?.categories ?? [])
    .map((category) => ({
      ...category,
      count: products.filter((product) => product.category.slug === category.slug).length,
    }))
    .filter((category) => category.count > 0);
  const hasEditorialCollections = collections.length > 0;

  return (
    <div className="min-h-screen bg-[#FCFBF9]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        {/* Grande entrée éditoriale : image réelle du catalogue, jamais de visuel inventé. */}
        <section className="relative overflow-hidden rounded-[1.75rem] border border-[#E8E0D6] bg-[#F0E9DF] shadow-[0_24px_70px_-50px_rgba(38,30,22,0.48)]">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/45 blur-3xl" aria-hidden="true" />
          <div className="relative grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-center px-6 py-9 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
              <p className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" /> Fika Market · Ngaoundéré
              </p>
              <h1 className="mt-5 max-w-xl font-heading text-3xl font-extrabold leading-[1.08] tracking-tight text-[#25211E] sm:text-4xl lg:text-[3.25rem]">
                Les produits que vous cherchez. Le reste, on s’en occupe.
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[#625A51] sm:text-base">
                Explorez une sélection de produits et demandez ceux que vous ne trouvez pas.
                Fika vérifie la disponibilité, confirme le prix final et organise la livraison à Ngaoundéré.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="rounded-full shadow-sm">
                  <Link to="/boutique/tous">Explorer les produits <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full border-[#CFC4B7] bg-white/60">
                  <Link to="/demande-produit">Demander un produit</Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#D9CFC3] pt-5 text-[11px] font-semibold text-[#625A51]">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand-accent" /> Prix confirmé avant paiement</span>
                <span className="inline-flex items-center gap-1.5"><Truck className="h-4 w-4 text-brand-accent" /> Livraison locale organisée</span>
              </div>
            </div>

            <div className="relative p-3 sm:p-5 lg:p-6">
              {loading ? (
                <div className="grid min-h-[300px] grid-cols-2 grid-rows-2 gap-3 sm:min-h-[390px]">
                  <div className="row-span-2 animate-pulse rounded-2xl bg-white/60" />
                  <div className="animate-pulse rounded-2xl bg-white/60" />
                  <div className="animate-pulse rounded-2xl bg-white/60" />
                </div>
              ) : heroProducts.length > 0 ? (
                <div className="grid min-h-[300px] grid-cols-2 grid-rows-2 gap-3 sm:min-h-[390px]">
                  <div className="row-span-2"><HeroProductTile product={heroProducts[0]} prominent /></div>
                  {heroProducts[1] && <HeroProductTile product={heroProducts[1]} />}
                  {heroProducts[2] && <HeroProductTile product={heroProducts[2]} />}
                  {!heroProducts[2] && (
                    <Link to="/boutique/tous" className="flex h-full min-h-[132px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#CFC4B7] bg-white/45 p-4 text-center hover:bg-white/70">
                      <Store className="h-7 w-7 text-brand-accent" aria-hidden="true" />
                      <span className="mt-2 text-xs font-bold text-slate-700">Explorer le catalogue</span>
                      <span className="mt-1 text-[10px] text-slate-500">Voir les autres produits</span>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#CFC4B7] bg-white/45 p-8 text-center sm:min-h-[390px]">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-brand-accent shadow-sm"><PackageSearch className="h-8 w-8" /></div>
                  <h2 className="mt-4 font-heading text-lg font-extrabold text-slate-800">Votre prochaine trouvaille commence ici.</h2>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-600">Le catalogue s’enrichit progressivement. Faites-nous connaître le produit que vous recherchez.</p>
                  <Link to="/demande-produit" className="mt-4 text-sm font-bold text-brand-accent hover:underline">Faire une demande <ArrowRight className="inline h-4 w-4" /></Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        {/* Découverte par centres d'intérêt */}
        <section aria-labelledby="market-interests" className="mt-10 sm:mt-14">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-accent">Parcourir</p>
              <h2 id="market-interests" className="mt-1 font-heading text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Explorez par catégorie</h2>
            </div>
            <Link to="/boutique/tous" className="shrink-0 text-xs font-bold text-brand-accent hover:underline sm:text-sm">Tout voir <ArrowRight className="inline h-4 w-4" /></Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => <div key={index} className="aspect-[5/4] animate-pulse rounded-2xl bg-slate-100" />)}
            </div>
          ) : categoryCards.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {categoryCards.map((category) => (
                <Link key={category.slug} to={"/boutique/categorie/" + category.slug} className="group relative isolate aspect-[5/4] overflow-hidden rounded-2xl border border-brand-border bg-[#EEEAE5] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  {category.imageUrl
                    ? <img src={category.imageUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    : <div className="absolute inset-0 flex items-center justify-center"><Store className="h-10 w-10 text-brand-accent/65" aria-hidden="true" /></div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/5 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                    <h3 className="font-heading text-sm font-extrabold text-white sm:text-base">{category.name}</h3>
                    <p className="mt-1 text-[10px] font-semibold text-white/75">{category.count} produit{category.count > 1 ? 's' : ''}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-brand-border-dark bg-white p-6 text-center text-sm text-brand-text-muted">Les catégories apparaîtront ici à mesure que les produits seront publiés.</div>
          )}
        </section>

        {/* Sélections définies dans l'administration */}
        <section className="mt-12 space-y-10 sm:mt-16">
          {collections.map((collection) => (
            <section key={collection.slug} aria-labelledby={"collection-" + collection.slug}>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-accent">Sélection Fika</p>
                  <h2 id={"collection-" + collection.slug} className="mt-1 font-heading text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{collection.name}</h2>
                  {collection.description && <p className="mt-1 max-w-xl text-xs text-brand-text-muted sm:text-sm">{collection.description}</p>}
                </div>
                <Link to="/boutique/tous" className="shrink-0 text-xs font-bold text-brand-accent hover:underline sm:text-sm">Voir tout <ArrowRight className="inline h-4 w-4" /></Link>
              </div>
              <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:gap-4 sm:px-6 lg:-mx-8 lg:px-8">
                {collection.products.map((product) => (
                  <div key={product.id} className="w-44 shrink-0 snap-start sm:w-56"><ProductCard product={product} /></div>
                ))}
              </div>
            </section>
          ))}
          {collectionsLoading && products.length > 0 && (
            <section aria-label="Chargement des sélections">
              <div className="mb-4 h-6 w-48 animate-pulse rounded bg-slate-100" />
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 4 }).map((_, index) => <div key={index} className="w-44 shrink-0 sm:w-56"><ProductCardSkeleton /></div>)}
              </div>
            </section>
          )}
          {!loading && products.length > 0 && !hasEditorialCollections && (
            <section aria-labelledby="market-discover">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-accent">Le catalogue</p>
                  <h2 id="market-discover" className="mt-1 font-heading text-xl font-extrabold text-slate-900 sm:text-2xl">À découvrir en ce moment</h2>
                </div>
                <Link to="/boutique/tous" className="shrink-0 text-xs font-bold text-brand-accent hover:underline sm:text-sm">Tous les produits <ArrowRight className="inline h-4 w-4" /></Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
                {products.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            </section>
          )}
        </section>

        {/* Un chemin alternatif si le produit n'est pas encore référencé. */}
        <section className="mt-12 overflow-hidden rounded-2xl border border-[#E8E0D6] bg-[#F4EFE8] p-5 sm:mt-16 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-accent">Vous ne trouvez pas ce que vous cherchez ?</p>
              <h2 className="mt-2 font-heading text-xl font-extrabold text-slate-900 sm:text-2xl">Faites-nous une demande de produit.</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Indiquez ce que vous recherchez. Nous vérifions la disponibilité et revenons vers vous avec le prix final et les modalités avant tout paiement.</p>
            </div>
            <Button asChild size="lg" className="shrink-0 rounded-full"><Link to="/demande-produit">Décrire mon produit <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </section>

        {/* Réassurance — engagements réels */}
        <section aria-label="Engagements Fika Market" className="mt-10 grid gap-3 sm:grid-cols-3 sm:mt-12">
          <div className="flex gap-3 rounded-2xl border border-brand-border bg-white p-4"><CheckCircle2 className="h-5 w-5 shrink-0 text-brand-accent" /><div><p className="text-sm font-extrabold text-slate-900">Prix confirmé</p><p className="mt-1 text-xs leading-relaxed text-brand-text-muted">Le prix final est communiqué avant tout paiement.</p></div></div>
          <div className="flex gap-3 rounded-2xl border border-brand-border bg-white p-4"><Truck className="h-5 w-5 shrink-0 text-brand-accent" /><div><p className="text-sm font-extrabold text-slate-900">Livraison organisée</p><p className="mt-1 text-xs leading-relaxed text-brand-text-muted">Les modalités et frais sont précisés avec la confirmation.</p></div></div>
          <div className="flex gap-3 rounded-2xl border border-brand-border bg-white p-4"><Store className="h-5 w-5 shrink-0 text-brand-accent" /><div><p className="text-sm font-extrabold text-slate-900">Accompagnement Fika</p><p className="mt-1 text-xs leading-relaxed text-brand-text-muted">Une équipe disponible pour vous guider dans votre demande.</p></div></div>
        </section>

        {data && products.length === 0 && (
          <div className="mt-8 text-center">
            <Button asChild variant="outline" className="rounded-full"><a href={getWALink('Bonjour Fika Market 👋\\nJe souhaite demander un produit.')} target="_blank" rel="noopener noreferrer">Nous écrire sur WhatsApp</a></Button>
          </div>
        )}
      </div>
    </div>
  );
}
