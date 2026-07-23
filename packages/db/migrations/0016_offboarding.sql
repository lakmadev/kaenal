-- 0016_offboarding.sql
--
-- Tenant offboarding lifecycle (01 §3.4, 06 §1 `housekeeping` → `offboardTenant`,
-- 07 §5). Offboarding is a staged, reversible-until-purged flow driven off the
-- control registry:
--
--   active/suspended --offboard-tenant--> offboarding  (logins blocked, grace clock starts)
--                     --grace elapsed + no legal hold + export taken--> offboarded (data purged)
--
-- `offboarding_at` stamps when the 30-day grace began; `offboarding_export_key`
-- records the S3 location of the mandated pre-purge export bundle (07 §5 — the
-- export is part of the offboarding bundle); `offboarded_at` marks completion.
-- A terminal `offboarded` status keeps the registry row (Model A shared) so the
-- slug stays reserved and the outcome is auditable.

ALTER TABLE control.tenants ADD COLUMN IF NOT EXISTS offboarding_at         timestamptz;
ALTER TABLE control.tenants ADD COLUMN IF NOT EXISTS offboarded_at          timestamptz;
ALTER TABLE control.tenants ADD COLUMN IF NOT EXISTS offboarding_export_key text;

-- Widen the status CHECK to admit the terminal state. The inline constraint from
-- 0000 is named tenants_status_check by Postgres convention.
ALTER TABLE control.tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE control.tenants ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('active','suspended','offboarding','offboarded','provisioning_failed'));
