// Smoke parcours demande : slot FILE rendu, upload RÉEL vers Supabase Storage
// (statut succès + nom du fichier), bouton retirer. Pas de soumission du
// formulaire ; le fichier téléversé (orphelin, sans demande rattachée) est
// supprimé en fin de test (base + bucket).
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { writeFileSync, rmSync } from 'node:fs';

const prisma = new PrismaClient();

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

  await p.goto(`${BASE}/demande?service=intervention-plomberie`, { waitUntil: 'load' });
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

  // 3. Sélection d'un PNG valide → upload réel (Storage configuré) + statut succès
  await input.setInputFiles(tmp);
  await p.waitForSelector('text=e2e-fika-photo.png', { timeout: 15000 });
  ok(true, 'fichier téléversé réellement (Supabase Storage)');
  await p.waitForSelector('div[class*="brand-wa"]', { timeout: 15000 });
  ok(true, 'statut succès visible (style WhatsApp)');
  ok((await p.locator('span[role="alert"]:visible').count()) === 0, 'aucune erreur relayée');

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
  // Nettoyage : fichiers orphelins créés par ce test (base + bucket).
  const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const orphans = await prisma.serviceRequestFile.findMany({ where: { leadId: null } });
  for (const o of orphans) {
    if (SUPABASE_URL && KEY) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/${o.bucket}/${o.path}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${KEY}` },
      }).catch(() => {});
    }
    await prisma.serviceRequestFile.delete({ where: { id: o.id } }).catch(() => {});
  }
  console.log(`  (nettoyage : ${orphans.length} fichier(s) orphelin(s) supprimé(s))`);
  await prisma.$disconnect();
}
console.log(`\n===== DEMANDE FICHIER SMOKE : ${pass}/${pass + fail} ${fail === 0 ? 'PASS' : 'FAIL'} =====`);
process.exit(fail === 0 ? 0 : 1);
