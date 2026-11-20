import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Search, Store, Truck } from 'lucide-react';
import { Button } from '../ui';
import { Link, navigate } from '../../router';
import { type MarketProductPublic } from '../../lib/market';
import { trackMarketEvent } from '../../lib/market-analytics';
import { getWALink } from '../../lib/whatsapp';
import {
  formatPrice, getSearchHistory, pushSearchHistory, searchProducts, useCatalog, ProductCard, ProductImage,
} from './shared';

/**
 * Accueil Fika Market — recherche immédiatement visible, cartes catégories
 * (jamais vides), collections éditoriales, puis réassurance réelle.
 */

interface CollectionPublic { slug: string; name: string; description: string | null; products: MarketProductPublic[] }

export function MarketHomePage() {
  const { data, error } = useCatalog();
  const [collections, setCollections] = useState<CollectionPublic[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => { trackMarketEvent('SHOP_VIEWED'); }, []);
  useEffect(() => {
    let alive = true;
    fetch('/api/market/collections')
      .then(async (res) => (res.ok ? (await res.json()) as CollectionPublic[] : []))
      .then((d) => { if (alive) setCollections(d); })
      .catch(() => { if (alive) setCollections([]); });
    return () => { alive = false; };
  }, []);

  const query = q.trim();
  const suggestions = query.length >= 2 && data ? searchProducts(data.products, query).slice(0, 5) : [];
  const history = getSearchHistory();

  const goToSearch = (value?: string) => {
    const term = (value ?? query).trim();
    if (!term) return;
    pushSearchHistory(term);
    navigate(`/boutique/tous?q=${encodeURIComponent(term)}`);
  };

  const products = data?.products ?? [];
  // Cartes catégories : uniquement les catégories actives qui ont des produits.
  const categoryCards = (data?.categories ?? [])
    .map((c) => ({ ...c, count: products.filter((p) => p.category.slug === c.slug).length }))
    .filter((c) => c.count > 0);

  return (
    <div className="max-w-6xl mx-auto px-5 py-10 sm:py-14">
      {/* Recherche immédiatement visible */}
      <p className="text-xs uppercase tracking-widest text-brand-accent font-bold mb-4">Fika Market · Ngaoundéré</p>
      <h1 className="font-heading text-3xl sm:text-4xl font-bold">Les bons produits, accessibles à Ngaoundéré.</h1>
      <p className="text-brand-text-muted mt-4 max-w-2xl leading-relaxed">
        Des produits sélectionnés par Fika, commandés pour vous et livrés localement.
        Prix final et délai toujours confirmés avec vous <strong>avant</strong> tout paiement.
      </p>

      {error && <p role="alert" className="mt-8 rounded-xl bg-red-50 border border-red-200 text-red-700 p-4">{error}</p>}

      {data && products.length > 0 && (
        <>
          <form
            role="search"
            onSubmit={(e) => { e.preventDefault(); goToSearch(); }}
            className="relative mt-8"
          >
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Qu'est-ce que vous recherchez ?"
              aria-label="Rechercher un produit"
              className="w-full h-14 rounded-full border border-brand-border bg-white pl-12 pr-28 text-sm font-medium placeholder:text-brand-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:border-brand-accent"
            />
            <Button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full h-11 px-5">Rechercher</Button>
          </form>

          {/* Historique récent (local, jamais transmis) */}
          {history.length > 0 && query.length < 2 && (
            <div className="flex flex-wrap items-center gap-2 mt-3 text-sm">
              <span className="text-xs text-brand-text-muted font-semibold">Recherches récentes :</span>
              {history.map((h) => (
                <button key={h} type="button" onClick={() => { setQ(h); goToSearch(h); }}
                  className="px-3 py-1 rounded-full border border-brand-border bg-white text-brand-text-muted text-xs font-semibold hover:border-brand-accent hover:text-brand-accent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
                  {h}
                </button>
              ))}
            </div>
          )}

          {/* Suggestions en direct */}
          {query.length >= 2 && (
            <div className="mt-3 bg-white border border-brand-border rounded-2xl overflow-hidden" role="listbox" aria-label="Suggestions de produits">
              {suggestions.length > 0 ? suggestions.map((p) => (
                <Link key={p.id} to={`/boutique/produit/${p.slug}`} className="flex items-center gap-3 p-3 hover:bg-brand-bg border-b border-brand-border last:border-b-0 focus-visible:outline-none focus-visible:bg-brand-bg">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-brand-bg flex items-center justify-center shrink-0">
                    <ProductImage src={p.images[0]} alt="" className="w-full h-full object-cover" iconClassName="w-5 h-5 text-brand-text-muted/40" />
                  </div>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold truncate">{p.name}</span>
                    <span className="block text-xs text-brand-text-muted truncate">{p.category.name}{p.brand ? ` · ${p.brand}` : ''}</span>
                  </span>
                  <span className="text-sm font-extrabold text-brand-accent whitespace-nowrap">{formatPrice(p.priceSale)}</span>
                </Link>
              )) : (
                <p className="p-4 text-sm text-brand-text-muted">
                  Aucun produit ne correspond à «&nbsp;{query}&nbsp;». <button type="button" className="font-bold text-brand-accent underline cursor-pointer" onClick={() => goToSearch()}>Voir les alternatives</button> ou <Link to="/demande-produit" className="font-bold text-brand-accent underline">demandez-le nous</Link>.
                </p>
              )}
            </div>
          )}

          {/* Cartes catégories — jamais de catégorie vide */}
          {categoryCards.length > 0 && (
            <section aria-labelledby="home-categories" className="mt-12">
              <h2 id="home-categories" className="font-heading text-xl font-bold mb-4">Nos catégories</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {categoryCards.map((c) => (
                  <Link key={c.slug} to={`/boutique/categorie/${c.slug}`}
                    className="group rounded-2xl border border-brand-border bg-white overflow-hidden hover:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent">
                    <div className="aspect-[4/3] bg-brand-bg overflow-hidden relative">
                      {c.imageUrl
                        ? <img src={c.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className="absolute inset-0 flex items-center justify-center"><Store className="w-10 h-10 text-brand-accent" aria-hidden="true" /></div>}
                    </div>
                    <div className="p-4">
                      <h3 className="font-heading font-bold leading-snug">{c.name}</h3>
                      <p className="text-xs text-brand-text-muted mt-1">{c.count} produit{c.count > 1 ? 's' : ''}{c.children.length > 0 ? ` · ${c.children.length} sous-catégorie${c.children.length > 1 ? 's' : ''}` : ''}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Collections éditoriales — carrousels horizontaux */}
          {collections.map((col) => (
            <section key={col.slug} aria-labelledby={`col-${col.slug}`} className="mt-12">
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <h2 id={`col-${col.slug}`} className="font-heading text-xl font-bold">{col.name}</h2>
                {col.description && <p className="hidden sm:block text-xs text-brand-text-muted max-w-xs truncate">{col.description}</p>}
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-5 px-5 snap-x scrollbar-none">
                {col.products.map((p) => (
                  <div key={p.id} className="w-44 sm:w-52 shrink-0 snap-start"><ProductCard product={p} /></div>
                ))}
              </div>
            </section>
          ))}

          {/* Tous les produits */}
          <div className="text-center mt-12">
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link to="/boutique/tous">Voir tous les produits ({products.length})<ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" /></Link>
            </Button>
          </div>
        </>
      )}

      {data && products.length === 0 && (
        <div className="mt-10 text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-brand-border">
          <Store className="w-10 h-10 mx-auto text-brand-text-muted/50 mb-4" />
          <h2 className="font-heading font-bold text-lg">Le catalogue arrive</h2>
          <p className="text-sm text-brand-text-muted mt-2 max-w-md mx-auto">
            Nous préparons une première sélection de produits testés. En attendant, dites-nous ce que vous cherchez : nous pouvons probablement le commander pour vous.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button asChild variant="primary" className="rounded-full"><Link to="/demande-produit">Demander un produit</Link></Button>
            <Button asChild variant="outline" className="rounded-full"><a href={getWALink('Bonjour Fika Market 👋\nJe cherche un produit. Pouvez-vous me dire si vous pouvez le commander ?')} target="_blank" rel="noopener noreferrer">Sur WhatsApp</a></Button>
          </div>
        </div>
      )}

      {/* Réassurance — uniquement des engagements réels */}
      <div className="mt-14 grid sm:grid-cols-2 gap-6 text-sm max-w-2xl">
        <div className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-brand-accent shrink-0" /><p><strong>Prix confirmé avant paiement.</strong> Aucune surprise : le coût final vous est communiqué avant tout engagement.</p></div>
        <div className="flex gap-3"><Truck className="w-5 h-5 text-brand-accent shrink-0" /><p><strong>Livraison à Ngaoundéré.</strong> Frais indiqués clairement avec le prix final.</p></div>
      </div>
    </div>
  );
}
