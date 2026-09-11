import bcrypt from 'bcryptjs';

/** Ne jamais créer de compte avec un mot de passe par défaut. */
export function adminSeedCredentials() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Renseignez ADMIN_EMAIL.');
  }
  let passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (passwordHash && !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(passwordHash)) {
    throw new Error('ADMIN_PASSWORD_HASH doit être un hash bcrypt valide.');
  }
  if (!passwordHash) {
    const password = process.env.ADMIN_PASSWORD;
    if (process.env.NODE_ENV === 'production' || !password || password.length < 12) {
      throw new Error('Définissez ADMIN_PASSWORD_HASH (ou ADMIN_PASSWORD de 12 caractères minimum en local).');
    }
    passwordHash = bcrypt.hashSync(password, 12);
  }
  return { email, passwordHash };
}
