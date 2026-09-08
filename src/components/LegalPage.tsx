import { ArrowLeft, FileWarning, Scale } from 'lucide-react';
import { Link } from '../router';
import { SITE_CITY, SITE_NAME, SITE_URL, WHATSAPP_PHONE_E164 } from '../lib/site';

export type LegalKind = 'mentions-legales' | 'cgv' | 'confidentialite';

const TITLES: Record<LegalKind, string> = {
  'mentions-legales': 'Mentions légales',
  cgv: 'Conditions Générales de Vente',
  confidentialite: 'Politique de confidentialité',
};

/** Bandeau permanent : les textes sont des modèles à valider juridiquement. */
function LegalReviewBanner() {
  return (
    <div className="flex items-start gap-3 p-4 mb-8 rounded-2xl bg-amber-50 border border-amber-200">
      <Scale className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
      <p className="text-xs leading-relaxed text-amber-800 font-medium">
        <strong className="font-heading font-bold">Modèles à faire valider par un conseil juridique avant mise en ligne.</strong>{' '}
        Ces textes couvrent les clauses usuelles du commerce électronique au Cameroun ; ils ne constituent pas un avis juridique.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-9">
      <h2 className="font-heading text-xl font-bold text-brand-text mb-3">{title}</h2>
      <div className="text-sm text-brand-text-muted leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

/** Placeholder explicite pour toute donnée d'enregistrement réelle. */
function PendingNote({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex items-start gap-3 p-4 mb-8 rounded-2xl bg-brand-bg border border-brand-border text-brand-text-muted">
      <FileWarning className="w-5 h-5 shrink-0 mt-0.5 text-brand-accent" />
      <p className="text-xs leading-relaxed">
        <strong className="font-heading font-bold text-brand-text">Informations d&apos;enregistrement à compléter :</strong>{' '}
        {items.join(' · ')}. Ces champs ne peuvent être remplis que par le fondateur ; aucune valeur n&apos;est pré-remplie.
      </p>
    </div>
  );
}

/** Lien interne vers une page légale. */
function LegalLink({ to, children }: { to: LegalKind; children: React.ReactNode }) {
  return (
    <Link to={`/${to}`} className="font-semibold text-brand-accent hover:underline">
      {children}
    </Link>
  );
}

export function LegalPage({ kind }: { kind: LegalKind }) {
  const isMentions = kind === 'mentions-legales';
  const isPrivacy = kind === 'confidentialite';

  const pending = isMentions
    ? [
        'forme juridique exacte', 'numéro RCCM', 'numéro NIU (contribuable)',
        'adresse du siège social', 'e-mail officiel', 'identité du directeur de la publication',
        'société d\u2019hébergement (dénomination, adresse, téléphone)',
      ]
    : isPrivacy
    ? ['coordonnées complètes du responsable de traitement', 'durée exacte validée par le conseil']
    : [
        'modalités de paiement détaillées (acompte / solde, moyens acceptés)',
        'délai de réclamation après livraison',
        'barème de garantie / reprise',
      ];

  return (
    <div className="min-h-screen pt-8 pb-16 bg-brand-bg">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center text-sm text-brand-text-muted hover:text-brand-accent mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour à l&apos;accueil
        </Link>

        <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-4 text-brand-text">{TITLES[kind]}</h1>
        <p className="text-brand-text-muted mb-8 text-sm">
          Dernière mise à jour : 8 janvier 2026 · Édité par {SITE_NAME}, {SITE_CITY} (Cameroun)
        </p>

        <LegalReviewBanner />
        <PendingNote items={pending} />

        {isMentions && (
          <>
            <Section title="1. Éditeur du site">
              <p>
                Le site <strong className="text-brand-text">{SITE_URL.replace('https://', '')}</strong> est édité par{' '}
                <strong className="text-brand-text">{SITE_NAME}</strong>, agence orchestratrice de services numériques,
                techniques et pratiques, sise à {SITE_CITY} (Région de l&apos;Adamaoua, Cameroun).
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Forme juridique : <em>TODO_PROD</em></li>
                <li>Registre du Commerce et du Crédit Mobilier (RCCM) : <em>TODO_PROD</em></li>
                <li>Numéro d&apos;Identification Unique des Contribuables (NIU) : <em>TODO_PROD</em></li>
                <li>Siège social : <em>TODO_PROD</em>, {SITE_CITY}, Cameroun</li>
                <li>Téléphone / WhatsApp : <a href={`https://wa.me/${WHATSAPP_PHONE_E164.replace(/^\+/, '')}`} className="text-brand-wa font-bold hover:underline">{WHATSAPP_PHONE_E164}</a></li>
                <li>E-mail : <em>TODO_PROD</em></li>
              </ul>
            </Section>

            <Section title="2. Directeur de la publication">
              <p>Directeur de la publication : <em>TODO_PROD</em> (fondateur de {SITE_NAME}).</p>
            </Section>

            <Section title="3. Hébergement">
              <p>
                Le site est hébergé par : <em>TODO_PROD</em> (dénomination sociale, adresse postale, téléphone).
                Ces informations seront renseignées dès le déploiement en production.
              </p>
            </Section>

            <Section title="4. Propriété intellectuelle">
              <p>
                L&apos;ensemble des éléments du site — marque « {SITE_NAME} », logotype, charte graphique, textes,
                visuels de marque, documentation tarifaire — est la propriété exclusive de {SITE_NAME} ou fait
                l&apos;objet d&apos;une autorisation d&apos;utilisation. Toute reproduction, représentation, adaptation
                ou exploitation, totale ou partielle, sans autorisation écrite préalable est interdite.
              </p>
              <p>
                Les éléments fournis par les clients (logos, textes, images, documents) restent leur propriété ;
                {SITE_NAME} n&apos;y acquiert aucun droit au-delà de ce qui est nécessaire à l&apos;exécution des prestations.
                Les droits sur les livrables sont cédés au client après paiement complet (voir nos{' '}
                <LegalLink to="cgv">CGV</LegalLink>).
              </p>
            </Section>

            <Section title="5. Nature du service — agence orchestratrice">
              <p>
                {SITE_NAME} n&apos;est pas une place de marché : le client contracte exclusivement avec {SITE_NAME},
                qui sélectionne les prestataires compétents, suit l&apos;exécution et reste l&apos;unique interlocuteur
                du client. Les experts partenaires agissent pour le compte de {SITE_NAME} et n&apos;entrent jamais en
                relation contractuelle directe avec le client.
              </p>
            </Section>

            <Section title="6. Liens externes">
              <p>
                Les liens de contact renvoient vers le service WhatsApp (wa.me, exploité par WhatsApp Ireland Ltd).
                {SITE_NAME} n&apos;est pas responsable des conditions d&apos;utilisation ni du traitement des données par
                ce service tiers, dont la politique propre s&apos;applique.
              </p>
            </Section>

            <Section title="7. Droit applicable et juridiction">
              <p>
                Le site et les relations contractuelles sont soumis au droit camerounais, complété le cas échéant par
                le droit uniforme OHADA (notamment l&apos;Acte uniforme relatif au droit commercial général). En cas de
                litige, une solution amiable sera d&apos;abord recherchée ; à défaut, les tribunaux compétents de{' '}
                {SITE_CITY} seront saisis.
              </p>
            </Section>

            <Section title="8. Crédits">
              <p>
                Conception et développement : {SITE_NAME}. Icônes : Lucide (licence ISC). Typographies : Plus Jakarta Sans,
                Inter, Playfair Display, Caveat (licences SIL Open Font License).
              </p>
            </Section>
          </>
        )}

        {isPrivacy && (
          <>
            <Section title="1. Responsable du traitement">
              <p>
                Le responsable du traitement est <strong className="text-brand-text">{SITE_NAME}</strong>,{' '}
                {SITE_CITY} (Cameroun) — RCCM <em>TODO_PROD</em>, NIU <em>TODO_PROD</em>.
                Contact pour toute question relative à vos données : WhatsApp au{' '}
                <a href={`https://wa.me/${WHATSAPP_PHONE_E164.replace(/^\+/, '')}`} className="text-brand-wa font-bold hover:underline">{WHATSAPP_PHONE_E164}</a>.
              </p>
              <p>
                Le traitement est encadré par la <strong className="text-brand-text">loi n° 2024/017 du 23 décembre 2024
                régissant la protection des données à caractère personnel</strong> et, pour les échanges avec des
                partenaires étrangers, par les garanties appropriées de transfert.
              </p>
            </Section>

            <Section title="2. Données collectées">
              <p>Le site ne propose ni compte client public, ni publicité, ni outil de suivi tiers. Les données sont limitées :</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-brand-text">Identité et contact</strong> : nom (optionnel), numéro de téléphone WhatsApp ;</li>
                <li><strong className="text-brand-text">Localisation de la prestation</strong> : ville et quartier ; adresse précise uniquement lorsque la prestation l&apos;exige (livraison, intervention à domicile) ;</li>
                <li><strong className="text-brand-text">Contenu du besoin</strong> : description libre, service concerné, délai souhaité, fourchette de budget ;</li>
                <li><strong className="text-brand-text">Historique de relation</strong> : commandes, devis, paiements, avis, échanges de suivi.</li>
              </ul>
            </Section>

            <Section title="3. Finalités et bases légales">
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-brand-text">Exécution du contrat</strong> : qualifier la demande, sélectionner un expert, suivre l&apos;exécution, contrôler la qualité, livrer et facturer ;</li>
                <li><strong className="text-brand-text">Consentement</strong> : case d&apos;acceptation explicite du formulaire de demande pour être recontacté, et consentement séparé pour la publication d&apos;un avis ou d&apos;une réalisation ;</li>
                <li><strong className="text-brand-text">Intérêt légitime</strong> : statistiques anonymisées, prévention de la fraude, preuve commerciale (avis rattachés à une transaction réelle) ;</li>
                <li><strong className="text-brand-text">Oblligations légales</strong> : conservation comptable et fiscale.</li>
              </ul>
            </Section>

            <Section title="4. Destinataires et accès">
              <p>
                L&apos;accès est limité à l&apos;équipe {SITE_NAME} dans la limite de son rôle. Les experts partenaires
                ne reçoivent que le strict nécessaire à l&apos;exécution de leur mission (description de la tâche, adresse
                de prestation) et sont liés par une <strong className="text-brand-text">obligation de confidentialité</strong> —
                voir notre charte expert. Ils n&apos;ont jamais accès aux coordonnées complètes du client, et le client
                n&apos;est jamais mis en relation directe avec eux.
              </p>
              <p>
                L&apos;hébergement technique peut se situer hors du Cameroun : des garanties contractuelles appropriées
                encadrent ce traitement. Aucune donnée n&apos;est vendue, louée ou partagée à des fins commerciales.
              </p>
            </Section>

            <Section title="5. Durées de conservation">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Demande non convertie : <strong className="text-brand-text">3 ans</strong> après le dernier contact, puis suppression/anonymisation ;</li>
                <li>Commandes et factures : durée de la relation commerciale + <strong className="text-brand-text">5 ans</strong> (contraintes comptables) ;</li>
                <li>Avis et réalisations publiés : tant que le contenu est présenté, sous forme pseudonymisée ;</li>
                <li>Événements techniques (clics) : agrégés, sans identification individuelle ;</li>
                <li>Durée consolidée à valider par le conseil : <em>TODO_PROD</em>.</li>
              </ul>
            </Section>

            <Section title="6. Sécurité">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Chiffrement des connexions (HTTPS/TLS) sur l&apos;ensemble du site ;</li>
                <li>Validation stricte de toute entrée côté serveur ;</li>
                <li>Mots de passe internes hachés (bcrypt), sessions signées de 12 h en cookies httpOnly ;</li>
                <li>Limitation du débit sur les points d&apos;entrée publics ;</li>
                <li>Numéros de téléphone jamais affichés en clair (masquage dans récapitulatifs et journaux) ;</li>
                <li>Sauvegardes régulières avec tests de restauration documentés.</li>
              </ul>
            </Section>

            <Section title="7. Vos droits">
              <p>
                Vous disposez des droits d&apos;<strong className="text-brand-text">accès</strong>, de{' '}
                <strong className="text-brand-text">rectification</strong>, d&apos;<strong className="text-brand-text">opposition</strong>,
                d&apos;<strong className="text-brand-text">effacement</strong>, de <strong className="text-brand-text">limitation</strong>
                et de <strong className="text-brand-text">portabilité</strong>, ainsi que du retrait de votre consentement à tout
                moment. Toute demande se fait via WhatsApp au{' '}
                <a href={`https://wa.me/${WHATSAPP_PHONE_E164.replace(/^\+/, '')}`} className="text-brand-wa font-bold hover:underline">{WHATSAPP_PHONE_E164}</a>{' '}
                — réponse sous <strong className="text-brand-text">30 jours</strong>.
              </p>
              <p>
                En cas de difficulté, vous pouvez saisir l&apos;autorité de protection des données du Cameroun
                (ANTIC / autorité compétente en matière de protection des données personnelles).
              </p>
            </Section>

            <Section title="8. Cookies">
              <p>
                La partie publique du site n&apos;utilise <strong className="text-brand-text">aucun cookie</strong> de mesure
                d&apos;audience, publicitaire ou de suivi. Un seul cookie technique, strictement nécessaire, est utilisé
                pour la session de l&apos;espace d&apos;administration.
              </p>
            </Section>

            <Section title="9. Modifications">
              <p>
                La présente politique peut évoluer ; la date de révision figure en tête de page et toute modification
                substantielle est signalée sur le site. La version applicable est celle publiée sur cette page.
              </p>
            </Section>
          </>
        )}

        {kind === 'cgv' && (
          <>
            <Section title="1. Objet et champ d'application">
              <p>
                Les présentes conditions régissent les prestations de services proposées par {SITE_NAME} via son site.
                {SITE_NAME} est une <strong className="text-brand-text">agence orchestratrice</strong> : le client exprime
                un besoin, {SITE_NAME} le qualifie, sélectionne l&apos;expert adapté, suit l&apos;exécution, contrôle la
                qualité et assure la livraison. {SITE_NAME} reste l&apos;unique interlocuteur et l&apos;unique cocontractant
                du client ; le client ne conclut aucun contrat avec les experts partenaires.
              </p>
            </Section>

            <Section title="2. Commande">
              <p>
                La commande s&apos;effectue via WhatsApp ou depuis le site. Elle n&apos;est définitive qu&apos;après
                <strong className="text-brand-text"> qualification du besoin et confirmation écrite du prix et du délai par
                {SITE_NAME}</strong>, suivie de l&apos;accord du client. {SITE_NAME} peut refuser toute demande contraire à
                la loi, à l&apos;ordre public ou à ses capacités.
              </p>
            </Section>

            <Section title="3. Prix">
              <p>
                Les prix sont exprimés en <strong className="text-brand-text">francs CFA (FCFA), toutes taxes comprises</strong>.
                Lorsqu&apos;un service est affiché « à partir de X F », ce montant correspond au prix réellement pratiqué
                pour la configuration de base décrite sur la fiche ; toute option supplémentaire est chiffrée avant
                lancement, sur devis écrit.
              </p>
            </Section>

            <Section title="4. Paiement et facturation">
              <p>
                Les modalités (acompte éventuel, solde, moyens de paiement acceptés) sont précisées avant le lancement
                de la prestation : <em>TODO_PROD</em>. Une facture est délivrée pour chaque prestation exécutée.
              </p>
            </Section>

            <Section title="5. Exécution — interlocuteur unique">
              <p>
                Les prestations sont exécutées par les experts sélectionnés par {SITE_NAME}, sous sa direction et son
                contrôle. Le client s&apos;adresse exclusivement à {SITE_NAME} pour toute question, modification ou
                réclamation, du dépôt de la demande jusqu&apos;à la livraison.
              </p>
            </Section>

            <Section title="6. Délais et force majeure">
              <p>
                Les délais annoncés sont <strong className="text-brand-text">indicatifs</strong> et courent à compter de la
                confirmation de la commande et de la réception des éléments nécessaires. Tout retard est signalé au client
                avec une nouvelle estimation. {SITE_NAME} n&apos;est pas responsable des retards dus à un cas de force
                majeure ou au fait d&apos;un tiers (coupure réseau, indisponibilité d&apos;une plateforme, événement
                exceptionnel).
              </p>
            </Section>

            <Section title="7. Livraison">
              <p>
                La livraison est <strong className="text-brand-text">gratuite dans toute la ville de {SITE_CITY}</strong>,
                sans condition de montant ni de quartier. Le coût de transport reste à la charge de {SITE_NAME}.
              </p>
            </Section>

            <Section title="8. Droit de rétractation">
              <p>
                Conformément à la <strong className="text-brand-text">loi n° 2010/021 relative à la protection du
                consommateur</strong>, le client dispose d&apos;un délai de <strong className="text-brand-text">15 jours</strong>
                à compter de la commande pour se rétracter, sans pénalité ni motif.
              </p>
              <p><strong className="text-brand-text">Exceptions</strong> — le droit de rétractation ne s&apos;applique pas :</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>lorsque le client demande expressément une <strong className="text-brand-text">exécution immédiate</strong> de la prestation (devis urgent, intervention le jour même, réparation rapide) ;</li>
                <li>aux prestations <strong className="text-brand-text">personnalisées</strong> réalisées sur spécifications du client (logo sur mesure, site web personnalisé, documents rédigés à partir d&apos;éléments fournis).</li>
              </ul>
              <p>
                Lorsque le client souhaite une exécution immédiate, il en est informé et{' '}
                <strong className="text-brand-text">renonce expressément</strong> à son droit de rétractation ; cette
                renonciation est rappelée dans le message de confirmation de commande.
              </p>
            </Section>

            <Section title="9. Garantie et reprise">
              <p>
                {SITE_NAME} contrôle chaque prestation avant remise. Toute non-conformité constatée à la réception fait
                l&apos;objet d&apos;une reprise à ses frais. Les modalités et délais de reprise sont précisés à la commande :
                <em> TODO_PROD</em> (barème de garantie). Les garanties légales impératives demeurent applicables.
              </p>
            </Section>

            <Section title="10. Propriété intellectuelle">
              <p>
                Les livrables (logos, visuels, sites, documents) sont livrés au client avec{' '}
                <strong className="text-brand-text">cession des droits patrimoniaux après paiement complet</strong> du prix.
                Avant ce paiement, les droits restent acquis à {SITE_NAME} ou à son partenaire créateur. Les éléments
                fournis par le client restent sa propriété et doivent être libres de droits.
              </p>
            </Section>

            <Section title="11. Obligations du client">
              <p>
                Le client fournit des informations exactes, met à disposition les éléments nécessaires (logos, textes,
                appareils, accès), reste joignable pendant l&apos;exécution et vérifie le livrable à la réception.
              </p>
            </Section>

            <Section title="12. Réclamations">
              <p>
                Toute réclamation s&apos;adresse à {SITE_NAME} via WhatsApp au{' '}
                <a href={`https://wa.me/${WHATSAPP_PHONE_E164.replace(/^\+/, '')}`} className="text-brand-wa font-bold hover:underline">{WHATSAPP_PHONE_E164}</a>{' '}
                à la livraison ou dans le délai précisé à la commande (<em>TODO_PROD</em>). Elle est examinée de bonne foi.
              </p>
            </Section>

            <Section title="13. Responsabilité">
              <p>
                {SITE_NAME} est tenue à une obligation de moyens. Sa responsabilité ne saurait être engagée en cas
                d&apos;usage impropre du livrable, de carence liée aux éléments fournis par le client, de force majeure ou
                d&apos;incident imputable à un service tiers.
              </p>
            </Section>

            <Section title="14. Données personnelles">
              <p>
                Le traitement des données est régi par notre{' '}
                <LegalLink to="confidentialite">politique de confidentialité</LegalLink>.
              </p>
            </Section>

            <Section title="15. Droit applicable et règlement des litiges">
              <p>
                Les présentes conditions sont soumises au <strong className="text-brand-text">droit camerounais</strong>,
                complété par le <strong className="text-brand-text">droit uniforme OHADA</strong>. Tout litige fait
                l&apos;objet d&apos;une tentative de règlement amiable ; à défaut, les tribunaux compétents de {SITE_CITY}
                sont saisis.
              </p>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
