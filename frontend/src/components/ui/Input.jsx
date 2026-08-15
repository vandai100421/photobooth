export default function Input({
  label,
  error,
  type = 'text',
  id,
  className = '',
  ...props
}) {
  const inputId = id || props.name;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        className={`block w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-400 focus:ring-red-500'
            : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
