# Fika — audit initial
Date : 22 novembre 2026  
Dépôt : `amaeldorian06-gif/Fika` · branche initiale `main` · commit audité `38b755f89dab58869d47b2f234902b368270883c`.

## Architecture réelle
Application React 19 / Vite 7 / TypeScript, API Express 5, Prisma 5, PostgreSQL Supabase, Supabase Storage et Vercel. Il ne s'agit pas de Next.js. La documentation `docs/architecture-donnees.md` décrit 44 tables, les domaines clients, demandes, commandes Services, prestataires, tâches, paiements, coûts, livraisons et Market, avec le territoire initial Ngaoundéré.

## Fonctions déjà présentes
- Services : demandes, qualification, devis, commandes, paiements manuels, affectations, tâches, coûts, livraison, avis et événements.
- Prestataires : profils, compétences, zones, disponibilité, statuts, vérifications progressives et métriques de confiance calculées depuis les missions.
- Market : demande de commande, vérification fournisseur, devis, réponse client, paiement manuel, approvisionnement, dépenses, livraison, remboursements et registre financier.
- Administration : commandes, prestataires, clients, finances, exportations et alertes calculées depuis la base.
- Notification : Nodemailer / Gmail, état de configuration et email de test.

## Écarts
1. Pas de portail prestataire autonome. L'affectation et la progression sont pilotées par l'administration.
2. Les statuts ACCEPTED/DECLINED existaient en base, mais l'administration ne disposait pas d'un mécanisme dédié pour enregistrer la réponse.
3. Les jalons ne sont pas des objets structurés ; la progression s'appuie surtout sur statuts et événements.
4. Les alertes de 4 heures ouvrées et de 24 heures n'étaient pas implémentées.
5. Aucun workflow de remboursement Services n'a été confirmé dans l'audit.
6. Le code interne Market existe, mais l'existence d'une page publique de suivi n'a pas été confirmée. README et architecture se contredisent.
7. Une erreur SMTP EAUTH avait été relevée le 21 novembre ; l'affichage du statut ne prouve pas la délivrabilité.
8. Les paramètres réels des comptes, la base de production, les contrats et le statut fiscal de l'entité n'ont pas été audités.

## Production et tests
Production observée : domaine `https://fika00.vercel.app`, dernier déploiement connu READY sur le commit `38b755f`. CI présente avec workflow `quality.yml` : typecheck, tests et build. L'environnement Sandbox Vercel a renvoyé une erreur 400 lors de sa création ; l'exécution locale du dépôt n'a donc pas été disponible. Les contrôles de la première tranche ont été effectués par GitHub Actions et build Preview.

## Modèle commercial réel aperçu dans le code
Le panneau Exécution précise que le professionnel travaille pour Fika et que le client ne traite pas directement avec lui. Fika reçoit la commande, construit le devis, gère l'encaissement, affecte le professionnel et suit la tâche. Les Services se rapprochent donc d'un modèle de prestataire principal ; ce constat opérationnel ne remplace pas une qualification juridique formelle.

## Risques prioritaires
- Sous-traitance et éligibilité des intervenants à vérifier sous la loi n°2025/010.
- Trésorerie nécessaire pour les avances, paiements fournisseurs, remboursements.
- Loi données personnelles 2024/017, notamment autorisations et transferts internationaux.
- Retard, abandon et responsabilité contractuelle envers le client.
- Paiement déclaré, distinct du paiement réellement rapproché.
- Délivrabilité SMTP non démontrée.
