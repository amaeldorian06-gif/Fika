import 'dotenv/config';
import { adminSeedCredentials } from '../server/lib/admin-seed';
/**
 * Seed Fika — idempotent (sûr à exécuter plusieurs fois).
 * Usage : npx tsx prisma/seed.ts  (ou `npx prisma db seed` une fois le bloc
 * "prisma": { "seed": "tsx prisma/seed.ts" } ajouté à package.json).
 *
 * Contenu : 1 ville (Ngaoundéré) + ses zones + 1 AdminUser.
 * Le catalogue (catégories/services/packs) sera semé en P03 depuis les
 * données validées — voir les stubs en bas de fichier.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Annuaire zones partagé (source unique : src/lib/city.ts — TODO_PROD :
// liste À VALIDER par le fondateur avant production).
import { ZONE_GROUPS } from '../src/lib/city';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

const ZONES = ZONE_GROUPS;

const CITY_NAME = 'Ngaoundéré';

async function seedCityAndZones() {
  const city = await prisma.city.upsert({
    where: { name: CITY_NAME },
    create: { name: CITY_NAME, active: true, position: 1 },
    update: { active: true, position: 1 },
  });

  let created = 0;
  let refreshed = 0;
  for (const group of ZONES) {
    for (const name of group.names) {
      const existing = await prisma.zone.findUnique({
        where: { cityId_name: { cityId: city.id, name } },
      });
      await prisma.zone.upsert({
        where: { cityId_name: { cityId: city.id, name } },
        create: { cityId: city.id, name, deliveryIncluded: true },
        update: { deliveryIncluded: true },
      });
      if (existing) refreshed += 1;
      else created += 1;
    }
  }
  console.log(`[seed] Ville « ${CITY_NAME} » OK — ${created} zone(s) créée(s), ${refreshed} déjà présente(s).`);
}

async function seedAdminUser() {
  const { email, passwordHash } = adminSeedCredentials();

  await prisma.adminUser.upsert({
    where: { email },
    create: { email, passwordHash, role: 'SUPERADMIN', active: true },
    // Rien à écraser en re-exécution : le mot de passe existant est conservé.
    update: {},
  });
  console.log(`[seed] AdminUser « ${email} » OK (mot de passe existant conservé si déjà présent).`);
}

/* ---- P03 : seed du catalogue (stubs volontairement vides) ------------------
async function seedCategories() { // upsert depuis les univers validés
}
async function seedServices() {   // upsert depuis SERVICES validés + ServiceRequirement
}
async function seedPackages() {   // upsert + lignes PackageService
}
---------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * MÉCANISME MULTI-VILLE (P11) — présent mais INACTIF par défaut.
 *
 * Pour ouvrir une nouvelle ville : passer ENABLE_EXTRA_CITIES à true ET
 * fournir (validés par le fondateur) : zones + lignes ServiceCityPrice.
 * Une ville activée SANS prix lèvera l'alerte needsCityPricing côté admin
 * et affichera « Sur devis » au public (voir lib/pricing).
 * ------------------------------------------------------------------------- */
const ENABLE_EXTRA_CITIES = false;

// TODO_PROD : zones Garoua/Maroua volontairement VIDES — rien n'est semé tant
// que la liste n'est pas validée. Ne JAMAIS rendre visible une ville inactive.
const EXTRA_CITIES = [
  { name: 'Garoua', position: 2, zones: [] as string[] },
  { name: 'Maroua', position: 3, zones: [] as string[] },
];

async function seedExtraCities() {
  if (!ENABLE_EXTRA_CITIES) {
    console.log('[seed] Multi-ville : inactif (ENABLE_EXTRA_CITIES=false) — Ngaoundéré seule.');
    return;
  }
  for (const city of EXTRA_CITIES) {
    if (city.zones.length === 0) {
      console.warn(`[seed] Ville « ${city.name} » ignorée : zones non renseignées (TODO_PROD).`);
      continue;
    }
    const row = await prisma.city.upsert({
      where: { name: city.name },
      create: { name: city.name, active: true, position: city.position },
      update: { position: city.position },
    });
    for (const name of city.zones) {
      await prisma.zone.upsert({
        where: { cityId_name: { cityId: row.id, name } },
        create: { cityId: row.id, name, deliveryIncluded: true },
        update: { deliveryIncluded: true },
      });
    }
    console.log(`[seed] Ville « ${city.name} » OK (${city.zones.length} zone(s)).`);
  }
}

async function main() {
  adminSeedCredentials(); // Valider avant toute écriture.
  await seedCityAndZones();
  await seedAdminUser();
  await seedExtraCities();
}

main()
  .catch((e) => {
    console.error('[seed] Échec :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
