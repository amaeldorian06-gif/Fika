import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const MB = 1024 * 1024;
const BUCKETS = [
  // Publics en lecture (URL /object/public/) : images gérées par l'équipe.
  { id: 'market-products', public: true,  limit: 5 * MB, mime: ['image/jpeg', 'image/png', 'image/webp'] },
  { id: 'portfolio',       public: true,  limit: 5 * MB, mime: ['image/jpeg', 'image/png', 'image/webp'] },
  // Privés : accès uniquement via service_role (upload serveur) + URL signée.
  { id: 'delivery-proofs', public: false, limit: 8 * MB, mime: ['image/jpeg', 'image/png', 'image/webp'] },
  { id: 'service-files',   public: false, limit: 8 * MB, mime: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] },
];
try {
  for (const b of BUCKETS) {
    await p.$executeRaw`
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (${b.id}, ${b.id}, ${b.public}, ${b.limit}, ${b.mime}::text[])
      ON CONFLICT (id) DO NOTHING`;
  }
  const rows = await p.$queryRaw`SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id`;
  console.log('Buckets en base :');
  rows.forEach(r => console.log(` - ${r.id} | public=${r.public} | max=${r.file_size_limit / MB}Mo | ${r.allowed_mime_types.join(',')}`));
} finally { p.$disconnect(); }
