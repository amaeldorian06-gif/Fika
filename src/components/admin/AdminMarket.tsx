import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronUp, ImagePlus, Layers, Loader2, Pencil, Plus, Search, ShoppingCart, Store, Tag, Trash2, Truck, X,
} from 'lucide-react';
import { EmptyState } from './AdminShell';
import { Link } from '../../router';
import { Button } from '../ui';
import { Field, Input, Select, Textarea } from '../forms';
import { formatPriceFCFA } from '../../lib/pricing';
import { AVAILABILITY_LABELS, MARKET_STATUS_LABELS, MARKET_TRANSITIONS, type MarketOrderStatus } from '../../lib/market';
import {
  addMarketCollectionItem, assignMarketItem, deleteMarketCollection, fetchMarketBatches,
  fetchMarketCatalogAdmin, fetchMarketCollections, fetchMarketOrder, fetchMarketOrders,
  fetchMarketOverview, moveMarketCollectionItem, recordMarketPayment, removeMarketCollectionItem,
  reviewMarketPayment, saveMarketCategory, saveMarketCollection, saveMarketDelivery,
  saveMarketProduct, saveMarketSupplier, confirmMarketPrice, saveMarketBatch, updateMarketBatchStatus,
  updateMarketOrderStatus, uploadProductImage,
  type MarketBatchStatus, type MarketCategoryDto, type MarketCollectionDto, type MarketDeliveryStatus,
  type MarketOrderDetailDto, type MarketOrderSummaryDto, type MarketProductDto, type MarketProductPayload,
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-text-muted">Pilotage des ventes de la boutique Fika Market.</p>
        <Button asChild size="sm">
          <Link to="/admin/market/catalog"><Store className="w-4 h-4 mr-1" aria-hidden="true" />Gérer le catalogue</Link>
        </Button>
      </div>
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
  productId: '', name: '', reference: '', categoryId: '', subcategoryId: '', supplierId: '',
  description: '', shortDescription: '', brand: '', tags: '', sourcingType: '',
  priceSale: '', supplierPrice: '', estimatedLandedCost: '',
  delayLabel: '', availability: 'PREORDER', active: true, archived: false, popular: false,
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
    categoryId: product.categoryId, subcategoryId: product.subcategoryId ?? '',
    supplierId: product.supplierId ?? '',
    description: product.description ?? '', shortDescription: product.shortDescription ?? '',
    brand: product.brand ?? '', tags: product.tags.join(', '), sourcingType: product.sourcingType ?? '',
    priceSale: String(product.priceSale),
    supplierPrice: String(product.supplierPrice), estimatedLandedCost: String(product.estimatedLandedCost),
    delayLabel: product.delayLabel ?? '', availability: product.availability,
    active: product.active, archived: product.archived, popular: product.popular,
    images: product.images.join('\n'),
    specs: product.specs.map((s) => s.label + ': ' + s.value).join('\n'),
  } : { ...emptyProduct, categoryId: categories[0]?.id ?? '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [imgError, setImgError] = useState('');

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const images = parseImages(form.images);
  const marginEstimate = Number(form.priceSale || 0) - Number(form.estimatedLandedCost || 0);
  const hasMarginEstimate = Number(form.priceSale) > 0 && form.estimatedLandedCost.trim() !== '';
  const publishChecks = [
    { label: 'Nom et référence renseignés', ok: form.name.trim().length >= 2 && form.reference.trim().length > 0 },
    { label: 'Catégorie sélectionnée', ok: !!form.categoryId },
    { label: 'Description courte', ok: form.shortDescription.trim().length > 0 },
    { label: 'Au moins une photo', ok: images.length > 0 },
    { label: 'Délai renseigné pour une précommande', ok: form.availability !== 'PREORDER' || form.delayLabel.trim().length > 0 },
  ];
  const readyCount = publishChecks.filter((item) => item.ok).length;

  const removeImage = (url: string) => set('images', images.filter((u) => u !== url).join('\n'));
  const moveImage = (index: number, direction: -1 | 1) => {
    const next = [...images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set('images', next.join('\n'));
  };

  /** Téléversement contrôlé : JPEG, PNG ou WebP, 5 Mo maximum par fichier. */
  const addImages = async (files: File[]) => {
    if (files.length === 0) return;
    setImgError('');
    const current = parseImages(form.images);
    const room = 6 - current.length;
    if (room <= 0) { setImgError('6 photos maximum par produit : retirez-en une avant d’en ajouter.'); return; }
    const accepted = files.slice(0, room);
    if (files.length > room) setImgError('6 photos maximum : seules les ' + room + ' première(s) seront envoyées.');
    const invalid = accepted.find((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024);
    if (invalid) {
      setImgError(invalid.size > 5 * 1024 * 1024 ? 'Chaque photo doit peser 5 Mo maximum.' : 'Formats acceptés : JPEG, PNG ou WebP.');
      return;
    }
    setImgUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of accepted) uploaded.push((await uploadProductImage(file)).url);
      set('images', [...current, ...uploaded].join('\n'));
    } catch (err) {
      if (uploaded.length > 0) set('images', [...current, ...uploaded].join('\n'));
      setImgError(err instanceof Error ? err.message : 'Envoi de l’image impossible.');
    } finally { setImgUploading(false); }
  };

  const onPickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    await addImages(files);
  };

  const onDropImages = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (imgUploading) return;
    void addImages(Array.from(e.dataTransfer.files ?? []));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.categoryId) { setError('Choisissez une catégorie (créez-en une d’abord si nécessaire).'); return; }
    if (imgUploading) { setError('Attendez la fin du téléversement des photos.'); return; }
    setPending(true);
    try {
      await saveMarketProduct({
        productId: form.productId || undefined,
        name: form.name.trim(), reference: form.reference.trim(), categoryId: form.categoryId,
        subcategoryId: form.subcategoryId || null,
        supplierId: form.supplierId || null,
        description: form.description.trim() || undefined,
        shortDescription: form.shortDescription.trim() || undefined,
        brand: form.brand.trim() || undefined,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10),
        sourcingType: (form.sourcingType || null) as MarketProductPayload['sourcingType'],
        specs: parseSpecs(form.specs), images,
        priceSale: Number(form.priceSale),
        supplierPrice: Number(form.supplierPrice || 0), estimatedLandedCost: Number(form.estimatedLandedCost || 0),
        delayLabel: form.delayLabel.trim() || undefined,
        availability: form.availability as MarketProductDto['availability'],
        active: form.archived ? false : form.active, archived: form.archived, popular: form.popular,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally { setPending(false); }
  };

  const activeCategory = categories.find((category) => category.id === form.categoryId);
  const activeSubcategory = categories.find((category) => category.id === form.subcategoryId);
  const statusText = form.archived ? 'Archivé' : form.active ? 'Visible dans la boutique' : 'Brouillon / masqué';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-label={product ? 'Modifier le produit' : 'Nouveau produit'}>
      <form onSubmit={submit} noValidate className="bg-[#F8F9FB] rounded-2xl sm:rounded-3xl w-full max-w-[1440px] h-[min(94vh,1040px)] overflow-hidden shadow-2xl flex flex-col">
        {/* En-tête fixe du workspace */}
        <div className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-7 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex w-11 h-11 rounded-2xl bg-brand-accent/10 text-brand-accent items-center justify-center shrink-0">
              <Store className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] uppercase tracking-[0.18em] font-extrabold text-brand-accent">Fika Market · Gestion catalogue</p>
                <span className="text-[10px] font-semibold text-slate-400">/</span>
                <span className="text-[10px] font-semibold text-slate-500">{product ? 'Édition produit' : 'Nouvelle fiche'}</span>
              </div>
              <h2 className="font-heading text-lg sm:text-xl font-extrabold text-slate-900 truncate">{product ? 'Modifier le produit' : 'Créer un produit'}</h2>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden lg:inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className={'w-2 h-2 rounded-full ' + (form.archived ? 'bg-slate-400' : form.active ? 'bg-emerald-500' : 'bg-amber-500')} />
              {statusText}
            </span>
            <button type="button" onClick={onClose} aria-label="Fermer l’éditeur" className="w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Corps défilant : formulaire + prévisualisation */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="max-w-[1320px] mx-auto p-3 sm:p-6 lg:p-8 grid lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)] gap-5 lg:gap-7 items-start">
            <div className="space-y-5 min-w-0">
              {/* Identité et classement */}
              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-accent">01 · Informations</p>
                    <h3 className="font-heading text-base sm:text-lg font-extrabold text-slate-900 mt-1">Identité du produit</h3>
                    <p className="text-xs text-slate-500 mt-1">Les informations qui permettent de retrouver et classer le produit.</p>
                  </div>
                  <span className="hidden sm:inline-flex rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500">Catalogue</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Nom du produit" htmlFor="p-name" required error={form.name.trim().length < 2 ? 'Nom requis.' : undefined}>
                    <Input id="p-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} required placeholder="Ex. Écouteurs sans fil Bluetooth" />
                  </Field>
                  <Field label="Référence" htmlFor="p-ref" required hint="Identifiant interne, ex. FK-MKT-001">
                    <Input id="p-ref" value={form.reference} onChange={(e) => set('reference', e.target.value)} maxLength={40} required placeholder="FK-MKT-001" />
                  </Field>
                  <Field label="Catégorie" htmlFor="p-cat" required>
                    <Select id="p-cat" value={form.categoryId} onChange={(e) => {
                      const v = e.target.value;
                      const stillValid = categories.some((c) => c.id === form.subcategoryId && c.parentId === v);
                      setForm((f) => ({ ...f, categoryId: v, subcategoryId: stillValid ? f.subcategoryId : '' }));
                    }}>
                      {categories.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Sous-catégorie" htmlFor="p-subcat" hint="Facultatif — affine la navigation">
                    <Select id="p-subcat" value={form.subcategoryId} onChange={(e) => set('subcategoryId', e.target.value)}>
                      <option value="">— Aucune —</option>
                      {categories.filter((c) => c.parentId === form.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Fournisseur" htmlFor="p-sup">
                    <Select id="p-sup" value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
                      <option value="">— Aucun —</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Marque" htmlFor="p-brand" hint="Facultatif — ex. Lenovo">
                    <Input id="p-brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} maxLength={80} placeholder="Nom de la marque" />
                  </Field>
                </div>
              </section>

              {/* Présentation publique */}
              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-accent">02 · Contenu</p>
                  <h3 className="font-heading text-base sm:text-lg font-extrabold text-slate-900 mt-1">Présentation publique</h3>
                  <p className="text-xs text-slate-500 mt-1">Ce que le client verra sur les cartes et la fiche produit.</p>
                </div>
                <Field label="Description courte" htmlFor="p-shortdesc" hint="Affichée sur les cartes — nécessaire pour une publication soignée">
                  <Input id="p-shortdesc" value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} maxLength={160} placeholder="Une phrase claire sur l’utilité ou le bénéfice du produit" />
                </Field>
                <Field label="Description détaillée" htmlFor="p-desc" hint="Décrivez les usages, les avantages et les éléments importants.">
                  <Textarea id="p-desc" rows={5} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={3000} placeholder="Présentez le produit avec des informations vérifiables…" className="min-h-[130px]" />
                </Field>
              </section>

              {/* Photographies */}
              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-accent">03 · Visuels</p>
                    <h3 className="font-heading text-base sm:text-lg font-extrabold text-slate-900 mt-1">Photographies du produit</h3>
                    <p className="text-xs text-slate-500 mt-1">La première photo devient l’image principale affichée dans la boutique.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">{images.length}/6 photos</span>
                </div>
                <div
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={onDropImages}
                  className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-5 sm:p-7 text-center hover:border-brand-accent hover:bg-brand-accent/5 transition-colors"
                >
                  <div className="w-11 h-11 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-brand-accent">
                    {imgUploading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="w-5 h-5" aria-hidden="true" />}
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-800">{imgUploading ? 'Téléversement des photos…' : 'Glissez vos photos ici'}</p>
                  <p className="mt-1 text-xs text-slate-500">JPEG, PNG ou WebP · 5 Mo maximum par photo · 6 photos maximum</p>
                  <label htmlFor="p-upload" className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer hover:bg-black">
                    <ImagePlus className="w-4 h-4" aria-hidden="true" /> Choisir depuis l’ordinateur
                  </label>
                  <input id="p-upload" type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" multiple onChange={onPickImages} disabled={imgUploading || images.length >= 6} />
                </div>
                {images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {images.map((url, i) => (
                      <div key={url} className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group">
                        <div className="aspect-square flex items-center justify-center">
                          <img src={url} alt={form.name ? form.name + ' — photo ' + (i + 1) : 'Photo produit ' + (i + 1)} loading="lazy" className="w-full h-full object-cover" />
                        </div>
                        {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-slate-950/85 text-white text-[9px] font-extrabold uppercase tracking-wider px-2 py-1">Principale</span>}
                        <div className="absolute right-1.5 top-1.5 flex gap-1">
                          <button type="button" disabled={i === 0} onClick={() => moveImage(i, -1)} aria-label={'Déplacer la photo ' + (i + 1) + ' avant'} className="w-7 h-7 rounded-lg bg-white/95 border border-slate-200 flex items-center justify-center disabled:opacity-30 hover:bg-slate-100">
                            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button type="button" disabled={i === images.length - 1} onClick={() => moveImage(i, 1)} aria-label={'Déplacer la photo ' + (i + 1) + ' après'} className="w-7 h-7 rounded-lg bg-white/95 border border-slate-200 flex items-center justify-center disabled:opacity-30 hover:bg-slate-100">
                            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => removeImage(url)} aria-label={'Retirer la photo ' + (i + 1)} className="w-7 h-7 rounded-lg bg-white/95 border border-slate-200 text-red-600 flex items-center justify-center hover:bg-red-50">
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Field label="Ajouter ou modifier les URL (facultatif)" htmlFor="p-img" hint="Une URL par ligne. L’ordre des lignes détermine aussi l’ordre des photos.">
                  <Textarea id="p-img" rows={3} value={form.images} onChange={(e) => set('images', e.target.value)} placeholder="https://…" />
                </Field>
                {imgError && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-3 text-xs">{imgError}</p>}
              </section>

              {/* Prix et disponibilité */}
              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-accent">04 · Tarification</p>
                  <h3 className="font-heading text-base sm:text-lg font-extrabold text-slate-900 mt-1">Prix et approvisionnement</h3>
                  <p className="text-xs text-slate-500 mt-1">Les coûts fournisseur restent internes et ne sont jamais présentés au client.</p>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Prix de vente (FCFA)" htmlFor="p-price" required>
                    <Input id="p-price" type="number" min={100} value={form.priceSale} onChange={(e) => set('priceSale', e.target.value)} required placeholder="Ex. 25 000" />
                  </Field>
                  <Field label="Prix fournisseur (FCFA)" htmlFor="p-supprice" hint="Interne">
                    <Input id="p-supprice" type="number" min={0} value={form.supplierPrice} onChange={(e) => set('supplierPrice', e.target.value)} />
                  </Field>
                  <Field label="Coût rendu estimé (FCFA)" htmlFor="p-landed" hint="Interne">
                    <Input id="p-landed" type="number" min={0} value={form.estimatedLandedCost} onChange={(e) => set('estimatedLandedCost', e.target.value)} />
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Disponibilité" htmlFor="p-avail">
                    <Select id="p-avail" value={form.availability} onChange={(e) => set('availability', e.target.value)}>
                      {Object.entries(AVAILABILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                  </Field>
                  <Field label="Délai estimé affiché" htmlFor="p-delay" hint="À confirmer avec le client avant paiement">
                    <Input id="p-delay" value={form.delayLabel} onChange={(e) => set('delayLabel', e.target.value)} placeholder="Ex. 2 à 3 semaines" maxLength={120} />
                  </Field>
                </div>
              </section>

              {/* Référencement et publication */}
              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-accent">05 · Découverte</p>
                  <h3 className="font-heading text-base sm:text-lg font-extrabold text-slate-900 mt-1">Recherche et mise en avant</h3>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Tags de recherche (max 10)" htmlFor="p-tags" hint="Séparés par des virgules">
                    <Input id="p-tags" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="usb, chargeur rapide, bluetooth" />
                  </Field>
                  <Field label="Approvisionnement" htmlFor="p-sourcing" hint="Interne — jamais affiché aux clients">
                    <Select id="p-sourcing" value={form.sourcingType} onChange={(e) => set('sourcingType', e.target.value)}>
                      <option value="">— Non renseigné —</option>
                      <option value="LOCAL">Local (Ngaoundéré)</option>
                      <option value="NATIONAL">National (Cameroun)</option>
                      <option value="IMPORT">International (import)</option>
                      <option value="PARTNER">Fournisseur partenaire</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Caractéristiques techniques (max 12)" htmlFor="p-specs" hint="Une par ligne : Étiquette: valeur">
                  <Textarea id="p-specs" rows={4} value={form.specs} onChange={(e) => set('specs', e.target.value)} placeholder={'Connectivité: Bluetooth 5.3\nAutonomie: 6 heures\nGarantie: selon fournisseur'} />
                </Field>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className={'flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ' + (form.active && !form.archived ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50')}>
                    <input type="checkbox" className="mt-0.5 w-4 h-4 accent-brand-accent" checked={form.active && !form.archived} onChange={(e) => set('active', e.target.checked)} disabled={form.archived} />
                    <span><span className="block text-sm font-bold text-slate-800">Visible dans la boutique</span><span className="block mt-1 text-xs text-slate-500">Le produit pourra être découvert par les clients.</span></span>
                  </label>
                  <label className={'flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ' + (form.popular ? 'border-brand-accent/30 bg-brand-accent/5' : 'border-slate-200 bg-slate-50')}>
                    <input type="checkbox" className="mt-0.5 w-4 h-4 accent-brand-accent" checked={form.popular} onChange={(e) => set('popular', e.target.checked)} />
                    <span><span className="block text-sm font-bold text-slate-800">Mettre en avant</span><span className="block mt-1 text-xs text-slate-500">Priorité dans certaines sélections du catalogue.</span></span>
                  </label>
                  <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4 cursor-pointer">
                    <input type="checkbox" className="mt-0.5 w-4 h-4 accent-red-600" checked={form.archived} onChange={(e) => set('archived', e.target.checked)} />
                    <span><span className="block text-sm font-bold text-red-800">Archiver ce produit</span><span className="block mt-1 text-xs text-red-700">Retire le produit du catalogue public sans supprimer son historique.</span></span>
                  </label>
                </div>
              </section>

              {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-4 text-sm font-semibold">{error}</p>}
            </div>

            {/* Colonne latérale : aperçu et contrôle qualité */}
            <aside className="space-y-4 lg:sticky lg:top-5">
              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] font-extrabold text-brand-accent">Aperçu en direct</p>
                    <h3 className="font-heading text-sm font-extrabold text-slate-900 mt-1">Vue client</h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">FIKA MARKET</span>
                </div>
                <div className="p-4">
                  <div className="aspect-[4/3] rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                    {images[0]
                      ? <img src={images[0]} alt="" className="w-full h-full object-cover" />
                      : <div className="text-center px-4"><ImagePlus className="w-8 h-8 mx-auto text-slate-300" /><p className="mt-2 text-xs text-slate-400">La première photo apparaîtra ici</p></div>}
                  </div>
                  <p className="mt-4 text-[10px] uppercase tracking-wider font-bold text-slate-400">{activeCategory?.name ?? 'Catégorie à choisir'}{activeSubcategory ? ' · ' + activeSubcategory.name : ''}{form.brand.trim() ? ' · ' + form.brand.trim() : ''}</p>
                  <p className="mt-1 font-heading font-extrabold text-slate-900 leading-snug">{form.name.trim() || 'Nom du produit'}</p>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">{form.shortDescription.trim() || 'La description courte sera affichée ici.'}</p>
                  <p className="mt-3 text-xl font-extrabold text-brand-accent">{Number(form.priceSale) > 0 ? formatPriceFCFA(Number(form.priceSale)) : 'Prix à renseigner'}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={'text-[10px] font-bold px-2.5 py-1 rounded-full border ' + (form.availability === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : form.availability === 'PREORDER' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200')}>
                      {AVAILABILITY_LABELS[form.availability as keyof typeof AVAILABILITY_LABELS]}
                    </span>
                    {form.delayLabel.trim() && <span className="text-[10px] text-slate-500">{form.delayLabel.trim()}</span>}
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div><p className="text-[10px] uppercase tracking-[0.16em] font-extrabold text-brand-accent">Qualité de la fiche</p><h3 className="font-heading font-extrabold text-sm text-slate-900 mt-1">{readyCount}/5 éléments prêts</h3></div>
                  <span className="text-lg font-extrabold text-slate-800">{Math.round((readyCount / publishChecks.length) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: ((readyCount / publishChecks.length) * 100) + '%' }} /></div>
                <ul className="space-y-2.5">
                  {publishChecks.map((item) => (
                    <li key={item.label} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className={'w-4 h-4 shrink-0 ' + (item.ok ? 'text-emerald-600' : 'text-slate-300')} aria-hidden="true" />
                      <span className={item.ok ? 'text-slate-700 font-semibold' : 'text-slate-500'}>{item.label}</span>
                    </li>
                  ))}
                </ul>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Marge estimée · interne</p>
                  <p className={'text-lg font-extrabold mt-1 ' + (marginEstimate >= 0 ? 'text-emerald-700' : 'text-red-700')}>{hasMarginEstimate ? formatPriceFCFA(marginEstimate) : 'À calculer'}</p>
                  <p className="text-[10px] leading-relaxed text-slate-500 mt-1">Calcul indicatif : prix de vente − coût rendu estimé. Visible uniquement dans cet espace.</p>
                </div>
              </section>

              <section className="rounded-2xl bg-slate-900 text-white p-5">
                <p className="text-xs font-extrabold">Conseil de présentation</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">Privilégiez une photo principale nette, un titre précis, une description courte factuelle et des caractéristiques vérifiables. Le client doit comprendre le produit sans devoir deviner.</p>
              </section>
            </aside>
          </div>
        </div>

        {/* Actions fixes et toujours accessibles */}
        <div className="shrink-0 bg-white border-t border-slate-200 px-4 sm:px-7 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="hidden sm:block text-xs text-slate-500">{product ? 'Les modifications ne seront visibles qu’après enregistrement.' : 'Les données ne sont créées qu’après validation du formulaire.'}</p>
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
            <Button type="submit" disabled={pending || imgUploading} className="min-w-[150px]">
              {pending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement…</> : product ? 'Enregistrer les modifications' : 'Créer le produit'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------- Collections -------------------------------- */

const emptyCollection = {
  name: '', slug: '', description: '', rule: 'MANUAL', priceThreshold: '',
  position: '0', active: true,
};

function CollectionDialog({ collection, products, onCreated, onChanged, onClose }: {
  collection: MarketCollectionDto | null;
  products: MarketProductDto[];
  onCreated: (id: string) => void;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(collection ? {
    name: collection.name, slug: collection.slug, description: collection.description ?? '',
    rule: collection.rule as string,
    priceThreshold: collection.priceThreshold != null ? String(collection.priceThreshold) : '',
    position: String(collection.position), active: collection.active,
  } : { ...emptyCollection });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [pick, setPick] = useState('');
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      const res = await saveMarketCollection({
        id: collection?.id, name: form.name.trim(), slug: form.slug.trim() || undefined,
        description: form.description.trim() || undefined,
        rule: form.rule as MarketCollectionDto['rule'],
        priceThreshold: form.rule === 'PRICE_BELOW' ? Number(form.priceThreshold || 0) : null,
        position: Number(form.position || 0), active: form.active,
      });
      if (collection) { onChanged(); onClose(); } else onCreated(res.id ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally { setPending(false); }
  };

  /** Action sur les items : recharge silencieuse, le dialogue reste ouvert. */
  const act = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); onChanged(); } catch (err) { setError(err instanceof Error ? err.message : 'Action impossible.'); }
  };

  const publishable = products.filter((p) => p.active && !p.archived);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label="Collection">
      <form onSubmit={submit} noValidate className="bg-white rounded-2xl w-full max-w-xl p-6 space-y-4 my-8">
        <h2 className="font-heading text-xl font-bold">{collection ? 'Modifier la collection' : 'Nouvelle collection'}</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nom" htmlFor="col-name" required><Input id="col-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} required /></Field>
          <Field label="Slug (URL)" htmlFor="col-slug" hint={collection ? 'Laisser vide pour conserver l’actuel' : 'Généré depuis le nom si vide'}>
            <Input id="col-slug" value={form.slug} onChange={(e) => set('slug', e.target.value)} maxLength={80} placeholder="ex. selection-fika" />
          </Field>
        </div>
        <Field label="Description" htmlFor="col-desc"><Textarea id="col-desc" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={500} /></Field>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Règle" htmlFor="col-rule">
            <Select id="col-rule" value={form.rule} onChange={(e) => set('rule', e.target.value)}>
              <option value="MANUAL">Sélection manuelle</option>
              <option value="NEW_ARRIVALS">Nouveautés (auto)</option>
              <option value="PRICE_BELOW">Petit prix ≤ seuil (auto)</option>
            </Select>
          </Field>
          {form.rule === 'PRICE_BELOW' && (
            <Field label="Seuil (F)" htmlFor="col-threshold" required>
              <Input id="col-threshold" type="number" min={100} value={form.priceThreshold} onChange={(e) => set('priceThreshold', e.target.value)} required />
            </Field>
          )}
          <Field label="Position" htmlFor="col-pos"><Input id="col-pos" type="number" min={0} max={99} value={form.position} onChange={(e) => set('position', e.target.value)} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="w-4 h-4 accent-brand-accent" checked={form.active} onChange={(e) => set('active', e.target.checked)} />Collection active (visible si non vide)
        </label>

        {collection && collection.rule === 'MANUAL' && (
          <div className="border-t border-brand-border pt-4">
            <p className="text-sm font-bold mb-2">Produits de la collection ({collection.items.length})</p>
            {collection.items.length === 0 ? (
              <p className="text-xs text-brand-text-muted bg-brand-bg rounded-xl p-3 mb-2">Aucun produit : ajoutez-en ci-dessous.</p>
            ) : (
              <ul className="space-y-1.5 mb-3">
                {collection.items.map((it, i) => (
                  <li key={it.id} className="flex items-center justify-between gap-2 text-sm bg-brand-bg rounded-xl px-3 py-2">
                    <span className="truncate">
                      {!it.productActive && <span className="text-amber-700 font-bold text-[11px] mr-1">(non publié)</span>}
                      {it.productName}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <button type="button" aria-label={`Monter ${it.productName}`} disabled={i === 0} className="p-1 rounded hover:bg-white disabled:opacity-30" onClick={() => void act(() => moveMarketCollectionItem(it.id, 'UP'))}><ChevronUp className="w-4 h-4" /></button>
                      <button type="button" aria-label={`Descendre ${it.productName}`} disabled={i === collection.items.length - 1} className="p-1 rounded hover:bg-white disabled:opacity-30" onClick={() => void act(() => moveMarketCollectionItem(it.id, 'DOWN'))}><ChevronDown className="w-4 h-4" /></button>
                      <button type="button" aria-label={`Retirer ${it.productName}`} className="p-1 rounded hover:bg-white text-red-700" onClick={() => void act(() => removeMarketCollectionItem(it.id))}><X className="w-4 h-4" /></button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Select aria-label="Ajouter un produit à la collection" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Choisir un produit publié…</option>
                {publishable.filter((p) => !collection.items.some((it) => it.productId === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              <Button type="button" size="sm" disabled={!pick} onClick={() => { void act(async () => { await addMarketCollectionItem(collection.id, pick); setPick(''); }); }}>Ajouter</Button>
            </div>
          </div>
        )}
        {collection && collection.rule !== 'MANUAL' && (
          <p className="text-xs text-brand-text-muted bg-brand-bg rounded-xl p-3">Collection automatique : son contenu est calculé à partir du catalogue — aucun produit à choisir.</p>
        )}
        {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-3 text-sm">{error}</p>}
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
          <Button type="submit" disabled={pending}>{pending ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </div>
      </form>
    </div>
  );
}

export function AdminMarketCatalog() {
  const { data, loading, loadError, reload } = useAsync(fetchMarketCatalogAdmin, []);
  const { data: collections, reload: reloadCollections } = useAsync(fetchMarketCollections, []);
  const [dialog, setDialog] = useState<'product' | 'category' | 'supplier' | null>(null);
  const [editing, setEditing] = useState<MarketProductDto | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productStatus, setProductStatus] = useState<'ALL' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'>('ALL');
  const [productCategory, setProductCategory] = useState('ALL');
  const { run, banner } = useActionBanner();

  const [catForm, setCatForm] = useState({ id: '', name: '', slug: '', description: '', imageUrl: '', parentId: '', position: '0', active: true, archived: false });
  const [supForm, setSupForm] = useState({ id: '', name: '', contact: '', note: '', active: true });
  const categories = data?.categories ?? [];
  const suppliers = data?.suppliers ?? [];
  const products = data?.products ?? [];
  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLocaleLowerCase('fr');
    return products.filter((product) => {
      const matchesSearch = !term || [product.name, product.reference, product.brand ?? '', product.categoryName, product.subcategoryName ?? '', product.supplierName ?? '']
        .some((value) => value.toLocaleLowerCase('fr').includes(term));
      const matchesStatus = productStatus === 'ALL'
        || (productStatus === 'PUBLISHED' && product.active && !product.archived)
        || (productStatus === 'DRAFT' && !product.active && !product.archived)
        || (productStatus === 'ARCHIVED' && product.archived);
      const matchesCategory = productCategory === 'ALL' || product.categoryId === productCategory;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [products, productSearch, productStatus, productCategory]);

  if (loading) return <Loading />;
  if (loadError || !data) return <LoadError message={loadError ?? 'Données indisponibles.'} retry={reload} />;
  const publishedProducts = products.filter((product) => product.active && !product.archived).length;
  const draftProducts = products.filter((product) => !product.active && !product.archived).length;
  const archivedProducts = products.filter((product) => product.archived).length;

  /** Payload complet d'un produit existant — évite qu'un toggle n'écrase les champs non affichés. */
  const productPayload = (p: MarketProductDto, overrides: Partial<MarketProductPayload> = {}): MarketProductPayload => ({
    productId: p.id, name: p.name, reference: p.reference, categoryId: p.categoryId,
    subcategoryId: p.subcategoryId, supplierId: p.supplierId,
    description: p.description ?? undefined, shortDescription: p.shortDescription ?? undefined,
    brand: p.brand ?? undefined, tags: p.tags, sourcingType: p.sourcingType,
    specs: p.specs, images: p.images, priceSale: p.priceSale,
    supplierPrice: p.supplierPrice, estimatedLandedCost: p.estimatedLandedCost,
    delayLabel: p.delayLabel ?? undefined, availability: p.availability,
    active: p.active, archived: p.archived, popular: p.popular,
    ...overrides,
  });

  const toggleProduct = async (p: MarketProductDto) => {
    if (await run(() => saveMarketProduct(productPayload(p, { active: !p.active })),
      p.active ? 'Produit masqué de la boutique.' : 'Produit publié dans la boutique.')) reload();
  };

  const archiveProduct = async (p: MarketProductDto) => {
    if (!window.confirm(`Archiver « ${p.name} » ? Il sortira du catalogue public. Aucune donnée n’est supprimée (commandes conservées).`)) return;
    if (await run(() => saveMarketProduct(productPayload(p, { active: false, archived: true })), 'Produit archivé (restaurable à tout moment).')) reload();
  };

  const restoreProduct = async (p: MarketProductDto) => {
    if (await run(() => saveMarketProduct(productPayload(p, { active: false, archived: false })), 'Produit restauré en brouillon (masqué).')) reload();
  };

  return (
    <div className="space-y-8">
      {banner}

      {/* Catégories */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-bold text-lg">Catégories</h2>
          <Button size="sm" variant="outline" onClick={() => { setCatForm({ id: '', name: '', slug: '', description: '', imageUrl: '', parentId: '', position: '0', active: true, archived: false }); setDialog('category'); }}><Plus className="w-4 h-4 mr-1" />Catégorie</Button>
        </div>
        {categories.length === 0
          ? <p className="text-sm text-brand-text-muted bg-brand-bg rounded-2xl p-5">Aucune catégorie. Créez-en une pour pouvoir ajouter des produits.</p>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.filter((c) => !c.parentId).map((c) => {
              const activeCount = products.filter((p) => p.categoryId === c.id && p.active && !p.archived).length;
              const subs = categories.filter((s) => s.parentId === c.id);
              return (
                <div key={c.id} className={`bg-white border rounded-2xl p-4 ${c.archived ? 'border-brand-border opacity-60' : 'border-brand-border'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold truncate flex items-center gap-2">
                        <Tag className="w-4 h-4 text-brand-text-muted shrink-0" aria-hidden="true" />
                        {c.name}
                      </p>
                      <p className="text-xs text-brand-text-muted mt-0.5">/{c.slug}</p>
                    </div>
                    <button type="button" className="p-1 rounded hover:bg-brand-bg shrink-0" aria-label={`Modifier ${c.name}`}
                      onClick={() => { setCatForm({ id: c.id, name: c.name, slug: c.slug, description: c.description ?? '', imageUrl: c.imageUrl ?? '', parentId: '', position: String(c.position), active: c.active, archived: c.archived }); setDialog('category'); }}>
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-brand-text-muted mt-2">{activeCount} produit(s) publié(s)</p>
                  {subs.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {subs.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-sm text-brand-text-muted">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <ChevronDown className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{s.name}</span>
                            <span className="text-[11px] shrink-0">({products.filter((p) => p.subcategoryId === s.id).length})</span>
                          </span>
                          <button type="button" className="p-1 rounded hover:bg-brand-bg shrink-0" aria-label={`Modifier ${s.name}`}
                            onClick={() => { setCatForm({ id: s.id, name: s.name, slug: s.slug, description: s.description ?? '', imageUrl: s.imageUrl ?? '', parentId: c.id, position: String(s.position), active: s.active, archived: s.archived }); setDialog('category'); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${c.archived ? 'bg-brand-bg text-brand-text-muted border-brand-border' : c.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {c.archived ? 'Archivée' : c.active ? 'Visible' : 'Masquée'}
                    </span>
                    {!c.archived && <Link to={`/boutique/categorie/${c.slug}`} className="text-xs font-bold text-brand-accent hover:underline">Aperçu public</Link>}
                  </div>
                </div>
              );
            })}
          </div>}
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

      {/* Collections */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-bold text-lg">Collections</h2>
          <Button size="sm" variant="outline" onClick={() => { setCollectionId('new'); }}><Plus className="w-4 h-4 mr-1" />Collection</Button>
        </div>
        <p className="text-xs text-brand-text-muted -mt-1 mb-3">Sélections éditoriales (ex. Sélection Fika), distinctes des catégories : un même produit peut figurer dans plusieurs collections.</p>
        {(collections ?? []).length === 0
          ? <p className="text-sm text-brand-text-muted bg-brand-bg rounded-2xl p-5">Aucune collection. Créez « Sélection Fika », « Nouveautés » ou « Petits prix » pour mettre en avant vos produits.</p>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(collections ?? []).map((c) => (
              <div key={c.id} className="bg-white border border-brand-border rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold truncate flex items-center gap-2">
                      <Layers className="w-4 h-4 text-brand-text-muted shrink-0" aria-hidden="true" />
                      {c.name}
                    </p>
                    <p className="text-xs text-brand-text-muted mt-0.5">{c.ruleLabel}{c.rule === 'PRICE_BELOW' && c.priceThreshold ? ` : ${formatPriceFCFA(c.priceThreshold)}` : ''}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" className="p-1 rounded hover:bg-brand-bg" aria-label={`Modifier ${c.name}`} onClick={() => setCollectionId(c.id)}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-1 rounded hover:bg-red-50 text-red-700" aria-label={`Supprimer ${c.name}`}
                      onClick={async () => {
                        if (!window.confirm(`Supprimer la collection « ${c.name} » ? Les produits ne sont pas touchés.`)) return;
                        if (await run(() => deleteMarketCollection(c.id), 'Collection supprimée.')) reloadCollections();
                      }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-brand-text-muted mt-2">
                  {c.rule === 'MANUAL' ? `${c.items.length} produit(s) choisi(s)` : 'Contenu calculé automatiquement'}
                </p>
                <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border mt-2 ${c.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-brand-bg text-brand-text-muted border-brand-border'}`}>
                  {c.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>}
      </section>

      {/* Produits */}
      <section aria-labelledby="market-admin-products" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-accent">Gestion du catalogue</p>
            <h2 id="market-admin-products" className="font-heading text-xl font-extrabold text-slate-900">Produits <span className="text-sm font-semibold text-slate-400">({products.length})</span></h2>
            <p className="mt-1 text-xs text-brand-text-muted">Recherchez, filtrez et mettez à jour les fiches produits.</p>
          </div>
          <Button size="sm" onClick={() => { setEditing(null); setDialog('product'); }} className="shrink-0">
            <Plus className="mr-1 h-4 w-4" /> Nouveau produit
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 sm:rounded-2xl sm:p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Publiés</p>
            <p className="mt-1 text-xl font-extrabold text-emerald-800">{publishedProducts}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3 sm:rounded-2xl sm:p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Brouillons</p>
            <p className="mt-1 text-xl font-extrabold text-amber-800">{draftProducts}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:rounded-2xl sm:p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Archivés</p>
            <p className="mt-1 text-xl font-extrabold text-slate-700">{archivedProducts}</p>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-brand-border bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_180px_190px] sm:p-4">
          <label className="relative block">
            <span className="sr-only">Rechercher un produit</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Nom, référence, marque, fournisseur…"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-brand-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/15"
            />
          </label>
          <label className="block">
            <span className="sr-only">Filtrer par état</span>
            <Select aria-label="Filtrer par état" value={productStatus} onChange={(e) => setProductStatus(e.target.value as typeof productStatus)} className="h-11 bg-slate-50 py-2">
              <option value="ALL">Tous les états</option>
              <option value="PUBLISHED">Publiés</option>
              <option value="DRAFT">Brouillons</option>
              <option value="ARCHIVED">Archivés</option>
            </Select>
          </label>
          <label className="block">
            <span className="sr-only">Filtrer par catégorie</span>
            <Select aria-label="Filtrer par catégorie" value={productCategory} onChange={(e) => setProductCategory(e.target.value)} className="h-11 bg-slate-50 py-2">
              <option value="ALL">Toutes les catégories</option>
              {categories.filter((category) => !category.parentId).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          </label>
        </div>

        {products.length === 0 ? (
          <EmptyState icon={Store} title="Catalogue vide" description="Ajoutez vos premières catégories puis vos produits : ils apparaîtront immédiatement dans la boutique." />
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-brand-border-dark bg-white px-6 py-12 text-center">
            <Search className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
            <p className="mt-3 font-bold text-slate-800">Aucun produit ne correspond à ces filtres.</p>
            <button type="button" onClick={() => { setProductSearch(''); setProductStatus('ALL'); setProductCategory('ALL'); }} className="mt-2 text-sm font-bold text-brand-accent hover:underline">Effacer les filtres</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 px-1 text-xs text-brand-text-muted">
              <span>{filteredProducts.length} résultat{filteredProducts.length > 1 ? 's' : ''}</span>
              {(productSearch || productStatus !== 'ALL' || productCategory !== 'ALL') && (
                <button type="button" onClick={() => { setProductSearch(''); setProductStatus('ALL'); setProductCategory('ALL'); }} className="font-bold text-brand-accent hover:underline">Réinitialiser</button>
              )}
            </div>

            {/* Table riche sur ordinateur */}
            <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-[0.13em] text-slate-500">
                    <tr>
                      <th className="px-4 py-4">Produit</th>
                      <th className="px-4 py-4">Prix vente</th>
                      <th className="px-4 py-4">Marge estimée</th>
                      <th className="px-4 py-4">Disponibilité</th>
                      <th className="px-4 py-4">État</th>
                      <th className="px-4 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="flex min-w-[280px] items-center gap-3">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                              {p.images[0] ? <img src={p.images[0]} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5 text-slate-300" aria-hidden="true" />}
                            </div>
                            <div className="min-w-0">
                              <p className="max-w-[300px] truncate font-extrabold text-slate-900">{p.name}</p>
                              <p className="mt-1 text-[11px] text-slate-500">{p.reference} · {p.categoryName}{p.subcategoryName ? ' › ' + p.subcategoryName : ''}</p>
                              {p.supplierName && <p className="mt-0.5 truncate text-[10px] text-slate-400">{p.supplierName}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-extrabold text-slate-800">{formatPriceFCFA(p.priceSale)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={p.estimatedMargin > 0 ? 'font-bold text-emerald-700' : 'font-bold text-red-700'}>{formatPriceFCFA(p.estimatedMargin)}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{AVAILABILITY_LABELS[p.availability]}</td>
                        <td className="px-4 py-3">
                          <span className={'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold ' + (p.archived ? 'border-slate-200 bg-slate-100 text-slate-500' : p.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800')}>
                            {p.archived ? 'Archivé' : p.active ? 'Publié' : 'Brouillon'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={'Modifier ' + p.name} onClick={() => { setEditing(p); setDialog('product'); }}><Pencil className="h-4 w-4" /></button>
                          {p.archived
                            ? <button type="button" className="rounded-lg px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100" onClick={() => void restoreProduct(p)}>Restaurer</button>
                            : <>
                              <button type="button" className="rounded-lg px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100" onClick={() => void toggleProduct(p)}>{p.active ? 'Masquer' : 'Publier'}</button>
                              <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-700" aria-label={'Archiver ' + p.name} onClick={() => void archiveProduct(p)}><Trash2 className="h-4 w-4" /></button>
                            </>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cartes adaptées tablette et mobile */}
            <div className="grid gap-3 lg:hidden sm:grid-cols-2">
              {filteredProducts.map((p) => (
                <article key={p.id} className="rounded-2xl border border-brand-border bg-white p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                      {p.images[0] ? <img src={p.images[0]} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5 text-slate-300" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-extrabold text-slate-900">{p.name}</p>
                      <p className="mt-1 text-[10px] text-slate-500">{p.reference} · {p.categoryName}</p>
                      <p className="mt-2 text-sm font-extrabold text-brand-accent">{formatPriceFCFA(p.priceSale)}</p>
                    </div>
                    <span className={'shrink-0 rounded-full border px-2 py-1 text-[9px] font-extrabold ' + (p.archived ? 'border-slate-200 bg-slate-100 text-slate-500' : p.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800')}>
                      {p.archived ? 'Archivé' : p.active ? 'Publié' : 'Brouillon'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                    <span className="text-[11px] text-slate-500">{AVAILABILITY_LABELS[p.availability]} · Marge {formatPriceFCFA(p.estimatedMargin)}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={'Modifier ' + p.name} onClick={() => { setEditing(p); setDialog('product'); }}><Pencil className="h-4 w-4" /></button>
                      {p.archived
                        ? <button type="button" className="rounded-lg px-2 py-2 text-xs font-bold text-slate-600" onClick={() => void restoreProduct(p)}>Restaurer</button>
                        : <>
                          <button type="button" className="rounded-lg px-2 py-2 text-xs font-bold text-slate-600" onClick={() => void toggleProduct(p)}>{p.active ? 'Masquer' : 'Publier'}</button>
                          <button type="button" className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label={'Archiver ' + p.name} onClick={() => void archiveProduct(p)}><Trash2 className="h-4 w-4" /></button>
                        </>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {dialog === 'product' && (
        <ProductDialog
          product={editing}
          categories={categories.filter((c) => !c.archived || editing?.categoryId === c.id || editing?.subcategoryId === c.id)}
          suppliers={suppliers}
          onSaved={() => { setDialog(null); reload(); }}
          onClose={() => setDialog(null)}
        />
      )}

      {collectionId && (
        <CollectionDialog
          collection={collectionId === 'new' ? null : (collections ?? []).find((c) => c.id === collectionId) ?? null}
          products={products}
          onCreated={async (id) => { await reloadCollections(); setCollectionId(id); }}
          onChanged={reloadCollections}
          onClose={() => setCollectionId(null)}
        />
      )}

      {dialog === 'category' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label="Catégorie">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => saveMarketCategory({
                id: catForm.id || undefined, name: catForm.name.trim(),
                slug: catForm.slug.trim() || undefined,
                description: catForm.description.trim() || undefined,
                imageUrl: catForm.imageUrl.trim() || undefined,
                parentId: catForm.parentId || null,
                position: Number(catForm.position || 0),
                active: catForm.active, archived: catForm.archived,
              }), 'Catégorie enregistrée.')) { setDialog(null); reload(); }
            }}
            className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 my-8"
          >
            <h2 className="font-heading text-xl font-bold">{catForm.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h2>
            <Field label="Nom" htmlFor="c-name" required><Input id="c-name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} maxLength={80} required /></Field>
            <Field label="Slug (URL)" htmlFor="c-slug" hint={catForm.id ? 'Laisser vide pour conserver l’actuel' : 'Généré depuis le nom si vide'}>
              <Input id="c-slug" value={catForm.slug} onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })} maxLength={80} placeholder="ex. telephones-technologie" />
            </Field>
            <Field label="Catégorie parente" htmlFor="c-parent" hint="Choisir une racine crée une sous-catégorie (un seul niveau)">
              <Select id="c-parent" value={catForm.parentId} onChange={(e) => setCatForm({ ...catForm, parentId: e.target.value })}>
                <option value="">— Catégorie principale —</option>
                {categories.filter((c) => !c.parentId && c.id !== catForm.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Description publique" htmlFor="c-desc" hint="Affichée sur la page catégorie">
              <Textarea id="c-desc" rows={2} value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} maxLength={500} />
            </Field>
            <Field label="Image (URL)" htmlFor="c-img" hint="Illustration de la carte catégorie">
              <Input id="c-img" value={catForm.imageUrl} onChange={(e) => setCatForm({ ...catForm, imageUrl: e.target.value })} maxLength={400} placeholder="https://…" />
            </Field>
            <Field label="Position (ordre d'affichage)" htmlFor="c-pos"><Input id="c-pos" type="number" min={0} max={99} value={catForm.position} onChange={(e) => setCatForm({ ...catForm, position: e.target.value })} /></Field>
            <label className={`flex items-center gap-2 text-sm font-semibold ${catForm.archived ? 'opacity-50 pointer-events-none' : ''}`}>
              <input type="checkbox" className="w-4 h-4 accent-brand-accent" checked={catForm.active && !catForm.archived} onChange={(e) => setCatForm({ ...catForm, active: e.target.checked })} disabled={catForm.archived} />Visible dans la boutique
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="w-4 h-4 accent-red-600" checked={catForm.archived} onChange={(e) => setCatForm({ ...catForm, archived: e.target.checked })} />Archiver (aucune suppression physique)
            </label>
            {catForm.archived && <p className="text-xs text-brand-text-muted bg-brand-bg rounded-xl p-3">La catégorie est retirée de la navigation. Les produits restent intacts (commandes et historique conservés).</p>}
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  /** Changement de statut direct depuis la file : gardes métier côté serveur. */
  const changeStatus = async (order: MarketOrderSummaryDto, to: MarketOrderStatus) => {
    setBusyId(order.id); setError('');
    try {
      await updateMarketOrderStatus(order.id, to);
      reload();
    } catch (e) {
      setError(`${order.orderNumber} — ${e instanceof Error ? e.message : 'Changement refusé.'}`);
    } finally { setBusyId(null); }
  };

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
          {error && (
            <p role="alert" className="m-4 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-medium">{error}</p>
          )}
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
                <OrderRow key={o.id} order={o} busy={busyId === o.id} onStatusChange={changeStatus} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrderRow({ order: o, busy, onStatusChange }: {
  order: MarketOrderSummaryDto; busy?: boolean; onStatusChange?: (order: MarketOrderSummaryDto, to: MarketOrderStatus) => void;
}) {
  const exception = ['DELAYED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'SUPPLY_FAILED'].includes(o.status);
  const transitions = onStatusChange ? (MARKET_TRANSITIONS[o.status] ?? []) : [];
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
        {transitions.length > 0 && (
          <>
            <label className="sr-only" htmlFor={`mkt-st-quick-${o.id}`}>Changer le statut de {o.orderNumber}</label>
            <select
              id={`mkt-st-quick-${o.id}`}
              value=""
              disabled={busy}
              onChange={(e) => {
                const to = e.target.value as MarketOrderStatus;
                if (to && onStatusChange) void onStatusChange(o, to);
              }}
              className="mt-1.5 block w-full max-w-[11.5rem] text-xs font-semibold border border-brand-border rounded-lg px-2 py-1.5 bg-white cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            >
              <option value="">Changer…</option>
              {transitions.map((s) => (
                <option key={s} value={s}>{MARKET_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </>
        )}
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
                <p className="font-semibold">{i.productName} <span className="text-brand-text-muted">×{i.quantity}</span>{i.variantLabel ? <span className="text-brand-text-muted"> · {i.variantLabel}</span> : null}</p>
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
              <dt>{i.productName}{i.variantLabel ? <span className="text-brand-text-muted"> · {i.variantLabel}</span> : null} ×{i.quantity}</dt>
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
            <span className="flex-1 min-w-0"><strong>{i.productName}</strong>{i.variantLabel ? <span className="text-brand-text-muted"> · {i.variantLabel}</span> : null} ×{i.quantity}</span>
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
