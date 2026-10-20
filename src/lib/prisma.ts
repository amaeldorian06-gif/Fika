import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient.
 * Évite la multiplication des connexions en dev (hot reload du serveur).
 * SERVER-SIDE ONLY — ne jamais importer depuis un composant client ;
 * la bascule des pages sur la base est le chantier P03.
 */

/**
 * Prisma exige un mot de passe encodé dans l'URL (RFC 3986). Si DATABASE_URL
 * contient un mot de passe brut avec des caractères réservés (@, #, /, :…),
 * on l'encode à la volée — sans jamais coder une valeur en dur ici.
 */
function getFixedDbUrl(): string {
  const raw = process.env.DATABASE_URL || '';
  const m = raw.match(/^(postgres(?:ql)?:\/\/)([^/?#]+?):(.*)@([^@]+)$/s);
  if (!m) return raw;
  const [, scheme, user, password, rest] = m;
  if (/^(?:%[0-9A-Fa-f]{2}|[A-Za-z0-9\-._~!$&'()*+,;=])*$/.test(password)) return raw;
  return `${scheme}${user}:${encodeURIComponent(password)}@${rest}`;
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
