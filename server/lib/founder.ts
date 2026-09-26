import * as bcrypt from 'bcryptjs';

/** Identifiant unique. Aucun mot de passe en clair ; aucun accès DB pour l'auth. */
export const FOUNDER_EMAIL = 'fika@admin2027';
export const FOUNDER_ID = 'fika-owner-v2';
const PASSWORD_HASH = '$2b$12$B5PhzonGK7xL3yZWbLC1OOHhEcHF.B7JXnAU3I1bHXSY97hygzWeW';
export function founderPasswordHash(): string { return PASSWORD_HASH; }
export function isFounderEmail(value: string): boolean {
  return value.trim().toLowerCase() === FOUNDER_EMAIL;
}
export async function isFounderPassword(password: string): Promise<boolean> {
  return bcrypt.compare(password, PASSWORD_HASH);
}
