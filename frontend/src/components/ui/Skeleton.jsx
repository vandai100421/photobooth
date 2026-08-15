export default function Skeleton({ lines = 3, className = '', height }) {
  const items = Array.from({ length: lines });
  return (
    <div className={`w-full ${className}`} role="status" aria-label="loading">
      <div className="space-y-2">
        {items.map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded bg-gray-200"
            style={{
              height: typeof height === 'number' ? `${height}px` : '12px',
              width: `${100 - (i % 3) * 18}%`,
            }}
          />
        ))}
      </div>
      <span className="sr-only">Đang tải...</span>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-6 w-16 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonRows({ count = 5, columns = 4 }) {
  const rows = Array.from({ length: count });
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <div className="min-w-full divide-y divide-gray-100">
        {rows.map((_, r) => (
          <div
            key={r}
            className="flex gap-4 px-4 py-3"
            style={{ minWidth: `${columns * 140}px` }}
          >
            {Array.from({ length: columns }).map((_, c) => (
              <div
                key={c}
                className="h-4 flex-1 animate-pulse rounded bg-gray-200"
                style={{ maxWidth: '160px' }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
