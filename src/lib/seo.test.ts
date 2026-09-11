import { describe, expect, it } from 'vitest';
import { findSeoDuplicates, getAllPublicRoutes, seoForRoute, localBusinessJsonLd } from './seo';
import { getServiceBySlug } from './catalog';

describe('métadonnées — couverture et unicité', () => {
  it('chaque route publique a title, description et canonical uniques', () => {
    const { titles, descriptions } = findSeoDuplicates();
    expect(titles).toEqual([]);
    expect(descriptions).toEqual([]);
  });

  it('toutes les routes visent un seul domaine (canonical vérifié)', () => {
    for (const route of getAllPublicRoutes()) {
      const meta = seoForRoute(route);
      expect(meta.path).toBe(route);
      expect(meta.title.length).toBeGreaterThan(15);
      expect(meta.title.endsWith('| Fika')).toBe(true);
      expect(meta.description.length).toBeGreaterThan(40);
    }
  });

  it('pas de doublon « Fika | Fika »', () => {
    for (const route of getAllPublicRoutes()) {
      expect(seoForRoute(route).title).not.toContain('Fika | Fika');
    }
  });

  it('le catalogue génère 30+ routes publiques', () => {
    expect(getAllPublicRoutes().length).toBeGreaterThanOrEqual(30);
  });

  it('fiche service : seoTitle/seoDescription priment, JSON-LD Service + Offer', () => {
    const service = getServiceBySlug('site-vitrine');
    expect(service).toBeDefined();
    const meta = seoForRoute('/service/site-vitrine');
    expect(meta.title).toBe('Création de site vitrine à Ngaoundéré | Fika');
    expect(meta.jsonLd.some((ld) => ld['@type'] === 'Service')).toBe(true);
    const offer = meta.jsonLd.find((ld) => ld['@type'] === 'Service') as { offers?: { price?: number; priceCurrency?: string } };
    expect(offer?.offers?.priceCurrency).toBe('XAF');
    expect(offer?.offers?.price).toBe(25000);
  });

  it('fiche avec FAQ embarque un bloc FAQPage', () => {
    const meta = seoForRoute('/service/site-vitrine');
    expect(meta.jsonLd.some((ld) => ld['@type'] === 'FAQPage')).toBe(true);
    // une fiche sans FAQ ne doit pas émettre de FAQPage vide
    const metaSans = seoForRoute('/service/lettre-motivation');
    expect(metaSans.jsonLd.some((ld) => ld['@type'] === 'FAQPage')).toBe(false);
  });

  it('home : LocalBusiness complet Ngaoundéré + geo', () => {
    const ld = localBusinessJsonLd();
    expect(ld['@type']).toBe('LocalBusiness');
    const geo = ld.geo as { latitude: number; longitude: number };
    expect(geo.latitude).toBeCloseTo(7.3197, 4);
    const address = ld.address as { addressLocality: string };
    expect(address.addressLocality).toBe('Ngaoundéré');
  });
});
