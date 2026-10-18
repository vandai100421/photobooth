// Âm thanh thông báo biến động số dư: tiếng "bíp" + đọc số tiền bằng TTS.
// Dùng Web Audio API (không cần file asset) và Web Speech API (giọng vi-VN).

let audioCtx = null;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  // Trình duyệt tạm dừng AudioContext cho tới khi có tương tác người dùng.
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

// "Mở khóa" audio — gọi trong một sự kiện click để trình duyệt cho phép phát.
export const unlockAudio = () => {
  getAudioContext();
};

// Phát 2 tiếng bíp ngắn (quãng lên) để thu hút chú ý.
export const playBeep = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [0, 0.18].forEach((offset, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = i === 0 ? 880 : 1320;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.16);
  });
};

// Đọc một câu tiếng Việt bằng TTS. Bỏ qua nếu trình duyệt không hỗ trợ.
export const speak = (text) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 1;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find((v) => v.lang && v.lang.startsWith('vi'));
    if (viVoice) utterance.voice = viVoice;
    window.speechSynthesis.speak(utterance);
  } catch (_err) {
    // TTS không khả dụng — bỏ qua, vẫn đã có tiếng bíp.
  }
};

// Định dạng số tiền VND đọc được (không đọc dấu phân cách gây rối).
export const formatAmountForSpeech = (amount) => {
  const n = Number(amount) || 0;
  return `${n.toLocaleString('vi-VN')} đồng`;
};

// Thông báo đầy đủ: bíp + đọc.
export const announce = (text) => {
  playBeep();
  speak(text);
};
