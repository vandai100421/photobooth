const supabase = require('../../config/supabase');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const boothClient = require('../../services/boothClient');

const CODES_TABLE = 'booth_shoot_codes';
const SESSIONS_TABLE = 'booth_media_sessions';
const RECON_TABLE = 'booth_reconciliations';
const REVIEWS_TABLE = 'booth_code_reviews';
const BOOTH_DAILY_TABLE = 'booth_daily_revenue';
const SETTINGS_TABLE = 'settings';

// Trạng thái lượt chụp bị coi là "có vấn đề" → mã tương ứng là Lỗi.
const PROBLEM_SESSION_STATUS = new Set([
  'CANCELLED',
  'CAMERA_ERROR',
  'PARTIAL',
  'FAILED',
  'ERROR',
  'ABORTED',
]);

// Mã coi như đã dùng nếu API báo used/status USED/used_at hoặc use_count > 0.
// Selfbooth trả status 'used' (chữ thường) + used_at thay vì cờ `used`.
const isCodeUsed = (c) =>
  Boolean(c.used) ||
  String(c.status || '').toUpperCase() === 'USED' ||
  Boolean(c.used_at) ||
  Boolean(c.redeemed_session_id) ||
  (Number(c.use_count) || 0) > 0;

// Lượt chụp có dấu hiệu lỗi (theo status + field raw của Selfbooth).
const sessionHasProblem = (s) => {
  if (!s) return false;
  if (PROBLEM_SESSION_STATUS.has(String(s.status || '').toUpperCase())) {
    return true;
  }
  const raw = s.raw || {};
  if (Number(raw.had_camera_error) > 0) return true;
  if (raw.failure_code && String(raw.failure_code).trim() !== '') return true;
  return false;
};

// Suy diễn trạng thái hiển thị của 1 mã (kết hợp mã + lượt chụp liên kết).
const deriveStatus = (code, session) => {
  if (code.revoked || String(code.status || '').toUpperCase() === 'REVOKED') {
    return 'revoked';
  }
  if (!isCodeUsed(code)) return 'unused';
  // Photobooth lưu redeemed_session_id để nối mã ↔ lượt chụp; thiếu lượt ⇒ cảnh báo.
  // Selfbooth không trả liên kết mã↔lượt ⇒ coi là đã dùng bình thường.
  if (!session) return code.redeemed_session_id ? 'missing_session' : 'used';
  if (session.is_test) return 'used';
  return sessionHasProblem(session) ? 'error' : 'used';
};

// Giá trị mặc định khi admin chưa cấu hình trong trang Cài đặt.
const DEFAULTS = {
  selfbooth: {
    baseUrl: 'https://boothme.tech',
    studioId: '17',
  },
  photobooth: {
    baseUrl: 'https://photobooth-api.boothstudio2026.workers.dev',
    tenant: 'thetap@studio.vn',
  },
};

const assertSystem = (system) => {
  if (!boothClient.isSystem(system)) {
    throw new AppError(`Hệ thống không hợp lệ: ${system}`, 400);
  }
};

const assertRange = (from, to) => {
  if (from && to && from > to) {
    throw new AppError('"from" phải nhỏ hơn hoặc bằng "to"', 400);
  }
};

// Bảng chưa migrate → báo lỗi dễ hiểu thay vì sập.
const wrapTableError = (error, migration = 'docs/schema_booth.sql') => {
  if (
    error &&
    (error.code === 'PGRST205' ||
      error.code === '42P01' ||
      /does not exist/i.test(error.message || ''))
  ) {
    throw new AppError(`Chưa chạy migration ${migration} trên Supabase`, 500);
  }
  throw new AppError(error.message, 500);
};

const nextDay = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
};

// Nghiệp vụ theo giờ Việt Nam (UTC+7) nhưng Postgres lưu TIMESTAMPTZ (UTC mặc định).
// Quy đổi mốc "YYYY-MM-DD" sang đúng khoảng của ngày đó để không lệch 7 giờ.
const TZ_OFFSET = '+07:00';
const dayStart = (dateStr) => `${dateStr}T00:00:00${TZ_OFFSET}`;
const dayEndExclusive = (dateStr) =>
  `${nextDay(dateStr)}T00:00:00${TZ_OFFSET}`;

const readSettingsMap = async () => {
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select('key, value');
  if (error) wrapTableError(error);
  return Object.fromEntries((data || []).map((r) => [r.key, r.value]));
};

const upsertSetting = async (key, value) => {
  const { error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) throw new AppError(`Không lưu được cấu hình '${key}': ${error.message}`, 500);
};

// Cấu hình runtime cho 1 hệ thống (gồm cả secret — chỉ dùng nội bộ).
const getConfig = async (system) => {
  assertSystem(system);
  const map = await readSettingsMap();
  const defaults = DEFAULTS[system];
  const config = {
    system,
    baseUrl:
      system === 'selfbooth'
        ? defaults.baseUrl
        : map[`${system}_api_base`] || defaults.baseUrl,
    loginPath:
      system === 'selfbooth'
        ? null
        : map[`${system}_login_path`] || null,
    token: map[`${system}_token`] || null,
    email: map[`${system}_login_email`] || null,
    password: map[`${system}_login_password`] || null,
  };
  if (system === 'selfbooth') {
    config.studioId = map.selfbooth_studio_id || defaults.studioId;
    config.machineHwid = map.selfbooth_machine_hwid || null;
    config.turnstileToken = map.selfbooth_turnstile_token || null;
  } else {
    config.tenant = map.photobooth_tenant || defaults.tenant;
    config.branchId = map.photobooth_branch_id || null;
  }
  return config;
};

// Lấy token: dùng cache, nếu chưa có thì đăng nhập và lưu lại.
const getToken = async (config, { forceLogin = false, turnstileToken } = {}) => {
  if (!forceLogin && config.token) return config.token;
  const token = await boothClient.login(config, { turnstileToken });
  await upsertSetting(`${config.system}_token`, token);
  return token;
};

// Gọi API ngoài kèm token. Nếu token hết hạn (upstream 401/403 → 502) thì đăng
// nhập lại 1 lần rồi thử lại. Chỉ tự đăng nhập lại với Photobooth — Selfbooth bị
// Turnstile chặn nên báo user dán cookie mới.
const fetchUpstream = async (config, fetcher, args = {}) => {
  const token = await getToken(config);
  try {
    return await fetcher(config, token, args);
  } catch (err) {
    const stale =
      err instanceof AppError && /Xác thực API ngoài/.test(err.message);
    if (!stale) throw err;
    if (config.system === 'selfbooth') {
      throw new AppError(
        'Phiên Selfbooth (sb_session) đã hết hạn — lấy cookie sb_session mới ' +
          'từ boothme.tech (F12 → Application → Cookies) rồi dán vào ô token.',
        502,
      );
    }
    logger.warn(`booth token ${config.system} hết hạn — đăng nhập lại`);
    const fresh = await getToken(config, { forceLogin: true });
    return fetcher(config, fresh, args);
  }
};

// -----------------------------------------------------------------------------
// Tài khoản (accounts)
// -----------------------------------------------------------------------------

const MASK = '***';

const getAccounts = async () => {
  const map = await readSettingsMap();
  const build = (system) => {
    const defaults = DEFAULTS[system];
    const token = map[`${system}_token`];
    return {
      system,
      baseUrl:
        system === 'selfbooth'
          ? defaults.baseUrl
          : map[`${system}_api_base`] || defaults.baseUrl,
      loginPath:
        system === 'selfbooth' ? '' : map[`${system}_login_path`] || '',
      studioId: system === 'selfbooth' ? map.selfbooth_studio_id || defaults.studioId : null,
      tenant: system === 'photobooth' ? map.photobooth_tenant || defaults.tenant : null,
      branchId: system === 'photobooth' ? map.photobooth_branch_id || '' : null,
      email: map[`${system}_login_email`] || '',
      hasPassword: !!map[`${system}_login_password`],
      password: map[`${system}_login_password`] ? MASK : '',
      hasToken: !!token,
      token: token ? MASK : '',
      hasTurnstile: system === 'selfbooth' ? !!map.selfbooth_turnstile_token : false,
      connected: !!token,
    };
  };
  return { selfbooth: build('selfbooth'), photobooth: build('photobooth') };
};

// Lưu tài khoản. Bỏ qua giá trị rỗng / mask để không ghi đè secret.
const saveAccount = async (system, payload = {}) => {
  assertSystem(system);
  const writes = [];
  const setIf = (key, value) => {
    if (value === undefined || value === null || value === '' || value === MASK) return;
    writes.push(upsertSetting(key, String(value)));
  };
  setIf(`${system}_login_email`, payload.email);
  setIf(`${system}_login_password`, payload.password);
  setIf(`${system}_token`, payload.token);
  if (system === 'selfbooth') {
    // Selfbooth cố định dùng boothme.tech — không cho ghi đè base/login path
    // để tránh nối tới server cũ (selfbooth-api.thientiva.workers.dev).
    setIf('selfbooth_studio_id', payload.studioId);
    setIf('selfbooth_machine_hwid', payload.machineHwid);
    setIf('selfbooth_turnstile_token', payload.turnstileToken);
  } else {
    setIf(`${system}_api_base`, payload.baseUrl);
    setIf(`${system}_login_path`, payload.loginPath);
    setIf('photobooth_tenant', payload.tenant);
    setIf('photobooth_branch_id', payload.branchId);
  }
  await Promise.all(writes);
  return getAccounts();
};

const loginAccount = async (system, { turnstileToken } = {}) => {
  const config = await getConfig(system);
  let token;
  try {
    token = await getToken(config, {
      forceLogin: true,
      turnstileToken: turnstileToken || null,
    });
  } catch (err) {
    if (err instanceof AppError && /turnstile/i.test(err.message)) {
      throw new AppError(
        'Selfbooth yêu cầu xác minh Turnstile nên server không thể đăng nhập ' +
          'tự động. Hãy dán cookie phiên (từ boothme.tech) vào ô "Cookie / Token ' +
          'phiên" trong Tài khoản API rồi bấm Lưu.',
        400,
      );
    }
    throw err;
  }
  logger.info(`booth login ok system=${system} tokenLength=${token.length}`);
  return { connected: true };
};

// -----------------------------------------------------------------------------
// Đồng bộ (sync)
// -----------------------------------------------------------------------------

// Gộp bản ghi mới với bản ghi đã có: chỉ ghi đè bằng giá trị không rỗng, tránh xoá
// dữ liệu tốt khi lần đồng bộ sau API thiếu field. Trả số chèn mới / cập nhật.
// PostgREST yêu cầu mọi object trong mảng upsert có CÙNG bộ key → luôn chiếu ra
// đúng tập cột cố định (không kèm id/created_at để giữ nguyên dữ liệu cũ).
const upsertMerged = async (table, system, conflictCol, rows) => {
  if (!rows.length) return { inserted: 0, updated: 0 };
  const keys = rows
    .map((r) => r[conflictCol])
    .filter((v) => v !== null && v !== undefined);

  const existing = new Map();
  const chunkSize = 200;
  for (let i = 0; i < keys.length; i += chunkSize) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('system', system)
      .in(conflictCol, keys.slice(i, i + chunkSize));
    if (error) wrapTableError(error);
    (data || []).forEach((r) => existing.set(String(r[conflictCol]), r));
  }

  const columns = Array.from(
    new Set([...rows.flatMap((r) => Object.keys(r)), 'system', 'synced_at']),
  );

  let inserted = 0;
  let updated = 0;
  const now = new Date().toISOString();
  const payload = rows.map((row) => {
    const prev = existing.get(String(row[conflictCol]));
    if (prev) updated += 1;
    else inserted += 1;
    const out = {};
    columns.forEach((col) => {
      if (col === 'system') out.system = system;
      else if (col === 'synced_at') out.synced_at = now;
      else if (row[col] !== null && row[col] !== undefined) out[col] = row[col];
      else out[col] = prev ? prev[col] ?? null : null;
    });
    return out;
  });

  const { error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: `system,${conflictCol}` });
  if (error) wrapTableError(error);
  return { inserted, updated };
};

const syncCodes = async (system, { from, to, status } = {}) => {
  assertSystem(system);
  assertRange(from, to);
  const config = await getConfig(system);
  // Photobooth: không truyền status → API trả TẤT CẢ mã (used + unused + revoked);
  // bộ lọc ngày phía API ngoài không đáng tin nên ta tự lọc theo `created_at`.
  const effectiveStatus = status || undefined;
  const fetchArgs =
    system === 'photobooth'
      ? effectiveStatus
        ? { status: effectiveStatus }
        : {}
      : { from, to };
  const items = await fetchUpstream(config, boothClient.fetchCodes, fetchArgs);

  const startMs = from ? new Date(dayStart(from)).getTime() : null;
  const endMs = to ? new Date(dayEndExclusive(to)).getTime() : null;

  const unique = new Map();
  items.forEach((item) => {
    const row = boothClient.normalizeCode(system, item);
    // Danh sách đã lọc status=used: nếu item không mang cờ used/status thì vẫn coi
    // là đã dùng để không hiển thị sai thành "chưa dùng".
    if (effectiveStatus === 'used' && !row.used && !row.revoked) {
      row.used = true;
      if (!row.status || row.status === 'ACTIVE') row.status = 'USED';
    }
    // Lọc theo đúng `created_at` do API trả về (mốc ngày Việt Nam).
    const createdMs = row.external_created_at
      ? new Date(row.external_created_at).getTime()
      : NaN;
    if (startMs !== null && !(createdMs >= startMs)) return;
    if (endMs !== null && !(createdMs < endMs)) return;
    if (row.code && !unique.has(row.code)) unique.set(row.code, row);
  });
  const payload = [...unique.values()];

  const { inserted, updated } = await upsertMerged(
    CODES_TABLE,
    system,
    'code',
    payload,
  );
  return { system, fetched: items.length, inserted, updated };
};

const syncSessions = async (system, { from, to } = {}) => {
  assertSystem(system);
  assertRange(from, to);
  const config = await getConfig(system);
  const items = await fetchUpstream(config, boothClient.fetchSessions, { from, to });

  const unique = new Map();
  items.forEach((item) => {
    const row = boothClient.normalizeSession(system, item);
    if (!row.captured_at && from) row.captured_at = dayStart(from);
    if (row.external_id && !unique.has(row.external_id)) {
      unique.set(row.external_id, row);
    }
  });
  const payload = [...unique.values()];

  const { inserted, updated } = await upsertMerged(
    SESSIONS_TABLE,
    system,
    'external_id',
    payload,
  );
  return { system, fetched: items.length, inserted, updated };
};

// Gom doanh thu theo NGÀY từ raw response của hệ máy.
// - Selfbooth: ưu tiên daily[] (day + revenue_vnd — đã đúng timezone VN),
//   thiếu thì tính từ uses[].price_vnd theo used_at.
// - Photobooth: data[].recorded_at + amount_required (khớp với tổng Portal).
const groupRevenueByDay = (system, raw) => {
  const out = new Map();
  const add = (day, amount) => {
    const key = String(day || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    out.set(key, (out.get(key) || 0) + (Number(amount) || 0));
  };

  if (system === 'selfbooth') {
    const daily = Array.isArray(raw?.daily) ? raw.daily : [];
    if (daily.length) {
      daily.forEach((d) => add(d.day, d.revenue_vnd));
    } else {
      (Array.isArray(raw?.uses) ? raw.uses : []).forEach((u) =>
        add(u.used_at, u.price_vnd),
      );
    }
    return out;
  }

  (Array.isArray(raw?.data) ? raw.data : []).forEach((r) =>
    add(r.recorded_at, r.amount_required),
  );
  return out;
};

// Ghi doanh thu theo ngày của hệ máy vào DB cho Dashboard đọc (không live).
const syncRevenue = async (system, { from, to } = {}) => {
  assertSystem(system);
  assertRange(from, to);
  const config = await getConfig(system);
  const { raw } = await fetchUpstream(config, boothClient.fetchRevenue, {
    from,
    to,
  });

  const byDay = groupRevenueByDay(system, raw);
  if (!byDay.size) return { system, days: 0, total: 0 };

  const payload = [...byDay.entries()].map(([revenue_date, amount]) => ({
    system,
    revenue_date,
    amount,
    synced_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from(BOOTH_DAILY_TABLE)
    .upsert(payload, { onConflict: 'system,revenue_date' });
  if (error) wrapTableError(error, 'docs/schema_booth_daily.sql');

  const total = payload.reduce((acc, r) => acc + Number(r.amount) || 0, 0);
  return { system, days: payload.length, total };
};

// Đồng bộ mã + lượt + doanh thu theo ngày (doanh thu lỗi không làm hỏng phần kia).
const syncAll = async (system, { from, to, status } = {}) => {
  const codes = await syncCodes(system, { from, to, status });
  const sessions = await syncSessions(system, { from, to });
  let revenue = { system, days: 0, total: 0 };
  try {
    revenue = await syncRevenue(system, { from, to });
  } catch (err) {
    logger.warn(`booth sync revenue ${system} thất bại: ${err.message}`);
    revenue = { system, days: 0, total: 0, error: err.message };
  }
  return { codes, sessions, revenue };
};

// -----------------------------------------------------------------------------
// Truy vấn dữ liệu đã cache
// -----------------------------------------------------------------------------

const listCodes = async (system, { from, to } = {}) => {
  assertSystem(system);
  assertRange(from, to);
  let query = supabase
    .from(CODES_TABLE)
    .select('*')
    .eq('system', system);
  if (from) query = query.gte('external_created_at', dayStart(from));
  if (to) query = query.lt('external_created_at', dayEndExclusive(to));
  query = query.order('external_created_at', { ascending: false });
  const { data, error } = await query;
  if (error) wrapTableError(error);
  return data || [];
};

const listSessions = async (system, { from, to } = {}) => {
  assertSystem(system);
  assertRange(from, to);
  let query = supabase
    .from(SESSIONS_TABLE)
    .select('*')
    .eq('system', system);
  if (from) query = query.gte('captured_at', dayStart(from));
  if (to) query = query.lt('captured_at', dayEndExclusive(to));
  query = query.order('captured_at', { ascending: false });
  const { data, error } = await query;
  if (error) wrapTableError(error);
  return data || [];
};

// Đánh index lượt chụp để tra cứu mã ↔ lượt (PB theo external_id, SB theo code).
const buildSessionIndex = (sessions) => {
  const byExternalId = new Map();
  const byCode = new Map();
  sessions.forEach((s) => {
    if (s.external_id) byExternalId.set(String(s.external_id), s);
    if (s.code) byCode.set(String(s.code), s);
  });
  return { byExternalId, byCode };
};

const matchSession = (system, code, index) => {
  if (system === 'photobooth') {
    return code.redeemed_session_id
      ? index.byExternalId.get(String(code.redeemed_session_id)) || null
      : null;
  }
  return code.code ? index.byCode.get(String(code.code)) || null : null;
};

const listReviewsByCodes = async (system, codes) => {
  const list = [...new Set(codes.map((c) => c.code).filter(Boolean))];
  if (!list.length) return new Map();
  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .select('*')
    .eq('system', system)
    .in('code', list);
  if (error) wrapTableError(error);
  return new Map((data || []).map((r) => [String(r.code), r]));
};

// Mã chụp + lượt chụp liên kết + ghi chú nhân viên + trạng thái suy diễn.
const listCodesDetailed = async (system, { from, to } = {}) => {
  const [codes, sessions] = await Promise.all([
    listCodes(system, { from, to }),
    listSessions(system, { from, to }),
  ]);
  const index = buildSessionIndex(sessions);
  const reviews = await listReviewsByCodes(system, codes);
  return codes.map((c) => {
    const session = matchSession(system, c, index);
    return {
      ...c,
      session,
      review: reviews.get(String(c.code)) || null,
      derived_status: deriveStatus(c, session),
    };
  });
};

// -----------------------------------------------------------------------------
// Đối chiếu (reconciliation)
// -----------------------------------------------------------------------------

const listReconciliations = async (system, { from, to } = {}) => {
  assertSystem(system);
  assertRange(from, to);
  let query = supabase
    .from(RECON_TABLE)
    .select('*')
    .eq('system', system);
  if (from) query = query.gte('reconciliation_date', from);
  if (to) query = query.lte('reconciliation_date', to);
  query = query.order('reconciliation_date', { ascending: false });
  const { data, error } = await query;
  if (error) wrapTableError(error);
  return data || [];
};

const upsertReconciliation = async (system, payload, createdBy) => {
  assertSystem(system);
  const row = {
    system,
    reconciliation_date: payload.reconciliation_date,
    machine_cash: Number(payload.machine_cash) || 0,
    actual_cash: Number(payload.actual_cash) || 0,
    note: payload.note ?? null,
    created_by: createdBy || null,
  };
  const { data, error } = await supabase
    .from(RECON_TABLE)
    .upsert(row, { onConflict: 'system,reconciliation_date' })
    .select('*')
    .single();
  if (error) wrapTableError(error);
  return data;
};

const removeReconciliation = async (system, id) => {
  assertSystem(system);
  const { data, error } = await supabase
    .from(RECON_TABLE)
    .delete()
    .eq('system', system)
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) wrapTableError(error);
  if (!data) throw new AppError('Không tìm thấy bản ghi đối chiếu', 404);
  return data;
};

// Lưu ghi chú / trạng thái xử lý cho 1 mã hoặc 1 lượt chụp (tách khỏi cache API).
// Khuyến nghị gắn theo session_id: khách chụp trực tiếp không có mã.
const upsertCodeReview = async (system, payload = {}, createdBy) => {
  assertSystem(system);
  const code = payload.code ? String(payload.code) : null;
  const sessionId = payload.session_id ? String(payload.session_id) : null;
  if (!code && !sessionId) {
    throw new AppError('Cần mã chụp (code) hoặc lượt chụp (session_id)', 400);
  }
  const row = {
    system,
    code,
    session_id: sessionId,
    staff_status: payload.staff_status ?? null,
    staff_reason: payload.staff_reason ?? null,
    staff_note: payload.staff_note ?? null,
    reviewed_by: createdBy || null,
  };
  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .upsert(row, { onConflict: 'system,mark_key' })
    .select('*')
    .single();
  if (error) wrapTableError(error, 'docs/schema_booth_v4.sql');
  return data;
};

// Tổng hợp: mã ↔ session khớp chưa + doanh thu máy ghi ↔ tiền thực nhận.
// Liên kết: Photobooth voucher.redeemed_session_id = session.session_id;
//           Selfbooth  session.code_used            = code.code.
// Session có is_test bị loại khỏi thống kê (nhưng đếm riêng).
const getSummary = async (system, { from, to } = {}) => {
  const [allCodes, allSessions, reconciliations] = await Promise.all([
    listCodes(system, { from, to }),
    listSessions(system, { from, to }),
    listReconciliations(system, { from, to }),
  ]);

  const sessions = allSessions.filter((s) => !s.is_test);
  const testSessions = allSessions.filter((s) => s.is_test);

  const codeSet = new Set(allCodes.map((c) => c.code).filter(Boolean));
  const redeemedSessionSet = new Set(
    allCodes.map((c) => c.redeemed_session_id).filter(Boolean),
  );

  const usedCodes = allCodes.filter(isCodeUsed);
  const unusedCodes = allCodes.filter((c) => !isCodeUsed(c));

  const sessionMatched = (s) =>
    (s.code && codeSet.has(s.code)) ||
    redeemedSessionSet.has(s.external_id);
  const straySessions = sessions.filter((s) => !sessionMatched(s));

  // Đếm mã theo trạng thái suy diễn (Lỗi / Thiếu lượt chụp).
  const sessionIndex = buildSessionIndex(allSessions);
  const derived = allCodes.map((c) => ({
    code: c,
    status: deriveStatus(c, matchSession(system, c, sessionIndex)),
  }));
  const codesError = derived.filter((d) => d.status === 'error').length;
  const codesMissing = derived.filter(
    (d) => d.status === 'missing_session',
  ).length;

  const sum = (rows, key) =>
    rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

  const machineCash = reconciliations.reduce(
    (acc, r) => acc + (Number(r.machine_cash) || 0),
    0,
  );
  const actualCash = reconciliations.reduce(
    (acc, r) => acc + (Number(r.actual_cash) || 0),
    0,
  );

  return {
    system,
    from: from || null,
    to: to || null,
    counts: {
      codes: allCodes.length,
      codes_used: usedCodes.length,
      codes_unused: unusedCodes.length,
      codes_error: codesError,
      codes_missing_session: codesMissing,
      sessions: sessions.length,
      sessions_test: testSessions.length,
      sessions_without_code: straySessions.length,
      media_total: sum(sessions, 'media_count'),
    },
    revenue: {
      codes_value_total: sum(allCodes, 'value'),
      codes_value_used: sum(usedCodes, 'value'),
      paid_amount_total: sum(allCodes, 'paid_amount'),
      session_amount_total: sum(sessions, 'amount'),
      session_revenue_total: sum(sessions, 'revenue'),
      machine_cash: machineCash,
      actual_cash: actualCash,
      difference: actualCash - machineCash,
    },
    reconciliations,
  };
};

// Sổ doanh thu theo mã: gộp mã chụp (đã dùng / chưa dùng) + lượt chụp dùng mã đã
// bị xóa (session không khớp bất kỳ mã nào) vào chung một danh sách để đối soát.
const LEDGER_USED_STATUSES = new Set(['used', 'error', 'missing_session']);

const getLedger = async (system, { from, to } = {}) => {
  const [codes, sessions] = await Promise.all([
    listCodesDetailed(system, { from, to }),
    listSessions(system, { from, to }),
  ]);

  const codeSet = new Set(codes.map((c) => c.code).filter(Boolean));
  const redeemedSet = new Set(
    codes
      .map((c) => c.redeemed_session_id)
      .filter(Boolean)
      .map(String),
  );

  const isMatched = (s) =>
    (s.code && codeSet.has(s.code)) || redeemedSet.has(String(s.external_id));

  const money = (s) => (s ? Number(s.revenue) || Number(s.amount) || 0 : 0);

  const codeRows = codes.map((c) => ({
    row_type: 'code',
    key: `code-${c.id}`,
    id: c.id,
    system,
    code: c.code,
    external_id: c.external_id,
    type: c.type,
    code_kind: c.code_kind,
    package_id: c.package_id,
    package_name: c.package_name,
    machine_name: c.machine_name,
    value: Number(c.value) || 0,
    paid_amount: Number(c.paid_amount) || 0,
    used_at: c.used_at || (c.session ? c.session.captured_at : null),
    external_created_at: c.external_created_at,
    derived_status: c.derived_status,
    review: c.review || null,
    session: c.session || null,
    amount: c.session ? Number(c.session.amount) || 0 : 0,
    revenue: money(c.session),
    is_test: Boolean(c.session && c.session.is_test),
  }));

  // Lượt chụp không khớp mã nào ⇒ mã đã bị xóa khỏi hệ thống nguồn.
  const orphanRows = sessions
    .filter((s) => !isMatched(s))
    .map((s) => ({
      row_type: 'orphan_session',
      key: `session-${s.id}`,
      id: s.id,
      system,
      code: s.code || s.external_id || null,
      external_id: s.external_id,
      type: null,
      code_kind: s.code_kind || null,
      package_id: s.package_id || null,
      package_name: s.package_name || null,
      machine_name: s.device_name || null,
      value: 0,
      paid_amount: 0,
      used_at: s.captured_at || null,
      external_created_at: s.captured_at || null,
      derived_status: 'orphan',
      review: null,
      session: s,
      amount: Number(s.amount) || 0,
      revenue: money(s),
      is_test: Boolean(s.is_test),
    }));

  const rows = [...codeRows, ...orphanRows];

  const sum = (arr, pick) => arr.reduce((acc, r) => acc + (pick(r) || 0), 0);
  const usedRows = codeRows.filter((r) =>
    LEDGER_USED_STATUSES.has(r.derived_status),
  );
  const unusedRows = codeRows.filter((r) => r.derived_status === 'unused');
  const countStatus = (status) =>
    codeRows.filter((r) => r.derived_status === status).length;

  return {
    system,
    from: from || null,
    to: to || null,
    rows,
    totals: {
      codes_total: codeRows.length,
      codes_used: usedRows.length,
      codes_unused: unusedRows.length,
      codes_error: countStatus('error'),
      codes_missing_session: countStatus('missing_session'),
      codes_revoked: countStatus('revoked'),
      value_total: sum(codeRows, (r) => r.value),
      value_used: sum(usedRows, (r) => r.value),
      value_unused: sum(unusedRows, (r) => r.value),
      paid_amount_total: sum(codeRows, (r) => r.paid_amount),
      session_amount_total: sum(rows, (r) => (r.is_test ? 0 : r.amount)),
      session_revenue_total: sum(rows, (r) => (r.is_test ? 0 : r.revenue)),
      orphan_count: orphanRows.length,
      orphan_amount: sum(orphanRows, (r) => r.amount),
      orphan_revenue: sum(orphanRows, (r) => r.revenue),
    },
  };
};

const fetchPackages = async (system) => {
  assertSystem(system);
  const config = await getConfig(system);
  return fetchUpstream(config, boothClient.fetchPackages);
};

// -----------------------------------------------------------------------------
// Doanh thu thực nhận 2 hệ máy (Dashboard)
// -----------------------------------------------------------------------------
// Nguồn tiền: lượt dùng ghi nhận từ API ngoài — Photobooth `amount_required`,
// Selfbooth `price_vnd`. Nguồn lỗi: mã nhân viên đã đánh dấu "Báo lỗi" ở tab Mã
// chụp — tiền của các ca đó KHÔNG tính vào thực nhận.
const useAmount = (system, item) =>
  system === 'photobooth'
    ? Number(item.amount_required) || 0
    : Number(item.price_vnd) || Number(item.revenue) || Number(item.amount) || 0;

// Giữ lại các trường CodeDetailModal cần; bỏ `raw` đầy đủ cho nhẹ payload.
const toCodeRow = (c) => {
  if (!c) return null;
  const s = c.session || null;
  const raw = s?.raw || {};
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    code_kind: c.code_kind,
    package_name: c.package_name,
    machine_name: c.machine_name,
    value: c.value,
    paid_amount: c.paid_amount,
    note: c.note,
    used_at: c.used_at,
    external_created_at: c.external_created_at,
    derived_status: c.derived_status,
    review: c.review,
    session: s
      ? {
        external_id: s.external_id,
        status: s.status,
        device_name: s.device_name,
        captured_at: s.captured_at,
        media_count: s.media_count,
        is_test: s.is_test,
        raw: {
          finish_reason: raw.finish_reason ?? null,
          failure_message: raw.failure_message ?? null,
          failure_code: raw.failure_code ?? null,
          had_camera_error: raw.had_camera_error ?? null,
          camera_error_count: raw.camera_error_count ?? null,
        },
      }
      : null,
  };
};

// Toàn bộ ghi chú/nhãn xử lý của nhân viên (kèm cả bản ghi theo lượt chụp).
const listAllReviews = async (system) => {
  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .select('*')
    .eq('system', system);
  if (error) wrapTableError(error, 'docs/schema_booth_v4.sql');
  return data || [];
};

const buildReviewIndex = (reviews) => {
  const bySession = new Map();
  const byCode = new Map();
  reviews.forEach((r) => {
    if (r.session_id) bySession.set(String(r.session_id), r);
    if (r.code) byCode.set(String(r.code), r);
  });
  return { bySession, byCode };
};

// Gắn mỗi lượt dùng với mã + nhãn xử lý để biết ca nào bị đánh dấu lỗi.
// Ưu tiên gắn nhãn theo lượt chụp (khách chụp trực tiếp không có mã).
const buildUseRows = (system, items, codes, marks) => {
  const bySession = new Map();
  const byCode = new Map();
  codes.forEach((c) => {
    if (c.redeemed_session_id) bySession.set(String(c.redeemed_session_id), c);
    if (c.code) byCode.set(String(c.code), c);
  });

  return (items || []).map((item) => {
    const sessionId = item.session_id ?? null;
    const code =
      system === 'photobooth'
        ? bySession.get(String(sessionId || '')) || null
        : byCode.get(String(item.code || '')) || null;
    const review =
      (sessionId && marks.bySession.get(String(sessionId))) ||
      (item.code && marks.byCode.get(String(item.code))) ||
      code?.review ||
      null;
    const isError = review?.staff_status === 'error';
    return {
      system,
      revenue_id: item.revenue_id ?? null,
      session_id: sessionId ?? code?.redeemed_session_id ?? null,
      code: code?.code || item.code || null,
      used_at: item.recorded_at || item.used_at || code?.used_at || null,
      room_name: item.room_name || null,
      event_name: item.event_name || null,
      machine_name: code?.machine_name || null,
      payment_method: item.payment_method || null,
      amount: useAmount(system, item),
      status: isError ? 'error' : 'ok',
      reason: review?.staff_reason || null,
      note: review?.staff_note || null,
      staff_status: review?.staff_status || null,
      mark_target: sessionId ? { session_id: sessionId } : { code: item.code },
      code_row: toCodeRow(code),
    };
  });
};

const REVENUE_SYSTEMS = ['photobooth', 'selfbooth'];

const getRevenueStats = async ({ from, to } = {}) => {
  assertRange(from, to);

  // Doanh thu lấy live từ API ngoài; mã + nhãn lỗi lấy từ cache — nguồn nào
  // lỗi thì chỉ phần của nó bị bỏ, nguồn còn lại vẫn hiển thị.
  const [revenues, codeLists, reviewLists] = await Promise.all([
    Promise.allSettled(
      REVENUE_SYSTEMS.map((system) => getRevenue(system, { from, to })),
    ),
    Promise.allSettled(
      REVENUE_SYSTEMS.map((system) => listCodesDetailed(system, {})),
    ),
    Promise.allSettled(REVENUE_SYSTEMS.map((system) => listAllReviews(system))),
  ]);

  const sources = {};
  const rows = [];

  REVENUE_SYSTEMS.forEach((system, i) => {
    const codes =
      codeLists[i].status === 'fulfilled' ? codeLists[i].value || [] : [];
    const marks = buildReviewIndex(
      reviewLists[i].status === 'fulfilled' ? reviewLists[i].value || [] : [],
    );
    const revRes = revenues[i];
    const empty = {
      ok: false,
      message: null,
      count: 0,
      gross: 0,
      error_count: 0,
      error_amount: 0,
      net: 0,
    };

    if (revRes.status === 'rejected') {
      sources[system] = {
        ...empty,
        message: revRes.reason?.message || 'Không lấy được doanh thu.',
      };
      return;
    }

    const systemRows = buildUseRows(
      system,
      revRes.value?.uses,
      codes,
      marks,
    );
    const gross = systemRows.reduce((acc, r) => acc + r.amount, 0);
    const errorRows = systemRows.filter((r) => r.status === 'error');
    const errorAmount = errorRows.reduce((acc, r) => acc + r.amount, 0);
    sources[system] = {
      ok: true,
      count: systemRows.length,
      gross,
      error_count: errorRows.length,
      error_amount: errorAmount,
      net: gross - errorAmount,
    };
    rows.push(...systemRows);
  });

  rows.sort((a, b) =>
    String(b.used_at || '').localeCompare(String(a.used_at || '')),
  );

  const totals = REVENUE_SYSTEMS.reduce(
    (acc, system) => {
      const source = sources[system];
      acc.count += source.count;
      acc.gross += source.gross;
      acc.error_count += source.error_count;
      acc.error_amount += source.error_amount;
      acc.net += source.net;
      return acc;
    },
    { count: 0, gross: 0, error_count: 0, error_amount: 0, net: 0 },
  );

  return { from: from || null, to: to || null, totals, sources, rows };
};

// Doanh thu lấy trực tiếp từ API (không cache), cả 2 hệ thống.
const getRevenue = async (system, { from, to } = {}) => {
  assertSystem(system);
  assertRange(from, to);
  const config = await getConfig(system);
  const { summary, uses, raw } = await fetchUpstream(
    config,
    boothClient.fetchRevenue,
    { from, to },
  );
  return { system, from: from || null, to: to || null, summary, uses, raw };
};

// Lượt chụp lấy trực tiếp từ API ngoài (không cache) — dùng cho ảnh preview.
const getLiveSessions = async (system, { from, to } = {}) => {
  assertSystem(system);
  assertRange(from, to);
  const config = await getConfig(system);
  return fetchUpstream(config, boothClient.fetchSessions, { from, to });
};

// -----------------------------------------------------------------------------
// Trạng thái dữ liệu đã thu thập (cả 2 hệ) — cho banner ở FE
// -----------------------------------------------------------------------------

// Đếm bản ghi cache theo hệ + khoảng ngày (dùng head:true để chỉ lấy count).
const countCached = async (table, system, { from, to } = {}) => {
  const timeCol = table === CODES_TABLE ? 'external_created_at' : 'captured_at';
  let query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('system', system);
  if (from) query = query.gte(timeCol, dayStart(from));
  if (to) query = query.lt(timeCol, dayEndExclusive(to));
  const { count, error } = await query;
  if (error) wrapTableError(error);
  return count || 0;
};

// Thời điểm đồng bộ gần nhất giữa 2 bảng cache của 1 hệ.
const lastSyncedAt = async (system) => {
  const [codes, sessions] = await Promise.all(
    [CODES_TABLE, SESSIONS_TABLE].map((table) =>
      supabase
        .from(table)
        .select('synced_at')
        .eq('system', system)
        .order('synced_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  );
  if (codes.error) wrapTableError(codes.error);
  if (sessions.error) wrapTableError(sessions.error);
  const stamps = [codes.data?.synced_at, sessions.data?.synced_at]
    .filter(Boolean)
    .sort();
  return stamps.length ? stamps[stamps.length - 1] : null;
};

// Tổng quan dữ liệu đã thu thập của Photobooth + Selfbooth (kết nối, số bản ghi,
// lần đồng bộ gần nhất) để FE hiển thị "đã có / chưa có dữ liệu nguồn nào".
const getDataStatus = async ({ from, to } = {}) => {
  assertRange(from, to);
  const map = await readSettingsMap();
  const entries = await Promise.all(
    boothClient.SYSTEMS.map(async (system) => {
      const [codes, sessions, last] = await Promise.all([
        countCached(CODES_TABLE, system, { from, to }),
        countCached(SESSIONS_TABLE, system, { from, to }),
        lastSyncedAt(system),
      ]);
      return [
        system,
        {
          system,
          connected: Boolean(map[`${system}_token`]),
          account: map[`${system}_login_email`] || null,
          codes,
          sessions,
          last_synced_at: last,
        },
      ];
    }),
  );
  return {
    from: from || null,
    to: to || null,
    systems: Object.fromEntries(entries),
  };
};

const createCode = async (system, payload) => {
  assertSystem(system);
  const config = await getConfig(system);
  const created = await fetchUpstream(config, boothClient.createCode, payload);
  if (created && created.code) {
    const { error } = await supabase
      .from(CODES_TABLE)
      .upsert(
        {
          system,
          external_id: created.external_id,
          code: created.code,
          code_kind: created.code_kind,
          type: created.type,
          package_id: created.package_id,
          package_name: created.package_name,
          value: created.value,
          note: created.note,
          status: created.status,
          external_created_at: created.external_created_at,
          raw: created.raw,
        },
        { onConflict: 'system,code', ignoreDuplicates: true },
      );
    if (error) logger.warn(`booth createCode cache failed: ${error.message}`);
  }
  return created;
};

module.exports = {
  getAccounts,
  saveAccount,
  loginAccount,
  syncCodes,
  syncSessions,
  syncRevenue,
  syncAll,
  listCodes,
  listCodesDetailed,
  listSessions,
  listReconciliations,
  upsertReconciliation,
  removeReconciliation,
  upsertCodeReview,
  getSummary,
  getLedger,
  getRevenueStats,
  fetchPackages,
  getRevenue,
  getLiveSessions,
  getDataStatus,
  createCode,
};
