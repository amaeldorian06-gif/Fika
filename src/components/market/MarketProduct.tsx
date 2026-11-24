import { useEffect, useState } from 'react';
import { Check, ChevronRight, Loader2, MessageCircle, Minus, Plus, ShoppingBag, ShoppingCart } from 'lucide-react';
import { Button } from '../ui';
import { Link } from '../../router';
import { AVAILABILITY_LABELS, type MarketProductPublic } from '../../lib/market';
import { cart } from '../../lib/cart';
import { trackMarketEvent } from '../../lib/market-analytics';
import { getWALink } from '../../lib/whatsapp';
import { AVAILABILITY_STYLES, formatPrice, ProductCard, ProductCardSkeleton, ProductImage, useCatalog } from './shared';

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

  if (state === 'loading') return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-6 sm:px-6 sm:py-10" role="status" aria-label="Chargement de la fiche produit">
      <div className="h-3 w-56 rounded bg-slate-100" />
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="aspect-[4/3] rounded-3xl bg-slate-100" />
          <div className="flex gap-2">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-16 w-16 rounded-xl bg-slate-100" />)}</div>
        </div>
        <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-7">
          <div className="h-3 w-1/3 rounded bg-slate-100" />
          <div className="h-9 w-4/5 rounded bg-slate-100" />
          <div className="h-8 w-2/5 rounded bg-slate-100" />
          <div className="h-16 rounded-2xl bg-slate-100" />
          <div className="h-24 rounded-2xl bg-slate-100" />
          <div className="mt-8 h-12 rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  );
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
    <div className="min-h-screen bg-[#FCFBF9]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-2 text-xs text-brand-text-muted">
          <Link to="/" className="hover:text-brand-accent">Accueil</Link><ChevronRight className="h-3 w-3" aria-hidden="true" />
          <Link to="/boutique" className="hover:text-brand-accent">Boutique</Link><ChevronRight className="h-3 w-3" aria-hidden="true" />
          <Link to={"/boutique/categorie/" + product.category.slug} className="hover:text-brand-accent">{product.category.name}</Link>
          {product.subcategory && <><ChevronRight className="h-3 w-3" aria-hidden="true" /><Link to={"/boutique/categorie/" + product.subcategory.slug} className="hover:text-brand-accent">{product.subcategory.name}</Link></>}
          <ChevronRight className="h-3 w-3" aria-hidden="true" /><span className="max-w-[220px] truncate font-bold text-slate-800">{product.name}</span>
        </nav>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] lg:gap-10">
          {/* Galerie photo */}
          <div className="space-y-3 lg:sticky lg:top-32">
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl border border-brand-border bg-[#F0EEEA] shadow-sm">
              <ProductImage src={product.images[image]} alt={product.name} loading="eager" className="h-full w-full object-contain" iconClassName="h-16 w-16 text-brand-text-muted/35" />
              <span className={"absolute left-4 top-4 rounded-full border bg-white/95 px-3 py-1.5 text-[10px] font-extrabold shadow-sm " + AVAILABILITY_STYLES[product.availability]}>{AVAILABILITY_LABELS[product.availability]}</span>
              {product.popular && <span className="absolute right-4 top-4 rounded-full bg-slate-900/90 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white">Sélection Fika</span>}
            </div>
            {product.images.length > 1 && (
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                {product.images.map((src, i) => (
                  <button key={src + i} type="button" onClick={() => setImage(i)} aria-label={"Afficher la photo " + (i + 1)} aria-pressed={i === image}
                    className={"aspect-square overflow-hidden rounded-xl border-2 bg-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent " + (i === image ? "border-brand-accent shadow-sm" : "border-transparent hover:border-slate-300")}>
                    <ProductImage src={src} alt="" className="h-full w-full object-cover" iconClassName="h-4 w-4 text-slate-300" />
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-brand-border bg-white p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Référence</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{product.reference}</p>
              </div>
              <div className="rounded-2xl border border-brand-border bg-white p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Catégorie</p>
                <p className="mt-1 truncate text-xs font-bold text-slate-700">{product.category.name}</p>
              </div>
            </div>
          </div>

          {/* Informations et achat */}
          <div className="rounded-3xl border border-brand-border bg-white p-5 shadow-[0_14px_50px_-36px_rgba(25,24,23,0.35)] sm:p-7">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-accent">
              {product.category.name}{product.subcategory ? " · " + product.subcategory.name : ""}{product.brand ? " · " + product.brand : ""}
            </p>
            <h1 className="mt-3 font-heading text-2xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl">{product.name}</h1>
            {product.shortDescription && <p className="mt-3 text-sm leading-relaxed text-slate-600">{product.shortDescription}</p>}

            <div className="mt-6 rounded-2xl bg-[#F8F6F3] p-4 sm:p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Prix affiché</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight text-brand-accent">{formatPrice(product.priceSale)}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Le prix définitif et les frais de livraison sont confirmés avant tout paiement.</p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={"rounded-full border px-3 py-1.5 text-[11px] font-extrabold " + AVAILABILITY_STYLES[product.availability]}>{AVAILABILITY_LABELS[product.availability]}</span>
              {product.delayLabel && <span className="text-xs text-slate-500">Délai indicatif : {product.delayLabel}</span>}
            </div>
            {product.availability === 'PREORDER' && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
                <strong>Produit sur commande.</strong> Fika vérifie l’approvisionnement et vous confirme le délai ainsi que le prix final avant tout paiement.
              </div>
            )}

            {product.description && (
              <div className="mt-6">
                <h2 className="font-heading text-sm font-extrabold text-slate-900">Description</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{product.description}</p>
              </div>
            )}

            {product.specs.length > 0 && (
              <div className="mt-6">
                <h2 className="font-heading text-sm font-extrabold text-slate-900">Caractéristiques</h2>
                <dl className="mt-3 divide-y divide-slate-100 border-y border-slate-100 text-sm">
                  {product.specs.map((spec) => (
                    <div key={spec.label} className="flex items-start justify-between gap-6 py-3">
                      <dt className="text-slate-500">{spec.label}</dt><dd className="text-right font-bold text-slate-800">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {product.variants.length > 0 && (
              <div className="mt-6 space-y-4">
                {product.variants.map((variant) => (
                  <fieldset key={variant.name}>
                    <legend className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">{variant.name}</legend>
                    <div className="flex flex-wrap gap-2">
                      {variant.values.map((value) => (
                        <button key={value} type="button" onClick={() => setVariantSel((selected) => ({ ...selected, [variant.name]: value }))}
                          aria-pressed={variantSel[variant.name] === value}
                          className={"rounded-full border px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent " + (variantSel[variant.name] === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-accent")}>
                          {value}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            )}

            {orderable && (
              <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <span className="text-sm font-bold text-slate-700" id="qty-label">Quantité</span>
                <div className="flex items-center rounded-full border border-slate-200 bg-slate-50" aria-labelledby="qty-label">
                  <button type="button" aria-label="Réduire la quantité" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex h-10 w-10 items-center justify-center rounded-l-full hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"><Minus className="h-4 w-4" /></button>
                  <span aria-live="polite" className="w-9 text-center text-sm font-extrabold">{quantity}</span>
                  <button type="button" aria-label="Augmenter la quantité" onClick={() => setQuantity((q) => Math.min(20, q + 1))} className="flex h-10 w-10 items-center justify-center rounded-r-full hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {orderable ? (
                <>
                  <Button size="lg" variant="outline" className="rounded-full" onClick={addToCart}>
                    {added ? <><Check className="mr-2 h-5 w-5 text-brand-wa" />Ajouté au panier</> : <><ShoppingBag className="mr-2 h-5 w-5" />Ajouter au panier</>}
                  </Button>
                  <Button asChild size="lg" className="rounded-full">
                    <Link to={"/boutique/commande?product=" + encodeURIComponent(product.slug) + (variantLabel ? "&variante=" + encodeURIComponent(variantLabel) : "")}>
                      <ShoppingCart className="mr-2 h-5 w-5" />{product.availability === 'PREORDER' ? 'Précommander' : 'Commander'}
                    </Link>
                  </Button>
                </>
              ) : <Button size="lg" variant="outline" className="rounded-full" disabled>Indisponible</Button>}
              <Button asChild size="lg" variant="outline" className="rounded-full sm:col-span-2">
                <a href={getWALink("Bonjour Fika Market 👋\nJ'ai une question sur : " + product.name + " (réf. " + product.reference + ").")} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-5 w-5" />Poser une question</a>
              </Button>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">Le prix final (produit + livraison) vous est confirmé avant tout paiement. Annulation et remboursement possibles avant l’approvisionnement.</p>
          </div>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="related" className="mt-14">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-accent">Vous pourriez aussi aimer</p><h2 id="related" className="mt-1 font-heading text-xl font-extrabold text-slate-900 sm:text-2xl">Dans la même catégorie</h2></div>
              <Link to={"/boutique/categorie/" + product.category.slug} className="shrink-0 text-xs font-bold text-brand-accent hover:underline">Voir la catégorie <ChevronRight className="inline h-4 w-4" /></Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
              {related.map((item) => <ProductCard key={item.id} product={item} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
