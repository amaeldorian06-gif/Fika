import type { PortfolioItem, Testimonial } from './types';

/**
 * Contenus marketing de la vitrine (process, FAQ, témoignages, suggestions).
 * Le CATALOGUE (univers/services/packs) a déménagé vers lib/catalog-data.ts
 * + lib/catalog.ts — ne rien ajouter ici de commercial.
 *
 * TODO_PROD — contenus d'exemple en attente de validation par le fondateur
 * (témoignages, titres de réalisations).
 */

export const PROCESS_STEPS = [
  { id: '01', title: 'Vous faites votre demande', desc: 'WhatsApp, téléphone ou directement depuis le site.' },
  { id: '02', title: "Nous trouvons l'expert", desc: 'Nous sélectionnons la capacité adaptée à votre besoin.' },
  { id: '03', title: "Nous suivons l'exécution", desc: 'Nous restons votre interlocuteur unique.' },
  { id: '04', title: 'Vous recevez le résultat', desc: 'Et nous nous assurons que la prestation correspond à ce qui a été demandé.' },
];

// TODO_PROD : titres/catégories d'exemple + visuels réels à fournir par le
// fondateur (assets locaux sous /fika, jamais d'image distante).
export const PORTFOLIO: Partial<PortfolioItem>[] = [
  { title: 'Flyer Restaurant', category: 'Design', image: '/fika/portfolio-1.svg' },
  { title: 'Site Vitrine', category: 'Digital', image: '/fika/portfolio-2.svg' },
  { title: 'Logo Marque', category: 'Design', image: '/fika/portfolio-3.svg' },
  { title: 'Menu Café', category: 'Design', image: '/fika/portfolio-4.svg' },
];

export const FAQS = [
  { q: 'Qui réalise les prestations ?', a: 'Nous travaillons avec des experts sélectionnés selon les besoins.' },
  { q: "Puis-je demander un service qui n'est pas affiché ?", a: 'Oui. Décrivez-nous votre besoin et nous verrons comment le prendre en charge.' },
  { q: 'Comment commander ?', a: 'Depuis la fiche du service ou directement sur WhatsApp.' },
  { q: 'Quand dois-je payer ?', a: 'Les modalités dépendent du type de prestation et sont précisées avant son lancement.' },
  { q: 'La livraison est-elle vraiment gratuite ?', a: 'Oui. La livraison est gratuite dans toute la ville de Ngaoundéré, sans condition de montant ni de quartier.' },
];

// TODO_PROD : témoignages d'exemple — à remplacer par des avis vérifiés
// rattachés à des commandes complétées (invariant preuve).
export const TESTIMONIALS: Partial<Testimonial>[] = [
  { name: 'Aminata T.', role: 'Propriétaire de boutique', content: "Leur réactivité est impressionnante. J'ai demandé un flyer pour ma boutique et il était prêt le lendemain, imprimé et livré. Je ne passe plus que par eux." },
  { name: 'Ousmane D.', role: 'Entrepreneur', content: "Créer mon site web me paraissait une montagne. Fika a tout pris en charge avec une communication limpide sur WhatsApp." },
  { name: 'Sarah B.', role: 'Étudiante', content: "Mon ordinateur m'a lâché en pleine période de révisions. Récupéré le soir même, à domicile. Un service d'une fiabilité rare." },
];

export const SEARCH_SUGGESTIONS = [
  "Que souhaitez-vous faire aujourd'hui ?",
  'Créer un flyer...',
  'Créer mon site...',
  'Réparer mon téléphone...',
  'Faire imprimer mes documents...',
];
