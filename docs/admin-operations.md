# Fika — Activer et utiliser les opérations admin

Mise à jour : 9 septembre 2026, suite à l'audit initial.

**Hébergement retenu : Vercel + Supabase.** Voir [le guide dédié](vercel-supabase.md)
pour le build serverless, `DIRECT_URL` et les variables privées ; les commandes
`npm start` ci-dessous restent celles du serveur Node autonome.

## Ce qui est maintenant disponible

- **Experts** : création et modification depuis `/#/admin/experts`, y compris
  compétences, téléphone normalisé, zone, coût habituel, statut et disponibilité.
  Un expert en mission ne peut pas être remis disponible depuis sa fiche.
- **Demandes sans contact** : saisie du téléphone et du nom facultatif avant
  conversion ; la commande obtenue s'ouvre directement.
- **Paiements manuels** : saisie d'un reçu MTN Mobile Money, Orange Money ou
  espèces, puis vérification humaine séparée. Un reçu saisi n'est pas un
  encaissement confirmé et ne provoque aucun transfert d'argent.
- **Cohérence** : boutons WhatsApp dirigés vers le client sélectionné ; devis,
  paiements, statuts et affectations contrôlés côté serveur.

## 1. Préparer la base et le compte

**Accès : `https://VOTRE-DOMAINE/#/admin`**, ou « Espace équipe » dans le pied de page.
L'aperçu montre l'écran de connexion, mais aucun compte de secours n'a été créé.

Dans le gestionnaire de secrets de l'hébergeur (ou `.env` local non versionné),
renseigner `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL` et `ADMIN_PASSWORD_HASH`.
Définir aussi le numéro public `VITE_WA_PHONE` avant le build.
Ne pas partager ces secrets dans le chat. Ceux exposés dans l'historique doivent
être renouvelés chez leur fournisseur avant utilisation.

```bash
npm ci
npm run prisma:generate
# Sauvegarde et vérification du schéma avant la migration.
npm run prisma:deploy
# Première installation : ville/zones et compte, puis catalogue.
NODE_ENV=production npm run prisma:seed
npm run prisma:seed:catalog
# Compte déjà existant : renouveler explicitement son mot de passe si nécessaire.
NODE_ENV=production npm run admin:seed
npm run setup:check
npm run build
npm start
```

`setup:check` est **en lecture seule**, n'affiche aucun secret et vérifie la
configuration, l'accès aux nouvelles tables et l'existence d'un compte actif.
Une réussite ne remplace pas la recette métier.

### Nouvelle migration à appliquer

`20260909000000_admin_operations` ajoute :

- référence de reçu et clé d'idempotence uniques ;
- acteur de saisie, acteur/date de confirmation ;
- un compteur transactionnel de numéros de commandes/devis ;
- unicité de la commande issue d'une demande (`Order.leadId`).

Les anciens paiements restent conservés avec leurs nouveaux champs à `NULL`.
Si une ancienne demande a produit plusieurs commandes, l'index unique bloque
la migration : **réconcilier les doublons après sauvegarde**, sans supprimer
arbitrairement une commande ni modifier le SQL pour contourner l'invariant.
Les anciennes tables Drizzle ne sont toujours pas transférées automatiquement.

## 2. Parcours de travail

1. **Experts** → « Ajouter un expert » → renseigner sa fiche.
2. **Demandes** → compléter le téléphone si absent → « Convertir et ouvrir la
   commande ». Rejouer la même conversion retrouve la commande existante.
3. Dans la commande, **émettre un devis**. Le prix est enregistré et le statut
   devient « Devis envoyé ». Les devis sont verrouillés dès qu'un reçu est en
   attente ou confirmé, ainsi que sur les commandes avancées/fermées.
4. **Paiements et reçus** → montant entier FCFA, méthode et référence opérateur
   (ou numéro du reçu de caisse) → « Enregistrer le reçu ».
5. Contrôler effectivement les fonds dans le compte/caisse Fika, cocher
   l'attestation puis **« Confirmer la réception »**. Sinon, renseigner un motif
   et rejeter le reçu. Le rejet ne rembourse rien : il signale un reçu non validé.
6. Une fois le montant intégral confirmé, passer explicitement à **« Payée »**.
   Les acomptes sont possibles mais ne débloquent pas ce statut à eux seuls.
7. Affecter un expert puis suivre les tâches, le contrôle qualité et la livraison
   avec les étapes existantes du back-office.

Les montants confirmés, les reçus en attente et le solde sont affichés séparément.
Le total saisi ne peut pas dépasser le devis, reçus en attente inclus. Les actions
sur paiements sont tracées dans l'historique de commande avec l'administrateur.
Les rôles actifs actuels peuvent effectuer ces vérifications ; aucune séparation
« saisisseur/validateur différent » n'est imposée.

## 3. Protections et limites

- Les écritures critiques utilisent des transactions sérialisables avec réessais
  limités sur les conflits de sérialisation.
- Numérotation annuelle par compteur initialisé sur le **maximum existant**, pas
  sur le nombre de lignes. Suppressions/trous historiques ne recyclent pas les numéros.
- Référence de paiement unique par méthode et clé de requête unique ; même clé
  et même contenu renvoient le reçu existant. Une référence rejetée ne peut pas
  être recyclée pour masquer son historique.
- Une confirmation/rejet rejoué ne crée pas un deuxième événement.
- Les paiements confirmés ne sont ni modifiables ni supprimables via ces écrans.
  **Remboursements/corrections comptables : pas encore de parcours dédié.**
- Pas de connecteur opérateur, de webhook, de validation automatique d'un reçu ou
  de WhatsApp Business API. Les intégrer uniquement avec un prestataire choisi,
  ses credentials privés et une recette en environnement de test.
- Les autres sujets de l'audit restent ouverts : reprise des données Drizzle,
  rôles plus fins, révocation individuelle des sessions, optimisation/pagination,
  durcissement du proxy et du rate limiting, recette réelle de bout en bout.

## 4. Validation de cette livraison

- **160 tests automatisés réussis**, dont tests de validation, erreurs,
  idempotence, solde, numérotation et opérations avec un double Prisma.
- **TypeScript et build : OK** (avertissement de taille du bundle principal conservé).
- Toutes les migrations appliquées à une **base temporaire PGlite** (PostgreSQL
  embarqué) ; doublons lead/commande, référence et clé de reçu refusés par SQL.
  Cela ne valide pas une migration de la base hébergée ni la concurrence réelle.
- Tests Chromium : écran de connexion réel ; création/modification d'expert,
  conversion, reçu et confirmation **avec API simulée dans le navigateur de test**,
  ainsi qu'un contrôle mobile. Aucune erreur JavaScript sur ces parcours.
  Aucun mode démonstration ou contournement d'authentification n'a été ajouté au site.
- `setup:check` confirme les variables absentes ici : **pas de connexion à une base
  réelle, pas de migration/seed réel, pas de rotation distante ni de déploiement**.
  Le moteur natif Prisma reste indisponible dans le sandbox ; la génération sans
  moteur utilisée pour compiler/tester n'est pas la procédure de production.
