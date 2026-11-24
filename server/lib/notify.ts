import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Notifications opérationnelles Fika.
 *
 * Tous les événements métier créés côté serveur passent par ce module :
 * - nouvelle demande Fika Services ;
 * - nouvelle commande Fika Services (conversion d'une demande) ;
 * - nouvelle commande Fika Market.
 *
 * Variables Vercel : GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_EMAIL, APP_URL.
 * Le mot de passe d'application Gmail peut être copié avec des espaces :
 * ils sont supprimés avant l'authentification.
 *
 * Un échec d'e-mail ne doit jamais annuler une commande déjà enregistrée.
 * Chaque échec est cependant journalisé sans secret ni donnée client.
 */

const NOTIFY_RECIPIENT_DEFAULT = 'amaeldorian06@gmail.com';

export function notifyRecipient(env: NodeJS.ProcessEnv = process.env): string {
  return env.NOTIFY_EMAIL?.trim() || NOTIFY_RECIPIENT_DEFAULT;
}

const cleanPassword = (value: string | undefined): string => (value ?? '').replace(/\s+/g, '');

/**
 * Réglages SMTP effectifs. Deux modes, le mode explicite étant prioritaire :
 *
 *   1. SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS — port 587 :
 *      STARTTLS (secure:false, la connexion est mise à niveau en TLS) ; port
 *      465 : TLS direct (secure:true). Incohérence port/secure détectée et
 *      corrigée, puis signalée à l'admin.
 *   2. Gmail (service:'gmail') via GMAIL_USER / GMAIL_APP_PASSWORD — repli
 *      conservé pour les déploiements existants.
 */
export interface SmtpSettings {
  mode: 'smtp' | 'gmail' | 'aucun';
  host: string | null;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  warnings: string[];
}

export function smtpSettings(env: NodeJS.ProcessEnv = process.env): SmtpSettings {
  const warnings: string[] = [];
  const genericUser = env.SMTP_USER?.trim();
  const genericPass = cleanPassword(env.SMTP_PASS);
  if (genericUser && genericPass) {
    const host = env.SMTP_HOST?.trim() || 'smtp.gmail.com';
    const port = Number(env.SMTP_PORT ?? 587) || 587;
    let secure = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465;
    if (port === 587 && secure) {
      warnings.push('SMTP_SECURE=true sur le port 587 : STARTTLS n’est plus utilisé. Omettez SMTP_SECURE ou passez-le à false.');
      secure = false;
    }
    if (port === 465 && !secure) {
      warnings.push('Port 465 sans SMTP_SECURE=true : la connexion ne serait pas chiffrée dès l’ouverture.');
      secure = true;
    }
    return { mode: 'smtp', host, port, secure, user: genericUser, pass: genericPass, warnings };
  }
  const gmailUser = env.GMAIL_USER?.trim();
  const gmailPass = cleanPassword(env.GMAIL_APP_PASSWORD);
  if (gmailUser && gmailPass) {
    return { mode: 'gmail', host: 'smtp.gmail.com', port: 587, secure: false, user: gmailUser, pass: gmailPass, warnings };
  }
  return { mode: 'aucun', host: null, port: 587, secure: false, user: null, pass: null, warnings };
}

export function isNotifyConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return smtpSettings(env).mode !== 'aucun';
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
  intent?: string | null;
  productName?: string | null;
  productLink?: string | null;
  quantity?: number | null;
}

export interface ServiceOrderAlert {
  orderNumber: string;
  leadCode: string;
  name: string | null;
  phone: string | null;
  serviceName: string;
  cityName: string;
  zoneName: string;
  description: string;
}

export interface MarketOrderAlert {
  orderNumber: string;
  name: string;
  phone: string;
  zoneName: string;
  address: string | null;
  notes: string | null;
  items: { productName: string; variantLabel: string | null; quantity: number; unitPrice: number | null }[];
  /** Σ prix catalogue × quantité — indicatif, le prix final est confirmé avec le client. */
  totalIndicatif: number | null;
}

const fcfa = (n: number) => n.toLocaleString('fr-FR') + ' F';
const whatsAppLink = (phone: string | null) => phone ? 'https://wa.me/' + phone.replace(/^\+/, '') : null;
const adminUrl = (path: string): string | null => {
  const base = process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : null);
  return base ? base.replace(/\/$/, '') + path : null;
};

export function budgetLabel(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return fcfa(min) + ' – ' + fcfa(max);
  if (max != null) return 'moins de ' + fcfa(max);
  return 'plus de ' + fcfa(min as number);
}

export function renderLeadAlert(a: LeadAlert, appUrl: string | null): { subject: string; text: string } {
  const who = [a.name, a.clientType].filter(Boolean).join(' · ') || 'client non identifié';
  const subject = '[Fika Services] Nouvelle demande ' + a.leadCode + ' — ' + (a.serviceName ?? 'besoin libre') + ' (' + who + ')';
  const lines = [
    'Nouvelle demande Fika Services ' + a.leadCode,
    '',
    'Client   : ' + (a.name ?? '—') + ' (' + (a.clientType ?? 'type non précisé') + ')',
    'WhatsApp : ' + (a.phone ?? '—') + (whatsAppLink(a.phone) ? '  → ' + whatsAppLink(a.phone) : ''),
    'Lieu     : ' + a.cityName + ' / ' + a.zoneName,
    'Service  : ' + (a.serviceName ?? 'non précisé'),
    ...(a.intent === 'PRODUCT' ? ['Produit demandé : ' + (a.productName ?? 'non précisé'), 'Quantité : ' + (a.quantity ?? '—'), ...(a.productLink ? ['Lien produit : ' + a.productLink] : [])] : []),
    'Délai    : ' + (a.deadline ?? '—'),
    'Budget   : ' + (a.budgetLabel ?? '—'),
    'Source   : ' + (a.campaign ?? a.referrer ?? 'direct') + (a.device ? ' (' + a.device + ')' : ''),
    '',
    'Besoin :',
    a.need,
    '',
    appUrl ? 'Traiter : ' + appUrl.replace(/\/$/, '') + '/admin/leads' : "Traiter dans l'espace admin → Demandes.",
  ];
  return { subject, text: lines.join('\n') };
}

export function renderServiceOrderAlert(a: ServiceOrderAlert, appUrl: string | null): { subject: string; text: string } {
  const subject = '[Fika Services] Nouvelle commande ' + a.orderNumber + ' — ' + (a.name ?? 'client à identifier');
  const lines = [
    'Nouvelle commande Fika Services ' + a.orderNumber,
    'Issue de la demande ' + a.leadCode,
    '',
    'Client   : ' + (a.name ?? '—'),
    'WhatsApp : ' + (a.phone ?? '—') + (whatsAppLink(a.phone) ? '  → ' + whatsAppLink(a.phone) : ''),
    'Lieu     : ' + a.cityName + ' / ' + a.zoneName,
    'Prestation : ' + a.serviceName,
    '',
    'Besoin initial :',
    a.description,
    '',
    appUrl ? 'Traiter : ' + appUrl.replace(/\/$/, '') + '/admin/orders' : "Traiter dans l'espace admin → Commandes Services.",
  ];
  return { subject, text: lines.join('\n') };
}

export function renderMarketOrderAlert(a: MarketOrderAlert, appUrl: string | null): { subject: string; text: string } {
  const subject = '[Fika Market] Nouvelle commande ' + a.orderNumber + ' — ' + a.name;
  const lines: string[] = [
    'Nouvelle commande Fika Market ' + a.orderNumber,
    '',
    'Client   : ' + a.name,
    'WhatsApp : ' + a.phone + '  → https://wa.me/' + a.phone.replace(/^\+/, ''),
    'Lieu     : ' + a.zoneName + (a.address ? ' — ' + a.address : ''),
    '',
    'Articles :',
    ...a.items.map((i) => '  · ' + i.productName + (i.variantLabel ? ' (' + i.variantLabel + ')' : '') + ' ×' + i.quantity + (i.unitPrice != null ? ' — ' + fcfa(i.unitPrice) + " l'unité" : '')),
  ];
  if (a.totalIndicatif != null) {
    lines.push('', 'Total indicatif : ' + fcfa(a.totalIndicatif) + ' — prix final confirmé avec le client avant tout paiement.');
  }
  if (a.notes) lines.push('', 'Notes du client : ' + a.notes);
  lines.push('', appUrl ? 'Traiter : ' + appUrl.replace(/\/$/, '') + '/admin/market/orders' : "Traiter dans l'espace admin → Fika Market → Commandes.");
  return { subject, text: lines.join('\n') };
}

/* ------------------------- Transport Gmail partagé ------------------------- */

let sharedTransport: Transporter | null = null;

let sharedSettingsKey: string | null = null;

function getTransporter(): Transporter | null {
  const settings = smtpSettings();
  if (settings.mode === 'aucun' || !settings.user || !settings.pass) return null;
  const key = settings.mode + ':' + settings.host + ':' + settings.port + ':' + settings.secure + ':' + settings.user;
  if (!sharedTransport || sharedSettingsKey !== key) {
    const timeouts = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 };
    sharedTransport = settings.mode === 'gmail'
      ? nodemailer.createTransport({ service: 'gmail', auth: { user: settings.user, pass: settings.pass }, ...timeouts })
      : nodemailer.createTransport({
        host: settings.host ?? 'smtp.gmail.com',
        port: settings.port,
        secure: settings.secure, // false → STARTTLS
        auth: { user: settings.user, pass: settings.pass },
        ...timeouts,
      });
    sharedSettingsKey = key;
  }
  return sharedTransport;
}

type DispatchResult =
  | { ok: true; messageId: string }
  | { ok: false; status: 'NOT_CONFIGURED' | 'RECIPIENT_REJECTED' | 'SMTP_ERROR' };

function acceptedRecipientMatches(accepted: unknown[], recipient: string): boolean {
  return accepted.some((entry) => {
    if (typeof entry === 'string') return entry.trim().toLowerCase() === recipient.toLowerCase();
    if (entry && typeof entry === 'object' && 'address' in entry) {
      const address = (entry as { address?: unknown }).address;
      return typeof address === 'string' && address.trim().toLowerCase() === recipient.toLowerCase();
    }
    return false;
  });
}

async function sendGmail(event: string, fromName: string, subject: string, text: string): Promise<DispatchResult> {
  const user = smtpSettings().user;
  const recipient = notifyRecipient();
  const transport = getTransporter();

  if (!transport || !user) {
    console.error('[notify] email non envoyé : configuration Gmail manquante', { event });
    return { ok: false, status: 'NOT_CONFIGURED' };
  }

  try {
    const info = await transport.sendMail({
      from: '"' + fromName + '" <' + user + '>',
      to: recipient,
      subject,
      text,
    });
    const accepted = Array.isArray(info.accepted) ? info.accepted as unknown[] : [];
    if (!acceptedRecipientMatches(accepted, recipient)) {
      console.error('[notify] email refusé par le serveur SMTP', {
        event,
        rejectedCount: Array.isArray(info.rejected) ? info.rejected.length : 0,
      });
      return { ok: false, status: 'RECIPIENT_REJECTED' };
    }
    const messageId = typeof info.messageId === 'string' ? info.messageId : '';
    console.info('[notify] email accepté par SMTP', { event, messageId });
    return { ok: true, messageId };
  } catch (error) {
    const details = error && typeof error === 'object' ? error as { code?: unknown; responseCode?: unknown; command?: unknown } : {};
    console.error('[notify] erreur SMTP', {
      event,
      code: typeof details.code === 'string' ? details.code : 'UNKNOWN',
      responseCode: typeof details.responseCode === 'number' ? details.responseCode : null,
      command: typeof details.command === 'string' ? details.command : null,
    });
    return { ok: false, status: 'SMTP_ERROR' };
  }
}

async function sendNotification(kind: 'lead' | 'service-order' | 'market-order', fromName: string, rendered: { subject: string; text: string }): Promise<boolean> {
  const result = await sendGmail(kind, fromName, rendered.subject, rendered.text);
  return result.ok;
}

export function getNotificationStatus(): {
  configured: boolean;
  provider: 'Gmail SMTP' | 'SMTP';
  sender: string | null;
  recipient: string;
  /** Mode et paramètres de connexion (aucun secret exposé). */
  mode: SmtpSettings['mode'];
  host: string | null;
  port: number;
  secure: boolean;
  warnings: string[];
} {
  const settings = smtpSettings();
  return {
    configured: settings.mode !== 'aucun',
    provider: settings.mode === 'smtp' ? 'SMTP' : 'Gmail SMTP',
    sender: settings.user,
    recipient: notifyRecipient(),
    mode: settings.mode,
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    warnings: settings.warnings,
  };
}

/**
 * Appelé depuis le back-office authentifié. Vérifie d'abord l'authentification
 * SMTP puis expédie un message réel ; aucune réussite n'est simulée.
 */
export async function sendNotificationTest(): Promise<{
  ok: boolean;
  status: 'ACCEPTED' | 'NOT_CONFIGURED' | 'SMTP_AUTH_FAILED' | 'SMTP_SEND_FAILED';
  message: string;
  recipient: string;
}> {
  const recipient = notifyRecipient();
  const transport = getTransporter();
  if (!transport) {
    console.error('[notify] test email impossible : configuration Gmail manquante');
    return { ok: false, status: 'NOT_CONFIGURED', message: 'Configuration Gmail incomplète. Vérifiez GMAIL_USER et GMAIL_APP_PASSWORD dans Vercel.', recipient };
  }
  try {
    await transport.verify();
  } catch (error) {
    const details = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : {};
    const code = typeof details.code === 'string' ? details.code : 'UNKNOWN';
    console.error('[notify] authentification SMTP refusée', { code });
    // Traduction des codes nodemailer (EAUTH / ECONNECTION / ETIMEDOUT…).
    const message = code === 'EAUTH'
      ? 'Le serveur refuse l’authentification. Vérifiez SMTP_USER / SMTP_PASS (ou le mot de passe d’application Google, jamais le mot de passe du compte).'
      : code === 'ECONNECTION' || code === 'ETIMEDOUT'
        ? 'Le serveur SMTP est injoignable — erreur réseau, réessayez plus tard (vérifiez l’hôte et le port).'
        : 'La vérification de la connexion SMTP a échoué (' + code + ').';
    return { ok: false, status: 'SMTP_AUTH_FAILED', message, recipient };
  }

  const result = await sendGmail(
    'test',
    'Fika — test alertes',
    '[TEST] Fika — alertes opérationnelles',
    [
      'Ceci est un test réel du système de notifications Fika.',
      '',
      'Les événements couverts sont :',
      '1. Nouvelle demande Fika Services.',
      '2. Nouvelle commande Fika Services (conversion d’une demande).',
      '3. Nouvelle commande Fika Market.',
      '',
      'Le serveur SMTP a accepté ce message pour : ' + recipient,
    ].join('\n'),
  );
  if (!result.ok) {
    return { ok: false, status: 'SMTP_SEND_FAILED', message: 'Gmail est joignable mais n’a pas accepté le message. Consultez les logs Vercel.', recipient };
  }
  return { ok: true, status: 'ACCEPTED', message: 'Gmail a accepté le message de test. Vérifiez la boîte de réception et les spams.', recipient };
}

export async function sendLeadAlert(alert: LeadAlert): Promise<boolean> {
  return sendNotification('lead', 'Fika — demandes', renderLeadAlert(alert, adminUrl('')));
}

export async function sendServiceOrderAlert(alert: ServiceOrderAlert): Promise<boolean> {
  return sendNotification('service-order', 'Fika Services', renderServiceOrderAlert(alert, adminUrl('')));
}

export async function sendMarketOrderAlert(alert: MarketOrderAlert): Promise<boolean> {
  return sendNotification('market-order', 'Fika Market', renderMarketOrderAlert(alert, adminUrl('')));
}
