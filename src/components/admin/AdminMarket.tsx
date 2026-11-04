import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, ImagePlus, Loader2, Pencil, Plus, Search, ShoppingCart, Store, Tag, Truck, X,
} from 'lucide-react';
import { EmptyState } from './AdminShell';
import { Link } from '../../router';
import { Button } from '../ui';
import { Field, Input, Select, Textarea } from '../forms';
import { formatPriceFCFA } from '../../lib/pricing';
import { AVAILABILITY_LABELS, MARKET_STATUS_LABELS, MARKET_TRANSITIONS, type MarketOrderStatus } from '../../lib/market';
import {
  assignMarketItem, fetchMarketBatches, fetchMarketCatalogAdmin, fetchMarketOrder, fetchMarketOrders,
  fetchMarketOverview, recordMarketPayment, reviewMarketPayment, saveMarketCategory, saveMarketDelivery,
  saveMarketProduct, saveMarketSupplier, confirmMarketPrice, saveMarketBatch, updateMarketBatchStatus,
  updateMarketOrderStatus, uploadProductImage,
  type MarketBatchStatus, type MarketCategoryDto, type MarketDeliveryStatus,
  type MarketOrderDetailDto, type MarketOrderSummaryDto, type MarketProductDto,
  type MarketSupplierDto,
} from '../../lib/admin/market-api';

/**
 * Back-office Fika Market : pilotage (KPIs), catalogue (produits, catégories,
 * fournisseurs), commandes et approvisionnements. Aucune donnée fictive : les
 * états vides sont affichés tels quels.
 */

/* ------------------------------- Utilitaires ------------------------------- */

function Loading() {
  return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-brand-accent" aria-label="Chargement" /></div>;
}

function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
    <p>{message}</p>
    <button type="button" onClick={retry} className="mt-3 font-bold underline">Réessayer</button>
  </div>;
}

const dateFr = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const dateTimeFr = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true); setLoadError(null);
    loader().then((res) => { if (!alive) return; setData(res); setLoading(false); })
      .catch(() => { if (!alive) return; setData(null); setLoadError('Impossible de charger les données. Vérifiez la connexion et la disponibilité du serveur.'); setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, loading, loadError, reload: () => setTick((t) => t + 1) };
}

/** Petit bandeau d'action : affiche l'erreur serveur ou le succès récent. */
function useActionBanner() {
  const [state, setState] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const run = async (action: () => Promise<unknown>, success: string) => {
    setState(null);
    try {
      await action();
      setState({ kind: 'success', text: success });
      return true;
    } catch (e) {
      setState({ kind: 'error', text: e instanceof Error ? e.message : 'Opération refusée.' });
      return false;
    }
  };
  const banner = state && (
    <p role="status" className={`rounded-xl p-3 text-sm font-medium ${state.kind === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
      {state.text}
    </p>
  );
  return { run, banner };
}

/* ------------------------------ Vue pilotage ------------------------------- */

function KpiCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="bg-brand-surface p-5 rounded-2xl border border-brand-border shadow-sm">
      <p className="text-xs text-brand-text-muted font-semibold uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-extrabold mt-2 ${accent ? 'text-brand-accent' : 'text-brand-text'}`}>{value}</p>
      {hint && <p className="text-xs font-medium text-brand-text-muted mt-1.5">{hint}</p>}
    </div>
  );
}

export function AdminMarketOverview() {
  const { data, loading, loadError, reload } = useAsync(fetchMarketOverview, []);
  if (loading) return <Loading />;
  if (loadError || !data) return <LoadError message={loadError ?? 'Données indisponibles.'} retry={reload} />;
  const b = data.byStatus;
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Marge nette (livrées)" value={data.deliveredMargin != null ? formatPriceFCFA(data.deliveredMargin) : '—'} hint={data.deliveredCount > 0 ? `${data.deliveredCount} commande(s) livrée(s)` : 'Aucune commande livrée'} accent />
        <KpiCard label="Chiffre d'affaires confirmé" value={formatPriceFCFA(data.revenue)} hint={data.avgOrderValue != null ? `Panier moyen : ${formatPriceFCFA(data.avgOrderValue)}` : undefined} />
        <KpiCard label="Cash encaissé" value={formatPriceFCFA(data.cashConfirmed)} hint="Paiements confirmés" />
        <KpiCard label="Produits actifs" value={`${data.activeProducts}`} hint={`${data.availableProducts} en stock local`} />
      </div>

      <div>
        <h2 className="font-heading font-bold text-lg mb-3">Pipeline commandes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
          {([
            ['À traiter', b.requested], ['Confirmées', b.confirmed], ['Appro', b.procuring], ['À livrer', b.toDeliver],
            ['Livrées', b.delivered], ['Retardées', b.delayed], ['Annulées / remboursées', b.cancelled + b.refunded],
          ] as const).map(([label, n]) => (
            <div key={label} className={`rounded-2xl border p-4 ${n > 0 ? 'bg-white border-brand-border' : 'bg-brand-bg border-transparent'}`}>
              <p className="text-2xl font-extrabold">{n}</p>
              <p className="text-xs text-brand-text-muted font-semibold mt-1">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-brand-text-muted mt-3">
          {data.totalRequests} demande(s) au total · conversion {data.conversionRate != null ? `${data.conversionRate} %` : '—'}
        </p>
      </div>

      {data.topProducts.length > 0 && (
        <div>
          <h2 className="font-heading font-bold text-lg mb-3">Produits les plus demandés</h2>
          <ul className="divide-y divide-brand-border bg-white rounded-2xl border border-brand-border">
            {data.topProducts.map((p) => (
              <li key={p.name} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-semibold truncate">{p.name}</span>
                <span className="text-brand-text-muted whitespace-nowrap ml-4">{p.count} demande(s)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Catalogue --------------------------------- */

const emptyProduct = {
  productId: '', name: '', reference: '', categoryId: '', supplierId: '',
  description: '', priceSale: '', supplierPrice: '', estimatedLandedCost: '',
  delayLabel: '', availability: 'PREORDER', active: true, popular: false,
  images: '', specs: '',
};

type ProductForm = typeof emptyProduct;

function parseImages(raw: string): string[] {
  return raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
}

function parseSpecs(raw: string): { label: string; value: string }[] {
  return raw.split('\n').map((line) => {
    const [label, ...rest] = line.split(':');
    return { label: (label ?? '').trim(), value: rest.join(':').trim() };
  }).filter((s) => s.label && s.value).slice(0, 12);
}

function ProductDialog({ product, categories, suppliers, onSaved, onClose }: {
  product: MarketProductDto | null;
  categories: MarketCategoryDto[];
  suppliers: MarketSupplierDto[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ProductForm>(() => product ? {
    productId: product.id, name: product.name, reference: product.reference,
    categoryId: product.categoryId, supplierId: product.supplierId ?? '',
    description: product.description ?? '', priceSale: String(product.priceSale),
    supplierPrice: String(product.supplierPrice), estimatedLandedCost: String(product.estimatedLandedCost),
    delayLabel: product.delayLabel ?? '', availability: product.availability,
    active: product.active, popular: product.popular,
    images: product.images.join('\n'),
    specs: product.specs.map((s) => `${s.label}: ${s.value}`).join('\n'),
  } : { ...emptyProduct, categoryId: categories[0]?.id ?? '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [imgError, setImgError] = useState('');

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const removeImage = (url: string) => set('images', parseImages(form.images).filter((u) => u !== url).join('\n'));

  /** Téléversement des photos sélectionnées → URLs ajoutées au champ images. */
  const onPickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // permet de re-sélectionner le même fichier après une erreur
    if (files.length === 0) return;
    setImgError('');
    const current = parseImages(form.images);
    const room = 6 - current.length;
    if (room <= 0) { setImgError('6 photos maximum par produit : retirez-en une d’abord.'); return; }
    if (files.length > room) setImgError(`6 photos maximum : seules les ${room} première(s) ont été envoyées.`);
    setImgUploading(true);
    try {
      const urls: string[] = [];
      for (const f of files.slice(0, room)) urls.push((await uploadProductImage(f)).url);
      set('images', [...current, ...urls].join('\n'));
    } catch (err) {
      setImgError(err instanceof Error ? err.message : 'Envoi de l’image impossible.');
    } finally { setImgUploading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.categoryId) { setError('Choisissez une catégorie (créez-en une d’abord si nécessaire).'); return; }
    setPending(true);
    try {
      await saveMarketProduct({
        productId: form.productId || undefined,
        name: form.name.trim(), reference: form.reference.trim(), categoryId: form.categoryId,
        supplierId: form.supplierId || null,
        description: form.description.trim() || undefined,
        specs: parseSpecs(form.specs), images: parseImages(form.images),
        priceSale: Number(form.priceSale),
        supplierPrice: Number(form.supplierPrice || 0),
        estimatedLandedCost: Number(form.estimatedLandedCost || 0),
        delayLabel: form.delayLabel.trim() || undefined,
        availability: form.availability as MarketProductDto['availability'],
        active: form.active, popular: form.popular,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally { setPending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label={product ? 'Modifier le produit' : 'Nouveau produit'}>
      <form onSubmit={submit} noValidate className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-4 my-8">
        <h2 className="font-heading text-xl font-bold">{product ? 'Modifier le produit' : 'Nouveau produit'}</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nom du produit" htmlFor="p-name" required error={form.name.trim().length < 2 ? 'Nom requis.' : undefined}>
            <Input id="p-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} required />
          </Field>
          <Field label="Référence" htmlFor="p-ref" required hint="Unique, ex. FK-MKT-001">
            <Input id="p-ref" value={form.reference} onChange={(e) => set('reference', e.target.value)} maxLength={40} required />
          </Field>
          <Field label="Catégorie" htmlFor="p-cat" required>
            <Select id="p-cat" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Fournisseur" htmlFor="p-sup">
            <Select id="p-sup" value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
              <option value="">— Aucun —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Description publique" htmlFor="p-desc"><Textarea id="p-desc" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={3000} /></Field>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Prix de vente (F)" htmlFor="p-price" required><Input id="p-price" type="number" min={100} value={form.priceSale} onChange={(e) => set('priceSale', e.target.value)} required /></Field>
          <Field label="Prix fournisseur (F)" htmlFor="p-supprice" hint="Interne"><Input id="p-supprice" type="number" min={0} value={form.supplierPrice} onChange={(e) => set('supplierPrice', e.target.value)} /></Field>
          <Field label="Coût rendu estimé (F)" htmlFor="p-landed" hint="Interne"><Input id="p-landed" type="number" min={0} value={form.estimatedLandedCost} onChange={(e) => set('estimatedLandedCost', e.target.value)} /></Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Disponibilité" htmlFor="p-avail">
            <Select id="p-avail" value={form.availability} onChange={(e) => set('availability', e.target.value)}>
              {Object.entries(AVAILABILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Délai estimé (affiché)" htmlFor="p-delay" hint="Jamais promis sans vérification">
            <Input id="p-delay" value={form.delayLabel} onChange={(e) => set('delayLabel', e.target.value)} placeholder="ex. 2 à 3 semaines" maxLength={120} />
          </Field>
        </div>
        <Field label="Photos du produit (max 6)" htmlFor="p-img" hint="Téléversez depuis l’appareil ou collez une URL par ligne">
          {parseImages(form.images).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {parseImages(form.images).map((url, i) => (
                <span key={url} className="relative">
                  <img src={url} alt="" loading="lazy" className="w-16 h-16 object-cover rounded-lg border border-brand-border bg-brand-bg" />
                  <button type="button" aria-label={`Retirer la photo ${i + 1}`} onClick={() => removeImage(url)} className="absolute -top-1.5 -right-1.5 bg-white border border-brand-border rounded-full p-0.5 shadow-sm cursor-pointer hover:bg-red-50">
                    <X className="w-3.5 h-3.5 text-brand-text" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <label className={`inline-flex items-center gap-2 rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold mb-2 ${imgUploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer hover:bg-brand-bg'}`}>
            {imgUploading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="w-4 h-4" aria-hidden="true" />}
            {imgUploading ? 'Envoi en cours…' : 'Ajouter des photos'}
            <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" multiple onChange={onPickImages} disabled={imgUploading} />
          </label>
          {imgError && <p role="alert" className="text-xs text-red-700 mb-1">{imgError}</p>}
          <Textarea id="p-img" rows={2} value={form.images} onChange={(e) => set('images', e.target.value)} />
        </Field>
        <Field label="Caractéristiques (max 12)" htmlFor="p-specs" hint="Une par ligne : Étiquette: valeur">
          <Textarea id="p-specs" rows={3} value={form.specs} onChange={(e) => set('specs', e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-6 text-sm font-semibold">
          <label className="flex items-center gap-2"><input type="checkbox" className="w-4 h-4 accent-brand-accent" checked={form.active} onChange={(e) => set('active', e.target.checked)} />Visible dans la boutique</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="w-4 h-4 accent-brand-accent" checked={form.popular} onChange={(e) => set('popular', e.target.checked)} />Mettre en avant</label>
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-3 text-sm">{error}</p>}
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={pending}>{pending ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </div>
      </form>
    </div>
  );
}

export function AdminMarketCatalog() {
  const { data, loading, loadError, reload } = useAsync(fetchMarketCatalogAdmin, []);
  const [dialog, setDialog] = useState<'product' | 'category' | 'supplier' | null>(null);
  const [editing, setEditing] = useState<MarketProductDto | null>(null);
  const { run, banner } = useActionBanner();

  const [catForm, setCatForm] = useState({ id: '', name: '', position: '0', active: true });
  const [supForm, setSupForm] = useState({ id: '', name: '', contact: '', note: '', active: true });

  if (loading) return <Loading />;
  if (loadError || !data) return <LoadError message={loadError ?? 'Données indisponibles.'} retry={reload} />;
  const { categories, suppliers, products } = data;

  const toggleProduct = async (p: MarketProductDto) => {
    if (await run(() => saveMarketProduct({
      productId: p.id, name: p.name, reference: p.reference, categoryId: p.categoryId,
      supplierId: p.supplierId, description: p.description ?? undefined,
      specs: p.specs, images: p.images, priceSale: p.priceSale,
      supplierPrice: p.supplierPrice, estimatedLandedCost: p.estimatedLandedCost,
      delayLabel: p.delayLabel ?? undefined, availability: p.availability,
      active: !p.active, popular: p.popular,
    }), p.active ? 'Produit masqué de la boutique.' : 'Produit publié dans la boutique.')) reload();
  };

  return (
    <div className="space-y-8">
      {banner}

      {/* Catégories */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-bold text-lg">Catégories</h2>
          <Button size="sm" variant="outline" onClick={() => { setCatForm({ id: '', name: '', position: '0', active: true }); setDialog('category'); }}><Plus className="w-4 h-4 mr-1" />Catégorie</Button>
        </div>
        {categories.length === 0
          ? <p className="text-sm text-brand-text-muted bg-brand-bg rounded-2xl p-5">Aucune catégorie. Créez-en une pour pouvoir ajouter des produits.</p>
          : <ul className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-2 bg-white border border-brand-border rounded-full pl-4 pr-2 py-1.5 text-sm">
                <Tag className="w-3.5 h-3.5 text-brand-text-muted" />
                <span className="font-semibold">{c.name}</span>
                <span className="text-xs text-brand-text-muted">{products.filter((p) => p.categoryId === c.id).length} produit(s)</span>
                <button type="button" className="p-1 rounded hover:bg-brand-bg" aria-label={`Modifier ${c.name}`}
                  onClick={() => { setCatForm({ id: c.id, name: c.name, position: String(c.position), active: c.active }); setDialog('category'); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>}
      </section>

      {/* Fournisseurs */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-bold text-lg">Fournisseurs</h2>
          <Button size="sm" variant="outline" onClick={() => { setSupForm({ id: '', name: '', contact: '', note: '', active: true }); setDialog('supplier'); }}><Plus className="w-4 h-4 mr-1" />Fournisseur</Button>
        </div>
        {suppliers.length === 0
          ? <p className="text-sm text-brand-text-muted bg-brand-bg rounded-2xl p-5">Aucun fournisseur enregistré.</p>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suppliers.map((s) => (
              <div key={s.id} className="bg-white border border-brand-border rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{s.name}</p>
                    <p className="text-xs text-brand-text-muted">{s.contact ?? 'Contact non renseigné'}</p>
                  </div>
                  <button type="button" className="p-1 rounded hover:bg-brand-bg shrink-0" aria-label={`Modifier ${s.name}`}
                    onClick={() => { setSupForm({ id: s.id, name: s.name, contact: s.contact ?? '', note: s.note ?? '', active: s.active }); setDialog('supplier'); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-brand-text-muted mt-2">{products.filter((p) => p.supplierId === s.id).length} produit(s)</p>
              </div>
            ))}
          </div>}
      </section>

      {/* Produits */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-bold text-lg">Produits ({products.length})</h2>
          <Button size="sm" onClick={() => { setEditing(null); setDialog('product'); }}><Plus className="w-4 h-4 mr-1" />Produit</Button>
        </div>
        {products.length === 0
          ? <EmptyState icon={Store} title="Catalogue vide" description="Ajoutez vos premières catégories puis vos produits : ils apparaîtront immédiatement dans la boutique." />
          : <div className="overflow-x-auto bg-white rounded-2xl border border-brand-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-brand-text-muted border-b border-brand-border">
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Prix vente</th>
                  <th className="px-4 py-3">Marge est.</th>
                  <th className="px-4 py-3">Disponibilité</th>
                  <th className="px-4 py-3">État</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-brand-text-muted">{p.reference} · {p.categoryName}{p.supplierName ? ` · ${p.supplierName}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{formatPriceFCFA(p.priceSale)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={p.estimatedMargin > 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>{formatPriceFCFA(p.estimatedMargin)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">{AVAILABILITY_LABELS[p.availability]}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${p.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-brand-bg text-brand-text-muted border-brand-border'}`}>
                        {p.active ? 'Publié' : 'Masqué'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button type="button" className="p-2 rounded-lg hover:bg-brand-bg" aria-label={`Modifier ${p.name}`} onClick={() => { setEditing(p); setDialog('product'); }}><Pencil className="w-4 h-4" /></button>
                      <button type="button" className="p-2 rounded-lg hover:bg-brand-bg font-bold text-xs px-3" onClick={() => void toggleProduct(p)}>{p.active ? 'Masquer' : 'Publier'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </section>

      {dialog === 'product' && (
        <ProductDialog
          product={editing}
          categories={categories.filter((c) => c.active || editing?.categoryId === c.id)}
          suppliers={suppliers}
          onSaved={() => { setDialog(null); reload(); }}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === 'category' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Catégorie">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => saveMarketCategory({
                id: catForm.id || undefined, name: catForm.name.trim(),
                position: Number(catForm.position || 0), active: catForm.active,
              }), 'Catégorie enregistrée.')) { setDialog(null); reload(); }
            }}
            className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4"
          >
            <h2 className="font-heading text-xl font-bold">{catForm.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h2>
            <Field label="Nom" htmlFor="c-name" required><Input id="c-name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} maxLength={80} required /></Field>
            <Field label="Position (ordre d'affichage)" htmlFor="c-pos"><Input id="c-pos" type="number" min={0} max={99} value={catForm.position} onChange={(e) => setCatForm({ ...catForm, position: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="w-4 h-4 accent-brand-accent" checked={catForm.active} onChange={(e) => setCatForm({ ...catForm, active: e.target.checked }) } />Visible dans la boutique</label>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </div>
      )}

      {dialog === 'supplier' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Fournisseur">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => saveMarketSupplier({
                id: supForm.id || undefined, name: supForm.name.trim(),
                contact: supForm.contact.trim() || undefined, note: supForm.note.trim() || undefined,
                active: supForm.active,
              }), 'Fournisseur enregistré.')) { setDialog(null); reload(); }
            }}
            className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4"
          >
            <h2 className="font-heading text-xl font-bold">{supForm.id ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h2>
            <Field label="Nom" htmlFor="s-name" required><Input id="s-name" value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} maxLength={120} required /></Field>
            <Field label="Contact (interne)" htmlFor="s-contact" hint="Nom / plateforme / lien"><Input id="s-contact" value={supForm.contact} onChange={(e) => setSupForm({ ...supForm, contact: e.target.value })} maxLength={160} /></Field>
            <Field label="Note (interne)" htmlFor="s-note"><Textarea id="s-note" rows={2} value={supForm.note} onChange={(e) => setSupForm({ ...supForm, note: e.target.value })} maxLength={1000} /></Field>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="w-4 h-4 accent-brand-accent" checked={supForm.active} onChange={(e) => setSupForm({ ...supForm, active: e.target.checked })} />Actif</label>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Liste commandes ---------------------------- */

const MARKET_FILTERS = [
  ['', 'Toutes'], ['REQUESTED', 'Demandes'], ['AWAITING_CLIENT', 'Attente client'], ['CONFIRMED', 'Confirmées'],
  ['PROCURING', 'Approvisionnement'], ['toDeliver', 'À livrer'], ['DELIVERED', 'Livrées'], ['EXCEPTION', 'Exceptions'],
] as const;

export function AdminMarketOrders() {
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const { data, loading, loadError, reload } = useAsync(() => fetchMarketOrders({ q }), [q]);

  const orders = useMemo(() => {
    if (!data) return [];
    if (filter === 'toDeliver') return data.filter((o) => ['RECEIVED', 'READY', 'DELIVERING'].includes(o.status));
    if (filter === 'EXCEPTION') return data.filter((o) => ['DELAYED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'SUPPLY_FAILED'].includes(o.status));
    if (!filter) return data;
    if (filter === 'REQUESTED') return data.filter((o) => ['REQUESTED', 'SUPPLIER_CHECK'].includes(o.status));
    return data.filter((o) => o.status === filter);
  }, [data, filter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher : n°, code suivi, nom, téléphone…" className="pl-11" aria-label="Rechercher une commande" />
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1" role="group" aria-label="Filtres">
          {MARKET_FILTERS.map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)}
              className={`px-3.5 py-2 rounded-full text-xs font-bold border whitespace-nowrap ${filter === value ? 'bg-brand-text text-white border-brand-text' : 'bg-white text-brand-text-muted border-brand-border hover:border-brand-accent'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Loading /> : loadError ? <LoadError message={loadError} retry={reload} /> : orders.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="Aucune commande" description="Les demandes clientes arrivent ici dès qu'un client commande dans la boutique." />
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-brand-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-brand-text-muted border-b border-brand-border">
                <th className="px-4 py-3">Commande</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Payé</th>
                <th className="px-4 py-3 text-right">Marge</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {orders.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrderRow({ order: o }: { order: MarketOrderSummaryDto }) {
  const exception = ['DELAYED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'SUPPLY_FAILED'].includes(o.status);
  return (
    <tr className="hover:bg-brand-bg/60">
      <td className="px-4 py-3">
        <p className="font-mono font-bold text-xs">{o.orderNumber}</p>
        <p className="text-xs text-brand-text-muted">{dateFr(o.createdAt)} · {o.itemCount} article(s)</p>
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold">{o.name}</p>
        <p className="text-xs text-brand-text-muted">{o.phone}{o.zoneName ? ` · ${o.zoneName}` : ''}</p>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${exception ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-brand-bg text-brand-text border-brand-border'}`}>
          {o.statusLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{o.total != null ? formatPriceFCFA(o.total) : <span className="text-brand-text-muted font-normal">À confirmer</span>}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {o.paid > 0 ? formatPriceFCFA(o.paid) : <span className="text-brand-text-muted">—</span>}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {o.margin != null
          ? <span className={o.margin >= 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>{formatPriceFCFA(o.margin)}</span>
          : <span className="text-brand-text-muted">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <Link to={`/admin/market/orders/${o.id}`} className="font-bold text-brand-accent hover:underline whitespace-nowrap">Ouvrir →</Link>
      </td>
    </tr>
  );
}

/* --------------------------- Détail commande ------------------------------- */

const BATCH_STATUS_LABELS: Record<MarketBatchStatus, string> = {
  PLANNED: 'Planifié', ORDERED: 'Commandé', SHIPPED: 'Expédié', RECEIVED: 'Reçu', CANCELLED: 'Annulé',
};
const DELIVERY_STATUS_LABELS: Record<MarketDeliveryStatus, string> = {
  PENDING: 'À planifier', SCHEDULED: 'Planifiée', IN_TRANSIT: 'En cours', DELIVERED: 'Livrée', FAILED: 'Échec',
};
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  MTN_MOMO: 'MTN MoMo', ORANGE_MONEY: 'Orange Money', CASH: 'Espèces',
};

export function AdminMarketOrderDetail({ orderId }: { orderId: string }) {
  const { data: order, loading, loadError, reload } = useAsync(() => fetchMarketOrder(orderId), [orderId]);
  const { data: batches } = useAsync(fetchMarketBatches, []);
  const { run, banner } = useActionBanner();
  const [note, setNote] = useState('');

  if (loading) return <Loading />;
  if (loadError || !order) return <LoadError message={loadError ?? 'Commande introuvable.'} retry={reload} />;

  const needsPrice = order.items.some((i) => i.unitPrice == null) || order.deliveryFee == null;
  const openBatches = (batches ?? []).filter((b) => b.status !== 'CANCELLED');
  const act = async (action: () => Promise<unknown>, success: string) => { const ok = await run(action, success); if (ok) reload(); return ok; };

  return (
    <div className="space-y-6">
      {banner}

      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold border ${['DELAYED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'SUPPLY_FAILED'].includes(order.status) ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-brand-bg border-brand-border'}`}>
          {order.statusLabel}
        </span>
        <span className="font-mono font-bold">{order.orderNumber}</span>
        <span className="text-sm text-brand-text-muted">Code suivi : <span className="font-mono">{order.trackCode}</span></span>
        <span className="text-sm text-brand-text-muted">· {dateTimeFr(order.createdAt)}</span>
      </div>

      {/* Client */}
      <section className="bg-white border border-brand-border rounded-2xl p-5">
        <h2 className="font-heading font-bold mb-3">Client</h2>
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-brand-text-muted">Nom</dt><dd className="font-semibold">{order.name}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-brand-text-muted">Téléphone</dt><dd className="font-semibold">{order.phone}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-brand-text-muted">Quartier</dt><dd className="font-semibold">{order.zoneName ?? '—'}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-brand-text-muted">Repère</dt><dd className="font-semibold text-right">{order.address ?? '—'}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-brand-text-muted">Source</dt><dd className="font-semibold">{order.source === 'SHOP' ? 'Boutique en ligne' : order.source}</dd></div>
          {order.notes && <div className="sm:col-span-2"><dt className="text-brand-text-muted">Notes client</dt><dd className="mt-1">{order.notes}</dd></div>}
        </dl>
      </section>

      {/* Prix final */}
      <PricePanel order={order} onSave={act} />

      {/* Paiements */}
      <PaymentPanelMarket order={order} onAct={act} />

      {/* Approvisionnement */}
      <section className="bg-white border border-brand-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-bold">Approvisionnement</h2>
          <Link to="/admin/market/batches" className="text-sm font-bold text-brand-accent hover:underline">Gérer les lots →</Link>
        </div>
        <div className="space-y-3">
          {order.items.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-3 bg-brand-bg rounded-xl p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{i.productName} <span className="text-brand-text-muted">×{i.quantity}</span></p>
                <p className="text-xs text-brand-text-muted">
                  {i.procurementBatchId ? `Lot affecté · coût réel ${i.unitCostReal != null ? formatPriceFCFA(i.unitCostReal) : 'non saisi'}` : 'Non affecté à un lot'}
                </p>
              </div>
              <label className="text-xs font-semibold text-brand-text-muted">Lot
                <Select className="mt-1" value={i.procurementBatchId ?? ''} onChange={(e) => void act(() => assignMarketItem(i.id, e.target.value || null, i.unitCostReal), 'Article affecté au lot.')}>
                  <option value="">— Aucun —</option>
                  {openBatches.map((b) => <option key={b.id} value={b.id}>{b.reference} · {BATCH_STATUS_LABELS[b.status]}</option>)}
                </Select>
              </label>
              <label className="text-xs font-semibold text-brand-text-muted">Coût réel unitaire (F)
                <Input className="mt-1 w-36" type="number" min={0} defaultValue={i.unitCostReal ?? ''} onBlur={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value);
                  if (v !== i.unitCostReal) void act(() => assignMarketItem(i.id, i.procurementBatchId, v), 'Coût réel enregistré.');
                }} />
              </label>
            </div>
          ))}
          {openBatches.length === 0 && <p className="text-sm text-brand-text-muted">Aucun lot ouvert. Créez un lot dans « Approvisionnements » pour suivre un achat groupé.</p>}
        </div>
      </section>

      {/* Livraison */}
      <DeliveryPanel order={order} onAct={act} />

      {/* Historique + transitions */}
      <section className="bg-white border border-brand-border rounded-2xl p-5">
        <h2 className="font-heading font-bold mb-3">Faire avancer la commande</h2>
        {(MARKET_TRANSITIONS[order.status as MarketOrderStatus] ?? []).length === 0 ? (
          <p className="text-sm text-brand-text-muted">Aucune transition disponible depuis ce statut.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(MARKET_TRANSITIONS[order.status as MarketOrderStatus] ?? []).map((to) => (
              <button key={to} type="button"
                onClick={() => void act(() => updateMarketOrderStatus(order.id, to, note.trim() || undefined), `Statut mis à jour : ${MARKET_STATUS_LABELS[to]}.`)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${to === 'CANCELLED' || to === 'SUPPLY_FAILED' ? 'bg-white text-red-700 border-red-200 hover:bg-red-50' : 'bg-brand-text text-white border-brand-text hover:bg-black'}`}>
                {MARKET_STATUS_LABELS[to]} →
              </button>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Field label="Note (enregistrée dans l'historique)" htmlFor="o-note">
            <Input id="o-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="ex. Client prévenu par WhatsApp" />
          </Field>
        </div>
        {needsPrice && <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">Le prix final n'est pas encore confirmé : la commande ne peut pas être confirmée.</p>}
      </section>

      <section className="bg-white border border-brand-border rounded-2xl p-5">
        <h2 className="font-heading font-bold mb-3">Historique</h2>
        <ol className="space-y-3">
          {order.events.slice().reverse().map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-brand-accent mt-1.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {e.from && e.from !== e.to ? `${MARKET_STATUS_LABELS[e.from as MarketOrderStatus] ?? e.from} → ` : ''}{MARKET_STATUS_LABELS[e.to as MarketOrderStatus] ?? e.to}
                </p>
                <p className="text-xs text-brand-text-muted">{dateTimeFr(e.createdAt)}{e.note ? ` · ${e.note}` : ''}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function PricePanel({ order, onSave }: { order: MarketOrderDetailDto; onSave: (action: () => Promise<unknown>, success: string) => Promise<boolean | void> }) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [fee, setFee] = useState<string>('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const locked = !['REQUESTED', 'SUPPLIER_CHECK', 'AWAITING_CLIENT', 'DELAYED'].includes(order.status);

  const currentFee = fee || (order.deliveryFee != null ? String(order.deliveryFee) : '');
  const allPriced = order.items.every((i) => (prices[i.id] ?? (i.unitPrice != null ? String(i.unitPrice) : '')) !== '');
  const computedTotal = order.items.reduce((s, i) => s + Number(prices[i.id] ?? i.unitPrice ?? 0) * i.quantity, 0) + Number(currentFee || 0);

  if (locked && order.items.every((i) => i.unitPrice != null)) {
    return (
      <section className="bg-white border border-brand-border rounded-2xl p-5">
        <h2 className="font-heading font-bold mb-3">Prix final</h2>
        <dl className="text-sm space-y-2">
          {order.items.map((i) => (
            <div key={i.id} className="flex justify-between gap-4">
              <dt>{i.productName} ×{i.quantity}</dt>
              <dd className="font-semibold">{formatPriceFCFA(i.unitPrice!)} / u</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4"><dt>Frais de livraison</dt><dd className="font-semibold">{formatPriceFCFA(order.deliveryFee ?? 0)}</dd></div>
          <div className="flex justify-between gap-4 border-t border-brand-border pt-2"><dt className="font-bold">Total client</dt><dd className="font-extrabold text-brand-accent">{formatPriceFCFA(computedTotal)}</dd></div>
        </dl>
      </section>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!allPriced) { setError('Renseignez le prix de chaque article et les frais de livraison.'); return; }
    setPending(true);
    try {
      await onSave(() => confirmMarketPrice(order.id, Number(currentFee || 0), order.items.map((i) => ({
        itemId: i.id, unitPrice: Number(prices[i.id] ?? i.unitPrice ?? 0),
      }))), 'Prix final confirmé. Statut : en attente d’accord client.');
      setPrices({});
    } finally { setPending(false); }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-brand-border rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="font-heading font-bold">Prix final à confirmer</h2>
        <p className="text-sm text-brand-text-muted mt-1">Communiquez ces prix au client, puis attendez son accord avant d'enregistrer un paiement.</p>
      </div>
      <div className="space-y-3">
        {order.items.map((i) => (
          <div key={i.id} className="flex items-center gap-4 text-sm">
            <span className="flex-1 min-w-0"><strong>{i.productName}</strong> ×{i.quantity}</span>
            <label className="text-xs font-semibold text-brand-text-muted">Prix unitaire (F)
              <Input className="mt-1 w-40" type="number" min={0} value={prices[i.id] ?? (i.unitPrice != null ? String(i.unitPrice) : '')} onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value })} />
            </label>
          </div>
        ))}
        <div className="flex items-center gap-4 text-sm">
          <span className="flex-1 font-semibold">Frais de livraison</span>
          <label className="text-xs font-semibold text-brand-text-muted">Montant (F)
            <Input className="mt-1 w-40" type="number" min={0} value={currentFee} onChange={(e) => setFee(e.target.value)} />
          </label>
        </div>
      </div>
      <div className="flex items-center justify-between bg-brand-bg rounded-xl p-4">
        <span className="font-bold text-sm">Total client</span>
        <span className="font-extrabold text-brand-accent">{allPriced ? formatPriceFCFA(computedTotal) : '—'}</span>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? 'Enregistrement…' : 'Confirmer le prix final'}</Button>
    </form>
  );
}

function PaymentPanelMarket({ order, onAct }: { order: MarketOrderDetailDto; onAct: (action: () => Promise<unknown>, success: string) => Promise<boolean | void> }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'MTN_MOMO' | 'ORANGE_MONEY' | 'CASH'>('MTN_MOMO');
  const [reference, setReference] = useState('');

  const total = order.items.every((i) => i.unitPrice != null)
    ? order.items.reduce((s, i) => s + i.unitPrice! * i.quantity, 0) + (order.deliveryFee ?? 0)
    : null;
  const confirmed = order.payments.filter((p) => p.status === 'CONFIRMED').reduce((s, p) => s + p.amount, 0);
  const remaining = total != null ? total - confirmed : null;

  return (
    <section className="bg-white border border-brand-border rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading font-bold">Paiements</h2>
        <p className="text-sm">
          {total != null ? <>Encaissé <strong>{formatPriceFCFA(confirmed)}</strong> / {formatPriceFCFA(total)}{remaining != null && remaining > 0 ? ` · reste ${formatPriceFCFA(remaining)}` : ''}</> : 'Total à confirmer d’abord'}
        </p>
      </div>

      {order.payments.length === 0 && <p className="text-sm text-brand-text-muted">Aucun paiement enregistré.</p>}
      <ul className="divide-y divide-brand-border">
        {order.payments.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
            <span className="font-semibold">{formatPriceFCFA(p.amount)}</span>
            <span className="text-brand-text-muted">{PAYMENT_METHOD_LABELS[p.method ?? ''] ?? p.method}{p.reference ? ` · ${p.reference}` : ''}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${p.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : p.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-brand-bg text-brand-text-muted border-brand-border'}`}>
              {p.status === 'CONFIRMED' ? 'Confirmé' : p.status === 'PENDING' ? 'À vérifier' : 'Rejeté'}
            </span>
            <span className="text-xs text-brand-text-muted">{dateTimeFr(p.createdAt)}</span>
            {p.status === 'PENDING' && (
              <span className="ml-auto flex gap-2">
                <button type="button" className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold" onClick={() => void onAct(() => reviewMarketPayment(p.id, 'CONFIRM'), 'Paiement confirmé.')}>Confirmer</button>
                <button type="button" className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-700 text-xs font-bold" onClick={() => void onAct(() => reviewMarketPayment(p.id, 'REJECT'), 'Paiement rejeté.')}>Rejeter</button>
              </span>
            )}
          </li>
        ))}
      </ul>

      <form className="flex flex-wrap items-end gap-3 pt-2 border-t border-brand-border" onSubmit={(e) => { e.preventDefault(); }}>
        <label className="text-xs font-semibold text-brand-text-muted">Montant (F)
          <Input className="mt-1 w-36" type="number" min={100} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={remaining != null && remaining > 0 ? String(remaining) : ''} />
        </label>
        <label className="text-xs font-semibold text-brand-text-muted">Moyen
          <Select className="mt-1" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
            <option value="MTN_MOMO">MTN MoMo</option>
            <option value="ORANGE_MONEY">Orange Money</option>
            <option value="CASH">Espèces</option>
          </Select>
        </label>
        <label className="text-xs font-semibold text-brand-text-muted flex-1 min-w-40">Référence (reçu / transaction)
          <Input className="mt-1" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} />
        </label>
        <Button type="button" disabled={!amount || Number(amount) < 100}
          onClick={() => { void onAct(() => recordMarketPayment(order.id, Number(amount), method, reference.trim() || undefined), 'Paiement enregistré, à vérifier.'); setAmount(''); setReference(''); }}>
          Enregistrer un paiement
        </Button>
      </form>
      <p className="text-xs text-brand-text-muted">Paiements manuels : enregistrez puis vérifiez (solde opérateur) avant de confirmer. La première confirmation fait passer la commande en « Confirmée ».</p>
    </section>
  );
}

function DeliveryPanel({ order, onAct }: { order: MarketOrderDetailDto; onAct: (action: () => Promise<unknown>, success: string) => Promise<boolean | void> }) {
  const d = order.delivery;
  const [status, setStatus] = useState<MarketDeliveryStatus>(d?.status ?? 'PENDING');
  const [fee, setFee] = useState(String(d?.fee ?? order.deliveryFee ?? 0));
  const [cost, setCost] = useState(String(d?.cost ?? 0));
  const [courier, setCourier] = useState(d?.courier ?? '');

  return (
    <section className="bg-white border border-brand-border rounded-2xl p-5 space-y-4">
      <h2 className="font-heading font-bold">Livraison</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-xs font-semibold text-brand-text-muted">Statut
          <Select className="mt-1" value={status} onChange={(e) => setStatus(e.target.value as MarketDeliveryStatus)}>
            {Object.entries(DELIVERY_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </label>
        <label className="text-xs font-semibold text-brand-text-muted">Livreur
          <Input className="mt-1" value={courier} onChange={(e) => setCourier(e.target.value)} maxLength={80} placeholder="Nom du livreur" />
        </label>
        <label className="text-xs font-semibold text-brand-text-muted">Frais facturés au client (F)
          <Input className="mt-1" type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
        <label className="text-xs font-semibold text-brand-text-muted">Coût réel (F) — interne
          <Input className="mt-1" type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => void onAct(() => saveMarketDelivery(order.id, {
          status, fee: Number(fee || 0), cost: Number(cost || 0), courier: courier.trim() || undefined,
        }), 'Livraison mise à jour.')}>Enregistrer la livraison</Button>
        {d?.deliveredAt && <span className="text-sm text-emerald-700 font-semibold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />Livrée le {dateTimeFr(d.deliveredAt)}</span>}
      </div>
    </section>
  );
}

/* ---------------------------- Approvisionnements --------------------------- */

export function AdminMarketBatches() {
  const { data, loading, loadError, reload } = useAsync(fetchMarketBatches, []);
  const { data: suppliers } = useAsync(async () => (await fetchMarketCatalogAdmin()).suppliers, []);
  const { run, banner } = useActionBanner();
  const [reference, setReference] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [note, setNote] = useState('');

  if (loading) return <Loading />;
  if (loadError || !data) return <LoadError message={loadError ?? 'Données indisponibles.'} retry={reload} />;

  const act = async (action: () => Promise<unknown>, success: string) => { const ok = await run(action, success); if (ok) reload(); return ok; };

  return (
    <div className="space-y-6">
      {banner}
      <form className="bg-white border border-brand-border rounded-2xl p-5 grid sm:grid-cols-2 gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act(() => saveMarketBatch({
            reference: reference.trim(), supplierId: supplierId || null,
            totalCost: Number(totalCost || 0), note: note.trim() || undefined,
          }), 'Lot créé.')) { setReference(''); setSupplierId(''); setTotalCost(''); setNote(''); }
        }}>
        <h2 className="font-heading font-bold sm:col-span-2">Nouveau lot d'approvisionnement</h2>
        <Field label="Référence du lot" htmlFor="b-ref" required hint="ex. APR-2026-01"><Input id="b-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={40} required /></Field>
        <Field label="Fournisseur" htmlFor="b-sup">
          <Select id="b-sup" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— Aucun —</option>
            {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Coût total du lot (F)" htmlFor="b-cost" hint="Achat + transport + douane"><Input id="b-cost" type="number" min={0} value={totalCost} onChange={(e) => setTotalCost(e.target.value)} /></Field>
        <Field label="Note (interne)" htmlFor="b-note"><Input id="b-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} /></Field>
        <div className="sm:col-span-2"><Button type="submit" disabled={reference.trim().length < 2}><Plus className="w-4 h-4 mr-2" />Créer le lot</Button></div>
      </form>

      {data.length === 0 ? (
        <EmptyState icon={Truck} title="Aucun lot" description="Un lot regroupe les achats envoyés depuis la Chine (ou ailleurs). Créez-en un avant d'affecter des articles de commandes." />
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-brand-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-brand-text-muted border-b border-brand-border">
                <th className="px-4 py-3">Lot</th>
                <th className="px-4 py-3">Fournisseur</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Articles</th>
                <th className="px-4 py-3 text-right">Coût</th>
                <th className="px-4 py-3 text-right">Faire avancer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {data.map((b) => {
                const flow: MarketBatchStatus[] = ['PLANNED', 'ORDERED', 'SHIPPED', 'RECEIVED'];
                const idx = flow.indexOf(b.status);
                const next = idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
                return (
                  <tr key={b.id}>
                    <td className="px-4 py-3">
                      <p className="font-mono font-bold text-xs">{b.reference}</p>
                      <p className="text-xs text-brand-text-muted">{dateFr(b.createdAt)}{b.receivedAt ? ` · reçu le ${dateFr(b.receivedAt)}` : ''}</p>
                    </td>
                    <td className="px-4 py-3">{b.supplierName ?? '—'}</td>
                    <td className="px-4 py-3"><span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-brand-bg border-brand-border">{BATCH_STATUS_LABELS[b.status]}</span></td>
                    <td className="px-4 py-3 text-right">{b.itemCount}</td>
                    <td className="px-4 py-3 text-right font-semibold">{b.totalCost > 0 ? formatPriceFCFA(b.totalCost) : '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {next && <button type="button" className="px-3 py-1.5 rounded-lg bg-brand-text text-white text-xs font-bold" onClick={() => void act(() => updateMarketBatchStatus(b.id, next), `Lot ${b.reference} : ${BATCH_STATUS_LABELS[next]}.`)}>{BATCH_STATUS_LABELS[next]} →</button>}
                      {b.status === 'PLANNED' && <button type="button" className="ml-2 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-bold" onClick={() => void act(() => updateMarketBatchStatus(b.id, 'CANCELLED'), 'Lot annulé.')}>Annuler</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
