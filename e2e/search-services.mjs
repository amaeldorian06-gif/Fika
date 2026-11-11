// Efficacité de la recherche de services (/services) — navigation réelle.
// Le catalogue complet a été retiré de la page : la recherche est LE moyen
// de trouver un service. Chaque scénario reflète un usage réel.
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
  await p.goto(`${BASE}/services`, { waitUntil: 'load', timeout: 30000 });
  await p.waitForSelector('input[aria-label="Rechercher un service"]', { timeout: 20000 });

  const search = async (q) => {
    await p.fill('input[aria-label="Rechercher un service"]', q);
    await p.waitForTimeout(350); // rendu React
    return p.locator('a[href^="/service/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  };

  // 1. Mot simple, sans accent, en minuscule → trouve le service concerné
  let r = await search('plomberie');
  ok(r.some((h) => h.includes('plomberie')), '« plomberie » → service plomberie trouvé', r.join(', '));

  // 2. MAJUSCULES → même résultat (casse ignorée)
  r = await search('PLOMBERIE');
  ok(r.some((h) => h.includes('plomberie')), '« PLOMBERIE » (majuscules) → trouvé', r.join(', '));

  // 3. Requête sans accent → service accentué trouvé
  r = await search('reparation telephone');
  ok(r.some((h) => h.includes('telephone') || h.includes('tablette')), '« reparation telephone » (sans accents) → trouvé', r.join(', '));

  // 4. Multi-mots : nom + description combinés
  r = await search('telephone ecran');
  ok(r.length >= 1 && r.length <= 3, '« telephone ecran » → résultat ciblé (1-3)', `${r.length} résultat(s)`);

  // 5. Mot de description seul
  r = await search('fuite');
  ok(r.length >= 2, '« fuite » → plomberie ET toiture (descriptions)', `${r.length} résultat(s)`);

  // 6. Par univers : mot de la catégorie
  r = await search('numerique');
  ok(r.length >= 3, "« numerique » → services de l'univers Numérique & Documents", `${r.length} résultat(s)`);

  // 7. Aucun résultat : message honnête, pas de liste fictive
  r = await search('xyztoutcassee');
  const honest = await p.getByText('Aucun service ne correspond').isVisible();
  ok(r.length === 0 && honest, 'requête impossible → 0 résultat + message honnête');

  // 8. Compteur affiché
  await search('demenagement');
  const counter = await p.locator('[role="status"]').first().innerText();
  ok(/1 service trouvé/.test(counter), 'compteur « 1 service trouvé » affiché', counter);

  // 9. Bouton effacer
  await p.locator('button[aria-label="Effacer la recherche"]').click();
  await p.waitForTimeout(300);
  ok((await p.locator('a[href^="/service/"]').count()) === 0, 'bouton effacer → résultats retirés');

  // 10. Chaque résultat mène bien vers une fiche service
  r = await search('peinture');
  const first = p.locator('a[href^="/service/"]').first();
  await first.click();
  await p.waitForTimeout(500);
  ok(p.url().includes('/service/'), 'clic sur un résultat → fiche service ouverte', p.url());
  ok((await p.locator('h1').first().innerText()).length > 3, 'fiche service rendue (h1 présent)');

  await browser.close();
} finally {
  await browser.close();
}
console.log(`\n===== EFFICACITÉ RECHERCHE SERVICES : ${pass}/${pass + fail} ${fail === 0 ? 'PASS' : 'FAIL'} =====`);
process.exit(fail === 0 ? 0 : 1);
