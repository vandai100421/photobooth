import Spinner from './Spinner';

const VARIANTS = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500',
  secondary:
    'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  ghost:
    'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-400',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  ...props
}) {
  const variantClass = VARIANTS[variant] ?? VARIANTS.primary;
  const sizeClass = SIZES[size] ?? SIZES.md;
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
