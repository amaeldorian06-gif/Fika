/**
 * Test d'envoi réel d'une alerte e-mail — même chaîne que la production
 * (nodemailer Gmail SMTP, expéditeur GMAIL_USER, destinataire NOTIFY_EMAIL).
 *
 * Usage : npx tsx scripts/test-alert-email.mts
 * Prérequis : GMAIL_APP_PASSWORD renseigné dans .env (16 caractères,
 * généré depuis le compte Google → Sécurité → Validation en 2 étapes →
 * Mots de passe d'application). Sans lui : aucun e-mail ne part, aucun test
 * fiable n'est possible — on ne simule jamais un envoi.
 */
import nodemailer from 'nodemailer';
import 'dotenv/config';

async function main() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = process.env.NOTIFY_EMAIL ?? 'hello1247778@gmail.com';
  console.log(`Expéditeur  : ${user ?? '(absent)'}`);
  console.log(`Destinataire : ${to}`);
  console.log(`Mot de passe d'application : ${pass ? `défini (${pass.length} car.)` : 'ABSENT'}`);
  if (!user || !pass) {
    console.error('\n✗ Envoi impossible : GMAIL_APP_PASSWORD manquant dans .env.');
    console.error('  Générer le mot de passe : compte Google → Sécurité → Validation en');
    console.error('  deux étapes → Mots de passe d\'application (16 caractères), puis le');
    console.error('  renseigner dans .env (local) et dans les variables Vercel (production).');
    process.exit(1);
  }
  try {
    const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    // verify() : nodemailer ouvre la connexion et s'authentifie SANS envoyer —
    // distingue un mot de passe invalide d'un autre problème (réseau, quota…).
    try {
      await transport.verify();
      console.log('✓ Connexion SMTP Gmail vérifiée (identifiants acceptés)');
    } catch (error) {
      console.error('\n✗ Connexion refusée par Gmail :', error instanceof Error ? error.message : error);
      console.error('  → Vérifiez GMAIL_APP_PASSWORD (mot de passe d’application 16 car., pas le mot de passe du compte).');
      process.exit(1);
    }
    await transport.sendMail({
      from: `"Fika — test alertes" <${user}>`,
      to,
      subject: '[TEST] Fika — alertes en temps réel opérationnelles',
      text: [
        'Ceci est un e-mail de test envoyé depuis scripts/test-alert-email.mts.',
        '',
        'Si vous le lisez, la chaîne d’alerte fonctionne :',
        '— nouvelle demande de service  → alerte immédiate',
        '— validation d’une commande Fika Market → alerte immédiate',
        '',
        'Destinataire des alertes : ' + to,
        'Aucune action requise.',
      ].join('\n'),
    });
    console.log('\n✓ E-mail de test envoyé — vérifiez la boîte ' + to + ' (et les spams).');
  } catch (error) {
    console.error('\n✗ Échec d’envoi :', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().finally(() => process.exit(0));
