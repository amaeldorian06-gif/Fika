/**
 * Chaînes d'interface de la couche navigation / entrée — centralisées pour
 * préparer une future localisation (le français reste la langue active).
 * Le reste de l'application garde ses chaînes en place ; cette structure
 * s'étendra progressivement.
 */
export const COPY_NAV = {
  brand: 'Fika',
  universes: {
    boutique: 'Boutique',
    services: 'Services',
  },
  actions: {
    search: 'Rechercher un service ou un produit',
    cart: 'Mon panier',
    describeNeed: 'Décrire mon besoin',
    whatsapp: 'WhatsApp',
  },
  bottomNav: {
    home: 'Accueil',
    boutique: 'Boutique',
    services: 'Services',
    panier: 'Panier',
  },
  entry: {
    eyebrow: 'Ngaoundéré · Une marque, deux façons de vous aider',
    title: 'Un besoin, un produit ou une solution ?',
    titleAccent: 'Fika vous accompagne.',
    subtitle: 'Découvrez nos services et notre sélection de produits pensés pour simplifier votre quotidien.',
    services: {
      title: 'Besoin d\u2019un service ?',
      text: 'Décrivez votre besoin. Nous vous aidons à trouver et organiser la bonne solution.',
      cta: 'Découvrir les services',
    },
    market: {
      title: 'À la recherche d\u2019un produit ?',
      text: 'Explorez notre sélection et trouvez les produits qui vous correspondent.',
      cta: 'Explorer la boutique',
    },
    trust: [
      'Prix validé avec vous avant toute intervention',
      'Prix final confirmé avant tout paiement',
      'Suivi simple, du début à la fin',
    ],
    shortcuts: {
      describe: 'Décrire mon besoin directement',
    },
  },
  search: {
    placeholder: 'Rechercher : plomberie, écouteurs, CV…',
    minChars: 'Tapez au moins 2 caractères pour lancer la recherche.',
    noResults: 'Aucun résultat pour cette recherche.',
    servicesSection: 'Services',
    productsSection: 'Produits',
    productsHint: 'Depuis la boutique Fika Market',
    close: 'Fermer la recherche',
  },
} as const;
