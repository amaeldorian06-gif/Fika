# Décisions d'architecture — Fika 2.0

> Phase 2. Chaque décision cite la règle du cahier des charges qu'elle satisfait. Toute objection du fondateur peut inverser une décision avant la phase suivante.

## D1 — Conserver la stack existante (Vite/React + Express + Prisma + Supabase PostgreSQL)

Le cahier des charges liste Next.js/Supabase Auth comme pile *indicative* mais impose : « Prioritize the technologies already used in the project », « final decisions must be based on the audit », « Do not impose a new structure simply for reorganizing ». L'audit montre un monolithe modulaire sain, 219 tests verts, en production vérifiée, avec session admin codée (exigence fondateur : login indépendant de la base). Migrer vers Next.js/Supabase Auth serait une réécriture sans bénéfice client, casserait l'exigence « Fika Services continue de fonctionner » et contredirait la consigne permanente « construire sur l'existant ». **Décision : on étend le module Market existant.** (Règles 1, 2, 5.)

## D2 — Frontières métier Services/Market

Partagé (capacités, pas de processus) : annuaire `Customer` (une personne = un téléphone = une fiche — utilisé par les deux domaines pour la connaissance client), `DocumentCounter`, session admin, design system, exports. Strictement séparés : commandes, devis, paiements, approvisionnements, remboursements, statuts, marges. Une commande Market ne touche jamais `Order`/`Quote` de Services. (§3.1.)

## D3 — Variantes en colonne Json sur le produit (pas de table)

Pas de prix ni de stock par variante en MVP ; les conventions du projet mettent déjà `specs`/`images` en Json. Une table `market_product_variants` n'apporterait rien d'utilisable maintenant (Règle 5 — éviter la sur-ingénierie) tout en complexifiant l'admin. La commande snapshot le choix (`variantLabel`) → l'intégrité historique est garantie. Migration vers une table = post-MVP si prix par variante.

## D4 — Items de devis en snapshot Json immuable

Un devis est par définition un document figé (§8.2 « Prices must be locked »). Le JSON est sémantiquement juste pour un snapshot : impossible à altérer par changement du catalogue, lisible tel quel dans 10 ans. Les métadonnées de cycle de vie (statut, dates) restent des colonnes relationnelles.

## D5 — Réponse au devis enregistrée par l'admin (pas de lien public d'acceptation)

Le client répond via WhatsApp/téléphone — cohérent avec le modèle de paiement manuel et la réalité locale. Un lien public d'acceptation ajouterait une surface d'attaque (deviner/forger des tokens) pour un gain faible. Le suivi public montre l'état (« devis envoyé — en attente de votre réponse »). Reconductible en V2 si besoin. (Règle 7 — hypothèse documentée.)

## D6 — Cycle de vie du paiement DÉRIVÉ, pas stocké

Le cahier des charges exige un cycle de vie paiement distinct (§8.3) — pas forcément une colonne. Dériver depuis les paiements + remboursements garantit la cohérence (impossible d'avoir « paid » sans paiements vérifiés) et élimine un champ désynchronisable. (Règle 3 — jamais simuler.)

## D7 — `market_shipments` différé ; le lot porte le suivi international

Le lot (batch) couvre le parcours Chine→Ngaoundéré avec ses 9 statuts (dont dédouanement, contrôle). Des entités shipment séparées n'apportent de la valeur qu'avec plusieurs colis par lot ou du tracking transporteur — post-MVP. (§16 : ne pas développer avant validation du workflow.)

## D8 — Allocations calculées à la lecture, application explicite

Les dépenses du lot sont stockées avec leur méthode d'allocation ; les quote-parts sont recalculées à la lecture (source de vérité unique, pas de snapshot d'allocation à désynchroniser). L'écriture dans `unitCostReal` (coût rendu réel) reste une action explicite de l'admin (« appliquer l'allocation ») — auditable dans le journal. (Règle 3.)

## D9 — RLS Supabase non activée

Aucun client n'accède directement à Supabase : tout passe par l'API Express (service connection, clé jamais au front). La RLS protège contre un accès direct anon/key — configuration inexistante ici. À réévaluer si un accès client direct à Supabase est introduit un jour. (§12 — l'intention « empêcher le public de lire les coûts » est garantie par les projections serveur, testées.)

## D10 — SEO : métadonnées client + sitemap racine, SSR différé

Routeur par hash : les métadonnées par produit (title, description, OG, JSON-LD) sont injectées côté client à la navigation — c'est déjà le mécanisme du site (`applyRouteMeta`). Sitemap/robots couvrent les routes publiques. L'indexation profonde des fiches produit nécessiterait du SSR (refonte de routage) → documenté post-MVP. (Règle 9 — limitation signalée.)

## D11 — Zéro donnée fictive

Consigne fondatrice + Règle 4 : catalogue vide = état vide honnête ; aucune statistique, review, stock, urgence ou remise inventés. Les données de test e2e sont créées puis supprimées (base vérifiée propre après chaque passe). La démo visuelle se fait avec de vrais produits saisis par le fondateur.

## D12 — Typographie : Playfair Display pour l'éditorial Market

Le serif est déjà chargé dans le projet (`--font-serif`, inutilisé). Titres/nom de produits Market en serif éditorial, corps en Inter, signature Caveat conservée — conformément à la direction artistique §2 sans nouvelle dépendance. Les pages Services conservent leur hiérarchie actuelle (identité préservée).

## D13 — Statuts : extension additive, mapping documenté

Les 16 statuts couvrent le cycle §8.3 sans renommer les valeurs V1 (base = production, Règle 8) ; la correspondance cahier des charges ↔ internes est dans `data-model.md`. `AWAITING_PAYMENT` sépare « devis accepté » de « paiement vérifié » comme exigé.

## D14 — Numérotation : `MQT-AAAA-NNNN` pour les devis Market

Nouveau préfixe ; `nextDocumentNumber` corrigé au passage (mapping préfixe → table source pour l'initialisation — l'audit a montré qu'il comptait les devis Services pour tout préfixe ≠ CMD, faux pour MQT). Compteurs partagés par année, déjà en production pour CMD/DEV/MKT/APR.

## D15 — Accueil : ajout additif seulement

La section Market de la home (double entrée + sélection éditoriale) s'ajoute sans retirer les sections Services existantes ; l'entrée « Boutique » reste dans header/footer. Régression Services à rejouer en e2e. (Règle 2.)

## D16 — Analytics : funnel déclaratif limité + métier dérivé

Seuls les événements pré-commande sont déclarés par le client (vues, panier, checkout) — les indicateurs commerciaux (devis acceptés, paiements vérifiés, marges) sont dérivés des tables réelles. Jamais de mélange trafic/performance. (§15.)

## D17 — Ne pas pousser V1 seule en production

V1 (commit `baa3063`) est vérifiée mais le programme 2.0 retravaille ses statuts et son workflow. Recommandation : attendre le jalon 2.0 complet pour le push GitHub/Vercel — ou pousser V1 maintenant si le fondateur veut la boutique en ligne plus tôt (elle est autonome et sûre). Décision fondateur.
