// E2E des améliorations UX de /services (points 1-8) — navigateur réel.
// Couvre : recherche dans le héros, chips de suggestions, compteurs par
// univers, promesse de réponse, FAQ étendue, témoignages masqués sans
// données réelles, cartes services sans photos dupliquées (icônes de marque),
// tracker SERVICE_SEARCH (vérifié en base, puis nettoyé).
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`); }
};

const startedAt = new Date();
const browser = await chromium.launch();
try {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p.goto(`${BASE}/services`, { waitUntil: 'load', timeout: 30000 });
  await p.waitForSelector('input[aria-label="Rechercher un service"]', { timeout: 20000 });

  // --- Point 1 : recherche dans le héros ---
  const heroInput = p.locator('input[aria-label="Rechercher un service"]');
  ok(await heroInput.isVisible(), 'recherche visible dès le héros (sans scroll)');
  const heroBox = await heroInput.boundingBox();
  ok(heroBox && heroBox.y < 700, 'champ de recherche dans la zone héros (y < 700px)', heroBox ? `y=${Math.round(heroBox.y)}` : 'absent');

  // --- Point 2 : chips de suggestions ---
  const chips = p.locator('[aria-label="Suggestions de recherche"] button');
  ok((await chips.count()) === 5, '5 suggestions en un tap', `${await chips.count()}`);
  await chips.filter({ hasText: 'plomberie' }).click();
  await p.waitForTimeout(300);
  const chipResults = await p.locator('a[href^="/service/"]').count();
  ok(chipResults >= 1, 'clic chip « plomberie » → résultats affichés', `${chipResults}`);
  const inputValue = await heroInput.inputValue();
  ok(inputValue === 'plomberie', 'chip remplit le champ', inputValue);

  // Compteur de résultats (role=status)
  const counter = await p.locator('[role="status"]').first().innerText();
  ok(/services? trouvés?/.test(counter), 'compteur de résultats annoncé (role=status)', counter);

  // --- Point 8 : cartes uniformes, en-tête de marque (icône), pas de photos ---
  const cardAudit = await p.locator('a[href^="/service/"]').first().evaluate((el) => ({
    imgs: el.querySelectorAll('img').length,
    svg: el.querySelectorAll('svg').length,
  }));
  ok(cardAudit.imgs === 0, 'carte service sans photo (en-tête icône de marque)', `${cardAudit.imgs} img`);
  ok(cardAudit.svg >= 1, 'icône présente dans la carte', `${cardAudit.svg} svg`);

  // Bouton X d'effacement
  await p.locator('button[aria-label="Effacer la recherche"]').click();
  await p.waitForTimeout(250);
  ok((await p.locator('[aria-label="Résultats de recherche"]').count()) === 0, 'effacement → section résultats retirée');

  // --- Point 3 : compteurs par univers ---
  const universeCards = p.locator('a[href^="/univers/"]');
  const nUniverses = await universeCards.count();
  ok(nUniverses >= 4, 'cartes univers présentes', `${nUniverses}`);
  let countersOk = true, firstCard = null;
  for (let i = 0; i < nUniverses; i++) {
    const txt = (await universeCards.nth(i).innerText()).replace(/\s+/g, ' ');
    if (!/\d+ services?/i.test(txt)) countersOk = false;
  }
  ok(countersOk, 'chaque univers affiche son nombre de services');
  // Cohérence réelle : le compteur de la 1re carte = nombre de services listés sur la page univers
  const firstTxt = (await universeCards.first().innerText()).replace(/\s+/g, ' ');
  const firstCount = Number((firstTxt.match(/(\d+) services?/i) ?? [0, 0])[1]);
  const firstHref = await universeCards.first().getAttribute('href');
  await universeCards.first().click();
  await p.waitForSelector('a[href^="/service/"]', { timeout: 10000 });
  const listedCount = (await p.locator('a[href^="/service/"]').evaluateAll((els) => new Set(els.map((e) => e.getAttribute('href'))).size));
  ok(listedCount === firstCount, `compteur cohérent (${firstCount} annoncés = ${listedCount} listés)`, firstHref ?? '');
  await p.goto(`${BASE}/services`, { waitUntil: 'load' });
  await p.waitForSelector('input[aria-label="Rechercher un service"]', { timeout: 10000 });

  // --- Point 5 : promesse de réponse tenable ---
  ok(await p.getByText('Réponse en moins de 2 h sur WhatsApp (8 h – 20 h)').isVisible(), 'promesse de réponse affichée sous le lien WhatsApp');

  // --- Point 6 : FAQ étendue ---
  await p.locator('#faq').scrollIntoViewIfNeeded();
  const faqCount = await p.locator('#faq details').count();
  ok(faqCount === 8, 'FAQ : 8 questions (dont paiement/après-prix)', `${faqCount}`);
  const faqText = (await p.locator('#faq').evaluate((el) => el.textContent)).replace(/\s+/g, ' ');
  ok(faqText.includes('Dois-je payer avant de connaître le prix ?'), 'FAQ : payer avant de connaître le prix — répondue');
  ok(faqText.includes('MTN MoMo ou Orange Money'), 'FAQ : moyens de paiement locaux (MoMo / OM)');

  // --- Point 4 : témoignages réels uniquement ---
  const reviewCount = await prisma.review.count();
  const temoignages = await p.locator('#temoignages').count();
  if (reviewCount === 0) {
    ok(temoignages === 0, 'aucun avis en base → section témoignages masquée (pas de faux avis)');
  } else {
    ok(temoignages === 1, 'avis présents en base → section témoignages affichée', `${reviewCount} avis`);
  }

  // --- Point 7 : tracker des recherches (bout-en-bout) ---
  await heroInput.fill('e2exyz');
  await p.waitForTimeout(1800); // debounce 1,2 s + marge
  const tracked = await prisma.event.findFirst({
    where: { type: 'SERVICE_SEARCH', createdAt: { gte: startedAt }, meta: { path: ['query'], equals: 'e2exyz' } },
  });
  ok(tracked !== null, 'recherche tracée en base (Event SERVICE_SEARCH, requête + résultats)');
  if (tracked) {
    const results = tracked.meta?.results;
    ok(results === 0, 'événement porte le nombre de résultats (0 ici)', JSON.stringify(tracked.meta));
  }

  await browser.close();
} finally {
  await browser.close();
  // Nettoyage : événements de recherche créés pendant le test uniquement.
  const deleted = await prisma.event.deleteMany({ where: { type: 'SERVICE_SEARCH', createdAt: { gte: startedAt } } });
  console.log(`  (nettoyage : ${deleted.count} événement(s) SERVICE_SEARCH supprimé(s))`);
  await prisma.$disconnect();
}
console.log(`\n===== UX /services : ${pass}/${pass + fail} ${fail === 0 ? 'PASS' : 'FAIL'} =====`);
process.exit(fail === 0 ? 0 : 1);
