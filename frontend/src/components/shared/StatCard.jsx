const VARIANTS = {
  default: 'border-gray-200',
  success: 'border-green-200',
  warning: 'border-yellow-200',
  danger: 'border-red-200',
  info: 'border-blue-200',
};

const ICON_WRAP = {
  default: 'bg-gray-100 text-gray-600',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
};

export default function StatCard({
  title,
  value,
  sub,
  icon,
  variant = 'default',
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        VARIANTS[variant] ?? VARIANTS.default
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {value ?? '—'}
          </p>
          {sub != null && (
            <p className="mt-1 text-xs text-gray-500">{sub}</p>
          )}
        </div>
        {icon != null && (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              ICON_WRAP[variant] ?? ICON_WRAP.default
            }`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
