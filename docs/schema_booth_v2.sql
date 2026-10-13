-- =============================================================================
-- Migration: booth v2 — bổ sung cột theo shape THẬT của API ngoài
--   Chạy sau docs/schema_booth.sql (idempotent, ALTER TABLE ... IF NOT EXISTS).
--
--   Nguồn: dò trực tiếp 2 API ngoài (2026-10-11).
--   - Photobooth: POST /auth/login {email,password,studio_name}
--       GET /portal/{tenant}/vouchers, /portal/{tenant}/media-sessions
--   - Selfbooth : POST /v1/auth/login {login,password,remember}
--       GET /v1/portal/shoot-codes, /v1/portal/sessions, /v1/portal/shoot-packages
--
--   Liên kết mã ↔ lượt chụp:
--   - Photobooth: voucher.redeemed_session_id = media_session.session_id  (session KHÔNG có code)
--   - Selfbooth : session.code_used          = shoot_code.code
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. booth_shoot_codes — bổ sung cột.
--    Chung  : value, note, package_*, external_created_at, status
--    PB     : type, valid_from/until, package_prints, shift, phone, revoked,
--             used/used_at, redeemed_*, paid_amount, created_via/by, branch_id
--    SB     : code_kind, minutes, use_count, expires_at, cancelled_*,
--             machine_name, redeemed_*, paid_amount, created_via/by
-- -----------------------------------------------------------------------------
ALTER TABLE public.booth_shoot_codes
  ADD COLUMN IF NOT EXISTS package_key          TEXT,
  ADD COLUMN IF NOT EXISTS minutes             INTEGER,
  ADD COLUMN IF NOT EXISTS package_prints      INTEGER,
  ADD COLUMN IF NOT EXISTS use_count           INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS used                BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS used_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked             BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS valid_from          DATE,
  ADD COLUMN IF NOT EXISTS valid_until         DATE,
  ADD COLUMN IF NOT EXISTS expires_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by        TEXT,
  ADD COLUMN IF NOT EXISTS created_via         TEXT,
  ADD COLUMN IF NOT EXISTS created_by          TEXT,
  ADD COLUMN IF NOT EXISTS shift               TEXT,
  ADD COLUMN IF NOT EXISTS phone               TEXT,
  ADD COLUMN IF NOT EXISTS paid_amount         DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS redeemed_hwid       TEXT,
  ADD COLUMN IF NOT EXISTS redeemed_session_id TEXT,
  ADD COLUMN IF NOT EXISTS redeemed_by_emp     INTEGER,
  ADD COLUMN IF NOT EXISTS machine_name        TEXT,
  ADD COLUMN IF NOT EXISTS owner_email         TEXT,
  ADD COLUMN IF NOT EXISTS branch_id           TEXT;

CREATE INDEX IF NOT EXISTS booth_shoot_codes_redeemed_session_idx
  ON public.booth_shoot_codes (system, redeemed_session_id);

-- -----------------------------------------------------------------------------
-- 2. booth_media_sessions — bổ sung cột.
--    PB: hwid, device_name, photos_captured, total_prints, status, capture_*
--    SB: code_used, code_kind, package_name, amount, revenue, total_prints,
--        prints_cut/nocut, is_test, source, failure_*, gallery_*
-- -----------------------------------------------------------------------------
ALTER TABLE public.booth_media_sessions
  ADD COLUMN IF NOT EXISTS code_kind       TEXT,
  ADD COLUMN IF NOT EXISTS package_name    TEXT,
  ADD COLUMN IF NOT EXISTS total_prints    INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prints_cut      INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prints_nocut    INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status          TEXT,
  ADD COLUMN IF NOT EXISTS hwid            TEXT,
  ADD COLUMN IF NOT EXISTS device_name     TEXT,
  ADD COLUMN IF NOT EXISTS ended_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS amount          DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue         DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source          TEXT,
  ADD COLUMN IF NOT EXISTS is_test         BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finish_reason   TEXT,
  ADD COLUMN IF NOT EXISTS expected_photos INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cover_image     TEXT;

CREATE INDEX IF NOT EXISTS booth_media_sessions_code_match_idx
  ON public.booth_media_sessions (system, code);

-- =============================================================================
-- End of migration.
-- =============================================================================
