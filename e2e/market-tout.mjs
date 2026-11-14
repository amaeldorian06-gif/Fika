// E2E boutique « Tout » (14/11) — disposition par catégorie, barre de
// recherche, défilement automatique des photos d'aperçu (2 s).
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

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`); }
};

async function cleanTestProduct() {
  const existing = await prisma.marketProduct.findUnique({ where: { slug: SLUG }, select: { id: true } });
  if (existing) {
    await prisma.marketAnalyticEvent.deleteMany({ where: { productId: existing.id } });
    await prisma.marketProduct.delete({ where: { id: existing.id } });
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

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/boutique`, { waitUntil: 'load' });
    await p.waitForSelector(`a[href="/boutique/produit/${SLUG}"]`, { timeout: 20000 });

    /* ---------- 1. Groupement par catégorie ---------- */
    const apiSections = api.categories
      .map((c) => ({ name: c.name, count: api.products.filter((x) => x.category.slug === c.slug).length }))
      .filter((s) => s.count > 0);
    const headings = await p.locator('section h2').allInnerTexts();
    for (const s of apiSections) {
      ok(headings.some((h) => h.trim() === s.name), `section catégorie « ${s.name} » affichée (${s.count} produit(s))`);
    }
    const expectedCards = api.products.length;
    const cards = await p.locator('a[href*="/boutique/produit/"]').count();
    ok(cards === expectedCards, `tous les produits rendus une seule fois (${cards}/${expectedCards})`);
    const countLabel = await p.locator('section', { has: p.locator(`a[href="/boutique/produit/${SLUG}"]`) }).first().locator('span.text-xs').first().innerText().catch(() => '');
    ok(/produit/.test(countLabel), `compteur de produits affiché sur la section (« ${countLabel.trim()} »)`);

    /* ---------- 2. Barre de recherche ---------- */
    const search = p.locator('input[aria-label="Rechercher un produit"]');
    ok(await search.isVisible(), 'barre de recherche présente et visible');
    await search.fill('carousel');
    await p.waitForTimeout(300);
    ok((await p.locator('a[href*="/boutique/produit/"]').count()) === 1, 'recherche « carousel » → 1 seul produit');
    ok((await p.locator(`a[href="/boutique/produit/${SLUG}"]`).count()) === 1, 'le produit trouvé est le bon');
    // accents ignorés : « ecouteurs » (sans accent) doit trouver les écouteurs
    await search.fill('ecouteurs');
    await p.waitForTimeout(300);
    const accentMatches = await p.locator('a[href*="/boutique/produit/"]').count();
    const accentExpected = api.products.filter((x) => x.name.toLowerCase().includes('écouteur')).length;
    ok(accentMatches === accentExpected && accentMatches > 0, `recherche sans accent « ecouteurs » → ${accentMatches} produit(s) attendu(s)`);
    // recherche infructueuse → état vide honnête
    await search.fill('zzzz-inexistant');
    await p.waitForTimeout(300);
    ok((await p.locator('text=Aucun produit ne correspond').count()) === 1, 'recherche sans résultat → message honnête');
    ok((await p.locator('a[href="/demande-produit"]').count()) >= 1, 'issue « Demander un produit » proposée');
    // effacement
    await p.locator('button[aria-label="Effacer la recherche"]').click();
    await p.waitForTimeout(300);
    ok((await p.locator('a[href*="/boutique/produit/"]').count()) === expectedCards, 'effacement de la recherche → catalogue complet restauré');

    /* ---------- 3. Défilement automatique des photos (doux : 5 s + fondu) ---------- */
    await search.fill('carousel');
    await p.waitForTimeout(300);
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

    /* ---------- 4. Accessibilité : animation réduite = pas de défilement ---------- */
    const ctxReduce = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const p2 = await ctxReduce.newPage();
    await p2.goto(`${BASE}/boutique`, { waitUntil: 'load' });
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
  } finally {
    await browser.close();
  }
} finally {
  await cleanTestProduct();
  await prisma.$disconnect();
}
console.log(`\n===== BOUTIQUE « TOUT » (catégories + recherche + carousel) : ${pass}/${pass + fail} ${fail === 0 ? 'PASS' : 'FAIL'} =====`);
process.exit(fail === 0 ? 0 : 1);
