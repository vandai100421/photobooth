import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_PAGE_SIZE } from '../utils/constants';

const PAGE_PARAM = 'page';

function parsePage(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function usePagination(defaultLimit = DEFAULT_PAGE_SIZE) {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get(PAGE_PARAM));

  const setPage = useCallback(
    (next) => {
      const value = typeof next === 'function' ? next(page) : next;
      const target = Math.max(1, value);
      setSearchParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          if (target <= 1) {
            copy.delete(PAGE_PARAM);
          } else {
            copy.set(PAGE_PARAM, String(target));
          }
          return copy;
        },
        { replace: false },
      );
    },
    [page, setSearchParams],
  );

  const resetPage = useCallback(() => {
    setSearchParams(
      (prev) => {
        const copy = new URLSearchParams(prev);
        copy.delete(PAGE_PARAM);
        return copy;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  // Scroll to top on page change for better UX on long lists
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [page]);

  return { page, limit: defaultLimit, setPage, resetPage };
}

export default usePagination;
