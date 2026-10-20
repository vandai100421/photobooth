-- =============================================================================
-- Migration: booth v4 — nhãn xử lý theo LƯỚT CHỤP (ngoài mã chụp).
--   Chạy sau docs/schema_booth.sql + schema_booth_v2.sql + schema_booth_v3.sql
--   (idempotent).
--
--   Lý do: phần lớn lượt Photobooth là khách chụp trực tiếp — không có mã —
--   nên không ghi được "lý do lỗi" (chất lượng ảnh / in ...) nếu chỉ gắn theo
--   mã. Bảng booth_code_reviews nay hỗ trợ session_id và mỗi bản ghi là một
--   "nhãn xử lý" duy nhất theo (system, mark_key).
-- =============================================================================

ALTER TABLE public.booth_code_reviews
  ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Cho phép bản ghi chỉ có session_id (khách chụp trực tiếp).
ALTER TABLE public.booth_code_reviews
  ALTER COLUMN code DROP NOT NULL;

ALTER TABLE public.booth_code_reviews
  DROP CONSTRAINT IF EXISTS booth_code_reviews_system_code_key;

-- Khóa gộp: ưu tiên mã, không có mã thì dùng lượt chụp.
ALTER TABLE public.booth_code_reviews
  ADD COLUMN IF NOT EXISTS mark_key TEXT
    GENERATED ALWAYS AS (COALESCE(NULLIF(code, ''), session_id)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS booth_code_reviews_mark_key_uniq
  ON public.booth_code_reviews (system, mark_key);

CREATE INDEX IF NOT EXISTS booth_code_reviews_session_idx
  ON public.booth_code_reviews (session_id);

COMMENT ON COLUMN public.booth_code_reviews.session_id IS
  'Lượt chụp liên kết (booth_media_sessions.external_id) — dùng khi không có mã.';
COMMENT ON COLUMN public.booth_code_reviews.mark_key IS
  'Khóa gộp COALESCE(code, session_id) — mỗi nhãn xử lý là 1 dòng duy nhất.';

-- =============================================================================
-- End of migration.
-- =============================================================================
