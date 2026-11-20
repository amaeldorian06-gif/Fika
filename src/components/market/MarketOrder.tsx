import { useEffect, useState } from 'react';
import { CheckCircle2, Minus, PackageSearch, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Button } from '../ui';
import { Field, Input, Textarea } from '../forms';
import { Link } from '../../router';
import { AVAILABILITY_LABELS, type MarketProductPublic } from '../../lib/market';
import { cart, type CartItem } from '../../lib/cart';
import { trackMarketEvent } from '../../lib/market-analytics';
import { formatPrice, ProductImage } from './shared';

/**
 * Commande Fika Market — demande simple (produit ou panier) : le prix final
 * est TOUJOURS confirmé par devis avant paiement. Checkout volontairement
 * simple (interdiction de complexifier, CDC §17).
 */

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
