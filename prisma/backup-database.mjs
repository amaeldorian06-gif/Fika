// Sauvegarde complète de la base de production (schéma public) → backups/*.json
// ---------------------------------------------------------------------------
// Usage      : npm run db:backup   (depuis le sandbox — le PC fondateur ne joint
//              pas Supabase ; à lancer AVANT toute opération risquée sur la
//              base, et régulièrement pour pallier l'absence de PITR du plan
//              gratuit Supabase — leçon de l'incident du 03/11/2026).
// Contenu    : toutes les tables du schéma public, lignes complètes, horodatées.
// Sécurité   : lecture seule, aucun secret dans le fichier (la DATABASE_URL
//              reste dans .env, jamais commité). Le dossier backups/ est
//              gitignoré : la sauvegarde ne quitte jamais le workspace.
// RESTAURATION : JAMAIS automatique ni scriptée (l'incident est né d'une
//              commande agressive). Elle se fait avec l'agent, table par table,
//              dans l'ordre des dépendités (référents d'abord, puis dépendants).
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';

const p = new PrismaClient();

const bigintSafe = (_key, value) => (typeof value === 'bigint' ? value.toString() : value);

try {
  const tables = (await p.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`)
    .map((r) => r.tablename)
    .filter((t) => t !== '_prisma_migrations'); // historique technique Prisma, recréé par migrate

  const dump = { createdAt: new Date().toISOString(), tables: {} };
  const counts = [];
  for (const t of tables) {
    const rows = await p.$queryRawUnsafe(`SELECT * FROM "${t}"`);
    dump.tables[t] = rows;
    counts.push([t, rows.length]);
  }

  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  mkdirSync('backups', { recursive: true });
  const file = `backups/fika-backup-${stamp}.json`;
  const json = JSON.stringify(dump, bigintSafe, 1);
  writeFileSync(file, json);

  console.log(`Sauvegarde écrite : ${file} (${(json.length / 1024).toFixed(1)} Ko)`);
  console.log(`Tables : ${counts.length}`);
  for (const [t, n] of counts) console.log(`  ${String(n).padStart(5)}  ${t}`);
  const total = counts.reduce((s, [, n]) => s + n, 0);
  console.log(`Total lignes : ${total}`);
} finally {
  await p.$disconnect();
}
