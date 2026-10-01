-- ===========================================================================
-- 0073_catalog — Sprint 07 P0 (Shared foundation for entitlements + onboarding).
-- SPRINT-07-entitlements-onboarding.md §3.1/§3.2, P0 AC1-AC7.
--
-- The pack catalog, the pack->module map, the framework->module inclusion
-- rules, the industry/framework lookups, the 3 tier bundles and a versioned
-- price book are GLOBAL, control-plane DATA (U-D2/U-D3/U-D4): readable by
-- every tenant (including a Model B dedicated tenant whose rows live in
-- another physical database, 0075/0076's tenant tables do not reference it),
-- writable only by Kaenal staff (migrator here; the platform role from 07C's
-- 0080 onward). They live in `control`, like `control.tenants`: exempt from
-- the RLS lint by schema, covered instead by an explicit grant test
-- (`control-identity.test.ts`'s precedent). No Postgres ENUM and no
-- TypeScript literal union governs anything a platform user can extend
-- (U-D4) — `catalog_frameworks.key` / `catalog_industries.key` are free text
-- constrained only to a safe key shape.
--
-- `catalog_meta` is a 1-row version counter, bumped by a trigger on every
-- write to any catalog table (incl. this seed), so the API can cache a
-- snapshot per process and revalidate with one PK read per request (§3.2).
-- ===========================================================================

-- --- 1. Packs ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS control.catalog_packs (
  id                       text PRIMARY KEY
                             CHECK (id IN ('intelligence', 'supplier', 'qe', 'platform',
                                           'security', 'multiplant', 'mobile', 'standards',
                                           'support')),
  kind                     text NOT NULL CHECK (kind IN ('pack', 'alacarte')),
  name                     text NOT NULL,
  tagline                  text NOT NULL,
  icon                     text NOT NULL,
  accent_token             text NOT NULL,
  includes                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  value_line               text,
  trialable                boolean NOT NULL DEFAULT false,
  sort_order               int NOT NULL,
  lock_version             int NOT NULL DEFAULT 0,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  -- No FK yet: control.platform_users does not exist until 07C's 0078. Stays
  -- a bare id — platform-user identity is attributed through the platform
  -- audit log (07C), not a referential constraint on this table.
  updated_by_platform_user uuid
);

DROP TRIGGER IF EXISTS catalog_packs_touch ON control.catalog_packs;
CREATE TRIGGER catalog_packs_touch BEFORE UPDATE ON control.catalog_packs
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- --- 2. Pack -> module map ----------------------------------------------------
-- A module with no row here is in the universal Core floor. The 8
-- CORE_FLOOR_GUARANTEED modules (pricing.jsx:168 — packages/core's
-- `CORE_FLOOR_GUARANTEED`) can never be mapped into a pack: the CHECK below
-- is the database-level half of that guarantee (P0 AC3's `validateCatalog`
-- is the application-level half). `complaints` and `reports` are floor today
-- (no row) but NOT in this guaranteed set, so a future catalog edit (07C C7)
-- could move them into a pack — P2 AC4 wraps their web routes in `LockedRoute`
-- for exactly that reason even though nothing locks them today.
CREATE TABLE IF NOT EXISTS control.catalog_pack_modules (
  module_id text PRIMARY KEY
              CHECK (module_id NOT IN ('inspections', 'ncr', 'eight_d', 'capa',
                                        'audits', 'documents', 'calibration', 'training')),
  pack_id   text NOT NULL REFERENCES control.catalog_packs (id)
);

-- --- 3. Framework / industry lookups (U-D4: extensible, no migration) --------

CREATE TABLE IF NOT EXISTS control.catalog_frameworks (
  key                      text PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{2,40}$'),
  label                    text NOT NULL,
  short_label              text NOT NULL,
  -- Replaces addons.jsx:120's hard-coded "beyond IATF 16949 & ISO 9001".
  counts_as_extra_standard boolean NOT NULL DEFAULT true,
  sort_order               int NOT NULL,
  active                   boolean NOT NULL DEFAULT true,
  lock_version             int NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by_platform_user uuid
);

DROP TRIGGER IF EXISTS catalog_frameworks_touch ON control.catalog_frameworks;
CREATE TRIGGER catalog_frameworks_touch BEFORE UPDATE ON control.catalog_frameworks
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS control.catalog_industries (
  key                      text PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{2,40}$'),
  label                    text NOT NULL,
  -- Pre-selects O4 step 2's frameworks (O2 AC1); additive boosts only, can
  -- never make a module `essential` by themselves (O2 AC2).
  suggested_frameworks     text[] NOT NULL DEFAULT '{}',
  module_priors            jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order               int NOT NULL,
  active                   boolean NOT NULL DEFAULT true,
  lock_version             int NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by_platform_user uuid
);

DROP TRIGGER IF EXISTS catalog_industries_touch ON control.catalog_industries;
CREATE TRIGGER catalog_industries_touch BEFORE UPDATE ON control.catalog_industries
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- --- 4. Framework -> module rules (D2's single source) -----------------------
-- `required` = free for a tenant that declares the framework (P1's resolver);
-- `supports` = suggestion only (O2), no commercial effect.
CREATE TABLE IF NOT EXISTS control.framework_module_rules (
  framework_key            text NOT NULL REFERENCES control.catalog_frameworks (key),
  module_id                text NOT NULL,
  level                    text NOT NULL CHECK (level IN ('required', 'supports')),
  clause                   text,
  note                     text,
  lock_version             int NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by_platform_user uuid,
  PRIMARY KEY (framework_key, module_id)
);

DROP TRIGGER IF EXISTS framework_module_rules_touch ON control.framework_module_rules;
CREATE TRIGGER framework_module_rules_touch BEFORE UPDATE ON control.framework_module_rules
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX IF NOT EXISTS framework_module_rules_module_idx
  ON control.framework_module_rules (module_id);

-- --- 5. Versioned price book (U-D3: platform-editable, never a file) --------

CREATE TABLE IF NOT EXISTS control.price_book_versions (
  id                         uuid PRIMARY KEY DEFAULT uuidv7(),
  status                     text NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'published', 'archived')),
  currency                   text NOT NULL DEFAULT 'USD',
  note                       text,
  published_at               timestamptz,
  published_by_platform_user uuid,
  created_at                 timestamptz NOT NULL DEFAULT now()
);

-- At most one published version, and (AR19) at most one draft at a time, so
-- two platform admins cannot each open a draft (07C C8 AC2).
CREATE UNIQUE INDEX IF NOT EXISTS price_book_versions_one_published_uq
  ON control.price_book_versions ((true)) WHERE status = 'published';
CREATE UNIQUE INDEX IF NOT EXISTS price_book_versions_one_draft_uq
  ON control.price_book_versions ((true)) WHERE status = 'draft';

-- DB-enforced, not just application-trusted: a published or archived version
-- can never be deleted (07C C8 "Discard draft deletes only a draft");
-- publishing archives the previous version instead of removing it.
CREATE OR REPLACE FUNCTION control.reject_non_draft_price_book_delete() RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'cannot delete a % price-book version — only a draft may be discarded', OLD.status
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS price_book_versions_reject_non_draft_delete ON control.price_book_versions;
CREATE TRIGGER price_book_versions_reject_non_draft_delete
  BEFORE DELETE ON control.price_book_versions
  FOR EACH ROW EXECUTE FUNCTION control.reject_non_draft_price_book_delete();

CREATE TABLE IF NOT EXISTS control.price_book_items (
  -- ON DELETE CASCADE: discarding a draft (07C C8, the only DELETE this
  -- schema allows on price_book_versions) must cleanly remove its items too;
  -- a published/archived version is never deleted by any granted privilege.
  version_id      uuid NOT NULL REFERENCES control.price_book_versions (id) ON DELETE CASCADE,
  -- 'core_base' or 'pack:<id>' — validateCatalog (P0 AC3) requires an item
  -- for core_base and every one of the 9 packs.
  item_key        text NOT NULL,
  -- NULL = custom / "Talk to sales" (e.g. the security pack).
  amount          numeric(12, 2),
  unit            text NOT NULL
                    CHECK (unit IN ('month', 'supplier_month', 'plant_month',
                                     'inspector_month', 'standard_month', 'custom')),
  included_units  int NOT NULL DEFAULT 0,
  label           text NOT NULL,
  PRIMARY KEY (version_id, item_key)
);

-- --- 6. Tiers (pricing.jsx's 3 bundles, as data) ------------------------------

CREATE TABLE IF NOT EXISTS control.catalog_tiers (
  id                       text PRIMARY KEY CHECK (id IN ('core', 'pro', 'ent')),
  name                     text NOT NULL,
  blurb                    text NOT NULL,
  features                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  packs                    text[] NOT NULL DEFAULT '{}',
  cta                      text NOT NULL CHECK (cta IN ('apply', 'sales')),
  sort_order               int NOT NULL,
  lock_version             int NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by_platform_user uuid
);

DROP TRIGGER IF EXISTS catalog_tiers_touch ON control.catalog_tiers;
CREATE TRIGGER catalog_tiers_touch BEFORE UPDATE ON control.catalog_tiers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- --- 7. Catalog version counter ----------------------------------------------
-- Single row (`singleton` is always true — the CHECK plus the PK makes a
-- second row impossible). Bumped by a trigger on every write to any catalog
-- table above, so the API can cache a snapshot keyed on this number and
-- revalidate with one PK read per request (§3.2, AR16/AR17).

CREATE TABLE IF NOT EXISTS control.catalog_meta (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  version   bigint NOT NULL DEFAULT 1
);
INSERT INTO control.catalog_meta (singleton, version) VALUES (true, 1)
  ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION control.bump_catalog_version() RETURNS trigger AS $$
BEGIN
  UPDATE control.catalog_meta SET version = version + 1 WHERE singleton = true;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS catalog_packs_bump_version ON control.catalog_packs;
CREATE TRIGGER catalog_packs_bump_version
  AFTER INSERT OR UPDATE OR DELETE ON control.catalog_packs
  FOR EACH STATEMENT EXECUTE FUNCTION control.bump_catalog_version();

DROP TRIGGER IF EXISTS catalog_pack_modules_bump_version ON control.catalog_pack_modules;
CREATE TRIGGER catalog_pack_modules_bump_version
  AFTER INSERT OR UPDATE OR DELETE ON control.catalog_pack_modules
  FOR EACH STATEMENT EXECUTE FUNCTION control.bump_catalog_version();

DROP TRIGGER IF EXISTS catalog_frameworks_bump_version ON control.catalog_frameworks;
CREATE TRIGGER catalog_frameworks_bump_version
  AFTER INSERT OR UPDATE OR DELETE ON control.catalog_frameworks
  FOR EACH STATEMENT EXECUTE FUNCTION control.bump_catalog_version();

DROP TRIGGER IF EXISTS catalog_industries_bump_version ON control.catalog_industries;
CREATE TRIGGER catalog_industries_bump_version
  AFTER INSERT OR UPDATE OR DELETE ON control.catalog_industries
  FOR EACH STATEMENT EXECUTE FUNCTION control.bump_catalog_version();

DROP TRIGGER IF EXISTS framework_module_rules_bump_version ON control.framework_module_rules;
CREATE TRIGGER framework_module_rules_bump_version
  AFTER INSERT OR UPDATE OR DELETE ON control.framework_module_rules
  FOR EACH STATEMENT EXECUTE FUNCTION control.bump_catalog_version();

DROP TRIGGER IF EXISTS price_book_versions_bump_version ON control.price_book_versions;
CREATE TRIGGER price_book_versions_bump_version
  AFTER INSERT OR UPDATE OR DELETE ON control.price_book_versions
  FOR EACH STATEMENT EXECUTE FUNCTION control.bump_catalog_version();

DROP TRIGGER IF EXISTS price_book_items_bump_version ON control.price_book_items;
CREATE TRIGGER price_book_items_bump_version
  AFTER INSERT OR UPDATE OR DELETE ON control.price_book_items
  FOR EACH STATEMENT EXECUTE FUNCTION control.bump_catalog_version();

DROP TRIGGER IF EXISTS catalog_tiers_bump_version ON control.catalog_tiers;
CREATE TRIGGER catalog_tiers_bump_version
  AFTER INSERT OR UPDATE OR DELETE ON control.catalog_tiers
  FOR EACH STATEMENT EXECUTE FUNCTION control.bump_catalog_version();

-- ===========================================================================
-- Seed — every value mirrors addons.jsx / pricing.jsx exactly (P0 AC1), plus
-- the finalized framework -> module mapping (§3.0 D2, Q-C11, DECIDED).
-- ===========================================================================

-- --- Packs (addons.jsx:13-134) ------------------------------------------------

INSERT INTO control.catalog_packs
  (id, kind, name, tagline, icon, accent_token, includes, value_line, trialable, sort_order)
VALUES
  ('intelligence', 'pack', 'Kaenal Intelligence', 'AI woven through every quality workflow.',
   'sparkles', '#6366f1',
   '["8D AI copilot & root-cause drafting", "Document AI summaries & OCR", "Predictive risk scoring",
     "Knowledge graph explorer", "Compliance Q&A assistant"]'::jsonb,
   '≈ 40% faster 8D closure', true, 1),

  ('supplier', 'pack', 'Supplier Network', 'Push quality actions out to your whole supply base.',
   'truck', '#0d9488',
   '["External supplier portal", "PPAP submission workflow", "SCAR & chargebacks",
     "Weighted supplier scorecards", "Supplier risk matrix"]'::jsonb,
   'Expands revenue beyond your seats', true, 2),

  ('qe', 'pack', 'Quality Engineering', 'Deep statistical tooling for your QE team.',
   'target', '#2563eb',
   '["FMEA workbench (AIAG-VDA)", "SPC charts", "MSA / Gauge R&R studies",
     "Risk register", "Engineering changes (ECN)"]'::jsonb,
   'Specialist depth, not everyday seats', true, 3),

  ('platform', 'pack', 'Platform & Integrations', 'Wire Kaenal into the rest of your stack.',
   'code', '#ea580c',
   '["Public API & webhooks", "Developer platform & OAuth apps", "Report builder & scheduled exports",
     "Data warehouse sync", "ERP / MES connectors"]'::jsonb,
   'Integrated accounts churn less', true, 4),

  ('security', 'pack', 'Enterprise Security & Identity', 'Pass enterprise IT & security review.',
   'shield', '#475569',
   '["SSO — SAML / Entra", "SCIM provisioning", "Network policy & IP allowlists",
     "BYOK / customer-managed keys", "DSAR, legal hold & DLP"]'::jsonb,
   'Separate IT security budget', false, 5),

  ('multiplant', 'pack', 'Multi-Plant & White-Label', 'Run every plant from a single tenant.',
   'building', '#be185d',
   '["Org hierarchy & multi-tenancy", "White-label branding", "Cross-tenant analytics",
     "Cost centers & chargeback", "Clone / migrate / export"]'::jsonb,
   'Lands the highest-value groups', true, 6),

  ('mobile', 'alacarte', 'Mobile Field Inspector', 'Offline-capable inspections from the floor.',
   'smartphone', '#2563eb',
   '["Offline inspection capture", "Camera, GPS & signature", "Background sync queue"]'::jsonb,
   'Per-seat, scales with the field', true, 7),

  -- Corrected tagline (§3.0 D2 Step 4.2, D-S13): addons.jsx:120's "beyond IATF
  -- 16949 & ISO 9001" no longer holds now some of those standards' modules
  -- are framework-included rather than paid depth.
  ('standards', 'alacarte', 'Extra Compliance Standards',
   'Per-standard compliance scorecards beyond IATF 16949 & ISO 9001.',
   'shieldCheck', '#16a34a',
   '["ISO 14001 (environment)", "OSHA / ISO 45001 (safety)", "Per-standard scorecards"]'::jsonb,
   'Each standard is its own line', true, 8),

  ('support', 'alacarte', 'Premium Support & SLA', 'Named CSM and a guaranteed response SLA.',
   'award', '#d97706',
   '["1-hour P1 response SLA", "Named customer success manager", "Quarterly business reviews"]'::jsonb,
   'The easiest add-on to sell', false, 9)
ON CONFLICT (id) DO NOTHING;

-- --- Pack -> module map (P0 AC1) ---------------------------------------------

INSERT INTO control.catalog_pack_modules (module_id, pack_id) VALUES
  ('graph', 'intelligence'),
  ('predictive', 'intelligence'),
  ('ai', 'intelligence'),
  ('suppliers', 'supplier'),
  ('supplier_analytics', 'supplier'),
  ('ppap', 'supplier'),
  ('scar', 'supplier'),
  ('portal', 'supplier'),
  ('fmea', 'qe'),
  ('spc', 'qe'),
  ('msa', 'qe'),
  ('risk', 'qe'),
  ('ecn', 'qe'),
  ('report_builder', 'platform'),
  ('integrations', 'platform')
ON CONFLICT (module_id) DO NOTHING;

-- --- Frameworks (approved 9, U-D4) -------------------------------------------
-- counts_as_extra_standard: true for all but IATF 16949 and ISO 9001
-- (reproduces addons.jsx:120's "beyond IATF 16949 & ISO 9001").

INSERT INTO control.catalog_frameworks (key, label, short_label, counts_as_extra_standard, sort_order) VALUES
  ('iatf_16949', 'IATF 16949:2016', 'IATF 16949', false, 1),
  ('iso_9001', 'ISO 9001:2015', 'ISO 9001', false, 2),
  ('iso_13485', 'ISO 13485:2016', 'ISO 13485', true, 3),
  ('as9100', 'AS9100D', 'AS9100D', true, 4),
  ('iso_14001', 'ISO 14001:2015', 'ISO 14001', true, 5),
  ('iso_45001', 'ISO 45001:2018', 'ISO 45001', true, 6),
  ('fda_qmsr', 'FDA QMSR (21 CFR 820)', 'FDA QMSR', true, 7),
  ('fda_part_11', 'FDA 21 CFR Part 11', 'Part 11', true, 8),
  ('haccp', 'HACCP', 'HACCP', true, 9)
ON CONFLICT (key) DO NOTHING;

-- --- Industries (approved 8, U-D4) -------------------------------------------
-- `other` is the reserved free-text-fallback key (O1 AC1). suggested_frameworks
-- pre-select O4 step 2 (O2 AC1); module_priors are additive boosts only (O2 AC2/AC3).

INSERT INTO control.catalog_industries (key, label, suggested_frameworks, module_priors, sort_order) VALUES
  ('automotive', 'Automotive', ARRAY['iatf_16949', 'iso_9001'],
   '{"fmea":1,"spc":1,"msa":1,"ppap":1,"suppliers":1,"scar":1,"eight_d":1,"complaints":1,"ecn":1}'::jsonb, 1),
  ('aerospace_defense', 'Aerospace & Defense', ARRAY['as9100'],
   '{"risk":1,"ecn":1,"audits":1,"suppliers":1,"calibration":1}'::jsonb, 2),
  ('medical_devices', 'Medical Devices', ARRAY['iso_13485'],
   '{"complaints":1,"capa":1,"documents":1,"training":1,"risk":1,"ecn":1}'::jsonb, 3),
  ('electronics', 'Electronics', ARRAY['iso_9001'],
   '{"spc":1,"suppliers":1,"inspections":1,"eight_d":1}'::jsonb, 4),
  ('pharmaceutical', 'Pharmaceutical', ARRAY['fda_part_11', 'iso_9001'],
   '{"documents":1,"training":1,"capa":1,"complaints":1,"audits":1}'::jsonb, 5),
  ('food_beverage', 'Food & Beverage', ARRAY['haccp', 'iso_9001'],
   '{"inspections":1,"ncr":1,"calibration":1,"training":1}'::jsonb, 6),
  ('general_manufacturing', 'General Manufacturing', ARRAY['iso_9001'], '{}'::jsonb, 7),
  ('other', 'Other', ARRAY[]::text[], '{}'::jsonb, 8)
ON CONFLICT (key) DO NOTHING;

-- --- Framework -> module rules (§3.0 D2 "Finalized framework -> module
-- mapping", Q-C11 DECIDED) --------------------------------------------------
-- R = required (free), S = supports (suggestion only). Plus floor `required`
-- rows per framework (O2 AC3) so onboarding can cite the clause, with no
-- commercial effect (the floor is free for everyone regardless).

INSERT INTO control.framework_module_rules (framework_key, module_id, level, clause) VALUES
  -- ISO 9001:2015
  ('iso_9001', 'ecn', 'required', '§8.5.6 / §8.3.6 — retain documented information on review of changes'),
  ('iso_9001', 'suppliers', 'required', '§8.4.1 — criteria for evaluation, selection, performance monitoring, re-evaluation'),
  ('iso_9001', 'spc', 'supports', '§9.1.1 — monitoring and measurement methods "as applicable"'),
  ('iso_9001', 'risk', 'supports', '§6.1, Annex A.4 — no requirement for formal risk-management methods'),
  ('iso_9001', 'scar', 'supports', '§8.4.2 / §10.2 — supplier corrective action via CAPA/8D'),
  ('iso_9001', 'supplier_analytics', 'supports', '§8.4.1 — per-supplier monitoring suffices on the free supplier record'),
  ('iso_9001', 'documents', 'required', '§7.5 — control of documented information'),
  ('iso_9001', 'training', 'required', '§7.2 — competence'),
  ('iso_9001', 'calibration', 'required', '§7.1.5.2 — measurement traceability'),
  ('iso_9001', 'audits', 'required', '§9.2 — internal audit'),
  ('iso_9001', 'ncr', 'required', '§8.7 — control of nonconforming outputs'),
  ('iso_9001', 'capa', 'required', '§10.2 — nonconformity and corrective action'),
  ('iso_9001', 'complaints', 'required', '§8.2.1(c) — customer feedback including complaints'),
  ('iso_9001', 'inspections', 'required', '§8.6 — release of products and services'),

  -- IATF 16949:2016 (+ ISO 9001 rows, seeded explicitly — no "implies" logic)
  ('iatf_16949', 'fmea', 'required', '§8.3.5.2 — PFMEA is a required process-design output'),
  ('iatf_16949', 'spc', 'required', '§9.1.1.1 / §9.1.1.2 — process studies and statistical tools'),
  ('iatf_16949', 'msa', 'required', '§7.1.5.1.1 — statistical studies of every measurement system'),
  ('iatf_16949', 'risk', 'required', '§6.1.2.1 / §6.1.2.3 — risk analysis with mandated inputs and documented contingency plans'),
  ('iatf_16949', 'ecn', 'required', '§8.5.6.1 — documented change process'),
  ('iatf_16949', 'suppliers', 'required', '§8.4.2.4 — supplier performance indicators'),
  ('iatf_16949', 'ppap', 'required', '§8.3.4.4 — product and manufacturing approval process'),
  ('iatf_16949', 'scar', 'supports', '§8.4.2.5 / §10.2.3 — supplier development recordable as 8D/CAPA'),
  ('iatf_16949', 'supplier_analytics', 'supports', '§8.4.2.4 — mandated indicators visible on the free supplier record'),
  ('iatf_16949', 'documents', 'required', '§7.5'),
  ('iatf_16949', 'training', 'required', '§7.2.1-7.2.3'),
  ('iatf_16949', 'calibration', 'required', '§7.1.5.2.1 — calibration/verification records'),
  ('iatf_16949', 'audits', 'required', '§9.2.2 — internal audit programme (system, process, product)'),
  ('iatf_16949', 'ncr', 'required', '§8.7.1'),
  ('iatf_16949', 'capa', 'required', '§10.2'),
  ('iatf_16949', 'complaints', 'required', '§10.2.6 — customer complaints and field-failure analysis'),
  ('iatf_16949', 'inspections', 'required', '§8.6'),
  ('iatf_16949', 'eight_d', 'required', '§10.2.3 — problem solving'),

  -- ISO 13485:2016
  ('iso_13485', 'risk', 'required', '§7.1 / §4.1.2(b) — documented risk-management processes (ISO 14971)'),
  ('iso_13485', 'ecn', 'required', '§7.3.9 / §4.1.4 — records of design changes, review, actions'),
  ('iso_13485', 'suppliers', 'required', '§7.4.1 — supplier evaluation/selection/monitoring/re-evaluation criteria'),
  ('iso_13485', 'fmea', 'supports', '§7.1 — an ISO 14971 technique; the risk module is the risk-management file'),
  ('iso_13485', 'spc', 'supports', '§8.1 / §8.4 — determine statistical techniques'),
  ('iso_13485', 'scar', 'supports', '§7.4.1 — addressed with the supplier via CAPA'),
  ('iso_13485', 'documents', 'required', '§4.2.4'),
  ('iso_13485', 'training', 'required', '§6.2'),
  ('iso_13485', 'calibration', 'required', '§7.6'),
  ('iso_13485', 'audits', 'required', '§8.2.4'),
  ('iso_13485', 'ncr', 'required', '§8.3'),
  ('iso_13485', 'capa', 'required', '§8.5.2'),
  ('iso_13485', 'complaints', 'required', '§8.2.2'),
  ('iso_13485', 'inspections', 'required', '§8.2.6'),

  -- FDA QMSR (21 CFR 820, incorporates ISO 13485) — same rows, own clause text
  ('fda_qmsr', 'risk', 'required', '21 CFR 820 incorporating ISO 13485 §7.1 / §4.1.2(b)'),
  ('fda_qmsr', 'ecn', 'required', '21 CFR 820 incorporating ISO 13485 §7.3.9 / §4.1.4'),
  ('fda_qmsr', 'suppliers', 'required', '21 CFR 820 incorporating ISO 13485 §7.4.1'),
  ('fda_qmsr', 'fmea', 'supports', '21 CFR 820 incorporating ISO 13485 §7.1'),
  ('fda_qmsr', 'spc', 'supports', '21 CFR 820 incorporating ISO 13485 §8.1 / §8.4'),
  ('fda_qmsr', 'scar', 'supports', '21 CFR 820 incorporating ISO 13485 §7.4.1'),
  ('fda_qmsr', 'documents', 'required', '21 CFR 820 incorporating ISO 13485 §4.2.4'),
  ('fda_qmsr', 'training', 'required', '21 CFR 820 incorporating ISO 13485 §6.2'),
  ('fda_qmsr', 'calibration', 'required', '21 CFR 820 incorporating ISO 13485 §7.6'),
  ('fda_qmsr', 'audits', 'required', '21 CFR 820 incorporating ISO 13485 §8.2.4'),
  ('fda_qmsr', 'ncr', 'required', '21 CFR 820 incorporating ISO 13485 §8.3'),
  ('fda_qmsr', 'capa', 'required', '21 CFR 820 incorporating ISO 13485 §8.5.2'),
  ('fda_qmsr', 'complaints', 'required', '21 CFR 820 incorporating ISO 13485 §8.2.2'),
  ('fda_qmsr', 'inspections', 'required', '21 CFR 820 incorporating ISO 13485 §8.2.6'),

  -- AS9100D (+ ISO 9001 rows)
  ('as9100', 'risk', 'required', '§8.1.1 — operational risk process with prescribed assessment criteria'),
  ('as9100', 'ecn', 'required', '§8.5.6 / §8.3.6 (ISO 9001 text) plus §8.1.2 configuration management'),
  ('as9100', 'suppliers', 'required', '§8.4.1 — register of external providers with approval status and scope'),
  ('as9100', 'fmea', 'supports', '§8.1.1'),
  ('as9100', 'spc', 'supports', '§8.5.1 — key characteristics'),
  ('as9100', 'ppap', 'supports', '§8.5.1.3 — production process verification (AS9145 analogue)'),
  ('as9100', 'scar', 'supports', '§10.2.1 — flow-down of corrective action to the external provider'),
  ('as9100', 'supplier_analytics', 'supports', '§8.4.1'),
  ('as9100', 'documents', 'required', '§7.5 (ISO 9001 text)'),
  ('as9100', 'training', 'required', '§7.2 (ISO 9001 text)'),
  ('as9100', 'calibration', 'required', '§7.1.5.2 (ISO 9001 text)'),
  ('as9100', 'audits', 'required', '§9.2 (ISO 9001 text)'),
  ('as9100', 'ncr', 'required', '§8.7 (ISO 9001 text)'),
  ('as9100', 'capa', 'required', '§10.2 (ISO 9001 text)'),
  ('as9100', 'complaints', 'required', '§8.2.1(c) (ISO 9001 text)'),
  ('as9100', 'inspections', 'required', '§8.6 (ISO 9001 text)'),

  -- HACCP (Codex CXC 1-1969, rev. 2020)
  ('haccp', 'risk', 'required', 'Principle 1 — hazard analysis, Principle 7 — documented'),
  ('haccp', 'ecn', 'supports', 'Principle 6 — review on change'),
  ('haccp', 'suppliers', 'supports', 'supplier approval is a prerequisite programme, not a HACCP principle'),
  ('haccp', 'inspections', 'required', 'Principle 4 — CCP monitoring'),
  ('haccp', 'ncr', 'required', 'Principle 5 — corrective actions'),
  ('haccp', 'capa', 'required', 'Principle 5 — corrective actions'),
  ('haccp', 'calibration', 'required', 'Principle 6 — verification'),
  ('haccp', 'audits', 'required', 'Principle 6 — verification'),
  ('haccp', 'documents', 'required', 'Principle 7 — records'),
  ('haccp', 'training', 'required', 'Principle 7 — records'),

  -- ISO 14001:2015
  ('iso_14001', 'risk', 'required', '§6.1.1 / §6.1.2 — risks, opportunities and significant environmental aspects, documented'),
  ('iso_14001', 'ecn', 'supports', '§8.1 — planned changes'),
  ('iso_14001', 'suppliers', 'supports', '§8.1 — outsourced processes'),
  ('iso_14001', 'audits', 'required', '§9.2'),
  ('iso_14001', 'documents', 'required', '§7.5'),
  ('iso_14001', 'capa', 'required', '§10.2'),
  ('iso_14001', 'ncr', 'required', '§10.2'),
  ('iso_14001', 'training', 'required', '§7.2'),
  ('iso_14001', 'inspections', 'required', '§9.1.1 — monitoring and measurement'),

  -- ISO 45001:2018
  ('iso_45001', 'risk', 'required', '§6.1.1 / §6.1.2 — hazard identification, OH&S risk assessment, documented'),
  ('iso_45001', 'ecn', 'supports', '§8.1.3 — management of change via a documented procedure plus CAPA'),
  ('iso_45001', 'suppliers', 'supports', '§8.1.4'),
  ('iso_45001', 'audits', 'required', '§9.2'),
  ('iso_45001', 'documents', 'required', '§7.5'),
  ('iso_45001', 'capa', 'required', '§10.2'),
  ('iso_45001', 'ncr', 'required', '§10.2'),
  ('iso_45001', 'training', 'required', '§7.2'),
  ('iso_45001', 'inspections', 'required', '§9.1.1 — monitoring and measurement'),

  -- FDA 21 CFR Part 11 — nothing beyond the floor (§11.10(e) audit trails are
  -- the platform audit log, not a module).
  ('fda_part_11', 'documents', 'required', '§11.10(k) — systems documentation controls'),
  ('fda_part_11', 'training', 'required', '§11.10(i) — training')
ON CONFLICT (framework_key, module_id) DO NOTHING;

-- --- Tiers (pricing.jsx:88-107) -----------------------------------------------

INSERT INTO control.catalog_tiers (id, name, blurb, features, packs, cta, sort_order) VALUES
  ('core', 'Core', 'Everything IATF 16949 requires.',
   '["Inspections · NCR · CAPA · 8D", "Audits & document control",
     "Calibration & training records", "Dashboards & core reports"]'::jsonb,
   ARRAY['mobile'], 'apply', 1),
  ('pro', 'Professional', 'Core + AI + quality engineering.',
   '["Everything in Core", "Kaenal Intelligence (AI)", "Quality Engineering pack",
     "Premium support add-on ready"]'::jsonb,
   ARRAY['intelligence', 'qe', 'mobile'], 'apply', 2),
  ('ent', 'Enterprise', 'Everything, fully governed.',
   '["Every add-on included", "SSO, SCIM, BYOK & DLP", "Multi-plant & white-label",
     "Named CSM + 1-hour SLA"]'::jsonb,
   ARRAY['intelligence', 'supplier', 'qe', 'platform', 'security', 'multiplant',
         'mobile', 'standards', 'support'],
   'sales', 3)
ON CONFLICT (id) DO NOTHING;

-- --- Price book v1 — jsx list prices, explicitly a placeholder (U-D3) -------

INSERT INTO control.price_book_versions (id, status, currency, note, published_at)
VALUES ('00000000-0000-7000-8000-000000000001'::uuid, 'published', 'USD',
        'placeholder price book (U-D3)', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO control.price_book_items (version_id, item_key, amount, unit, included_units, label) VALUES
  ('00000000-0000-7000-8000-000000000001'::uuid, 'core_base', 2400.00, 'month', 0, 'Core platform'),
  ('00000000-0000-7000-8000-000000000001'::uuid, 'pack:intelligence', 1200.00, 'month', 0, 'Kaenal Intelligence'),
  ('00000000-0000-7000-8000-000000000001'::uuid, 'pack:supplier', 18.00, 'supplier_month', 0, 'Supplier Network'),
  ('00000000-0000-7000-8000-000000000001'::uuid, 'pack:qe', 450.00, 'month', 0, 'Quality Engineering'),
  ('00000000-0000-7000-8000-000000000001'::uuid, 'pack:platform', 600.00, 'month', 0, 'Platform & Integrations'),
  ('00000000-0000-7000-8000-000000000001'::uuid, 'pack:security', NULL, 'custom', 0, 'Enterprise Security & Identity'),
  ('00000000-0000-7000-8000-000000000001'::uuid, 'pack:multiplant', 900.00, 'plant_month', 1, 'Multi-Plant & White-Label'),
  ('00000000-0000-7000-8000-000000000001'::uuid, 'pack:mobile', 9.00, 'inspector_month', 0, 'Mobile Field Inspector'),
  ('00000000-0000-7000-8000-000000000001'::uuid, 'pack:standards', 150.00, 'standard_month', 0, 'Extra Compliance Standards'),
  ('00000000-0000-7000-8000-000000000001'::uuid, 'pack:support', 2000.00, 'month', 0, 'Premium Support & SLA')
ON CONFLICT (version_id, item_key) DO NOTHING;

-- --- Grants -------------------------------------------------------------------
-- kaenal_app: read-only (every write in this file is migrator-only; 07C's
-- platform role gets write grants in its own migrations). kaenal_public:
-- USAGE on `control` (today only kaenal_app has it) plus column SELECT on the
-- two lookup tables, for the public "request a workspace" form (O3) — and
-- nothing else in `control`.

GRANT USAGE ON SCHEMA control TO kaenal_public;

GRANT SELECT ON control.catalog_packs, control.catalog_pack_modules,
                control.catalog_frameworks, control.catalog_industries,
                control.framework_module_rules, control.price_book_versions,
                control.price_book_items, control.catalog_tiers, control.catalog_meta
  TO kaenal_app;

GRANT SELECT (key, label, sort_order, active) ON control.catalog_industries TO kaenal_public;
GRANT SELECT (key, label, short_label, sort_order, active) ON control.catalog_frameworks TO kaenal_public;
