import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, MessageCircle,
  ShieldCheck, Truck, WifiOff, Camera, X,
  Sparkles, Wrench, Hammer, HelpCircle,
  MapPin, Info,
} from 'lucide-react';
import { Link } from '../router';
import { getWALink } from '../lib/whatsapp';
import { compileLeadMessage } from '../lib/whatsapp/engine';
import { trackWaClick } from '../lib/tracking';
import {
  BUDGET_RANGES, getBudgetRange, maskPhoneE164, toLeadPayload,
  leadFormSchema, type LeadFormInput, type LeadFormValues,
  URGENCY_OPTIONS, getUrgencyOption, type RequestTrack, type UrgencyLevel,
  CLIENT_TYPES, captureLeadContext,
} from '../lib/lead';
import { OTHER_ZONE_VALUE, getZonesForCity, isOnlyOneActiveCity } from '../lib/city';
import { getActiveCities } from '../lib/site';
import { getServiceById, getServices } from '../lib/catalog';
import { DELIVERY_PROMISE } from '../lib/site';
import { Button } from './ui';
import { Checkbox, Field, Input, Select, Textarea } from './forms';

/* --------------------------- Suggestions rapides --------------------------- */

interface QuickProblem {
  text: string;
  track: RequestTrack;
  urgency?: UrgencyLevel;
  serviceSlug?: string;
}

const QUICK_PROBLEMS: QuickProblem[] = [
  { text: 'Mon robinet fuit', track: 'RAPIDE', urgency: 'URGENT', serviceSlug: 'intervention-plomberie' },
  { text: "Je n'ai plus d'électricité dans une chambre", track: 'RAPIDE', urgency: 'URGENT', serviceSlug: 'intervention-electricite' },
  { text: 'Mon téléphone ne s\'allume plus', track: 'RAPIDE', urgency: 'TODAY', serviceSlug: 'reparation-telephone' },
  { text: 'Je veux construire un mur', track: 'TRAVAUX', serviceSlug: 'travaux-maconnerie' },
  { text: 'Ma voiture est en panne', track: 'RAPIDE', urgency: 'URGENT', serviceSlug: 'depannage-mecanique-auto' },
  { text: 'Je dois déplacer des meubles', track: 'RAPIDE', urgency: 'TODAY', serviceSlug: 'demenagement-local' },
  { text: "Je cherche quelqu'un pour poser du carrelage", track: 'TRAVAUX', serviceSlug: 'pose-carrelage' },
];

/* --------------------------- Écran de confirmation ------------------------- */

interface ResultState {
  mode: 'saved' | 'fallback';
  leadCode: string | null;
  values: LeadFormValues;
  serviceName?: string;
}

function Recap({ result }: { result: ResultState }) {
  const { values } = result;
  const payload = toLeadPayload(values, result.serviceName, captureLeadContext());
  const urgency = getUrgencyOption(values.urgency);
  const budget = getBudgetRange(values.budgetRange);

  const rows: [string, string][] = [
    ['Type de demande', values.track === 'TRAVAUX' ? 'Projet / Travaux' : 'Intervention rapide (Dépannage)'],
    ['Problème', values.need],
    ['Choix professionnel', values.dontKnowPro ? 'Sélection et coordination par Fika' : (result.serviceName || 'Spécifié par le client')],
  ];

  if (values.track === 'RAPIDE') {
    rows.push(['Niveau d’urgence', `${urgency.label} (${urgency.sublabel})`]);
  } else {
    if (values.dimensions) rows.push(['Dimensions / Quantité', values.dimensions]);
    if (values.deadline) rows.push(['Délai souhaité', values.deadline]);
    if (budget.min !== null || budget.max !== null) rows.push(['Budget indicatif', budget.label]);
  }

  const zoneLabel = values.landmark ? `${payload.zoneName}` : payload.zoneName;
  rows.push(['Ville / Lieu', `${payload.cityName} — ${zoneLabel}`]);

  if (values.photosCount > 0) {
    rows.push(['Photos', `${values.photosCount} photo(s) jointe(s)`]);
  }
  if (values.name) rows.push(['Nom', values.name]);
  if (payload.phone) rows.push(['Numéro de contact', maskPhoneE164(payload.phone)]);

  return (
    <dl className="divide-y divide-brand-border border border-brand-border rounded-2xl overflow-hidden bg-brand-bg text-left">
      {rows.map(([label, value]) => (
        <div key={label} className="px-5 py-3.5 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
          <dt className="text-xs font-bold uppercase tracking-wider text-brand-text-muted pt-0.5">{label}</dt>
          <dd className="sm:col-span-2 text-sm font-medium text-brand-text whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function waMessageFor(result: ResultState): string {
  const budget = getBudgetRange(result.values.budgetRange);
  const payload = toLeadPayload(result.values, result.serviceName, captureLeadContext());
  return compileLeadMessage({
    need: payload.need,
    serviceName: result.serviceName,
    city: payload.cityName,
    zone: payload.zoneName,
    deadline: payload.deadline,
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
      className="bg-brand-surface p-6 sm:p-12 rounded-3xl shadow-premium border border-brand-border"
    >
      <div className="text-center mb-8">
        <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-5 ${saved ? 'bg-brand-wa/10 text-brand-wa' : 'bg-amber-50 text-amber-600'}`}>
          {saved
            ? <CheckCircle2 className="w-8 h-8" />
            : <WifiOff className="w-8 h-8" />}
        </div>

        {/* Messages contractuels et clairs selon le cahier des charges */}
        <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-3 text-brand-text">
          {saved ? 'Votre demande a bien été reçue.' : 'Votre demande est prête à être envoyée.'}
        </h1>

        <div className="max-w-xl mx-auto space-y-2 mb-6">
          <p className="text-base font-semibold text-brand-text">
            Fika va qualifier votre besoin et rechercher la bonne personne.
          </p>
          <p className="text-sm text-brand-text-muted leading-relaxed">
            Nous vous recontactons sur WhatsApp ou par téléphone dès que votre demande est examinée.
          </p>
          <p className="text-sm text-brand-text-muted leading-relaxed">
            Le prix final vous est confirmé par devis avant toute intervention (professionnel, déplacement et
            matériel compris). Rien n'est engagé sans votre accord.
          </p>
        </div>

        {saved && result.leadCode && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-bg border border-brand-border text-xs font-semibold text-brand-text mb-2">
            <span>Numéro de référence :</span>
            <strong className="font-mono text-brand-accent text-sm font-bold tracking-wide">
              {result.leadCode}
            </strong>
          </div>
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-3 text-left">
          Récapitulatif de votre demande
        </h2>
        <Recap result={result} />
      </div>

      {/* Action WhatsApp prioritaire */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild variant="whatsapp" size="lg" className="flex-1 rounded-xl h-13 shadow-md">
          <a
            href={getWALink(waMessage)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWaClick({ context: 'demande', campaign: result.leadCode })}
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Ouvrir la conversation WhatsApp
          </a>
        </Button>
        <Button variant="outline" size="lg" className="rounded-xl h-13" onClick={onReset}>
          Poser une autre question
        </Button>
      </div>

      <div className="mt-6 pt-6 border-t border-brand-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-brand-text-muted">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-brand-accent" />
          Un seul interlocuteur : Fika prend en charge la relation de A à Z.
        </span>
        <span className="flex items-center gap-1.5">
          <Truck className="w-4 h-4 text-brand-accent" />
          {DELIVERY_PROMISE}.
        </span>
      </div>
    </motion.div>
  );
}

/* ------------------------------ Le tunnel adaptatif --------------------------------- */

export function DemandePage() {
  const [result, setResult] = useState<ResultState | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [uploadedPhotos, setUploadedPhotos] = useState<{ name: string; preview: string }[]>([]);
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);

  const services = getServices();
  const cities = getActiveCities();

  const {
    register, handleSubmit, watch, setValue, reset, trigger,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormInput, unknown, LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      track: 'RAPIDE',
      clientType: 'particulier',
      need: '',
      dontKnowPro: true,
      serviceId: '',
      urgency: 'TODAY',
      dimensions: '',
      landmark: '',
      photosCount: 0,
      photoNames: [],
      citySlug: cities[0].slug,
      zone: '',
      zoneOther: '',
      deadline: '',
      budgetRange: 'unknown',
      name: '',
      phone: '',
      consent: false,
    },
  });

  const track = watch('track');
  const urgency = watch('urgency');
  const dontKnowPro = watch('dontKnowPro');
  const serviceId = watch('serviceId');
  const citySlug = watch('citySlug');
  const zone = watch('zone');
  const zoneGroups = getZonesForCity(citySlug);

  // Synchronisation des photos avec les champs form
  useEffect(() => {
    setValue('photosCount', uploadedPhotos.length);
    setValue('photoNames', uploadedPhotos.map((p) => p.name));
  }, [uploadedPhotos, setValue]);

  // Pré-remplissage via paramètres d'URL (?need=... ou ?service=...)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const hash = window.location.hash;
      let needParam = url.searchParams.get('need');
      let serviceParam = url.searchParams.get('service');
      if (!needParam && hash.includes('?')) {
        const hashParams = new URLSearchParams(hash.split('?')[1]);
        needParam = hashParams.get('need');
        serviceParam = hashParams.get('service');
      }

      if (needParam || serviceParam) {
        const matched = serviceParam
          ? (getServiceById(serviceParam) || services.find((s) => s.slug === serviceParam))
          : null;

        const isTravaux = matched?.categoryId === 'PROJETS_TRAVAUX' ||
          (needParam && /mur|carrelage|peinture|toiture|maconnerie|construction/i.test(needParam));

        setValue('track', isTravaux ? 'TRAVAUX' : 'RAPIDE');
        if (needParam) setValue('need', decodeURIComponent(needParam));
        if (matched) {
          setValue('serviceId', matched.id);
          setValue('dontKnowPro', false);
          setShowCatalogPicker(true);
        }
      }
    } catch {
      // Ignoré
    }
  }, [setValue, services]);

  // Gestion des photos (aperçu local)
  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: { name: string; preview: string }[] = [];
    for (let i = 0; i < Math.min(files.length, 4); i++) {
      const file = files[i];
      newItems.push({
        name: file.name,
        preview: URL.createObjectURL(file),
      });
    }

    setUploadedPhotos((prev) => [...prev, ...newItems].slice(0, 4));
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setUploadedPhotos((prev) => {
      const copy = [...prev];
      const removed = copy.splice(index, 1);
      if (removed[0]?.preview) URL.revokeObjectURL(removed[0].preview);
      return copy;
    });
  };

  const handleQuickProblemSelect = (item: QuickProblem) => {
    setValue('need', item.text, { shouldValidate: true });
    setValue('track', item.track);
    if (item.urgency) setValue('urgency', item.urgency);

    if (item.serviceSlug) {
      const s = services.find((srv) => srv.slug === item.serviceSlug);
      if (s) {
        setValue('serviceId', s.id);
      }
    }
  };

  // Validation par étape pour le modèle Question -> Réponse -> Suivante
  const handleNextStep = async () => {
    if (step === 1) {
      const valid = await trigger('need');
      if (!valid) return;
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (step === 2) {
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (values: LeadFormValues) => {
    const serviceName = values.serviceId ? getServiceById(values.serviceId)?.name : undefined;
    const payload = toLeadPayload(values, serviceName, captureLeadContext());

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
            onReset={() => {
              reset();
              setUploadedPhotos([]);
              setStep(1);
              setResult(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-6 pb-20 bg-brand-bg">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation retour */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center text-sm font-semibold text-brand-text-muted hover:text-brand-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l&apos;accueil
          </Link>

          {/* Stepper épuré */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-brand-text-muted">
              Étape {step} sur 3
            </span>
            <div className="flex gap-1">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s === step
                      ? 'w-6 bg-brand-accent'
                      : s < step
                      ? 'w-3 bg-brand-wa'
                      : 'w-3 bg-brand-border'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Conteneur principal */}
        <div className="bg-brand-surface p-6 sm:p-10 rounded-3xl shadow-premium border border-brand-border">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <AnimatePresence mode="wait">
              {/* ======================= ÉTAPE 1 : LE PROBLÈME ======================= */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h1 className="font-heading text-2xl sm:text-3xl font-bold text-brand-text mb-2">
                      Qu&apos;avez-vous besoin de résoudre ?
                    </h1>
                    <p className="text-sm sm:text-base text-brand-text-muted leading-relaxed">
                      Pas besoin de chercher un métier. Expliquez votre problème avec vos propres mots : Fika qualifie votre besoin et coordonne l&apos;artisan ou technicien adapté à Ngaoundéré.
                    </p>
                  </div>

                  {/* OPTION CENTRALE : "Je ne sais pas quel professionnel choisir" */}
                  <div className="rounded-2xl border-2 border-brand-accent/20 bg-brand-accent/5 p-4 sm:p-5">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-brand-accent/15 text-brand-accent flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <label className="text-sm sm:text-base font-bold text-brand-text cursor-pointer flex items-center gap-2">
                            <input
                              type="radio"
                              name="proSelection"
                              checked={dontKnowPro}
                              onChange={() => {
                                setValue('dontKnowPro', true);
                                setValue('serviceId', '');
                                setShowCatalogPicker(false);
                              }}
                              className="w-4 h-4 text-brand-accent accent-brand-accent"
                            />
                            <span>Je ne sais pas quel professionnel choisir</span>
                          </label>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-accent bg-brand-accent/15 px-2.5 py-0.5 rounded-full">
                            Recommandé
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-brand-text-muted mt-1 leading-relaxed">
                          Fika analyse votre situation et vous envoie la bonne personne (plombier, électricien, maçon, dépanneur, etc.).
                        </p>

                        {!dontKnowPro && (
                          <button
                            type="button"
                            onClick={() => {
                              setValue('dontKnowPro', true);
                              setValue('serviceId', '');
                              setShowCatalogPicker(false);
                            }}
                            className="mt-2 text-xs font-semibold text-brand-accent hover:underline"
                          >
                            Revenir au choix automatique par Fika
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Option secondaire : j'ai une idée de service */}
                    <div className="mt-3 pt-3 border-t border-brand-border/60">
                      <button
                        type="button"
                        onClick={() => {
                          setValue('dontKnowPro', false);
                          setShowCatalogPicker(!showCatalogPicker);
                        }}
                        className="text-xs text-brand-text-muted hover:text-brand-text flex items-center gap-1.5 font-medium transition-colors"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>J&apos;ai déjà une idée du service ou métier spécifique</span>
                      </button>

                      {showCatalogPicker && (
                        <div className="mt-3 p-3 rounded-xl bg-brand-bg border border-brand-border">
                          <label htmlFor="serviceSelector" className="block text-xs font-semibold text-brand-text mb-1.5">
                            Sélectionner une prestation indicative (facultatif) :
                          </label>
                          <Select
                            id="serviceSelector"
                            value={serviceId}
                            onChange={(e) => {
                              setValue('serviceId', e.target.value);
                              setValue('dontKnowPro', false);
                            }}
                          >
                            <option value="">Laisser Fika décider (conseillé)</option>
                            {services.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.categoryId})
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PARCOURS ADAPTATIF : RAPIDE VS TRAVAUX */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-2.5">
                      Type d&apos;intervention
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setValue('track', 'RAPIDE')}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          track === 'RAPIDE'
                            ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/30 shadow-sm'
                            : 'border-brand-border bg-brand-bg hover:border-brand-border-dark'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="w-9 h-9 rounded-xl bg-brand-surface border border-brand-border flex items-center justify-center text-brand-accent">
                            <Wrench className="w-4 h-4" />
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-full">
                            Formulaire court
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-brand-text">Intervention rapide</h3>
                        <p className="text-xs text-brand-text-muted mt-1 leading-relaxed">
                          Fuite, coupure, dépannage, panne soudaine, course urgente ou réparation immédiate.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setValue('track', 'TRAVAUX')}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          track === 'TRAVAUX'
                            ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/30 shadow-sm'
                            : 'border-brand-border bg-brand-bg hover:border-brand-border-dark'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="w-9 h-9 rounded-xl bg-brand-surface border border-brand-border flex items-center justify-center text-brand-accent">
                            <Hammer className="w-4 h-4" />
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted bg-brand-border/60 px-2 py-0.5 rounded-full">
                            Projet & chiffrage
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-brand-text">Projet ou travaux</h3>
                        <p className="text-xs text-brand-text-muted mt-1 leading-relaxed">
                          Maçonnerie, carrelage, peinture, menuiserie, toiture, aménagement ou rénovation.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* CHAMP DE DESCRIPTION */}
                  <div>
                    <Field
                      label={
                        track === 'TRAVAUX'
                          ? 'Décrivez votre projet de travaux'
                          : 'Décrivez votre problème'
                      }
                      htmlFor="need"
                      required
                      error={errors.need?.message}
                      hint="Écrivez simplement ce qui se passe ou ce que vous souhaitez faire."
                    >
                      <Textarea
                        id="need"
                        rows={3}
                        invalid={!!errors.need}
                        placeholder={
                          track === 'TRAVAUX'
                            ? 'Ex : Je souhaite poser du carrelage dans le salon et la cuisine...'
                            : 'Ex : Mon robinet fuit sous l’évier de la cuisine et l’eau commence à couler partout...'
                        }
                        {...register('need')}
                      />
                    </Field>

                    {/* SUGGESTIONS RAPIDES EN 1 CLIC (les exemples concrets demandés) */}
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-brand-text-muted mb-2">
                        Exemples fréquents (cliquez pour remplir) :
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_PROBLEMS.map((item) => (
                          <button
                            key={item.text}
                            type="button"
                            onClick={() => handleQuickProblemSelect(item)}
                            className="text-xs font-medium px-3 py-1.5 rounded-full border border-brand-border bg-brand-bg hover:border-brand-accent hover:text-brand-accent text-brand-text transition-colors"
                          >
                            {item.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* AJOUT DE PHOTOS (Facultatif mais utile) */}
                  <div className="rounded-2xl border border-dashed border-brand-border-dark p-4 bg-brand-bg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-brand-accent" />
                          Photos de la situation (facultatif)
                        </h3>
                        <p className="text-xs text-brand-text-muted mt-0.5">
                          Une photo aide l&apos;artisan à évaluer l&apos;ampleur et à préparer les bons outils.
                        </p>
                      </div>

                      <label className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold bg-brand-surface border border-brand-border hover:border-brand-border-dark cursor-pointer text-brand-text shadow-sm transition-colors shrink-0">
                        <span>Ajouter des photos</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePhotoAdd}
                          className="sr-only"
                        />
                      </label>
                    </div>

                    {/* Aperçu des photos sélectionnées */}
                    {uploadedPhotos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-brand-border">
                        {uploadedPhotos.map((photo, idx) => (
                          <div
                            key={photo.name + idx}
                            className="relative rounded-xl overflow-hidden border border-brand-border bg-brand-surface aspect-video group"
                          >
                            <img
                              src={photo.preview}
                              alt={`Aperçu ${photo.name}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removePhoto(idx)}
                              aria-label="Supprimer la photo"
                              className="absolute top-1 right-1 p-1 rounded-full bg-brand-text/80 text-white hover:bg-brand-text transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <span className="absolute bottom-1 left-1.5 right-1.5 text-[10px] truncate text-white bg-black/50 px-1 rounded">
                              {photo.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bouton vers étape 2 */}
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      className="w-full rounded-xl h-13 font-bold"
                      onClick={handleNextStep}
                    >
                      <span>Continuer</span>
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ======================= ÉTAPE 2 : LES PRÉCISIONS ADAPTÉES ======================= */}
              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* CAS 1 : INTERVENTION RAPIDE */}
                  {track === 'RAPIDE' ? (
                    <>
                      <div>
                        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-brand-text mb-2">
                          Quel est le niveau d&apos;urgence ?
                        </h2>
                        <p className="text-sm text-brand-text-muted">
                          Dites-nous quand vous avez besoin de cette intervention à Ngaoundéré.
                        </p>
                      </div>

                      {/* Cartes d'urgence claires */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {URGENCY_OPTIONS.map((opt) => {
                          const isSelected = urgency === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setValue('urgency', opt.id)}
                              className={`p-4 rounded-2xl border text-left transition-all ${
                                isSelected
                                  ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/30 shadow-sm'
                                  : 'border-brand-border bg-brand-bg hover:border-brand-border-dark'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-sm text-brand-text">
                                  {opt.label}
                                </span>
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                    opt.id === 'URGENT'
                                      ? 'bg-rose-100 text-rose-800'
                                      : opt.id === 'TODAY'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-brand-border/60 text-brand-text-muted'
                                  }`}
                                >
                                  {opt.badge}
                                </span>
                              </div>
                              <p className="text-xs text-brand-text-muted">
                                {opt.sublabel}
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      <div className="rounded-xl bg-brand-bg border border-brand-border p-3.5 text-xs text-brand-text-muted flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
                        <span>
                          En cas d&apos;extrême urgence (ex: fuite d&apos;eau majeure ou disjoncteur en court-circuit), pensez à couper la vanne générale ou le compteur si possible.
                        </span>
                      </div>
                    </>
                  ) : (
                    /* CAS 2 : PROJET / TRAVAUX */
                    <>
                      <div>
                        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-brand-text mb-2">
                          Précisions sur vos travaux
                        </h2>
                        <p className="text-sm text-brand-text-muted">
                          Ces détails permettent à notre équipe de préparer le bon matériel et d&apos;évaluer l&apos;intervention.
                        </p>
                      </div>

                      {/* Dimensions ou quantité */}
                      <Field
                        label="Dimensions ou quantité estimée (si vous les connaissez)"
                        htmlFor="dimensions"
                        hint="Ex : Environ 35 m² de surface, un mur de 12 mètres, 2 chambres à peindre..."
                      >
                        <Input
                          id="dimensions"
                          placeholder="Ex: environ 30 m², ou 'à évaluer sur place'"
                          {...register('dimensions')}
                        />
                      </Field>

                      {/* Délai souhaité */}
                      <div>
                        <label htmlFor="deadline" className="block text-sm font-semibold text-brand-text mb-2">
                          Quand souhaitez-vous démarrer les travaux ?
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                          {[
                            'Dès cette semaine',
                            "D'ici 15 jours",
                            'Dans le mois',
                            'Date flexible',
                          ].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setValue('deadline', d)}
                              className="text-xs font-semibold py-2 px-3 rounded-xl border border-brand-border bg-brand-bg hover:border-brand-border-dark text-brand-text text-center transition-colors"
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                        <Input
                          id="deadline"
                          placeholder="Ou précisez une date / un créneau..."
                          {...register('deadline')}
                        />
                      </div>

                      {/* Budget indicatif facultatif */}
                      <Field
                        label="Budget indicatif (facultatif)"
                        htmlFor="budgetRange"
                        hint="Cela nous permet de vous orienter directement vers les matériaux adaptés."
                      >
                        <Select id="budgetRange" {...register('budgetRange')}>
                          {BUDGET_RANGES.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </>
                  )}

                  {/* Navigation étapes */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="rounded-xl h-13 px-5"
                      onClick={handlePrevStep}
                    >
                      <ArrowLeft className="w-4 h-4 mr-1.5" />
                      <span>Retour</span>
                    </Button>

                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      className="flex-1 rounded-xl h-13 font-bold"
                      onClick={handleNextStep}
                    >
                      <span>Continuer vers la localisation</span>
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ======================= ÉTAPE 3 : LOCALISATION & CONTACT ======================= */}
              {step === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="font-heading text-2xl sm:text-3xl font-bold text-brand-text mb-2">
                      Où intervenir et comment vous joindre ?
                    </h2>
                    <p className="text-sm text-brand-text-muted">
                      Le déplacement du professionnel est organisé par Fika et intégré au devis que vous validerez.
                    </p>
                  </div>

                  {/* Ville et quartier */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Ville" htmlFor="citySlug" required error={errors.citySlug?.message}>
                      {isOnlyOneActiveCity() ? (
                        <div
                          className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-bg text-sm font-semibold text-brand-text flex items-center justify-between"
                          aria-readonly="true"
                        >
                          <span className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-brand-accent" />
                            {cities[0].name}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-wa bg-brand-wa/10 px-2 py-0.5 rounded-full">
                            Zone active
                          </span>
                        </div>
                      ) : (
                        <Select id="citySlug" invalid={!!errors.citySlug} {...register('citySlug')}>
                          {cities.map((c) => (
                            <option key={c.slug} value={c.slug}>{c.name}</option>
                          ))}
                        </Select>
                      )}
                    </Field>

                    <Field label="Quartier à Ngaoundéré" htmlFor="zone" required error={errors.zone?.message}>
                      <Select id="zone" invalid={!!errors.zone} {...register('zone')}>
                        <option value="" disabled>Sélectionnez votre quartier…</option>
                        {zoneGroups.map((group) => (
                          <optgroup key={group.commune} label={group.commune}>
                            {group.names.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </optgroup>
                        ))}
                        <option value={OTHER_ZONE_VALUE}>Autre quartier / je précise</option>
                      </Select>
                    </Field>
                  </div>

                  {zone === OTHER_ZONE_VALUE && (
                    <Field label="Précisez votre quartier" htmlFor="zoneOther" required error={errors.zoneOther?.message}>
                      <Input
                        id="zoneOther"
                        invalid={!!errors.zoneOther}
                        placeholder="Ex: Cité derrière la gare, Mardock sud..."
                        {...register('zoneOther')}
                      />
                    </Field>
                  )}

                  {/* Repère camerounais essentiel pour trouver le lieu */}
                  <Field
                    label="Repère ou précision du lieu (recommandé)"
                    htmlFor="landmark"
                    hint="Ex : Face station Total, près du carrefour marché, derrière la chefferie..."
                  >
                    <Input
                      id="landmark"
                      placeholder="Ex: face au carrefour, derrière la pharmacie..."
                      {...register('landmark')}
                    />
                  </Field>

                  {/* Coordonnées */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-brand-border">
                    <Field label="Vous êtes" htmlFor="clientType" error={errors.clientType?.message}>
                      <Select id="clientType" {...register('clientType')}>
                        {CLIENT_TYPES.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Votre nom ou prénom (recommandé)" htmlFor="name" error={errors.name?.message}>
                      <Input id="name" placeholder="Ex: Aminata, Oumarou..." {...register('name')} />
                    </Field>

                    <Field
                      label="Téléphone / WhatsApp"
                      htmlFor="phone"
                      required
                      error={errors.phone?.message}
                      hint="Ex : 6 77 12 34 56 ou +237 6..."
                    >
                      <Input
                        id="phone"
                        type="tel"
                        invalid={!!errors.phone}
                        placeholder="+237 6 XX XX XX XX"
                        {...register('phone')}
                      />
                    </Field>
                  </div>

                  {/* Consentement légal et confidentialité */}
                  <Field label="" htmlFor="consent" error={errors.consent?.message}>
                    <Checkbox
                      id="consent"
                      invalid={!!errors.consent}
                      {...register('consent')}
                      label={
                        <>
                          J&apos;accepte d&apos;être recontacté(e) par Fika au sujet de ma demande et je reconnais avoir pris connaissance des{' '}
                          <Link to="/cgv" className="font-bold text-brand-accent hover:underline">
                            Conditions Générales
                          </Link>{' '}
                          et de la{' '}
                          <Link to="/confidentialite" className="font-bold text-brand-accent hover:underline">
                            politique de confidentialité
                          </Link>
                          .
                        </>
                      }
                      description="Vos informations restent strictement confidentielles et ne sont ni vendues ni partagées (loi n° 2024/017)."
                    />
                  </Field>

                  {/* Navigation étapes & Envoi */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="rounded-xl h-13 px-5"
                      onClick={handlePrevStep}
                    >
                      <ArrowLeft className="w-4 h-4 mr-1.5" />
                      <span>Retour</span>
                    </Button>

                    <Button
                      type="submit"
                      variant="whatsapp"
                      size="lg"
                      disabled={isSubmitting}
                      className="flex-1 rounded-xl h-13 font-bold shadow-md"
                    >
                      {isSubmitting && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                      {isSubmitting ? 'Envoi en cours...' : 'Envoyer ma demande'}
                    </Button>
                  </div>

                  <p className="text-xs text-center text-brand-text-muted mt-2">
                    En cas de réseau faible, WhatsApp s&apos;ouvre automatiquement avec votre message prérempli.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>
      </div>
    </div>
  );
}
