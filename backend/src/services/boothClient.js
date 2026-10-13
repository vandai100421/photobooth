// Client gọi API ngoài của 2 hệ máy chụp: Photobooth & Selfbooth.
// Tolerant: đọc nhiều shape response, map nhiều tên field, luôn kèm `raw`.
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const SYSTEMS = ['selfbooth', 'photobooth'];

const isSystem = (system) => SYSTEMS.includes(system);

// Giá trị đầu tiên không rỗng trong obj theo thứ tự keys (0 và false được giữ).
const pick = (obj, keys = []) => {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== null && v !== undefined && v !== '') return v;
  }
  return undefined;
};

const TOKEN_KEYS = [
  'token',
  'access_token',
  'accessToken',
  'session_token',
  'sessionToken',
  'jwt',
  'id_token',
  'idToken',
  'api_token',
];
const TOKEN_CONTAINERS = ['data', 'session', 'result', 'auth', 'payload'];

// Bóc token từ nhiều vị trí (gốc hoặc lồng trong data/session/result/auth).
const extractToken = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  for (const k of TOKEN_KEYS) {
    const v = payload[k];
    if (typeof v === 'string' && v) return v;
  }
  for (const c of TOKEN_CONTAINERS) {
    const nested = payload[c];
    if (nested && typeof nested === 'object') {
      const t = extractToken(nested);
      if (t) return t;
    }
  }
  return null;
};

const LIST_KEYS = [
  'data',
  'items',
  'vouchers',
  'shoot_codes',
  'codes',
  'sessions',
  'media_sessions',
  'packages',
  'results',
  'list',
  'uses',
];

// Trả mảng dữ liệu từ nhiều shape response (mảng trực tiếp / lồng 1–2 cấp).
const extractList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const k of LIST_KEYS) {
    if (Array.isArray(payload[k])) return payload[k];
  }
  for (const k of LIST_KEYS) {
    const v = payload[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = extractList(v);
      if (nested.length) return nested;
    }
  }
  return [];
};

const toISO = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toBool = (v) => {
  if (v === true || v === 1 || v === '1' || v === 'true') return true;
  if (v === false || v === 0 || v === '0' || v === 'false') return false;
  return Boolean(v);
};
// Chuẩn hoá 1 mã chụp/voucher từ API ngoài về bộ cột của booth_shoot_codes.
const normalizeCode = (system, item) => {
  const raw = item && typeof item === 'object' ? item : {};
  const pkg = raw.package && typeof raw.package === 'object' ? raw.package : {};

  const externalId = pick(raw, ['id', 'voucher_id', 'code_id', 'external_id']);
  const code = pick(raw, ['code', 'voucher_code', 'shoot_code']);

  const used =
    toBool(pick(raw, ['used', 'is_used', 'redeemed', 'is_redeemed'])) ||
    (Number(pick(raw, ['use_count', 'used_count', 'redeemed_count'])) || 0) > 0;
  const revoked = toBool(
    pick(raw, ['revoked', 'is_revoked', 'cancelled', 'is_cancelled']),
  );

  const valueRaw = pick(raw, ['value', 'amount', 'price', 'total_amount']);

  return {
    system,
    external_id: externalId != null ? String(externalId) : null,
    code: code != null ? String(code) : null,
    code_kind: pick(raw, ['code_kind', 'kind']) ?? null,
    type: pick(raw, ['type', 'voucher_type']) ?? null,
    package_id:
      pick(raw, ['package_id']) ?? pick(pkg, ['id', 'package_id']) ?? null,
    package_name:
      pick(raw, ['package_name']) ??
      pick(pkg, ['name', 'package_name']) ??
      null,
    package_key: pick(raw, ['package_key']) ?? null,
    minutes: toNum(pick(raw, ['minutes', 'duration_minutes'])),
    package_prints: toNum(pick(raw, ['package_prints', 'prints'])),
    value: toNum(valueRaw),
    note: pick(raw, ['note', 'description', 'remark']) ?? null,
    status: pick(raw, ['status', 'state']) ?? null,
    external_created_at: toISO(
      pick(raw, ['created_at', 'created_time', 'issued_at', 'valid_from']),
    ),
    use_count: Number(pick(raw, ['use_count', 'used_count'])) || 0,
    used,
    used_at: toISO(pick(raw, ['used_at', 'redeemed_at', 'used_time'])),
    revoked,
    valid_from: pick(raw, ['valid_from']) ?? null,
    valid_until: pick(raw, ['valid_until', 'expires_on']) ?? null,
    expires_at: toISO(pick(raw, ['expires_at', 'expired_at'])),
    cancelled_at: toISO(pick(raw, ['cancelled_at'])),
    cancelled_by: pick(raw, ['cancelled_by', 'revoked_by']) ?? null,
    created_via: pick(raw, ['created_via', 'source', 'channel']) ?? null,
    created_by: pick(raw, ['created_by', 'owner_email']) ?? null,
    shift: pick(raw, ['shift']) ?? null,
    phone: pick(raw, ['phone', 'phone_number']) ?? null,
    paid_amount: toNum(pick(raw, ['paid_amount', 'received_amount'])) ?? 0,
    redeemed_hwid: pick(raw, ['redeemed_hwid', 'hwid', 'machine_hwid']) ?? null,
    redeemed_session_id: pick(raw, ['redeemed_session_id', 'session_id']) ?? null,
    redeemed_by_emp: toNum(pick(raw, ['redeemed_by_emp', 'employee_id'])),
    machine_name: pick(raw, ['machine_name', 'device_name']) ?? null,
    owner_email: pick(raw, ['owner_email']) ?? null,
    branch_id: pick(raw, ['branch_id']) ?? null,
    raw,
  };
};

// Chuẩn hoá 1 lượt chụp (media session) về bộ cột của booth_media_sessions.
const normalizeSession = (system, item) => {
  const raw = item && typeof item === 'object' ? item : {};
  const inner = raw.raw && typeof raw.raw === 'object' ? raw.raw : {};

  const externalId =
    pick(raw, ['session_id', 'external_id', 'id']) ??
    pick(inner, ['session_id', 'external_id', 'id']);
  const code =
    pick(raw, ['code', 'code_used', 'voucher_code']) ??
    pick(inner, ['code', 'code_used']);

  // Đếm media: ưu tiên đếm mảng ảnh, sau đó tới media_count/photos_captured.
  const images = pick(raw, ['images', 'photos', 'media', 'medias']);
  let mediaCount = null;
  if (Array.isArray(images)) mediaCount = images.length;
  if (mediaCount == null) {
    mediaCount = toNum(
      pick(raw, ['media_count', 'photos_captured', 'photo_count']) ??
        pick(inner, ['media_count', 'photos_captured']),
    );
  }
  if (mediaCount == null) mediaCount = 0;

  const capturedAt = toISO(
    pick(raw, ['captured_at', 'capture_started_at', 'session_time']) ??
      pick(inner, ['capture_started_at', 'session_time']),
  );

  // Nếu API không có id: sinh key dự phòng từ code + thời gian để vẫn dedupe được.
  const resolvedExternalId =
    externalId != null
      ? String(externalId)
      : `${code ?? 'session'}:${capturedAt ?? ''}`;

  return {
    system,
    external_id: resolvedExternalId,
    code: code != null ? String(code) : null,
    code_kind:
      pick(raw, ['code_kind']) ?? pick(inner, ['code_kind']) ?? null,
    package_id:
      pick(raw, ['package_id']) ?? pick(inner, ['package_id']) ?? null,
    package_name:
      pick(raw, ['package_name']) ?? pick(inner, ['package_name']) ?? null,
    media_count: mediaCount,
    captured_at: capturedAt,
    total_prints:
      toNum(pick(raw, ['total_prints']) ?? pick(inner, ['total_prints'])) ?? 0,
    prints_cut: toNum(pick(raw, ['prints_cut'])) ?? 0,
    prints_nocut: toNum(pick(raw, ['prints_nocut'])) ?? 0,
    status: pick(raw, ['status']) ?? pick(inner, ['status']) ?? null,
    hwid: pick(raw, ['hwid']) ?? pick(inner, ['hwid']) ?? null,
    device_name:
      pick(raw, ['device_name', 'machine_name']) ??
      pick(inner, ['device_name']) ??
      null,
    ended_at: toISO(pick(raw, ['ended_at']) ?? pick(inner, ['ended_at'])),
    amount: toNum(pick(raw, ['amount']) ?? pick(inner, ['amount'])) ?? 0,
    revenue: toNum(pick(raw, ['revenue']) ?? pick(inner, ['revenue'])) ?? 0,
    source: pick(raw, ['source']) ?? pick(inner, ['source']) ?? null,
    is_test: toBool(pick(raw, ['is_test']) ?? pick(inner, ['is_test'])),
    finish_reason:
      pick(raw, ['finish_reason']) ?? pick(inner, ['finish_reason']) ?? null,
    expected_photos:
      toNum(
        pick(raw, ['expected_photos']) ?? pick(inner, ['expected_photos']),
      ) ?? 0,
    cover_image:
      pick(raw, ['cover_image', 'thumbnail', 'preview_image']) ??
      pick(inner, ['cover_image']) ??
      null,
    raw,
  };
};

// -----------------------------------------------------------------------------
// HTTP helpers (Node 18+ fetch)
// -----------------------------------------------------------------------------

const baseUrl = (config) => (config.baseUrl || '').replace(/\/$/, '');

async function getJson(config, token, url, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (config.system === 'photobooth' && config.tenant) {
    headers['x-booth-tenant'] = config.tenant;
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new AppError(`Không kết nối được API ngoài: ${err.message}`, 502);
  }

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_e) {
    data = { raw: text };
  }

  // Token hết hạn / sai → ném AppError có cụm "Xác thực API ngoài" để service tự login lại.
  if (res.status === 401 || res.status === 403) {
    throw new AppError('Xác thực API ngoài thất bại (token hết hạn).', 502);
  }
  if (!res.ok) {
    const msg =
      data?.error || data?.message || `Lỗi API ngoài (HTTP ${res.status})`;
    throw new AppError(msg, 502);
  }
  return data;
}

// -----------------------------------------------------------------------------
// Login
// -----------------------------------------------------------------------------

// Đăng nhập lấy token. Trả về chuỗi token.
async function login(config, { turnstileToken } = {}) {
  const base = baseUrl(config);

  if (config.system === 'selfbooth') {
    const loginBody = {
      login: config.email,
      password: config.password,
      remember: true,
    };
    if (turnstileToken) loginBody.turnstileToken = turnstileToken;
    const data = await getJson(config, null, `${base}/v1/auth/login`, {
      method: 'POST',
      body: loginBody,
    });
    const token = extractToken(data);
    if (!token) {
      throw new AppError('Đăng nhập Selfbooth không trả về token.', 502);
    }
    return token;
  }

  // Photobooth
  const loginPath = config.loginPath || '/auth/login';
  const loginBody = {
    email: config.email,
    password: config.password,
    studio_name: '',
  };
  const data = await getJson(config, null, `${base}${loginPath}`, {
    method: 'POST',
    body: loginBody,
  });
  const token = extractToken(data);
  if (!token) {
    throw new AppError('Đăng nhập Photobooth không trả về token.', 502);
  }
  return token;
}

// -----------------------------------------------------------------------------
// Fetch dữ liệu
// -----------------------------------------------------------------------------

// Mã chụp / voucher. Selfbooth theo ngày; Photobooth trả tất cả (lọc ngày phía service).
async function fetchCodes(config, token, { from, to, status } = {}) {
  const base = baseUrl(config);

  if (config.system === 'selfbooth') {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const url = `${base}/v1/portal/shoot-codes${
      params.toString() ? `?${params}` : ''
    }`;
    return extractList(await getJson(config, token, url));
  }

  const tenant = encodeURIComponent(config.tenant || '');
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (status) params.set('status', status);
  const url = `${base}/portal/${tenant}/vouchers${
    params.toString() ? `?${params}` : ''
  }`;
  return extractList(await getJson(config, token, url));
}

// Lượt chụp / ảnh.
async function fetchSessions(config, token, { from, to } = {}) {
  const base = baseUrl(config);
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  const url =
    config.system === 'selfbooth'
      ? `${base}/v1/portal/sessions${params.toString() ? `?${params}` : ''}`
      : `${base}/portal/${encodeURIComponent(
          config.tenant || '',
        )}/media-sessions${params.toString() ? `?${params}` : ''}`;
  return extractList(await getJson(config, token, url));
}

// Gói chụp (dùng khi tạo mã).
async function fetchPackages(config, token) {
  const base = baseUrl(config);
  const url =
    config.system === 'selfbooth'
      ? `${base}/v1/portal/shoot-packages`
      : `${base}/v1/portal/shoot-packages`;
  return extractList(await getJson(config, token, url));
}

// Doanh thu theo lượt dùng (chủ yếu Selfbooth). Trả { summary, uses, raw }.
async function fetchRevenue(config, token, { from, to } = {}) {
  const base = baseUrl(config);
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  const qs = params.toString() ? `?${params}` : '';
  // Selfbooth: thử nhiều path (docs đã xác thực /v1/web/revenue).
  const candidates =
    config.system === 'selfbooth'
      ? ['/v1/web/revenue', '/v1/portal/revenue']
      : ['/v1/portal/revenue'];

  let lastErr = null;
  for (const path of candidates) {
    try {
      const data = await getJson(config, token, `${base}${path}${qs}`);
      const uses = extractList(data);
      const summary =
        (data && typeof data === 'object' && data.summary) ||
        (data?.data && data.data.summary) ||
        null;
      return { summary, uses, raw: data };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new AppError('Không lấy được doanh thu Selfbooth.', 502);
}

// Tạo mã chụp mới. Trả bản ghi đã chuẩn hoá.
async function createCode(config, token, payload = {}) {
  const base = baseUrl(config);
  let url;
  let body;

  if (config.system === 'selfbooth') {
    url = `${base}/v1/portal/shoot-codes`;
    body = {
      code: payload.code || '',
      count: payload.count || 1,
      kind: payload.kind || payload.code_kind || 'single',
      note: payload.note || '',
      package_id: payload.package_id,
    };
  } else {
    const tenant = encodeURIComponent(config.tenant || '');
    url = `${base}/portal/${tenant}/vouchers`;
    body = {
      count: payload.count || 1,
      created_by: payload.created_by || config.tenant,
      note: payload.note || '',
      type: payload.type || 'cash',
      value: Number(payload.value) || 0,
      valid_from: payload.valid_from || '',
      valid_until: payload.valid_until || '',
    };
  }

  const data = await getJson(config, token, url, {
    method: 'POST',
    body,
  });
  const created =
    (Array.isArray(data) ? data[0] : data?.data ?? data) || {};
  logger.debug(`booth createCode ${config.system} ok`);
  return normalizeCode(config.system, created);
}

module.exports = {
  SYSTEMS,
  isSystem,
  pick,
  extractToken,
  extractList,
  normalizeCode,
  normalizeSession,
  login,
  fetchCodes,
  fetchSessions,
  fetchPackages,
  fetchRevenue,
  createCode,
};

