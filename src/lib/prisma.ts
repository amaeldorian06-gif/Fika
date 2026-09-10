import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient.
 * Évite la multiplication des connexions en dev (hot reload du serveur).
 * SERVER-SIDE ONLY — ne jamais importer depuis un composant client ;
 * la bascule des pages sur la base est le chantier P03.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [] // Les erreurs ORM peuvent contenir des paramètres sensibles.,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
