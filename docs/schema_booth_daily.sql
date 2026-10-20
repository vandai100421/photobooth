-- =============================================================================
-- Migration: booth_daily_revenue
--   Doanh thu theo NGÀY của 2 hệ máy chụp (Photobooth / Selfbooth), ghi khi
--   bấm "Đồng bộ" ở trang Mã chụp. Dashboard cộng bảng này với daily_revenue.
--
--   Lý do tách bảng riêng: daily_revenue đã UNIQUE(revenue_date) cho phần nhập
--   tay — không thể gộp 2 nguồn vào 1 dòng nếu khác nhau.
--   Chạy trong Supabase SQL Editor sau docs/schema_booth.sql (idempotent).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.booth_daily_revenue (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  system       TEXT          NOT NULL
    CHECK (system IN ('photobooth', 'selfbooth')),
  revenue_date DATE          NOT NULL,
  amount       DECIMAL(12,2) NOT NULL DEFAULT 0
    CHECK (amount >= 0),
  synced_at    TIMESTAMPTZ   DEFAULT NOW(),
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (system, revenue_date)
);

CREATE INDEX IF NOT EXISTS booth_daily_revenue_date_idx
  ON public.booth_daily_revenue (revenue_date DESC);

CREATE INDEX IF NOT EXISTS booth_daily_revenue_system_idx
  ON public.booth_daily_revenue (system);

COMMENT ON TABLE public.booth_daily_revenue IS
  'Doanh thu theo ngày của từng hệ máy chụp, ghi khi đồng bộ — Dashboard cộng vào.';
COMMENT ON COLUMN public.booth_daily_revenue.revenue_date IS
  'Ngày ghi doanh thu (YYYY-MM-DD), timezone Việt Nam.';
COMMENT ON COLUMN public.booth_daily_revenue.synced_at IS
  'Thời điểm đồng bộ gần nhất từ API hệ máy chụp.';

-- Trigger updated_at (dùng hàm đã tạo ở schema.sql / schema_booth.sql).
DROP TRIGGER IF EXISTS trg_booth_daily_revenue_updated_at ON public.booth_daily_revenue;
CREATE TRIGGER trg_booth_daily_revenue_updated_at
  BEFORE UPDATE ON public.booth_daily_revenue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- RLS: admin/manager/staff đọc; backend ghi bằng service_role.
-- -----------------------------------------------------------------------------
ALTER TABLE public.booth_daily_revenue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booth_daily_revenue_select_all ON public.booth_daily_revenue;
CREATE POLICY booth_daily_revenue_select_all
  ON public.booth_daily_revenue FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

REVOKE ALL ON public.booth_daily_revenue FROM anon, authenticated;
GRANT SELECT ON public.booth_daily_revenue TO authenticated;
GRANT ALL ON public.booth_daily_revenue TO service_role;

-- =============================================================================
-- End of migration.
-- =============================================================================
