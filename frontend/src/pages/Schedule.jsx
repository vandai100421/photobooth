import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import scheduleService from '../services/scheduleService';
import employeeService from '../services/employeeService';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import Toast from '../components/ui/Toast';
import { formatDateTime } from '../utils/formatDate';
import {
  ROLES,
  SHIFT_STATUS_BADGE_VARIANT,
  SHIFT_STATUS_LABELS,
  SKILL_OPTIONS,
  SWAP_STATUS_BADGE_VARIANT,
  SWAP_STATUS_LABELS,
} from '../utils/constants';

const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const getErr = (err, fb) =>
  err?.response?.data?.error || err?.response?.data?.message || fb || 'Lỗi';

// Trả về thứ Hai đầu tuần của một ngày.
const startOfWeek = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (d, n) => {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
};

const toISODate = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const EMPTY_SHIFT = {
  employee_id: '',
  date: '',
  start_time: '',
  end_time: '',
  location_id: '',
  notes: '',
};

const EMPTY_ASSIGN = {
  date: '',
  start_time: '',
  end_time: '',
  location_id: '',
  skill: '',
};

const EMPTY_LOCATION = { name: '', address: '' };

// Template ca mặc định cho bulk generate.
const DEFAULT_WEEKDAY_SHIFTS = [
  { name: 'Sáng', start: '09:00', end: '13:00' },
  { name: 'Chiều', start: '13:00', end: '17:30' },
  { name: 'Tối', start: '17:30', end: '22:00' },
];
const DEFAULT_WEEKEND_SHIFTS = [
  { name: 'Sáng', start: '07:00', end: '12:00' },
  { name: 'Chiều', start: '12:00', end: '17:30' },
  { name: 'Tối', start: '17:30', end: '23:00' },
];

// Ca đan xen nhau (A 01–09, B 05–12) được xếp vào các lane riêng nên vẫn
// nhìn thấy + bấm được từng ca.
const COMPACT_LANE_THRESHOLD = 4;
const LANE_HEIGHT = 34;
const COMPACT_LANE_HEIGHT = 24;
const LANE_GAP = 4;
const TRACK_PAD_Y = 8;
const EMPTY_TRACK_HEIGHT = 44;
const MIN_BLOCK_WIDTH_PX = 86;

// Mốc giờ Việt Nam (UTC+7). API trả về UTC nên phải cộng bù.
const VN_OFFSET_MIN = 7 * 60;

// Số phút tính từ 00:00 của ngày theo giờ VN.
const vnMinutesOfDay = (isoStr) => {
  if (!isoStr) return 0;
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return 0;
  return (d.getUTCHours() * 60 + d.getUTCMinutes() + VN_OFFSET_MIN) % 1440;
};

// Quy đổi ca về giờ VN tuyệt đối. Ca qua nửa đêm (22:00 → 02:00) được
// đẩy sang +24h để vẫn nằm đúng sau ca trước đó trên trục.
const shiftSpan = (s) => {
  const start = vnMinutesOfDay(s.start_time) / 60;
  let end = vnMinutesOfDay(s.end_time) / 60;
  if (end <= start) end += 24;
  return { start, end };
};

// Chia các ca của một ngày vào nhiều lane sao cho ca này không đè ca khác.
// Mỗi ca được đặt vào lane có sẵn "trống" sớm nhất.
const packLanes = (list) => {
  const items = list
    .map((s) => ({ shift: s, ...shiftSpan(s) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const laneEnds = [];
  const packed = items.map((it) => {
    let lane = -1;
    let bestEnd = Infinity;
    laneEnds.forEach((laneEnd, i) => {
      if (laneEnd <= it.start && laneEnd < bestEnd) {
        bestEnd = laneEnd;
        lane = i;
      }
    });
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.end);
    } else {
      laneEnds[lane] = it.end;
    }
    return { ...it, lane };
  });

  return { items: packed, laneCount: Math.max(laneEnds.length, 1) };
};

// Đọc chuỗi datetime-local (giờ VN do người dùng gõ) thành ngày + số phút.
const parseVnLocal = (value) => {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value || '');
  if (!m) return null;
  return { day: m[1], minutes: Number(m[2]) * 60 + Number(m[3]) };
};

// Nhiều ca chồng nhau cùng lúc → rút gọn chiều cao lane cho khỏi quá cao.
const laneHeightOf = (laneCount) =>
  laneCount > COMPACT_LANE_THRESHOLD ? COMPACT_LANE_HEIGHT : LANE_HEIGHT;

const laneTrackHeight = (laneCount) =>
  laneCount > 0
    ? TRACK_PAD_Y * 2 +
      laneCount * laneHeightOf(laneCount) +
      (laneCount - 1) * LANE_GAP
    : EMPTY_TRACK_HEIGHT;

// Chuyển ISO (UTC) → chuỗi datetime-local theo giờ VN (UTC+7) ổn định,
// không phụ thuộc timezone trình duyệt.
const isoToDatetimeLocalVN = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const vn = new Date(d.getTime() + 7 * 3600_000);
  return `${vn.getUTCFullYear()}-${pad(vn.getUTCMonth() + 1)}-${pad(
    vn.getUTCDate(),
  )}T${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}`;
};

const shiftColorClass = (s) => {
  const n = (s.notes || '').toLowerCase();
  if (n.includes('sáng') || n.includes('sang')) return 'bg-blue-500';
  if (n.includes('chiều') || n.includes('chieu')) return 'bg-green-500';
  if (n.includes('tối') || n.includes('toi')) return 'bg-purple-500';
  const h = shiftSpan(s).start % 24;
  if (h < 12) return 'bg-blue-500';
  if (h < 17.5) return 'bg-green-500';
  return 'bg-purple-500';
};

const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const h = (d.getUTCHours() + 7) % 24;
  const m = d.getUTCMinutes();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}`;
};
const formatTimeRange = (s) => `${fmtTime(s.start_time)}–${fmtTime(s.end_time)}`;

export default function Schedule() {
  const { user } = useAuth();
  const canManage =
    user?.role === ROLES.ADMIN || user?.role === ROLES.MANAGER;

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);

  const [workload, setWorkload] = useState([]);

  const [shiftFormOpen, setShiftFormOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState(EMPTY_SHIFT);
  const [shiftErrors, setShiftErrors] = useState({});
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [shiftFormError, setShiftFormError] = useState('');
  const [editingShift, setEditingShift] = useState(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState(EMPTY_ASSIGN);
  const [assignErrors, setAssignErrors] = useState({});
  const [assignResult, setAssignResult] = useState(null);
  const [assignLoading, setAssignLoading] = useState(false);

  const [swapOpen, setSwapOpen] = useState(false);
  const [swapRequests, setSwapRequests] = useState([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapActionId, setSwapActionId] = useState(null);

  const [locationOpen, setLocationOpen] = useState(false);
  const [locationForm, setLocationForm] = useState(EMPTY_LOCATION);
  const [locationSubmitting, setLocationSubmitting] = useState(false);

  // Quick-add inline: 1 form nhỏ trên mỗi cột ngày, key = ISO date.
  const [quickAdd, setQuickAdd] = useState({});
  const [quickAddBusy, setQuickAddBusy] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);

  // Bulk generate cả tuần.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkWeekday, setBulkWeekday] = useState(DEFAULT_WEEKDAY_SHIFTS);
  const [bulkWeekend, setBulkWeekend] = useState(DEFAULT_WEEKEND_SHIFTS);
  const [bulkAssignees, setBulkAssignees] = useState([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const [toast, setToast] = useState({ message: '', variant: 'info' });
  const showToast = useCallback(
    (message, variant = 'success') => setToast({ message, variant }),
    [],
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const fromStr = toISODate(weekDays[0]);
  const toStr = toISODate(weekDays[6]);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { from: fromStr, to: toStr };
      if (employeeFilter) params.employee_id = employeeFilter;
      if (locationFilter) params.location_id = locationFilter;
      const res = await scheduleService.listShifts(params);
      setShifts(res?.data ?? []);
    } catch (err) {
      setError(getErr(err, 'Không thể tải lịch ca.'));
    } finally {
      setLoading(false);
    }
  }, [fromStr, toStr, employeeFilter, locationFilter]);

  const fetchWorkload = useCallback(async () => {
    try {
      const res = await scheduleService.workload({ from: fromStr, to: toStr });
      setWorkload(res?.data ?? []);
    } catch (_err) {
      setWorkload([]);
    }
  }, [fromStr, toStr]);

  useEffect(() => {
    fetchShifts();
    fetchWorkload();
  }, [fetchShifts, fetchWorkload]);

  useEffect(() => {
    (async () => {
      try {
        const [empRes, locRes] = await Promise.all([
          employeeService.list({ is_active: 'true', limit: 100 }),
          scheduleService.listLocations(),
        ]);
        setEmployees(empRes?.data ?? []);
        setLocations(locRes?.data ?? []);
      } catch (_err) {
        setEmployees([]);
        setLocations([]);
      }
    })();
  }, []);

  const shiftsByDay = useMemo(() => {
    const map = new Map();
    weekDays.forEach((d) =>
      map.set(toISODate(d), { items: [], laneCount: 0 }),
    );
    (shifts || []).forEach((s) => {
      const key = (s.date || '').slice(0, 10);
      const entry = map.get(key);
      if (entry) entry.items.push(s);
    });
    map.forEach((entry) => {
      const packed = packLanes(entry.items);
      entry.items = packed.items;
      entry.laneCount = packed.laneCount;
    });
    return map;
  }, [shifts, weekDays]);

  // Trục giờ co giãn theo ca thực tế trong tuần (mặc định 7h → 23h) để ca
  // ngoài khung giờ cố định (vd 01:00, ca qua nửa đêm) vẫn hiển thị đúng.
  const timeline = useMemo(() => {
    let minHour = 7;
    let maxHour = 23;
    (shifts || []).forEach((s) => {
      const { start, end } = shiftSpan(s);
      minHour = Math.min(minHour, start);
      maxHour = Math.max(maxHour, end);
    });
    const start = Math.max(0, Math.floor(minHour));
    const end = Math.min(24, Math.max(Math.ceil(maxHour), start + 1));
    return { start, end, span: end - start };
  }, [shifts]);

  const hourLeftPct = useCallback(
    (h) => ((h - timeline.start) / timeline.span) * 100,
    [timeline],
  );

  const timelineHours = useMemo(() => {
    const out = [];
    for (let h = timeline.start; h <= timeline.end; h += 1) out.push(h);
    return out;
  }, [timeline]);

  // Ca trùng giờ của cùng một nhân viên → cảnh báo (đan xen giữa NV khác vẫn OK).
  const sameEmployeeConflicts = useMemo(() => {
    const set = new Set();
    shiftsByDay.forEach((entry) => {
      entry.items.forEach((a, i) => {
        entry.items.forEach((b, j) => {
          if (i >= j) return;
          if (a.shift.employee_id !== b.shift.employee_id) return;
          if (a.start < b.end && b.start < a.end) {
            set.add(a.shift.id);
            set.add(b.shift.id);
          }
        });
      });
    });
    return set;
  }, [shiftsByDay]);

  // Cảnh báo khi ca đang soạn trùng giờ với một ca khác của CÙNG nhân viên.
  // Đan xen giờ giữa 2 nhân viên khác nhau vẫn hợp lệ nên không cảnh báo.
  const shiftFormOverlap = useMemo(() => {
    if (!shiftForm.employee_id) return null;
    const st = parseVnLocal(shiftForm.start_time);
    const en = parseVnLocal(shiftForm.end_time);
    if (!st || !en) return null;
    const start = st.minutes;
    let end = en.minutes;
    if (en.day !== st.day || end <= start) end += 1440;
    const entry = shiftsByDay.get(st.day);
    if (!entry) return null;
    const hit = entry.items.find(
      (it) =>
        it.shift.id !== editingShift?.id &&
        it.shift.employee_id === shiftForm.employee_id &&
        start < it.end * 60 &&
        it.start * 60 < end,
    );
    return hit ? formatTimeRange(hit.shift) : null;
  }, [shiftForm, shiftsByDay, editingShift]);

  const employeeOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả nhân viên' },
      ...employees.map((e) => ({
        value: e.id,
        label: e.full_name,
      })),
    ],
    [employees],
  );

  const locationOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả địa điểm' },
      ...locations.map((l) => ({ value: l.id, label: l.name })),
    ],
    [locations],
  );

  const openCreateShift = (prefill = {}) => {
    setEditingShift(null);
    setShiftForm({
      ...EMPTY_SHIFT,
      date: toISODate(new Date()),
      ...prefill,
    });
    setShiftErrors({});
    setShiftFormError('');
    setShiftFormOpen(true);
  };

  const openEditShift = (shift) => {
    setEditingShift(shift);
    const empId = shift.employee_id || shift.employee?.id || '';
    const locId = shift.location_id || shift.location?.id || '';
    setShiftForm({
      employee_id: empId,
      date: shift.date ? shift.date.slice(0, 10) : '',
      start_time: isoToDatetimeLocalVN(shift.start_time),
      end_time: isoToDatetimeLocalVN(shift.end_time),
      location_id: locId,
      notes: shift.notes || '',
    });
    setShiftErrors({});
    setShiftFormError('');
    setShiftFormOpen(true);
  };

  const closeShiftForm = () => {
    setShiftFormOpen(false);
    setShiftFormError('');
    setShiftErrors({});
  };

  const handleShiftFormChange = (e) => {
    const { name, value } = e.target;
    setShiftForm((p) => ({ ...p, [name]: value }));
    if (shiftErrors[name]) {
      setShiftErrors((p) => ({ ...p, [name]: undefined }));
    }
  };

  const validateShift = () => {
    const next = {};
    if (!shiftForm.employee_id) next.employee_id = 'Chọn nhân viên';
    if (!shiftForm.date) next.date = 'Chọn ngày';
    if (!shiftForm.start_time) next.start_time = 'Chọn giờ bắt đầu';
    if (!shiftForm.end_time) next.end_time = 'Chọn giờ kết thúc';
    if (
      shiftForm.start_time &&
      shiftForm.end_time &&
      new Date(shiftForm.end_time) <= new Date(shiftForm.start_time)
    ) {
      next.end_time = 'Giờ kết thúc phải sau giờ bắt đầu';
    }
    setShiftErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleShiftSubmit = async (e) => {
    e.preventDefault();
    setShiftFormError('');
    if (!validateShift()) return;
    // Input datetime-local không có timezone → gán offset +07:00 (giờ VN)
    // để server lưu đúng giờ VN chứ không lệch theo timezone trình duyệt.
    const toIsoVN = (val) => (val ? `${val}:00+07:00` : val);
    const payload = {
      employee_id: shiftForm.employee_id,
      date: shiftForm.date,
      start_time: toIsoVN(shiftForm.start_time),
      end_time: toIsoVN(shiftForm.end_time),
      location_id: shiftForm.location_id || undefined,
      notes: shiftForm.notes || undefined,
    };
    setShiftSubmitting(true);
    try {
      if (editingShift) {
        await scheduleService.updateShift(editingShift.id, payload);
        showToast('Đã cập nhật ca làm.');
      } else {
        await scheduleService.createShift(payload);
        showToast('Đã tạo ca làm mới.');
      }
      closeShiftForm();
      fetchShifts();
      fetchWorkload();
    } catch (err) {
      setShiftFormError(getErr(err, 'Không thể lưu ca làm.'));
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleDeleteShift = async (shift) => {
    if (!window.confirm('Xóa ca làm này?')) return;
    try {
      await scheduleService.removeShift(shift.id);
      showToast('Đã xóa ca.');
      fetchShifts();
      fetchWorkload();
    } catch (err) {
      showToast(getErr(err, 'Không thể xóa ca.'), 'error');
    }
  };

  // ===== Quick-add inline (trên mỗi cột ngày) =====
  const getQuickAddForm = (dateStr) =>
    quickAdd[dateStr] || { employee_id: '', start: '09:00', end: '13:00' };

  const setQuickAddField = (dateStr, field, value) => {
    setQuickAdd((prev) => {
      const cur = prev[dateStr] || {
        employee_id: '',
        start: '09:00',
        end: '13:00',
      };
      return { ...prev, [dateStr]: { ...cur, [field]: value } };
    });
  };

  const handleQuickAdd = async (dateStr) => {
    const form = getQuickAddForm(dateStr);
    if (!form.employee_id) {
      showToast('Chọn nhân viên trước.', 'error');
      return;
    }
if (!form.start || !form.end || form.start === form.end) {
      showToast('Nhập đủ giờ bắt đầu và kết thúc (khác nhau).', 'error');
      return;
    }
    const [startISO, endISO] = buildShiftRangeISO(
      dateStr,
      form.start,
      form.end,
    );
    setQuickAddBusy(dateStr);
    try {
      await scheduleService.createShift({
        employee_id: form.employee_id,
        date: dateStr,
        start_time: startISO,
        end_time: endISO,
      });
      showToast('Đã thêm ca.');
      // Reset form nhưng giữ giờ để tạo ca tiếp theo nhanh.
      setQuickAdd((prev) => ({
        ...prev,
        [dateStr]: { employee_id: '', start: form.start, end: form.end },
      }));
      fetchShifts();
      fetchWorkload();
    } catch (err) {
      showToast(getErr(err, 'Không thể tạo ca.'), 'error');
    } finally {
      setQuickAddBusy(null);
    }
  };

  // ===== Bulk generate cả tuần =====
  const openBulk = () => {
    // Mặc định chọn tất cả NV active, luân phiên.
    setBulkAssignees(employees.map((e) => e.id));
    setBulkWeekday(DEFAULT_WEEKDAY_SHIFTS);
    setBulkWeekend(DEFAULT_WEEKEND_SHIFTS);
    setBulkOpen(true);
  };

  const toggleBulkAssignee = (id) => {
    setBulkAssignees((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id],
    );
  };

  const handleBulkShiftField = (kind, idx, field, value) => {
    const setter = kind === 'weekday' ? setBulkWeekday : setBulkWeekend;
    setter((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    );
  };

  const handleBulkGenerate = async () => {
    if (bulkAssignees.length === 0) {
      showToast('Chọn ít nhất 1 nhân viên.', 'error');
      return;
    }
    setBulkSubmitting(true);
    let created = 0;
    let failed = 0;
    let rotator = 0;
    try {
      for (const day of weekDays) {
        const dateStr = toISODate(day);
        const dow = day.getDay();
        const isWeekend = dow === 0 || dow === 6;
        const shifts = isWeekend ? bulkWeekend : bulkWeekday;
        for (const sh of shifts) {
          const empId = bulkAssignees[rotator % bulkAssignees.length];
          rotator += 1;
          const [startISO, endISO] = buildShiftRangeISO(
            dateStr,
            sh.start,
            sh.end,
          );
          try {
            await scheduleService.createShift({
              employee_id: empId,
              date: dateStr,
              start_time: startISO,
              end_time: endISO,
              notes: `Ca ${sh.name}`,
            });
            created += 1;
          } catch (_err) {
            failed += 1;
          }
        }
      }
      showToast(
        `Đã tạo ${created} ca${failed > 0 ? ` (${failed} lỗi)` : ''}.`,
      );
      setBulkOpen(false);
      fetchShifts();
      fetchWorkload();
    } catch (err) {
      showToast(getErr(err, 'Tạo hàng loạt thất bại.'), 'error');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // ===== Auto-assign =====
  const openAssign = () => {
    setAssignForm({
      ...EMPTY_ASSIGN,
      date: toISODate(new Date()),
    });
    setAssignResult(null);
    setAssignErrors({});
    setAssignOpen(true);
  };

  const handleAssignChange = (e) => {
    const { name, value } = e.target;
    setAssignForm((p) => ({ ...p, [name]: value }));
    if (assignErrors[name]) {
      setAssignErrors((p) => ({ ...p, [name]: undefined }));
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!assignForm.date) next.date = 'Chọn ngày';
    if (!assignForm.start_time) next.start_time = 'Chọn giờ bắt đầu';
    if (!assignForm.end_time) next.end_time = 'Chọn giờ kết thúc';
    if (
      assignForm.start_time &&
      assignForm.end_time &&
      new Date(assignForm.end_time) <= new Date(assignForm.start_time)
    ) {
      next.end_time = 'Giờ kết thúc phải sau giờ bắt đầu';
    }
    setAssignErrors(next);
    if (Object.keys(next).length > 0) return;

    setAssignLoading(true);
    try {
      const params = {
        date: assignForm.date,
        start_time: new Date(assignForm.start_time).toISOString(),
        end_time: new Date(assignForm.end_time).toISOString(),
        location_id: assignForm.location_id || undefined,
        skill: assignForm.skill || undefined,
      };
      const res = await scheduleService.autoAssign(params);
      setAssignResult(res?.data ?? null);
    } catch (err) {
      showToast(getErr(err, 'Không thể gợi ý.'), 'error');
    } finally {
      setAssignLoading(false);
    }
  };

  const pickCandidate = (c) => {
    setAssignOpen(false);
    openCreateShift({
      employee_id: c.employee_id,
      location_id: assignForm.location_id,
      date: assignForm.date,
      start_time: assignForm.start_time,
      end_time: assignForm.end_time,
    });
  };

  // ===== Swap requests =====
  const openSwap = async () => {
    setSwapOpen(true);
    setSwapRequests([]);
    setSwapLoading(true);
    try {
      const res = await scheduleService.listSwapRequests();
      setSwapRequests(res?.data ?? []);
    } catch (err) {
      showToast(getErr(err, 'Không thể tải yêu cầu.'), 'error');
    } finally {
      setSwapLoading(false);
    }
  };

  const reviewSwap = async (id, status) => {
    setSwapActionId(id);
    try {
      await scheduleService.reviewSwapRequest(id, { status });
      showToast(
        status === 'approved' ? 'Đã duyệt yêu cầu.' : 'Đã từ chối yêu cầu.',
      );
      const res = await scheduleService.listSwapRequests();
      setSwapRequests(res?.data ?? []);
      fetchShifts();
    } catch (err) {
      showToast(getErr(err, 'Duyệt thất bại.'), 'error');
    } finally {
      setSwapActionId(null);
    }
  };

  // ===== Locations =====
  const openLocations = () => {
    setLocationForm(EMPTY_LOCATION);
    setLocationOpen(true);
  };

  const handleLocationSubmit = async (e) => {
    e.preventDefault();
    if (!locationForm.name.trim()) return;
    setLocationSubmitting(true);
    try {
      await scheduleService.createLocation({
        name: locationForm.name.trim(),
        address: locationForm.address.trim() || undefined,
      });
      showToast('Đã thêm địa điểm.');
      setLocationForm(EMPTY_LOCATION);
      const res = await scheduleService.listLocations();
      setLocations(res?.data ?? []);
    } catch (err) {
      showToast(getErr(err, 'Không thể thêm địa điểm.'), 'error');
    } finally {
      setLocationSubmitting(false);
    }
  };

  const toggleLocationActive = async (loc) => {
    try {
      await scheduleService.updateLocation(loc.id, {
        is_active: !loc.is_active,
      });
      const res = await scheduleService.listLocations();
      setLocations(res?.data ?? []);
    } catch (err) {
      showToast(getErr(err, 'Cập nhật thất bại.'), 'error');
    }
  };

  const weekLabel = `${formatShort(weekDays[0])} → ${formatShort(weekDays[6])}`;

  return (
    <div className="space-y-4">
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'info' })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Lịch công tác</h1>
          <p className="text-sm text-gray-500">{weekLabel}</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={openBulk}>
              ⚡ Tạo nhanh tuần
            </Button>
            <Button variant="secondary" size="sm" onClick={openAssign}>
              Gợi ý NV
            </Button>
            <Button variant="secondary" size="sm" onClick={openSwap}>
              Đổi ca / nghỉ
            </Button>
            <Button variant="secondary" size="sm" onClick={openLocations}>
              Địa điểm
            </Button>
            <Button size="sm" onClick={() => openCreateShift()}>
              + Tạo ca
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWeekStart((d) => addDays(d, -7))}
        >
          ← Tuần trước
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWeekStart(startOfWeek(new Date()))}
        >
          Tuần này
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWeekStart((d) => addDays(d, 7))}
        >
          Tuần sau →
        </Button>
        <div className="ml-auto grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
          <Select
            options={employeeOptions}
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
          />
          <Select
            options={locationOptions}
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={fetchShifts}
            className="ml-2 underline hover:text-red-800"
          >
            Thử lại
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-gray-500">
          <Spinner size="sm" className="mr-2" />
          Đang tải...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <div className="min-w-[760px]">
            {/* Thanh timeline (trục giờ) */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              <div className="w-28 shrink-0 border-r border-gray-200 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Ngày
              </div>
              <div className="relative h-7 flex-1">
                {timelineHours.map((h) => (
                  <div
                    key={h}
                    style={{ left: `${hourLeftPct(h)}%` }}
                    className="absolute top-0 bottom-0 border-l border-gray-200"
                  >
                    {h % 2 === 1 && (
                      <span className="ml-1 text-[10px] font-medium text-gray-400">
                        {h}h
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Hàng = mỗi ngày trong tuần */}
            {weekDays.map((day, idx) => {
              const key = toISODate(day);
              const dayEntry = shiftsByDay.get(key);
              const items = dayEntry?.items ?? [];
              const laneCount = dayEntry?.laneCount ?? 0;
              const isExpanded = expandedDay === key;
              const isWeekend = idx === 5 || idx === 6;
              return (
                <div
                  key={key}
                  className="border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex">
                    {/* Cột nhãn ngày */}
                    <div
                      className={`w-28 shrink-0 border-r border-gray-100 px-2 py-2 ${
                        isWeekend ? 'bg-amber-50/50' : ''
                      }`}
                    >
                      <div className="text-xs font-medium text-gray-500">
                        {DAY_NAMES[idx]}
                      </div>
                      <div className="text-sm font-bold text-gray-800">
                        {day.getDate()}/{day.getMonth() + 1}
                      </div>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDay(isExpanded ? null : key)
                          }
                          className="mt-1 text-xs text-brand-600 hover:underline"
                        >
                          {isExpanded ? '− Thu gọn' : '+ Thêm ca'}
                        </button>
                      )}
                    </div>

                    {/* Track timeline — mỗi lane là 1 hàng, ca chồng giờ xếp chồng dọc */}
                    <div
                      className="relative flex-1"
                      style={{ height: laneTrackHeight(laneCount) }}
                    >
                      {timelineHours.map((h) => (
                        <div
                          key={h}
                          style={{ left: `${hourLeftPct(h)}%` }}
                          className="absolute top-0 bottom-0 border-l border-gray-50"
                        />
                      ))}
                      {items.map((it) => {
                        const s = it.shift;
                        const left = Math.max(0, hourLeftPct(it.start));
                        const right = Math.min(100, hourLeftPct(it.end));
                        const width = Math.max(0, right - left);
                        const conflict = sameEmployeeConflicts.has(s.id);
                        const laneHeight = laneHeightOf(laneCount);
                        const compact = laneHeight === COMPACT_LANE_HEIGHT;
                        return (
                          <div
                            key={s.id}
                            style={{
                              left: `${left}%`,
                              width: `${width}%`,
                              minWidth: `${MIN_BLOCK_WIDTH_PX}px`,
                              top: `${TRACK_PAD_Y + it.lane * (laneHeight + LANE_GAP)}px`,
                              height: `${laneHeight}px`,
                            }}
                            className={`absolute cursor-pointer overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] text-white transition hover:opacity-90 ${shiftColorClass(
                              s,
                            )} ${conflict ? 'ring-2 ring-red-400' : ''}`}
                            onClick={() => openEditShift(s)}
                            title={`${formatTimeRange(s)} • ${
                              s.employee?.full_name ?? ''
                            }${s.location?.name ? ' • ' + s.location.name : ''}${
                              conflict
                                ? '\n⚠ Trùng giờ với ca khác của cùng nhân viên'
                                : ''
                            }`}
                          >
                            <div className="font-semibold leading-tight">
                              {formatTimeRange(s)}
                            </div>
                            {!compact && (
                              <div className="truncate leading-tight opacity-90">
                                {s.employee?.full_name ?? '—'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {items.length === 0 && (
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-300">
                          Trống
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick-add mở rộng */}
                  {isExpanded && canManage && (
                    <div className="border-t border-dashed border-gray-200 bg-gray-50 p-2">
                      <QuickAddShift
                        dateStr={key}
                        form={getQuickAddForm(key)}
                        employees={employees}
                        busy={quickAddBusy === key}
                        onChange={(field, value) =>
                          setQuickAddField(key, field, value)
                        }
                        onSubmit={() => handleQuickAdd(key)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Workload tuần */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          Tải công việc trong tuần
        </h3>
        {workload.length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có dữ liệu.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {workload
              .filter((w) => w.shift_count > 0)
              .map((w) => (
                <div
                  key={w.employee_id}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <div className="truncate text-sm font-medium text-gray-800">
                    {w.full_name}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    <Badge variant="info">{w.shift_count} ca</Badge>
                    <span>{w.total_hours} giờ</span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Modal tạo/sửa ca */}
      <Modal
        open={shiftFormOpen}
        onClose={closeShiftForm}
        title={editingShift ? 'Sửa ca làm' : 'Tạo ca làm'}
        size="md"
        footer={
          <>
            {editingShift && (
              <Button
                variant="danger"
                size="sm"
                className="mr-auto"
                onClick={() => {
                  handleDeleteShift(editingShift);
                  closeShiftForm();
                }}
              >
                Xóa ca
              </Button>
            )}
            <Button variant="secondary" onClick={closeShiftForm}>
              Hủy
            </Button>
            <Button
              type="submit"
              form="shift-form"
              loading={shiftSubmitting}
            >
              {editingShift ? 'Lưu' : 'Tạo'}
            </Button>
          </>
        }
      >
        {shiftFormError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {shiftFormError}
          </div>
        )}
        {shiftFormOverlap && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ⚠ Nhân viên này đã có ca {shiftFormOverlap} trùng giờ. Vẫn có thể
            lưu nếu cần.
          </div>
        )}
        <form
          id="shift-form"
          onSubmit={handleShiftSubmit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          noValidate
        >
          <div className="sm:col-span-2">
            <Select
              label="Nhân viên"
              name="employee_id"
              options={employees.map((e) => ({
                value: e.id,
                label: `${e.full_name} (${e.role})`,
              }))}
              value={shiftForm.employee_id}
              onChange={handleShiftFormChange}
              error={shiftErrors.employee_id}
              placeholder="Chọn nhân viên"
            />
          </div>
          <Input
            label="Ngày"
            name="date"
            type="date"
            value={shiftForm.date}
            error={shiftErrors.date}
            onChange={handleShiftFormChange}
          />
          <Select
            label="Địa điểm"
            name="location_id"
            options={[
              { value: '', label: '— Không —' },
              ...locations.map((l) => ({ value: l.id, label: l.name })),
            ]}
            value={shiftForm.location_id}
            onChange={handleShiftFormChange}
          />
          <Input
            label="Giờ bắt đầu"
            name="start_time"
            type="datetime-local"
            value={shiftForm.start_time}
            error={shiftErrors.start_time}
            onChange={handleShiftFormChange}
          />
          <Input
            label="Giờ kết thúc"
            name="end_time"
            type="datetime-local"
            value={shiftForm.end_time}
            error={shiftErrors.end_time}
            onChange={handleShiftFormChange}
          />
          <div className="sm:col-span-2">
            <Input
              label="Ghi chú"
              name="notes"
              value={shiftForm.notes}
              onChange={handleShiftFormChange}
              placeholder="(tùy chọn)"
            />
          </div>
        </form>
      </Modal>

      {/* Modal auto-assign */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Gợi ý phân bổ nhân viên"
        size="lg"
      >
        <form
          onSubmit={handleAssignSubmit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          noValidate
        >
          <Input
            label="Ngày"
            name="date"
            type="date"
            value={assignForm.date}
            error={assignErrors.date}
            onChange={handleAssignChange}
          />
          <Select
            label="Kỹ năng cần"
            name="skill"
            options={[{ value: '', label: '— Không —' }, ...SKILL_OPTIONS]}
            value={assignForm.skill}
            onChange={handleAssignChange}
          />
          <Input
            label="Giờ bắt đầu"
            name="start_time"
            type="datetime-local"
            value={assignForm.start_time}
            error={assignErrors.start_time}
            onChange={handleAssignChange}
          />
          <Input
            label="Giờ kết thúc"
            name="end_time"
            type="datetime-local"
            value={assignForm.end_time}
            error={assignErrors.end_time}
            onChange={handleAssignChange}
          />
          <div className="sm:col-span-2">
            <Select
              label="Địa điểm"
              name="location_id"
              options={[
                { value: '', label: '— Không —' },
                ...locations.map((l) => ({ value: l.id, label: l.name })),
              ]}
              value={assignForm.location_id}
              onChange={handleAssignChange}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" loading={assignLoading}>
              Gợi ý
            </Button>
          </div>
        </form>

        {assignResult && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold text-gray-700">
              Kết quả ({assignResult.candidates?.length ?? 0} nhân viên)
            </h4>
            {assignResult.candidates?.length === 0 ? (
              <p className="text-sm text-gray-400">Không có nhân viên nào.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {assignResult.candidates.map((c) => (
                  <li
                    key={c.employee_id}
                    className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1 text-sm">
                      <div className="font-medium text-gray-800">
                        {c.full_name}
                        {!c.is_available && (
                          <Badge variant="danger" className="ml-2">
                            Bận
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-xs text-gray-500">
                        <span>Tải tuần: {c.workload}</span>
                        {c.skills?.map((s) => (
                          <Badge key={s.skill} variant="info">
                            {s.skill} lv{s.level}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-xs text-gray-400">
                        {c.reasons.join(' · ')}
                      </div>
                    </div>
                    {canManage && c.is_available && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => pickCandidate(c)}
                      >
                        Chọn
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      {/* Modal yêu cầu đổi ca */}
      <Modal
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        title="Yêu cầu đổi ca / nghỉ"
        size="lg"
      >
        {swapLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-500">
            <Spinner size="sm" className="mr-2" />
            Đang tải...
          </div>
        ) : swapRequests.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Chưa có yêu cầu nào.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {swapRequests.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-0.5 text-sm">
                  <div className="font-medium text-gray-800">
                    {r.requester?.full_name ?? '—'}
                  </div>
                  {r.shift && (
                    <div className="text-xs text-gray-500">
                      {formatDateTime(r.shift.start_time)} →{' '}
                      {formatDateTime(r.shift.end_time)}
                    </div>
                  )}
                  {r.reason && (
                    <div className="text-xs text-gray-400">{r.reason}</div>
                  )}
                  <Badge
                    variant={SWAP_STATUS_BADGE_VARIANT[r.status] ?? 'default'}
                  >
                    {SWAP_STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                </div>
                {canManage && r.status === 'pending' && (
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      loading={swapActionId === r.id}
                      onClick={() => reviewSwap(r.id, 'approved')}
                    >
                      Duyệt
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={swapActionId === r.id}
                      onClick={() => reviewSwap(r.id, 'rejected')}
                    >
                      Từ chối
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Modal địa điểm */}
      <Modal
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        title="Địa điểm hoạt động"
        size="md"
      >
        <form
          onSubmit={handleLocationSubmit}
          className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <Input
            label="Tên địa điểm"
            name="name"
            value={locationForm.name}
            onChange={(e) =>
              setLocationForm((p) => ({ ...p, name: e.target.value }))
            }
            placeholder="Cửa hàng Q1 / Sự kiện A"
          />
          <Input
            label="Địa chỉ"
            name="address"
            value={locationForm.address}
            onChange={(e) =>
              setLocationForm((p) => ({ ...p, address: e.target.value }))
            }
            placeholder="Số nhà, đường, quận"
          />
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" loading={locationSubmitting}>
              + Thêm
            </Button>
          </div>
        </form>

        {locations.length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có địa điểm.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {locations.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-800">
                    {l.name}
                  </div>
                  {l.address && (
                    <div className="truncate text-xs text-gray-500">
                      {l.address}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleLocationActive(l)}
                  className="ml-2 shrink-0"
                >
                  <Badge variant={l.is_active ? 'success' : 'default'}>
                    {l.is_active ? 'Đang dùng' : 'Tắt'}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Modal tạo nhanh cả tuần */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="⚡ Tạo nhanh ca cho cả tuần"
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulkOpen(false)}>
              Hủy
            </Button>
            <Button loading={bulkSubmitting} onClick={handleBulkGenerate}>
              Tạo {weekDays.length * 3} ca
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-gray-600">
          Cấu hình ca mẫu cho tuần{' '}
          <strong>{weekLabel}</strong>. Hệ thống sẽ tự luân phiên nhân viên
          được chọn qua các ca.
        </p>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 p-3">
            <h4 className="mb-2 text-sm font-semibold text-gray-700">
              Ca T2–T6
            </h4>
            <div className="space-y-2">
              {bulkWeekday.map((sh, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={sh.name}
                    onChange={(e) =>
                      handleBulkShiftField('weekday', i, 'name', e.target.value)
                    }
                    className="w-24"
                    placeholder="Tên ca"
                  />
                  <Input
                    type="time"
                    value={sh.start}
                    onChange={(e) =>
                      handleBulkShiftField('weekday', i, 'start', e.target.value)
                    }
                    className="flex-1"
                  />
                  <span className="text-gray-400">→</span>
                  <Input
                    type="time"
                    value={sh.end}
                    onChange={(e) =>
                      handleBulkShiftField('weekday', i, 'end', e.target.value)
                    }
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <h4 className="mb-2 text-sm font-semibold text-gray-700">
              Ca T7–CN
            </h4>
            <div className="space-y-2">
              {bulkWeekend.map((sh, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={sh.name}
                    onChange={(e) =>
                      handleBulkShiftField('weekend', i, 'name', e.target.value)
                    }
                    className="w-24"
                    placeholder="Tên ca"
                  />
                  <Input
                    type="time"
                    value={sh.start}
                    onChange={(e) =>
                      handleBulkShiftField('weekend', i, 'start', e.target.value)
                    }
                    className="flex-1"
                  />
                  <span className="text-gray-400">→</span>
                  <Input
                    type="time"
                    value={sh.end}
                    onChange={(e) =>
                      handleBulkShiftField('weekend', i, 'end', e.target.value)
                    }
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 p-3">
          <h4 className="mb-2 text-sm font-semibold text-gray-700">
            Nhân viên luân phiên ({bulkAssignees.length} đã chọn)
          </h4>
          <div className="flex flex-wrap gap-2">
            {employees.map((e) => {
              const checked = bulkAssignees.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggleBulkAssignee(e.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    checked
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {e.full_name}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Thứ tự luân phiên theo thứ tự chọn. Mỗi ca sẽ giao cho NV tiếp theo.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function QuickAddShift({
  dateStr,
  form,
  employees,
  busy,
  onChange,
  onSubmit,
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  };
  return (
    <div className="rounded-lg border border-dashed border-brand-300 bg-brand-50/50 p-1.5">
      <select
        value={form.employee_id}
        onChange={(e) => onChange('employee_id', e.target.value)}
        onKeyDown={handleKeyDown}
        className="mb-1 block w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <option value="">+ NV...</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.full_name}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1">
        <input
          type="time"
          value={form.start}
          onChange={(e) => onChange('start', e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full rounded border border-gray-300 px-1 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <span className="text-xs text-gray-400">→</span>
        <input
          type="time"
          value={form.end}
          onChange={(e) => onChange('end', e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full rounded border border-gray-300 px-1 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy}
        className="mt-1 w-full rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? '...' : '+ Thêm ca'}
      </button>
    </div>
  );
}

function formatShort(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

// Kết hợp date (YYYY-MM-DD) + time (HH:MM) → ISO với offset +07:00 (giờ VN).
function combineDateTimeISO(dateStr, hhmm, dayOffset = 0) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  const base = new Date(Date.UTC(y, m - 1, d + dayOffset));
  base.setUTCHours(hh, mm, 0, 0);
  return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(
    base.getUTCDate(),
  )}T${pad(base.getUTCHours())}:${pad(base.getUTCMinutes())}:00+07:00`;
}

// Tạo cặp [start, end] cho một ca. Giờ kết thúc <= giờ bắt đầu được hiểu là
// ca qua nửa đêm (vd 22:00 → 02:00) nên end dồn sang ngày kế tiếp.
function buildShiftRangeISO(dateStr, startHHMM, endHHMM) {
  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const rollover = toMin(endHHMM) < toMin(startHHMM) ? 1 : 0;
  return [
    combineDateTimeISO(dateStr, startHHMM),
    combineDateTimeISO(dateStr, endHHMM, rollover),
  ];
}
