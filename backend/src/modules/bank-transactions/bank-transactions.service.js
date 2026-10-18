const supabase = require('../../config/supabase');
const AppError = require('../../utils/AppError');

const TABLE = 'bank_transactions';

const COLUMNS = [
  'id',
  'sepay_id',
  'gateway',
  'transaction_date',
  'account_number',
  'sub_account',
  'code',
  'content',
  'transfer_type',
  'transfer_amount',
  'accumulated',
  'reference_code',
  'description',
  'created_at',
].join(', ');

// Liệt kê giao dịch ngân hàng, mới nhất trước.
//   after_id  → chỉ trả giao dịch có sepay_id LỚN HƠN giá trị này
//               (dùng cho frontend polling phát hiện giao dịch mới).
//   transfer_type → lọc 'in' / 'out'.
//   limit → số dòng tối đa (mặc định 20).
const findAll = async ({ after_id, transfer_type, limit = 20 } = {}) => {
  let query = supabase
    .from(TABLE)
    .select(COLUMNS)
    .order('sepay_id', { ascending: false })
    .limit(limit);

  if (after_id !== undefined && after_id !== null) {
    query = query.gt('sepay_id', after_id);
  }
  if (transfer_type) {
    query = query.eq('transfer_type', transfer_type);
  }

  const { data, error } = await query;
  if (error) {
    throw new AppError(
      `Failed to fetch bank transactions: ${error.message}`,
      500,
    );
  }
  return data || [];
};

// Giao dịch có sepay_id lớn nhất hiện có — dùng làm mốc khởi tạo cho poller
// (tránh thông báo lại toàn bộ lịch sử khi mới mở trang).
const findLatest = async () => {
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .order('sepay_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError(
      `Failed to fetch latest bank transaction: ${error.message}`,
      500,
    );
  }
  return data || null;
};

module.exports = {
  findAll,
  findLatest,
};
