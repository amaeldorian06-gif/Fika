import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, FileText, Loader2, MessageCircle, Paperclip, X } from 'lucide-react';
import { Button } from './ui';
import { Field, Input, Textarea, Select } from './forms';
import { Link } from '../router';
import { simpleRequestSchema } from '../lib/simple-request';
import { captureLeadContext, normalizePhoneE164, URGENCY_OPTIONS } from '../lib/lead';
import { getServiceById, getServiceBySlug } from '../lib/catalog';
import { getWALink } from '../lib/whatsapp';
import { WHATSAPP_PHONE_E164, SITE_CITY } from '../lib/site';
import { trackFunnelStep } from '../lib/tracking';

const DRAFT_KEY = 'fika:request-draft:v2';
const empty = { need: '', zoneName: '', phone: '', name: '', urgency: 'FLEXIBLE', consent: false, serviceId: '', requestKey: '' };

/** Pièce jointe du parcours demande (téléversée avant soumission, puis liée au lead). */
type Upload = { key: string; label: string; required: boolean; name: string; fileId?: string; status: 'pending' | 'ok' | 'error'; error?: string };
const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';
const MAX_FILES = 3;
function initial() {
  let value = { ...empty };
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw) value = { ...value, ...JSON.parse(raw), consent: false };
    const params = new URLSearchParams(window.location.hash.split('?')[1]?.split('#')[0] ?? window.location.search);
    if (params.get('need')) value.need = params.get('need')!.slice(0, 2000);
    const service = getServiceById(params.get('service') ?? '') ?? getServiceBySlug(params.get('service') ?? '');
    if (service?.active) value.serviceId = service.id;
  } catch { /* Storage may be disabled; form remains usable. */ }
  value.requestKey ||= crypto.randomUUID();
  return value;
}

export function DemandePage() {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState('');
  const busy = useRef(false);
  const started = useRef(false);
  const set = (key: keyof typeof empty, value: string | boolean) => setValues(v => ({ ...v, [key]: value }));
  useEffect(() => {
    try { if (!code) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values)); } catch { /* Best effort, tab only. */ }
  }, [values, code]);
  const service = getServiceById(values.serviceId);
  // Exigences de type fichier du service sélectionné (catalogue réel) ;
  // sans service ou sans exigence fichier : un emplacement facultatif générique.
  const fileReqs = (service?.requirements ?? []).filter(r => r.kind === 'FILE');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const slots: { key: string; label: string; required: boolean }[] = fileReqs.length > 0
    ? fileReqs.map(r => ({ key: `req-${r.position}`, label: r.label, required: r.required }))
    : [{ key: 'generic', label: 'Photos ou documents utiles (facultatif)', required: false }];

  async function uploadFile(slot: { key: string; label: string }, file: File) {
    if (uploads.filter(u => u.status === 'ok').length >= MAX_FILES) return;
    setUploads(prev => [...prev.filter(u => u.key !== slot.key), { key: slot.key, label: slot.label, required: slots.find(x => x.key === slot.key)?.required ?? false, name: file.name, status: 'pending' }]);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('label', slot.label);
      const res = await fetch('/api/files/service-request', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message ?? 'Téléversement impossible.');
      setUploads(prev => prev.map(u => u.key === slot.key ? { ...u, fileId: data.fileId, status: 'ok' } : u));
    } catch (e) {
      setUploads(prev => prev.map(u => u.key === slot.key ? { ...u, status: 'error', error: e instanceof Error ? e.message : 'Téléversement impossible.' } : u));
    }
  }
  const message = `Bonjour Fika 👋\n${code ? `Demande ${code}\n` : ''}${values.need}\nVille : ${SITE_CITY}\nQuartier : ${values.zoneName}\nContact : ${values.phone}\n${values.name ? `Nom : ${values.name}\n` : ''}Délai souhaité : ${URGENCY_OPTIONS.find(u => u.id === values.urgency)?.label ?? 'Flexible'}`;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    setErrors({}); setError('');
    const parsed = simpleRequestSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach(i => { next[String(i.path[0])] ??= i.message; });
      setErrors(next);
      trackFunnelStep('VALIDATION_ERROR', { universe: 'services', field: Object.keys(next)[0] });
      document.getElementById(Object.keys(next)[0])?.focus();
      return;
    }
    // Exigences fichier requises : un téléversement réussi est nécessaire.
    const missingRequired = slots.filter(sl => sl.required && uploads.find(u => u.key === sl.key)?.status !== 'ok');
    const fileIds = uploads.filter(u => u.status === 'ok' && u.fileId).map(u => u.fileId!);
    if (missingRequired.length > 0 || fileIds.length > MAX_FILES) {
      setError(missingRequired.length > 0 ? `Joignez le document demandé : ${missingRequired[0].label}.` : `Maximum ${MAX_FILES} fichiers.`);
      return;
    }
    busy.current = true; setPending(true);
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        ...parsed.data, requestKey: values.requestKey, phone: normalizePhoneE164(parsed.data.phone), cityName: SITE_CITY,
        fileIds: fileIds.length > 0 ? fileIds : undefined,
        deadline: URGENCY_OPTIONS.find(u => u.id === parsed.data.urgency)?.label,
        serviceId: service?.id, serviceName: service?.name, context: captureLeadContext(),
      }) });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.leadCode) throw new Error(data.message ?? 'Enregistrement non confirmé.');
      setCode(data.leadCode);
      trackFunnelStep('REQUEST_SUBMITTED', { universe: 'services' });
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
    } catch {
      setError('Votre demande n’a pas pu être confirmée. Réessayez ou transmettez-la à Fika sur WhatsApp. Vos champs sont conservés.');
    } finally { busy.current = false; setPending(false); }
  }
  if (code) return <section className="max-w-xl mx-auto px-5 py-16">
    <CheckCircle2 className="text-brand-wa w-10 h-10 mb-5" />
    <h1 className="text-3xl font-heading font-bold">Votre demande est bien reçue.</h1>
    <p className="mt-4 text-brand-text-muted">Fika va examiner votre besoin, rechercher la solution adaptée et revenir vers vous par téléphone ou WhatsApp.</p>
    <p className="my-5 font-mono">Référence : {code}</p>
    <Button asChild variant="whatsapp"><a href={getWALink(message)} target="_blank" rel="noopener noreferrer">Parler à Fika sur WhatsApp</a></Button>
    <a href={`tel:${WHATSAPP_PHONE_E164}`} className="block underline py-4">Appeler Fika</a>
    <Link to="/" className="underline">Retour à l’accueil</Link>
  </section>;
  return <section className="max-w-xl mx-auto px-5 py-10 sm:py-14">
    <p className="text-sm text-brand-accent font-semibold mb-3">{SITE_CITY} · Sans compte à créer</p>
    <h1 className="text-3xl font-heading font-bold">Que devons-nous résoudre ?</h1>
    <p className="text-brand-text-muted mt-3 mb-7">Pas besoin de connaître le métier. Expliquez simplement ce qui vous arrive.</p>
    {service && <p className="mb-4 text-sm">Votre point de départ : {service.name}. Vous pouvez décrire librement votre besoin.</p>}
    <form onSubmit={submit} noValidate className="space-y-5" onFocus={() => { if (!started.current) { started.current = true; trackFunnelStep('FORM_STARTED', { universe: 'services' }); } }}>
      <Field label="Votre besoin" htmlFor="need" required error={errors.need}><Textarea id="need" value={values.need} onChange={e => set('need', e.target.value)} maxLength={2000} rows={4} placeholder="Mon téléphone ne charge plus…" required aria-invalid={!!errors.need} /></Field>
      <fieldset className="border-y border-brand-border py-4">
        <legend className="text-sm font-semibold py-2">Pièces jointes</legend>
        <p className="text-xs text-brand-text-muted mb-3">PDF, JPG, PNG ou WebP — {MAX_FILES} fichiers maximum{service ? '' : ' (facultatif)'}. Ils ne sont visibles que par l'équipe Fika.</p>
        <div className="space-y-3">
          {slots.map(slot => {
            const up = uploads.find(u => u.key === slot.key);
            return <div key={slot.key}>
              <label className="block text-sm font-medium mb-1.5" htmlFor={`file-${slot.key}`}>{slot.label}{slot.required ? ' *' : ''}</label>
              {up ? (
                <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${up.status === 'ok' ? 'border-brand-wa/40 bg-brand-wa/5' : up.status === 'error' ? 'border-red-200 bg-red-50' : 'border-brand-border bg-white'}`}>
                  {up.status === 'pending' ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" /> : up.status === 'ok' ? <FileText className="w-4 h-4 text-brand-wa shrink-0" aria-hidden="true" /> : <Paperclip className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{up.name}</span>
                    {up.status === 'error' && <span role="alert" className="block text-xs text-red-700">{up.error}</span>}
                  </span>
                  <button type="button" aria-label={`Retirer ${up.name}`} onClick={() => setUploads(prev => prev.filter(u => u.key !== slot.key))} className="p-1.5 -m-1 rounded-lg hover:bg-brand-bg cursor-pointer text-brand-text-muted"><X className="w-4 h-4" aria-hidden="true" /></button>
                </div>
              ) : (
                <>
                  <input id={`file-${slot.key}`} type="file" accept={FILE_ACCEPT} className="block w-full text-sm text-brand-text-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand-bg file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-text hover:file:bg-brand-border/40 cursor-pointer" onChange={e => { const f = e.target.files?.[0]; if (f) void uploadFile(slot, f); e.target.value = ''; }} />
                  {up === undefined && slot.required && <p className="text-xs text-brand-text-muted mt-1">Document nécessaire pour traiter votre demande.</p>}
                </>
              )}
            </div>;
          })}
        </div>
      </fieldset>
      <Field label="Dans quel quartier ?" htmlFor="zoneName" required error={errors.zoneName}><Input id="zoneName" value={values.zoneName} onChange={e => set('zoneName', e.target.value)} maxLength={160} placeholder="Quartier ou repère à Ngaoundéré" required aria-invalid={!!errors.zoneName} /></Field>
      <Field label="Votre téléphone / WhatsApp" htmlFor="phone" required error={errors.phone}><Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={e => set('phone', e.target.value)} placeholder="6 XX XX XX XX" maxLength={32} required aria-invalid={!!errors.phone} /></Field>
      <details className="border-y border-brand-border py-3"><summary className="cursor-pointer py-2 text-sm font-semibold">Préciser votre nom et l’urgence (facultatif)</summary><div className="space-y-4 pt-4">
        <Field label="Votre nom" htmlFor="name" error={errors.name}><Input id="name" autoComplete="name" value={values.name} onChange={e => set('name', e.target.value)} maxLength={80} /></Field>
        <Field label="Quand en avez-vous besoin ?" htmlFor="urgency"><Select id="urgency" value={values.urgency} onChange={e => set('urgency', e.target.value)}>{URGENCY_OPTIONS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}</Select></Field>
        <p className="text-xs text-brand-text-muted">Le délai reste à confirmer avec Fika.</p>
      </div></details>
      <label className="flex items-start gap-3 py-2 text-sm"><input id="consent" type="checkbox" className="mt-1 w-5 h-5 accent-brand-accent" checked={values.consent} onChange={e => set('consent', e.target.checked)} aria-describedby={errors.consent ? 'consent-error' : undefined} /><span>J’accepte que Fika utilise ces informations pour traiter ma demande et me recontacter. <Link to="/confidentialite" className="underline">Confidentialité</Link></span></label>
      {errors.consent && <p id="consent-error" role="alert" className="text-red-700 text-sm">{errors.consent}</p>}
      <p className="text-sm text-brand-text-muted">Nous précisons le besoin et le prix avec vous avant toute intervention.</p>
      {error && <p role="alert" className="rounded-xl p-4 bg-red-50 text-red-700">{error}</p>}
      <Button type="submit" size="lg" className="w-full rounded-xl" disabled={pending}>{pending ? 'Envoi en cours…' : error ? 'Réessayer' : 'Envoyer ma demande'}<ArrowRight className="w-4 h-4 ml-2" /></Button>
      <a href={getWALink(message)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3 text-brand-wa font-semibold text-sm"><MessageCircle size={18} />{error ? 'Envoyer sur WhatsApp' : 'Je préfère parler sur WhatsApp'}</a>
    </form>
  </section>;
}
