/**
 * Annuaire villes/zones — source unique de la ville opérée (P11).
 *
 * Règle d'or : opérer une nouvelle ville = ajouter une ligne ACTIVE_CITIES
 * (activité) + ses zones (+ ses ServiceCityPrice). Une `active: false` ne
 * doit apparaître NULLE PART dans l'UI. Ngaoundéré est la seule ville active.
 */

export const DEFAULT_CITY_SLUG = 'ngaoundere';

export interface CityInfo {
  slug: string;
  name: string;
  /** Seules les villes actives sont visibles (formulaire, fiches, seed). */
  active: boolean;
  /**
   * Si true, la promesse de livraison gratuite s'affiche de manière littérale.
   * Si false, l'UI DOIT afficher une formulation différente — jamais la
   * promesse Ngaoundéré par défaut (invariant : pas de promesse fausse).
   */
  deliveryFreeCityWide: boolean;
}

/** Villes connues. Ajout produit = nouvelle ligne avec active: true. */
export const ACTIVE_CITIES: CityInfo[] = [
  {
    slug: DEFAULT_CITY_SLUG,
    name: 'Ngaoundéré',
    active: true,
    deliveryFreeCityWide: true,
  },
];

/** Villes activement opérées (filtre infaillible — extension multi-ville). */
export const getActiveCities = (): CityInfo[] => ACTIVE_CITIES.filter((c) => c.active);

export const getCityBySlug = (slug: string): CityInfo | undefined =>
  ACTIVE_CITIES.find((c) => c.slug === slug);

export const isOnlyOneActiveCity = (): boolean => getActiveCities().length === 1;

export const OTHER_ZONE_VALUE = '__autre';

export const ZONE_GROUPS_BY_CITY: Record<string, { commune: string; names: string[] }[]> = {
  [DEFAULT_CITY_SLUG]: [
    {
      commune: 'Ngaoundéré I urbain',
      names: [
        'Bamyanga', 'Béka', 'Camp fonctionnaires', 'Centre administratif',
        'Haut Plateau', 'Mbibakala', 'Ndelbé', 'Quartier résidentiel',
        'Socaret', 'Wakwa',
      ],
    },
    {
      commune: 'Ngaoundéré II urbain',
      names: [
        'Baladji 1', 'Baladji 2', 'Cifan', 'Joli Soir', 'Gada Mabanga',
        'Kormari', 'Madagascar', 'Mbibar', 'Sabongari 1', 'Sabongari 2',
        'Sabongari 3', 'Tongo 1', 'Tongo Falingo', 'Tongo Galdima', 'Yarbang',
      ],
    },
  ],
  // Garoua : TODO_PROD (zones à faire valider avant activation)
  // Maroua : TODO_PROD (zones à faire valider avant activation)
};

/** Groupes de quartiers d'une ville (vide si ville non en service). */
export function getZonesForCity(slug: string): { commune: string; names: string[] }[] {
  return ZONE_GROUPS_BY_CITY[slug] ?? [];
}

/** Liste plate des quartiers d'une ville. */
export function getZoneNamesForCity(slug: string): string[] {
  return getZonesForCity(slug).flatMap((g) => g.names);
}

/* ----- Compat ascendante (P02/P05) : alias historiques, mêmes données ------ */

export const ZONE_GROUPS = ZONE_GROUPS_BY_CITY[DEFAULT_CITY_SLUG];
export const ZONE_NAMES: string[] = getZoneNamesForCity(DEFAULT_CITY_SLUG);
