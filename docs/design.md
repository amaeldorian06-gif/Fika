# Fika — Guide du Design System (P10)

Référence d'usage des tokens, composants et règles visuelles. Objectif : un
langage « agence premium » cohérent, rapide et accessible — sans framework UI.

## 1. Tokens (Tailwind v4 · `src/index.css` · `@theme`)

### Couleurs

| Token | Valeur | Usage |
|---|---|---|
| `brand-bg` | `#FDFCFB` | fond général (crème chaude) |
| `brand-surface` | `#FFFFFF` | cartes, panneaux |
| `brand-border` / `brand-border-dark` | `#F0EBE6` / `#D4CDC6` | filets, bordures (hover) |
| `brand-text` | `#191817` | texte principal, surfaces sombres |
| `brand-text-muted` | `#6B6661` | texte secondaire (≥ 5,6:1 sur tous les fonds clairs) |
| `brand-accent` | `#B44A14` | accent terracotta (prix, eyebrow, focus) |
| `brand-wa` / `brand-wa-hover` | `#1B9A45` / `#168239` | actions WhatsApp uniquement |
| `brand-contrast-muted` / `brand-contrast-soft` | `#B9AEA1` / `#E9E2D8` | secondaire sur fond sombre |

Règle absolue : zéro classe couleur hors système (`neutral-*`, verts en dur)
sur les pages publiques — les palettes d'état (bleu/ambre/rouge) restent
cantonnées à l'admin (second plan).

### Typographie

- `font-heading` — Plus Jakarta Sans (titres, chiffres, UI dense) ;
- `font-sans` — Inter (texte courant) ;
- `font-serif` — Playfair Display **en italique uniquement** (restrains émotionnels :
  claim du hero, grandes citations, témoignages) — jamais en texte informatif ;
- `font-signature` — Caveat (wordmark « Fika. » uniquement).

### Rythme, matière, motion

- `py-section` → 6 rem, `py-section-sm` → 4 rem (via `--spacing-section(-sm)`) ;
- cartes : `rounded-card` = 1.5 rem ; sous-conteneurs : `rounded-2xl/xl` ;
- ombres : `shadow-premium` (repos) → `shadow-premium-hover` (survol) →
  `shadow-card-lift` (mise en avant PricingCard `featured`) ;
- easing de marque : `--ease-brand` = `cubic-bezier(0.16, 1, 0.3, 1)`
  (identique dans framer-motion ; utilitaire `.motion-brand` pour le CSS) ;
- les transitions hover incluent systématiquement un `active:scale-*` discret.

## 2. Composants d'armature (`src/components/ds.tsx`)

### `Container`

| Variante | Largeur | Usage |
|---|---|---|
| `default` | `max-w-7xl` | grille de contenu standard |
| `wide` | `max-w-[90rem]` | exceptions full-bleed |
| `medium` | `max-w-5xl` | compositions resserrées |
| `narrow` | `max-w-3xl` | FAQ, textes longs |

### `Section`

Bloc de niveau 2 autonome. Props :

- `eyebrow` — petit libellé de chapitre (accent, tracking `[0.2em]`, filets latéraux) ;
- `title` / `description` — animate-in au scroll (`whileInView`, easing de marque) ;
- `align: left | center` ;
- `tone: default | surface (blanc bordé) | dark (encre + halo accent décoratif)` ;
- `compact` — rythme réduit (`py-section-sm`).

Toutes les sections home passent par `Section` : un seul endroit pour le
rythme vertical et l'en-tête.

### `PricingCard({ service, featured?, idx? })`

Carte de prix contractuelle :
- prix **exclusivement via `displayPrice(service, getCityPricing(...))`** — jamais
  de montant formaté à la main ;
- 4 inclusions max (Check `brand-wa`), badge « Livraison gratuite à Ngaoundéré » ;
- CTA WhatsApp compilé par le moteur P04 + tracking `WACLICK` ;
- `featured` : liseré accent + `shadow-card-lift` + pastille « Le plus demandé ».

### `ServiceCard` (`src/components/ServiceCard.tsx`)

Carte catalogue : visuel `/fika/*.svg` (ratio fixe 16:9, lazy), pastilles
(populaire / livré), catégorie en eyebrow, prix via `lib/pricing`,
CTA `getServiceCTA(priceType)`.
Variante `compact` : sans description, pour grilles denses.

### Formulaire (`src/components/forms.tsx`, P05)

`Field` (label + `*` + hint + erreur `role="alert"`), `Input`, `Textarea`,
`Select` (chevron SVG inline), `Checkbox` — `forwardRef`, état `invalid`.

## 3. Règles transverses

- **Prix** : une seule source (`lib/pricing`) ; montants Int FCFA ; affichage « 12 500 F ».
- **Images** : assets locaux `/public/fika/*` uniquement ; jamais d'URL distante ;
  ratio fixe obligatoire (zéro CLS) ; dimensions explicites.
- **Focus** : `focus-visible` uniforme (anneau accent, offset 2 px — `index.css`).
- **Hit areas** : ≥ 44 px (barre sticky mobile, menu plein écran, CTA).
- **Motion** : entrées `y: 20 → 0` + `opacity`, ≤ 0.35 s, easing de marque ;
  `prefers-reduced-motion` neutralise tout (règle globale CSS).
- **JSON-LD & h1** : h1 unique par page, métadonnées via `lib/seo.ts` — rien
  dans les composants.

## 4. Finitions

- Sélection : `::selection` accent/blanc (`index.css`) ;
- Liens hover : transition `color` 150 ms ; boutons : `hover` + `active:scale-[0.97-0.98]` ;
- Barre sticky mobile des fiches (`ServicePage`) : prix + CTA `min-h-[44px]`,
  sous le header `z-50` (pagereserve espace `h-24`) ;
- Menu mobile plein écran : animé au scroll staggered (0.05 s/item), dialog modal.
