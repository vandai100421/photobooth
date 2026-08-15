const CHART_HEIGHT = 240;
const LABEL_SPACE = 24;
const MIN_BAR_HEIGHT = 2;

export default function BarChart({
  data = [],
  formatValue,
  color = 'bg-brand-500',
}) {
  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
        Không có dữ liệu
      </div>
    );
  }

  const values = data.map((d) => Number(d.value) || 0);
  const maxValue = Math.max(...values, 0);

  return (
    <div className="w-full overflow-x-auto">
      <div
        className="flex w-full items-end gap-2"
        style={{ height: CHART_HEIGHT + LABEL_SPACE }}
      >
        {data.map((item, idx) => {
          const v = Number(item.value) || 0;
          const ratio = maxValue > 0 ? v / maxValue : 0;
          const heightPx = Math.max(ratio * CHART_HEIGHT, MIN_BAR_HEIGHT);
          const display = formatValue
            ? formatValue(item.value)
            : String(item.value);
          return (
            <div
              key={idx}
              className="group flex min-w-[40px] flex-1 flex-col items-center justify-end"
            >
              <div
                className={`relative w-full max-w-[48px] rounded-t-md transition-all duration-300 group-hover:opacity-80 ${color}`}
                style={{ height: heightPx }}
                title={display}
              >
                <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-gray-700 opacity-0 transition-opacity group-hover:opacity-100">
                  {display}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex w-full gap-2">
        {data.map((item, idx) => (
          <div
            key={idx}
            className="min-w-[40px] flex-1 truncate text-center text-xs text-gray-500"
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
