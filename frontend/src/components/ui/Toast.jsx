import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const VARIANTS = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-gray-800',
  warning: 'bg-yellow-600',
};

const DEFAULT_DURATION = 3000;

let _toastId = 0;
const nextToastId = () => {
  _toastId += 1;
  return _toastId;
};

export default function Toast({
  message,
  variant = 'info',
  duration = DEFAULT_DURATION,
  onClose,
}) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <ToastItem message={message} variant={variant} onClose={onClose} />
    </div>
  );
}

function ToastItem({ message, variant = 'info', onClose }) {
  return (
    <div
      className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
        VARIANTS[variant] ?? VARIANTS.info
      }`}
      role="status"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="rounded p-0.5 text-white/80 hover:text-white"
        aria-label="Đóng"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, variant = 'info', duration = DEFAULT_DURATION) => {
      if (!message) return;
      const id = nextToastId();
      setToasts((prev) => [...prev, { id, message, variant }]);
      if (duration > 0) {
        setTimeout(() => remove(id), duration);
      }
      return id;
    },
    [remove],
  );

  const api = useMemo(
    () => ({
      success: (msg, duration) => push(msg, 'success', duration),
      error: (msg, duration) => push(msg, 'error', duration),
      info: (msg, duration) => push(msg, 'info', duration),
      warning: (msg, duration) => push(msg, 'warning', duration),
      remove,
    }),
    [push, remove],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex justify-end"
          >
            <ToastItem
              message={t.message}
              variant={t.variant}
              onClose={() => remove(t.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
