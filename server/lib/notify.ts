import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Alertes e-mail Gmail SMTP : nouvelle demande de service, nouvelle commande
 * Fika Market.
 *
 * Variables (Vercel) :
 *   GMAIL_USER         adresse Gmail expéditrice (ex. amaeldorian06@gmail.com)
 *   GMAIL_APP_PASSWORD mot de passe d'application Google (16 caractères)
 *   NOTIFY_EMAIL       destinataire (optionnel, défaut ci-dessous)
 *
 * Ne pas confondre les trois adresses : le compte expéditeur (GMAIL_USER),
 * le destinataire des alertes (NOTIFY_EMAIL, défaut NOTIFY_RECIPIENT_DEFAULT)
 * et l'identifiant de connexion admin (aucun rapport avec le courriel).
 *
 * Best-effort : si les variables manquent ou si l'envoi échoue, la demande ou
 * la commande reste enregistrée en base — l'alerte ne bloque jamais le client.
 */

/** Destinataire des alertes opérationnelles (demandes + commandes). */
const NOTIFY_RECIPIENT_DEFAULT = 'hello1247778@gmail.com';

/** Résolution du destinataire (séparée de l'envoi pour être testable). */
export function notifyRecipient(env: NodeJS.ProcessEnv = process.env): string {
  return env.NOTIFY_EMAIL ?? NOTIFY_RECIPIENT_DEFAULT;
}

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
    appUrl ? `Traiter : ${appUrl.replace(/\/$/, '')}/admin/leads` : 'Traiter dans l\'espace admin → Demandes.',
  ];
  return { subject, text: lines.join('\n') };
}

/* ------------------------- Commande Fika Market ---------------------------- */

export interface MarketOrderAlert {
  orderNumber: string;
  name: string;
  phone: string; // E.164
  zoneName: string;
  address: string | null;
  notes: string | null;
  items: { productName: string; variantLabel: string | null; quantity: number; unitPrice: number | null }[];
  /** Σ prix catalogue × quantité — indicatif, le prix final est confirmé avec le client. */
  totalIndicatif: number | null;
}

export function renderMarketOrderAlert(a: MarketOrderAlert, appUrl: string | null): { subject: string; text: string } {
  const subject = `[Fika Market] Nouvelle commande ${a.orderNumber} — ${a.name}`;
  const lines: string[] = [
    `Nouvelle commande ${a.orderNumber}`,
    '',
    `Client   : ${a.name}`,
    `WhatsApp : ${a.phone}  → https://wa.me/${a.phone.replace(/^\+/, '')}`,
    `Lieu     : ${a.zoneName}${a.address ? ` — ${a.address}` : ''}`,
    '',
    'Articles :',
    ...a.items.map((i) => `  · ${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ''} ×${i.quantity}${i.unitPrice != null ? ` — ${fcfa(i.unitPrice)} l'unité` : ''}`),
  ];
  if (a.totalIndicatif != null) {
    lines.push('', `Total indicatif : ${fcfa(a.totalIndicatif)} — prix final confirmé avec le client avant tout paiement.`);
  }
  if (a.notes) lines.push('', `Notes du client : ${a.notes}`);
  lines.push('', appUrl ? `Traiter : ${appUrl.replace(/\/$/, '')}/admin/market/orders` : 'Traiter dans l\'espace admin → Fika Market → Commandes.');
  return { subject, text: lines.join('\n') };
}

/* ------------------------------ Envoi commun ------------------------------- */

/**
 * Transporteur SMTP Gmail réutilisé pour tous les envois — recommandation
 * nodemailer : créer le transporteur UNE fois (chaque instance neuve ouvre
 * des connexions et s'authentifie à nouveau ; gaspillage de ressources).
 * Créé paresseusement au premier envoi réel ; les variables d'environnement
 * ne changent pas sans redémarrage du serveur.
 */
let sharedTransport: Transporter | null = null;
function getTransporter(env: NodeJS.ProcessEnv = process.env): Transporter | null {
  if (!(env.GMAIL_USER && env.GMAIL_APP_PASSWORD)) return null;
  if (!sharedTransport) {
    sharedTransport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
    });
  }
  return sharedTransport;
}

async function sendGmail(fromName: string, subject: string, text: string): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) return false;
  try {
    await transport.sendMail({
      from: `"${fromName}" <${process.env.GMAIL_USER}>`,
      to: notifyRecipient(),
      subject,
      text,
    });
    return true;
  } catch (error) {
    console.warn('[notify] Alerte e-mail non envoyée :', error instanceof Error ? error.message : 'erreur');
    return false;
  }
}

export async function sendLeadAlert(alert: LeadAlert): Promise<boolean> {
  const appUrl = process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  const { subject, text } = renderLeadAlert(alert, appUrl);
  return sendGmail('Fika — demandes', subject, text);
}

export async function sendMarketOrderAlert(alert: MarketOrderAlert): Promise<boolean> {
  const appUrl = process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  const { subject, text } = renderMarketOrderAlert(alert, appUrl);
  return sendGmail('Fika Market', subject, text);
}
