import { getCategories, getCategoryBySlug, getServiceBySlug } from './catalog';
import { displayPrice, getCityPricing } from './pricing';
import {
  SITE_CITY, SITE_DOMAIN, SITE_NAME, SITE_URL, WHATSAPP_PHONE_E164,
} from './site';
import type { Service } from './types';

/**
 * Métadonnées du site (P09) — source unique.
 * Chaque route publique possède un title, une description et un canonical
 * UNIQUES. Un seul domaine : SITE_URL (config centralisée).
 * Le template « %s | Fika » évite tout doublon « Fika | Fika ».
 */

export const OG_IMAGE_PATH = '/og.png';
export const OG_IMAGE_URL = `${SITE_URL}${OG_IMAGE_PATH}`;

export interface RouteMeta {
  title: string;
  description: string;
  /** Chemin canonical (ex. /service/flyer-pro). */
  path: string;
  ogType: 'website' | 'article';
  jsonLd: Record<string, unknown>[];
}

const withSuffix = (t: string): string => (t.endsWith('| Fika') ? t : `${t} | Fika`);

/* ------------------------------ JSON-LD base ------------------------------- */

export function localBusinessJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: SITE_NAME,
    description:
      'Agence orchestratrice de services numériques, techniques et pratiques à Ngaoundéré. Vous faites votre demande, nous gérons le reste.',
    url: SITE_URL,
    image: OG_IMAGE_URL,
    telephone: WHATSAPP_PHONE_E164,
    priceRange: 'FCFA',
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE_CITY,
      addressRegion: 'Adamaoua',
      addressCountry: 'CM',
    },
    geo: { '@type': 'GeoCoordinates', latitude: 7.3197, longitude: 13.5843 },
    // sameAs : TODO_PROD (comptes sociaux officiels à confirmer — jamais inventés)
    areaServed: {
      '@type': 'City',
      name: SITE_CITY,
      '@id': `https://www.wikidata.org/wiki/Q212187`,
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '08:00',
      closes: '18:00',
    },
  };
}

export function serviceJsonLd(service: Service): Record<string, unknown> {
  const pricing = getCityPricing(service.id);
  const price = pricing.priceMin ?? service.startingPrice ?? null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    serviceType: service.name,
    description: service.fullDescription ?? service.shortDescription,
    provider: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    areaServed: { '@type': 'City', name: SITE_CITY },
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/service/${service.slug}`,
      priceCurrency: 'XAF',
      ...(price != null ? { price } : {}),
      description: displayPrice(service, pricing),
    },
  };
}

export function faqPageJsonLd(faqs: { q: string; a: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

/* ------------------------------- Par route --------------------------------- */

const STATIC_META: Record<string, { title: string; description: string }> = {
  '/': {
    title: "Services et boutique à Ngaoundéré",
    description:
      "Un besoin, un produit ou une solution ? Fika vous accompagne : services du quotidien coordonnés par une équipe locale, et sélection de produits livrés à Ngaoundéré.",
  },
  '/services': {
    title: "Fika Services : tous nos services",
    description:
      "Plomberie, électricité, travaux, réparation, transport et services utiles du quotidien à Ngaoundéré. Décrivez votre besoin, nous trouvons et coordonnons la bonne personne.",
  },
  '/demande': {
    title: 'Décrire mon besoin',
    description:
      "Vous ne trouvez pas votre besoin dans le catalogue ? Décrivez-le en 2 minutes : Fika examine votre demande, recherche la solution et vous rappelle avec un prix à Ngaoundéré.",
  },
  '/demande-produit': {
    title: 'Demander un produit',
    description:
      'Vous cherchez un produit à Ngaoundéré ? Décrivez-le : Fika vérifie sa disponibilité et son prix, puis organise la livraison. Prix final confirmé avant tout paiement.',
  },
  '/mentions-legales': {
    title: 'Mentions légales',
    description: 'Mentions légales de Fika — éditeur du site, hébergement, propriété intellectuelle.',
  },
  '/cgv': {
    title: 'Conditions Générales de Vente',
    description: "Les CGV de Fika : commande, prix en FCFA validés avant démarrage, déplacement organisé par Fika, contrôle qualité à Ngaoundéré.",
  },
  '/confidentialite': {
    title: 'Politique de confidentialité',
    description: 'Comment Fika collecte, utilise et protège vos données personnelles. Aucune vente ni partage inutile.',
  },
  '/boutique': {
    title: 'Fika Market : commander les bons produits à Ngaoundéré',
    description: 'Produits sélectionnés par Fika, précommandés et livrés à Ngaoundéré. Prix final et délai confirmés avant tout paiement, suivi simple par code personnel.',
  },
  '/boutique/commande': {
    title: 'Votre commande Fika Market',
    description: 'Envoyez votre demande de commande : Fika vérifie la disponibilité puis confirme le prix final et le délai avant tout paiement.',
  },
  '/boutique/panier': {
    title: 'Mon panier Fika Market',
    description: "Votre sélection de produits Fika Market. Total indicatif : le prix final (produits + livraison) est confirmé par devis avant tout paiement.",
  },
  '/_404': {
    title: 'Page introuvable',
    description: "La page demandée n'existe pas. Retournez à l'accueil Fika, on s'occupe du reste.",
  },
};

export function seoForRoute(path: string): RouteMeta {
  if (path.startsWith('/admin')) return { title: 'Espace équipe | Fika', description: 'Administration Fika', path, ogType: 'website', jsonLd: [] };
  const staticMeta = STATIC_META[path] ?? STATIC_META['/_404'];
  const base: RouteMeta = {
    title: withSuffix(staticMeta.title),
    description: staticMeta.description,
    path,
    ogType: 'website',
    jsonLd: [],
  };

  if (path === '/') {
    base.jsonLd = [localBusinessJsonLd()];
    return base;
  }

  if (path.startsWith('/boutique/produit/')) {
    return { ...base, title: 'Produit | Fika Market', description: 'Fiche produit Fika Market : prix indicatif, disponibilité et commande à Ngaoundéré.', path, ogType: 'article', jsonLd: [] };
  }
  if (path.startsWith('/boutique/categorie/')) {
    return { ...base, title: 'Catégorie | Fika Market', description: 'Parcourez les produits Fika Market par catégorie.', path, ogType: 'website', jsonLd: [] };
  }

  if (path.startsWith('/univers/')) {
    const slug = decodeURIComponent(path.slice('/univers/'.length));
    const u = getCategoryBySlug(slug);
    if (!u) return { ...base, title: 'Univers introuvable | Fika', jsonLd: [] };
    return {
      ...base,
      title: `Univers ${u.title} à Ngaoundéré | Fika`,
      description: `${u.promise} ${u.examples ?? 'Services Fika'} — orchestrés et contrôlés par Fika à ${SITE_CITY}.`,
      path,
      ogType: 'article',
      jsonLd: [breadcrumbJsonLd([{ name: 'Accueil', path: '/' }, { name: u.title, path }])],
    };
  }

  if (path.startsWith('/service/')) {
    const slug = decodeURIComponent(path.slice('/service/'.length));
    const s = getServiceBySlug(slug);
    if (!s) return { ...base, title: 'Service introuvable | Fika', jsonLd: [] };
    const universe = getCategoryBySlug(s.categoryId);
    return {
      ...base,
      // seoTitle/seoDescription semés en P03 = source ; repli sur nom + court.
      title: withSuffix(s.seoTitle ?? `${s.name} à ${SITE_CITY} | Fika`),
      description:
        s.seoDescription
        ?? `${s.shortDescription} par Fika à ${SITE_CITY}. ${displayPrice(s, getCityPricing(s.id))} — professionnel sélectionné par Fika, résultat contrôlé, WhatsApp direct.`,
      path,
      ogType: 'article',
      jsonLd: [
        serviceJsonLd(s),
        ...(s.faqs && s.faqs.length > 0 ? [faqPageJsonLd(s.faqs)] : []),
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          ...(universe ? [{ name: universe.title, path: `/univers/${universe.slug}` }] : []),
          { name: s.name, path },
        ]),
      ],
    };
  }

  return base;
}

/* --------------------------- Application au document ------------------------ */

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertCanonical(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

/** Injecte/replace les scripts JSON-LD (composant étranger à dangerouslySetInnerHTML). */
function upsertJsonLd(jsonLd: Record<string, unknown>[]): void {
  const id = 'fika-jsonld';
  document.getElementById(id)?.remove();
  if (!jsonLd.length) return;
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = id;
  script.textContent = JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd);
  document.head.appendChild(script);
}

export function applyRouteMeta(meta: RouteMeta): void {
  document.title = meta.title;

  upsertMeta('name', 'description', meta.description);
  upsertCanonical(`${SITE_URL}${meta.path}`);

  upsertMeta('property', 'og:title', meta.title);
  upsertMeta('property', 'og:description', meta.description);
  upsertMeta('property', 'og:url', `${SITE_URL}${meta.path}`);
  upsertMeta('property', 'og:type', meta.ogType);
  upsertMeta('property', 'og:site_name', SITE_NAME);
  upsertMeta('property', 'og:image', OG_IMAGE_URL);
  upsertMeta('property', 'og:image:width', '1200');
  upsertMeta('property', 'og:image:height', '630');
  upsertMeta('property', 'og:image:alt', `${SITE_NAME} — vous avez besoin de quelque chose ? Nous nous occupons du reste.`);

  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', meta.title);
  upsertMeta('name', 'twitter:description', meta.description);
  upsertMeta('name', 'twitter:image', OG_IMAGE_URL);

  upsertJsonLd(meta.jsonLd);
}

/* ------------------------------- Vérifications ----------------------------- */

/** Liste de toutes les routes publiques (contrôle d'unicité SEO/Sitemap). */
export function getAllPublicRoutes(): string[] {
  const routes = ['/', '/services', '/demande', '/mentions-legales', '/cgv', '/confidentialite'];
  for (const u of getCategories()) routes.push(`/univers/${u.slug}`);
  for (const slug of getAllServiceSlugs()) routes.push(`/service/${slug}`);
  return routes;
}

function getAllServiceSlugs(): string[] {
  // Pas d'export direct : on dérive via le catalogue (source unique).
  return getCategories().flatMap((c) => getServiceSlugsOf(c.id));
}

import { getServices } from './catalog';

function getServiceSlugsOf(categoryId: string): string[] {
  return getServices({ categoryId }).map((s) => s.slug);
}

/** Détecte les collisions de title/description sur tout le site (test P09). */
export function findSeoDuplicates(): { titles: string[]; descriptions: string[] } {
  const metas = getAllPublicRoutes().map((r) => seoForRoute(r));
  const dup = (values: string[]) => {
    const seen = new Map<string, number>();
    for (const v of values) seen.set(v, (seen.get(v) ?? 0) + 1);
    return [...seen.entries()].filter(([, n]) => n > 1).map(([v]) => v);
  };
  return { titles: dup(metas.map((m) => m.title)), descriptions: dup(metas.map((m) => m.description)) };
}

export const SEO_DOMAIN = SITE_DOMAIN;
