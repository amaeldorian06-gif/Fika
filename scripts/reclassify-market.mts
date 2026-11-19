/**
 * Refonte Market — Phase 2 : reclassification réelle du catalogue.
 *
 * Applique la taxonomie validée (audit §2) : 4 catégories racines cibles +
 * sous-catégories, réaffectation des 16 produits réels PAR SLUG EXACT
 * (aucune devinette : un slug inconnu fait échouer le script), archivage
 * logique des 3 anciennes catégories (aucune suppression physique),
 * création des 4 collections initiales.
 *
 * Données dérivées (jamais inventées) :
 * - shortDescription : première phrase de la description existante (≤ 160 c.).
 * - brand : copiée depuis une caractéristique « Marque » existante, le cas
 *   échéant (la spec d'origine est conservée).
 *
 * Idempotent : relançable sans effet de bord.
 * Base : celle de DATABASE_URL (partagée dev/prod — données réelles).
 */
import { prisma } from '../src/lib/prisma';

const ROOTS = [
  { slug: 'telephones-technologie', name: 'Téléphones & Technologie', description: 'Téléphones, accessoires et équipements électroniques sélectionnés et testés par Fika.', position: 1, active: true },
  { slug: 'maison-cuisine', name: 'Maison & Cuisine', description: 'Le quotidien de la maison, choisi pour sa robustesse et son prix juste.', position: 2, active: false },
  { slug: 'mode-accessoires', name: 'Mode & Accessoires', description: 'Accessoires de mode pour toutes les occasions.', position: 3, active: false },
  { slug: 'beaute-soins', name: 'Beauté & Soins', description: 'Produits de beauté et de soin du quotidien.', position: 4, active: false },
];

const SUBS = [
  { slug: 'chargeurs-et-cables', name: 'Chargeurs et câbles', parent: 'telephones-technologie', position: 1 },
  { slug: 'gadgets-et-petits-equipements', name: 'Gadgets et petits équipements', parent: 'telephones-technologie', position: 2 },
  { slug: 'supports-et-accessoires', name: 'Supports et accessoires', parent: 'telephones-technologie', position: 3 },
  { slug: 'ordinateurs-et-peripheriques', name: 'Ordinateurs et périphériques', parent: 'telephones-technologie', position: 4 },
  { slug: 'decoration-et-ambiance', name: 'Décoration et ambiance', parent: 'maison-cuisine', position: 1 },
  { slug: 'sacs-et-maroquinerie', name: 'Sacs et maroquinerie', parent: 'mode-accessoires', position: 1 },
  { slug: 'soin-personnel', name: 'Soin personnel', parent: 'beaute-soins', position: 1 },
];

/** Mapping validé (audit §2) : slug produit → { catégorie, sous-catégorie }. */
const PRODUCT_MAP: Record<string, { category: string; sub: string | null }> = {
  'chargeur-lenovo-usb': { category: 'telephones-technologie', sub: 'chargeurs-et-cables' },
  'chargeur-dell': { category: 'telephones-technologie', sub: 'chargeurs-et-cables' },
  'cable-sata-3k': { category: 'telephones-technologie', sub: 'chargeurs-et-cables' },
  'multiplicateur-usb-type-c': { category: 'telephones-technologie', sub: 'chargeurs-et-cables' },
  'voiture-de-course': { category: 'telephones-technologie', sub: 'gadgets-et-petits-equipements' },
  'bague-de-promesse': { category: 'telephones-technologie', sub: 'gadgets-et-petits-equipements' },
  'souris-hp': { category: 'telephones-technologie', sub: 'supports-et-accessoires' },
  'support-laptop': { category: 'telephones-technologie', sub: 'supports-et-accessoires' },
  'boitier-3-0-toshiba': { category: 'telephones-technologie', sub: 'supports-et-accessoires' },
  'manettes-pc': { category: 'telephones-technologie', sub: 'supports-et-accessoires' },
  'lenovo-thinkpad-e495': { category: 'telephones-technologie', sub: 'ordinateurs-et-peripheriques' },
  'hp-probook-430-g7': { category: 'telephones-technologie', sub: 'ordinateurs-et-peripheriques' },
  'lenovo-thinkpad-13': { category: 'telephones-technologie', sub: 'ordinateurs-et-peripheriques' },
  'led-5m': { category: 'maison-cuisine', sub: 'decoration-et-ambiance' },
  'stylish-bag': { category: 'mode-accessoires', sub: 'sacs-et-maroquinerie' },
  'lip-tint': { category: 'beaute-soins', sub: 'soin-personnel' },
};

/** Anciennes catégories : archivage logique (jamais supprimées). */
const OLD_CATEGORIES = ['accessoires', 'equipements-electroniques-et-menagers', 'e2e-nav-accessoires'];

const COLLECTIONS = [
  { slug: 'selection-fika', name: 'Sélection Fika', description: 'Les produits que Fika recommande en priorité.', rule: 'MANUAL', priceThreshold: null as number | null, position: 1, active: true },
  { slug: 'nouveautes', name: 'Nouveautés', description: 'Les derniers produits publiés dans la boutique.', rule: 'NEW_ARRIVALS', priceThreshold: null as number | null, position: 2, active: true },
  { slug: 'petits-prix', name: 'Petits prix', description: 'De bonnes affaires à petit prix.', rule: 'PRICE_BELOW', priceThreshold: 5000, position: 3, active: true },
  { slug: 'idees-cadeaux', name: 'Idées cadeaux', description: 'Des idées qui font plaisir.', rule: 'MANUAL', priceThreshold: null as number | null, position: 4, active: false },
];

/** Première phrase d'une description, tronquée proprement à 160 caractères. */
function deriveShortDescription(description: string | null): string | null {
  if (!description) return null;
  const firstSentence = (description.match(/^[^.!?\n]*[.!?]?/) ?? [''])[0].trim();
  if (!firstSentence) return null;
  if (firstSentence.length <= 160) return firstSentence;
  const cut = firstSentence.slice(0, 157);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : 157)}…`;
}

async function main() {
  console.log('=== Reclassification Market Phase 2 ===\n');

  /* 1. Vérification préalable : chaque slug produit doit exister — sinon échec. */
  const missing: string[] = [];
  for (const slug of Object.keys(PRODUCT_MAP)) {
    const p = await prisma.marketProduct.findUnique({ where: { slug }, select: { id: true } });
    if (!p) missing.push(slug);
  }
  if (missing.length > 0) {
    console.error(`ÉCHEC — slugs produits introuvables (aucune action effectuée) : ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(`✓ ${Object.keys(PRODUCT_MAP).length} slugs produits vérifiés (tous présents).`);

  /* 2. Catégories racines. */
  for (const r of ROOTS) {
    await prisma.marketCategory.upsert({
      where: { slug: r.slug },
      update: { name: r.name, description: r.description, position: r.position, active: r.active },
      create: { slug: r.slug, name: r.name, description: r.description, position: r.position, active: r.active },
    });
    console.log(`✓ catégorie racine « ${r.name} » (${r.active ? 'visible' : 'masquée — assortiment < 4 produits'})`);
  }

  /* 3. Sous-catégories (un niveau, parent = racine). */
  const roots = await prisma.marketCategory.findMany({ where: { slug: { in: ROOTS.map((r) => r.slug) } }, select: { id: true, slug: true } });
  const rootId = new Map(roots.map((r) => [r.slug, r.id]));
  for (const s of SUBS) {
    const parentId = rootId.get(s.parent)!;
    await prisma.marketCategory.upsert({
      where: { slug: s.slug },
      update: { name: s.name, parentId, position: s.position },
      create: { slug: s.slug, name: s.name, parentId, position: s.position },
    });
    console.log(`✓ sous-catégorie « ${s.name} » → ${s.parent}`);
  }
  const allCats = await prisma.marketCategory.findMany({ select: { id: true, slug: true } });
  const catId = new Map(allCats.map((c) => [c.slug, c.id]));

  /* 4. Réaffectation des produits + données dérivées. */
  const brandDerived: string[] = [];
  const shortCompleted: string[] = [];
  for (const [slug, target] of Object.entries(PRODUCT_MAP)) {
    const p = await prisma.marketProduct.findUnique({ where: { slug } });
    if (!p) continue; // déjà vérifié, garde pour le typage
    const specs = Array.isArray(p.specs) ? (p.specs as { label?: unknown; value?: unknown }[]) : [];
    const brandSpec = specs.find((s) => typeof s?.label === 'string' && s.label.trim().toLowerCase() === 'marque' && typeof s?.value === 'string' && s.value.trim());
    const brand = brandSpec ? (brandSpec.value as string).trim() : p.brand;
    if (brandSpec && !p.brand) brandDerived.push(`${slug} → « ${brand} » (depuis ses caractéristiques)`);
    const shortDescription = p.shortDescription ?? deriveShortDescription(p.description);
    if (!p.shortDescription && shortDescription) shortCompleted.push(slug);
    await prisma.marketProduct.update({
      where: { id: p.id },
      data: {
        categoryId: catId.get(target.category)!,
        subcategoryId: target.sub ? catId.get(target.sub)! : null,
        shortDescription,
        brand: brand || null,
      },
    });
  }
  console.log(`\n✓ ${Object.keys(PRODUCT_MAP).length} produits réaffectés (slugs et URLs inchangés).`);
  if (shortCompleted.length) console.log(`  shortDescription complétée pour ${shortCompleted.length} produit(s) : ${shortCompleted.join(', ')}`);
  if (brandDerived.length) console.log(`  brand dérivée pour ${brandDerived.length} produit(s) :\n    ${brandDerived.join('\n    ')}`);

  /* 5. Archivage logique des anciennes catégories. */
  for (const slug of OLD_CATEGORIES) {
    const c = await prisma.marketCategory.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!c) continue;
    await prisma.marketCategory.update({ where: { id: c.id }, data: { active: false, archived: true } });
    console.log(`✓ ancienne catégorie « ${c.name} » archivée (active=false, archived=true — conservée en base)`);
  }

  /* 6. Collections initiales. */
  for (const c of COLLECTIONS) {
    await prisma.marketCollection.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, rule: c.rule, priceThreshold: c.priceThreshold, position: c.position, active: c.active },
      create: { slug: c.slug, name: c.name, description: c.description, rule: c.rule, priceThreshold: c.priceThreshold, position: c.position, active: c.active },
    });
    console.log(`✓ collection « ${c.name} » (${c.rule}${c.priceThreshold ? ` ≤ ${c.priceThreshold} F` : ''}${c.active ? '' : ', inactive'})`);
  }

  /* 7. Vérification finale : état réel. */
  console.log('\n=== Vérification finale ===');
  const finalCats = await prisma.marketCategory.findMany({
    orderBy: { position: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  for (const c of finalCats) {
    console.log(`  ${c.archived ? '⊘' : c.active ? '◉' : '○'} ${c.name}${c.parentId ? ' (sous-cat.)' : ''} — ${c._count.products} produit(s)`);
  }
  const published = await prisma.marketProduct.count({ where: { active: true, archived: false } });
  const orders = await prisma.marketOrder.count();
  console.log(`\n  Produits publiés : ${published} · Commandes conservées : ${orders} (aucune donnée supprimée).`);
}

main().catch((e) => { console.error('ÉCHEC :', e); process.exit(1); }).finally(() => process.exit(0));
