import { describe, expect, it } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { FOUNDER_EMAIL, founderPasswordHash, isFounderEmail, isFounderPassword } from '../lib/founder';

// Le mot de passe réel n'apparaît jamais ici : on vérifie la mécanique
// (format du hash, refus des mauvais mots de passe, normalisation de l'e-mail).
describe('compte fondateur (identifiants intégrés au code)', () => {
  it('reconnaît l e-mail du fondateur quelle que soit la casse', () => {
    expect(FOUNDER_EMAIL).toBe('amaeldorian06@gmail.com');
    expect(isFounderEmail('  AmaelDorian06@Gmail.com ')).toBe(true);
    expect(isFounderEmail('admin@fika.cm')).toBe(false);
  });

  it('stocke un hash bcrypt valide (coût 12), jamais un mot de passe en clair', () => {
    expect(founderPasswordHash()).toMatch(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/);
  });

  it('refuse un mot de passe incorrect ou vide', async () => {
    expect(await isFounderPassword('mot-de-passe-incorrect')).toBe(false);
    expect(await isFounderPassword('')).toBe(false);
  });

  it('FOUNDER_PASSWORD_HASH (env) remplace le hash par défaut, un hash invalide est ignoré', async () => {
    const previous = process.env.FOUNDER_PASSWORD_HASH;
    try {
      process.env.FOUNDER_PASSWORD_HASH = bcrypt.hashSync('nouveau-mdp-de-test', 4).replace(/^\$2a\$04\$/, '$2b$12$');
      // hash forgé de longueur valide mais coût réécrit : le format passe, la comparaison reste cohérente avec bcrypt
      expect(founderPasswordHash()).toBe(process.env.FOUNDER_PASSWORD_HASH);
      process.env.FOUNDER_PASSWORD_HASH = 'pas-un-hash';
      expect(founderPasswordHash()).not.toBe('pas-un-hash');
      expect(await isFounderPassword('pas-un-hash')).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.FOUNDER_PASSWORD_HASH; else process.env.FOUNDER_PASSWORD_HASH = previous;
    }
  });

  it('accepte exactement le mot de passe correspondant au hash', async () => {
    const hash = bcrypt.hashSync('exemple-de-test-uniquement', 4);
    expect(bcrypt.compareSync('exemple-de-test-uniquement', hash)).toBe(true);
    expect(bcrypt.compareSync('autre', hash)).toBe(false);
  });
});
