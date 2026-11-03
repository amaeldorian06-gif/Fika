import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'node:stream';

/**
 * Téléversement de fichiers — validation réelle : multipart construit à la
 * main, magic bytes vérifiés, stockage mocké (jamais de réseau en test).
 */

const db = vi.hoisted(() => ({
  serviceRequestFile: { create: vi.fn() },
  marketOrder: { findUnique: vi.fn() },
  marketDeliveryProof: { create: vi.fn() },
}));
vi.mock('../../src/lib/prisma', () => ({ prisma: db }));

const storage = vi.hoisted(() => {
  // La classe doit vivre dans le mock : files.ts et le test partagent la même référence.
  class StorageError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  }
  return { StorageError, uploadObject: vi.fn(), publicObjectUrl: vi.fn(), isStorageConfigured: vi.fn(), signedObjectUrl: vi.fn() };
});
vi.mock('../lib/storage', () => storage);

import { handleServiceRequestFile, handleProductImageUpload, handleDeliveryProofUpload } from './files';
import { StorageError } from '../lib/storage';

/** Corps multipart minimal (un champ fichier + champs texte). */
function multipart(parts: Array<{ name: string; filename?: string; mime?: string; data: Buffer | string }>): { req: unknown; boundary: string } {
  const boundary = '----fikaTestBoundary42';
  const chunks: Buffer[] = [];
  for (const p of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (p.filename !== undefined) {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\nContent-Type: ${p.mime ?? 'application/octet-stream'}\r\n\r\n`));
      chunks.push(Buffer.isBuffer(p.data) ? p.data : Buffer.from(p.data));
      chunks.push(Buffer.from('\r\n'));
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${p.name}"\r\n\r\n${p.data}\r\n`));
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(chunks);
  const req = Readable.from([body]) as unknown as Record<string, unknown>;
  req.headers = { 'content-type': `multipart/form-data; boundary=${boundary}` };
  return { req, boundary };
}

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(64)]);

beforeEach(() => {
  vi.resetAllMocks();
  db.serviceRequestFile.create.mockImplementation(async ({ data }) => ({ id: 'file-cuid-123', ...data }));
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('téléversement — pièces jointes de demande (public)', () => {
  it('503 honnête quand le stockage n’est pas configuré', async () => {
    storage.isStorageConfigured.mockReturnValue(false);
    const { req } = multipart([{ name: 'file', filename: 'cv.pdf', mime: 'application/pdf', data: PDF }]);
    const res = await handleServiceRequestFile(req as never, '1.2.3.4');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('STORAGE_NOT_CONFIGURED');
    expect(storage.uploadObject).not.toHaveBeenCalled();
  });

  it('accepte un PNG réel, crée la ligne de métadonnées et retourne fileId', async () => {
    storage.isStorageConfigured.mockReturnValue(true);
    storage.uploadObject.mockResolvedValue(undefined);
    const { req } = multipart([
      { name: 'label', data: 'Votre logo' },
      { name: 'file', filename: 'photo robinet.png', mime: 'image/png', data: PNG },
    ]);
    const res = await handleServiceRequestFile(req as never, '1.2.3.4');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.fileId).toBe('string');
    expect(storage.uploadObject).toHaveBeenCalledWith('service-files', expect.stringMatching(/^leads\/[0-9a-f-]{36}\.png$/), expect.any(Buffer), 'image/png');
    expect(db.serviceRequestFile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bucket: 'service-files', mimeType: 'image/png', sizeBytes: PNG.length, originalName: 'photo robinet.png', requirementLabel: 'Votre logo' }),
    }));
  });

  it('refuse un fichier dont le contenu ne correspond à aucun type accepté (magic bytes)', async () => {
    storage.isStorageConfigured.mockReturnValue(true);
    const { req } = multipart([{ name: 'file', filename: 'virus.exe', mime: 'image/png', data: Buffer.alloc(128, 0x41) }]);
    const res = await handleServiceRequestFile(req as never, '1.2.3.4');
    expect(res.status).toBe(415);
    expect(storage.uploadObject).not.toHaveBeenCalled();
  });

  it('refuse un PDF déguisé en image côté en-tête HTTP mais l’accepte comme PDF réel', async () => {
    storage.isStorageConfigured.mockReturnValue(true);
    const { req } = multipart([{ name: 'file', filename: 'doc.pdf', mime: 'image/png', data: PDF }]);
    const res = await handleServiceRequestFile(req as never, '1.2.3.4');
    expect(res.status).toBe(200);
    expect(storage.uploadObject).toHaveBeenCalledWith('service-files', expect.stringMatching(/\.pdf$/), expect.any(Buffer), 'application/pdf');
  });

  it('relaye l’échec du stockage sans exposer le corps d’erreur', async () => {
    storage.isStorageConfigured.mockReturnValue(true);
    storage.uploadObject.mockRejectedValue(new StorageError('STORAGE_UPLOAD_FAILED', 'Envoi impossible (stockage, HTTP 500).'));
    const { req } = multipart([{ name: 'file', filename: 'a.png', mime: 'image/png', data: PNG }]);
    const res = await handleServiceRequestFile(req as never, '1.2.3.4');
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain('HTTP 500');
  });

  it('limite le rythme : la 11e requête dans la fenêtre est refusée', async () => {
    storage.isStorageConfigured.mockReturnValue(true);
    const { req } = multipart([{ name: 'file', filename: 'a.png', mime: 'image/png', data: PNG }]);
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await handleServiceRequestFile(req as never, '9.9.9.9')).status;
    expect(last).toBe(429);
  });
});

describe('téléversement — images produit (admin)', () => {
  it('retourne l’URL publique du bucket market-products', async () => {
    storage.isStorageConfigured.mockReturnValue(true);
    storage.uploadObject.mockResolvedValue(undefined);
    storage.publicObjectUrl.mockReturnValue('https://example.supabase.co/storage/v1/object/public/market-products/products/x.png');
    const { req } = multipart([{ name: 'file', filename: 'produit.jpg', mime: 'image/jpeg', data: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64)]) }]);
    const res = await handleProductImageUpload(req as never);
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('/object/public/market-products/');
  });

  it('refuse un PDF pour une image produit', async () => {
    storage.isStorageConfigured.mockReturnValue(true);
    const { req } = multipart([{ name: 'file', filename: 'doc.pdf', mime: 'application/pdf', data: PDF }]);
    const res = await handleProductImageUpload(req as never);
    expect(res.status).toBe(415);
  });
});

describe('téléversement — preuve de livraison (admin)', () => {
  it('exige une commande existante et crée la ligne MarketDeliveryProof', async () => {
    storage.isStorageConfigured.mockReturnValue(true);
    storage.uploadObject.mockResolvedValue(undefined);
    db.marketOrder.findUnique.mockResolvedValue({ id: 'order-1', orderNumber: 'MKT-2026-0007' });
    const { req } = multipart([
      { name: 'orderId', data: 'order-1' },
      { name: 'file', filename: 'remise.jpg', mime: 'image/jpeg', data: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64)]) },
    ]);
    const res = await handleDeliveryProofUpload(req as never);
    expect(res.status).toBe(200);
    expect(storage.uploadObject).toHaveBeenCalledWith('delivery-proofs', expect.stringMatching(/^MKT-2026-0007\/[0-9a-f-]{36}\.jpg$/), expect.any(Buffer), 'image/jpeg');
    expect(db.marketDeliveryProof.create).toHaveBeenCalled();
  });

  it('404 si la commande est inconnue', async () => {
    storage.isStorageConfigured.mockReturnValue(true);
    db.marketOrder.findUnique.mockResolvedValue(null);
    const { req } = multipart([{ name: 'orderId', data: 'inconnu' }, { name: 'file', filename: 'a.png', mime: 'image/png', data: PNG }]);
    const res = await handleDeliveryProofUpload(req as never);
    expect(res.status).toBe(404);
  });
});
