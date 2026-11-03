import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cart, cartItemKey } from './cart';

/** localStorage minimal + window simulé (les tests tournent en environnement node). */
function installDom() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  });
  vi.stubGlobal('window', { dispatchEvent: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() });
}

const base = { productId: 'p1', slug: 'casque-audio', name: 'Casque audio', reference: 'FK-TEST-01', image: null, priceSale: 15000, variantLabel: 'Couleur : Noir' };

describe('panier Fika Market (cart.ts)', () => {
  beforeEach(() => { installDom(); cart.clear(); });

  it('construit une clé stable produit + variante', () => {
    expect(cartItemKey({ productId: 'p1', variantLabel: 'Couleur : Noir' })).toBe('p1|Couleur : Noir');
    expect(cartItemKey({ productId: 'p1', variantLabel: null })).toBe('p1|');
    expect(cartItemKey({ productId: 'p2', variantLabel: 'Couleur : Noir' })).not.toBe(cartItemKey({ productId: 'p1', variantLabel: 'Couleur : Noir' }));
  });

  it('ajoute, cumule les quantités et calcule le total indicatif', () => {
    expect(cart.add(base, 2).ok).toBe(true);
    expect(cart.count()).toBe(2);
    expect(cart.add(base, 1).ok).toBe(true); // même clé → quantité cumulée
    expect(cart.items()).toHaveLength(1);
    expect(cart.items()[0].quantity).toBe(3);
    expect(cart.totalIndicatif()).toBe(45000);
  });

  it('distingue deux variantes du même produit', () => {
    cart.add(base, 1);
    cart.add({ ...base, variantLabel: 'Couleur : Blanc' }, 1);
    expect(cart.items()).toHaveLength(2);
    expect(cart.count()).toBe(2);
  });

  it('ajuste la quantité, plafonne à 20 et retire à zéro', () => {
    cart.add(base, 5);
    const key = cartItemKey(base);
    cart.setQuantity(key, 3);
    expect(cart.items()[0].quantity).toBe(3);
    cart.setQuantity(key, 99);
    expect(cart.items()[0].quantity).toBe(20);
    cart.setQuantity(key, 0);
    expect(cart.items()).toHaveLength(0);
  });

  it('refuse au-delà de 10 références distinctes', () => {
    for (let i = 0; i < 10; i++) {
      expect(cart.add({ ...base, productId: `p${i}` }, 1).ok).toBe(true);
    }
    const res = cart.add({ ...base, productId: 'p-extra' }, 1);
    expect(res).toEqual({ ok: false, reason: 'LIMIT_ITEMS' });
    expect(cart.items()).toHaveLength(10);
  });

  it('refuse une quantité totale supérieure à 20 par référence', () => {
    cart.add(base, 20);
    expect(cart.add(base, 1)).toEqual({ ok: false, reason: 'LIMIT_QUANTITY' });
  });

  it('retire une ligne précise et vide le panier', () => {
    cart.add(base, 1);
    cart.add({ ...base, variantLabel: null }, 2);
    cart.remove(cartItemKey(base));
    expect(cart.items()).toHaveLength(1);
    expect(cart.items()[0].variantLabel).toBeNull();
    cart.clear();
    expect(cart.count()).toBe(0);
  });

  it('persiste entre deux lectures et ignore un stockage corrompu', () => {
    cart.add(base, 2);
    expect(cart.items()).toHaveLength(1); // relit le localStorage
    localStorage.setItem('fika.market.cart.v1', '{not json');
    expect(cart.items()).toEqual([]);
    localStorage.setItem('fika.market.cart.v1', JSON.stringify([{ productId: 42 }]));
    expect(cart.items()).toEqual([]); // entrée invalide filtrée
  });
});
