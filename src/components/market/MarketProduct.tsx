import { useEffect, useState } from 'react';
import { Check, ChevronRight, Loader2, MessageCircle, Minus, Plus, ShoppingBag, ShoppingCart } from 'lucide-react';
import { Button } from '../ui';
import { Link } from '../../router';
import { AVAILABILITY_LABELS, type MarketProductPublic } from '../../lib/market';
import { cart } from '../../lib/cart';
import { trackMarketEvent } from '../../lib/market-analytics';
import { getWALink } from '../../lib/whatsapp';
import { AVAILABILITY_STYLES, formatPrice, ProductCard, ProductImage, useCatalog } from './shared';

/**
 * Fiche produit — fil d'Ariane (catégorie, sous-catégorie), marque, variante,
 * modalités « sur commande » explicites, recommandations de la même catégorie.
 */
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

  // Recommandations : produits de la même catégorie (jamais de données inventées).
  const { data: catData } = useCatalog(product?.category.slug);
  const related = product && catData
    ? catData.products.filter((p) => p.id !== product.id).slice(0, 4)
    : [];

  if (state === 'loading') return <div className="min-h-[50vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-accent" /></div>;
  if (state === 'missing' || !product) return (
    <div className="max-w-xl mx-auto px-5 py-20 text-center">
      <h1 className="font-heading text-2xl font-bold">Produit introuvable</h1>
      <p className="text-brand-text-muted mt-3">Ce produit n’est plus au catalogue.</p>
      <Button asChild className="mt-6"><Link to="/boutique/tous">Voir tous les produits</Link></Button>
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
      {/* Fil d'Ariane : Accueil / Boutique / Catégorie [ / Sous-catégorie ] / Produit */}
      <nav aria-label="Fil d'Ariane" className="text-xs text-brand-text-muted flex flex-wrap items-center gap-1">
        <Link to="/" className="hover:text-brand-accent">Accueil</Link> <span aria-hidden="true">/</span>{' '}
        <Link to="/boutique" className="hover:text-brand-accent">Boutique</Link> <span aria-hidden="true">/</span>{' '}
        <Link to={`/boutique/categorie/${product.category.slug}`} className="hover:text-brand-accent">{product.category.name}</Link>
        {product.subcategory && (<><span aria-hidden="true">/</span>{' '}<Link to={`/boutique/categorie/${product.subcategory.slug}`} className="hover:text-brand-accent">{product.subcategory.name}</Link></>)}
        <span aria-hidden="true">/</span>{' '}
        <span className="font-semibold text-brand-text">{product.name}</span>
      </nav>
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
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">
            {product.category.name}{product.subcategory ? ` · ${product.subcategory.name}` : ''}{product.brand ? ` · ${product.brand}` : ''} · Réf. {product.reference}
          </span>
          <h1 className="font-heading text-3xl font-bold mt-2">{product.name}</h1>
          <p className="text-3xl font-extrabold text-brand-accent mt-4">{formatPrice(product.priceSale)}</p>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${AVAILABILITY_STYLES[product.availability]}`}>{AVAILABILITY_LABELS[product.availability]}</span>
            {product.delayLabel && <span className="text-brand-text-muted">Délai estimé : {product.delayLabel} (à confirmer)</span>}
          </div>
          {product.availability === 'PREORDER' && (
            <p className="mt-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 leading-relaxed">
              <strong>Produit sur commande :</strong> Fika l'approvisionne après votre demande. Le délai et le prix final vous sont confirmés <strong>avant</strong> tout paiement.
            </p>
          )}
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

      {/* Recommandations — même catégorie, produits réels uniquement */}
      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-14">
          <h2 id="related" className="font-heading text-xl font-bold mb-4">Dans la même catégorie <ChevronRight className="w-5 h-5 inline text-brand-text-muted" aria-hidden="true" /></h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
