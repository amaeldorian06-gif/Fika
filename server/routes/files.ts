import { randomUUID } from 'crypto';
import Busboy from 'busboy';
import type { Request } from 'express';
import { prisma } from '../../src/lib/prisma';
import { uploadObject, publicObjectUrl, isStorageConfigured, StorageError } from '../lib/storage';
import { checkMarketRate } from './market';

/**
 * Téléversement de fichiers — Supabase Storage via routes serveur uniquement.
 *
 * Règles communes : jamais de binaire en base (métadonnées + chemin), jamais
 * de nom de fichier client dans le chemin (UUID), nom d'origine tronqué et
 * nettoyé en base, type MIME vérifié par magic bytes (pas seulement l'en-tête
 * HTTP), taille plafonnée, rate-limit sur la route publique.
 *
 * Buckets :
 *  - service-files (privé)   : pièces jointes des demandes, route publique.
 *  - market-products (public): photos produits, route admin (URL publique).
 *  - delivery-proofs (privé) : preuves de livraison, route admin.
 */

const MAX_SERVICE_FILE = 8 * 1024 * 1024;
const MAX_PRODUCT_IMAGE = 5 * 1024 * 1024;
const MAX_PROOF = 8 * 1024 * 1024;

type ParsedUpload = { buffer: Buffer; mimeType: string; originalName: string; fields: Record<string, string> } | { error: string };

/** Parse un multipart mono-fichier (champ « file ») + champs texte associés. */
function parseMultipart(req: Request, maxBytes: number): Promise<ParsedUpload> {
  return new Promise((resolve) => {
    let busboy: Busboy.Busboy;
    try {
      busboy = Busboy({ headers: req.headers, limits: { fileSize: maxBytes, files: 1, fields: 5 } });
    } catch {
      resolve({ error: 'Requête multipart invalide.' });
      return;
    }
    const fields: Record<string, string> = {};
    let buffer: Buffer | null = null;
    let mimeType = '';
    let originalName = '';
    let failed = false;

    busboy.on('field', (name, value) => {
      if (name && name.length <= 24) fields[name] = String(value).slice(0, 200);
    });
    busboy.on('file', (name, stream, info) => {
      if (name !== 'file' || failed) { stream.resume(); return; }
      mimeType = info.mimeType ?? '';
      originalName = info.filename ?? '';
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('limit', () => { failed = true; resolve({ error: `Fichier trop volumineux (max ${Math.round(maxBytes / 1048576)} Mo).` }); });
      stream.on('end', () => { if (!failed) buffer = Buffer.concat(chunks); });
    });
    busboy.on('error', () => { failed = true; resolve({ error: 'Lecture du fichier impossible.' }); });
    busboy.on('finish', () => {
      if (failed) return;
      if (!buffer) { resolve({ error: 'Aucun fichier reçu.' }); return; }
      resolve({ buffer, mimeType, originalName, fields });
    });
    req.pipe(busboy);
  });
}

/** Vérifie le type réel par magic bytes — l'en-tête HTTP ne suffit jamais. */
function sniffMime(buffer: Buffer): 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 4).toString('hex') === '89504e47') return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

function cleanName(name: string): string {
  return name.replace(/[\r\n\0]/g, '').slice(0, 120) || 'fichier';
}

function storageErrorResponse(e: unknown): { status: number; body: Record<string, unknown> } {
  if (e instanceof StorageError && e.code === 'STORAGE_NOT_CONFIGURED') {
    return { status: 503, body: { ok: false, code: 'STORAGE_NOT_CONFIGURED', message: 'Le téléversement n’est pas encore activé. Contactez Fika sur WhatsApp.' } };
  }
  if (e instanceof StorageError) {
    return { status: 502, body: { ok: false, code: e.code, message: 'Le téléversement a échoué. Réessayez.' } };
  }
  return { status: 500, body: { ok: false, message: 'Erreur inattendue.' } };
}

/**
 * POST /api/files/service-request — public, avant soumission de la demande.
 * Champ « file » + champ texte facultatif « label » (libellé d'exigence).
 * Retourne { fileId } à inclure dans fileIds lors du POST /api/leads.
 */
export async function handleServiceRequestFile(req: Request, ip: string): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!checkMarketRate(`${ip || 'unknown'}:files`, 10, 60_000)) {
    return { status: 429, body: { ok: false, code: 'RATE_LIMITED', message: 'Trop de requêtes. Réessayez dans une minute.' } };
  }
  if (!isStorageConfigured()) {
    return { status: 503, body: { ok: false, code: 'STORAGE_NOT_CONFIGURED', message: 'Le téléversement n’est pas encore activé. Contactez Fika sur WhatsApp.' } };
  }
  const parsed = await parseMultipart(req, MAX_SERVICE_FILE);
  if ('error' in parsed) return { status: 400, body: { ok: false, message: parsed.error } };

  const realMime = sniffMime(parsed.buffer);
  const allowed: Array<'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'> = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!realMime || !allowed.includes(realMime)) {
    return { status: 415, body: { ok: false, message: 'Type de fichier non accepté (PDF, JPG, PNG ou WebP uniquement).' } };
  }

  const ext = realMime === 'application/pdf' ? 'pdf' : realMime === 'image/jpeg' ? 'jpg' : realMime === 'image/png' ? 'png' : 'webp';
  const path = `leads/${randomUUID()}.${ext}`;
  try {
    await uploadObject('service-files', path, parsed.buffer, realMime);
  } catch (e) { return storageErrorResponse(e); }

  const row = await prisma.serviceRequestFile.create({
    data: {
      bucket: 'service-files',
      path,
      mimeType: realMime,
      sizeBytes: parsed.buffer.length,
      originalName: cleanName(parsed.originalName),
      requirementLabel: (parsed.fields.label ?? '').slice(0, 160) || null,
    },
    select: { id: true },
  });
  return { status: 200, body: { ok: true, fileId: row.id } };
}

/**
 * POST /api/admin/files/product-image — admin. Retourne l'URL publique à
 * enregistrer dans MarketProduct.images (le bucket market-products est public).
 */
export async function handleProductImageUpload(req: Request): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!isStorageConfigured()) {
    return { status: 503, body: { ok: false, code: 'STORAGE_NOT_CONFIGURED', message: 'Stockage non configuré.' } };
  }
  const parsed = await parseMultipart(req, MAX_PRODUCT_IMAGE);
  if ('error' in parsed) return { status: 400, body: { ok: false, message: parsed.error } };

  const realMime = sniffMime(parsed.buffer);
  if (!realMime || realMime === 'application/pdf') {
    return { status: 415, body: { ok: false, message: 'Image attendue (JPG, PNG ou WebP).' } };
  }
  const ext = realMime === 'image/jpeg' ? 'jpg' : realMime === 'image/png' ? 'png' : 'webp';
  const path = `products/${randomUUID()}.${ext}`;
  try {
    await uploadObject('market-products', path, parsed.buffer, realMime);
  } catch (e) { return storageErrorResponse(e); }
  return { status: 200, body: { ok: true, url: publicObjectUrl('market-products', path) } };
}

/**
 * POST /api/admin/files/delivery-proof — admin. Champs « orderId » + « file ».
 * Crée la ligne MarketDeliveryProof liée à la commande.
 */
export async function handleDeliveryProofUpload(req: Request): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!isStorageConfigured()) {
    return { status: 503, body: { ok: false, code: 'STORAGE_NOT_CONFIGURED', message: 'Stockage non configuré.' } };
  }
  const parsed = await parseMultipart(req, MAX_PROOF);
  if ('error' in parsed) return { status: 400, body: { ok: false, message: parsed.error } };

  const orderId = parsed.fields.orderId ?? '';
  if (!orderId) return { status: 400, body: { ok: false, message: 'Commande manquante.' } };
  const order = await prisma.marketOrder.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true } });
  if (!order) return { status: 404, body: { ok: false, message: 'Commande introuvable.' } };

  const realMime = sniffMime(parsed.buffer);
  if (!realMime || realMime === 'application/pdf') {
    return { status: 415, body: { ok: false, message: 'Image attendue (JPG, PNG ou WebP).' } };
  }
  const ext = realMime === 'image/jpeg' ? 'jpg' : realMime === 'image/png' ? 'png' : 'webp';
  const path = `${order.orderNumber}/${randomUUID()}.${ext}`;
  try {
    await uploadObject('delivery-proofs', path, parsed.buffer, realMime);
  } catch (e) { return storageErrorResponse(e); }

  await prisma.marketDeliveryProof.create({
    data: {
      orderId: order.id,
      bucket: 'delivery-proofs',
      path,
      mimeType: realMime,
      sizeBytes: parsed.buffer.length,
      originalName: cleanName(parsed.originalName),
    },
  });
  return { status: 200, body: { ok: true } };
}
