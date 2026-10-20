// Chuẩn hoá ảnh preview từ cover_image + media_base_url của media-session.
export function buildPreviewUrl(session) {
  if (!session) return '';
  const raw = session.raw ?? {};
  const base = raw.media_base_url || raw.gallery_base_url || session.media_base_url || '';
  const cover = session.cover_image || raw.cover_image || '';
  if (!cover) return '';
  if (/^https?:\/\//i.test(cover)) return cover;
  if (!base) return '';
  return `${base.replace(/\/$/, '')}/${cover.replace(/^\//, '')}`;
}

// Lấy session_id ổn định từ nhiều shape response khác nhau.
function sessionKey(session) {
  return (
    session.session_id ||
    session.external_id ||
    session.raw?.session_id ||
    session.id ||
    ''
  );
}

// Danh sách media-session (nhiều shape) → Map<session_id, session> tra preview.
export function toSessionMap(payload) {
  let sessions = [];
  if (Array.isArray(payload)) sessions = payload;
  else if (Array.isArray(payload?.data)) sessions = payload.data;
  else if (payload?.data && typeof payload.data === 'object') {
    sessions = Object.values(payload.data);
  } else if (payload && typeof payload === 'object') {
    sessions = Object.values(payload);
  }

  const map = new Map();
  sessions.forEach((s) => {
    const key = sessionKey(s);
    if (key) map.set(key, s);
  });
  return map;
}
