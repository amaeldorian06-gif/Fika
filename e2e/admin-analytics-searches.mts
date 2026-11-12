/**
 * E2E admin : tableau « Recherches sur la page services » (point 7 UX).
 * 1. Crée de vrais événements SERVICE_SEARCH via l'endpoint public.
 * 2. Ouvre /admin/analytics avec une session fondateur réelle (HMAC, jamais
 *    de mot de passe en clair) et vérifie l'affichage : requêtes, compteurs,
 *    badge « Sans résultat ».
 * 3. Nettoie les événements créés (fenêtre createdAt).
 *
 * Exécution : npx tsx e2e/admin-analytics-searches.mts
 */
import 'dotenv/config';
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { signSession, SESSION_COOKIE } from '../server/routes/auth';
import { FOUNDER_ID } from '../server/lib/founder';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`); }
};

const startedAt = new Date();
const token = signSession({ sub: FOUNDER_ID, role: 'SUPERADMIN', exp: Date.now() + 60 * 60 * 1000 });

const post = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

const browser = await chromium.launch();
try {
  // --- 1. Événements réels : requête avec résultats ×2, sans résultat ×1 ---
  ok((await post('/api/events/service-search', { query: 'plomberie', results: 3 })).status === 200, 'événement plomberie (3 résultats) accepté');
  ok((await post('/api/events/service-search', { query: 'plomberie', results: 3 })).status === 200, 'événement plomberie répété (agrégation attendue : 2)');
  ok((await post('/api/events/service-search', { query: 'e2exyzqq', results: 0 })).status === 200, 'événement sans résultat accepté');
  const short = await post('/api/events/service-search', { query: 'x', results: 0 });
  const shortPersisted = await prisma.event.count({ where: { type: 'SERVICE_SEARCH', createdAt: { gte: startedAt }, meta: { path: ['query'], equals: 'x' } } });
  ok(short.body.ok === false && shortPersisted === 0, 'requête trop courte rejetée, rien persisté', `ok=${short.body.ok} persistés=${shortPersisted}`);

  ok((await post('/api/events/funnel', { step: 'INQUIRY_STARTED', universe: 'market' })).status === 200, 'événement funnel accepté');
  ok((await post('/api/events/funnel', { step: 'VALIDATION_ERROR', field: 'phone' })).status === 200, 'événement erreur validation accepté (nom de champ uniquement)');
  const pii = await post('/api/events/funnel', { step: 'REQUEST_SUBMITTED', field: '06 90 12 34 56 avec contenu' });
  ok(pii.body.ok === false, 'rejet : champ/contenu personnel refusé', JSON.stringify(pii.body));

  // --- 2. Vue admin avec session réelle ---
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: SESSION_COOKIE, value: token, url: BASE, httpOnly: true, sameSite: 'Lax' }]);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/admin/analytics`, { waitUntil: 'load', timeout: 30000 });
  await p.waitForSelector('text=Recherches sur la page services', { timeout: 30000 });
  ok(true, 'bloc « Recherches sur la page services » présent dans Analytiques');

  // Bloc funnel parcours
  await p.waitForSelector('text=Parcours des visiteurs', { timeout: 10000 });
  const funnelBlock = p.locator('div.bg-brand-surface', { hasText: 'Parcours des visiteurs' }).first();
  const funnelText = (await funnelBlock.evaluate((el) => el.textContent)).replace(/\s+/g, ' ');
  ok(funnelText.includes('Formulaire produit commencé'), 'funnel : étape INQUIRY_STARTED listée');
  ok(funnelText.includes('Erreur de validation'), 'funnel : étape VALIDATION_ERROR listée');
  ok(!funnelText.includes('06 90'), 'funnel : aucune donnée personnelle affichée');

  const block = p.locator('div.bg-brand-surface', { hasText: 'Recherches sur la page services' }).first();
  const blockText = (await block.evaluate((el) => el.textContent)).replace(/\s+/g, ' ');
  ok(blockText.includes('plomberie'), 'requête « plomberie » listée');
  ok(/plomberie.*?2/.test(blockText), 'compteur 2 pour la requête répétée', blockText.slice(0, 200));
  ok(blockText.includes('Sans résultat'), 'badge « Sans résultat » pour les recherches vides');
  ok(blockText.includes('e2exyzqq'), 'requête sans résultat listée');
  ok(blockText.includes('3 résultat'), 'nombre de résultats de la dernière recherche affiché');

  await ctx.close();
} finally {
  await browser.close();
  const deleted = await prisma.event.deleteMany({ where: { type: { in: ['SERVICE_SEARCH', 'FUNNEL_STEP'] }, createdAt: { gte: startedAt } } });
  console.log(`  (nettoyage : ${deleted.count} événement(s) analytics supprimé(s))`);
  await prisma.$disconnect();
}
console.log(`\n===== ADMIN RECHERCHES SERVICES : ${pass}/${pass + fail} ${fail === 0 ? 'PASS' : 'FAIL'} =====`);
process.exit(fail === 0 ? 0 : 1);
