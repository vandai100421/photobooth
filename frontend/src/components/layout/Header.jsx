import Button from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';
import Badge from '../ui/Badge';

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
          aria-label="Toggle menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-800 md:text-lg">
          THE TAP
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-sm text-gray-700">{user.full_name}</span>
            <Badge variant="info">{user.role}</Badge>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Đăng xuất
        </Button>
      </div>
    </header>
  );
}
