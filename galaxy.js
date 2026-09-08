/*
 * Minimal animated galaxy backdrop.
 * A quiet field of stars that drift and twinkle very slowly behind
 * the drifting nebula-blob gradients defined in style.css.
 * No external assets, no heavy libraries — just canvas + requestAnimationFrame.
 */
(function () {
  const canvas = document.getElementById('starsCanvas');
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let stars = [];
  let rafId = null;
  let t = 0;

  const BASE_COUNT_AT_1440x900 = 150;

  function makeStar() {
    const layer = Math.random();
    let size, speed, baseAlpha;

    if (layer < 0.6) {
      // distant, faint, near-still
      size = Math.random() * 1.0 + 0.4;
      speed = 0.0035;
      baseAlpha = Math.random() * 0.30 + 0.20;
    } else if (layer < 0.9) {
      // mid layer
      size = Math.random() * 1.3 + 0.8;
      speed = 0.009;
      baseAlpha = Math.random() * 0.30 + 0.38;
    } else {
      // foreground, brighter, faint glow
      size = Math.random() * 1.6 + 1.2;
      speed = 0.016;
      baseAlpha = Math.random() * 0.25 + 0.55;
    }

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      size,
      speed,
      baseAlpha,
      driftAngle: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() * 0.012 + 0.004,
      twinklePhase: Math.random() * Math.PI * 2
    };
  }

  function initStars() {
    const area = width * height;
    const count = Math.round(BASE_COUNT_AT_1440x900 * (area / (1440 * 900)));
    const clamped = Math.max(70, Math.min(260, count));
    stars = Array.from({ length: clamped }, makeStar);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initStars();
  }

  function drawFrame() {
    ctx.clearRect(0, 0, width, height);

    for (const s of stars) {
      if (!reduceMotion) {
        s.x += Math.cos(s.driftAngle) * s.speed;
        s.y += Math.sin(s.driftAngle) * s.speed * 0.6 - s.speed * 0.25;

        if (s.x < -4) s.x = width + 4;
        if (s.x > width + 4) s.x = -4;
        if (s.y < -4) s.y = height + 4;
        if (s.y > height + 4) s.y = -4;
      }

      const twinkle = reduceMotion
        ? 0.85
        : Math.sin(t * s.twinkleSpeed + s.twinklePhase) * 0.5 + 0.5;
      const alpha = s.baseAlpha * (0.55 + twinkle * 0.45);

      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();

      if (s.size > 1.5) {
        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 4);
        glow.addColorStop(0, 'rgba(190,202,255,' + (alpha * 0.45).toFixed(3) + ')');
        glow.addColorStop(1, 'rgba(190,202,255,0)');
        ctx.beginPath();
        ctx.fillStyle = glow;
        ctx.arc(s.x, s.y, s.size * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function tick() {
    t += 1;
    drawFrame();
    rafId = requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  resize();

  if (reduceMotion) {
    drawFrame();
  } else {
    rafId = requestAnimationFrame(tick);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!reduceMotion && !rafId) {
      rafId = requestAnimationFrame(tick);
    }
  });
})();
