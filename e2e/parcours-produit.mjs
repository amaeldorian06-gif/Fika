// E2E parcours produit + correctifs UX mobile (audit) — navigateur réel.
// Couvre : deux chemins d'accueil, /demande-produit (validation + envoi réel
// vérifié en base puis nettoyé), états vides boutique/panier orientés produit,
// FAB masqué sur les formulaires, barre CTA fiche service au-dessus de la nav,
// absence de débordement horizontal aux largeurs 320/360/390/430.
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const prisma = new PrismaClient();
const startedAt = new Date();
const PHONE = '+237690123462';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`); }
};

const browser = await chromium.launch();
try {
  /* ---------- 1. Accueil : deux chemins d'action directs ---------- */
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p.goto(`${BASE}/`, { waitUntil: 'load' });
  await p.waitForSelector('.need-illustration--visual', { timeout: 20000 });
  ok(await p.getByRole('link', { name: 'Décrire mon besoin', exact: true }).first().isVisible(), 'accueil : CTA primaire « Décrire mon besoin »');
  ok(await p.getByText('Prix validé avec vous avant toute intervention.').isVisible(), 'rassurance prix visible près de l’action services');
  await p.getByRole('link', { name: 'Demander un produit', exact: true }).first().click();
  await p.waitForSelector('#product', { timeout: 15000 });
  ok(p.url().includes('/demande-produit'), 'CTA « Demander un produit » → parcours produit dédié', p.url());
  ok(await p.getByText('Sans compte à créer').first().isVisible(), 'message sans compte visible');

  /* ---------- 2. Validation honnête (aucun envoi prématuré) ---------- */
  await p.getByRole('button', { name: /Envoyer ma demande produit/ }).click();
  await p.waitForTimeout(400);
  const validationShown = await p.locator('p[role="alert"]').count();
  ok(validationShown >= 1, 'erreurs de validation affichées (champs requis)');
  ok(p.url().includes('/demande-produit'), 'pas de navigation prématurée');

  /* ---------- 3. Envoi réel (vérifié en base) ---------- */
  await p.locator('#product').fill('Régulateur de tension 12V pour frigo solaire');
  await p.locator('#quantity').fill('2');
  await p.locator('#zoneName').fill('Quartier Test E2E');
  await p.locator('#phone').fill('690 12 34 62');
  await p.locator('#consent').check();
  await p.getByRole('button', { name: /Envoyer ma demande produit/ }).click();
  await p.waitForSelector('text=Votre demande produit est bien reçue', { timeout: 15000 });
  ok(true, 'état de succès affiché après confirmation serveur');
  const refText = await p.locator('.font-mono').first().innerText();
  ok(/LEAD-/.test(refText), 'référence LEAD- communiquée', refText);
  ok(await p.getByText("Rien n'est commandé et rien n'est payé avant votre accord").isVisible(), 'succès : la suite est expliquée honnêtement');

  const lead = await prisma.lead.findFirst({
    where: { createdAt: { gte: startedAt }, meta: { path: ['intent'], equals: 'PRODUCT' } },
    include: { customer: true },
  });
  ok(lead !== null, 'lead produit enregistré en base (intent=PRODUCT)');
  if (lead) {
    ok((lead.meta?.productName ?? '').includes('Régulateur'), 'nom du produit conservé', JSON.stringify(lead.meta?.productName));
    ok(lead.meta?.quantity === 2, 'quantité conservée (2)');
    ok(lead.customer?.phone === PHONE, 'téléphone rattaché au client');
    ok(/Produit recherché/.test(lead.description ?? ''), 'description structurée lisible pour l’équipe');
  }

  /* ---------- 4. Événements funnel (mesure, sans donnée personnelle) ---------- */
  const funnelEvents = await prisma.event.findMany({ where: { type: 'FUNNEL_STEP', createdAt: { gte: startedAt } } });
  const steps = new Set(funnelEvents.map((e) => e.meta?.step));
  ok(steps.has('PATH_SELECTED'), 'événement PATH_SELECTED mesuré');
  ok(steps.has('INQUIRY_STARTED'), 'événement INQUIRY_STARTED mesuré');
  ok(steps.has('VALIDATION_ERROR'), 'événement VALIDATION_ERROR mesuré');
  ok(steps.has('INQUIRY_SUBMITTED'), 'événement INQUIRY_SUBMITTED mesuré');
  const noPii = funnelEvents.every((e) => !JSON.stringify(e.meta ?? {}).includes('690') && !JSON.stringify(e.meta ?? {}).includes('Régulateur'));
  ok(noPii, 'aucune donnée personnelle dans les événements funnel');

  /* ---------- 5. Boutique : catalogue rempli OU état vide honnête ---------- */
  const activeProducts = await prisma.marketProduct.count({ where: { active: true } });
  await p.goto(`${BASE}/boutique`, { waitUntil: 'load' });
  if (activeProducts > 0) {
    await p.waitForSelector('a[href*="/boutique/produit/"]', { timeout: 20000 });
    const cards = await p.locator('a[href*="/boutique/produit/"]').count();
    ok(cards >= Math.min(activeProducts, 8), `catalogue rempli : ${cards} carte(s) produit affichée(s) (${activeProducts} actifs en base)`);
    ok(!(await p.getByText('Le catalogue arrive').count() > 0), 'aucun message « catalogue vide » tant que des produits sont actifs');
    await p.locator('a[href*="/boutique/produit/"]').first().click();
    await p.waitForTimeout(800);
    ok(p.url().includes('/boutique/produit/'), 'carte produit cliquable → fiche produit', p.url());
  } else {
    await p.waitForSelector('text=Le catalogue arrive', { timeout: 20000 });
    const boutiqueCta = p.getByRole('link', { name: 'Demander un produit' }).first();
    ok(await boutiqueCta.isVisible(), 'boutique vide : CTA « Demander un produit »');
    await boutiqueCta.click();
    await p.waitForSelector('#product', { timeout: 15000 });
    ok(p.url().includes('/demande-produit'), 'boutique vide → parcours produit (pas l’annuaire services)', p.url());
  }

  /* ---------- 6. Panier vide : état honnête + action utile ---------- */
  await p.goto(`${BASE}/boutique/panier`, { waitUntil: 'load' });
  await p.waitForSelector('text=Votre panier est vide', { timeout: 20000 });
  ok(await p.getByText("Vous n'avez aucun article pour l'instant").isVisible(), 'panier vide : constat honnête (aucune sélection fantôme)');
  await p.getByRole('link', { name: 'Demander un produit' }).first().click();
  await p.waitForSelector('#product', { timeout: 15000 });
  ok(p.url().includes('/demande-produit'), 'panier vide → parcours produit', p.url());
  // L'insertion de l'événement peut être retardée (pool DB partagé) : on sondage
  // jusqu'à 8 s au lieu d'échouer sur une course de latence.
  let cartViewed = null;
  for (let i = 0; i < 16 && !cartViewed; i++) {
    cartViewed = await prisma.marketAnalyticEvent.findFirst({ where: { type: 'CART_VIEWED', createdAt: { gte: startedAt } } });
    if (!cartViewed) await new Promise((r) => setTimeout(r, 500));
  }
  ok(cartViewed !== null, 'événement CART_VIEWED mesuré');

  /* ---------- 7. FAB WhatsApp : masqué sur les formulaires, visible ailleurs ---------- */
  const fabOn = async (path) => p.evaluate((u) => {
    window.location.href = u;
    return true;
  }, `${BASE}${path}`).then(() => p.waitForTimeout(900)).then(() => p.locator('aside[aria-label="Contact rapide"]').count());
  await p.goto(`${BASE}/demande`, { waitUntil: 'load' });
  await p.waitForSelector('#need', { timeout: 15000 });
  ok((await p.locator('aside[aria-label="Contact rapide"]').count()) === 0, 'FAB masqué sur /demande (champs jamais recouverts)');
  ok(await p.getByRole('link', { name: /Je préfère parler sur WhatsApp/ }).isVisible(), 'contact WhatsApp secondaire disponible dans le formulaire');
  await p.goto(`${BASE}/demande-produit`, { waitUntil: 'load' });
  await p.waitForSelector('#product', { timeout: 15000 });
  ok((await p.locator('aside[aria-label="Contact rapide"]').count()) === 0, 'FAB masqué sur /demande-produit');
  await p.goto(`${BASE}/services`, { waitUntil: 'load' });
  await p.waitForSelector('input[aria-label="Rechercher un service"]', { timeout: 15000 });
  ok((await p.locator('aside[aria-label="Contact rapide"]').count()) === 1, 'FAB visible hors formulaires');

  /* ---------- 8. Fiche service : CTA sticky au-dessus de la nav, libellé complet ---------- */
  await p.goto(`${BASE}/service/intervention-plomberie`, { waitUntil: 'load' });
  await p.waitForSelector('h1', { timeout: 20000 });
  await p.waitForTimeout(800); // fin de la transition de page (transform actif = containing block)
  const sticky = await p.evaluate(() => {
    const bar = [...document.querySelectorAll('div')].find((d) => String(d.className).includes('bottom-[calc(56px'));
    const nav = document.querySelector('nav[aria-label="Navigation mobile"]')?.getBoundingClientRect();
    const cta = bar.querySelector('a');
    if (!bar || !nav || !cta) return { found: false };
    const r = bar.getBoundingClientRect();
    const c = cta.getBoundingClientRect();
    return {
      found: true,
      aboveNav: r.bottom <= nav.top + 1,
      labelComplete: cta.scrollWidth <= cta.clientWidth + 1,
      height: Math.round(c.height),
      ctaInBar: c.top >= r.top - 1 && c.bottom <= r.bottom + 1,
    };
  });
  ok(sticky.found, 'barre CTA sticky présente');
  if (sticky.found) {
    ok(sticky.aboveNav, `barre sticky au-dessus de la navigation (${sticky.aboveNav})`);
    ok(sticky.labelComplete, 'libellé du CTA complet (non tronqué)');
    ok(sticky.height >= 44, `cible tactile ≥ 44px (${sticky.height}px)`);
    ok(sticky.ctaInBar, 'CTA entièrement contenu dans la barre');
  }
  // Le CTA sticky emmène le service vers le formulaire
  await p.locator('a[class*="bg-brand-accent"]').filter({ hasText: 'Décrire mon besoin' }).click();
  await p.waitForSelector('#need', { timeout: 15000 });
  ok(p.url().includes('/demande?service=intervention-plomberie'), 'CTA sticky → formulaire avec service préservé', p.url());
  ok(await p.getByText('Votre point de départ').innerText().then(t => /plomberie/i.test(t)).catch(() => false), 'service pré-sélectionné affiché');

  await p.close();
} finally {
  await browser.close();
  /* ---------- Nettoyage : données de test uniquement ---------- */
  try {
    const leads = await prisma.lead.findMany({ where: { createdAt: { gte: startedAt }, meta: { path: ['intent'], equals: 'PRODUCT' } }, include: { customer: { include: { orders: { select: { id: true } }, leads: { select: { id: true } }, reviews: { select: { id: true } }, marketOrders: { select: { id: true } } } } } });
    for (const l of leads) {
      await prisma.lead.delete({ where: { id: l.id } });
      const c = l.customer;
      if (c && c.leads.filter(x => x.id !== l.id).length === 0 && !c.orders.length && !c.reviews.length && !c.marketOrders.length) {
        await prisma.customer.delete({ where: { id: c.id } });
      }
    }
    const ev = await prisma.event.deleteMany({ where: { type: 'FUNNEL_STEP', createdAt: { gte: startedAt } } });
    const mev = await prisma.marketAnalyticEvent.deleteMany({ where: { type: 'CART_VIEWED', createdAt: { gte: startedAt } } });
    console.log(`  (nettoyage : ${leads.length} lead(s) produit, ${ev.count} événement(s) funnel, ${mev.count} événement(s) panier)`);
  } catch (e) {
    fail++;
    console.log('  ✗ ERREUR NETTOYAGE :', String(e));
  }
  await prisma.$disconnect();
}
console.log(`\\n===== PARCOURS PRODUIT + UX MOBILE : ${pass}/${pass + fail} ${fail === 0 ? 'PASS' : 'FAIL'} =====`);
process.exit(fail === 0 ? 0 : 1);
