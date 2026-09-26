import nodemailer from 'nodemailer';
import { FOUNDER_EMAIL } from './founder';

/**
 * Alerte e-mail à chaque nouvelle demande (Gmail SMTP).
 *
 * Variables (Vercel) :
 *   GMAIL_USER         adresse Gmail expéditrice (ex. amaeldorian06@gmail.com)
 *   GMAIL_APP_PASSWORD mot de passe d'application Google (16 caractères)
 *   NOTIFY_EMAIL       destinataire (optionnel, défaut : e-mail du fondateur)
 *
 * Best-effort : si les variables manquent ou si l'envoi échoue, la demande
 * reste enregistrée en base — l'alerte ne bloque jamais le client.
 */

export interface LeadAlert {
  leadCode: string;
  leadId: string;
  clientType: string | null;
  name: string | null;
  phone: string | null;
  need: string;
  serviceName: string | null;
  cityName: string;
  zoneName: string;
  deadline: string | null;
  budgetLabel: string | null;
  campaign: string | null;
  referrer: string | null;
  device: string | null;
}

export function isNotifyConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);
}

const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} F`;

export function budgetLabel(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${fcfa(min)} – ${fcfa(max)}`;
  if (max != null) return `moins de ${fcfa(max)}`;
  return `plus de ${fcfa(min as number)}`;
}

export function renderLeadAlert(a: LeadAlert, appUrl: string | null): { subject: string; text: string } {
  const who = [a.name, a.clientType].filter(Boolean).join(' · ') || 'client non identifié';
  const subject = `[Fika] Nouvelle demande ${a.leadCode} — ${a.serviceName ?? 'besoin libre'} (${who})`;
  const lines = [
    `Nouvelle demande ${a.leadCode}`,
    '',
    `Client   : ${a.name ?? '—'} (${a.clientType ?? 'type non précisé'})`,
    `WhatsApp : ${a.phone ?? '—'}${a.phone ? `  → https://wa.me/${a.phone.replace(/^\+/, '')}` : ''}`,
    `Lieu     : ${a.cityName} / ${a.zoneName}`,
    `Service  : ${a.serviceName ?? 'non précisé'}`,
    `Délai    : ${a.deadline ?? '—'}`,
    `Budget   : ${a.budgetLabel ?? '—'}`,
    `Source   : ${a.campaign ?? a.referrer ?? 'direct'}${a.device ? ` (${a.device})` : ''}`,
    '',
    'Besoin :',
    a.need,
    '',
    appUrl ? `Traiter : ${appUrl.replace(/\/$/, '')}/#/admin/leads` : 'Traiter dans l\'espace admin → Demandes.',
  ];
  return { subject, text: lines.join('\n') };
}

export async function sendLeadAlert(alert: LeadAlert): Promise<boolean> {
  if (!isNotifyConfigured()) return false;
  try {
    const transport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    const appUrl = process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
    const { subject, text } = renderLeadAlert(alert, appUrl);
    await transport.sendMail({
      from: `"Fika — demandes" <${process.env.GMAIL_USER}>`,
      to: process.env.NOTIFY_EMAIL ?? FOUNDER_EMAIL,
      subject,
      text,
    });
    return true;
  } catch (error) {
    console.warn('[notify] Alerte e-mail non envoyée :', error instanceof Error ? error.message : 'erreur');
    return false;
  }
}
