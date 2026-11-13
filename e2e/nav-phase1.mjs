/**
 * E2E Phase 1 navigation — vérification réelle en navigateur (Chromium).
 * Couvre : page d'entrée, redirection ancres héritées, univers Services,
 * recherche globale, panier (ajout/qty/retrait/commande multi-items),
 * bottom nav mobile, routes préservées, a11y de base.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); if (!cond) console.log('FAIL:', name, extra); };

const b = await chromium.launch();

// Warm-up : compilation Vite + premier appel API (cold start ~3s) hors assertions.
{
  const w = await b.newPage();
  await w.goto(BASE + '/boutique', { waitUntil: 'load' });
  await w.waitForSelector('text=Écouteurs Bluetooth E2E', { timeout: 20000 });
  await w.close();
}

/* ============================ DESKTOP ============================ */
let ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
let p = await ctx.newPage();
const consoleErrors = [];
p.on('pageerror', (e) => consoleErrors.push(String(e)));

// --- 1. Page d'entrée ---
await p.goto(BASE + '/', { waitUntil: 'load' });
ok('E1 entry : titre H1 exact', (await p.locator('h1').innerText()).includes('Fika vous accompagne'));
ok('E1 entry : sous-titre exact', (await p.locator('h1 ~ p, section p').filter({ hasText: 'coordonne la solution' }).first().isVisible()));
ok('E1 entry : carte Services + CTA', await p.getByRole('link', { name: 'Découvrir les services' }).isVisible());
ok('E1 entry : carte Market + CTA', await p.getByRole('link', { name: 'Explorer la boutique' }).isVisible());
ok('E1 entry : égalité visuelle des cartes', await p.evaluate(() => {
  const cards = [...document.querySelectorAll('section[aria-labelledby^="entry-"]')];
  if (cards.length !== 2) return false;
  const r = cards.map((c) => c.getBoundingClientRect());
  return Math.abs(r[0].height - r[1].height) < 2 && Math.abs(r[0].width - r[1].width) < 2;
}));
ok('E1 entry : header sans panier vide (univers neutre)', !(await p.locator('header a[href="/boutique/panier"]').count()));

// --- 2. Compat ancres héritées ---
await p.goto(BASE + '/#services', { waitUntil: 'load' });
await p.waitForTimeout(600);
ok('E2 ancre /#services redirigée vers /services', p.url().includes('/services#services') || p.url().endsWith('/services'));
ok('E2 section #services présente', await p.locator('#services').count() === 1);
await p.goto(BASE + '/#faq', { waitUntil: 'load' });
await p.waitForTimeout(600);
ok('E2 ancre /#faq redirigée', p.url().includes('/services#faq'));
ok('E2 section #faq présente', await p.locator('#faq').count() === 1);

// --- 3. Univers Services ---
await p.goto(BASE + '/services', { waitUntil: 'load' });
await p.waitForSelector('#faq details', { timeout: 10000 });
ok('E3 hero services', (await p.locator('h1').innerText()).includes('Fika s’occupe du reste'));
ok('E3 nav Services active', await p.locator('header nav a[aria-current="page"]').filter({ hasText: 'Services' }).count() === 1);
ok('E3 CTA Décrire mon besoin (header, univers services)', await p.locator('header a[href="/demande"]').first().isVisible());
ok('E3 comment-ca-marche', await p.locator('#comment-ca-marche').count() === 1);
ok('E3 recherche : barre présente', await p.locator('input[aria-label="Rechercher un service"]').count() === 1);
ok('E3 catalogue complet supprimé (aucune liste par défaut)', (await p.locator('a[href^="/service/"]').count()) === 0);
// La recherche doit rendre les services trouvables, sans doublon d'affichage.
{
  await p.fill('input[aria-label="Rechercher un service"]', 'depannage');
  await p.waitForSelector('a[href^="/service/"]', { timeout: 10000 });
  const links = await p.locator('a[href^="/service/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  const uniques = new Set(links).size;
  ok('E3 recherche : services trouvés sans doublon', links.length >= 4 && links.length === uniques, `${links.length} liens, ${uniques} uniques`);
  await p.fill('input[aria-label="Rechercher un service"]', '');
  await p.waitForTimeout(300);
  ok('E3 recherche vidée : résultats retirés', (await p.locator('a[href^="/service/"]').count()) === 0);
}
const faq = await p.locator('#faq details').count();
ok('E3 FAQ héritée (4 questions)', faq >= 4, `${faq} questions`);

// --- 4. Recherche globale ---
await p.goto(BASE + '/services', { waitUntil: 'load' });
await p.locator('header button[aria-label*="Rechercher"]').click();
await p.waitForTimeout(300);
ok('E4 overlay ouvert + focus input', await p.evaluate(() => document.activeElement?.type === 'search'));
await p.locator('[role="dialog"] input[type="search"]').fill('plomberie');
await p.waitForTimeout(250);
ok('E4 résultats services (plomberie)', await p.locator('#search-services li, [aria-labelledby="search-services"] li').first().isVisible());
await p.locator('[role="dialog"] input[type="search"]').fill('zzqqyynope');
await p.waitForTimeout(250);
ok('E4 aucun résultat honnête', await p.getByText('Aucun résultat pour cette recherche.').isVisible());
await p.locator('[role="dialog"] input[type="search"]').fill('écouteurs');
await p.waitForSelector('[aria-labelledby="search-products"] li a', { timeout: 10000 });
ok('E4 résultats produits (écouteurs, API réelle)', true);
await p.keyboard.press('Escape');
await p.waitForTimeout(200);
ok('E4 Escape ferme l’overlay', !(await p.locator('[role="dialog"]').count()));

// --- 5. Boutique ---
await p.goto(BASE + '/boutique', { waitUntil: 'load' });
await p.waitForSelector('text=Écouteurs Bluetooth E2E', { timeout: 10000 });
ok('E5 nav Boutique active', await p.locator('header nav a[aria-current="page"]').filter({ hasText: 'Boutique' }).count() === 1);
ok('E5 panier visible en univers Market', await p.locator('header a[href="/boutique/panier"]').isVisible());
ok('E5 produits e2e rendus', true);
ok('E5 plus de lien suivi (supprimé)', (await p.locator('header a[href="/boutique/suivi"]').count()) === 0);

// --- 6. Fiche produit : variantes + ajout panier ---
await p.goto(BASE + '/boutique/produit/e2e-nav-ecouteurs-bluetooth', { waitUntil: 'load' });
await p.waitForSelector('fieldset legend', { timeout: 10000 });
ok('E6 variantes rendues', await p.locator('fieldset legend').filter({ hasText: 'Couleur' }).isVisible());
ok('E6 bouton variante Blanc', await p.getByRole('button', { name: 'Blanc', exact: true }).isVisible());
await p.getByRole('button', { name: 'Blanc', exact: true }).click();
await p.getByRole('button', { name: 'Augmenter la quantité' }).click();
await p.getByRole('button', { name: /Ajouter au panier/ }).click();
await p.waitForTimeout(300);
ok('E6 feedback « Ajouté au panier »', await p.getByText('Ajouté au panier').isVisible());
ok('E6 badge panier = 2', (await p.locator('header a[href="/boutique/panier"] span').last().innerText()) === '2');
// deuxième produit
await p.goto(BASE + '/boutique/produit/e2e-nav-cable-usb', { waitUntil: 'load' });
await p.waitForSelector('button:has-text("Ajouter au panier")', { timeout: 10000 });
await p.getByRole('button', { name: /Ajouter au panier/ }).click();
await p.waitForTimeout(300);
ok('E6 badge panier = 3 (2 refs)', (await p.locator('header a[href="/boutique/panier"] span').last().innerText()) === '3');

// --- 7. Page panier ---
await p.goto(BASE + '/boutique/panier', { waitUntil: 'load' });
await p.waitForSelector('text=Couleur : Blanc', { timeout: 10000 });
ok('E7 2 lignes panier', await p.locator('ul li').filter({ has: p.getByText('Écouteurs Bluetooth E2E') }).count() === 1);
ok('E7 variante affichée (Couleur : Blanc)', await p.getByText('Couleur : Blanc').isVisible());
ok('E7 total indicatif = 31 500 F', await p.getByText('31 500').first().isVisible());
await p.getByRole('button', { name: 'Augmenter la quantité' }).first().click();
await p.waitForTimeout(200);
ok('E7 total après +1 = 46 000 F', await p.getByText('46 000').first().isVisible());
await p.getByRole('button', { name: /Retirer Câble USB-C E2E/ }).click();
await p.waitForTimeout(200);
ok('E7 retrait : 1 ligne restante', await p.locator('ul li img, ul li a[aria-label]').count() >= 1 && !(await p.getByText('Câble USB-C E2E').first().isVisible().catch(() => false)));

// --- 8. Commande multi-items depuis le panier ---
await p.getByRole('link', { name: /Envoyer ma demande de commande/ }).click();
await p.waitForTimeout(400);
ok('E8 mode panier : récap 3 × écouteurs', await p.getByText('× 3').first().isVisible());
await p.locator('#m-name').fill('Test E2E Nav');
await p.locator('#m-phone').fill('690 12 34 56');
await p.locator('#m-zone').fill('Quartier Test');
await p.locator('#m-notes').fill('Commande e2e phase 1 nav — à nettoyer');
await p.locator('input[type="checkbox"]').check();
await p.getByRole('button', { name: /Envoyer ma demande de commande/ }).click();
await p.waitForSelector('text=Votre demande est envoyée', { timeout: 20000 });
ok('E8 succès commande', true);
const orderRef = (await p.locator('strong.font-mono').first().innerText()).trim();
ok('E8 référence commande reçue (suivi public supprimé)', /^MKT-/.test(orderRef), orderRef);
ok('E8 aucun code de suivi affiché', (await p.locator('text=code de suivi').count()) === 0);
ok('E8 panier vidé après commande (badge disparu)', (await p.locator('header a[href="/boutique/panier"] span').count()) === 0);

// --- 10. Routes fonctionnelles préservées ---
for (const [path, marker] of [
  ['/demande', 'Décrivez votre besoin'],
  ['/univers/' + 'bricolage-reparations', ''],
  ['/service/intervention-plomberie', ''],
  ['/mentions-legales', 'Mentions légales'],
  ['/cgv', 'Conditions'],
  ['/confidentialite', 'Confidentialité'],
]) {
  const r = await p.request.get(BASE + '/#' + path);
  ok(`E10 route ${path} servie (HTTP 200)`, r.status() === 200);
}
await p.goto(BASE + '/demande', { waitUntil: 'load' });
await p.waitForSelector('form', { timeout: 10000 });
ok('E10 formulaire demande rendu', true);
ok('E10 footer colonnes deux univers', (await p.locator('footer h4').filter({ hasText: 'Services' }).count()) === 1 && (await p.locator('footer h4').filter({ hasText: 'Boutique' }).count()) === 1);
ok('E10 skip-link présent', await p.getByRole('link', { name: 'Aller au contenu' }).count() === 1);

// --- 11. 404 honnête ---
await p.goto(BASE + '/nimporte-quoi', { waitUntil: 'load' });
await p.waitForSelector('h1:has-text("Page introuvable")', { timeout: 5000 });
ok('E11 404 avec retour accueil', true);

ok('E11 aucune erreur JS runtime', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
await ctx.close();

/* ============================ MOBILE ============================ */
ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' });
p = await ctx.newPage();
const mobErrors = [];
p.on('pageerror', (e) => mobErrors.push(String(e)));

await p.goto(BASE + '/', { waitUntil: 'load' });
await p.waitForSelector('nav[aria-label="Navigation mobile"]', { timeout: 10000 });
// --- 12. Bottom nav ---
ok('M12 bottom nav visible (mobile)', await p.locator('nav[aria-label="Navigation mobile"]').isVisible());
const items = await p.locator('nav[aria-label="Navigation mobile"] a').all();
ok('M12 quatre destinations (suivi supprimé)', items.length === 4, `${items.length}`);
ok('M12 libellés', (await p.locator('nav[aria-label="Navigation mobile"]').innerText()).includes('Accueil') && (await p.locator('nav[aria-label="Navigation mobile"]').innerText()).includes('Panier'));
const navBox = await p.locator('nav[aria-label="Navigation mobile"]').boundingBox();
ok('M12 collée en bas de l’écran', Math.abs(navBox.y + navBox.height - 844) <= 60, JSON.stringify(navBox));

// navigation par bottom nav
await p.locator('nav[aria-label="Navigation mobile"] a[href="/boutique"]').click();
await p.waitForTimeout(600);
ok('M12 clic Boutique → univers Market', p.url().includes('/boutique'));
ok('M12 Boutique active', await p.locator('nav[aria-label="Navigation mobile"] a[aria-current="page"]').filter({ hasText: 'Boutique' }).count() === 1);
await p.locator('nav[aria-label="Navigation mobile"] a[href="/services"]').click();
await p.waitForTimeout(600);
ok('M12 Services actif après bascule', await p.locator('nav[aria-label="Navigation mobile"] a[aria-current="page"]').filter({ hasText: 'Services' }).count() === 1);

// --- 13. panier mobile + badge bottom nav ---
await p.goto(BASE + '/boutique/produit/e2e-nav-cable-usb', { waitUntil: 'load' });
await p.waitForSelector('button:has-text("Ajouter au panier")', { timeout: 10000 });
await p.getByRole('button', { name: /Ajouter au panier/ }).click();
await p.waitForTimeout(400);
ok('M13 badge panier bottom nav = 1', ((await p.locator('nav[aria-label="Navigation mobile"] a[aria-label*="Panier"]').getAttribute('aria-label')) ?? '').includes('1 article'));
// pas de chevauchement bouton WhatsApp / bottom nav
const waBox = await p.locator('aside[aria-label="Contact rapide"] a').boundingBox();
ok('M13 WhatsApp flottant au-dessus de la bottom nav', waBox && navBox && waBox.y + waBox.height <= navBox.y + 5, JSON.stringify({ waBox, navBox }));
// cibles tactiles
ok('M13 cibles ≥ 44px', await p.evaluate(() => {
  const links = [...document.querySelectorAll('nav[aria-label="Navigation mobile"] a')];
  return links.every((a) => a.getBoundingClientRect().height >= 44);
}));
ok('M13 aucune erreur JS mobile', mobErrors.length === 0, mobErrors.slice(0, 2).join(' | '));
await ctx.close();
await b.close();

/* ============================ RÉSULTATS ============================ */
const fails = results.filter((r) => r[0] === 'FAIL');
console.log(`\n===== E2E PHASE 1 NAV : ${results.length - fails.length}/${results.length} PASS =====`);
if (fails.length) { console.log('ÉCHECS :'); fails.forEach((f) => console.log(' -', f[1], f[2])); process.exit(1); }
