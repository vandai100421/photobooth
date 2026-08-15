import Spinner from './Spinner';

export default function Table({
  columns = [],
  data = [],
  loading = false,
  emptyText = 'Không có dữ liệu',
  rowKey = 'id',
  onRowClick,
}) {
  const hasData = data.length > 0;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 ${
                  col.headerClassName ?? ''
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center"
              >
                <span className="inline-flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Spinner size="sm" />
                  Đang tải...
                </span>
              </td>
            </tr>
          )}

          {!loading && !hasData && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-sm text-gray-500"
              >
                {emptyText}
              </td>
            </tr>
          )}

          {!loading &&
            hasData &&
            data.map((row, rowIndex) => {
              const key =
                typeof rowKey === 'function'
                  ? rowKey(row)
                  : row[rowKey] ?? rowIndex;
              const handleRowClick = onRowClick
                ? () => onRowClick(row)
                : undefined;
              return (
                <tr
                  key={key}
                  onClick={handleRowClick}
                  className={
                    onRowClick
                      ? 'cursor-pointer transition hover:bg-gray-50'
                      : 'transition hover:bg-gray-50'
                  }
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`whitespace-nowrap px-4 py-3 text-sm text-gray-700 ${
                        col.className ?? ''
                      }`}
                    >
                      {col.render
                        ? col.render(row[col.key], row, rowIndex)
                        : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
