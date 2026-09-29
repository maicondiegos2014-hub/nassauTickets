// RF-24: anúncio em áudio de cada chamada, ex.: "Senha prioritária zero zero um, guichê três".
const DIGITS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];

const SPOKEN_TYPE = {
  SP: 'prioritária',
  SG: 'geral',
  SE: 'de retirada de exames',
};

export function spellDigits(value) {
  return String(value)
    .split('')
    .map((d) => DIGITS[Number(d)] ?? d)
    .join(' ');
}

/** Texto falado para uma chamada. `lastCall` = "Chamar novamente" (RF-15). */
export function announcementText({ type, seq, counterNumber, lastCall }) {
  const sequence = spellDigits(String(seq).padStart(3, '0'));
  const text = `Senha ${SPOKEN_TYPE[type] ?? ''} ${sequence}, guichê ${counterNumber}.`;
  return lastCall ? `Última chamada. ${text}` : text;
}

function pickVoice() {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  return voices.find((v) => v.lang === 'pt-BR') ?? voices.find((v) => v.lang?.startsWith('pt')) ?? null;
}

export function speechAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Toca um aviso sonoro curto (gerado, sem arquivo) antes do anúncio. */
export function chime(context) {
  if (!context) return;
  const start = context.currentTime;
  [880, 660].forEach((freq, i) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start + i * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.35, start + i * 0.35 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.35 + 0.32);
    osc.connect(gain).connect(context.destination);
    osc.start(start + i * 0.35);
    osc.stop(start + i * 0.35 + 0.34);
  });
}

export function speak(text, { rate = 0.92 } = {}) {
  if (!speechAvailable()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = rate;
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}
