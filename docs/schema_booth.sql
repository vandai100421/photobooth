-- =============================================================================
-- Migration: booth shoot codes / media sessions / reconciliation
--   Quản lý mã chụp + lượt chụp cho 2 hệ thống Photobooth & Selfbooth.
--   Chạy trong Supabase SQL Editor sau docs/schema.sql (idempotent).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. booth_shoot_codes — cache mã chụp đồng bộ từ API ngoài.
--    Dedupe theo (system, code): chỉ thêm mã chưa có.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booth_shoot_codes (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  system              TEXT          NOT NULL
    CHECK (system IN ('photobooth', 'selfbooth')),
  external_id         TEXT,
  code                TEXT          NOT NULL,
  code_kind           TEXT,
  type                TEXT,
  package_id          TEXT,
  package_name        TEXT,
  value               DECIMAL(12,2),
  note                TEXT,
  status              TEXT,
  external_created_at TIMESTAMPTZ,
  raw                 JSONB,
  synced_at           TIMESTAMPTZ   DEFAULT NOW(),
  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (system, code)
);

CREATE INDEX IF NOT EXISTS booth_shoot_codes_system_idx
  ON public.booth_shoot_codes (system);
CREATE INDEX IF NOT EXISTS booth_shoot_codes_code_idx
  ON public.booth_shoot_codes (code);
CREATE INDEX IF NOT EXISTS booth_shoot_codes_created_idx
  ON public.booth_shoot_codes (system, external_created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. booth_media_sessions — cache lượt/ảnh đã chụp.
--    Dedupe theo (system, external_id). Nếu API không có id, backend sinh key.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booth_media_sessions (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  system       TEXT          NOT NULL
    CHECK (system IN ('photobooth', 'selfbooth')),
  external_id  TEXT          NOT NULL,
  code         TEXT,
  package_id   TEXT,
  media_count  INTEGER       DEFAULT 0,
  captured_at  TIMESTAMPTZ,
  raw          JSONB,
  synced_at    TIMESTAMPTZ   DEFAULT NOW(),
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (system, external_id)
);

CREATE INDEX IF NOT EXISTS booth_media_sessions_system_idx
  ON public.booth_media_sessions (system);
CREATE INDEX IF NOT EXISTS booth_media_sessions_code_idx
  ON public.booth_media_sessions (code);
CREATE INDEX IF NOT EXISTS booth_media_sessions_captured_idx
  ON public.booth_media_sessions (system, captured_at DESC);

-- -----------------------------------------------------------------------------
-- 3. booth_reconciliations — tiền nhân viên nhập tay theo ngày.
--    machine_cash: số tiền mặt máy đã ghi lại (theo mã).
--    actual_cash : số tiền mặt thực tế nhận tại quầy.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booth_reconciliations (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  system              TEXT          NOT NULL
    CHECK (system IN ('photobooth', 'selfbooth')),
  reconciliation_date DATE          NOT NULL,
  machine_cash        DECIMAL(12,2) DEFAULT 0 CHECK (machine_cash >= 0),
  actual_cash         DECIMAL(12,2) DEFAULT 0 CHECK (actual_cash >= 0),
  note                TEXT,
  created_by          UUID          REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (system, reconciliation_date)
);

CREATE INDEX IF NOT EXISTS booth_reconciliations_date_idx
  ON public.booth_reconciliations (system, reconciliation_date DESC);

-- -----------------------------------------------------------------------------
-- 4. Trigger updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booth_shoot_codes_updated_at ON public.booth_shoot_codes;
CREATE TRIGGER trg_booth_shoot_codes_updated_at
  BEFORE UPDATE ON public.booth_shoot_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_booth_media_sessions_updated_at ON public.booth_media_sessions;
CREATE TRIGGER trg_booth_media_sessions_updated_at
  BEFORE UPDATE ON public.booth_media_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_booth_reconciliations_updated_at ON public.booth_reconciliations;
CREATE TRIGGER trg_booth_reconciliations_updated_at
  BEFORE UPDATE ON public.booth_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
--    codes/sessions: mọi nhân viên SELECT; chỉ service_role ghi (backend sync).
--    reconciliations: admin/manager/staff đọc + ghi (nhân viên nhập tiền).
-- -----------------------------------------------------------------------------
ALTER TABLE public.booth_shoot_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booth_media_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booth_reconciliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booth_shoot_codes_select_all ON public.booth_shoot_codes;
CREATE POLICY booth_shoot_codes_select_all
  ON public.booth_shoot_codes FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS booth_media_sessions_select_all ON public.booth_media_sessions;
CREATE POLICY booth_media_sessions_select_all
  ON public.booth_media_sessions FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS booth_reconciliations_select_all ON public.booth_reconciliations;
CREATE POLICY booth_reconciliations_select_all
  ON public.booth_reconciliations FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS booth_reconciliations_write_all ON public.booth_reconciliations;
CREATE POLICY booth_reconciliations_write_all
  ON public.booth_reconciliations FOR ALL
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'))
  WITH CHECK (public.current_employee_role() IN ('admin', 'manager', 'staff'));

-- -----------------------------------------------------------------------------
-- 6. Quyền ngầm định
-- -----------------------------------------------------------------------------
REVOKE ALL ON public.booth_shoot_codes FROM anon, authenticated;
REVOKE ALL ON public.booth_media_sessions FROM anon, authenticated;
REVOKE ALL ON public.booth_reconciliations FROM anon, authenticated;

GRANT SELECT ON public.booth_shoot_codes TO authenticated;
GRANT SELECT ON public.booth_media_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booth_reconciliations TO authenticated;

GRANT ALL ON public.booth_shoot_codes TO service_role;
GRANT ALL ON public.booth_media_sessions TO service_role;
GRANT ALL ON public.booth_reconciliations TO service_role;
