import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { adminSeedCredentials } from './server/lib/admin-seed';

async function main() {
  const { email, passwordHash } = adminSeedCredentials();
  // Réinitialisation explicite du compte désigné par ADMIN_EMAIL.
  await prisma.adminUser.upsert({
    where: { email },
    create: { email, passwordHash, role: 'SUPERADMIN', active: true },
    update: { passwordHash },
  });
  console.log('Compte admin créé ou mot de passe renouvelé (rôle et activation existants conservés).');
}
main().catch(() => {
  console.error('Échec du seed admin : vérifier les variables, la base et les migrations.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
