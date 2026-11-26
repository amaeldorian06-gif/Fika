import { ArrowRight, ChevronDown, MapPin, ShoppingBag, Wrench } from 'lucide-react';
import { FAQS } from '../lib/data';
import { SITE_CITY } from '../lib/site';
import { Link } from '../router';

const STEPS = [
  'Décrivez votre besoin ou le produit que vous recherchez.',
  'Fika vérifie la faisabilité, la disponibilité, le prix et le délai.',
  'Vous validez les conditions ; Fika organise ensuite la suite avec vous.',
];

export function AboutPage() {
  return (
    <div className="pb-16">
      <section className="border-b border-brand-border bg-white">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-accent">À propos · {SITE_CITY}</p>
          <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight text-brand-text sm:text-5xl">Une marque, deux univers.</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-brand-text-muted sm:text-lg">
            Fika simplifie l’accès aux produits et aux services utiles du quotidien. Notre équipe locale recherche, vérifie et coordonne les solutions, avec des conditions communiquées avant tout engagement.
          </p>
          <p className="mt-3 text-sm font-semibold text-brand-accent">Aujourd’hui, Fika est disponible à {SITE_CITY} uniquement.</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-5 pt-10 sm:grid-cols-2 sm:px-8">
        <article className="rounded-3xl border border-brand-border bg-white p-6 sm:p-8">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-text text-white"><Wrench className="h-6 w-6" aria-hidden="true" /></span>
          <h2 className="mt-5 font-heading text-xl font-extrabold text-brand-text">Fika Services</h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-text-muted">Vous décrivez un besoin. Fika vérifie la faisabilité et la disponibilité d’un professionnel, précise les conditions avec vous, puis coordonne l’intervention et son suivi.</p>
          <Link to="/services" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-accent hover:gap-3">Découvrir les services <ArrowRight className="h-4 w-4" /></Link>
        </article>
        <article className="rounded-3xl border border-brand-border bg-white p-6 sm:p-8">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent text-white"><ShoppingBag className="h-6 w-6" aria-hidden="true" /></span>
          <h2 className="mt-5 font-heading text-xl font-extrabold text-brand-text">Fika Market</h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-text-muted">Fika sélectionne et vend les produits de sa boutique. Nous confirmons la disponibilité, le prix final et le délai avant paiement, puis organisons la livraison à {SITE_CITY}.</p>
          <Link to="/boutique" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-accent hover:gap-3">Explorer la boutique <ArrowRight className="h-4 w-4" /></Link>
        </article>
      </section>

      <section id="fonctionnement" className="mx-auto mt-14 max-w-5xl scroll-mt-24 px-5 sm:px-8">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-accent"><MapPin className="h-4 w-4" aria-hidden="true" /> Notre fonctionnement</div>
        <h2 className="mt-3 font-heading text-2xl font-extrabold text-brand-text sm:text-3xl">Vous expliquez. Nous vérifions. Vous décidez.</h2>
        <ol className="mt-7 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step} className="rounded-2xl border border-brand-border bg-white p-5">
              <span className="font-mono text-sm font-bold text-brand-accent">0{index + 1}</span>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-brand-text">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="questions" className="mx-auto mt-16 max-w-3xl scroll-mt-24 px-5 sm:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-accent">À savoir avant de commencer</p>
        <h2 className="mt-3 font-heading text-2xl font-extrabold text-brand-text sm:text-3xl">Vos questions, nos réponses.</h2>
        <div className="mt-5 border-t border-brand-border">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group border-b border-brand-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-semibold text-brand-text focus-visible:outline-brand-accent [&::-webkit-details-marker]:hidden">
                {faq.q}
                <ChevronDown className="h-5 w-5 shrink-0 text-brand-accent transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-brand-text-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mx-auto mt-12 max-w-5xl px-5 text-center sm:px-8">
        <Link to="/demande" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-text px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-black">
          Parler de mon besoin <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
