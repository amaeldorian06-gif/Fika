# Fika — procédure opérationnelle
Document interne proposé ; horaires et délais doivent être approuvés.

## Règle de base
Une demande reçue n'est pas une commande confirmée. Une affectation n'est pas une acceptation. Un paiement déclaré n'est pas un paiement vérifié. Une livraison annoncée n'est pas une réception client.

## Parcours Services
1. Demande datée, identité/contact nécessaires, besoin, zone et pièces utiles.
2. Qualification du périmètre, du risque, des dépendances et de la capacité réelle.
3. Vérification du professionnel, de sa compétence, disponibilité, statut et éligibilité légale éventuelle.
4. Devis détaillé : livrable, limites, exclusions, prix et frais, taxes, échéance, jalons, moyens de paiement, conditions d'annulation.
5. Acceptation client durable (version du devis conservée).
6. Affectation et transmission de la mission au professionnel : périmètre, échéance, rémunération, preuves et modalités.
7. Acceptation explicite du prestataire avant confirmation au client.
8. Confirmation écrite au client du professionnel/du dispositif d'exécution, prix, délai et conditions.
9. Exécution avec jalons et remontée des difficultés.
10. Contrôle, réception/réserves, correction, paiement des sommes dues, clôture.

## Durées indicatives
| Classe | Délai | Conditions |
|---|---|---|
| A | 1–3 jours | Prioritaire si périmètre et disponibilité confirmés |
| B | 4–10 jours | Prestataire identifié, devis, échéance ; jalons selon risque |
| C | Plus de 10 jours | Étude de capacité, ressources, trésorerie, dépendances, jalons et preuves ; pas de commande immédiate sans validation |

La durée seule ne définit pas le risque. Travaux, électricité, plomberie, intervention à domicile, biens de valeur et métiers réglementés peuvent être à haut risque même en courte durée.

## Délais internes proposés
- Pas de réponse après 4 heures **ouvrées** : alerte.
- Pas de calendrier confirmé sous 24 heures : revue opérationnelle, relance ou réaffectation.
- Retard prévisible : alerte avant échéance.
- Délai contractuel modifié : accord client nécessaire.
- Abandon : enquête documentée, possibilité pour le prestataire de présenter ses observations, puis éventuelle suspension.

Ces seuils sont des objectifs internes. Le code ne sait pas encore calculer 4 heures ouvrées ; il faut paramétrer fuseau Africa/Douala, horaires, jours non ouvrés et jours fériés.

## Engagements de Fika
| Engagement | Responsable | Déclencheur/délai | Preuve | Contrôle |
|---|---|---|---|---|
| Exactitude catalogue | Responsable catalogue | Avant publication | Fiche et source prix | Retrait si donnée inexacte |
| Transparence prix/délai | Responsable commande | Avant acceptation | Devis conservé | Bloquer si incomplet |
| Contrôle professionnel | Opérations | Avant première mission | Appel, identité, compétences | Limiter affectations |
| Disponibilité et acceptation | Responsable commande | Avant confirmation | Réponse horodatée | Ne pas confirmer sans réponse |
| Responsable de suivi | Opérations | À la création | Responsable désigné | Escalade |
| Suivi des étapes | Prestataire + Fika | Selon ordre de mission | Preuves datées | Relance/incident |
| Information client | Responsable commande | Au jalon ou incident | Copie du message | Réclamation |
| Réclamation | Responsable qualité | Accusé 1 jour ouvré, plan 3 jours ouvrés (objectif) | Ticket et décision | Escalade direction |
| Paiement/remboursement | Finance | Selon contrat/loi | Référence et reçu | Revue finance |
| Données protégées | Responsable sécurité | Permanent | Logs, accès, registre | Révocation/incident |

## Charte de comportement prestataire
- Identification réelle et coordonnées à jour ; métiers/compétences/zones exacts.
- Disponibilités déclarées ; réponse explicite à chaque mission.
- Respect du prix, périmètre, délai et consignes de sécurité.
- Signalement anticipé des difficultés.
- Preuves d'avancement, livrables et justificatifs convenus.
- Aucun supplément direct sans accord écrit Fika et du client.
- Pas de sous-traitance non autorisée si interdite par le contrat et la loi.
- Confidentialité, respect du client et de ses biens.
- Correction des défauts imputables selon le bon de mission.
- Rémunération et paiement selon contrat et règles impératives.

## Règles clients
Le client fournit des informations exactes, permet l'accès convenu, nomme un interlocuteur, répond aux validations, règle les montants acceptés selon les modalités légales et sollicite un devis modificatif pour tout changement de périmètre.

## Incidents
Créer un dossier : commande, date, catégorie, faits vérifiés, hypothèses séparées, preuves, impact, client informé, observations du prestataire, options, accord, responsable, échéance, décision, mesure préventive. Ne pas transformer une allégation en faute établie sans examen.

## Statuts de confiance prestataire
- Nouveau : mission simple, périmètre limité.
- Actif : capacité et comportement éprouvés.
- Prioritaire : historique robuste ; missions pertinentes attribuées en priorité.
- Suspendu : pas de nouvelle mission pendant examen.
Les critères comprennent taux d'acceptation, achèvement, respect délais, annulation, réclamations fondées, réactivité et reprises. Une procédure contradictoire et des motifs traçables sont recommandés.

## État logiciel
Implémenté dans la branche : réponse affectation ACCEPTED/DECLINED consignée manuellement par Fika, canal et motif, historique, échéance affichée, alertes d'affectation en attente et échéance dépassée.
Pas encore implémenté : portail prestataire, calcul 4h/24h ouvrées, jalons structurés, preuves par jalon, alertes client de bout en bout, workflow de réclamation structuré, remboursement Services et suspension automatisée.
