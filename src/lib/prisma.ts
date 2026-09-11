import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient.
 * Évite la multiplication des connexions en dev (hot reload du serveur).
 * SERVER-SIDE ONLY — ne jamais importer depuis un composant client ;
 * la bascule des pages sur la base est le chantier P03.
 */

function getFixedDbUrl() {
  let url = process.env.DATABASE_URL || '';
  // Fix the user's specific special characters if they haven't encoded them
  if (url.includes("[Kid1joyland'@]")) {
    url = url.replace("[Kid1joyland'@]", "%5BKid1joyland%27%40%5D");
  }
  return url;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [], // Les erreurs ORM peuvent contenir des paramètres sensibles.
    datasources: process.env.DATABASE_URL ? {
      db: {
        url: getFixedDbUrl(),
      },
    } : undefined,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
