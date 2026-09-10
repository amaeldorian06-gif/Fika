import { useEffect, useRef, useState } from 'react';
import { type AdminExpert, saveExpert } from '../../lib/admin/api';
import { createExpertSchema } from '../../lib/admin/experts';
import { EXPERT_STATUS_LABELS } from '../../lib/admin/status';
import { Button } from '../ui';
import { Checkbox, Field, Input, Select } from '../forms';

export function ExpertForm({ expert, onSaved, onCancel }: { expert: AdminExpert | null; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(expert?.name ?? '');
  const [phone, setPhone] = useState(expert?.phone ?? '');
  const [skills, setSkills] = useState(expert?.skills.join(', ') ?? '');
  const [zone, setZone] = useState(expert?.zone ?? '');
  const [cost, setCost] = useState(expert?.usualCost?.toString() ?? '');
  const [available, setAvailable] = useState(expert?.availability ?? true);
  const [status, setStatus] = useState(expert?.status ?? 'ACTIVE');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  return <form className="mb-6 bg-brand-surface border border-brand-border rounded-2xl p-6" onSubmit={async e => {
    e.preventDefault(); if (pending) return;
    setError(null);
    const parsed = createExpertSchema.safeParse({ name, phone, skills: [...new Set(skills.split(',').map(s => s.trim()).filter(Boolean))], zone: zone.trim() || null, usualCost: cost === '' ? null : Number(cost), availability: available, status });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setPending(true);
    try { await saveExpert({ ...parsed.data, ...(expert ? { expertId: expert.id } : {}) }); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Fiche non enregistrée.'); }
    finally { setPending(false); }
  }}>
    <h2 className="font-heading font-bold text-brand-text mb-4">{expert ? 'Modifier le partenaire' : 'Ajouter un partenaire'}</h2>
    {error && <p role="alert" className="text-red-700 text-sm mb-4">{error}</p>}
    <fieldset disabled={pending} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Nom" htmlFor="expert-name" required><Input ref={nameRef} id="expert-name" required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Téléphone" htmlFor="expert-phone" required hint="Ex. +237 6 XX XX XX XX, ou le numéro local à 9 chiffres."><Input id="expert-phone" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} /></Field>
      <Field label="Compétences" htmlFor="expert-skills" hint="Séparées par des virgules, 20 maximum."><Input id="expert-skills" value={skills} maxLength={1220} onChange={e => setSkills(e.target.value)} placeholder="Design, impression, maintenance" /></Field>
      <Field label="Zone habituelle" htmlFor="expert-zone"><Input id="expert-zone" maxLength={120} value={zone} onChange={e => setZone(e.target.value)} /></Field>
      <Field label="Coût habituel (FCFA)" htmlFor="expert-cost" hint="Laisser vide si à négocier."><Input id="expert-cost" type="number" min={0} max={100000000} step={1} value={cost} onChange={e => setCost(e.target.value)} /></Field>
      <Field label="Statut" htmlFor="expert-status"><Select id="expert-status" value={status} onChange={e => setStatus(e.target.value)}>{Object.entries(EXPERT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
      <div className="sm:col-span-2"><Checkbox id="expert-available" checked={available} onChange={e => setAvailable(e.target.checked)} label="Disponible pour une nouvelle mission" description="Une mission active bloque la remise en disponibilité. Un statut suspendu ou en pause empêche l’affectation." /></div>
      <div className="sm:col-span-2 flex gap-3 flex-wrap">
        <Button type="submit" variant="primary" disabled={pending}>{pending ? 'Enregistrement…' : 'Enregistrer le partenaire'}</Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>Annuler</Button>
      </div>
    </fieldset>
  </form>;
}
