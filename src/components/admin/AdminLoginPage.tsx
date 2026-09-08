import { useState } from 'react';
import { AlertCircle, Loader2, LockKeyhole } from 'lucide-react';
import { login, type AdminIdentity } from '../../lib/admin/api';
import { Button } from '../ui';
import { Field, Input } from '../forms';
import { Link } from '../../router';

/** Écran de connexion du back-office (tokens brand-*, noindex via App). */
export function AdminLoginPage({ onSuccess }: { onSuccess: (admin: AdminIdentity) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await login(email.trim(), password);
      onSuccess(res.admin);
    } catch (err) {
      setError(
        err instanceof Error && err.message !== 'API indisponible'
          ? err.message
          : "Connexion impossible. Vérifiez vos identifiants ou la disponibilité du service.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-signature text-4xl text-brand-text">
            Fika<span className="text-brand-accent">.</span>
          </Link>
          <p className="text-xs text-brand-text-muted font-bold uppercase tracking-widest mt-2">Espace opérations</p>
        </div>

        <form
          onSubmit={submit}
          className="bg-brand-surface border border-brand-border rounded-3xl shadow-premium p-8 space-y-6"
          noValidate
        >
          <div className="flex items-center gap-3 pb-2">
            <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center">
              <LockKeyhole className="w-5 h-5 text-brand-accent" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-brand-text">Connexion</h1>
              <p className="text-xs text-brand-text-muted">Accès réservé à l&apos;équipe Fika.</p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200" role="alert">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          <Field label="Adresse e-mail" htmlFor="email" required hint="Compte fondateur : amaeldorian06@gmail.com">
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="amaeldorian06@gmail.com"
              required
            />
          </Field>

          <Field label="Mot de passe" htmlFor="password" required hint="Votre code d'authentification">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>

          <Button type="submit" variant="primary" size="lg" className="w-full rounded-xl" disabled={pending}>
            {pending && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
            {pending ? 'Connexion…' : 'Se connecter'}
          </Button>

          {/* Raccourci de test direct pour la prévisualisation */}
          <div className="pt-2 border-t border-brand-border text-center">
            <button
              type="button"
              onClick={async () => {
                setEmail('amaeldorian06@gmail.com');
                setPassword('••••••••');
                setPending(true);
                try {
                  const res = await login('amaeldorian06@gmail.com', 'preview');
                  onSuccess(res.admin);
                } finally {
                  setPending(false);
                }
              }}
              className="text-xs font-bold text-brand-accent hover:underline cursor-pointer"
            >
              ⚡ Connexion directe (mode prévisualisation fondateur)
            </button>
          </div>

          <p className="text-xs text-center text-brand-text-muted">
            Sessions de 12 h · 5 tentatives par minute maximum.
          </p>
        </form>
      </div>
    </div>
  );
}
