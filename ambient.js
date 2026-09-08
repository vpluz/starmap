/*
 * Quiet, generative ambient music for the VPluz STAR MAP background.
 * Built entirely with the Web Audio API — no audio file to host or license.
 * A soft open chord (D add9) drifts under a slow-moving filter, with a
 * gentle feedback-delay wash standing in for reverb, and the occasional
 * far-off "twinkle" chime that echoes the stars on screen.
 *
 * Autoplay policies mean sound can only start after a user gesture, so
 * playback begins on the first tap/click/keypress anywhere on the page.
 * A small toggle in the corner lets people mute it at any time.
 */
(function () {
  let audioCtx = null;
  let masterGain = null;
  let started = false;
  let playing = false;
  let chimeTimer = null;

  // D2, A2, E3, G3, B3 — an open, ambiguous add9 voicing. Calm, not melodic.
  const CHORD = [73.42, 110.00, 164.81, 196.00, 246.94];
  // A small pentatonic-ish set for the occasional twinkle chime.
  const CHIME_NOTES = [293.66, 349.23, 392.00, 440.00, 523.25, 587.33];

  function buildPad() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioCtx();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.0001;
    masterGain.connect(audioCtx.destination);

    // --- Feedback-delay "wash", used in place of a convolution reverb ---
    const delay = audioCtx.createDelay(2.0);
    delay.delayTime.value = 0.62;

    const feedback = audioCtx.createGain();
    feedback.gain.value = 0.36;

    const washFilter = audioCtx.createBiquadFilter();
    washFilter.type = 'lowpass';
    washFilter.frequency.value = 1700;

    const washOut = audioCtx.createGain();
    washOut.gain.value = 0.55;

    delay.connect(feedback);
    feedback.connect(washFilter);
    washFilter.connect(delay);
    delay.connect(washOut);
    washOut.connect(masterGain);

    // --- Dry path with a slow-breathing lowpass filter ---
    const dry = audioCtx.createGain();
    dry.gain.value = 0.85;
    dry.connect(masterGain);
    dry.connect(delay);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1300;
    filter.Q.value = 0.35;
    filter.connect(dry);

    const filterLfo = audioCtx.createOscillator();
    filterLfo.frequency.value = 1 / 39;
    const filterLfoGain = audioCtx.createGain();
    filterLfoGain.gain.value = 380;
    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(filter.frequency);
    filterLfo.start();

    // --- The chord itself: each note slowly swells in and out on its own cycle ---
    CHORD.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;

      const gain = audioCtx.createGain();
      const swellTarget = 0.05 + Math.random() * 0.02;
      gain.gain.value = swellTarget * 0.5;

      const swellLfo = audioCtx.createOscillator();
      swellLfo.frequency.value = 0.025 + Math.random() * 0.02;
      const swellLfoGain = audioCtx.createGain();
      swellLfoGain.gain.value = swellTarget;
      swellLfo.connect(swellLfoGain);
      swellLfoGain.connect(gain.gain);

      osc.connect(gain);

      if (audioCtx.createStereoPanner) {
        const panner = audioCtx.createStereoPanner();
        panner.pan.value = (i / (CHORD.length - 1)) * 1.6 - 0.8;
        gain.connect(panner);
        panner.connect(filter);
      } else {
        gain.connect(filter);
      }

      osc.start();
      swellLfo.start();
    });

    scheduleChimes();
  }

  function scheduleChimes() {
    const runNext = () => {
      const wait = 8000 + Math.random() * 12000;
      chimeTimer = setTimeout(() => {
        if (playing) playChime();
        runNext();
      }, wait);
    };
    runNext();
  }

  function playChime() {
    if (!audioCtx) return;
    const freq = CHIME_NOTES[Math.floor(Math.random() * CHIME_NOTES.length)];
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);

    osc.connect(gain);

    if (audioCtx.createStereoPanner) {
      const panner = audioCtx.createStereoPanner();
      panner.pan.value = Math.random() * 1.6 - 0.8;
      gain.connect(panner);
      panner.connect(masterGain);
    } else {
      gain.connect(masterGain);
    }

    osc.start(now);
    osc.stop(now + 5);
  }

  function fadeMasterTo(value, duration) {
    if (!masterGain || !audioCtx) return;
    const now = audioCtx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(value, now + duration);
  }

  function ensureStarted() {
    if (started) {
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      return;
    }
    started = true;
    try {
      buildPad();
      playing = true;
      fadeMasterTo(0.13, 3.5);
    } catch (e) {
      // Web Audio unavailable in this browser — fail silently, no music.
      started = false;
    }
    updateButton();
  }

  function toggle() {
    if (!started) {
      ensureStarted();
      return;
    }
    playing = !playing;
    fadeMasterTo(playing ? 0.13 : 0.0001, 1.1);
    updateButton();
  }

  let button = null;

  function createButton() {
    button = document.createElement('button');
    button.id = 'musicToggle';
    button.type = 'button';
    button.setAttribute('aria-label', 'เปิด/ปิดเสียงเพลงประกอบ');
    button.innerHTML = '<span class="music-icon">♪</span>';
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });
    document.body.appendChild(button);
    updateButton();
  }

  function updateButton() {
    if (!button) return;
    button.classList.toggle('is-playing', started && playing);
    button.classList.toggle('is-muted', started && !playing);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createButton);
  } else {
    createButton();
  }

  // Start on the first user gesture anywhere on the page (covers the
  // "BEGIN THE JOURNEY" tap as well as any other first interaction).
  const gestureEvents = ['pointerdown', 'keydown'];
  function onFirstGesture() {
    ensureStarted();
    gestureEvents.forEach((evt) => document.removeEventListener(evt, onFirstGesture));
  }
  gestureEvents.forEach((evt) => document.addEventListener(evt, onFirstGesture, { once: true }));
})();
