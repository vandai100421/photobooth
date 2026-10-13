import axios from 'axios';
import { PHOTOBOOTH_PORTAL } from '../utils/constants';

const client = axios.create({
  baseURL: PHOTOBOOTH_PORTAL.BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

function tenantPath() {
  return encodeURIComponent(PHOTOBOOTH_PORTAL.TENANT);
}

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

export const portalRevenueService = {
  // Danh sách doanh thu theo khoảng ngày.
  revenue: (params) =>
    client
      .get(`/portal/${tenantPath()}/revenue`, { params })
      .then((r) => r.data),

  // Lượt chụp / ảnh để lấy preview. Trả về Map<session_id, session>.
  mediaSessions: async (params) => {
    const res = await client.get(`/portal/${tenantPath()}/media-sessions`, {
      params,
    });
    const payload = res.data;
    const map = new Map();

    // Shape 1: { data: { <session_id>: {...} } }
    // Shape 2: { data: [ {...} ] }
    // Shape 3: { <session_id>: {...} }
    let sessions = [];
    if (Array.isArray(payload)) sessions = payload;
    else if (Array.isArray(payload?.data)) sessions = payload.data;
    else if (payload?.data && typeof payload.data === 'object') {
      sessions = Object.values(payload.data);
    } else if (payload && typeof payload === 'object') {
      sessions = Object.values(payload);
    }

    sessions.forEach((s) => {
      const key = sessionKey(s);
      if (key) map.set(key, s);
    });
    return map;
  },
};

export default portalRevenueService;
