import { describe, expect, it } from 'vitest';
import {
  canAssignExpert, canTransitionTask, checkReviewEligibility, computeExpertScore,
  publicDisplayName, quoteDelivery, rankExperts, selectPublishableTestimonials,
  toPublicTestimonial, type AssignableExpert, type ReviewRecord,
} from './proof';

const expert = (o: Partial<AssignableExpert>): AssignableExpert => ({
  id: 'e1', name: 'Jean-Marc', skills: ['Design graphique'], zone: 'Bamyanga',
  usualCost: 2000, availability: true, status: 'ACTIVE', activeTaskCount: 0, ...o,
});

describe('affectation des experts', () => {
  it('refuse un expert indisponible, en pause ou suspendu', () => {
    expect(canAssignExpert(expert({ availability: false })).ok).toBe(false);
    expect(canAssignExpert(expert({ availability: false })).reason).toContain('indisponible');
    expect(canAssignExpert(expert({ status: 'PAUSED' })).ok).toBe(false);
    expect(canAssignExpert(expert({ status: 'SUSPENDED' })).ok).toBe(false);
  });

  it('accepte un expert actif et disponible', () => {
    expect(canAssignExpert(expert({})).ok).toBe(true);
  });

  it('classe par compétence, zone puis charge', () => {
    const ranked = rankExperts(
      [
        expert({ id: 'busy', name: 'Chargé', activeTaskCount: 5 }),
        expert({ id: 'off', name: 'Indispo', availability: false }),
        expert({ id: 'match', name: 'Pertinent', skills: ['Réparation mobile'], zone: 'Wakwa' }),
      ],
      { skill: 'réparation', zone: 'Wakwa' },
    );
    expect(ranked[0].id).toBe('match');
    expect(ranked.at(-1)?.id).toBe('off'); // indisponible relégué
  });
});

describe('livraison', () => {
  it('le client ne paie jamais, le coût interne reste tracé', () => {
    const q = quoteDelivery(1500);
    expect(q.customerFee).toBe(0);
    expect(q.internalCost).toBe(1500);
    expect(q.label).toContain('gratuite dans toute la ville');
  });

  it('coût interne nul possible (livraison interne)', () => {
    expect(quoteDelivery(0).internalCost).toBe(0);
    expect(quoteDelivery(-50).internalCost).toBe(0);
  });
});

describe('éligibilité des avis', () => {
  const base = { orderExists: true, orderStatus: 'COMPLETED', hasExistingReview: false, serviceId: 's-1', rating: 5 };

  it('accepte une commande terminée sans avis', () => {
    expect(checkReviewEligibility(base).ok).toBe(true);
  });

  it('refuse une commande non terminée', () => {
    const res = checkReviewEligibility({ ...base, orderStatus: 'DELIVERED' });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('ORDER_NOT_COMPLETED');
  });

  it('refuse un second avis sur la même commande', () => {
    expect(checkReviewEligibility({ ...base, hasExistingReview: true }).code).toBe('REVIEW_EXISTS');
  });

  it('refuse une commande inexistante', () => {
    expect(checkReviewEligibility({ ...base, orderExists: false }).code).toBe('ORDER_NOT_FOUND');
  });

  it('refuse une note hors 1–5 ou non entière', () => {
    expect(checkReviewEligibility({ ...base, rating: 0 }).code).toBe('RATING_OUT_OF_RANGE');
    expect(checkReviewEligibility({ ...base, rating: 6 }).code).toBe('RATING_OUT_OF_RANGE');
    expect(checkReviewEligibility({ ...base, rating: 4.5 }).code).toBe('RATING_OUT_OF_RANGE');
  });
});

describe('anonymisation publique', () => {
  it('réduit au prénom + initiale', () => {
    expect(publicDisplayName('Aminata Toure')).toBe('Aminata T.');
    expect(publicDisplayName('Ousmane')).toBe('Ousmane');
    expect(publicDisplayName(null)).toBe('Client vérifié');
  });

  it('ne laisse jamais fuiter le nom complet', () => {
    const t = toPublicTestimonial({
      id: 'r1', rating: 5, comment: 'Parfait', verified: true,
      customerName: 'Sarah Bello', cityName: 'Ngaoundéré', serviceName: 'CV professionnel',
    });
    expect(t.name).toBe('Sarah B.');
    expect(JSON.stringify(t)).not.toContain('Bello');
  });

  it('ne publie que les avis vérifiés, notés ≥ 4 et commentés', () => {
    const reviews: ReviewRecord[] = [
      { id: '1', rating: 5, comment: 'Service impeccable et livraison rapide vraiment.', verified: true, customerName: 'A B', cityName: 'Ngaoundéré', serviceName: 'Flyer' },
      { id: '2', rating: 5, comment: 'Top', verified: true, customerName: 'C D', cityName: null, serviceName: null }, // trop court
      { id: '3', rating: 2, comment: 'Déçu par le délai malgré les relances répétées.', verified: true, customerName: 'E F', cityName: null, serviceName: null },
      { id: '4', rating: 5, comment: 'Excellent travail, je recommande vivement Fika.', verified: false, customerName: 'G H', cityName: null, serviceName: null },
    ];
    const published = selectPublishableTestimonials(reviews);
    expect(published).toHaveLength(1);
    expect(published[0].id).toBe('1');
  });
});

describe('score expert (calculé, jamais stocké)', () => {
  it('moyenne arrondie au dixième', () => {
    expect(computeExpertScore([5, 4, 5])).toEqual({ average: 4.7, count: 3 });
  });
  it('aucun avis → null', () => {
    expect(computeExpertScore([])).toEqual({ average: null, count: 0 });
  });
});

describe('transitions de tâche', () => {
  it('suit le cycle nominal', () => {
    const path = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionTask(path[i], path[i + 1]).ok).toBe(true);
    }
  });
  it('refuse les sauts et les états terminaux', () => {
    expect(canTransitionTask('PENDING', 'COMPLETED').ok).toBe(false);
    expect(canTransitionTask('COMPLETED', 'IN_PROGRESS').ok).toBe(false);
    expect(canTransitionTask('REVIEW', 'REVIEW').ok).toBe(false);
  });
});
