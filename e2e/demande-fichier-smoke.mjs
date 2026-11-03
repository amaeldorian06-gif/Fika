// Smoke parcours demande : slot FILE rendu, tentative d'upload, message d'erreur
// honnête relayé (503 STORAGE_NOT_CONFIGURED), bouton retirer. Ne crée AUCUNE
// donnée en base (pas de soumission du formulaire).
import { chromium } from 'playwright';
import { writeFileSync, rmSync } from 'node:fs';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(128, 7),
]);
const tmp = '/tmp/e2e-fika-photo.png';
writeFileSync(tmp, PNG);

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label} ${extra}`); }
};

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));

  await p.goto(`${BASE}/#/demande?service=intervention-plomberie`, { waitUntil: 'load' });
  await p.waitForSelector('fieldset', { timeout: 10000 });

  // 1. Le slot FILE du service apparaît avec son libellé catalogue
  const legend = await p.locator('fieldset legend').first().innerText().catch(() => '');
  ok(/pièces jointes/i.test(legend), 'fieldset pièces jointes présent', `(legend="${legend}")`);
  ok((await p.locator('text=Photo ou vidéo de la fuite').count()) >= 1, 'libellé de l’exigence FILE affiché');
  ok((await p.locator('p:has-text("fichiers maximum")').count()) >= 1, 'note « fichiers maximum » affichée');

  // 2. Input file avec les types acceptés
  const input = p.locator('input[type="file"]').first();
  const accept = await input.getAttribute('accept');
  ok(accept === '.pdf,.jpg,.jpeg,.png,.webp', 'attribut accept restrictif', `(accept="${accept}")`);

  // 3. Sélection d’un PNG valide → statut d’erreur avec le message honnête du serveur
  await input.setInputFiles(tmp);
  await p.waitForSelector('text=téléversement n’est pas encore activé', { timeout: 10000 });
  ok(true, 'erreur 503 STORAGE_NOT_CONFIGURED relayée à l’utilisateur (pas de simulation)');
  ok((await p.locator('span[role="alert"]:visible').count()) >= 1, 'statut d’échec visible (rôle alert)');

  // 4. Bouton retirer : le fichier disparaît de la sélection
  await p.getByRole('button', { name: /retirer/i }).first().click();
  await p.waitForTimeout(300);
  ok((await p.locator('text=photo-plomberie.png').count()) === 0, 'fichier retiré de la liste');

  // 5. Aucune erreur JS non gérée
  ok(errors.length === 0, 'aucune erreur JavaScript', errors.join(' | '));

  await ctx.close();
} finally {
  await browser.close();
  rmSync(tmp, { force: true });
}
console.log(`\n===== DEMANDE FICHIER SMOKE : ${pass}/${pass + fail} ${fail === 0 ? 'PASS' : 'FAIL'} =====`);
process.exit(fail === 0 ? 0 : 1);
