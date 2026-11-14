// Régression : repli gracieux des images produit (URL morte → icône, jamais
// l'icône « image cassée » du navigateur). Aucune donnée de test nécessaire :
// on bloque les requêtes vers le stockage avec l'interception réseau de
// Playwright, ce qui simule des URL mortes sans toucher à la base.
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); }
};

// Précondition honnête : le nombre de cartes attendu vient de l'API réelle.
// Catalogue vide côté API → test sans objet (SKIP), pas un faux succès.
const api = await (await fetch(`${BASE}/api/market/catalog`)).json();
const apiCount = api.products?.length ?? 0;
if (apiCount === 0) {
  console.log('  − catalogue vide côté API (0 produit actif) — repli d’image sans objet, SKIP');
  console.log(`\n===== REPLI IMAGES MARKET : SKIP (catalogue vide) =====`);
  process.exit(0);
}

const browser = await chromium.launch();
try {
  // reducedMotion: 'reduce' → le défilement automatique des photos d'aperçu
  // est désactivé (accessibilité) : seules les premières URLs sont rendues,
  // le comptage des <img> reste déterministe.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();

  // Bloquer TOUTES les images du stockage → chaque <img> produit échoue.
  await p.route('**/storage/v1/object/public/**', (route) => route.abort());

  await p.goto(`${BASE}/boutique`, { waitUntil: 'load', timeout: 30000 });
  // Le catalogue doit se charger (l'API n'est pas bloquée) et contenir des produits.
  await p.waitForSelector('a[href*="/boutique/produit/"]', { timeout: 20000 });
  await p.waitForTimeout(4000); // laisser les <img> échouer et le repli s'installer

  const cards = await p.locator('a[href*="/boutique/produit/"]').count();
  ok(cards === apiCount, `catalogue chargé (${cards} carte(s) = ${apiCount} produit(s) API)`);

  // Aucune <img> réellement cassée ne doit rester affichée. Les photos sont
  // empilées (fondu) et paresseuses : celles sous le pli ne se chargent pas
  // (complete=false) — elles ne sont ni affichées ni cassées. On ne compte
  // que les images chargées ET en échec (complete && naturalWidth=0).
  const brokenCount = await p.evaluate(() =>
    Array.from(document.querySelectorAll('a[href*="/boutique/produit/"] img'))
      .filter((im) => im.complete && im.naturalWidth === 0).length);
  ok(brokenCount === 0, `aucune <img> cassée affichée (${brokenCount} sur les cartes)`);
  // …et chaque carte affiche l'icône de repli.
  const cardsWithFallback = await p.locator('a[href*="/boutique/produit/"] svg').count();
  ok(cardsWithFallback >= cards, `icône de repli présente sur les cartes (${cardsWithFallback}/${cards})`);
} finally {
  await browser.close();
}
console.log(`\n===== REPLI IMAGES MARKET : ${pass}/${pass + fail} ${fail === 0 ? 'PASS' : 'FAIL'} =====`);
process.exit(fail === 0 ? 0 : 1);
