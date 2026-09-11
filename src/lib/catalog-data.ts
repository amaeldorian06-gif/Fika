import type { Category, CityPricing, Package, Service } from './types';
import { DEFAULT_CITY_SLUG } from './city';

// Source unique de la ville par défaut : lib/city.ts (réexport compatibilité).
export { DEFAULT_CITY_SLUG };

/**
 * DATASET CANONIQUE DU CATALOGUE (P03).
 * Source unique consommée par :
 *   - lib/catalog.ts (pages du site — lecteur DTO, futures requêtes DB en Next) ;
 *   - lib/pricing.ts (surcharges ville, cohérence packs) ;
 *   - prisma/seed-catalog.ts (seme ces lignes en base).
 * Modifier un prix ici modifie à la fois le seed ET l'UI.
 *
 * TODO_PROD : prix, délais et contenus en attente de validation fondateur.
 */



export const UNIVERSES: Category[] = [
  {
    id: 'digital', slug: 'digital', title: 'Digital',
    description: 'Services web, applications, et marketing digital.',
    promise: 'Votre présence en ligne, conçue pour convertir et impressionner.',
    icon: 'MonitorSmartphone',
    examples: 'Site web · Google Business · WhatsApp Business · Réseaux sociaux',
    featured: true, color: 'bg-blue-50 text-blue-600 border-blue-200',
  },
  {
    id: 'design', slug: 'design', title: 'Design',
    description: 'Identité visuelle et supports de communication.',
    promise: 'Une identité visuelle marquante qui reflète votre excellence.',
    icon: 'Zap', examples: 'Flyers · Logos · Menus · Affiches',
    featured: true, color: 'bg-purple-50 text-purple-600 border-purple-200',
  },
  {
    id: 'documents', slug: 'documents', title: 'Documents',
    description: 'Rédaction, mise en page et impression.',
    promise: 'Des écrits percutants et professionnels pour chaque occasion.',
    icon: 'FileText', examples: 'CV · Saisie · Impression · Reliure',
    featured: true, color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  },
  {
    id: 'technologie', slug: 'technologie', title: 'Technologie',
    description: 'Dépannage informatique et automatisation.',
    promise: "L'innovation au service de votre productivité.",
    icon: 'Wrench', examples: 'Réparation téléphone · Ordinateur · Wi-Fi · Imprimante',
    featured: true, color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  },
  {
    id: 'maison', slug: 'maison', title: 'Maison',
    description: 'Travaux, aménagements et interventions à domicile.',
    promise: "L'amélioration et l'entretien de votre espace de vie.",
    icon: 'HomeIcon', examples: 'Installation · Nettoyage · Petites interventions',
    featured: true, color: 'bg-orange-50 text-orange-600 border-orange-200',
  },
  {
    id: 'mobilite', slug: 'mobilite', title: 'Mobilité',
    description: 'Courses, livraisons et logistique.',
    promise: 'Des solutions pour vous déplacer efficacement et en toute sécurité.',
    icon: 'Truck', examples: 'Livraison · Courses · Retrait de colis',
    featured: true, color: 'bg-teal-50 text-teal-600 border-teal-200',
  },
  {
    id: 'entreprise', slug: 'entreprise', title: 'Entreprise',
    description: "Services d'assistance et de gestion administrative.",
    promise: 'Accompagnement et stratégies pour développer votre activité.',
    icon: 'Briefcase', examples: 'Communication · Digitalisation · Supports commerciaux',
    featured: true, color: 'bg-gray-50 text-gray-800 border-gray-200',
  },
];

const img = (categorySlug: string) => `/fika/${categorySlug}.svg`;
const seo = (name: string, short: string): Pick<Service, 'seoTitle' | 'seoDescription'> => ({
  seoTitle: `${name} à Ngaoundéré | Fika`,
  seoDescription: `${short} Fika s'occupe de tout, livraison incluse à Ngaoundéré.`,
});

export const SERVICES: Service[] = [
  /* ------------------------------- Digital ------------------------------- */
  {
    id: 's-dig-1', slug: 'site-vitrine', name: 'Création de site vitrine',
    categoryId: 'digital',
    shortDescription: 'Un site web professionnel pour présenter votre activité.',
    fullDescription: 'Nous créons un site web sur mesure, rapide et sécurisé, pour présenter vos services, vos produits ou votre entreprise au monde entier. Une vitrine numérique essentielle pour rassurer vos clients et trouver de nouveaux prospects.',
    priceType: 'FROM', startingPrice: 25000, deliveryIncluded: false,
    estimatedDuration: '1 à 2 semaines',
    includedItems: ['Hébergement 1 an', 'Design responsive', 'Formulaire de contact', 'Intégration WhatsApp', 'Optimisation de base'],
    excludedItems: ['Rédaction du contenu', "Achat d'images premium"],
    requirements: [
      { label: 'Votre logo', kind: 'FILE', required: true, position: 1 },
      { label: 'Vos textes (présentation, services)', kind: 'TEXT', required: true, position: 2 },
      { label: 'Vos images', kind: 'FILE', required: false, position: 3 },
      { label: 'Vos coordonnées complètes', kind: 'TEXT', required: true, position: 4 },
    ],
    howItWorks: [
      { title: 'Cadrage', description: "Nous discutons de vos objectifs et de l'arborescence du site." },
      { title: 'Maquette', description: 'Nous vous proposons un design pour validation.' },
      { title: 'Développement', description: 'Nous codons et intégrons le site.' },
      { title: 'Mise en ligne', description: 'Configuration du domaine et lancement officiel.' },
    ],
    faqs: [
      { q: 'Puis-je modifier le site moi-même après ?', a: 'Oui, nous utilisons des outils qui vous permettront de modifier les textes facilement.' },
      { q: 'Le nom de domaine est-il inclus ?', a: "L'enregistrement du nom de domaine (.com, .fr, .net) est généralement à votre charge pour que vous en soyez l'unique propriétaire." },
    ],
    active: true, featured: true, popular: true, displayOrder: 1,
    budget: 'Moyen', delai: 'Standard', typeBesoin: 'Création',
    image: img('digital'), ...seo('Création de site vitrine', 'Un site web professionnel pour présenter votre activité.'),
  },
  {
    id: 's-dig-2', slug: 'audit-seo', name: 'Audit SEO & Référencement',
    categoryId: 'digital',
    shortDescription: 'Améliorez votre visibilité sur Google.',
    fullDescription: "Une analyse complète de votre site web pour identifier ce qui bloque votre référencement naturel. Nous vous fournissons un plan d'action concret pour remonter dans les résultats de Google.",
    priceType: 'FIXED', startingPrice: 20000, deliveryIncluded: false,
    estimatedDuration: '72 heures',
    includedItems: ['Rapport détaillé (PDF)', 'Analyse technique', 'Analyse des mots-clés', "Plan d'action priorisé"],
    excludedItems: ['Mise en place des corrections sur le site'],
    requirements: [
      { label: "L'URL de votre site web", kind: 'TEXT', required: true, position: 1 },
      { label: 'Vos 3 concurrents principaux', kind: 'TEXT', required: true, position: 2 },
      { label: 'Vos mots-clés cibles', kind: 'TEXT', required: false, position: 3 },
    ],
    howItWorks: [
      { title: 'Collecte', description: "Vous nous transmettez l'URL de votre site et vos concurrents." },
      { title: 'Analyse', description: 'Nous auditons la technique, le contenu et la popularité.' },
      { title: 'Rapport', description: 'Vous recevez un rapport PDF avec un plan d\u2019action priorisé.' },
    ],
    faqs: [
      { q: 'Corrigez-vous les problèmes trouvés ?', a: "L'audit est un diagnostic. La mise en place des corrections peut être commandée séparément." },
    ],
    active: true, featured: false, popular: true, displayOrder: 2,
    budget: 'Faible', delai: 'Rapide', typeBesoin: 'Consulting',
    image: img('digital'), ...seo('Audit SEO & Référencement', 'Améliorez votre visibilité sur Google.'),
  },

  /* -------------------------------- Design ------------------------------- */
  {
    id: 's-des-1', slug: 'creation-logo', name: 'Création de logo',
    categoryId: 'design',
    shortDescription: 'Un logo unique et mémorable pour votre marque.',
    fullDescription: "Nous concevons un logo professionnel qui capture l'essence de votre entreprise. Un design épuré, moderne et déclinable sur tous vos supports de communication.",
    priceType: 'FROM', startingPrice: 15000, deliveryIncluded: false,
    estimatedDuration: '3 à 5 jours',
    includedItems: ['2 propositions initiales', 'Fichiers HD (PNG, JPG)', 'Fichiers vectoriels (AI, EPS)', 'Cession totale des droits'],
    excludedItems: ['Création de la charte graphique complète', 'Impression'],
    requirements: [
      { label: "Nom de l'entreprise", kind: 'TEXT', required: true, position: 1 },
      { label: "Secteur d'activité", kind: 'TEXT', required: true, position: 2 },
      { label: 'Couleurs souhaitées', kind: 'OPTION', required: false, position: 3, options: ['Rouge / orangé', 'Bleu', 'Vert', 'Noir / sobre', 'Libre choix du designer'] },
      { label: 'Exemples de logos que vous aimez', kind: 'FILE', required: false, position: 4 },
    ],
    howItWorks: [
      { title: 'Brief', description: 'Vous nous expliquez votre vision et vos goûts.' },
      { title: 'Création', description: 'Nous concevons 2 propositions distinctes.' },
      { title: 'Révisions', description: "Nous affinons la proposition de votre choix (jusqu'à 3 allers-retours)." },
      { title: 'Livraison', description: 'Envoi de tous les fichiers finaux.' },
    ],
    active: true, featured: true, popular: true, displayOrder: 1,
    budget: 'Faible', delai: 'Rapide', typeBesoin: 'Création',
    image: img('design'), ...seo('Création de logo', 'Un logo unique et mémorable pour votre marque.'),
  },
  {
    id: 's-des-2', slug: 'flyer-pro', name: 'Flyer professionnel',
    categoryId: 'design',
    shortDescription: 'Création graphique rapide et prête à publier.',
    fullDescription: "Conception graphique d'un flyer percutant pour promouvoir votre événement, produit ou service. Un design moderne adapté à l'impression ou au partage sur les réseaux sociaux.",
    priceType: 'FROM', startingPrice: 5000, deliveryIncluded: false,
    estimatedDuration: '48 heures',
    includedItems: ['Design sur mesure recto ou recto/verso', 'Fichier HD prêt pour impression (PDF avec marges)', 'Format adapté aux réseaux sociaux (JPG/PNG)'],
    excludedItems: ['Impression physique', "Recherche d'images payantes"],
    requirements: [
      { label: 'Le texte à faire figurer', kind: 'TEXT', required: true, position: 1 },
      { label: 'Votre logo', kind: 'FILE', required: false, position: 2 },
      { label: 'Format souhaité', kind: 'OPTION', required: true, position: 3, options: ['A5', 'A4', 'Format réseaux sociaux', 'Autre (à préciser)'] },
      { label: "L'événement ou l'offre concernée", kind: 'TEXT', required: true, position: 4 },
    ],
    howItWorks: [
      { title: 'Brief', description: 'Vous nous transmettez les informations et le texte du flyer.' },
      { title: 'Création', description: 'Nous concevons un design sur mesure en 48h.' },
      { title: 'Ajustements', description: "Nous effectuons les retouches nécessaires jusqu'à validation." },
      { title: 'Livraison', description: 'Envoi des fichiers finaux prêts à publier ou imprimer.' },
    ],
    faqs: [
      { q: 'Pouvez-vous aussi imprimer le flyer ?', a: "Oui. L'impression et la livraison sont possibles en supplément — dites-le-nous simplement dans votre demande." },
    ],
    active: true, featured: false, popular: true, displayOrder: 2,
    budget: 'Faible', delai: 'Rapide', typeBesoin: 'Création',
    image: img('design'), ...seo('Flyer professionnel', 'Création graphique rapide et prête à publier.'),
  },
  {
    id: 's-des-3', slug: 'affiche-menu', name: 'Affiche & Menu',
    categoryId: 'design',
    shortDescription: 'Affiches, menus et supports pour votre point de vente.',
    fullDescription: "Conception d'affiches, de menus et de supports visuels pour restaurants, cafés, boutiques et événements. Un rendu professionnel qui donne envie.",
    priceType: 'FROM', startingPrice: 7000, deliveryIncluded: false,
    estimatedDuration: '48 à 72 heures',
    includedItems: ['Design sur mesure', 'Fichier HD prêt pour impression', 'Format adapté aux réseaux sociaux'],
    excludedItems: ['Impression physique', 'Photographie des produits'],
    requirements: [
      { label: 'Vos textes et tarifs', kind: 'TEXT', required: true, position: 1 },
      { label: 'Votre logo', kind: 'FILE', required: false, position: 2 },
      { label: 'Vos préférences de style', kind: 'TEXT', required: false, position: 3 },
    ],
    active: true, featured: false, popular: false, displayOrder: 3,
    budget: 'Faible', delai: 'Rapide', typeBesoin: 'Production',
    image: img('design'), ...seo('Affiche & Menu', 'Affiches, menus et supports pour votre point de vente.'),
  },

  /* ------------------------------ Documents ------------------------------ */
  {
    id: 's-doc-1', slug: 'cv-professionnel', name: 'CV professionnel',
    categoryId: 'documents',
    shortDescription: 'Un CV clair, moderne et prêt à envoyer.',
    fullDescription: 'Nous concevons un CV professionnel qui met en valeur votre parcours. Une mise en page moderne, une hiérarchie claire et un document prêt à envoyer aux recruteurs.',
    priceType: 'FROM', startingPrice: 3000, deliveryIncluded: true,
    estimatedDuration: '24 à 48 heures',
    includedItems: ['Mise en page moderne', 'Fichier PDF HD', 'Version modifiable (Word)', 'Livraison gratuite dans toute la ville de Ngaoundéré'],
    excludedItems: ['Traduction du contenu', 'Photo professionnelle'],
    requirements: [
      { label: 'Votre ancien CV ou vos informations', kind: 'FILE', required: true, position: 1 },
      { label: 'Le poste visé', kind: 'TEXT', required: true, position: 2 },
      { label: 'Votre photo', kind: 'FILE', required: false, position: 3 },
    ],
    howItWorks: [
      { title: 'Brief', description: 'Vous nous envoyez votre parcours et le poste visé.' },
      { title: 'Conception', description: 'Nous rédigeons et mettons en page votre CV.' },
      { title: 'Livraison', description: 'Réception du PDF et de la version modifiable.' },
    ],
    active: true, featured: true, popular: true, displayOrder: 1,
    budget: 'Faible', delai: 'Rapide', typeBesoin: 'Création',
    image: img('documents'), ...seo('CV professionnel', 'Un CV clair, moderne et prêt à envoyer.'),
  },
  {
    id: 's-doc-2', slug: 'lettre-motivation', name: 'Lettre de motivation',
    categoryId: 'documents',
    shortDescription: 'Une lettre percutante pour vos candidatures.',
    fullDescription: "Rédaction d'une lettre de motivation sur mesure, adaptée au poste visé et à votre profil. Un texte professionnel qui marque les esprits.",
    priceType: 'FIXED', startingPrice: 2500, deliveryIncluded: false,
    estimatedDuration: '24 heures',
    includedItems: ['Rédaction sur mesure', 'Adaptation au poste visé', 'Fichier PDF + Word'],
    excludedItems: ['Traduction'],
    requirements: [
      { label: 'Le poste visé', kind: 'TEXT', required: true, position: 1 },
      { label: 'Votre parcours', kind: 'TEXT', required: true, position: 2 },
      { label: "L'offre d'emploi", kind: 'FILE', required: false, position: 3 },
    ],
    active: true, featured: false, popular: false, displayOrder: 2,
    budget: 'Faible', delai: 'Rapide', typeBesoin: 'Création',
    image: img('documents'), ...seo('Lettre de motivation', 'Une lettre percutante pour vos candidatures.'),
  },
  {
    id: 's-doc-3', slug: 'saisie-mise-en-page', name: 'Saisie & mise en page',
    categoryId: 'documents',
    shortDescription: 'Saisie, reformatage et mise en page de vos documents.',
    fullDescription: 'Saisie de textes, reformatage, mise en page de rapports, mémoires et documents administratifs. Un document propre, structuré et présentable.',
    priceType: 'FROM', startingPrice: 5000, deliveryIncluded: true,
    estimatedDuration: 'Selon volume',
    includedItems: ['Saisie fidèle', 'Mise en page professionnelle', 'Fichier PDF + Word', 'Impression possible en supplément'],
    excludedItems: ['Correction du contenu'],
    requirements: [
      { label: 'Votre document source (manuscrit ou numérique)', kind: 'FILE', required: true, position: 1 },
      { label: 'Le nombre de pages estimé', kind: 'QUANTITY', required: true, position: 2 },
      { label: 'Vos consignes de mise en forme', kind: 'TEXT', required: false, position: 3 },
    ],
    active: true, featured: false, popular: false, displayOrder: 3,
    budget: 'Faible', delai: 'Standard', typeBesoin: 'Production',
    image: img('documents'), ...seo('Saisie & mise en page', 'Saisie, reformatage et mise en page de vos documents.'),
  },
  {
    id: 's-doc-4', slug: 'impression-reliure', name: 'Impression & reliure',
    categoryId: 'documents',
    shortDescription: 'Impression, reliure et livraison de vos documents.',
    fullDescription: 'Impression de documents, reliure de mémoires et rapports, plastification. Nous imprimons et vous livrons le résultat final, prêt à déposer.',
    priceType: 'FROM', startingPrice: 1000, deliveryIncluded: true,
    estimatedDuration: 'Le jour même',
    includedItems: ['Impression noir & blanc ou couleur', 'Reliure disponible', 'Livraison gratuite dans toute la ville de Ngaoundéré'],
    excludedItems: ['Rédaction du contenu'],
    requirements: [
      { label: 'Votre fichier (PDF de préférence)', kind: 'FILE', required: true, position: 1 },
      { label: "Le nombre d'exemplaires", kind: 'QUANTITY', required: true, position: 2 },
      { label: 'Couleur ou noir & blanc', kind: 'OPTION', required: true, position: 3, options: ['Noir & blanc', 'Couleur'] },
    ],
    active: true, featured: false, popular: false, displayOrder: 4,
    budget: 'Faible', delai: 'Rapide', typeBesoin: 'Production',
    image: img('documents'), ...seo('Impression & reliure', 'Impression, reliure et livraison de vos documents.'),
  },
  {
    // Service utile ajouté en P03 — active notamment le flux devis (QUOTE).
    id: 's-doc-5', slug: 'traduction-documents', name: 'Traduction de documents',
    categoryId: 'documents',
    shortDescription: 'Traduction français ↔ anglais de vos documents officiels.',
    fullDescription: "Traduction soignée de documents administratifs, académiques ou professionnels (français ↔ anglais). Devis selon le volume et le niveau de technicité.",
    priceType: 'QUOTE', startingPrice: null, priceMin: 5000, priceMax: 50000,
    deliveryIncluded: true, estimatedDuration: '48 heures à 1 semaine',
    includedItems: ['Traduction relue', 'Fichier Word + PDF', 'Livraison gratuite à Ngaoundéré pour la version imprimée'],
    excludedItems: ['Traduction assermentée (sur demande spécifique)'],
    requirements: [
      { label: 'Le document à traduire', kind: 'FILE', required: true, position: 1 },
      { label: 'Le nombre de pages', kind: 'QUANTITY', required: true, position: 2 },
      { label: 'Langue cible', kind: 'OPTION', required: true, position: 3, options: ['Français → Anglais', 'Anglais → Français'] },
      { label: 'Délai souhaité', kind: 'TEXT', required: false, position: 4 },
    ],
    // TODO_PROD : gabarit métier à faire valider (P04).
    whatsappTemplate: 'Bonjour Fika 👋\n\nJe souhaite un devis pour : {{service}}.\n\n{{fields}}\n\nVille : {{city}}\nQuartier : {{zone}}\nDélai souhaité :\n\nMerci de me préciser le budget estimé.',
    active: true, featured: false, popular: false, displayOrder: 5,
    budget: 'Moyen', delai: 'Standard', typeBesoin: 'Production',
    image: img('documents'), ...seo('Traduction de documents', 'Traduction français ↔ anglais de vos documents officiels.'),
  },

  /* ----------------------------- Technologie ----------------------------- */
  {
    id: 's-tec-1', slug: 'reparation-telephone', name: 'Réparation téléphone',
    categoryId: 'technologie',
    shortDescription: 'Nous diagnostiquons avant toute réparation.',
    fullDescription: 'Écran cassé, batterie fatiguée, logiciel bloqué : nous récupérons votre téléphone, diagnostiquons la panne et vous proposons une solution chiffrée avant toute intervention.',
    priceType: 'DIAGNOSTIC', startingPrice: 3000, deliveryIncluded: true,
    estimatedDuration: '24 à 72 heures',
    includedItems: ['Diagnostic complet', 'Devis avant réparation', 'Récupération et livraison à domicile', 'Garantie sur la réparation'],
    excludedItems: ['Le coût des pièces détachées (annoncé dans le devis)'],
    requirements: [
      { label: 'Le modèle exact du téléphone', kind: 'TEXT', required: true, position: 1 },
      { label: 'La description du problème', kind: 'TEXT', required: true, position: 2 },
      { label: "Niveau d'urgence", kind: 'OPTION', required: true, position: 3, options: ['Urgent (sous 24h)', 'Standard', 'Pas pressé'] },
    ],
    howItWorks: [
      { title: 'Récupération', description: 'Nous récupérons votre appareil à domicile.' },
      { title: 'Diagnostic', description: 'Nous identifions la panne et vous envoyons un devis.' },
      { title: 'Réparation', description: 'Après votre validation, nous réparons.' },
      { title: 'Livraison', description: 'Votre appareil vous est livré, réparé et testé.' },
    ],
    faqs: [
      { q: 'Et si je refuse le devis ?', a: "Vous ne payez que le diagnostic. Votre appareil vous est restitué dans l'état." },
      { q: 'Mes données sont-elles en sécurité ?', a: "Oui. Nous n'accédons jamais à vos contenus personnels sans votre accord explicite." },
    ],
    // TODO_PROD : gabarit métier à faire valider (P04).
    whatsappTemplate: 'Bonjour Fika 👋\n\nJe souhaite un diagnostic pour : {{service}} ({{price}}).\n\nInformations appareil :\n{{fields}}\n\nVille : {{city}}\nQuartier : {{zone}}\n\nMerci de me confirmer la prise en charge.',
    active: true, featured: true, popular: true, displayOrder: 1,
    budget: 'Faible', delai: 'Rapide', typeBesoin: 'Intervention',
    image: img('technologie'), ...seo('Réparation téléphone', 'Nous diagnostiquons avant toute réparation.'),
  },
  {
    id: 's-tec-2', slug: 'depannage-ordinateur', name: 'Dépannage ordinateur',
    categoryId: 'technologie',
    shortDescription: 'PC lent, virus, installation : on s\u2019en occupe.',
    fullDescription: 'Formatage, suppression de virus, installation de logiciels, optimisation des performances, remplacement de composants. À domicile ou en récupération.',
    priceType: 'DIAGNOSTIC', startingPrice: 5000, deliveryIncluded: true,
    estimatedDuration: '24 à 72 heures',
    includedItems: ['Diagnostic complet', 'Devis avant intervention', 'Récupération et livraison possibles'],
    excludedItems: ['Licences logicielles payantes', 'Pièces détachées'],
    requirements: [
      { label: "Le modèle de l'ordinateur", kind: 'TEXT', required: true, position: 1 },
      { label: 'Le problème constaté', kind: 'TEXT', required: true, position: 2 },
      { label: 'Vos logiciels indispensables', kind: 'TEXT', required: false, position: 3 },
    ],
    // TODO_PROD : gabarit métier à faire valider (P04).
    whatsappTemplate: 'Bonjour Fika 👋\n\nJe souhaite un diagnostic pour : {{service}} ({{price}}).\n\nInformations appareil :\n{{fields}}\n\nVille : {{city}}\nQuartier : {{zone}}\n\nMerci de me confirmer la prise en charge.',
    active: true, featured: false, popular: false, displayOrder: 2,
    budget: 'Faible', delai: 'Rapide', typeBesoin: 'Support',
    image: img('technologie'), ...seo('Dépannage ordinateur', 'PC lent, virus, installation : on s\u2019en occupe.'),
  },
  {
    id: 's-tec-3', slug: 'installation-reseau', name: 'Installation Wi-Fi & réseau',
    categoryId: 'technologie',
    shortDescription: 'Une connexion stable à la maison ou au bureau.',
    fullDescription: 'Installation et configuration de votre Wi-Fi, répéteurs, caméras et imprimantes réseau. Une installation propre, sécurisée et documentée.',
    priceType: 'QUOTE', startingPrice: null, deliveryIncluded: false,
    estimatedDuration: 'Sur rendez-vous',
    includedItems: ['Visite technique', 'Installation et configuration', 'Sécurisation du réseau'],
    excludedItems: ['Le matériel réseau (nous pouvons le fournir)'],
    requirements: [
      { label: 'Votre besoin (surface, nombre d\u2019appareils)', kind: 'TEXT', required: true, position: 1 },
      { label: 'Le type de connexion disponible', kind: 'OPTION', required: true, position: 2, options: ['Fibre / ADSL', 'Box 4G', 'Aucune pour le moment'] },
    ],
    // TODO_PROD : gabarit métier à faire valider (P04).
    whatsappTemplate: 'Bonjour Fika 👋\n\nJe souhaite un devis pour : {{service}}.\n\n{{fields}}\n\nVille : {{city}}\nQuartier : {{zone}}\nDélai souhaité :\n\nMerci de me préciser le budget estimé.',
    active: true, featured: false, popular: false, displayOrder: 3,
    budget: 'Moyen', delai: 'Standard', typeBesoin: 'Intervention',
    image: img('technologie'), ...seo('Installation Wi-Fi & réseau', 'Une connexion stable à la maison ou au bureau.'),
  },

  /* -------------------------------- Maison ------------------------------- */
  {
    id: 's-mai-1', slug: 'petit-bricolage', name: 'Petites interventions & bricolage',
    categoryId: 'maison',
    shortDescription: 'Fixations, montages, petites réparations à domicile.',
    fullDescription: "Fixation d'étagères, montage de meubles, remplacement de joints, petites réparations. Un professionnel intervient chez vous avec son matériel.",
    priceType: 'QUOTE', startingPrice: null, deliveryIncluded: false,
    estimatedDuration: 'Sur rendez-vous',
    includedItems: ['Déplacement à domicile', 'Outillage professionnel', 'Nettoyage de fin de chantier'],
    excludedItems: ['Les fournitures (vis, joints, etc.)'],
    requirements: [
      { label: 'La description des travaux', kind: 'TEXT', required: true, position: 1 },
      { label: 'Des photos', kind: 'FILE', required: false, position: 2 },
      { label: 'Votre adresse', kind: 'TEXT', required: true, position: 3 },
    ],
    // TODO_PROD : gabarit métier à faire valider (P04).
    whatsappTemplate: 'Bonjour Fika 👋\n\nJe souhaite un devis pour : {{service}}.\n\n{{fields}}\n\nVille : {{city}}\nQuartier : {{zone}}\nDélai souhaité :\n\nMerci de me préciser le budget estimé.',
    active: true, featured: false, popular: false, displayOrder: 1,
    budget: 'Faible', delai: 'Standard', typeBesoin: 'Intervention',
    image: img('maison'), ...seo('Petites interventions & bricolage', 'Fixations, montages, petites réparations à domicile.'),
  },
  {
    id: 's-mai-2', slug: 'menage-nettoyage', name: 'Ménage & nettoyage',
    categoryId: 'maison',
    shortDescription: 'Grand ménage ponctuel ou entretien régulier.',
    fullDescription: 'Nettoyage complet de votre logement ou bureau : sols, sanitaires, cuisine, vitres. Une équipe sérieuse, des produits adaptés, un résultat impeccable.',
    priceType: 'FROM', startingPrice: 10000, deliveryIncluded: false,
    estimatedDuration: 'Une journée',
    includedItems: ['Produits et matériel fournis', 'Équipe encadrée', 'Contrôle qualité en fin de prestation'],
    excludedItems: ['Nettoyage après gros travaux (sur devis)'],
    requirements: [
      { label: 'La surface approximative', kind: 'QUANTITY', required: true, position: 1 },
      { label: 'Les priorités éventuelles', kind: 'TEXT', required: false, position: 2 },
      { label: 'Le créneau souhaité', kind: 'TEXT', required: true, position: 3 },
    ],
    active: true, featured: false, popular: false, displayOrder: 2,
    budget: 'Moyen', delai: 'Standard', typeBesoin: 'Intervention',
    image: img('maison'), ...seo('Ménage & nettoyage', 'Grand ménage ponctuel ou entretien régulier.'),
  },
  {
    id: 's-mai-3', slug: 'montage-meubles', name: 'Montage de meubles',
    categoryId: 'maison',
    shortDescription: 'Montage et installation de vos meubles en kit.',
    fullDescription: 'Montage de meubles en kit, fixation murale sécurisée, réglage des portes et tiroirs. Vous achetez, nous montons.',
    priceType: 'FROM', startingPrice: 8000, deliveryIncluded: false,
    estimatedDuration: '2 à 4 heures',
    includedItems: ['Montage complet', 'Fixations murales si nécessaire', 'Évacuation des emballages'],
    excludedItems: ["L'achat et le transport des meubles"],
    requirements: [
      { label: 'La référence des meubles', kind: 'TEXT', required: true, position: 1 },
      { label: "Le nombre d'éléments à monter", kind: 'QUANTITY', required: true, position: 2 },
    ],
    active: true, featured: false, popular: false, displayOrder: 3,
    budget: 'Faible', delai: 'Standard', typeBesoin: 'Intervention',
    image: img('maison'), ...seo('Montage de meubles', 'Montage et installation de vos meubles en kit.'),
  },

  /* ------------------------------ Mobilité ------------------------------- */
  {
    id: 's-mob-1', slug: 'livraison-courses', name: 'Livraison & courses',
    categoryId: 'mobilite',
    shortDescription: 'Vos achats livrés rapidement à Ngaoundéré.',
    fullDescription: 'Courses au marché, retrait de médicaments, achats en magasin : nous faisons vos courses et vous livrons à domicile ou au bureau.',
    priceType: 'FROM', startingPrice: 1500, deliveryIncluded: true,
    estimatedDuration: 'Dans la journée',
    includedItems: ['Achat sur liste', 'Reçus et monnaie rendus', 'Livraison à domicile'],
    excludedItems: ['Le montant des achats (remboursé sur reçu)'],
    requirements: [
      { label: 'Votre liste de courses', kind: 'TEXT', required: true, position: 1 },
      { label: 'Votre adresse de livraison', kind: 'TEXT', required: true, position: 2 },
      { label: 'Un budget indicatif', kind: 'QUANTITY', required: false, position: 3 },
    ],
    active: true, featured: true, popular: false, displayOrder: 1,
    budget: 'Faible', delai: 'Rapide', typeBesoin: 'Intervention',
    image: img('mobilite'), ...seo('Livraison & courses', 'Vos achats livrés rapidement à Ngaoundéré.'),
  },
  {
    id: 's-mob-2', slug: 'retrait-colis', name: 'Retrait & envoi de colis',
    categoryId: 'mobilite',
    shortDescription: 'Nous récupérons ou expédions vos colis pour vous.',
    fullDescription: "Retrait de colis en agence, dépôt pour expédition, suivi et remise en main propre. Gagnez du temps, on s'occupe de la file d'attente.",
    priceType: 'FIXED', startingPrice: 1000, deliveryIncluded: true,
    estimatedDuration: 'Le jour même',
    includedItems: ['Retrait en agence', 'Preuve de dépôt ou de retrait', 'Remise à domicile'],
    excludedItems: ["Les frais d'expédition du transporteur"],
    requirements: [
      { label: "L'agence concernée", kind: 'TEXT', required: true, position: 1 },
      { label: 'La référence du colis', kind: 'TEXT', required: true, position: 2 },
      { label: 'Le destinataire', kind: 'TEXT', required: true, position: 3 },
    ],
    active: true, featured: false, popular: false, displayOrder: 2,
    budget: 'Faible', delai: 'Rapide', typeBesoin: 'Intervention',
    image: img('mobilite'), ...seo('Retrait & envoi de colis', 'Nous récupérons ou expédions vos colis pour vous.'),
  },

  /* ------------------------------ Entreprise ----------------------------- */
  {
    id: 's-ent-1', slug: 'whatsapp-business', name: 'Configuration WhatsApp Business',
    categoryId: 'entreprise',
    shortDescription: 'Un profil professionnel prêt à vendre.',
    fullDescription: 'Création et configuration complète de votre profil WhatsApp Business : catalogue produits, messages automatiques, réponses rapides et catalogue soigné.',
    priceType: 'FIXED', startingPrice: 5000, deliveryIncluded: false,
    estimatedDuration: '24 à 48 heures',
    includedItems: ['Profil professionnel complet', "Catalogue (jusqu'à 10 produits)", "Messages d'accueil et d'absence", 'Réponses rapides types'],
    excludedItems: ['La création des visuels produits'],
    requirements: [
      { label: 'Vos horaires et coordonnées', kind: 'TEXT', required: true, position: 1 },
      { label: 'Vos produits/services phares', kind: 'TEXT', required: true, position: 2 },
      { label: 'Votre logo', kind: 'FILE', required: false, position: 3 },
    ],
    active: true, featured: true, popular: true, displayOrder: 1,
    budget: 'Faible', delai: 'Rapide', typeBesoin: 'Optimisation',
    image: img('entreprise'), ...seo('Configuration WhatsApp Business', 'Un profil professionnel prêt à vendre.'),
  },
  {
    id: 's-ent-2', slug: 'google-business', name: 'Fiche Google Business',
    categoryId: 'entreprise',
    shortDescription: 'Soyez visible quand on vous cherche sur Google.',
    fullDescription: 'Création et optimisation de votre fiche Google Business : adresse, horaires, photos, catégories et mots-clés pour apparaître sur Google Maps et la recherche locale.',
    priceType: 'FIXED', startingPrice: 7500, deliveryIncluded: false,
    estimatedDuration: '72 heures',
    includedItems: ['Création / revendication de la fiche', 'Optimisation complète', 'Photos et description soignées', 'Conseils pour récolter des avis'],
    excludedItems: ['La publicité Google Ads'],
    requirements: [
      { label: 'Vos coordonnées exactes', kind: 'TEXT', required: true, position: 1 },
      { label: 'Vos horaires', kind: 'TEXT', required: true, position: 2 },
      { label: "Quelques photos de l'activité", kind: 'FILE', required: false, position: 3 },
    ],
    active: true, featured: false, popular: false, displayOrder: 2,
    budget: 'Faible', delai: 'Rapide', typeBesoin: 'Optimisation',
    image: img('entreprise'), ...seo('Fiche Google Business', 'Soyez visible quand on vous cherche sur Google.'),
  },
  {
    id: 's-ent-3', slug: 'supports-commerciaux', name: 'Supports commerciaux',
    categoryId: 'entreprise',
    shortDescription: 'Cartes de visite, brochures et présentations.',
    fullDescription: 'Conception de cartes de visite, brochures, présentations commerciales et documents de vente professionnels pour crédibiliser votre activité.',
    priceType: 'FROM', startingPrice: 5000, deliveryIncluded: true,
    estimatedDuration: '48 à 72 heures',
    includedItems: ['Design sur mesure', 'Fichiers prêts pour impression', 'Impression et livraison possibles'],
    excludedItems: ['La rédaction complète des contenus'],
    requirements: [
      { label: 'Vos informations', kind: 'TEXT', required: true, position: 1 },
      { label: 'Votre logo', kind: 'FILE', required: false, position: 2 },
      { label: 'Support souhaité et quantités', kind: 'TEXT', required: true, position: 3 },
    ],
    active: true, featured: false, popular: false, displayOrder: 3,
    budget: 'Faible', delai: 'Standard', typeBesoin: 'Production',
    image: img('entreprise'), ...seo('Supports commerciaux', 'Cartes de visite, brochures et présentations.'),
  },
];

/* ------------------------------ Packs ---------------------------------
 * Remises réelles calculables : computePackageSavings (lib/pricing) compare
 * le prix du pack à la somme des prix détail des lignes (PackageService).
 */
export const UNIVERSE_PACKAGES: Package[] = [
  {
    id: 'pack-etudiant', slug: 'pack-etudiant', title: 'Pack Étudiant',
    description: 'Tout pour candidater avec un dossier irréprochable.',
    price: 7000, targetCustomer: 'Étudiants & jeunes diplômés',
    services: [
      { serviceId: 's-doc-1', quantity: 1 },
      { serviceId: 's-doc-2', quantity: 1 },
      { serviceId: 's-doc-3', quantity: 1 },
    ],
    active: true, categoryId: 'documents',
  },
  {
    id: 'pack-commerce', slug: 'pack-commerce', title: 'Pack Commerce',
    description: 'Rendez votre boutique visible et professionnelle.',
    price: 15000, targetCustomer: 'Commerçants & restaurateurs',
    services: [
      { serviceId: 's-des-2', quantity: 1 },
      { serviceId: 's-ent-1', quantity: 1 },
      { serviceId: 's-ent-2', quantity: 1 },
    ],
    active: true, categoryId: 'entreprise',
  },
  {
    id: 'pack-lancement', slug: 'pack-lancement', title: 'Pack Lancement',
    description: 'Lancez votre marque avec une identité complète.',
    price: 25000, targetCustomer: 'Nouvelles entreprises',
    services: [
      { serviceId: 's-des-1', quantity: 1 },
      { serviceId: 's-des-2', quantity: 1 },
      { serviceId: 's-ent-1', quantity: 1 },
      { serviceId: 's-ent-2', quantity: 1 },
    ],
    active: true, categoryId: 'design',
  },
];

/* --------------------- Surcharges ville (ServiceCityPrice) ------------------
 * Lignes de pricing par ville. Ngaoundéré : deliveryIncluded=true partout
 * (invariant — la gratuité client ne dépend jamais du quartier).
 */
export const CITY_PRICES: CityPricing[] = [
  {
    serviceId: 's-dig-1', citySlug: DEFAULT_CITY_SLUG,
    priceMin: 25000, priceMax: 75000, targetMarginPercent: 45,
    deliveryIncluded: true,
  },
  {
    serviceId: 's-des-1', citySlug: DEFAULT_CITY_SLUG,
    priceMin: 15000, priceMax: 30000, targetMarginPercent: 45,
    deliveryIncluded: true,
  },
  {
    serviceId: 's-tec-1', citySlug: DEFAULT_CITY_SLUG,
    priceMin: null, priceMax: null, targetMarginPercent: 45,
    deliveryIncluded: true,
  },
];

/* ------------------------------ Helpers data ------------------------------- */

/** Référence service brute par id (usage interne pricing/catalog/seed). */
export const getServiceRef = (id: string): Service | undefined =>
  SERVICES.find((s) => s.id === id);

export const POPULAR_ORDER = ['flyer-pro', 'cv-professionnel', 'site-vitrine', 'reparation-telephone'];
