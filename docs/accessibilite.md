# Audit d'accessibilité — Fika (WCAG 2.2 AA)

Dernière révision : 8 janvier 2026. Statut global : **base AA solide**, résidus listés ci-dessous.
Référentiel visé : WCAG 2.2 niveau AA + critères d'usage mobile (aires tactiles, reflow).

## ✅ Conforme et vérifié dans le code

| Critère | Mesure en place |
|---|---|
| 1.1.1 Contenu non textuel | `alt` descriptif sur toutes les images (services, portfolio, lightbox) ; icônes décoratives `aria-hidden` |
| 1.3.1 Structure | Landmarks : `header`, `main#contenu`, `footer`, `nav` ; h1 unique par page ; 13 hiérarchies h2/h3 cohérentes |
| 1.4.3 Contraste | ≥ 5,6:1 mesurés : `brand-text` 15,8:1, `brand-text-muted` 5,66:1, `brand-accent` 5,57:1 sur fonds clairs |
| 2.1 Clavier | Tous les interactifs sont de vrais boutons/liens ; sortie du polysynthé `<button><a>` en P01 ; lightbox fermable à Échap |
| 2.4.1 Bypass de blocs | **Ajouté** : lien « Aller au contenu » visible au focus (`#contenu`, `tabIndex=-1`) |
| 2.4.7 Focus visible | Anneau `brand-accent` uniforme via `focus-visible` global (offset 2 px) |
| 3.2 Dialogue | Lightbox : `role="dialog"`, `aria-modal`, autofocus sur Fermer, scroll-lock restauré ; menu mobile idem |
| 3.3 Erreurs de saisie | Messages français bloquants, `role="alert"`, **`aria-describedby` ajouté** (hint + erreur liés au champ), `aria-invalid` |
| 3.3.2 Étiquettes | `label htmlFor` systématique (P05) |
| 2.5.5 Aire cible | ≥ 44 px : barre sticky fiche (`min-h-[44px]`), menu plein écran (52 px), boutons h-10 à h-14 |
| 2.3 Animation | `prefers-reduced-motion` neutralise animations, transitions et smooth-scroll (règle globale CSS) |
| 3.1 Langue | `lang="fr"` sur `<html>` ; contenu intégralement en français |
| 4.1 Nom/rôle/valeur | `aria-expanded`/`aria-controls` (menu mobile, filtres), `aria-selected` (pastilles témoignages), `role="tablist"` |

## ⚠️ Résiduel — à traiter avant/pendant le premier mois d'exploitation

| Priorité | Manque | Recommandation | État |
|---|---|---|---|
| Haute | **Piège de focus** incomplet dans la lightbox | Conserver le focus à l'intérieur (cycle Tab/Shift+Tab entre Fermer et l'image) et le rendre au déclencheur à la fermeture | Documenté (P-personnalisé) |
| Haute | **Retour de focus après ouverture/fermeture des menus** | Revenir sur le bouton déclencheur à la fermeture du menu mobile et de la lightbox | Documenté |
| Moyenne | Résumé des erreurs du formulaire /demande (ancre) | Au submit invalide, déplacer le focus sur un récapitulatif d'erreurs en haut du formulaire (`role="alert"` + lien vers le champ) | Documenté |
| Moyenne | Contraste de `brand-accent` **en texte 12-14 px** sur blanc | 4,36:1 mesuré — conforme AA texte large (3:1) mais sous le seuil 4,5:1 pour petit texte : garder `text-accent` réservé aux ≥ 18 px (déjà la pratique) et aux libellés en gras | Conforme par usage ; audit visuel de regression trimestriel |
| Moyenne | **Reflow 200-400 % / text-spacing** | Zoom : le layout répond bien (grid fluide, `max-w`) ; ajouter un test de `line-height`/`letter-spacing` max WCAG dans la checklist navigateur | À tester navigateur |
| Moyenne | Info véhiculée par la couleur seule | Écart de marge « ▲/▼ » : le texte apporte la donnée ; **ajouter** `sr-only` « au-dessus/en-dessous de la cible » | Documenté |
| Basse | Sauter au contenu **depuis n'importe où** dans l'admin | Le skip-link pointe `#contenu` (public) ; vérifier qu'il reste utile avec le layout double colonne admin | Admin = espace interne, seuil réduit |
| Basse | Feuille de styles d'impression | Fiche devis/portfolio (éviter l'affichage d'en-têtes/pieds superflus) | R&D |
| Basse | `prefers-contrast: more` | Renforcer filets `brand-border` (déjà ≥ 1 px) : gain marginal constaté en test manuel | R&D |

## Plan de vérification périodique
1. **Hebdo (CI idéalement)** : grep anti-régression (`neutral-*`, `<img` sans alt vide, lien sans texte).
2. **Mensuel** : pass clavier complet sur les 6 parcours (accueil, catalogue, fiche, demande, lightbox, menu mobile) + VoiceOver iOS / TalkBack Android sur un échantillon (3 pages).
3. **Trimestriel** : audit contraste sur les nouvelles teintes et re-vérification zoom 200-400 %.

## Engagement
Aucun négatif ne retire le contenu : toute information d'interface reste lisible à 100 % ‒ largeur 320 px, zoom 400 %, sans JavaScript avancé.
