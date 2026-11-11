// E2E routage SEO (point 9 UX) — vrais chemins (History API).
// Couvre : chargement direct des pages (deep links), navigation SPA sans
// rechargement, bouton retour, compatibilité des anciennes URLs #/…,
// ancres héritées (#faq), titres de page par route.
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`); }
};

const browser = await chromium.launch();
try {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

  // --- 1. Chargement direct (deep link) : le serveur sert le SPA, la bonne page rend ---
  await p.goto(`${BASE}/services`, { waitUntil: 'load', timeout: 30000 });
  await p.waitForSelector('input[aria-label="Rechercher un service"]', { timeout: 20000 });
  ok(!p.url().includes('#/'), 'URL réelle /services (pas de hash de routage)', p.url());
  ok((await p.locator('h1').first().innerText()).includes('Fika s’occupe du reste'), 'page Services rendue en chargement direct');

  // --- 2. Deep link fiche service + titre SEO ---
  await p.goto(`${BASE}/service/intervention-plomberie`, { waitUntil: 'load' });
  await p.waitForSelector('h1', { timeout: 20000 });
  const title = await p.title();
  ok(/plomberie/i.test(title), 'titre de page spécifique à la fiche service (SEO)', title);
  const canonical = await p.evaluate(() => document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'));
  ok((canonical ?? '').includes('/service/intervention-plomberie') && !canonical.includes('#/'), 'canonical = chemin réel', canonical ?? 'absent');

  // --- 3. Navigation SPA : pas de rechargement (le marqueur JS survit) ---
  await p.goto(`${BASE}/`, { waitUntil: 'load' });
  await p.waitForSelector('h1', { timeout: 20000 });
  await p.evaluate(() => { window.__fikaSpaMarker = 42; });
  await p.getByRole('link', { name: 'Découvrir les services' }).click();
  await p.waitForSelector('input[aria-label="Rechercher un service"]', { timeout: 15000 });
  const marker = await p.evaluate(() => window.__fikaSpaMarker);
  ok(marker === 42, 'clic lien → navigation SPA sans rechargement');
  ok(p.url().endsWith('/services'), 'pushState : URL = /services', p.url());

  // --- 4. Bouton retour (popstate) ---
  await p.goBack();
  await p.waitForSelector('h1', { timeout: 15000 });
  ok(p.url().endsWith(BASE.endsWith('/') ? '/' : '/') || p.url().replace(BASE, '') === '/', 'retour navigateur → accueil', p.url());

  // --- 5. Compatibilité ancienne URL hash « /#/services » ---
  await p.goto(`${BASE}/#/services`, { waitUntil: 'load' });
  await p.waitForSelector('input[aria-label="Rechercher un service"]', { timeout: 20000 });
  ok(p.url().endsWith('/services'), 'ancienne URL /#/services → normalisée en /services', p.url());

  // --- 6. Compatibilité ancienne URL hash fiche + ancre ---
  await p.goto(`${BASE}/#/service/intervention-plomberie`, { waitUntil: 'load' });
  await p.waitForSelector('h1', { timeout: 20000 });
  ok(p.url().includes('/service/intervention-plomberie') && !p.url().includes('#/'), 'ancienne URL /#/service/x → normalisée', p.url());

  // --- 7. Ancre héritée « /#faq » → redirection vers /services#faq ---
  await p.goto(`${BASE}/#faq`, { waitUntil: 'load' });
  await p.waitForSelector('#faq', { timeout: 20000 });
  ok(p.url().includes('/services#faq'), 'ancre héritée /#faq → /services#faq', p.url());

  // --- 8. Ancre de section sur chemin réel ---
  await p.goto(`${BASE}/services#faq`, { waitUntil: 'load' });
  await p.waitForSelector('#faq', { timeout: 20000 });
  await p.waitForTimeout(900); // défilement fluide
  const faqVisible = await p.evaluate(() => {
    const el = document.getElementById('faq');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top > -10 && r.top < window.innerHeight * 0.9;
  });
  ok(faqVisible, '/services#faq → défilement jusqu’à la section');

  // --- 9. Query string préservée (pré-remplissage du formulaire) ---
  await p.goto(`${BASE}/demande?service=intervention-plomberie`, { waitUntil: 'load' });
  await p.waitForSelector('form', { timeout: 20000 });
  const preselected = await p.getByText('Votre point de départ').innerText().catch(() => '');
  ok(/plomberie/i.test(preselected), '/demande?service=… → service pré-sélectionné', preselected);
  ok(p.url().includes('/demande'), 'route /demande résolue malgré la query', p.url());

  // --- 10. 404 applicative sur chemin inconnu ---
  await p.goto(`${BASE}/nimporte-quoi`, { waitUntil: 'load' });
  await p.waitForSelector('h1', { timeout: 20000 });
  const t404 = await p.title();
  ok(/introuvable/i.test(t404), 'chemin inconnu → page 404 + titre dédié', t404);

  // --- 11. Le sitemap ne référence plus d'URLs en #/ ---
  const sitemap = await (await p.request.get(`${BASE}/sitemap.xml`)).text();
  ok(!sitemap.includes('/#/'), 'sitemap.xml : URLs réelles uniquement');

  await browser.close();
} finally {
  await browser.close();
}
console.log(`\n===== ROUTAGE SEO (VRAIS CHEMINS) : ${pass}/${pass + fail} ${fail === 0 ? 'PASS' : 'FAIL'} =====`);
process.exit(fail === 0 ? 0 : 1);
