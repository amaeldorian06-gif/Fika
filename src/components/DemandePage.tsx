import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CheckCircle2, Clock, Loader2, MessageCircle,
  ShieldCheck, Truck, WifiOff,
} from 'lucide-react';
import { Link } from '../router';
import { getWALink } from '../lib/whatsapp';
import { compileLeadMessage } from '../lib/whatsapp/engine';
import { trackWaClick } from '../lib/tracking';
import {
  BUDGET_RANGES, getBudgetRange, maskPhoneE164, toLeadPayload,
  leadFormSchema, type LeadFormInput, type LeadFormValues,
} from '../lib/lead';
import { OTHER_ZONE_VALUE, getZonesForCity, isOnlyOneActiveCity } from '../lib/city';
import { getActiveCities } from '../lib/site';
import { getServiceById, getServices } from '../lib/catalog';
import { DELIVERY_PROMISE } from '../lib/site';
import { Button } from './ui';
import { Checkbox, Field, Input, Select, Textarea } from './forms';

/* --------------------------- Écran de confirmation ------------------------- */

interface ResultState {
  mode: 'saved' | 'fallback';
  leadCode: string | null;
  values: LeadFormValues;
  serviceName?: string;
}

function Recap({ result }: { result: ResultState }) {
  const { values } = result;
  const payload = toLeadPayload(values, result.serviceName);
  const budget = getBudgetRange(values.budgetRange);

  const rows: [string, string][] = [
    ['Besoin', values.need],
    ['Ville / Quartier', `${payload.cityName} / ${payload.zoneName}`],
  ];
  if (result.serviceName) rows.push(['Service', result.serviceName]);
  if (values.deadline) rows.push(['Délai souhaité', values.deadline]);
  if (budget.min !== null || budget.max !== null) rows.push(['Budget estimé', budget.label]);
  if (values.name) rows.push(['Nom', values.name]);
  if (payload.phone) rows.push(['Téléphone', maskPhoneE164(payload.phone)]);

  return (
    <dl className="divide-y divide-brand-border border border-brand-border rounded-2xl overflow-hidden bg-brand-bg">
      {rows.map(([label, value]) => (
        <div key={label} className="px-5 py-3.5 grid grid-cols-3 gap-4">
          <dt className="text-xs font-bold uppercase tracking-wider text-brand-text-muted pt-0.5">{label}</dt>
          <dd className="col-span-2 text-sm font-medium text-brand-text whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function waMessageFor(result: ResultState): string {
  const budget = getBudgetRange(result.values.budgetRange);
  const payload = toLeadPayload(result.values, result.serviceName);
  return compileLeadMessage({
    need: result.values.need,
    serviceName: result.serviceName,
    city: payload.cityName,
    zone: payload.zoneName,
    deadline: result.values.deadline || undefined,
    budgetLabel: budget.min !== null || budget.max !== null ? budget.label : undefined,
    name: result.values.name || undefined,
    leadCode: result.leadCode,
  });
}

function Confirmation({ result, onReset }: { result: ResultState; onReset: () => void }) {
  const saved = result.mode === 'saved';
  const waMessage = waMessageFor(result);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-brand-surface p-8 sm:p-12 rounded-3xl shadow-premium border border-brand-border"
    >
      <div className="text-center mb-10">
        <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-6 ${saved ? 'bg-brand-wa/10' : 'bg-amber-50'}`}>
          {saved
            ? <CheckCircle2 className="w-8 h-8 text-brand-wa" />
            : <WifiOff className="w-8 h-8 text-amber-600" />}
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-3 text-brand-text">
          {saved ? 'Demande envoyée.' : 'Connexion instable.'}
        </h1>
        <p className="text-brand-text-muted max-w-md mx-auto leading-relaxed">
          {saved ? (
            <>
              Votre demande est enregistrée sous la référence{' '}
              <strong className="font-heading font-bold text-brand-text bg-brand-bg border border-brand-border px-2.5 py-0.5 rounded-lg">
                {result.leadCode}
              </strong>
              . Notre équipe vous répond sous 2 h ouvrées.
            </>
          ) : (
            <>
              Votre demande n&apos;a pas pu être enregistrée (hors-ligne). Pas d&apos;inquiétude :
              WhatsApp s&apos;est ouvert avec votre message complet, mention « non enregistrée » incluse.
            </>
          )}
        </p>
      </div>

      <Recap result={result} />

      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <Button asChild variant="whatsapp" size="lg" className="flex-1 rounded-full">
          <a
            href={getWALink(waMessage)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWaClick({ context: 'demande', campaign: result.leadCode })}
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            {saved ? 'Confirmer sur WhatsApp' : 'Renvoyer sur WhatsApp'}
          </a>
        </Button>
        <Button variant="outline" size="lg" className="flex-1 rounded-full" onClick={onReset}>
          Faire une autre demande
        </Button>
      </div>

      <p className="text-xs text-center text-brand-text-muted mt-6 flex items-center justify-center gap-2">
        <Truck className="w-4 h-4 text-brand-accent" /> {DELIVERY_PROMISE}.
      </p>
    </motion.div>
  );
}

/* ------------------------------ Le tunnel --------------------------------- */

export function DemandePage() {
  const [result, setResult] = useState<ResultState | null>(null);

  const services = getServices();
  const {
    register, handleSubmit, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormInput, unknown, LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      need: '', serviceId: '', citySlug: getActiveCities()[0].slug, zone: '',
      zoneOther: '', deadline: '', budgetRange: 'unknown', name: '', phone: '', consent: false,
    },
  });

  const zone = watch('zone');
  const need = watch('need');
  const citySlug = watch('citySlug');
  const cities = getActiveCities();
  const zoneGroups = getZonesForCity(citySlug);

  const onSubmit = async (values: LeadFormValues) => {
    const serviceName = values.serviceId ? getServiceById(values.serviceId)?.name : undefined;
    const payload = toLeadPayload(values, serviceName);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('lead_rejected');
      const data = (await res.json()) as { ok: boolean; leadCode?: string };
      if (!data.ok || !data.leadCode) throw new Error('lead_rejected');
      setResult({ mode: 'saved', leadCode: data.leadCode, values, serviceName });
    } catch {
      // Repli gracieux : le message part quand même, marqué « non enregistrée ».
      const fallback: ResultState = { mode: 'fallback', leadCode: null, values, serviceName };
      trackWaClick({ context: 'demande' });
      window.open(getWALink(waMessageFor(fallback)), '_blank');
      setResult(fallback);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen pt-8 pb-16 bg-brand-bg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Confirmation
            result={result}
            onReset={() => { reset(); setResult(null); }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-8 pb-16 bg-brand-bg">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center text-sm font-medium text-brand-text-muted hover:text-brand-accent mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour à l&apos;accueil
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-surface p-8 sm:p-12 rounded-3xl shadow-premium border border-brand-border"
        >
          <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-4 text-brand-text">Décrivez votre besoin</h1>
          <p className="text-lg text-brand-text-muted mb-8">
            Dites-nous simplement ce que vous cherchez. Nous qualifions la demande et revenons vers vous avec une solution et un prix.
          </p>

          {/* Réassurance */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
            {[
              { Icon: Clock, label: 'Réponse sous 2 h ouvrées' },
              { Icon: Truck, label: DELIVERY_PROMISE },
              { Icon: ShieldCheck, label: 'Interlocuteur unique Fika' },
            ].map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-3 p-3.5 rounded-xl bg-brand-bg border border-brand-border">
                <Icon className="w-4 h-4 text-brand-accent shrink-0" />
                <span className="text-xs font-semibold text-brand-text-muted leading-snug">{label}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <Field
              label="Qu'avez-vous besoin de faire ?"
              htmlFor="need"
              required
              error={errors.need?.message}
              hint={`${need?.length ?? 0}/2 000 caractères`}
            >
              <Textarea
                id="need"
                rows={4}
                invalid={!!errors.need}
                placeholder="Ex: Je souhaite faire traduire un document de 10 pages..."
                {...register('need')}
              />
            </Field>

            <Field label="Service concerné (si vous savez)" htmlFor="serviceId" hint="Laissez vide si vous hésitez — nous qualifierons pour vous.">
              <Select id="serviceId" {...register('serviceId')}>
                <option value="">Je ne sais pas encore</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Ville : sélecteur MASQUÉ tant qu'une seule ville est opérée
                  (P11 — ne pas créer de faux choix à l'utilisateur). */}
              <Field label="Ville" htmlFor="citySlug" required error={errors.citySlug?.message}>
                {isOnlyOneActiveCity() ? (
                  <div
                    className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-bg text-sm font-semibold text-brand-text flex items-center justify-between"
                    aria-readonly="true"
                  >
                    {cities[0].name}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-wa bg-brand-wa/10 px-2 py-0.5 rounded-full">Notre zone</span>
                  </div>
                ) : (
                  <Select id="citySlug" invalid={!!errors.citySlug} {...register('citySlug')}>
                    {cities.map((c) => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label="Quartier" htmlFor="zone" required error={errors.zone?.message}>
                <Select id="zone" invalid={!!errors.zone} {...register('zone')}>
                  <option value="" disabled>Sélectionnez…</option>
                  {zoneGroups.map((group) => (
                    <optgroup key={group.commune} label={group.commune}>
                      {group.names.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </optgroup>
                  ))}
                  <option value={OTHER_ZONE_VALUE}>Autre / je précise</option>
                </Select>
              </Field>
            </div>

            {zone === OTHER_ZONE_VALUE && (
              <Field label="Précisez votre quartier" htmlFor="zoneOther" required error={errors.zoneOther?.message}>
                <Input
                  id="zoneOther"
                  invalid={!!errors.zoneOther}
                  placeholder="Ex: cité derrière la gare, Avenue Ahmadou Ahidjo..."
                  {...register('zoneOther')}
                />
              </Field>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Field label="Délai souhaité (optionnel)" htmlFor="deadline" error={errors.deadline?.message}>
                <Input
                  id="deadline"
                  placeholder="Ex: le plus tôt possible, la semaine prochaine..."
                  {...register('deadline')}
                />
              </Field>

              <Field label="Budget estimé (optionnel)" htmlFor="budgetRange">
                <Select id="budgetRange" {...register('budgetRange')}>
                  {BUDGET_RANGES.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Field label="Votre nom (optionnel)" htmlFor="name" error={errors.name?.message}>
                <Input id="name" placeholder="Ex: Aminata T." {...register('name')} />
              </Field>

              <Field
                label="Téléphone WhatsApp (optionnel)"
                htmlFor="phone"
                error={errors.phone?.message}
                hint="Pour vous recontacter. Format : +237 6 XX XX XX XX."
              >
                <Input
                  id="phone"
                  type="tel"
                  invalid={!!errors.phone}
                  placeholder="+237 6 12 34 56 78"
                  {...register('phone')}
                />
              </Field>
            </div>

            <Field label="" htmlFor="consent" error={errors.consent?.message}>
              <Checkbox
                id="consent"
                invalid={!!errors.consent}
                {...register('consent')}
                label={
                  <>
                    J&apos;accepte d&apos;être recontacté(e) au sujet de ma demande et je reconnais avoir pris
                    connaissance des{' '}
                    <Link to="/cgv" className="font-bold text-brand-accent hover:underline">
                      Conditions Générales de Vente
                    </Link>{' '}
                    et de la{' '}
                    <Link to="/confidentialite" className="font-bold text-brand-accent hover:underline">
                      politique de confidentialité
                    </Link>
                    .
                  </>
                }
                description="Vos informations servent uniquement à traiter votre demande et ne sont ni vendues ni partagées (loi n° 2024/017). Vous pouvez les faire supprimer à tout moment."
              />
            </Field>

            {/* Information légale : droit de rétractation (loi 2010/021) */}
            <p className="text-xs text-brand-text-muted leading-relaxed bg-brand-bg border border-brand-border rounded-xl p-4">
              <strong className="font-heading font-bold text-brand-text">Information sur votre droit de rétractation.</strong>{' '}
              Vous disposez d&apos;un délai de 15 jours à compter de la commande pour vous rétracter, sans pénalité.
              Ce droit ne s&apos;applique pas si vous demandez une exécution immédiate ou une prestation personnalisée
              (voir CGV, art. 8) — dans ce cas, une confirmation vous sera demandée avant lancement.
            </p>

            <Button
              type="submit"
              variant="whatsapp"
              size="lg"
              disabled={isSubmitting}
              className="w-full rounded-full"
            >
              {isSubmitting && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
              {isSubmitting ? 'Envoi en cours...' : 'Envoyer ma demande'}
            </Button>

            <p className="text-xs text-center text-brand-text-muted">
              En cas de coupure réseau, WhatsApp s&apos;ouvre automatiquement avec votre message prérempli.
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
