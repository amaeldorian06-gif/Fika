import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, FileText, Loader2, MessageCircle, PackageSearch, Paperclip, X } from 'lucide-react';
import { z } from 'zod';
import { Button } from './ui';
import { Field, Input, Textarea } from './forms';
import { Link } from '../router';
import { captureLeadContext, normalizePhoneE164 } from '../lib/lead';
import { getWALink } from '../lib/whatsapp';
import { trackFunnelStep } from '../lib/tracking';
import { WHATSAPP_PHONE_E164, SITE_CITY } from '../lib/site';

/**
 * Demande de produit (/demande-produit) — le catalogue Market n'expose pas
 * encore de produits : cette page remplace le cul-de-sac par un vrai parcours.
 * Le visiteur décrit le produit cherché (photo ou lien facultatifs), la
 * quantité et le quartier de livraison. La demande devient un Lead marqué
 * intent=PRODUCT : l'équipe vérifie disponibilité et prix AVANT tout
 * engagement — jamais de promesse de stock, de prix ou de délai ici.
 */

const DRAFT_KEY = 'fika:product-inquiry-draft:v1';
const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';

const inquirySchema = z.object({
  product: z.string().trim().min(3, 'Décrivez le produit en quelques mots.').max(1000, '1 000 caractères maximum.'),
  link: z.string().trim().max(300, 'Lien trop long (300 caractères max).').refine(v => !v || /^https?:\/(\/|$)/.test(v) || /^[A-Za-z0-9][A-Za-z0-9 ._-]*$/.test(v), 'Collez un lien (https://…) ou une référence courte.'),
  quantity: z.string().trim().refine(v => !v || (/^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 99), 'Quantité entre 1 et 99.'),
  zoneName: z.string().trim().min(2, 'Indiquez votre quartier ou un repère.').max(160),
  phone: z.string().trim().refine(v => !!normalizePhoneE164(v), 'Utilisez un numéro comme 6 XX XX XX XX.'),
  name: z.string().trim().max(80).default(''),
  consent: z.literal(true, { message: 'Votre accord est nécessaire pour être recontacté.' }),
});

const empty = { product: '', link: '', quantity: '', zoneName: '', phone: '', name: '', consent: false, requestKey: '' };

type Upload = { name: string; fileId?: string; status: 'pending' | 'ok' | 'error'; error?: string };

function initial() {
  let value = { ...empty };
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw) value = { ...value, ...JSON.parse(raw), consent: false };
  } catch { /* Storage may be disabled; form remains usable. */ }
  value.requestKey ||= crypto.randomUUID();
  return value;
}

export function ProductInquiryPage() {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState('');
  const [upload, setUpload] = useState<Upload | null>(null);
  const started = useRef(false);
  const busy = useRef(false);
  const set = (key: keyof typeof empty, value: string | boolean) => setValues(v => ({ ...v, [key]: value }));

  useEffect(() => {
    try { if (!code) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values)); } catch { /* Best effort. */ }
  }, [values, code]);

  const onFirstFocus = () => {
    if (started.current) return;
    started.current = true;
    trackFunnelStep('INQUIRY_STARTED', { universe: 'market' });
  };

  async function uploadPhoto(file: File) {
    setUpload({ name: file.name, status: 'pending' });
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('label', 'Photo du produit recherché (facultatif)');
      const res = await fetch('/api/files/service-request', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message ?? 'Téléversement impossible.');
      setUpload({ name: file.name, fileId: data.fileId, status: 'ok' });
    } catch (e) {
      setUpload({ name: file.name, status: 'error', error: e instanceof Error ? e.message : 'Téléversement impossible.' });
    }
  }

  const message = `Bonjour Fika 👋
Je cherche ce produit : ${values.product}${values.quantity ? ` (quantité : ${values.quantity})` : ''}${values.link ? `
Lien / référence : ${values.link}` : ''}
Quartier de livraison : ${values.zoneName}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    setErrors({}); setError('');
    const parsed = inquirySchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach(i => { next[String(i.path[0])] ??= i.message; });
      setErrors(next);
      trackFunnelStep('VALIDATION_ERROR', { universe: 'market', field: Object.keys(next)[0] });
      document.getElementById(Object.keys(next)[0])?.focus();
      return;
    }
    busy.current = true; setPending(true);
    const q = parsed.data.quantity ? Number(parsed.data.quantity) : undefined;
    const need = [
      `Produit recherché : ${parsed.data.product}`,
      q ? `Quantité souhaitée : ${q}` : null,
      parsed.data.link ? `Lien / référence : ${parsed.data.link}` : null,
    ].filter(Boolean).join('\n');
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        need, zoneName: parsed.data.zoneName, phone: normalizePhoneE164(parsed.data.phone), name: parsed.data.name || undefined,
        consent: true, intent: 'PRODUCT', productName: parsed.data.product.slice(0, 160),
        productLink: parsed.data.link || undefined, quantity: q, requestKey: values.requestKey,
        cityName: SITE_CITY, fileIds: upload?.status === 'ok' && upload.fileId ? [upload.fileId] : undefined,
        context: captureLeadContext(),
      }) });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.leadCode) throw new Error(data.message ?? 'Enregistrement non confirmé.');
      setCode(data.leadCode);
      trackFunnelStep('INQUIRY_SUBMITTED', { universe: 'market' });
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
    } catch {
      setError('Votre demande n’a pas pu être confirmée. Réessayez ou écrivez à Fika sur WhatsApp. Vos champs sont conservés.');
    } finally { busy.current = false; setPending(false); }
  }

  if (code) return <section className="max-w-xl mx-auto px-5 py-16">
    <CheckCircle2 className="text-brand-wa w-10 h-10 mb-5" />
    <h1 className="text-3xl font-heading font-bold">Votre demande produit est bien reçue.</h1>
    <p className="mt-4 text-brand-text-muted">Fika va vérifier la disponibilité et le prix de ce produit, puis vous répondre par téléphone ou WhatsApp. Rien n&apos;est commandé et rien n&apos;est payé avant votre accord sur le prix final.</p>
    <p className="my-5 font-mono">Référence : {code}</p>
    <Button asChild variant="whatsapp"><a href={getWALink(message)} target="_blank" rel="noopener noreferrer">Parler à Fika sur WhatsApp</a></Button>
    <a href={`tel:${WHATSAPP_PHONE_E164}`} className="block underline py-4">Appeler Fika</a>
    <Link to="/boutique" className="underline">Retour à la boutique</Link>
  </section>;

  return <section className="max-w-xl mx-auto px-5 py-10 sm:py-14">
    <p className="text-sm text-brand-accent font-semibold mb-3 flex items-center gap-2"><PackageSearch className="w-4 h-4" aria-hidden="true" /> {SITE_CITY} · Sans compte à créer</p>
    <h1 className="text-3xl font-heading font-bold">Quel produit cherchez-vous ?</h1>
    <p className="text-brand-text-muted mt-3 mb-7">Décrivez-le simplement. Nous vérifions sa disponibilité et son prix, puis nous vous confirmons le tout (produit + livraison) avant tout paiement.</p>
    <form onSubmit={submit} noValidate className="space-y-5" onFocus={onFirstFocus}>
      <Field label="Le produit recherché" htmlFor="product" required error={errors.product} hint="Ex. : écouteurs Bluetooth, régulateur 12V, sac de riz 25 kg…">
        <Textarea id="product" value={values.product} onChange={e => set('product', e.target.value)} maxLength={1000} rows={3} placeholder="Ex. : écouteurs Bluetooth pour la musique" required aria-invalid={!!errors.product} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Lien ou référence" htmlFor="link" error={errors.link} hint="Facultatif — si vous avez vu le produit ailleurs.">
          <Input id="link" value={values.link} onChange={e => set('link', e.target.value)} maxLength={300} placeholder="https://… ou référence" inputMode="url" aria-invalid={!!errors.link} />
        </Field>
        <Field label="Quantité" htmlFor="quantity" error={errors.quantity} hint="Facultatif — par défaut 1.">
          <Input id="quantity" value={values.quantity} onChange={e => set('quantity', e.target.value)} maxLength={2} placeholder="1" inputMode="numeric" aria-invalid={!!errors.quantity} />
        </Field>
      </div>
      <fieldset className="border-y border-brand-border py-4">
        <legend className="text-sm font-semibold py-2">Photo du produit (facultatif)</legend>
        <p className="text-xs text-brand-text-muted mb-3">JPG, PNG, WebP ou PDF — utile si vous avez une photo de ce que vous cherchez. Visible uniquement par l&apos;équipe Fika.</p>
        {upload ? (
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${upload.status === 'ok' ? 'border-brand-wa/40 bg-brand-wa/5' : upload.status === 'error' ? 'border-red-200 bg-red-50' : 'border-brand-border bg-white'}`}>
            {upload.status === 'pending' ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" /> : upload.status === 'ok' ? <FileText className="w-4 h-4 text-brand-wa shrink-0" aria-hidden="true" /> : <Paperclip className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />}
            <span className="flex-1 min-w-0">
              <span className="block truncate">{upload.name}</span>
              {upload.status === 'error' && <span role="alert" className="block text-xs text-red-700">{upload.error}</span>}
            </span>
            <button type="button" aria-label={`Retirer ${upload.name}`} onClick={() => setUpload(null)} className="p-2 -m-1 rounded-lg hover:bg-brand-bg cursor-pointer text-brand-text-muted"><X className="w-4 h-4" aria-hidden="true" /></button>
          </div>
        ) : (
          <input id="product-photo" type="file" accept={FILE_ACCEPT} className="block w-full text-sm text-brand-text-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand-bg file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-brand-text hover:file:bg-brand-border/40 cursor-pointer" onChange={e => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); e.target.value = ''; }} />
        )}
      </fieldset>
      <Field label="Quartier de livraison" htmlFor="zoneName" required error={errors.zoneName}>
        <Input id="zoneName" value={values.zoneName} onChange={e => set('zoneName', e.target.value)} maxLength={160} placeholder="Quartier ou repère à Ngaoundéré" required aria-invalid={!!errors.zoneName} />
      </Field>
      <Field label="Votre téléphone / WhatsApp" htmlFor="phone" required error={errors.phone}>
        <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={e => set('phone', e.target.value)} placeholder="6 XX XX XX XX" maxLength={32} required aria-invalid={!!errors.phone} />
      </Field>
      <details className="border-y border-brand-border py-3"><summary className="cursor-pointer py-2 text-sm font-semibold">Préciser votre nom (facultatif)</summary><div className="pt-4">
        <Field label="Votre nom" htmlFor="name" error={errors.name}><Input id="name" autoComplete="name" value={values.name} onChange={e => set('name', e.target.value)} maxLength={80} /></Field>
      </div></details>
      <label className="flex items-start gap-3 py-2 text-sm"><input id="consent" type="checkbox" className="mt-1 w-5 h-5 accent-brand-accent" checked={values.consent} onChange={e => set('consent', e.target.checked)} aria-describedby={errors.consent ? 'consent-error' : undefined} /><span>J&apos;accepte que Fika utilise ces informations pour traiter ma demande et me recontacter. <Link to="/confidentialite" className="underline">Confidentialité</Link></span></label>
      {errors.consent && <p id="consent-error" role="alert" className="text-red-700 text-sm">{errors.consent}</p>}
      <p className="text-sm text-brand-text-muted">Disponibilité et prix vous sont confirmés avant toute commande. Aucun paiement avant votre accord.</p>
      {error && <p role="alert" className="rounded-xl p-4 bg-red-50 text-red-700">{error}</p>}
      <Button type="submit" size="lg" className="w-full rounded-xl" disabled={pending}>{pending ? 'Envoi en cours…' : error ? 'Réessayer' : 'Envoyer ma demande produit'}<ArrowRight className="w-4 h-4 ml-2" /></Button>
      <a href={getWALink('Bonjour Fika Market 👋\nJe cherche un produit. Pouvez-vous me dire si vous pouvez le commander ?')} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3 text-brand-wa font-semibold text-sm"><MessageCircle size={18} /> Je préfère demander sur WhatsApp</a>
    </form>
  </section>;
}
