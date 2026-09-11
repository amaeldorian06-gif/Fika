import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

/** Read-only readiness check. Prints neither connection URLs nor credentials. */
async function main() {
  let ready = true;
  const check = (label: string, valid: boolean) => {
    console.log(`${valid ? 'OK' : 'À CONFIGURER'} : ${label}`);
    if (!valid) ready = false;
  };
  const database = process.env.DATABASE_URL;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const hasDatabase = !!database && /^postgres(ql)?:\/\//.test(database) && !/(?:USER|PASSWORD|POOLER_HOST|@HOST)/.test(database);
  check('DATABASE_URL PostgreSQL renseignée', hasDatabase);
  const direct = process.env.DIRECT_URL;
  check('DIRECT_URL pour les migrations', !!direct && /^postgres(ql)?:\/\//.test(direct) && !/(?:USER|PASSWORD|POOLER_HOST|@HOST)/.test(direct));
  check('AUTH_SECRET (32 caractères minimum)', (process.env.AUTH_SECRET?.length ?? 0) >= 32);
  check('ADMIN_EMAIL renseigné', !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  check('VITE_WA_PHONE au format camerounais', /^\+2376\d{8}$/.test(process.env.VITE_WA_PHONE ?? ''));
  if (hasDatabase) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await prisma.payment.findFirst({ select: { reference: true, idempotencyKey: true, confirmedById: true } });
      await prisma.documentCounter.count();
      console.log('OK : accès à la base et tables opérations');
      if (email) {
        const admin = await prisma.adminUser.findUnique({ where: { email }, select: { active: true } });
        check('Compte admin existant et actif', admin?.active === true);
      }
    } catch {
      ready = false;
      console.log('À VÉRIFIER : connexion, moteur Prisma et migrations (aucun détail sensible affiché).');
    }
  }
  if (!ready) {
    console.log('Consultez docs/admin-operations.md. Aucune donnée ni configuration n’a été modifiée.');
    process.exitCode = 1;
  } else console.log('Vérifications de configuration réussies. Une recette métier reste nécessaire.');
}
main().catch(() => { console.error('Vérification impossible, sans modification de données.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
