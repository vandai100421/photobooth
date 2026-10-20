import Modal from '../ui/Modal';
import BoothAccountPanel from './BoothAccountPanel';

export default function BoothAccountModal({ open, onClose, onSaved }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tài khoản API Photobooth / Selfbooth"
      size="lg"
    >
      <BoothAccountPanel onSaved={onSaved} />
    </Modal>
  );
}
