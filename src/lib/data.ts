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
  { id: '01', title: 'Vous décrivez le problème', desc: 'Une fuite, une panne, un déménagement : dites-nous ce qu\'il vous faut.' },
  { id: '02', title: 'Nous trouvons le bon pro', desc: 'Nous sélectionnons dans notre réseau l\'artisan ou le technicien adapté et disponible, selon son niveau de contrôle et ses interventions passées.' },
  { id: '03', title: 'Nous orchestrons', desc: 'Nous gérons le devis, le déplacement et le suivi de l\'intervention.' },
  { id: '04', title: 'Le problème est réglé', desc: 'Fika s\'assure que la prestation est conforme et que vous êtes satisfait.' },
];

// TODO_PROD : titres/catégories d'exemple + visuels réels à fournir par le
// fondateur (assets locaux sous /fika, jamais d'image distante).
export const PORTFOLIO: Partial<PortfolioItem>[] = [];

export const FAQS = [
  { q: 'Comment fonctionne une demande ?', a: 'Décrivez votre besoin et laissez votre téléphone. Fika vous recontacte pour préciser le problème, rechercher une solution et organiser la suite avec vous.' },
  { q: 'Comment le prix est-il fixé ?', a: 'Le montant dépend du besoin, du professionnel, du matériel et du déplacement éventuels. Le prix et les modalités de paiement sont convenus avec vous avant de commencer.' },
  { q: 'Qui réalise les prestations ?', a: 'Des professionnels indépendants, sélectionnés selon les informations disponibles et les contrôles réellement effectués. Fika reste votre interlocuteur pour la coordination et le suivi.' },
  { q: 'Et si mon besoin n’est pas dans le catalogue ?', a: 'Décrivez-le quand même. Nous examinerons ce qui est possible, sans vous promettre une disponibilité ou un délai avant vérification.' },
];
export const TESTIMONIALS: Partial<Testimonial>[] = [];

export const SEARCH_SUGGESTIONS = [
  "Quel est votre problème aujourd'hui ?",
  "Une fuite d'eau...",
  "Mon frigo est en panne...",
  "Besoin d'un maçon...",
  "Déménager demain...",
  "Réparer mon téléphone...",
];
