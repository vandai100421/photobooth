import { Link } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';

// Nhãn link tới trang Cài đặt — dùng trong các banner lỗi liên quan token,
// tài khoản API, Zalo/Gmail để người dùng tự sửa tại một nơi.
export default function SettingsGuide({ message }) {
  return (
    <>
      {message}{' '}
      <Link
        to={ROUTES.SETTINGS}
        className="font-semibold underline hover:opacity-80"
      >
        Mở trang Cài đặt
      </Link>
    </>
  );
}
