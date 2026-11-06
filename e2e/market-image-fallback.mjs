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

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();

  // Bloquer TOUTES les images du stockage → chaque <img> produit échoue.
  await p.route('**/storage/v1/object/public/**', (route) => route.abort());

  await p.goto(`${BASE}/#/boutique`, { waitUntil: 'load', timeout: 30000 });
  // Le catalogue doit se charger (l'API n'est pas bloquée) et contenir des produits.
  await p.waitForSelector('a[href*="/boutique/produit/"]', { timeout: 20000 });
  await p.waitForTimeout(4000); // laisser les <img> échouer et le repli s'installer

  const cards = await p.locator('a[href*="/boutique/produit/"]').count();
  ok(cards >= 1, `catalogue chargé (${cards} carte(s) produit)`);

  // Aucune carte ne doit contenir un <img> (toutes les URL sont mortes)…
  const cardsWithImg = await p.locator('a[href*="/boutique/produit/"] img').count();
  ok(cardsWithImg === 0, 'aucune <img> cassée affichée (0 sur les cartes)');
  // …et chaque carte affiche l'icône de repli.
  const cardsWithFallback = await p.locator('a[href*="/boutique/produit/"] svg').count();
  ok(cardsWithFallback >= cards, `icône de repli présente sur les cartes (${cardsWithFallback}/${cards})`);
} finally {
  await browser.close();
}
console.log(`\n===== REPLI IMAGES MARKET : ${pass}/${pass + fail} ${fail === 0 ? 'PASS' : 'FAIL'} =====`);
process.exit(fail === 0 ? 0 : 1);
