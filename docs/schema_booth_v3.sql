-- =============================================================================
-- Migration: booth v3 — ghi chú / trạng thái xử lý mã chụp do nhân viên nhập.
--   Chạy sau docs/schema_booth.sql + docs/schema_booth_v2.sql (idempotent).
--
--   Mục đích:
--   - Tách riêng khỏi cache API (booth_shoot_codes) để re-sync KHÔNG ghi đè.
--   - Nhân viên đánh dấu mã "Báo lỗi"/"Đã xử lý" + chọn lý do + ghi chú tự do.
--   - Trạng thái "Lỗi" tự động vẫn suy diễn từ lượt chụp; bảng này chỉ lưu
--     phần con người bổ sung.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.booth_code_reviews (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  system       TEXT          NOT NULL
    CHECK (system IN ('photobooth', 'selfbooth')),
  code         TEXT          NOT NULL,
  -- 'error' = nhân viên báo lỗi, 'resolved' = đã xử lý, 'ok' = xác nhận bình thường.
  staff_status TEXT          CHECK (staff_status IN ('ok', 'error', 'resolved')),
  staff_reason TEXT,
  staff_note   TEXT,
  reviewed_by  UUID          REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (system, code)
);

CREATE INDEX IF NOT EXISTS booth_code_reviews_system_idx
  ON public.booth_code_reviews (system);

-- Trigger updated_at (dùng hàm public.update_updated_at_column đã tạo ở schema_booth.sql).
DROP TRIGGER IF EXISTS trg_booth_code_reviews_updated_at ON public.booth_code_reviews;
CREATE TRIGGER trg_booth_code_reviews_updated_at
  BEFORE UPDATE ON public.booth_code_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- RLS: admin/manager/staff đọc + ghi (nhân viên chủ động nhập lý do).
-- -----------------------------------------------------------------------------
ALTER TABLE public.booth_code_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booth_code_reviews_select_all ON public.booth_code_reviews;
CREATE POLICY booth_code_reviews_select_all
  ON public.booth_code_reviews FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS booth_code_reviews_write_all ON public.booth_code_reviews;
CREATE POLICY booth_code_reviews_write_all
  ON public.booth_code_reviews FOR ALL
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'))
  WITH CHECK (public.current_employee_role() IN ('admin', 'manager', 'staff'));

REVOKE ALL ON public.booth_code_reviews FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booth_code_reviews TO authenticated;
GRANT ALL ON public.booth_code_reviews TO service_role;

-- =============================================================================
-- End of migration.
-- =============================================================================
