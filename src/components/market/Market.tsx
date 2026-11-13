import { useEffect, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Loader2, MessageCircle, Minus, PackageSearch, Plus, Search, ShoppingBag, ShoppingCart, Store, Trash2, Truck, X } from 'lucide-react';
import { Button } from '../ui';
import { Field, Input, Textarea } from '../forms';
import { Link, useRoute } from '../../router';
import { AVAILABILITY_LABELS, type MarketProductPublic } from '../../lib/market';
import { cart, type CartItem } from '../../lib/cart';
import { trackMarketEvent } from '../../lib/market-analytics';
import { getWALink } from '../../lib/whatsapp';

/**
 * Fika Market — pages publiques : catalogue, catégorie, fiche produit,
 * commande, suivi. Aucune donnée fictive : catalogue vide = message honnête.
 */

type Catalog = { categories: { slug: string; name: string }[]; products: MarketProductPublic[] };

function useCatalog(category?: string) {
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    fetch(`/api/market/catalog${category ? `?category=${encodeURIComponent(category)}` : ''}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('catalog');
        return (await res.json()) as Catalog;
      })
      .then((d) => { if (alive) { setData(d); setError(''); } })
      .catch(() => { if (alive) setError('Catalogue momentanément indisponible. Réessayez dans un instant.'); });
    return () => { alive = false; };
  }, [category]);
  return { data, error };
}

function formatPrice(n: number): string {
  return `${n.toLocaleString('fr-FR')} F`;
}

const AVAILABILITY_STYLES: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PREORDER: 'bg-amber-50 text-amber-700 border-amber-200',
  UNAVAILABLE: 'bg-brand-bg text-brand-text-muted border-brand-border',
};

/**
 * Image produit avec repli gracieux : URL absente OU morte → icône de repli.
 * Jamais l'icône « image cassée » du navigateur (dégradation honnête et propre).
 * Les URL déjà échouées sont mémorisées : le carousel ne re-montrera pas une
 * image morte à chaque tour (l'icône reste stable).
 */
function ProductImage({ src, alt, className, iconClassName }: {
  src?: string | null; alt: string; className?: string; iconClassName?: string;
}) {
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  if (!src || failed[src]) {
    return <PackageSearch className={iconClassName ?? 'w-10 h-10 text-brand-text-muted/40'} aria-hidden="true" />;
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed((f) => ({ ...f, [src]: true }))} className={className} />;
}

/**
 * Défilement automatique des photos d'aperçu : toutes les 2 secondes.
 * Désactivé si le visiteur demande une animation réduite (accessibilité)
 * ou si le produit n'a qu'une seule photo.
 */
function useCarouselIndex(count: number): number {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (count <= 1) return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % count), 2000);
    return () => { window.clearInterval(id); };
  }, [count]);
  return count > 0 ? i % count : 0;
}

function ProductCard({ product }: { product: MarketProductPublic }) {
  const imageIndex = useCarouselIndex(product.images.length);
  return (
    <Link to={`/boutique/produit/${product.slug}`} className="group flex flex-col rounded-2xl border border-brand-border bg-white overflow-hidden hover:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent">
      <div className="relative aspect-square bg-brand-bg flex items-center justify-center overflow-hidden">
        <ProductImage src={product.images[imageIndex]} alt={product.name} className="w-full h-full object-cover" />
        {product.images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5" aria-hidden="true">
            {product.images.map((_, d) => (
              <span key={d} className={`w-1.5 h-1.5 rounded-full transition-colors ${d === imageIndex ? 'bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]' : 'bg-white/60'}`} />
            ))}
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">{product.category.name}</span>
        <h3 className="font-heading font-bold leading-snug">{product.name}</h3>
        <p className="text-lg font-extrabold text-brand-accent">{formatPrice(product.priceSale)}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${AVAILABILITY_STYLES[product.availability]}`}>
            {AVAILABILITY_LABELS[product.availability]}
          </span>
          <ArrowRight className="w-4 h-4 text-brand-text-muted group-hover:text-brand-accent group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

/** Normalisation de recherche : accents et casse ignorés (« cable » trouve « Câble »). */
function normalizeSearch(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function MarketHomePage() {
  const { data, error } = useCatalog();
  const route = useRoute();
  const [q, setQ] = useState('');
  useEffect(() => { trackMarketEvent('SHOP_VIEWED'); }, []);

  const query = normalizeSearch(q);
  const searching = query.length > 0;
  const matches = searching && data
    ? data.products.filter((p) => normalizeSearch(`${p.name} ${p.reference} ${p.category.name}`).includes(query))
    : [];

  // Vue « Tout » : produits groupés par catégorie, dans l'ordre des catégories.
  // Les produits d'une catégorie inconnue de la liste restent visibles (« Autres »).
  const sections = !searching && data
    ? [
        ...data.categories.map((c) => ({ ...c, products: data.products.filter((p) => p.category.slug === c.slug) })),
        { slug: '', name: 'Autres produits', products: data.products.filter((p) => !data.categories.some((c) => c.slug === p.category.slug)) },
      ].filter((s) => s.products.length > 0)
    : [];

  return (
    <div className="max-w-6xl mx-auto px-5 py-10 sm:py-14">
      <p className="text-xs uppercase tracking-widest text-brand-accent font-bold mb-4">Fika Market · Ngaoundéré</p>
      <h1 className="font-heading text-3xl sm:text-4xl font-bold">Les bons produits, accessibles à Ngaoundéré.</h1>
      <p className="text-brand-text-muted mt-4 max-w-2xl leading-relaxed">
        Des produits sélectionnés par Fika, commandés pour vous et livrés localement.
        Prix final et délai toujours confirmés avec vous <strong>avant</strong> tout paiement.
      </p>

      {error && <p role="alert" className="mt-8 rounded-xl bg-red-50 border border-red-200 text-red-700 p-4">{error}</p>}

      {data && data.products.length > 0 && (
        <>
          <div className="relative mt-8">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un produit, une référence…"
              aria-label="Rechercher un produit"
              className="w-full h-12 rounded-full border border-brand-border bg-white pl-12 pr-12 text-sm font-medium placeholder:text-brand-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:border-brand-accent"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label="Effacer la recherche"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full text-brand-text-muted hover:text-brand-text cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {data.categories.length > 0 && (
            <nav className="flex gap-2 overflow-x-auto py-5 -mx-5 px-5" aria-label="Catégories">
              <Link to="/boutique" className={`px-4 py-2 rounded-full text-sm font-bold border whitespace-nowrap ${route.path === '/boutique' ? 'bg-brand-text text-white border-brand-text' : 'bg-white text-brand-text-muted border-brand-border hover:border-brand-accent'}`}>Tout</Link>
              {data.categories.map((c) => (
                <Link key={c.slug} to={`/boutique/categorie/${c.slug}`} className={`px-4 py-2 rounded-full text-sm font-bold border whitespace-nowrap ${route.path === `/boutique/categorie/${c.slug}` ? 'bg-brand-text text-white border-brand-text' : 'bg-white text-brand-text-muted border-brand-border hover:border-brand-accent'}`}>{c.name}</Link>
              ))}
            </nav>
          )}

          {searching ? (
            matches.length > 0 ? (
              <>
                <p className="text-sm text-brand-text-muted mt-2" role="status">
                  {matches.length} produit{matches.length > 1 ? 's' : ''} correspond{matches.length > 1 ? 'ent' : ''} à «&nbsp;{q.trim()}&nbsp;»
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  {matches.map((p) => <ProductCard key={p.id} product={p} />)}
                </div>
              </>
            ) : (
              <div className="mt-6 text-center py-14 px-6 bg-white rounded-2xl border border-dashed border-brand-border">
                <PackageSearch className="w-10 h-10 mx-auto text-brand-text-muted/50 mb-4" />
                <h2 className="font-heading font-bold text-lg">Aucun produit ne correspond à «&nbsp;{q.trim()}&nbsp;»</h2>
                <p className="text-sm text-brand-text-muted mt-2 max-w-md mx-auto">
                  Vous cherchez autre chose ? Dites-nous ce que vous voulez : nous pouvons probablement le commander pour vous.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <Button asChild variant="primary" className="rounded-full"><Link to="/demande-produit">Demander un produit</Link></Button>
                  <Button asChild variant="outline" className="rounded-full"><Link to="/boutique">Voir tout le catalogue</Link></Button>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-10 mt-2">
              {sections.map((s) => (
                <section key={s.slug || 'autres'} aria-labelledby={`cat-${s.slug || 'autres'}`}>
                  <div className="flex items-baseline justify-between gap-4 mb-4">
                    <h2 id={`cat-${s.slug || 'autres'}`} className="font-heading text-xl font-bold">{s.name}</h2>
                    <span className="text-xs font-bold text-brand-text-muted whitespace-nowrap">{s.products.length} produit{s.products.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {s.products.map((p) => <ProductCard key={p.id} product={p} />)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {data && data.products.length === 0 && (
        <div className="mt-10 text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-brand-border">
          <Store className="w-10 h-10 mx-auto text-brand-text-muted/50 mb-4" />
          <h2 className="font-heading font-bold text-lg">Le catalogue arrive</h2>
          <p className="text-sm text-brand-text-muted mt-2 max-w-md mx-auto">
            Nous préparons une première sélection de produits testés. En attendant, dites-nous ce que vous cherchez : nous pouvons probablement le commander pour vous.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button asChild variant="primary" className="rounded-full"><Link to="/demande-produit">Demander un produit</Link></Button>
            <Button asChild variant="outline" className="rounded-full"><a href={getWALink('Bonjour Fika Market 👋\nJe cherche un produit. Pouvez-vous me dire si vous pouvez le commander ?')} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-4 h-4 mr-2" />Sur WhatsApp</a></Button>
          </div>
        </div>
      )}

      <div className="mt-14 grid sm:grid-cols-2 gap-6 text-sm max-w-2xl">
        <div className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-brand-accent shrink-0" /><p><strong>Prix confirmé avant paiement.</strong> Aucune surprise : le coût final vous est communiqué avant tout engagement.</p></div>
        <div className="flex gap-3"><Truck className="w-5 h-5 text-brand-accent shrink-0" /><p><strong>Livraison à Ngaoundéré.</strong> Frais indiqués clairement avec le prix final.</p></div>
      </div>
    </div>
  );
}

export function MarketCategoryPage({ slug }: { slug: string }) {
  const { data, error } = useCatalog(slug);
  const category = data?.categories.find((c) => c.slug === slug);
  useEffect(() => { trackMarketEvent('CATEGORY_VIEWED', { category: slug }); }, [slug]);
  return (
    <div className="max-w-6xl mx-auto px-5 py-10 sm:py-14">
      <Link to="/boutique" className="text-sm text-brand-text-muted hover:text-brand-accent">← Boutique</Link>
      <h1 className="font-heading text-3xl font-bold mt-3">{category?.name ?? 'Catégorie'}</h1>
      {error && <p role="alert" className="mt-6 text-red-700">{error}</p>}
      {data && (data.products.length === 0
        ? <p className="mt-8 text-brand-text-muted">Aucun produit dans cette catégorie pour le moment.</p>
        : <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">{data.products.map((p) => <ProductCard key={p.id} product={p} />)}</div>)}
    </div>
  );
}

export function MarketProductPage({ slug }: { slug: string }) {
  const [product, setProduct] = useState<MarketProductPublic | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [image, setImage] = useState(0);
  const [variantSel, setVariantSel] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`/api/market/product/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('missing');
        return (await res.json()) as MarketProductPublic;
      })
      .then((p) => {
        if (!alive) return;
        setProduct(p); setState('ready'); document.title = `${p.name} | Fika Market`;
        // Première valeur de chaque dimension sélectionnée par défaut.
        setVariantSel(Object.fromEntries(p.variants.map((v) => [v.name, v.values[0]])));
        trackMarketEvent('PRODUCT_VIEWED', { productId: p.id, slug: p.slug, category: p.category.slug });
      })
      .catch(() => { if (alive) setState('missing'); });
    return () => { alive = false; };
  }, [slug]);

  if (state === 'loading') return <div className="min-h-[50vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-accent" /></div>;
  if (state === 'missing' || !product) return (
    <div className="max-w-xl mx-auto px-5 py-20 text-center">
      <h1 className="font-heading text-2xl font-bold">Produit introuvable</h1>
      <p className="text-brand-text-muted mt-3">Ce produit n’est plus au catalogue.</p>
      <Button asChild className="mt-6"><Link to="/boutique">Retour à la boutique</Link></Button>
    </div>
  );

  const orderable = product.availability !== 'UNAVAILABLE';
  const variantLabel = product.variants.length > 0
    ? product.variants.map((v) => `${v.name} : ${variantSel[v.name] ?? v.values[0]}`).join(' · ')
    : null;

  const addToCart = () => {
    const res = cart.add(
      { productId: product.id, slug: product.slug, name: product.name, reference: product.reference,
        image: product.images[0] ?? null, priceSale: product.priceSale, variantLabel },
      quantity,
    );
    if (res.ok) {
      trackMarketEvent('ADD_TO_CART', { productId: product.id, slug: product.slug, category: product.category.slug });
      setAdded(true);
      window.setTimeout(() => setAdded(false), 2000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      <Link to="/boutique" className="text-sm text-brand-text-muted hover:text-brand-accent">← Boutique</Link>
      <div className="grid lg:grid-cols-2 gap-8 mt-6">
        <div>
          <div className="rounded-2xl border border-brand-border bg-brand-bg aspect-square overflow-hidden flex items-center justify-center">
            <ProductImage src={product.images[image]} alt={product.name} className="w-full h-full object-cover" iconClassName="w-16 h-16 text-brand-text-muted/40" />
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 mt-3">
              {product.images.map((src, i) => (
                <button key={src + i} type="button" onClick={() => setImage(i)} className={`w-16 h-16 rounded-xl overflow-hidden border-2 ${i === image ? 'border-brand-accent' : 'border-transparent'}`} aria-label={`Photo ${i + 1}`}>
                  <ProductImage src={src} alt="" className="w-full h-full object-cover" iconClassName="w-5 h-5 text-brand-text-muted/40" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">{product.category.name} · Réf. {product.reference}</span>
          <h1 className="font-heading text-3xl font-bold mt-2">{product.name}</h1>
          <p className="text-3xl font-extrabold text-brand-accent mt-4">{formatPrice(product.priceSale)}</p>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${AVAILABILITY_STYLES[product.availability]}`}>{AVAILABILITY_LABELS[product.availability]}</span>
            {product.delayLabel && <span className="text-brand-text-muted">Délai estimé : {product.delayLabel} (à confirmer)</span>}
          </div>
          {product.description && <p className="text-brand-text-muted leading-relaxed mt-5 whitespace-pre-line">{product.description}</p>}
          {product.specs.length > 0 && (
            <dl className="mt-6 divide-y divide-brand-border border-y border-brand-border text-sm">
              {product.specs.map((s) => (
                <div key={s.label} className="flex justify-between gap-6 py-2.5">
                  <dt className="text-brand-text-muted">{s.label}</dt>
                  <dd className="font-semibold text-right">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {product.variants.length > 0 && (
            <div className="mt-7 space-y-4">
              {product.variants.map((v) => (
                <fieldset key={v.name}>
                  <legend className="text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-2">{v.name}</legend>
                  <div className="flex flex-wrap gap-2">
                    {v.values.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setVariantSel((sel) => ({ ...sel, [v.name]: val }))}
                        aria-pressed={variantSel[v.name] === val}
                        className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                          variantSel[v.name] === val
                            ? 'bg-brand-text text-white border-brand-text'
                            : 'bg-white text-brand-text border-brand-border hover:border-brand-accent'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            {orderable ? (
              <>
                <Button size="lg" variant="outline" className="rounded-full" onClick={addToCart}>
                  {added
                    ? <><Check className="w-5 h-5 mr-2 text-brand-wa" />Ajouté au panier</>
                    : <><ShoppingBag className="w-5 h-5 mr-2" />Ajouter au panier</>}
                </Button>
                <Button asChild size="lg" className="rounded-full">
                  <Link to={`/boutique/commande?product=${encodeURIComponent(product.slug)}${variantLabel ? `&variante=${encodeURIComponent(variantLabel)}` : ''}`}><ShoppingCart className="w-5 h-5 mr-2" />{product.availability === 'PREORDER' ? 'Précommander' : 'Commander'}</Link>
                </Button>
              </>
            ) : (
              <Button size="lg" variant="outline" className="rounded-full" disabled>Indisponible</Button>
            )}
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <a href={getWALink(`Bonjour Fika Market 👋\nJ'ai une question sur : ${product.name} (réf. ${product.reference}).`)} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-5 h-5 mr-2" />Poser une question</a>
            </Button>
          </div>
          {orderable && (
            <div className="mt-5 flex items-center gap-3">
              <span className="text-sm font-semibold" id="qty-label">Quantité</span>
              <div className="flex items-center rounded-full border border-brand-border bg-white" aria-labelledby="qty-label">
                <button type="button" aria-label="Réduire la quantité" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center rounded-l-full hover:bg-brand-bg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"><Minus className="w-4 h-4" /></button>
                <span aria-live="polite" className="w-10 text-center font-bold">{quantity}</span>
                <button type="button" aria-label="Augmenter la quantité" onClick={() => setQuantity((q) => Math.min(20, q + 1))} className="w-10 h-10 flex items-center justify-center rounded-r-full hover:bg-brand-bg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          )}
          <p className="text-xs text-brand-text-muted mt-4">Le prix final (produit + livraison) vous est confirmé avant tout paiement. Annulation et remboursement possibles avant l'approvisionnement.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Commande ---------------------------------- */

/** Paramètre d'URL : vrais chemins (location.search) puis repli sur l'ancien format hash. */
function queryParam(name: string): string | null {
  const fromSearch = new URLSearchParams(location.search).get(name);
  if (fromSearch) return fromSearch;
  return new URLSearchParams((location.hash.split('?')[1] ?? '').split('#')[0]).get(name);
}

export function MarketOrderPage() {
  const [product, setProduct] = useState<MarketProductPublic | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [values, setValues] = useState({ name: '', phone: '', zoneName: '', address: '', notes: '', consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ orderNumber: string } | null>(null);

  // Lu à chaque rendu (pas de useMemo) : un retour/avant entre deux URLs de
  // commande doit relire la variante, sinon un choix périmé partirait en base.
  const slug = queryParam('product');
  const presetVariant = queryParam('variante');
  const fromCart = !slug;
  useEffect(() => {
    if (slug) {
      fetch(`/api/market/product/${encodeURIComponent(slug)}`)
        .then(async (res) => (res.ok ? (await res.json()) as MarketProductPublic : null))
        .then((p) => setProduct(p));
    } else {
      setCartItems(cart.items()); // mode panier : référence du panier au moment de l'ouverture
    }
  }, [slug]);

  if (done) return (
    <div className="max-w-xl mx-auto px-5 py-16 text-center">
      <CheckCircle2 className="w-10 h-10 text-brand-wa mx-auto mb-5" />
      <h1 className="font-heading text-3xl font-bold">Votre demande est envoyée.</h1>
      <p className="text-brand-text-muted mt-4">Fika vérifie la disponibilité, puis vous communique le <strong>prix final et le délai</strong>. Rien n'est engagé avant votre accord.</p>
      <p className="mt-6 inline-flex flex-col gap-1 items-center bg-brand-bg border border-brand-border rounded-2xl px-6 py-4">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-text-muted">Votre référence</span>
        <strong className="font-mono text-xl tracking-widest text-brand-accent">{done.orderNumber}</strong>
      </p>
      <p className="text-sm text-brand-text-muted mt-4">Conservez cette référence : elle facilite nos échanges. Fika vous contacte dès que possible.</p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Button asChild variant="outline"><Link to="/boutique">Continuer mes achats</Link></Button>
      </div>
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({}); setError('');
    const items = fromCart
      ? cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity, variantLabel: i.variantLabel ?? undefined }))
      : product ? [{ productId: product.id, quantity, variantLabel: presetVariant ?? undefined }] : [];
    if (items.length === 0) { setError(fromCart ? 'Votre panier est vide.' : 'Produit introuvable.'); return; }
    const next: Record<string, string> = {};
    if (values.name.trim().length < 2) next.name = 'Votre nom est requis.';
    if (!/^(\+?237)?\s*6\d{8}$/.test(values.phone.replace(/[\s.-]/g, ''))) next.phone = 'Numéro invalide : 6 XX XX XX XX.';
    if (values.zoneName.trim().length < 2) next.zoneName = 'Indiquez votre quartier.';
    if (!values.consent) next.consent = 'Votre accord est nécessaire pour être recontacté.';
    if (Object.keys(next).length) { setErrors(next); return; }
    setPending(true);
    trackMarketEvent('CHECKOUT_STARTED', product ? { productId: product.id, slug: product.slug } : {});
    try {
      const res = await fetch('/api/market/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          name: values.name.trim(), phone: values.phone.trim(), zoneName: values.zoneName.trim(),
          address: values.address.trim() || undefined, notes: values.notes.trim() || undefined,
          consent: true, requestKey: (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); }),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message ?? 'Envoi impossible.');
      if (fromCart) cart.clear();
      setDone({ orderNumber: data.orderNumber });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible. Réessayez.');
    } finally { setPending(false); }
  };

  return (
    <div className="max-w-xl mx-auto px-5 py-10 sm:py-14">
      <Link to={fromCart ? '/boutique/panier' : product ? `/boutique/produit/${product.slug}` : '/boutique'} className="text-sm text-brand-text-muted hover:text-brand-accent">← Retour</Link>
      <h1 className="font-heading text-3xl font-bold mt-3">Votre commande</h1>
      {product && !fromCart && (
        <div className="mt-6 flex items-center gap-4 bg-white border border-brand-border rounded-2xl p-4">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-brand-bg flex items-center justify-center shrink-0">
            <ProductImage src={product.images[0]} alt="" className="w-full h-full object-cover" iconClassName="w-6 h-6 text-brand-text-muted/50" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">{product.name}</p>
            <p className="text-sm text-brand-text-muted">{formatPrice(product.priceSale)} · {AVAILABILITY_LABELS[product.availability]}</p>
            {presetVariant && <p className="text-xs text-brand-text-muted truncate">{presetVariant}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold" aria-label="Quantité">
            <input type="number" min={1} max={20} value={quantity} onChange={(e) => setQuantity(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} className="w-16 rounded-xl border border-brand-border px-3 py-2" />
          </label>
        </div>
      )}
      {fromCart && (
        <div className="mt-6">
          {cartItems.length === 0 ? (
            <div className="bg-white border border-dashed border-brand-border rounded-2xl p-6 text-center">
              <p className="text-brand-text-muted">Votre panier est vide.</p>
              <Button asChild variant="outline" className="mt-4 rounded-full"><Link to="/boutique">Parcourir la boutique</Link></Button>
            </div>
          ) : (
            <ul className="bg-white border border-brand-border rounded-2xl divide-y divide-brand-border">
              {cartItems.map((i) => (
                <li key={i.productId + (i.variantLabel ?? '')} className="flex items-center gap-4 p-4">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-brand-bg flex items-center justify-center shrink-0">
                    <ProductImage src={i.image} alt="" className="w-full h-full object-cover" iconClassName="w-5 h-5 text-brand-text-muted/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{i.name}</p>
                    <p className="text-sm text-brand-text-muted truncate">
                      {formatPrice(i.priceSale)} × {i.quantity}{i.variantLabel ? ` · ${i.variantLabel}` : ''}
                    </p>
                  </div>
                  <p className="font-bold whitespace-nowrap">{formatPrice(i.priceSale * i.quantity)}</p>
                </li>
              ))}
            </ul>
          )}
          {cartItems.length > 0 && (
            <p className="text-xs text-brand-text-muted mt-3">
              Total indicatif : <strong>{formatPrice(cartItems.reduce((t, i) => t + i.priceSale * i.quantity, 0))}</strong> · <Link to="/boutique/panier" className="underline hover:text-brand-accent">Modifier mon panier</Link>
            </p>
          )}
        </div>
      )}
      <form onSubmit={submit} noValidate className="space-y-5 mt-6">
        <Field label="Votre nom" htmlFor="m-name" required error={errors.name}><Input id="m-name" autoComplete="name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} maxLength={80} required /></Field>
        <Field label="Votre téléphone / WhatsApp" htmlFor="m-phone" required error={errors.phone}><Input id="m-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="6 XX XX XX XX" value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} maxLength={32} required /></Field>
        <Field label="Quartier" htmlFor="m-zone" required error={errors.zoneName}><Input id="m-zone" placeholder="Quartier à Ngaoundéré" value={values.zoneName} onChange={(e) => setValues({ ...values, zoneName: e.target.value })} maxLength={160} required /></Field>
        <Field label="Repère précis (facultatif)" htmlFor="m-address"><Input id="m-address" value={values.address} onChange={(e) => setValues({ ...values, address: e.target.value })} maxLength={200} /></Field>
        <Field label="Notes (facultatif)" htmlFor="m-notes"><Textarea id="m-notes" rows={3} value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} maxLength={1000} /></Field>
        <label className="flex items-start gap-3 py-2 text-sm">
          <input type="checkbox" className="mt-1 w-5 h-5 accent-brand-accent" checked={values.consent} onChange={(e) => setValues({ ...values, consent: e.target.checked })} />
          <span>J'accepte d'être recontacté pour confirmer le prix final et le délai avant tout paiement. <Link to="/confidentialite" className="underline">Confidentialité</Link></span>
        </label>
        {errors.consent && <p role="alert" className="text-red-700 text-sm">{errors.consent}</p>}
        {error && <p role="alert" className="rounded-xl p-4 bg-red-50 text-red-700">{error}</p>}
        <Button type="submit" size="lg" className="w-full rounded-xl" disabled={pending || (fromCart ? cartItems.length === 0 : !product)}>
          {pending ? 'Envoi en cours…' : 'Envoyer ma demande de commande'}
        </Button>
        <p className="text-xs text-brand-text-muted text-center">Aucun paiement maintenant. Prix et délai confirmés d'abord.</p>
      </form>
    </div>
  );
}

/* -------------------------------- Panier ----------------------------------- */

/**
 * Panier Fika Market — quantités, suppression, total indicatif. Les prix
 * affichés sont indicatifs : le devis est confirmé avant tout paiement.
 */
export function MarketCartPage() {
  useEffect(() => { trackMarketEvent('CART_VIEWED'); }, []);
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(cart.items());
    return cart.subscribe(() => setItems(cart.items()));
  }, []);

  const total = items.reduce((t, i) => t + i.priceSale * i.quantity, 0);
  const count = items.reduce((t, i) => t + i.quantity, 0);

  return (
    <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
      <Link to="/boutique" className="text-sm text-brand-text-muted hover:text-brand-accent">← Boutique</Link>
      <h1 className="font-heading text-3xl font-bold mt-3">Mon panier</h1>

      {items.length === 0 ? (
        <div className="mt-8 text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-brand-border">
          <ShoppingBag className="w-10 h-10 mx-auto text-brand-text-muted/50 mb-4" />
          <h2 className="font-heading font-bold text-lg">Votre panier est vide</h2>
          <p className="text-sm text-brand-text-muted mt-2 max-w-md mx-auto">
            Vous n'avez aucun article pour l'instant. Vous cherchez un produit précis ? Décrivez-le : nous vérifions sa disponibilité et son prix avant tout engagement.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button asChild className="rounded-full"><Link to="/demande-produit">Demander un produit</Link></Button>
            <Button asChild variant="outline" className="rounded-full"><Link to="/boutique">Explorer la boutique</Link></Button>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-8 bg-white border border-brand-border rounded-2xl divide-y divide-brand-border">
            {items.map((i) => {
              const key = `${i.productId}|${i.variantLabel ?? ''}`;
              return (
                <li key={key} className="flex items-center gap-4 p-4">
                  <Link to={`/boutique/produit/${i.slug}`} className="w-16 h-16 rounded-xl overflow-hidden bg-brand-bg flex items-center justify-center shrink-0" aria-label={i.name}>
                    {i.image ? <img src={i.image} alt="" className="w-full h-full object-cover" /> : <PackageSearch className="w-6 h-6 text-brand-text-muted/50" />}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/boutique/produit/${i.slug}`} className="font-bold truncate hover:text-brand-accent">{i.name}</Link>
                    <p className="text-xs text-brand-text-muted">Réf. {i.reference}</p>
                    {i.variantLabel && <p className="text-xs text-brand-text-muted truncate">{i.variantLabel}</p>}
                    <p className="text-sm text-brand-text-muted mt-1">{formatPrice(i.priceSale)} l'unité</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center rounded-full border border-brand-border" aria-label={`Quantité pour ${i.name}`}>
                      <button type="button" aria-label="Réduire la quantité" onClick={() => cart.setQuantity(key, i.quantity - 1)} className="w-9 h-9 flex items-center justify-center rounded-l-full hover:bg-brand-bg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"><Minus className="w-4 h-4" /></button>
                      <span className="w-9 text-center font-bold text-sm">{i.quantity}</span>
                      <button type="button" aria-label="Augmenter la quantité" onClick={() => cart.setQuantity(key, i.quantity + 1)} className="w-9 h-9 flex items-center justify-center rounded-r-full hover:bg-brand-bg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"><Plus className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold whitespace-nowrap">{formatPrice(i.priceSale * i.quantity)}</p>
                      <button type="button" aria-label={`Retirer ${i.name} du panier`} onClick={() => cart.remove(key)} className="p-2 rounded-xl text-brand-text-muted hover:text-red-600 hover:bg-red-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 bg-white border border-brand-border rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="font-heading font-bold text-lg">Total indicatif</p>
              <p className="font-heading font-bold text-2xl text-brand-accent">{formatPrice(total)}</p>
            </div>
            <p className="text-xs text-brand-text-muted mt-2">
              {count} article{count > 1 ? 's' : ''} · Prix indicatifs. Le prix final (produits + livraison) vous est confirmé par devis <strong>avant</strong> tout paiement.
            </p>
            <Button asChild size="lg" className="w-full rounded-full mt-5"><Link to="/boutique/commande">Envoyer ma demande de commande</Link></Button>
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <Link to="/boutique" className="text-brand-text-muted hover:text-brand-accent underline underline-offset-4">Continuer mes achats</Link>
              <button type="button" onClick={() => cart.clear()} className="text-brand-text-muted hover:text-red-600 underline underline-offset-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded">Vider le panier</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
