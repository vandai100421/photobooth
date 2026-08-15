export default function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${sizes[size]} ${className}`}
      role="status"
      aria-label="loading"
    />
  );
}
