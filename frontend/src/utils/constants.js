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
};

export const NAV_ITEMS = [
  { to: ROUTES.DASHBOARD, label: 'Dashboard', icon: '📊' },
  { to: ROUTES.EMPLOYEES, label: 'Nhân viên', icon: '👤' },
  { to: ROUTES.SCHEDULE, label: 'Lịch công tác', icon: '📅' },
  { to: ROUTES.REWARDS, label: 'KPI & Thưởng', icon: '💰' },
  { to: ROUTES.CUSTOMERS, label: 'Khách hàng', icon: '👥' },
  { to: ROUTES.VOUCHERS, label: 'Voucher', icon: '🎟️' },
  { to: ROUTES.BOOKINGS, label: 'Booking', icon: '📆' },
  { to: ROUTES.POSTS, label: 'Bài viết', icon: '📝' },
  { to: ROUTES.HOLIDAYS, label: 'Ngày lễ', icon: '🎉' },
  { to: ROUTES.MESSAGES, label: 'Tin nhắn', icon: '💬' },
  { to: ROUTES.REPORTS, label: 'Báo cáo', icon: '📈' },
  { to: ROUTES.SETTINGS, label: 'Cài đặt', icon: '⚙️' },
];
