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
export const PORTFOLIO: Partial<PortfolioItem>[] = [
  { title: 'Flyer Restaurant', category: 'Design', image: '/fika/portfolio-1.svg' },
  { title: 'Site Vitrine', category: 'Digital', image: '/fika/portfolio-2.svg' },
  { title: 'Logo Marque', category: 'Design', image: '/fika/portfolio-3.svg' },
  { title: 'Menu Café', category: 'Design', image: '/fika/portfolio-4.svg' },
];

export const FAQS = [
  {
    q: 'Comment se passe le paiement ?',
    a: 'Le diagnostic ou devis initial est toujours validé avec vous avant toute intervention. Selon la nature de la prestation, le règlement s\'effectue directement auprès de Fika (Orange Money, MTN Mobile Money ou espèces contre reçu) une fois le travail convenu ou validé. L\'artisan ne vous demande aucun surplus non préalablement autorisé.',
  },
  {
    q: 'Si le travail n\'est pas bien fait, que se passe-t-il ?',
    a: 'Fika assume la responsabilité complète de la mission. Si un défaut est constaté ou si la panne réapparaît, nous missionnons à nouveau le professionnel sans frais supplémentaires jusqu\'à résolution totale et conforme de votre problème.',
  },
  {
    q: 'En combien de temps intervenez-vous à Ngaoundéré ?',
    a: 'Pour les urgences du quotidien (fuite d\'eau, panne de courant, réfrigérateur à l\'arrêt), un professionnel peut être dépêché sous 1h à 3h dans notre périmètre à Ngaoundéré. Pour les travaux planifiés ou de gros œuvre, nous fixons une visite technique sous 24h à 48h selon vos disponibilités.',
  },
  {
    q: 'Les professionnels sont-ils employés par Fika ?',
    a: 'Non. Ce sont des artisans, techniciens et spécialistes indépendants de Ngaoundéré. Fika les intègre par étapes (téléphone confirmé, profil contrôlé, compétence vérifiée quand nous avons pu la tester ou la voir, interventions Fika réalisées) et suit leurs résultats : interventions terminées, annulations, reprises, avis. Fika est l\'opérateur et coordinateur : nous qualifions votre besoin, mandatons la bonne personne, cadrons le prix, contrôlons la qualité et garantissons votre satisfaction.',
  },
  {
    q: 'Puis-je demander une intervention qui n\'est pas dans la liste ?',
    a: 'Absolument. Utilisez le bouton « Décrire mon besoin » ou contactez-nous directement sur WhatsApp. Nous étudions votre situation et vous répondons rapidement avec une solution sur mesure.',
  },
  {
    q: 'Le déplacement du professionnel est-il facturé ?',
    a: 'Le déplacement est organisé par Fika et intégré au devis que vous validez avant toute intervention : coût du professionnel, déplacement et matériel éventuel y figurent clairement. Pour les petites commandes de documents (CV, impressions), la livraison à Ngaoundéré est incluse dans le prix affiché.',
  },
];

// TODO_PROD : témoignages d'exemple — à remplacer par des avis vérifiés
// rattachés à des commandes complétées (invariant preuve).
export const TESTIMONIALS: Partial<Testimonial>[] = [
  { name: 'Aminata T.', role: 'Propriétaire de boutique', content: "Leur réactivité est impressionnante. J'ai demandé un flyer pour ma boutique et il était prêt le lendemain, imprimé et livré. Je ne passe plus que par eux." },
  { name: 'Ousmane D.', role: 'Entrepreneur', content: "Créer mon site web me paraissait une montagne. Fika a tout pris en charge avec une communication limpide sur WhatsApp." },
  { name: 'Sarah B.', role: 'Étudiante', content: "Mon ordinateur m'a lâché en pleine période de révisions. Récupéré le soir même, à domicile. Un service d'une fiabilité rare." },
];

export const SEARCH_SUGGESTIONS = [
  "Quel est votre problème aujourd'hui ?",
  "Une fuite d'eau...",
  "Mon frigo est en panne...",
  "Besoin d'un maçon...",
  "Déménager demain...",
  "Réparer mon téléphone...",
];
