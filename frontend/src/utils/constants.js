export const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const TOKEN_KEY = 'tap_photobooth_token';

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
};

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Quản lý' },
  { value: 'staff', label: 'Nhân viên' },
];

export const ROLE_BADGE_VARIANT = {
  admin: 'info',
  manager: 'warning',
  staff: 'default',
};

export const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Quản lý',
  staff: 'Nhân viên',
};

export const EMPLOYEE_STATUS_OPTIONS = [
  { value: 'true', label: 'Đang hoạt động' },
  { value: 'false', label: 'Đã vô hiệu' },
];

export const SHIFT_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Đã lên lịch' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'absent', label: 'Vắng mặt' },
];

export const SHIFT_STATUS_BADGE_VARIANT = {
  scheduled: 'info',
  completed: 'success',
  absent: 'danger',
};

export const SHIFT_STATUS_LABELS = {
  scheduled: 'Đã lên lịch',
  completed: 'Hoàn thành',
  absent: 'Vắng mặt',
};

export const SKILL_OPTIONS = [
  { value: 'photographer', label: 'Chụp ảnh' },
  { value: 'setup', label: 'Setup máy' },
  { value: 'cskh', label: 'CSKH' },
  { value: 'transport', label: 'Vận chuyển' },
  { value: 'sales', label: 'Bán hàng' },
];

export const SKILL_LABELS = {
  photographer: 'Chụp ảnh',
  setup: 'Setup máy',
  cskh: 'CSKH',
  transport: 'Vận chuyển',
  sales: 'Bán hàng',
};

export const SWAP_STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' },
];

export const SWAP_STATUS_BADGE_VARIANT = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export const SWAP_STATUS_LABELS = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

export const PAYOUT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ thanh toán' },
  { value: 'paid', label: 'Đã trả' },
];

export const PAYOUT_STATUS_BADGE_VARIANT = {
  pending: 'warning',
  paid: 'success',
};

export const PAYOUT_STATUS_LABELS = {
  pending: 'Chờ thanh toán',
  paid: 'Đã trả',
};

export const ADJUSTMENT_KIND_OPTIONS = [
  { value: 'bonus', label: 'Thưởng (+)' },
  { value: 'penalty', label: 'Phạt (−)' },
];

export const ADJUSTMENT_KIND_BADGE_VARIANT = {
  bonus: 'success',
  penalty: 'danger',
};

export const ADJUSTMENT_KIND_LABELS = {
  bonus: 'Thưởng',
  penalty: 'Phạt',
};

export const CUSTOMER_STATUS_OPTIONS = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Không hoạt động' },
  { value: 'vip', label: 'VIP' },
];

export const CUSTOMER_STATUS_BADGE_VARIANT = {
  active: 'success',
  inactive: 'danger',
  vip: 'warning',
};

export const CUSTOMER_STATUS_LABELS = {
  active: 'Đang hoạt động',
  inactive: 'Không hoạt động',
  vip: 'VIP',
};

export const CUSTOMER_GENDER_OPTIONS = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
];

export const CUSTOMER_GENDER_LABELS = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
};

export const BOOKING_STATUS_OPTIONS = [
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'no-show', label: 'Không đến' },
];

export const BOOKING_STATUS_BADGE_VARIANT = {
  completed: 'success',
  cancelled: 'danger',
  'no-show': 'warning',
};

export const BOOKING_STATUS_LABELS = {
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  'no-show': 'Không đến',
};

export const CUSTOMER_VOUCHER_STATUS_BADGE_VARIANT = {
  issued: 'info',
  used: 'success',
  expired: 'danger',
};

export const CUSTOMER_VOUCHER_STATUS_LABELS = {
  issued: 'Đã phát',
  used: 'Đã dùng',
  expired: 'Hết hạn',
};

export const CUSTOMER_VOUCHER_STATUS_OPTIONS = [
  { value: 'issued', label: 'Đã phát' },
  { value: 'used', label: 'Đã dùng' },
  { value: 'expired', label: 'Hết hạn' },
];

export const VOUCHER_TYPES = {
  BIRTHDAY: 'birthday',
  HOLIDAY: 'holiday',
  PROMO: 'promo',
  WELCOME: 'welcome',
};

export const VOUCHER_TYPE_OPTIONS = [
  { value: 'birthday', label: 'Sinh nhật' },
  { value: 'holiday', label: 'Ngày lễ' },
  { value: 'promo', label: 'Khuyến mãi' },
  { value: 'welcome', label: 'Chào mừng' },
];

export const VOUCHER_TYPE_BADGE_VARIANT = {
  birthday: 'info',
  holiday: 'warning',
  promo: 'success',
  welcome: 'default',
};

export const VOUCHER_TYPE_LABELS = {
  birthday: 'Sinh nhật',
  holiday: 'Ngày lễ',
  promo: 'Khuyến mãi',
  welcome: 'Chào mừng',
};

export const DISCOUNT_TYPES = {
  PERCENT: 'percent',
  FIXED: 'fixed',
};

export const DISCOUNT_TYPE_OPTIONS = [
  { value: 'percent', label: 'Phần trăm (%)' },
  { value: 'fixed', label: 'Số tiền cố định (VNĐ)' },
];

export const DISCOUNT_TYPE_LABELS = {
  percent: 'Phần trăm',
  fixed: 'Số tiền cố định',
};

export const POST_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PUBLISHED: 'published',
};

export const POST_STATUS_OPTIONS = [
  { value: 'draft', label: 'Bản nháp' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'published', label: 'Đã đăng' },
];

export const POST_STATUS_BADGE_VARIANT = {
  draft: 'default',
  pending: 'warning',
  published: 'success',
};

export const POST_STATUS_LABELS = {
  draft: 'Bản nháp',
  pending: 'Chờ duyệt',
  published: 'Đã đăng',
};

export const POST_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  ...POST_STATUS_OPTIONS,
];

export const HOLIDAY_RECURRING_OPTIONS = [
  { value: 'true', label: 'Hàng năm' },
  { value: 'false', label: 'Một lần' },
];

export const HOLIDAY_RECURRING_LABELS = {
  true: 'Hàng năm',
  false: 'Một lần',
};

export const HOLIDAY_RECURRING_BADGE_VARIANT = {
  true: 'success',
  false: 'default',
};

export const HOLIDAY_ACTIVE_OPTIONS = [
  { value: 'true', label: 'Đang hoạt động' },
  { value: 'false', label: 'Đã vô hiệu' },
];

export const MESSAGE_CHANNELS = {
  ZALO: 'zalo',
  EMAIL: 'email',
  SMS: 'sms',
};

export const MESSAGE_CHANNEL_OPTIONS = [
  { value: 'zalo', label: 'Zalo' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
];

export const MESSAGE_CHANNEL_BADGE_VARIANT = {
  zalo: 'info',
  email: 'warning',
  sms: 'default',
};

export const MESSAGE_CHANNEL_LABELS = {
  zalo: 'Zalo',
  email: 'Email',
  sms: 'SMS',
};

export const MESSAGE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
  DELIVERED: 'delivered',
};

export const MESSAGE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ gửi' },
  { value: 'sent', label: 'Đã gửi' },
  { value: 'failed', label: 'Lỗi' },
  { value: 'delivered', label: 'Đã nhận' },
];

export const MESSAGE_STATUS_BADGE_VARIANT = {
  pending: 'warning',
  sent: 'success',
  failed: 'danger',
  delivered: 'info',
};

export const MESSAGE_STATUS_LABELS = {
  pending: 'Chờ gửi',
  sent: 'Đã gửi',
  failed: 'Lỗi',
  delivered: 'Đã nhận',
};

export const TEMPLATE_OCCASIONS = {
  BIRTHDAY: 'birthday',
  TET: 'tet',
  GIANGSINH: 'giangsinh',
  WOMENS_DAY: '8_3',
  VIETNAMESE_WOMENS_DAY: '20_10',
  VALENTINE: 'valentine',
  PROMO: 'promo',
  WELCOME: 'welcome',
  CUSTOM: 'custom',
};

export const TEMPLATE_OCCASION_OPTIONS = [
  { value: 'birthday', label: 'Sinh nhật' },
  { value: 'tet', label: 'Tết' },
  { value: 'giangsinh', label: 'Giáng sinh' },
  { value: '8_3', label: '8/3' },
  { value: '20_10', label: '20/10' },
  { value: 'valentine', label: 'Valentine' },
  { value: 'promo', label: 'Khuyến mãi' },
  { value: 'welcome', label: 'Chào mừng' },
  { value: 'custom', label: 'Tùy chỉnh' },
];

export const TEMPLATE_OCCASION_BADGE_VARIANT = {
  birthday: 'info',
  tet: 'warning',
  giangsinh: 'info',
  '8_3': 'warning',
  '20_10': 'warning',
  valentine: 'danger',
  promo: 'success',
  welcome: 'default',
  custom: 'default',
};

export const TEMPLATE_OCCASION_LABELS = {
  birthday: 'Sinh nhật',
  tet: 'Tết',
  giangsinh: 'Giáng sinh',
  '8_3': '8/3',
  '20_10': '20/10',
  valentine: 'Valentine',
  promo: 'Khuyến mãi',
  welcome: 'Chào mừng',
  custom: 'Tùy chỉnh',
};

export const TEMPLATE_VARIABLES = [
  '{{customer_name}}',
  '{{voucher_code}}',
  '{{shop_name}}',
  '{{year}}',
];

export const TEMPLATE_SAMPLE_VARS = {
  customer_name: 'Nguyễn Văn A',
  voucher_code: 'TAP-DEMO01',
  shop_name: 'THE TAP',
  year: '2026',
};

export const DEFAULT_PAGE_SIZE = 20;

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  EMPLOYEES: '/employees',
  CUSTOMERS: '/customers',
  VOUCHERS: '/vouchers',
  BOOKINGS: '/bookings',
  POSTS: '/posts',
  HOLIDAYS: '/holidays',
  MESSAGES: '/messages',
  REPORTS: '/reports',
  SETTINGS: '/settings',
  SCHEDULE: '/schedule',
  REWARDS: '/rewards',
  SHOOT: '/shoot-codes',
  PORTAL_REVENUE: '/portal-revenue',
};

// Cấu hình API Portal Photobooth ngoài (external).
export const PHOTOBOOTH_PORTAL = {
  BASE_URL: 'https://photobooth-api.boothstudio2026.workers.dev',
  TENANT: 'thetap@studio.vn',
};

// Phương thức thanh toán trong response revenue portal.
export const PORTAL_PAYMENT_METHOD_LABELS = {
  cash: 'Tiền mặt',
  voucher: 'Voucher',
  transfer: 'Chuyển khoản',
};

export const PORTAL_PAYMENT_METHOD_BADGE_VARIANT = {
  cash: 'success',
  voucher: 'warning',
  transfer: 'info',
};

export const BOOTH_SYSTEMS = {
  PHOTOBOOTH: 'photobooth',
  SELFBOOTH: 'selfbooth',
};

export const BOOTH_SYSTEM_OPTIONS = [
  { value: 'photobooth', label: 'Photobooth' },
  { value: 'selfbooth', label: 'Selfbooth' },
];

export const BOOTH_SYSTEM_LABELS = {
  photobooth: 'Photobooth',
  selfbooth: 'Selfbooth',
};

// Ghi chú khi tạo mã chụp (dùng chung 2 hệ thống).
export const BOOTH_NOTE_OPTIONS = [
  { value: 'Tiền mặt tại quầy', label: 'Tiền mặt tại quầy' },
  { value: 'Chuyển khoản tại quầy', label: 'Chuyển khoản tại quầy' },
];

// Loại mã Selfbooth (boothme.tech): dùng 1 lần / dùng lại.
export const SELFBOOTH_CODE_KIND_OPTIONS = [
  { value: 'single', label: 'Dùng 1 lần' },
  { value: 'reusable', label: 'Dùng lại' },
];

// Nhãn các chỉ số doanh thu Selfbooth (field trong response.summary).
export const BOOTH_REVENUE_SUMMARY_LABELS = {
  used_codes: 'Mã đã dùng',
  code_revenue_vnd: 'Doanh thu từ mã (đ)',
  single_uses: 'Lượt dùng 1 lần',
  reusable_uses: 'Lượt dùng lại',
  local_uses: 'Lượt tại máy',
};

// Loại mã Photobooth: giảm giá = cash, tiền mặt = cash_code.
export const PHOTOBOOTH_CODE_TYPE_OPTIONS = [
  { value: 'cash', label: 'Giảm giá (cash)' },
  { value: 'cash_code', label: 'Tiền mặt (cash_code)' },
];

export const PHOTOBOOTH_CODE_TYPE_LABELS = {
  cash: 'Giảm giá',
  cash_code: 'Tiền mặt',
};

// Trạng thái mã chụp suy diễn (backend trả về ở field derived_status).
export const BOOTH_CODE_STATUS_LABELS = {
  used: 'Đã dùng',
  unused: 'Chưa dùng',
  error: 'Lỗi',
  revoked: 'Đã huỷ',
  missing_session: 'Thiếu lượt chụp',
  orphan: 'Mã đã xóa',
};

export const BOOTH_CODE_STATUS_BADGE_VARIANT = {
  used: 'success',
  unused: 'warning',
  error: 'danger',
  revoked: 'default',
  missing_session: 'warning',
  orphan: 'danger',
};

// Bộ lọc dùng cho bảng sổ doanh thu (gộp mã chụp + lượt dùng mã đã xóa).
export const BOOTH_LEDGER_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'unused', label: 'Chưa dùng' },
  { value: 'used', label: 'Đã dùng' },
  { value: 'error', label: 'Lỗi' },
  { value: 'missing_session', label: 'Thiếu lượt' },
  { value: 'revoked', label: 'Đã huỷ' },
  { value: 'orphan', label: 'Mã đã xóa' },
];

export const BOOTH_CODE_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'unused', label: 'Chưa dùng' },
  { value: 'used', label: 'Đã dùng' },
  { value: 'error', label: 'Lỗi' },
  { value: 'missing_session', label: 'Thiếu lượt' },
  { value: 'revoked', label: 'Đã huỷ' },
];

// Lý do lỗi chọn sẵn cho nhân viên.
export const BOOTH_ERROR_REASON_OPTIONS = [
  { value: 'Hết giấy in', label: 'Hết giấy in' },
  { value: 'Lỗi máy ảnh', label: 'Lỗi máy ảnh' },
  { value: 'Khách huỷ', label: 'Khách huỷ' },
  { value: 'Mất kết nối mạng', label: 'Mất kết nối mạng' },
  { value: 'Máy bị treo', label: 'Máy bị treo' },
  { value: 'Khác', label: 'Khác' },
];

export const BOOTH_STAFF_STATUS_OPTIONS = [
  { value: 'error', label: 'Báo lỗi' },
  { value: 'resolved', label: 'Đã xử lý' },
  { value: 'ok', label: 'Bình thường' },
];

export const BOOTH_STAFF_STATUS_BADGE_VARIANT = {
  error: 'danger',
  resolved: 'success',
  ok: 'info',
};

export const NAV_ITEMS = [
  { to: ROUTES.DASHBOARD, label: 'Dashboard', icon: '📊' },
  { to: ROUTES.EMPLOYEES, label: 'Nhân viên', icon: '👤' },
  { to: ROUTES.SCHEDULE, label: 'Lịch công tác', icon: '📅' },
  { to: ROUTES.REWARDS, label: 'KPI & Thưởng', icon: '💰' },
  { to: ROUTES.CUSTOMERS, label: 'Khách hàng', icon: '👥' },
  { to: ROUTES.VOUCHERS, label: 'Voucher', icon: '🎟️' },
  { to: ROUTES.SHOOT, label: 'Mã chụp', icon: '📸' },
  { to: ROUTES.PORTAL_REVENUE, label: 'Tổng hợp doanh thu', icon: '🧾' },
  { to: ROUTES.BOOKINGS, label: 'Booking', icon: '📆' },
  { to: ROUTES.POSTS, label: 'Bài viết', icon: '📝' },
  { to: ROUTES.HOLIDAYS, label: 'Ngày lễ', icon: '🎉' },
  { to: ROUTES.MESSAGES, label: 'Tin nhắn', icon: '💬' },
  { to: ROUTES.REPORTS, label: 'Báo cáo', icon: '📈' },
  { to: ROUTES.SETTINGS, label: 'Cài đặt', icon: '⚙️' },
];
