import { ArrowRight, ChevronDown, MessageCircle } from 'lucide-react';
import { getWALink } from '../lib/whatsapp';
import { trackWaClick } from '../lib/tracking';
import { getCategories } from '../lib/catalog';
import { FAQS } from '../lib/data';
import { Button, UniverseIcon } from './ui';
import { Link } from '../router';
import { NeedIllustration } from './NeedIllustration';

export function HomePage() {
  return <div>
    <section className="max-w-7xl mx-auto px-5 py-10 lg:py-16 grid lg:grid-cols-[1.2fr_1fr] items-center gap-8">
      <div>
        <p className="text-xs uppercase tracking-widest text-brand-accent font-bold mb-5">Ngaoundéré · Un seul interlocuteur</p>
        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">Un besoin. Une demande.<br /><span className="font-serif italic text-brand-accent">Fika s’occupe du reste.</span></h1>
        <p className="text-brand-text-muted text-lg mt-6 max-w-xl">Une fuite, une panne, des travaux ou un transport ? Décrivez votre besoin. Nous recherchons et coordonnons la bonne personne.</p>
        <Button asChild size="lg" className="mt-8 rounded-full px-7"><Link to="/demande">Décrire mon besoin <ArrowRight className="ml-2 w-5 h-5" /></Link></Button>
        <a className="flex items-center gap-2 mt-4 py-3 text-sm font-semibold text-brand-wa" href={getWALink("Bonjour Fika 👋\nJ'ai un besoin et j'aimerais savoir si vous pouvez m'aider.")} target="_blank" rel="noopener noreferrer" onClick={() => trackWaClick({ context: 'home-hero' })}><MessageCircle size={18} /> Parler à Fika sur WhatsApp</a>
        <p className="text-sm text-brand-text-muted mt-3">Pas besoin de savoir quel professionnel choisir.</p>
      </div>
      <NeedIllustration />
    </section>
    <section id="comment-ca-marche" className="border-y border-brand-border bg-white px-5 py-12">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-heading text-2xl font-bold mb-8">Vous expliquez. Nous coordonnons.</h2>
        <ol className="grid sm:grid-cols-3 gap-8">
          {['Décrivez votre besoin.', 'Nous précisons la solution et le prix avec vous.', 'Nous organisons l’intervention et son suivi.'].map((text, i) => <li key={text}><span className="text-brand-accent font-mono text-sm">0{i + 1}</span><p className="mt-2 font-medium">{text}</p></li>)}
        </ol>
      </div>
    </section>
    <section id="services" className="max-w-6xl mx-auto px-5 py-14">
      <div className="flex justify-between items-center gap-4 mb-6"><h2 className="font-heading text-2xl font-bold">Quelques portes d’entrée</h2><Link to="/services" className="text-sm underline py-3">Voir les services</Link></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {getCategories().map(c => <Link key={c.id} to={`/univers/${c.slug}`} className="flex items-center gap-4 rounded-2xl border border-brand-border bg-white p-5 hover:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent"><UniverseIcon icon={c.icon ?? 'Wrench'} className="w-5 h-5 text-brand-accent" /><span className="font-semibold flex-1">{c.title}</span><ArrowRight size={17} /></Link>)}
        <Link to="/demande" className="rounded-2xl border border-brand-accent/30 p-5 bg-brand-accent/5"><strong>Je ne sais pas qui appeler</strong><p className="text-sm text-brand-text-muted mt-1">Décrivez simplement votre problème →</p></Link>
      </div>
    </section>
    <section id="faq" className="max-w-3xl mx-auto px-5 pb-14">
      <h2 className="font-heading text-2xl font-bold mb-6">Vos questions</h2>
      {FAQS.map(f => <details key={f.q} className="group border-b border-brand-border"><summary className="list-none cursor-pointer flex items-center justify-between gap-4 py-5 font-semibold focus-visible:outline-brand-accent [&::-webkit-details-marker]:hidden">{f.q}<ChevronDown className="w-5 h-5 shrink-0 group-open:rotate-180" /></summary><p className="text-brand-text-muted leading-relaxed pb-5">{f.a}</p></details>)}
      <div className="text-center mt-10"><Button asChild size="lg" className="rounded-full"><Link to="/demande">Décrire mon besoin <ArrowRight className="ml-2 w-4 h-4" /></Link></Button></div>
    </section>
  </div>;
}
