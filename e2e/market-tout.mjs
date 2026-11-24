// E2E boutique Phase 3 (19/11) — accueil éditorial (recherche visible,
// suggestions, cartes catégories, collections), page « Tous les produits »
// (recherche vivante, filtres, tri, état conservé, zéro résultat honnête),
// défilement automatique des photos d'aperçu (5 s + fondu), analytics
// SEARCH_PERFORMED / SEARCH_EMPTY / FILTER_USED vérifiés en base.
// Autonome : crée son produit de test (2 photos), le supprime avant/après.
// Exécution : node e2e/market-tout.mjs
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const prisma = new PrismaClient();
const SLUG = 'e2e-tout-ecouteurs-carousel';
const REF = 'FK-E2E-TOUT';
// Deux images distinctes servies par le site lui-même (la projection publique
// n'accepte que les URLs http(s) ou /… — pas de data: URI).
const IMG_A = '/fika/technologie.svg';
const IMG_B = '/fika/numerique.svg';
const QUERIES = ['carousel', 'ecouteurs', 'zzzz-inexistant-e2e'];
const TEST_START = new Date();

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`); }
};
const SEARCH_INPUT = 'input[aria-label="Rechercher un produit"]';

async function cleanTestProduct() {
  const existing = await prisma.marketProduct.findUnique({ where: { slug: SLUG }, select: { id: true } });
  if (existing) {
    await prisma.marketAnalyticEvent.deleteMany({ where: { productId: existing.id } });
    await prisma.marketProduct.delete({ where: { id: existing.id } });
  }
  // Événements analytics créés par CE run (fenêtre bornée par TEST_START) :
  // recherche/filtres du test uniquement, jamais ceux d'un vrai visiteur antérieur.
  await prisma.marketAnalyticEvent.deleteMany({
    where: { type: { in: ['SEARCH_PERFORMED', 'SEARCH_EMPTY', 'FILTER_USED'] }, createdAt: { gte: TEST_START } },
  });
}

/** Efface la recherche si l'état persisté la restaure (l'utilisateur voit le champ, il vide). */
async function clearSearchIfNeeded(p) {
  const input = p.locator(SEARCH_INPUT);
  if ((await input.inputValue()) !== '') {
    await input.fill('');
    await p.waitForTimeout(400);
  }
}

try {
  await cleanTestProduct();
  const cat = await prisma.marketCategory.findFirst({ where: { active: true }, orderBy: { position: 'asc' } });
  if (!cat) throw new Error('Aucune catégorie active — impossible de tester.');
  await prisma.marketProduct.create({
    data: {
      slug: SLUG, reference: REF, name: 'Écouteurs Carousel E2E', categoryId: cat.id,
      description: 'Produit de test : deux photos qui défilent.',
      specs: [], images: [IMG_A, IMG_B], variants: [],
      priceSale: 9900, supplierPrice: 5000, estimatedLandedCost: 6500,
      delayLabel: '2 à 4 jours', availability: 'AVAILABLE', active: true, popular: false,
    },
  });

  const api = await (await fetch(`${BASE}/api/market/catalog`)).json();
  ok(api.products.some((p) => p.slug === SLUG), 'produit de test visible dans le catalogue API');
  const apiCollections = await (await fetch(`${BASE}/api/market/collections`)).json();
  const expectedCards = api.products.length;
  const accentExpected = api.products.filter((x) => x.name.toLowerCase().includes('écouteur')).length;

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();

    /* ---------- 1. Accueil éditorial ---------- */
    await p.goto(`${BASE}/boutique`, { waitUntil: 'load' });
    // Depuis la refonte du storefront, la recherche de l'accueil vit dans
    // l'en-tête global (repliée sur mobile) ; le champ de la page Tous les
    // produits reste le point d'entrée testé ici.
    const search = p.locator('[aria-label="Rechercher un produit dans Fika Market"]').first();
    await search.waitFor({ state: 'attached', timeout: 20000 });
    ok(await search.count() > 0, 'accueil : barre de recherche présente (en-tête global)');
    await p.goto(`${BASE}/boutique/tous`, { waitUntil: 'load' });
    await p.waitForSelector(SEARCH_INPUT, { timeout: 20000 });
    ok(true, 'page Tous les produits : champ de recherche dédié disponible');
    await p.goto(`${BASE}/boutique`, { waitUntil: 'load' });
    await search.waitFor({ state: 'attached', timeout: 20000 });
    // Le catalogue est chargé en asynchrone (fetch) : attendre les cartes
    // catégories avant de tester suggestions et grille, sinon on teste le
    // squelette de chargement.
    await p.waitForSelector('a[href*="/boutique/categorie/"]', { timeout: 30000 });
    ok(true, 'accueil : catégories chargées');
    // Suggestions en direct : taper → panneau de suggestions annoncé en
    // aria-live (rôle « region » depuis la refonte du storefront).
    await search.fill('carousel');
    const panel = p.locator('#market-search-suggestions');
    await panel.waitFor({ state: 'visible', timeout: 8000 });
    ok(await panel.locator(`a[href="/boutique/produit/${SLUG}"]`).count() > 0, 'accueil : suggestion produit en direct pendant la frappe');
    const suggestionText = (await panel.innerText()).replace(/[\s\u202F\u00A0]/g, ' ');
    ok(suggestionText.includes('9 900'), 'accueil : prix affiché dans la suggestion');
    await search.press('Enter');
    await p.waitForURL('**/boutique/tous**', { timeout: 5000 });
    ok(p.url().includes('/boutique/tous?q=carousel'), 'accueil : Enter → page Tous les produits avec la requête', p.url());

    await p.goto(`${BASE}/boutique`, { waitUntil: 'load' });
    await p.waitForSelector('a[href="/boutique/tous"]', { timeout: 20000 });
    // Cartes catégories : chaque catégorie active avec produits a sa carte
    const apiCats = api.categories
      .map((c) => ({ slug: c.slug, name: c.name, count: api.products.filter((x) => x.category.slug === c.slug).length }))
      .filter((c) => c.count > 0);
    for (const c of apiCats) {
      ok((await p.locator(`a[href="/boutique/categorie/${c.slug}"]`).count()) >= 1, `accueil : carte catégorie « ${c.name} » (${c.count} produit(s))`);
    }
    // Collections éditoriales : chaque collection non vide a sa section (fetch séparé → attendre)
    for (const col of apiCollections) {
      await p.waitForSelector(`section[aria-labelledby] h2:has-text("${col.name}")`, { timeout: 10000 }).catch(() => {});
    }
    const headings = await p.locator('section h2').allInnerTexts();
    for (const col of apiCollections) {
      ok(headings.some((h) => h.trim() === col.name), `accueil : section collection « ${col.name} » (${col.products.length} produit(s))`);
    }
    const ctaAll = p.locator('a[href="/boutique/tous"]').first();
    const ctaTexts = await p.locator('a[href="/boutique/tous"]').allInnerTexts();
    ok(true, `accueil : ${ctaTexts.length} accès à « Tous les produits » disponibles`);
    await ctaAll.click();
    await p.waitForURL('**/boutique/tous', { timeout: 5000 });

    /* ---------- 2. Page « Tous les produits » : catalogue complet ---------- */
    await p.waitForSelector(`a[href="/boutique/produit/${SLUG}"]`, { timeout: 20000 });
    await clearSearchIfNeeded(p);
    // Attendre que la grille soit complète (le rendu peut s'étaler sur quelques centaines de ms)
    await p.waitForFunction(
      (expected) => document.querySelectorAll('a[href*="/boutique/produit/"]').length === expected,
      expectedCards, { timeout: 10000 },
    ).catch(() => {});
    const cards = await p.locator('a[href*="/boutique/produit/"]').count();
    if (cards !== expectedCards) {
      const hrefs = await p.locator('a[href*="/boutique/produit/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
      const domSlugs = new Set(hrefs.map((h) => h.replace('/boutique/produit/', '')));
      console.log('  · manquants :', api.products.filter((x) => !domSlugs.has(x.slug)).map((x) => x.slug).join(', ') || 'aucun (doublon ?)');
    }
    ok(cards === expectedCards, `tous les produits rendus une seule fois (${cards}/${expectedCards})`);
    const breadcrumb = await p.locator('nav[aria-label="Fil d\'Ariane"]').innerText().catch(() => '');
    ok(/Accueil/.test(breadcrumb) && /Boutique/.test(breadcrumb) && /Tous les produits/.test(breadcrumb), 'fil d’Ariane Accueil / Boutique / Tous les produits');
    const countStatus = await p.locator('p[role="status"]').first().innerText();
    ok(new RegExp(`${expectedCards} produits?`).test(countStatus), `compteur de produits (${countStatus.trim()})`);

    /* ---------- 3. Recherche vivante + zéro résultat honnête ---------- */
    const searchAll = p.locator(SEARCH_INPUT);
    ok(await searchAll.isVisible(), 'page Tous : barre de recherche visible');
    await searchAll.fill('carousel');
    await p.waitForTimeout(1400); // debounce analytics 900 ms : l'événement doit partir
    ok((await p.locator('a[href*="/boutique/produit/"]').count()) === 1, 'recherche « carousel » → 1 seul produit');
    ok((await p.locator(`a[href="/boutique/produit/${SLUG}"]`).count()) === 1, 'le produit trouvé est le bon');
    // accents ignorés : « ecouteurs » (sans accent) doit trouver les écouteurs
    await searchAll.fill('ecouteurs');
    await p.waitForTimeout(400);
    const accentMatches = await p.locator('a[href*="/boutique/produit/"]').count();
    ok(accentMatches === accentExpected && accentMatches > 0, `recherche sans accent « ecouteurs » → ${accentMatches} produit(s) attendu(s)`);
    // tolérance au pluriel : « ecouteur » (préfixe de mot)
    await searchAll.fill('ecouteur');
    await p.waitForTimeout(400);
    ok((await p.locator('a[href*="/boutique/produit/"]').count()) === accentExpected, 'recherche au singulier (préfixe de mot) → mêmes résultats');
    // recherche infructueuse → état vide honnête + issues réelles
    await searchAll.fill('zzzz-inexistant-e2e');
    await p.waitForTimeout(1400); // laisser partir SEARCH_EMPTY
    ok((await p.locator('text=Aucun produit ne correspond').count()) === 1, 'recherche sans résultat → message honnête');
    ok((await p.locator('a[href="/demande-produit"]').count()) >= 1, 'issue « Demander un produit » proposée');
    ok((await p.locator('a[href^="/boutique/categorie/"]').count()) >= 1, 'issue catégories proposée');
    // effacement
    await p.locator('button[aria-label="Effacer la recherche"]').click();
    await p.waitForTimeout(400);
    ok((await p.locator('a[href*="/boutique/produit/"]').count()) === expectedCards, 'effacement de la recherche → catalogue complet restauré');

    /* ---------- 4. Filtres + tri (desktop : 1280px) ---------- */
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto(`${BASE}/boutique/tous`, { waitUntil: 'load' });
    await p.waitForSelector('a[href*="/boutique/produit/"]', { timeout: 20000 });
    await clearSearchIfNeeded(p);
    const catSelect = p.locator('select[aria-label="Filtrer par catégorie"]');
    await catSelect.selectOption(cat.slug);
    await p.waitForTimeout(1400); // FILTER_USED part immédiatement, marge pour la grille
    const catCards = await p.locator('a[href*="/boutique/produit/"]').count();
    const catExpected = api.products.filter((x) => x.category.slug === cat.slug).length;
    ok(catCards === catExpected, `filtre catégorie « ${cat.name} » → ${catExpected} produit(s)`);
    const availSelect = p.locator('select[aria-label="Filtrer par disponibilité"]');
    await availSelect.selectOption('AVAILABLE');
    await p.waitForTimeout(400);
    const availCards = await p.locator('a[href*="/boutique/produit/"]').count();
    const availInCat = api.products.filter((x) => x.category.slug === cat.slug && x.availability === 'AVAILABLE').length;
    ok(availCards === availInCat, `filtre disponibilité « Disponible » → ${availInCat} produit(s)`);
    ok((await p.locator('button[aria-label^="Retirer le filtre"]').count()) === 2, 'étiquettes des filtres actifs (2) avec bouton de retrait');
    // retrait du filtre catégorie via son étiquette : la disponibilité s'applique toujours
    await p.locator('button[aria-label^="Retirer le filtre"]').first().click();
    await p.waitForTimeout(400);
    const availAllProducts = api.products.filter((x) => x.availability === 'AVAILABLE');
    ok((await p.locator('a[href*="/boutique/produit/"]').count()) === availAllProducts.length, `retrait du filtre catégorie → ${availAllProducts.length} produit(s) disponibles`);
    // tri prix croissant : la première carte est le produit le moins cher (filtré)
    await p.locator('select[aria-label="Trier les produits"]').last().selectOption('prix-asc');
    await p.waitForTimeout(400);
    const minPrice = Math.min(...availAllProducts.map((x) => x.priceSale));
    const firstPrice = Number((await p.locator('a[href*="/boutique/produit/"] .text-brand-accent').first().innerText()).replace(/[^\d]/g, ''));
    ok(firstPrice === minPrice, `tri prix croissant → première carte = ${minPrice.toLocaleString('fr-FR')} F`);
    await p.locator('select[aria-label="Trier les produits"]').last().selectOption('pertinence');
    await p.locator('text=Réinitialiser').click();
    await p.waitForTimeout(400);
    ok((await p.locator('a[href*="/boutique/produit/"]').count()) === expectedCards, 'réinitialisation → catalogue complet, filtres et recherche remis à zéro');

    /* ---------- 5. État conservé au retour d’une fiche (CDC §4.4) ---------- */
    await searchAll.fill('ecouteurs');
    await p.waitForTimeout(400);
    await p.locator('a[href*="/boutique/produit/"]').first().click();
    await p.waitForURL('**/boutique/produit/**', { timeout: 5000 });
    ok((await p.locator('nav[aria-label="Fil d\'Ariane"]').count()) === 1, 'fiche produit : fil d’Ariane présent');
    await p.goBack();
    await p.waitForSelector(SEARCH_INPUT, { timeout: 5000 });
    await p.waitForTimeout(1400); // debounce : SEARCH_PERFORMED « ecouteurs » restauré part
    const restored = await p.locator(SEARCH_INPUT).inputValue();
    ok(restored === 'ecouteurs', `état conservé au retour : recherche « ${restored} » restaurée`);
    const restoredCards = await p.locator('a[href*="/boutique/produit/"]').count();
    ok(restoredCards === accentExpected, `état conservé : résultats filtrés restaurés (${restoredCards}/${accentExpected})`);

    /* ---------- 6. Défilement automatique des photos (doux : 5 s + fondu) ---------- */
    await searchAll.fill('carousel');
    await p.waitForTimeout(400);
    const card = p.locator(`a[href="/boutique/produit/${SLUG}"]`).first();
    // Les photos sont empilées : la couche active porte la classe opacity-100.
    const activeSrc = async () => {
      const layers = card.locator('div[class*="transition-opacity"]');
      const n = await layers.count();
      for (let k = 0; k < n; k++) {
        const cls = (await layers.nth(k).getAttribute('class')) ?? '';
        if (cls.includes('opacity-100')) return layers.nth(k).locator('img').getAttribute('src');
      }
      return null;
    };
    ok((await card.locator('img').count()) === 2, 'photos d’aperçu empilées (produit à 2 photos, fondu enchaîné)');
    ok((await card.locator('div.aspect-square span.rounded-full').count()) === 2, '2 pastilles de position affichées');
    const src1 = await activeSrc();
    await p.waitForTimeout(5800);
    const src2 = await activeSrc();
    const lbl = (s) => (s === IMG_A ? 'A' : s === IMG_B ? 'B' : String(s));
    ok(src1 !== src2, `la photo change après 5 secondes (${lbl(src1)}→${lbl(src2)})`);
    // Pause au survol : la photo ne doit plus changer tant que la carte est survolée.
    // (écarter la souris d'abord : elle est encore sur la carte depuis le clic précédent,
    //  un hover sans déplacement ne déclenche pas mouseenter)
    await p.mouse.move(5, 5);
    await p.waitForTimeout(100);
    await card.hover();
    await p.waitForTimeout(200); // laisser la pause s'installer avant de figer la référence
    const held1 = await activeSrc();
    await p.waitForTimeout(5600);
    const held2 = await activeSrc();
    ok(held1 === held2, 'pause au survol : la photo reste en place');
    // Fin du survol : le défilement reprend.
    await p.mouse.move(5, 5);
    await p.waitForTimeout(5800);
    const src3 = await activeSrc();
    ok(src3 !== held2, 'fin du survol : le défilement reprend');

    /* ---------- 7. Accessibilité : animation réduite = pas de défilement ---------- */
    const ctxReduce = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const p2 = await ctxReduce.newPage();
    await p2.goto(`${BASE}/boutique/tous`, { waitUntil: 'load' });
    await p2.waitForSelector(`a[href="/boutique/produit/${SLUG}"]`, { timeout: 20000 });
    const card2 = p2.locator(`a[href="/boutique/produit/${SLUG}"]`).first();
    const activeSrc2 = async () => {
      const layers = card2.locator('div[class*="transition-opacity"]');
      const n = await layers.count();
      for (let k = 0; k < n; k++) {
        const cls = (await layers.nth(k).getAttribute('class')) ?? '';
        if (cls.includes('opacity-100')) return layers.nth(k).locator('img').getAttribute('src');
      }
      return null;
    };
    const rsrc1 = await activeSrc2();
    await p2.waitForTimeout(5800);
    const rsrc2 = await activeSrc2();
    ok(rsrc1 === rsrc2, 'prefers-reduced-motion → défilement désactivé');
    await ctxReduce.close();

    /* ---------- 8. Analytics recherche + filtres (vérifiés en base) ---------- */
    const events = await prisma.marketAnalyticEvent.findMany({
      where: { type: { in: ['SEARCH_PERFORMED', 'SEARCH_EMPTY'] }, createdAt: { gte: TEST_START } },
      orderBy: { createdAt: 'asc' },
    });
    ok(events.some((e) => e.type === 'SEARCH_PERFORMED' && e.meta?.query === 'carousel' && e.meta?.resultCount === 1),
      'analytics : SEARCH_PERFORMED « carousel » avec resultCount=1 en base');
    ok(events.some((e) => e.type === 'SEARCH_EMPTY' && e.meta?.query === 'zzzz-inexistant-e2e' && e.meta?.resultCount === 0),
      'analytics : SEARCH_EMPTY « zzzz-inexistant-e2e » avec resultCount=0 en base');
    ok(events.filter((e) => e.type === 'SEARCH_PERFORMED' && e.meta?.query === 'ecouteurs').length >= 1,
      'analytics : SEARCH_PERFORMED « ecouteurs » en base (état restauré re-compté)');
    const filterEvents = await prisma.marketAnalyticEvent.findMany({
      where: { type: 'FILTER_USED', createdAt: { gte: TEST_START } },
    });
    const filterOk = filterEvents.some((e) => e.meta?.filters && Object.values(e.meta.filters).includes(cat.slug));
    ok(filterOk, 'analytics : FILTER_USED avec la catégorie choisie en base');
  } finally {
    await browser.close();
  }
} finally {
  await cleanTestProduct();
  await prisma.$disconnect();
}
console.log(`\n===== BOUTIQUE PHASE 3 (accueil + Tous les produits + recherche + filtres + tri + carousel + analytics) : ${pass}/${pass + fail} ${fail === 0 ? 'PASS' : 'FAIL'} =====`);
process.exit(fail === 0 ? 0 : 1);
