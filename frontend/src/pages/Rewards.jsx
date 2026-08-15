import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import rewardsService from '../services/rewardsService';
import employeeService from '../services/employeeService';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import StatCard from '../components/shared/StatCard';
import Toast from '../components/ui/Toast';
import { formatDateTime } from '../utils/formatDate';
import { formatCurrency } from '../utils/formatCurrency';
import {
  ROLES,
  ROLE_LABELS,
  PAYOUT_STATUS_BADGE_VARIANT,
  PAYOUT_STATUS_LABELS,
} from '../utils/constants';

const getErr = (err, fb) =>
  err?.response?.data?.error || err?.response?.data?.message || fb || 'Lỗi';

const currentMonth = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};

export default function Rewards() {
  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;

  const [month, setMonth] = useState(currentMonth());
  const [tab, setTab] = useState('leaderboard');

  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [kpi, setKpi] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesEditing, setRulesEditing] = useState([]);
  const [rulesSaving, setRulesSaving] = useState(false);

  const [payouts, setPayouts] = useState([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutActionId, setPayoutActionId] = useState(null);
  const [createPayoutEmp, setCreatePayoutEmp] = useState('');
  const [createPayoutOpen, setCreatePayoutOpen] = useState(false);
  const [createPayoutLoading, setCreatePayoutLoading] = useState(false);

  const [toast, setToast] = useState({ message: '', variant: 'info' });
  const showToast = useCallback(
    (message, variant = 'success') => setToast({ message, variant }),
    [],
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await employeeService.list({
          is_active: 'true',
          limit: 100,
        });
        setEmployees(res?.data ?? []);
      } catch (_err) {
        setEmployees([]);
      }
    })();
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const res = await rewardsService.leaderboard({ month });
      setLeaderboard(res?.data ?? []);
    } catch (err) {
      showToast(getErr(err, 'Không tải được bảng xếp hạng.'), 'error');
    } finally {
      setLeaderboardLoading(false);
    }
  }, [month, showToast]);

  const fetchKpi = useCallback(
    async (employeeId) => {
      if (!employeeId) {
        setKpi(null);
        return;
      }
      setKpiLoading(true);
      try {
        const res = await rewardsService.kpi({
          employee_id: employeeId,
          month,
        });
        setKpi(res?.data ?? null);
      } catch (err) {
        showToast(getErr(err, 'Không tải được KPI.'), 'error');
      } finally {
        setKpiLoading(false);
      }
    },
    [month, showToast],
  );

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await rewardsService.listBonusRules();
      const data = res?.data ?? [];
      setRules(data);
      setRulesEditing(
        data.map((r) => ({
          code: r.code,
          name: r.name,
          amount: r.amount,
          multiplier: r.multiplier,
          is_active: r.is_active,
        })),
      );
    } catch (err) {
      showToast(getErr(err, 'Không tải được quy tắc.'), 'error');
    } finally {
      setRulesLoading(false);
    }
  }, [showToast]);

  const fetchPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const res = await rewardsService.listPayouts({ month });
      setPayouts(res?.data ?? []);
    } catch (err) {
      showToast(getErr(err, 'Không tải được thù lao.'), 'error');
    } finally {
      setPayoutsLoading(false);
    }
  }, [month, showToast]);

  useEffect(() => {
    if (tab === 'leaderboard') fetchLeaderboard();
    if (tab === 'rules') fetchRules();
    if (tab === 'payouts') fetchPayouts();
  }, [tab, fetchLeaderboard, fetchRules, fetchPayouts]);

  useEffect(() => {
    if (tab === 'leaderboard') fetchLeaderboard();
    if (tab === 'payouts') fetchPayouts();
  }, [month, tab, fetchLeaderboard, fetchPayouts]);

  const handleEmployeeChange = (e) => {
    const id = e.target.value;
    setSelectedEmployee(id);
    fetchKpi(id);
  };

  const handleRuleField = (code, field, value) => {
    setRulesEditing((prev) =>
      prev.map((r) =>
        r.code === code ? { ...r, [field]: value } : r,
      ),
    );
  };

  const handleRulesSave = async () => {
    setRulesSaving(true);
    try {
      const payload = rulesEditing.map((r) => ({
        code: r.code,
        name: r.name,
        amount: Number(r.amount) || 0,
        multiplier: Number(r.multiplier) || 1,
        is_active: r.is_active,
      }));
      const res = await rewardsService.upsertBonusRules(payload);
      setRules(res?.data ?? rules);
      showToast('Đã lưu quy tắc thưởng.');
    } catch (err) {
      showToast(getErr(err, 'Không thể lưu.'), 'error');
    } finally {
      setRulesSaving(false);
    }
  };

  const openCreatePayout = () => {
    setCreatePayoutEmp('');
    setCreatePayoutOpen(true);
  };

  const handleCreatePayout = async () => {
    if (!createPayoutEmp) return;
    setCreatePayoutLoading(true);
    try {
      await rewardsService.createPayout({
        employee_id: createPayoutEmp,
        month,
      });
      showToast('Đã chốt thù lao.');
      setCreatePayoutOpen(false);
      fetchPayouts();
    } catch (err) {
      showToast(getErr(err, 'Không thể chốt thù lao.'), 'error');
    } finally {
      setCreatePayoutLoading(false);
    }
  };

  const markPaid = async (p) => {
    setPayoutActionId(p.id);
    try {
      await rewardsService.updatePayout(p.id, { status: 'paid' });
      showToast('Đã đánh dấu đã trả.');
      fetchPayouts();
    } catch (err) {
      showToast(getErr(err, 'Cập nhật thất bại.'), 'error');
    } finally {
      setPayoutActionId(null);
    }
  };

  const employeeOptions = useMemo(
    () => [
      { value: '', label: '— Chọn nhân viên —' },
      ...employees.map((e) => ({
        value: e.id,
        label: `${e.full_name} (${ROLE_LABELS[e.role] ?? e.role})`,
      })),
    ],
    [employees],
  );

  const tabs = [
    { id: 'leaderboard', label: 'Bảng xếp hạng' },
    { id: 'kpi', label: 'KPI nhân viên' },
    { id: 'payouts', label: 'Chốt thù lao' },
    { id: 'rules', label: 'Quy tắc thưởng' },
  ];

  return (
    <div className="space-y-4">
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'info' })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">KPI & Thưởng</h1>
          <p className="text-sm text-gray-500">Tháng {month}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== Bảng xếp hạng ===== */}
      {tab === 'leaderboard' &&
        (leaderboardLoading ? (
          <LoadingBlock />
        ) : leaderboard.length === 0 ? (
          <EmptyBlock text="Chưa có dữ liệu tháng này." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['#', 'Nhân viên', 'Booking', 'Doanh thu', 'Đánh giá', 'Tổng thưởng'].map(
                    (h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaderboard.map((row) => (
                  <tr key={row.employee_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-bold text-gray-800">
                      {row.rank <= 3 ? `🏆 ${row.rank}` : row.rank}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.full_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.metrics.completed_bookings}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatCurrency(row.metrics.revenue)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.metrics.avg_rating != null
                        ? `⭐ ${row.metrics.avg_rating}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-brand-600">
                      {formatCurrency(row.total_bonus)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {/* ===== KPI nhân viên ===== */}
      {tab === 'kpi' && (
        <div className="space-y-4">
          <div className="max-w-md">
            <Select
              label="Chọn nhân viên"
              options={employeeOptions}
              value={selectedEmployee}
              onChange={handleEmployeeChange}
            />
          </div>

          {!selectedEmployee ? (
            <EmptyBlock text="Chọn nhân viên để xem KPI." />
          ) : kpiLoading ? (
            <LoadingBlock />
          ) : !kpi ? (
            <EmptyBlock text="Không có dữ liệu." />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Booking hoàn thành"
                  value={kpi.metrics.completed_bookings}
                  variant="info"
                />
                <StatCard
                  title="Doanh thu"
                  value={formatCurrency(kpi.metrics.revenue)}
                  variant="success"
                />
                <StatCard
                  title="Số ca làm"
                  value={kpi.metrics.shifts_count}
                  variant="default"
                />
                <StatCard
                  title="Đánh giá TB"
                  value={
                    kpi.metrics.avg_rating != null
                      ? `⭐ ${kpi.metrics.avg_rating}`
                      : '—'
                  }
                  variant="warning"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                  title="Ca cuối tuần / lễ"
                  value={kpi.metrics.weekend_holiday_bookings}
                />
                <StatCard
                  title="KH quay lại"
                  value={kpi.metrics.customer_returns}
                />
                <StatCard
                  title="Đi muộn"
                  value={kpi.metrics.late_count}
                  variant={kpi.metrics.late_count > 3 ? 'danger' : 'default'}
                />
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Chi tiết thưởng
                  </h3>
                  <span className="text-lg font-bold text-brand-600">
                    {formatCurrency(kpi.total_bonus)}
                  </span>
                </div>
                {kpi.breakdown.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    Chưa đạt điều kiện thưởng nào.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {kpi.breakdown.map((line) => (
                      <li
                        key={line.code}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <div>
                          <span className="font-medium text-gray-800">
                            {line.name}
                          </span>
                          <span className="ml-2 text-xs text-gray-500">
                            {line.count} × {formatCurrency(line.per)}
                          </span>
                        </div>
                        <span
                          className={`font-semibold ${
                            line.total >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(line.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== Chốt thù lao ===== */}
      {tab === 'payouts' && (
        <div className="space-y-3">
          {isAdmin && (
            <div className="flex justify-end">
              <Button size="sm" onClick={openCreatePayout}>
                + Chốt thù lao
              </Button>
            </div>
          )}
          {payoutsLoading ? (
            <LoadingBlock />
          ) : payouts.length === 0 ? (
            <EmptyBlock text="Chưa có khoản thù lao nào trong tháng." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Nhân viên', 'Tháng', 'Tổng', 'Trạng thái', 'Hành động'].map(
                      (h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {p.employee?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {p.period_month}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                        {formatCurrency(p.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge
                          variant={
                            PAYOUT_STATUS_BADGE_VARIANT[p.status] ?? 'default'
                          }
                        >
                          {PAYOUT_STATUS_LABELS[p.status] ?? p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {isAdmin && p.status === 'pending' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={payoutActionId === p.id}
                            onClick={() => markPaid(p)}
                          >
                            Đánh dấu đã trả
                          </Button>
                        ) : p.paid_at ? (
                          <span className="text-xs text-gray-400">
                            {formatDateTime(p.paid_at)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== Quy tắc thưởng ===== */}
      {tab === 'rules' && (
        <div className="space-y-3">
          {!isAdmin && (
            <p className="text-sm text-gray-500">
              Chỉ admin mới có quyền chỉnh sửa quy tắc.
            </p>
          )}
          {rulesLoading ? (
            <LoadingBlock />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Mã', 'Tên', 'Số tiền (đ)', 'Hệ số', 'Đang dùng'].map(
                      (h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rulesEditing.map((r) => (
                    <tr key={r.code}>
                      <td className="px-4 py-2 text-xs font-mono text-gray-500">
                        {r.code}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={r.name}
                          disabled={!isAdmin}
                          onChange={(e) =>
                            handleRuleField(r.code, 'name', e.target.value)
                          }
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={r.amount}
                          disabled={!isAdmin}
                          onChange={(e) =>
                            handleRuleField(
                              r.code,
                              'amount',
                              e.target.value,
                            )
                          }
                          className="w-32 rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={r.multiplier}
                          disabled={!isAdmin}
                          onChange={(e) =>
                            handleRuleField(
                              r.code,
                              'multiplier',
                              e.target.value,
                            )
                          }
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={r.is_active}
                          disabled={!isAdmin}
                          onChange={(e) =>
                            handleRuleField(
                              r.code,
                              'is_active',
                              e.target.checked,
                            )
                          }
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {isAdmin && (
            <div className="flex justify-end">
              <Button onClick={handleRulesSave} loading={rulesSaving}>
                Lưu quy tắc
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modal chốt thù lao */}
      <Modal
        open={createPayoutOpen}
        onClose={() => setCreatePayoutOpen(false)}
        title="Chốt thù lao tháng"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCreatePayoutOpen(false)}
            >
              Hủy
            </Button>
            <Button
              loading={createPayoutLoading}
              onClick={handleCreatePayout}
            >
              Chốt
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-gray-600">
          Hệ thống sẽ tính KPI và thưởng tự động cho tháng{' '}
          <strong>{month}</strong>.
        </p>
        <Select
          label="Nhân viên"
          options={employeeOptions}
          value={createPayoutEmp}
          onChange={(e) => setCreatePayoutEmp(e.target.value)}
          placeholder="Chọn nhân viên"
        />
      </Modal>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-gray-500">
      <Spinner size="sm" className="mr-2" />
      Đang tải...
    </div>
  );
}

function EmptyBlock({ text }) {
  return (
    <p className="py-12 text-center text-sm text-gray-500">{text}</p>
  );
}
