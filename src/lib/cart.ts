/**
 * Panier Fika Market — store client persistant (localStorage), indépendant de
 * React pour rester testable. Les prix stockés sont INDICATIFS : le prix final
 * est confirmé par devis avant tout paiement (modèle précommande).
 *
 * Limitations alignées sur l'API de commande : 10 références distinctes max,
 * 20 unités max par référence.
 */

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  reference: string;
  image: string | null;
  priceSale: number; // indicatif (FCFA)
  variantLabel: string | null; // snapshot « Couleur : Noir »
  quantity: number;
}

const STORAGE_KEY = 'fika.market.cart.v1';
const MAX_DISTINCT = 10;
const MAX_QUANTITY = 20;
const CART_EVENT = 'fika:cart';

/** Clé stable d'une ligne : produit + variante choisie. */
export function cartItemKey(item: Pick<CartItem, 'productId' | 'variantLabel'>): string {
  return `${item.productId}|${item.variantLabel ?? ''}`;
}

type Listener = () => void;

function readStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((i): i is CartItem =>
      typeof i?.productId === 'string' && typeof i?.name === 'string' && Number.isInteger(i?.quantity) && i.quantity > 0,
    ).slice(0, MAX_DISTINCT);
  } catch {
    return [];
  }
}

function writeStorage(items: CartItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // stockage indisponible (mode privé…) : le panier vit en mémoire pour la session
  }
  window.dispatchEvent(new Event(CART_EVENT));
}

export const cart = {
  /** Ajoute une référence (ou incrémente la quantité si déjà présente). */
  add(item: Omit<CartItem, 'quantity'>, quantity = 1): { ok: true } | { ok: false; reason: 'LIMIT_ITEMS' | 'LIMIT_QUANTITY' } {
    const items = readStorage();
    const key = cartItemKey(item);
    const existing = items.find((i) => cartItemKey(i) === key);
    if (!existing && items.length >= MAX_DISTINCT) return { ok: false, reason: 'LIMIT_ITEMS' };
    if (existing) {
      if (existing.quantity + quantity > MAX_QUANTITY) return { ok: false, reason: 'LIMIT_QUANTITY' };
      existing.quantity += quantity;
    } else {
      if (quantity > MAX_QUANTITY) return { ok: false, reason: 'LIMIT_QUANTITY' };
      items.push({ ...item, quantity });
    }
    writeStorage(items);
    return { ok: true };
  },

  setQuantity(key: string, quantity: number): void {
    const items = readStorage();
    const idx = items.findIndex((i) => cartItemKey(i) === key);
    if (idx === -1) return;
    if (quantity <= 0) { items.splice(idx, 1); }
    else { items[idx].quantity = Math.min(MAX_QUANTITY, quantity); }
    writeStorage(items);
  },

  remove(key: string): void {
    writeStorage(readStorage().filter((i) => cartItemKey(i) !== key));
  },

  clear(): void {
    writeStorage([]);
  },

  items(): CartItem[] {
    return readStorage();
  },

  count(): number {
    return readStorage().reduce((s, i) => s + i.quantity, 0);
  },

  /** Total indicatif — jamais présenté comme un prix final engageant. */
  totalIndicatif(): number {
    return readStorage().reduce((s, i) => s + i.priceSale * i.quantity, 0);
  },

  subscribe(listener: Listener): () => void {
    window.addEventListener(CART_EVENT, listener);
    window.addEventListener('storage', listener);
    return () => {
      window.removeEventListener(CART_EVENT, listener);
      window.removeEventListener('storage', listener);
    };
  },
};
