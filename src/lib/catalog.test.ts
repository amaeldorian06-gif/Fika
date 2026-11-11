import { describe, it, expect } from 'vitest';
import { searchServices, getServices } from './catalog';

/**
 * Recherche de services — efficacité réelle sur le catalogue réel (18
 * services actifs). Chaque règle du moteur doit rester vraie.
 */
describe('searchServices', () => {
  it('catalogue réel chargé : 18 services actifs (base des tests)', () => {
    expect(getServices().length).toBeGreaterThanOrEqual(18);
  });

  it('mot simple : « plomberie » trouve le dépannage plomberie, en premier', () => {
    const r = searchServices('plomberie');
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].name).toBe('Dépannage Plomberie'); // match par le nom → classé premier
  });

  it('insensible à la casse : « PLOMBERIE » trouve pareil', () => {
    expect(searchServices('PLOMBERIE').some((s) => s.slug === 'intervention-plomberie' || s.name === 'Dépannage Plomberie')).toBe(true);
  });

  it('insensible aux accents : « reparation » trouve « Réparation Téléphone & Tablette »', () => {
    const r = searchServices('reparation');
    expect(r.some((s) => s.name === 'Réparation Téléphone & Tablette')).toBe(true);
    expect(r.some((s) => s.name === 'Entretien & Réparation Moto')).toBe(true);
  });

  it('multi-mots : « telephone ecran » matche nom + description du même service', () => {
    const r = searchServices('telephone ecran');
    expect(r.some((s) => s.name === 'Réparation Téléphone & Tablette')).toBe(true); // « téléphone » (nom) + « Écran cassé » (description)
    // Un service qui matche « ecran » mais pas « telephone » ne doit pas sortir
    expect(r.some((s) => s.name === 'Dépannage Ordinateur & Imprimante')).toBe(false); // « écran noir » mais pas téléphone
  });

  it('recherche par univers : « transport » ramène aussi les livraisons (catégorie)', () => {
    const r = searchServices('transport');
    const slugs = r.map((s) => s.slug);
    expect(slugs).toContain('demenagement-local'); // nom
    expect(slugs).toContain('livraison-courses-express'); // via l'univers Transport & Logistique
    expect(r[0].name).toBe('Déménagement Local & Transport'); // match nom avant match catégorie
  });

  it('classement : match par le nom avant match par description seule', () => {
    const r = searchServices('fuite');
    // « Fuite d'eau » (description plomberie) et « fuite de toit » (description toiture) :
    // aucun match par le nom → les deux sortent, ordre éditorial conservé
    const names = r.map((s) => s.name);
    expect(names).toContain('Dépannage Plomberie');
    expect(names).toContain('Toiture & Étanchéité');
  });

  it('multi-mots exige TOUS les mots : « ordinateur voiture » ne trouve rien', () => {
    expect(searchServices('ordinateur voiture')).toEqual([]);
  });

  it('honnête : requête sans correspondance → liste vide', () => {
    expect(searchServices('zzz-inexistant')).toEqual([]);
  });

  it('requête vide ou blanche → liste vide (pas de « tout afficher » implicite)', () => {
    expect(searchServices('')).toEqual([]);
    expect(searchServices('   ')).toEqual([]);
  });

  it('aucun doublon dans les résultats', () => {
    const r = searchServices('depannage');
    expect(new Set(r.map((s) => s.id)).size).toBe(r.length);
  });
});
