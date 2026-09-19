import * as bcrypt from 'bcryptjs';

/**
 * Compte fondateur — administrateur unique de Fika.
 *
 * L'e-mail est public ; le mot de passe n'apparaît JAMAIS en clair :
 * seul son hash bcrypt (coût 12) est stocké ici. Il est impossible de
 * retrouver le mot de passe à partir du hash, même avec le code source.
 *
 * Pour changer le mot de passe sans toucher au code : générer un nouveau hash
 *   node -e "console.log(require('bcryptjs').hashSync('NOUVEAU', 12))"
 * puis définir la variable d'environnement FOUNDER_PASSWORD_HASH (Vercel →
 * Settings → Environment Variables) et redéployer. À défaut, remplacer la
 * constante par défaut ci-dessous.
 */
export const FOUNDER_EMAIL = 'amaeldorian06@gmail.com';
const DEFAULT_FOUNDER_PASSWORD_HASH = '$2b$12$HmNbkdZsmi.8s22dzWHphOuxPIJRFgJ0FtZ.4uxN0yKNZkFdhv3vS';
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function founderPasswordHash(): string {
  const fromEnv = process.env.FOUNDER_PASSWORD_HASH?.trim();
  return fromEnv && BCRYPT_HASH.test(fromEnv) ? fromEnv : DEFAULT_FOUNDER_PASSWORD_HASH;
}

export function isFounderEmail(email: string): boolean {
  return email.trim().toLowerCase() === FOUNDER_EMAIL;
}

export async function isFounderPassword(password: string): Promise<boolean> {
  return bcrypt.compare(password, founderPasswordHash());
}
