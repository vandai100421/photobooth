export default function Select({
  label,
  options = [],
  value,
  onChange,
  error,
  id,
  placeholder,
  className = '',
  ...props
}) {
  const selectId = id || props.name;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        value={value ?? ''}
        onChange={onChange}
        className={`block w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-400 focus:ring-red-500'
            : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
        } ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lbl = typeof opt === 'string' ? opt : opt.label;
          return (
            <option key={String(val)} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
