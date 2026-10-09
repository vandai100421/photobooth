-- =============================================================================
-- TAP Photobooth Management — HR Extension Migration v2
-- Version: 2.0.0
--
-- Bổ sung:
--   - employee_adjustments   : admin thưởng/phạt thủ công cho NV (KPI & thù lao)
--   - bonus rules mới        : bài viết được đăng, feedback tốt, feedback xấu
--
-- Yêu cầu: chạy schema.sql trước, rồi schema_hr.sql, rồi file này.
-- Idempotent: chạy lại nhiều lần vẫn an toàn.
-- =============================================================================


-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1.1  employee_adjustments
--      Khoản thưởng (+) hoặc phạt (−) do quản trị viên quyết định, gắn với
--      đúng 1 tháng (period_month) để cộng vào KPI + thù lao tháng đó.
--      amount luôn dương; dấu quyết định bởi kind (bonus → +, penalty → −).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_adjustments (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID          NOT NULL
    REFERENCES public.employees(id) ON DELETE CASCADE,
  kind          VARCHAR(10)   NOT NULL
    CHECK (kind IN ('bonus','penalty')),
  amount        DECIMAL(12,2) NOT NULL
    CHECK (amount > 0),
  reason        TEXT          NOT NULL,
  source        VARCHAR(20)   DEFAULT 'manual'
    CHECK (source IN ('manual','feedback')),
  feedback_id   UUID
    REFERENCES public.customer_feedback(id) ON DELETE SET NULL,
  period_month  VARCHAR(7)    NOT NULL
    CHECK (period_month ~ '^\d{4}-\d{2}$'),
  created_by    UUID
    REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);


-- =============================================================================
-- 2. INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_employee_adjustments_employee_id  ON public.employee_adjustments (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_adjustments_period_month ON public.employee_adjustments (period_month);
CREATE INDEX IF NOT EXISTS idx_employee_adjustments_kind         ON public.employee_adjustments (kind);

-- Truy vấn KPI theo tháng: lọc theo period_month trước.
CREATE INDEX IF NOT EXISTS idx_employee_adjustments_month_emp
  ON public.employee_adjustments (period_month, employee_id);


-- =============================================================================
-- 3. TRIGGERS
-- =============================================================================
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trg_employee_adjustments_updated_at
    ON public.employee_adjustments;
  CREATE TRIGGER trg_employee_adjustments_updated_at
    BEFORE UPDATE ON public.employee_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
END $$;


-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.employee_adjustments ENABLE ROW LEVEL SECURITY;

-- Ai cũng xem được (để NV thấy mình bị thưởng/phạt vì lý do gì).
DROP POLICY IF EXISTS employee_adjustments_select_all
  ON public.employee_adjustments;
CREATE POLICY employee_adjustments_select_all
  ON public.employee_adjustments FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

-- Chỉ admin thêm/sửa/xoá khoản thưởng-phạt.
DROP POLICY IF EXISTS employee_adjustments_admin_all
  ON public.employee_adjustments;
CREATE POLICY employee_adjustments_admin_all
  ON public.employee_adjustments FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');


-- =============================================================================
-- 5. SEED DATA — quy tắc thưởng mới
--      post_published : mỗi bài viết NV viết và được đăng trong tháng.
--      good_feedback  : mỗi feedback KH từ 4★ trở lên.
--      bad_feedback   : mỗi feedback KH từ 2★ trở xuống (số tiền âm = phạt).
-- =============================================================================
INSERT INTO public.employee_bonus_rules (code, name, amount, multiplier, is_active) VALUES
  ('post_published',  'Bài viết được đăng',            50000,  1.00, TRUE),
  ('good_feedback',   'KH đánh giá tốt (từ 4★)',      30000,  1.00, TRUE),
  ('bad_feedback',    'KH đánh giá kém (từ 2★ trở xuống)', -50000, 1.00, TRUE)
ON CONFLICT (code) DO NOTHING;


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================