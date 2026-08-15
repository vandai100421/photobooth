import Button from './Button';

const MAX_VISIBLE = 5;

function buildRange(page, totalPages) {
  if (totalPages <= MAX_VISIBLE) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const half = Math.floor(MAX_VISIBLE / 2);
  let start = Math.max(1, page - half);
  const end = Math.min(totalPages, start + MAX_VISIBLE - 1);
  if (end - start + 1 < MAX_VISIBLE) {
    start = Math.max(1, end - MAX_VISIBLE + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function Pagination({
  page = 1,
  totalPages = 1,
  onPageChange,
}) {
  if (totalPages <= 1) return null;

  const current = Math.min(Math.max(1, page), totalPages);
  const pages = buildRange(current, totalPages);
  const canPrev = current > 1;
  const canNext = current < totalPages;

  const go = (next) => {
    const target = Math.min(Math.max(1, next), totalPages);
    if (target !== current) onPageChange?.(target);
  };

  return (
    <nav
      className="flex items-center justify-center gap-1.5"
      aria-label="Phân trang"
    >
      <Button
        variant="secondary"
        size="sm"
        disabled={!canPrev}
        onClick={() => go(current - 1)}
      >
        Trước
      </Button>

      {pages[0] > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(1)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            1
          </button>
          {pages[0] > 2 && (
            <span className="px-1 text-gray-400">…</span>
          )}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => go(p)}
          aria-current={p === current ? 'page' : undefined}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            p === current
              ? 'bg-brand-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {p}
        </button>
      ))}

      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && (
            <span className="px-1 text-gray-400">…</span>
          )}
          <button
            type="button"
            onClick={() => go(totalPages)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            {totalPages}
          </button>
        </>
      )}

      <Button
        variant="secondary"
        size="sm"
        disabled={!canNext}
        onClick={() => go(current + 1)}
      >
        Sau
      </Button>
    </nav>
  );
}
