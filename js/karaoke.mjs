import { phrases, frequency, detectPitch, summarize } from './karaoke-score.mjs';

const beat = 0.8;
const dialog = document.createElement('dialog');
dialog.className = 'karaoke-dialog';
dialog.setAttribute('aria-labelledby', 'karaoke-title');
dialog.innerHTML = `
  <button type="button" data-close>Fermer</button>
  <h2 id="karaoke-title">Karaoké solo</h2>
  <p>Dans le soir clair · morceau original</p>
  <p>Utilisez un casque. Le micro sert à mesurer la justesse sur cet appareil. Votre voix n’est ni enregistrée ni envoyée.</p>
  <button type="button" data-sing>Autoriser le micro et chanter</button>
  <button type="button" data-listen>Écouter le morceau</button>
  <p data-status role="status"></p>
  <ol aria-label="Paroles">${phrases.map(({ words }) => `<li>${words}</li>`).join('')}</ol>
  <h3>Meilleurs scores de cette session</h3>
  <ol data-ranking></ol>
`;
document.body.append(dialog);

const sing = dialog.querySelector('[data-sing]');
const listen = dialog.querySelector('[data-listen]');
const status = dialog.querySelector('[data-status]');
const lyrics = [...dialog.querySelectorAll('li')];
const ranking = dialog.querySelector('[data-ranking]');
const notes = phrases.flatMap(phrase => phrase.notes);
const scores = [];
let attempt;

function stop() {
  if (!attempt) return;
  cancelAnimationFrame(attempt.frame);
  attempt.stream?.getTracks().forEach(track => track.stop());
  if (attempt.audio.state !== 'closed') void attempt.audio.close();
  attempt = null;
  lyrics.forEach(line => line.removeAttribute('aria-current'));
  sing.disabled = listen.disabled = false;
}

function playNote(audio, note, start, duration, volume, type) {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency(note);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

async function play(withMic) {
  if (attempt) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio || (withMic && !navigator.mediaDevices?.getUserMedia)) {
    status.textContent = 'Audio ou microphone indisponible. Ouvrez la page dans un navigateur compatible sur HTTPS ou localhost.';
    return;
  }

  let current;
  try {
    current = { audio: new Audio() };
    attempt = current;
    sing.disabled = listen.disabled = true;
    status.textContent = withMic ? 'En attente de votre autorisation…' : 'Préparation du morceau…';
    const { audio } = current;
    await audio.resume();
    if (attempt !== current) return;

    let analyser;
    if (withMic) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (attempt !== current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      current.stream = stream;
      analyser = audio.createAnalyser();
      analyser.fftSize = 2048;
      audio.createMediaStreamSource(stream).connect(analyser);
    }

    const start = audio.currentTime + 2 * beat;
    for (let i = 0; i < 2; i++) {
      playNote(audio, 81, start - (2 - i) * beat, 0.12, 0.07, 'sine');
    }
    notes.forEach((note, i) => {
      playNote(audio, note, start + i * beat, 0.72, 0.12, 'triangle');
      playNote(audio, note - 24, start + i * beat, 0.6, 0.08, 'sine');
    });

    const frames = [];
    const samples = new Float32Array(2048);
    const offsets = [0.25, 0.4, 0.55, 0.7];
    let lastSlot = -1;
    let lastLine = -1;
    status.textContent = 'Préparez-vous…';
    function tick() {
      const elapsed = audio.currentTime - start;
      const noteIndex = Math.floor(elapsed / beat);
      if (noteIndex >= notes.length) {
        stop();
        if (!withMic) {
          status.textContent = 'Écoute terminée.';
          return;
        }
        const { score, coverage } = summarize(frames, notes.length * offsets.length);
        const measured = `${Math.round(coverage * 100)} % de voix détectée`;
        status.textContent = score === null
          ? `Voix insuffisamment détectée pour calculer un score (${measured}).`
          : `Justesse ${score} / 100 · ${measured}`;
        if (score !== null) {
          scores.push(score);
          scores.sort((a, b) => b - a);
          scores.length = Math.min(scores.length, 5);
          ranking.replaceChildren(...scores.map(value => {
            const item = document.createElement('li');
            item.textContent = `${value} / 100`;
            return item;
          }));
        }
        return;
      }

      if (noteIndex >= 0) {
        const line = Math.floor(noteIndex / 4);
        if (line !== lastLine) {
          lyrics[lastLine]?.removeAttribute('aria-current');
          lyrics[line].setAttribute('aria-current', 'true');
          lastLine = line;
          status.textContent = withMic ? 'Chantez en suivant la mélodie.' : 'Écoute en cours.';
        }
        const slot = offsets.findIndex(offset => Math.abs(elapsed - noteIndex * beat - offset) < 0.045);
        const index = noteIndex * offsets.length + slot;
        if (analyser && slot >= 0 && index > lastSlot) {
          lastSlot = index;
          analyser.getFloatTimeDomainData(samples);
          const pitch = detectPitch(samples, audio.sampleRate);
          if (pitch) frames.push({ pitch, target: frequency(notes[noteIndex]) });
        }
      }
      current.frame = requestAnimationFrame(tick);
    }
    tick();
  } catch (error) {
    if (current && attempt !== current) return;
    stop();
    status.textContent = error.name === 'NotAllowedError'
      ? 'Microphone refusé. Vous pouvez écouter le morceau ou autoriser le micro dans le navigateur.'
      : 'Impossible de démarrer l’audio ou le microphone.';
  }
}

sing.onclick = () => void play(true);
listen.onclick = () => void play(false);
dialog.querySelector('[data-close]').onclick = () => { stop(); dialog.close(); };
dialog.addEventListener('cancel', stop);
dialog.addEventListener('keydown', event => {
  if (event.key === 'Escape') event.stopPropagation();
});
window.addEventListener('pagehide', stop);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && attempt) {
    stop();
    status.textContent = 'Partie interrompue. Vous pouvez recommencer.';
  }
});
window.OrevamiKaraoke = {
  open() {
    if (dialog.open) return;
    status.textContent = '';
    dialog.showModal();
  },
};
