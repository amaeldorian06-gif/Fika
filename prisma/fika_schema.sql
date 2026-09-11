-- ============================================================================
-- FIKA — Schéma PostgreSQL complet
-- Agence orchestratrice de services · Ngaoundéré (Cameroun)
-- Version : 1.0 · PostgreSQL 14+
-- Usage : psql -d fika -f fika_schema.sql
--
-- Conventions :
--   * tables & colonnes en snake_case ;
--   * montants en INTEGER (FCFA entiers, aucun centime), CHECK >= 0 ;
--   * téléphones au format E.164 camerounais (+2376XXXXXXXX) ;
--   * statuts et types en ENUM PostgreSQL (aucune chaîne libre) ;
--   * marge JAMAIS stockée : calculée à la lecture (order.total_price - SUM(cost)) ;
--   * livraison gratuite pour le client à Ngaoundéré : le coût interne reste
--     tracé en ligne de coût DELIVERY (colonne delivery.fee), jamais facturé.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TYPES ÉNUMÉRÉS
-- ============================================================================

-- Catalogue -----------------------------------------------------------------

CREATE TYPE price_type AS ENUM (
  'FIXED',        -- prix ferme
  'FROM',         -- à partir de
  'PER_UNIT',     -- par unité
  'QUOTE',        -- sur devis
  'DIAGNOSTIC',   -- diagnostic préalable
  'PROJECT'       -- projet
);

COMMENT ON TYPE price_type IS 'Type de tarification dun service';

CREATE TYPE budget_level AS ENUM ('FAIBLE', 'MOYEN', 'ELEVE');
COMMENT ON TYPE budget_level IS 'Niveau de budget indicatif dun service';

CREATE TYPE delay_level AS ENUM ('RAPIDE', 'STANDARD', 'LONG');
COMMENT ON TYPE delay_level IS 'Délai indicatif dun service';

CREATE TYPE need_type AS ENUM (
  'CREATION', 'OPTIMISATION', 'CONSULTING',
  'PRODUCTION', 'SUPPORT', 'INTERVENTION'
);
COMMENT ON TYPE need_type IS 'Nature du besoin couvert par un service';

CREATE TYPE requirement_kind AS ENUM ('TEXT', 'FILE', 'OPTION', 'QUANTITY');
COMMENT ON TYPE requirement_kind IS 'Type de champ à compléter par le client';

-- Relation client -----------------------------------------------------------

CREATE TYPE lead_source AS ENUM ('SITE', 'WHATSAPP', 'CALL', 'WALKIN');
COMMENT ON TYPE lead_source IS 'Canal dorigine dune demande';

CREATE TYPE lead_status AS ENUM ('NEW', 'QUALIFYING', 'CONVERTED', 'LOST');
COMMENT ON TYPE lead_status IS 'Statut de qualification dune demande';

CREATE TYPE order_source AS ENUM ('SITE', 'WHATSAPP', 'CALL', 'WALKIN');
COMMENT ON TYPE order_source IS 'Canal dorigine dune commande';

CREATE TYPE order_status AS ENUM (
  'NEW',                    -- nouvelle
  'QUALIFYING',             -- en qualification
  'QUOTED',                 -- devis envoyé
  'AWAITING_CONFIRMATION',  -- attente confirmation client
  'PAID',                   -- payée
  'ASSIGNED',               -- expert assigné
  'IN_PROGRESS',            -- en cours de réalisation
  'QUALITY_CHECK',          -- contrôle qualité
  'READY',                  -- prête
  'DELIVERED',              -- livrée
  'COMPLETED',              -- terminée (débloque la review)
  'CANCELLED',              -- annulée
  'DISPUTED'                -- litige
);
COMMENT ON TYPE order_status IS 'Statut du cycle de vie dune commande';

CREATE TYPE quote_status AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');
COMMENT ON TYPE quote_status IS 'Statut dun devis';

CREATE TYPE payment_method AS ENUM ('MTN_MOMO', 'ORANGE_MONEY', 'CASH', 'BANK_TRANSFER');
COMMENT ON TYPE payment_method IS 'Moyen de paiement (Mobile Money, espèces, virement)';

CREATE TYPE payment_status AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED');
COMMENT ON TYPE payment_status IS 'Statut dun paiement';

-- Exécution -----------------------------------------------------------------

CREATE TYPE expert_status AS ENUM ('ACTIVE', 'PAUSED', 'SUSPENDED', 'BACKUP');
COMMENT ON TYPE expert_status IS 'Statut opérationnel dun expert partenaire';

CREATE TYPE task_status AS ENUM (
  'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED'
);
COMMENT ON TYPE task_status IS 'Statut davancement dune tâche';

CREATE TYPE assignment_status AS ENUM ('ASSIGNED', 'ACCEPTED', 'DECLINED', 'COMPLETED');
COMMENT ON TYPE assignment_status IS 'Statut dune affectation expert';

CREATE TYPE delivery_status AS ENUM ('PENDING', 'PICKUP', 'IN_TRANSIT', 'DELIVERED', 'FAILED');
COMMENT ON TYPE delivery_status IS 'Statut dune livraison';

CREATE TYPE cost_type AS ENUM ('EXPERT', 'MATERIAL', 'DELIVERY', 'OTHER');
COMMENT ON TYPE cost_type IS 'Nature de coût interne (jamais facturée au client)';

-- Preuve & confiance --------------------------------------------------------

CREATE TYPE event_type AS ENUM ('WACLICK', 'LEAD_VIEW');
COMMENT ON TYPE event_type IS 'Type dévénement analytics';

CREATE TYPE admin_role AS ENUM ('SUPERADMIN', 'OPS');
COMMENT ON TYPE admin_role IS 'Rôle dun compte back-office';


-- ============================================================================
-- 2. TABLES — GÉOGRAPHIE
-- ============================================================================

-- Ville opérée (une seule active aujourd'hui : Ngaoundéré)
CREATE TABLE city (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  position   INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE city IS 'Ville où Fika opère (Ngaoundéré active)';

-- Quartier d'une ville ; delivery_included = TRUE partout à Ngaoundéré
CREATE TABLE zone (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  city_id           TEXT NOT NULL REFERENCES city(id) ON DELETE RESTRICT,
  delivery_included BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT zone_city_name_key UNIQUE (city_id, name)
);
COMMENT ON TABLE zone IS 'Quartier livrable ; gratuité client réglée par zone';
COMMENT ON COLUMN zone.delivery_included IS 'TRUE = livraison offerte au client (règle Ngaoundéré)';

-- ============================================================================
-- 3. TABLES — CATALOGUE
-- ============================================================================

-- Univers de services (Digital, Design, Documents…)
CREATE TABLE category (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  featured    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE category IS 'Univers de services (Digital, Design, …)';

-- Prestation du catalogue
CREATE TABLE service (
  id                 TEXT PRIMARY KEY,
  slug               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  category_id        TEXT NOT NULL REFERENCES category(id) ON DELETE RESTRICT,
  short_description  TEXT NOT NULL,
  full_description   TEXT,
  price_type         price_type NOT NULL DEFAULT 'FIXED',
  starting_price     INTEGER CHECK (starting_price IS NULL OR starting_price >= 0),
  price_min          INTEGER CHECK (price_min IS NULL OR price_min >= 0),
  price_max          INTEGER CHECK (price_max IS NULL OR price_max >= 0),
  estimated_duration TEXT,
  delivery_included  BOOLEAN NOT NULL DEFAULT FALSE,
  complexity         TEXT,
  included_items     TEXT[] NOT NULL DEFAULT '{}',
  excluded_items     TEXT[] NOT NULL DEFAULT '{}',
  whatsapp_template  TEXT,
  seo_title          TEXT,
  seo_description    TEXT,
  image              TEXT,
  popular            BOOLEAN NOT NULL DEFAULT FALSE,
  featured           BOOLEAN NOT NULL DEFAULT FALSE,
  display_order      INTEGER NOT NULL DEFAULT 0,
  budget             budget_level NOT NULL DEFAULT 'FAIBLE',
  delai              delay_level NOT NULL DEFAULT 'STANDARD',
  type_besoin        need_type NOT NULL DEFAULT 'CREATION',
  how_it_works       JSONB,
  faqs               JSONB,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE service IS 'Prestation du catalogue avec prix, exigences et SEO';
COMMENT ON COLUMN service.starting_price IS 'Montant en FCFA (entier, sans centime)';
COMMENT ON COLUMN service.how_it_works IS 'Étapes [{title, description}] validées en écriture';
COMMENT ON COLUMN service.faqs IS 'Questions [{q, a}]';

-- Champ structuré à compléter par le client (moteur WhatsApp)
CREATE TABLE service_requirement (
  id         TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES service(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  kind       requirement_kind NOT NULL DEFAULT 'TEXT',
  required   BOOLEAN NOT NULL DEFAULT TRUE,
  options    TEXT[] NOT NULL DEFAULT '{}',
  position   INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0)
);
COMMENT ON TABLE service_requirement IS 'Exigence client structurée pour un service';

-- Surcharge tarifaire par ville (marge cible incluse)
CREATE TABLE service_city_price (
  id                TEXT PRIMARY KEY,
  service_id        TEXT NOT NULL REFERENCES service(id) ON DELETE CASCADE,
  city_id           TEXT NOT NULL REFERENCES city(id) ON DELETE RESTRICT,
  price_min         INTEGER CHECK (price_min IS NULL OR price_min >= 0),
  price_max         INTEGER CHECK (price_max IS NULL OR price_max >= 0),
  target_margin     NUMERIC(4,3) CHECK (target_margin IS NULL OR (target_margin > 0 AND target_margin < 1)),
  delivery_included BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT service_city_price_service_city_key UNIQUE (service_id, city_id)
);
COMMENT ON TABLE service_city_price IS 'Tarif et marge cible dun service pour une ville';
COMMENT ON COLUMN service_city_price.target_margin IS 'Ratio de marge cible (ex. 0.450)';

-- Pack commercial regroupant plusieurs services
CREATE TABLE package (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  description      TEXT,
  price            INTEGER NOT NULL CHECK (price >= 0),
  target_customer  TEXT,
  savings          TEXT,
  whatsapp_template TEXT,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE package IS 'Pack commercial à prix optimisé';

-- Ligne de pack : quel service, en quelle quantité
CREATE TABLE package_service (
  package_id  TEXT NOT NULL REFERENCES package(id) ON DELETE CASCADE,
  service_id  TEXT NOT NULL REFERENCES service(id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  custom_name TEXT,
  discount    INTEGER CHECK (discount IS NULL OR discount >= 0),
  CONSTRAINT package_service_pkey PRIMARY KEY (package_id, service_id)
);
COMMENT ON TABLE package_service IS 'Ligne de composition dun pack (service x quantité)';

-- ============================================================================
-- 4. TABLES — RELATION CLIENT
-- ============================================================================

-- Client identifié par son numéro WhatsApp (E.164 unique)
CREATE TABLE customer (
  id         TEXT PRIMARY KEY,
  phone      TEXT NOT NULL UNIQUE CHECK (phone ~ '^\+2376[0-9]{8}$'),
  name       TEXT,
  email      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE customer IS 'Client identifié par téléphone E.164 unique';
COMMENT ON COLUMN customer.phone IS 'Format E.164 camerounais : +2376XXXXXXXX';

-- Demande entrante avant conversion en commande
CREATE TABLE lead (
  id           TEXT PRIMARY KEY,
  customer_id  TEXT REFERENCES customer(id) ON DELETE SET NULL,
  source       lead_source NOT NULL DEFAULT 'WHATSAPP',
  campaign     TEXT,
  service_id   TEXT REFERENCES service(id) ON DELETE SET NULL,
  city_id      TEXT REFERENCES city(id) ON DELETE SET NULL,
  zone_name    TEXT,
  description  TEXT,
  deadline     TEXT,
  budget_min   INTEGER CHECK (budget_min IS NULL OR budget_min >= 0),
  budget_max   INTEGER CHECK (budget_max IS NULL OR budget_max >= 0),
  status       lead_status NOT NULL DEFAULT 'NEW',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE lead IS 'Demande à qualifier avant conversion';

-- Commande : contrat unique entre le client et Fika
CREATE TABLE "order" (
  id                   TEXT PRIMARY KEY,
  order_number         TEXT NOT NULL UNIQUE,
  customer_id          TEXT NOT NULL REFERENCES customer(id) ON DELETE RESTRICT,
  status               order_status NOT NULL DEFAULT 'NEW',
  source               order_source NOT NULL DEFAULT 'WHATSAPP',
  channel_ref          TEXT,
  total_price          INTEGER CHECK (total_price IS NULL OR total_price >= 0),
  city_id              TEXT REFERENCES city(id) ON DELETE SET NULL,
  zone_id              TEXT REFERENCES zone(id) ON DELETE SET NULL,
  client_address       TEXT,
  lead_id              TEXT UNIQUE REFERENCES lead(id) ON DELETE SET NULL,
  expected_delivery_at TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE order IS 'Commande : Fika est lunique contractant du client';
COMMENT ON COLUMN order.total_price IS 'Prix client TTC en FCFA (fixé par le devis)';
COMMENT ON COLUMN order.completed_at IS 'Renseigné au passage COMPLETED (débloque la review)';

-- Ligne de commande (service du catalogue ou prestation sur mesure)
CREATE TABLE order_item (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  service_id  TEXT REFERENCES service(id) ON DELETE SET NULL,
  custom_name TEXT,
  price       INTEGER CHECK (price IS NULL OR price >= 0),
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE order_item IS 'Ligne de commande (service catalogue ou sur mesure)';

-- Historique append-only du cycle de vie d'une commande
CREATE TABLE order_event (
  id         TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  from_status order_status,
  to_status  order_status NOT NULL,
  note       TEXT,
  actor_id   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE order_event IS 'Journal des changements de statut (append-only)';
COMMENT ON COLUMN order_event.actor_id IS 'Admin auteur du changement (FK différée en §8bis)';

-- Devis émis pour une commande
CREATE TABLE quote (
  id            TEXT PRIMARY KEY,
  quote_number  TEXT NOT NULL UNIQUE,
  order_id      TEXT NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL CHECK (amount >= 0),
  details       TEXT,
  status        quote_status NOT NULL DEFAULT 'DRAFT',
  valid_until   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE quote IS 'Devis ; son montant sert de référence à total_price';

-- Ligne de devis (détail chiffré)
CREATE TABLE quote_item (
  id         TEXT PRIMARY KEY,
  quote_id   TEXT NOT NULL REFERENCES quote(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0)
);
COMMENT ON TABLE quote_item IS 'Ligne détaillée dun devis';

-- Paiement encaissé pour une commande
CREATE TABLE payment (
  id         TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES "order"(id) ON DELETE RESTRICT,
  amount     INTEGER NOT NULL CHECK (amount >= 0),
  method     payment_method,
  status     payment_status NOT NULL DEFAULT 'PENDING',
  reference  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE payment IS 'Paiement (MTN MoMo, Orange Money, espèces, virement)';

-- ============================================================================
-- 5. TABLES — EXÉCUTION
-- ============================================================================

-- Expert partenaire sélectionné par Fika (jamais en contact direct client)
CREATE TABLE expert (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  phone             TEXT NOT NULL UNIQUE CHECK (phone ~ '^\+2376[0-9]{8}$'),
  skills            TEXT[] NOT NULL DEFAULT '{}',
  city_id           TEXT REFERENCES city(id) ON DELETE SET NULL,
  zone              TEXT,
  usual_cost        INTEGER CHECK (usual_cost IS NULL OR usual_cost >= 0),
  average_duration  TEXT,
  completed_orders  INTEGER NOT NULL DEFAULT 0 CHECK (completed_orders >= 0),
  rework_rate       NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (rework_rate >= 0 AND rework_rate <= 1),
  cancellation_rate NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (cancellation_rate >= 0 AND cancellation_rate <= 1),
  reliability_score NUMERIC(2,1) NOT NULL DEFAULT 5.0 CHECK (reliability_score >= 0 AND reliability_score <= 5),
  availability      BOOLEAN NOT NULL DEFAULT TRUE,
  status            expert_status NOT NULL DEFAULT 'ACTIVE',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE expert IS 'Expert partenaire indépendant (pas un vendeur)';
COMMENT ON COLUMN expert.usual_cost IS 'Coût habituel en FCFA pour Fika';

-- Tâche de réalisation confiée à un expert
CREATE TABLE task (
  id                     TEXT PRIMARY KEY,
  order_id               TEXT NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  service_id             TEXT REFERENCES service(id) ON DELETE SET NULL,
  client_brief           TEXT,
  deliverables           TEXT,
  deadline               TIMESTAMPTZ,
  internal_compensation  INTEGER CHECK (internal_compensation IS NULL OR internal_compensation >= 0),
  status                 task_status NOT NULL DEFAULT 'PENDING',
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE task IS 'Tâche de réalisation suivie par Fika';

-- Affectation d'une tâche à un expert
CREATE TABLE task_assignment (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  expert_id   TEXT NOT NULL REFERENCES expert(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status      assignment_status NOT NULL DEFAULT 'ASSIGNED',
  CONSTRAINT task_assignment_task_expert_key UNIQUE (task_id, expert_id)
);
COMMENT ON TABLE task_assignment IS 'Affectation expert ↔ tâche (une active par tâche)';

-- Livraison : gratuite pour le client à Ngaoundéré, coût interne tracé
CREATE TABLE delivery (
  id               TEXT PRIMARY KEY,
  order_id         TEXT NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  address          TEXT,
  zone_id          TEXT REFERENCES zone(id) ON DELETE SET NULL,
  status           delivery_status NOT NULL DEFAULT 'PENDING',
  courier_expert_id TEXT REFERENCES expert(id) ON DELETE SET NULL,
  fee              INTEGER NOT NULL DEFAULT 0 CHECK (fee >= 0),
  tracking_url     TEXT,
  proof_url        TEXT,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE delivery IS 'Livraison au client ; gratuité régie par zone.delivery_included';
COMMENT ON COLUMN delivery.fee IS 'Coût INTERNE en FCFA (jamais facturé au client à Ngaoundéré)';

-- Ligne de coût interne : base du calcul de marge (jamais stockée en table)
CREATE TABLE cost (
  id         TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  type       cost_type NOT NULL,
  amount     INTEGER NOT NULL CHECK (amount >= 0),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE cost IS 'Coût interne ; marge = total_price - SUM(cost.amount) à la lecture';

-- ============================================================================
-- 6. TABLES — PREUVE & CONFIANCE
-- ============================================================================

-- Avis public : UN SEUL par commande, obligatoirement sur commande COMPLETED
CREATE TABLE review (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customer(id) ON DELETE RESTRICT,
  order_id    TEXT NOT NULL UNIQUE REFERENCES "order"(id) ON DELETE RESTRICT,
  service_id  TEXT NOT NULL REFERENCES service(id) ON DELETE RESTRICT,
  expert_id   TEXT REFERENCES expert(id) ON DELETE SET NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  verified    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE review IS 'Avis adossé à une transaction réelle (1 max par commande)';
COMMENT ON COLUMN review.order_id IS 'UNIQUE : invariant 1 avis = 1 commande terminée';

-- Réalisation publiée, rattachée à sa commande d'origine
CREATE TABLE portfolio_item (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL,
  service_id  TEXT REFERENCES service(id) ON DELETE SET NULL,
  order_id    TEXT REFERENCES "order"(id) ON DELETE SET NULL,
  description TEXT,
  image       TEXT NOT NULL,
  client_type TEXT,
  date        TIMESTAMPTZ,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE portfolio_item IS 'Preuve publique dérivée dune commande réelle';

-- ============================================================================
-- 7. TABLES — PILOTAGE
-- ============================================================================

-- Événement analytics (clic WhatsApp, vue de fiche)
CREATE TABLE event (
  id         TEXT PRIMARY KEY,
  type       event_type NOT NULL,
  service_id TEXT REFERENCES service(id) ON DELETE SET NULL,
  campaign   TEXT,
  source     TEXT,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE event IS 'Analytics produit (aucune donnée personnelle)';

-- Compte back-office
CREATE TABLE admin_user (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          admin_role NOT NULL DEFAULT 'OPS',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE admin_user IS 'Compte daccès au back-office (mot de passe haché bcrypt)';

-- Témoignage éditorial (distinct des reviews vérifiées)
CREATE TABLE testimonial (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT,
  city       TEXT,
  content    TEXT NOT NULL,
  service    TEXT,
  verified   BOOLEAN NOT NULL DEFAULT TRUE,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE testimonial IS 'Témoignage éditorial (hors avis vérifiés)';


-- ============================================================================
-- 8. INDEX
-- ============================================================================

-- Géographie & catalogue
CREATE INDEX idx_zone_city                    ON zone(city_id);
CREATE INDEX idx_service_category_active      ON service(category_id, active);
CREATE INDEX idx_service_slug_active          ON service(slug) WHERE active;
CREATE INDEX idx_service_popular              ON service(popular) WHERE popular;
CREATE INDEX idx_service_display_order        ON service(category_id, display_order);
CREATE INDEX idx_requirement_service          ON service_requirement(service_id);
CREATE INDEX idx_city_price_service           ON service_city_price(service_id);
CREATE INDEX idx_city_price_city              ON service_city_price(city_id);
CREATE INDEX idx_package_service_service      ON package_service(service_id);

-- Relation client
CREATE INDEX idx_customer_phone               ON customer(phone);
CREATE INDEX idx_lead_status                  ON lead(status);
CREATE INDEX idx_lead_customer                ON lead(customer_id);
CREATE INDEX idx_lead_city                    ON lead(city_id);
CREATE INDEX idx_order_status                 ON "order"(status);
CREATE INDEX idx_order_created_at             ON "order"(created_at);
CREATE INDEX idx_order_customer               ON "order"(customer_id);
CREATE INDEX idx_order_city                   ON "order"(city_id);
CREATE INDEX idx_order_lead                   ON "order"(lead_id);
CREATE INDEX idx_order_item_order             ON order_item(order_id);
CREATE INDEX idx_order_item_service           ON order_item(service_id);
CREATE INDEX idx_order_event_order            ON order_event(order_id);
CREATE INDEX idx_order_event_created          ON order_event(created_at);
CREATE INDEX idx_quote_order                  ON quote(order_id);
CREATE INDEX idx_quote_item_quote             ON quote_item(quote_id);
CREATE INDEX idx_payment_order                ON payment(order_id);
CREATE INDEX idx_payment_status               ON payment(status);

-- Exécution
CREATE INDEX idx_expert_phone                 ON expert(phone);
CREATE INDEX idx_expert_status_availability   ON expert(status, availability);
CREATE INDEX idx_expert_city                  ON expert(city_id);
CREATE INDEX idx_task_order                   ON task(order_id);
CREATE INDEX idx_task_status                  ON task(status);
CREATE INDEX idx_assignment_task              ON task_assignment(task_id);
CREATE INDEX idx_assignment_expert            ON task_assignment(expert_id);
CREATE INDEX idx_delivery_order               ON delivery(order_id);
CREATE INDEX idx_delivery_status              ON delivery(status);
CREATE INDEX idx_cost_order                   ON cost(order_id);
CREATE INDEX idx_cost_type                    ON cost(type);

-- Preuve & pilotage
CREATE INDEX idx_review_order                 ON review(order_id);
CREATE INDEX idx_review_expert                ON review(expert_id);
CREATE INDEX idx_review_service               ON review(service_id);
CREATE INDEX idx_portfolio_service_active     ON portfolio_item(service_id, active);
CREATE INDEX idx_portfolio_order              ON portfolio_item(order_id);
CREATE INDEX idx_event_created_at             ON event(created_at);
CREATE INDEX idx_event_type                   ON event(type);
CREATE INDEX idx_event_service                ON event(service_id);
CREATE INDEX idx_admin_email                  ON admin_user(email);
CREATE INDEX idx_testimonial_active           ON testimonial(active) WHERE active;

-- ============================================================================
-- 8bis. CLÉ ÉTRANGÈRE DIFFÉRÉE (admin_user créé après order_event)
-- ============================================================================

ALTER TABLE order_event
  ADD CONSTRAINT order_event_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES admin_user(id) ON DELETE SET NULL;

-- ============================================================================
-- 9. VUES UTILES (lecture seule — la marge reste calculée, jamais stockée)
-- ============================================================================

-- Marge réelle par commande : total_price - SUM(coûts internes)
CREATE VIEW v_order_margin AS
SELECT
  o.id                    AS order_id,
  o.order_number,
  o.status,
  o.total_price,
  COALESCE(SUM(c.amount), 0)                       AS costs_total,
  (o.total_price - COALESCE(SUM(c.amount), 0))     AS margin_amount,
  CASE
    WHEN o.total_price IS NULL OR o.total_price = 0 THEN NULL
    ELSE ROUND(
      (o.total_price - COALESCE(SUM(c.amount), 0))::NUMERIC
      / o.total_price * 100, 2
    )
  END                                              AS margin_percent
FROM "order" o
LEFT JOIN cost c ON c.order_id = o.id
GROUP BY o.id;

COMMENT ON VIEW v_order_margin IS 'Marge par commande, calculée (jamais stockée)';

-- Répartition des coûts internes par nature
CREATE VIEW v_cost_breakdown AS
SELECT
  o.id   AS order_id,
  c.type AS cost_type,
  SUM(c.amount)                                          AS amount,
  ROUND(SUM(c.amount)::NUMERIC / NULLIF(t.total, 0) * 100, 2) AS percent_of_costs
FROM "order" o
JOIN cost c ON c.order_id = o.id
JOIN (
  SELECT order_id, SUM(amount) AS total FROM cost GROUP BY order_id
) t ON t.order_id = o.id
GROUP BY o.id, c.type, t.total;

COMMENT ON VIEW v_cost_breakdown IS 'Répartition des coûts internes par nature';

-- Score moyen d'un expert (calculé à la lecture, jamais stocké)
CREATE VIEW v_expert_score AS
SELECT
  e.id   AS expert_id,
  e.name,
  COUNT(r.id)                    AS review_count,
  ROUND(AVG(r.rating)::NUMERIC, 1) AS average_rating
FROM expert e
LEFT JOIN review r ON r.expert_id = e.id AND r.verified
GROUP BY e.id;

COMMENT ON VIEW v_expert_score IS 'Note moyenne dun expert (calculée)';

-- ============================================================================
-- 10. VÉRIFICATION DE CONCORDANCE AVEC PRISMA
-- ============================================================================
-- Le projet reste piloté par Prisma. Après toute modification du SQL ou du
-- schema.prisma, contrôler la cohérence bidirectionnelle :
--
--  1. SQL généré depuis le schéma Prisma (ce que Prisma attend) :
--     npx prisma migrate diff \
--       --from-empty \
--       --to-schema-datamodel prisma/schema.prisma \
--       --script > /tmp/expected.sql
--
--  2. Comparaison avec la base réelle (drift) :
--     npx prisma migrate diff \
--       --from-schema-datamodel prisma/schema.prisma \
--       --to-url "$DATABASE_URL" \
--       --exit-code
--
--  3. Créer une migration à partir de ce fichier SQL si besoin :
--     npx prisma migrate diff \
--       --from-schema-datasource prisma/schema.prisma \
--       --to-script fika_schema.sql
--
-- Note : Prisma n'applique pas nativement les vues ni les index partiels
-- (WHERE). Ce fichier SQL est donc la SOURCE DE VÉRITÉ pour ces éléments ;
-- les vues et index partiels doivent être recréés via un script SQL dédié
-- après `prisma migrate deploy`.

COMMIT;
