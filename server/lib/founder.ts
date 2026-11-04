import * as bcrypt from 'bcryptjs';

/** Identifiant unique. Aucun mot de passe en clair ; aucun accès DB pour l'auth. */
export const FOUNDER_EMAIL = 'fika@admin2027';
export const FOUNDER_ID = 'fika-owner-v2';
// Hash bcrypt (12 tours) du mot de passe choisi par le fondateur le 04/11/2026.
// Rotation effectuée car l'ancien mot de passe était égaré ; l'ancien hash est
// définitivement remplacé (aucun mot de passe en clair dans le dépôt).
const PASSWORD_HASH = '$2b$12$GL1eGc7Rn7Qp4xewkEkWs.f86sru9YienWSQQHsXWpltQEQzrsHvy';
export function founderPasswordHash(): string { return PASSWORD_HASH; }
export function isFounderEmail(value: string): boolean {
  return value.trim().toLowerCase() === FOUNDER_EMAIL;
}
export async function isFounderPassword(password: string): Promise<boolean> {
  return bcrypt.compare(password, PASSWORD_HASH);
}
