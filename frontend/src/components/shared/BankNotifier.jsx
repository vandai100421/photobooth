import { useCallback, useEffect, useRef, useState } from 'react';
import bankTransactionService from '../../services/bankTransactionService';
import {
  announce,
  unlockAudio,
  formatAmountForSpeech,
} from '../../utils/notifySound';
import { useToast } from '../ui/Toast';

const ENABLED_KEY = 'tap_bank_notify_enabled';
const LAST_ID_KEY = 'tap_bank_notify_last_id';
const POLL_MS = 5000;

// Lắng nghe giao dịch ngân hàng mới (tiền vào) và phát loa khi có biến động.
// Đặt trong Layout để chạy nền suốt phiên đăng nhập.
export default function BankNotifier() {
  const toast = useToast();
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(ENABLED_KEY) !== 'false',
  );
  const enabledRef = useRef(enabled);
  const lastIdRef = useRef(
    Number(localStorage.getItem(LAST_ID_KEY)) || 0,
  );
  const readyRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const rememberLastId = useCallback((id) => {
    if (id > lastIdRef.current) {
      lastIdRef.current = id;
      localStorage.setItem(LAST_ID_KEY, String(id));
    }
  }, []);

  // Lấy mốc giao dịch mới nhất để không thông báo lại lịch sử khi mở trang.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await bankTransactionService.latest();
        const latest = res?.data;
        if (latest && !cancelled) {
          rememberLastId(Number(latest.sepay_id) || 0);
        }
      } catch (_err) {
        // Bảng trống hoặc lỗi mạng — bỏ qua, poll sẽ tự cập nhật.
      } finally {
        if (!cancelled) readyRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rememberLastId]);

  const poll = useCallback(async () => {
    if (!readyRef.current) return;
    try {
      const res = await bankTransactionService.list({
        after_id: lastIdRef.current,
        transfer_type: 'in',
        limit: 20,
      });
      const rows = res?.data || [];
      if (!rows.length) return;

      // rows sắp giảm dần — xử lý cũ trước để thứ tự thông báo tự nhiên.
      const ordered = [...rows].sort(
        (a, b) => Number(a.sepay_id) - Number(b.sepay_id),
      );
      for (const tx of ordered) {
        const id = Number(tx.sepay_id) || 0;
        if (id <= lastIdRef.current) continue;
        rememberLastId(id);

        if (!enabledRef.current) continue;

        const amount = Number(tx.transfer_amount) || 0;
        const content = (tx.content || '').trim();
        const text = `Nhận ${formatAmountForSpeech(amount)}.${
          content ? ` Nội dung: ${content}` : ''
        }`;
        announce(text);
        toast.success(text);
      }
    } catch (_err) {
      // Lỗi mạng tạm thời — thử lại ở lần poll kế tiếp.
    }
  }, [rememberLastId, toast]);

  // Mở khóa audio ở lần tương tác đầu tiên (chính sách autoplay của trình duyệt).
  useEffect(() => {
    const onFirstInteract = () => unlockAudio();
    window.addEventListener('pointerdown', onFirstInteract, { once: true });
    window.addEventListener('keydown', onFirstInteract, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onFirstInteract);
      window.removeEventListener('keydown', onFirstInteract);
    };
  }, []);

  // Poll định kỳ + poll ngay khi tab được focus lại.
  useEffect(() => {
    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [poll]);

  const toggle = () => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(ENABLED_KEY, String(next));
      if (next) unlockAudio();
      return next;
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={enabled ? 'Đang bật thông báo biến động số dư' : 'Đang tắt thông báo'}
      className={`fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition ${
        enabled
          ? 'bg-brand-600 text-white hover:bg-brand-700'
          : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
      }`}
      aria-label="Bật/tắt thông báo biến động số dư"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
    </button>
  );
}
