import type { } from './types';

/**
 * Contenus de la vitrine. Le catalogue vit dans lib/catalog-data.ts.
 * Aucun contenu d'exemple : pas de témoignages ni réalisations fictifs.
 */

export const FAQS = [
  { q: 'Comment fonctionne une demande ?', a: 'Décrivez votre besoin et laissez votre téléphone. Fika vous recontacte pour préciser le problème, rechercher une solution et organiser la suite avec vous.' },
  { q: 'Comment le prix est-il fixé ?', a: 'Le montant dépend du besoin, du professionnel, du matériel et du déplacement éventuels. Le prix et les modalités de paiement sont convenus avec vous avant de commencer.' },
  { q: 'Dois-je payer avant de connaître le prix ?', a: 'Non. Rien n’est engagé avant votre accord sur le prix et le délai : vous décrivez, nous vérifions, vous décidez.' },
  { q: 'Comment puis-je payer ?', a: 'Les modalités sont convenues avec vous avant le début : espèces, MTN MoMo ou Orange Money selon le professionnel et le montant.' },
  { q: 'Où intervenez-vous ?', a: 'À Ngaoundéré et ses quartiers, pour l’instant. Indiquez votre quartier dans votre demande : nous confirmons immédiatement si la zone est couverte.' },
  { q: 'Qui réalise les prestations ?', a: 'Des professionnels indépendants, sélectionnés selon les informations disponibles et les contrôles réellement effectués. Fika reste votre interlocuteur pour la coordination et le suivi.' },
  { q: 'Et si le résultat ne me convient pas ?', a: 'Contactez-nous : nous faisons le lien avec le professionnel pour faire rectifier. Chaque retour nous sert aussi à mieux sélectionner.' },
  { q: 'Et si mon besoin n’est pas dans le catalogue ?', a: 'Décrivez-le quand même. Nous examinerons ce qui est possible, sans vous promettre une disponibilité ou un délai avant vérification.' },
];

/**
 * Promesse de réponse affichée près du CTA — à ne publier que si elle est
 * tenable. Source unique : modifiez-la ici, elle apparaît sur /services.
 */
export const SERVICES_RESPONSE_PROMISE = 'Réponse en moins de 2 h sur WhatsApp (8 h – 20 h)';
