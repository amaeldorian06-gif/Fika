/**
 * Client Supabase Storage — REST via fetch, zéro dépendance.
 *
 * SÉCURITÉ :
 * - SUPABASE_SERVICE_ROLE_KEY ne vit que côté serveur (jamais bundlée,
 *   jamais loguée, jamais renvoyée au client).
 * - Si les variables d'env ne sont pas configurées, chaque opération échoue
 *   proprement avec STORAGE_NOT_CONFIGURED : les routes exposent un 503
 *   honnête plutôt qu'un succès simulé.
 * - Les buckets privés (delivery-proofs, service-files) ne sont lisibles que
 *   via ce client (service_role) ou une URL signée à durée limitée.
 */

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, '') ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export class StorageError extends Error {
  readonly code: 'STORAGE_NOT_CONFIGURED' | 'STORAGE_UPLOAD_FAILED' | 'STORAGE_SIGN_FAILED';
  constructor(code: StorageError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

export function isStorageConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SERVICE_ROLE_KEY.length > 0;
}

function assertConfigured(): void {
  if (!isStorageConfigured()) {
    throw new StorageError('STORAGE_NOT_CONFIGURED', 'Stockage non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants).');
  }
}

/** Envoie un fichier et vérifie la réponse HTTP réelle. */
export async function uploadObject(bucket: string, path: string, body: Buffer, contentType: string): Promise<void> {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': contentType, 'x-upsert': 'false' },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    // Le corps d'erreur peut contenir le path : on ne relaie que le statut.
    throw new StorageError('STORAGE_UPLOAD_FAILED', `Envoi impossible (stockage, HTTP ${res.status}).`);
  }
}

/** URL publique — réservée aux buckets publics (market-products, portfolio). */
export function publicObjectUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/** URL signée à durée limitée — accès contrôlé aux buckets privés. */
export async function signedObjectUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string> {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!res.ok) throw new StorageError('STORAGE_SIGN_FAILED', `Lien signé impossible (stockage, HTTP ${res.status}).`);
  const data = (await res.json()) as { signedURL?: string };
  if (!data.signedURL) throw new StorageError('STORAGE_SIGN_FAILED', 'Lien signé absent de la réponse.');
  return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}
