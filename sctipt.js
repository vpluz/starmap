const app = document.getElementById('app');

const state = {
  index: 0,
  answers: [],
  orders: [],
  scores: {},
  result: null,
  locked: false
};

const DISCORD_URL = 'https://discord.gg/REPLACE_ME';
const QR_PATH = 'assets/discord-qr.png';

function resetScores() {
  state.scores = Object.fromEntries(Object.keys(STAR_TYPES).map(k => [k, 0]));
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function prepareQuestionOrders() {
  // Shuffle once per quiz, then keep that order when going back.
  // This prevents an answer associated with a type from always appearing
  // in the same position while keeping navigation predictable.
  state.orders = QUESTIONS.map(q => shuffle(q.answers.map((_, i) => i)));
}

function recomputeScores() {
  resetScores();

  state.answers.forEach((answerIndex, questionIndex) => {
    if (answerIndex === undefined || answerIndex === null) return;
    const answer = QUESTIONS[questionIndex]?.answers[answerIndex];
    if (!answer) return;

    for (const [star, pts] of Object.entries(answer[1])) {
      if (state.scores[star] !== undefined) state.scores[star] += pts;
    }
  });
}

function starsMarkup(count) {
  return '✦'.repeat(count) + '☆'.repeat(5 - count);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

function renderLanding() {
  app.innerHTML = `
    <section class="screen landing fade-in">
      <div class="brand">VPLUZ <span>STAR MAP</span></div>

      <div class="hero-orb" aria-hidden="true">
        <div class="orb-ring r1"></div>
        <div class="orb-ring r2"></div>
        <div class="orb-core">✦</div>
      </div>

      <p class="eyebrow">A VPLUZ COMMUNITY EXPERIENCE</p>
      <h1>Find the light<br><em>that belongs to you.</em></h1>
      <p class="lead">ทุกคนมีแสงเป็นของตัวเอง<br>แล้วแสงของคุณเป็นแบบไหน?</p>

      <button class="primary" id="startBtn">
        BEGIN THE JOURNEY <span>→</span>
      </button>

      <p class="micro">24 questions · 12 stars · no right or wrong answers</p>
    </section>
  `;

  document.getElementById('startBtn').onclick = startQuiz;
}

function startQuiz() {
  state.index = 0;
  state.answers = [];
  state.result = null;
  state.locked = false;
  prepareQuestionOrders();
  recomputeScores();
  renderQuestion();
}

function renderQuestion() {
  const q = QUESTIONS[state.index];
  const order = state.orders[state.index] || q.answers.map((_, i) => i);
  const selected = state.answers[state.index];
  const progress = ((state.index) / QUESTIONS.length) * 100;

  const answersMarkup = order.map((originalIndex, displayIndex) => {
    const answer = q.answers[originalIndex];
    const isSelected = selected === originalIndex;

    return `
      <button
        class="answer ${isSelected ? 'selected' : ''}"
        data-original="${originalIndex}"
        aria-pressed="${isSelected}"
        ${state.locked ? 'disabled' : ''}
      >
        <span class="answer-letter">${String.fromCharCode(65 + displayIndex)}</span>
        <span class="answer-text">${escapeHtml(answer[0])}</span>
        <span class="arrow">→</span>
      </button>
    `;
  }).join('');

  app.innerHTML = `
    <section class="screen quiz fade-in">
      <header class="quiz-head">
        <button class="ghost brand-button" id="quitBtn">VPLUZ <span>STAR MAP</span></button>

        <div class="question-count">
          ${String(state.index + 1).padStart(2, '0')}
          <span>/</span>
          ${String(QUESTIONS.length).padStart(2, '0')}
        </div>
      </header>

      <div class="progress" aria-hidden="true">
        <i style="width:${progress}%"></i>
      </div>

      <div class="question-wrap">
        <p class="eyebrow">QUESTION ${String(state.index + 1).padStart(2, '0')}</p>
        <h2>${escapeHtml(q.text)}</h2>

        <div class="answers ${state.locked ? 'is-locked' : ''}">${answersMarkup}</div>

        <div class="quiz-nav">
          <button class="back-btn" id="backBtn" ${state.index === 0 || state.locked ? 'disabled' : ''}>
            <span>←</span> ย้อนกลับ
          </button>

          <span class="advance-hint">แตะคำตอบเพื่อไปข้อถัดไป</span>
        </div>
      </div>
    </section>
  `;

  document.getElementById('quitBtn').onclick = () => {
    if (state.answers.length && !confirm('ออกจากแบบทดสอบและเริ่มใหม่หรือไม่?')) return;
    renderLanding();
  };

  document.getElementById('backBtn').onclick = goBack;

  document.querySelectorAll('.answer').forEach(btn => {
    btn.onclick = () => selectAnswer(Number(btn.dataset.original));
  });
}

function selectAnswer(originalIndex) {
  if (state.locked) return;

  state.answers[state.index] = originalIndex;
  recomputeScores();
  state.locked = true;
  renderQuestion();

  // Brief pause so the selection glow is visible before moving on.
  setTimeout(() => {
    state.locked = false;
    advance();
  }, 480);
}

function goBack() {
  if (state.index <= 0 || state.locked) return;
  state.index--;
  renderQuestion();
}

function advance() {
  if (state.index >= QUESTIONS.length - 1) {
    finishQuiz();
  } else {
    state.index++;
    renderQuestion();
  }
}

function finishQuiz() {
  recomputeScores();

  const ranked = Object.entries(state.scores).sort((a, b) => b[1] - a[1]);
  const top = ranked[0][1];
  const tied = ranked.filter(x => x[1] === top);

  let winner = tied[0][0];

  if (tied.length > 1) {
    const recentStart = Math.max(0, QUESTIONS.length - 8);
    const recentCounts = {};

    for (let qi = recentStart; qi < QUESTIONS.length; qi++) {
      const answerIndex = state.answers[qi];
      if (answerIndex === undefined) continue;

      const answer = QUESTIONS[qi].answers[answerIndex];
      Object.entries(answer[1]).forEach(([star, pts]) => {
        recentCounts[star] = (recentCounts[star] || 0) + pts;
      });
    }

    winner = [...tied].sort(
      (a, b) => (recentCounts[b[0]] || 0) - (recentCounts[a[0]] || 0)
    )[0][0];
  }

  state.result = winner;
  renderReveal();
}

function renderReveal() {
  const s = STAR_TYPES[state.result];

  app.innerHTML = `
    <section class="screen reveal fade-in">
      <div class="reveal-stars" aria-hidden="true">✦ · ✧　·　✦　·　✧</div>
      <p class="eyebrow">YOUR STAR HAS BEEN FOUND</p>

      <div
        class="reveal-symbol"
        style="--c1:${s.colors[0]};--c2:${s.colors[1]}"
      >${s.icon}</div>

      <p class="reveal-name">${escapeHtml(s.name)}</p>
      <div class="reveal-line"></div>
      <p class="micro">Mapping your light...</p>
    </section>
  `;

  setTimeout(renderResult, 1600);
}

function renderResult() {
  const s = STAR_TYPES[state.result];

  const bars = s.core.map((x, i) => {
    const score = Math.min(
      96,
      Math.max(
        38,
        68 +
        (state.scores[state.result] / Math.max(1, QUESTIONS.length)) * 20 -
        i * 7
      )
    );

    return `
      <div class="core-row">
        <span>${escapeHtml(x)}</span>
        <b><i style="width:${score}%"></i></b>
      </div>
    `;
  }).join('');

  app.innerHTML = `
    <section
      class="screen result fade-in"
      style="--c1:${s.colors[0]};--c2:${s.colors[1]}"
    >
      <header class="result-head">
        <div class="brand">VPLUZ <span>STAR MAP</span></div>
        <button class="ghost" id="restart">RETAKE</button>
      </header>

      <div class="result-grid">
        <div class="star-art" aria-hidden="true">
          <div class="big-orbit"></div>
          <div class="star-glow">${s.icon}</div>
          <div class="constellation-dots">·　✦　·　✧　·</div>
        </div>

        <div class="result-copy">
          <p class="eyebrow">YOUR STAR</p>
          <h1>${escapeHtml(s.name)}</h1>
          <h3>${escapeHtml(s.thai)}</h3>

          <blockquote>“${escapeHtml(s.quote)}”</blockquote>
          <p class="description">${escapeHtml(s.description)}</p>

          <div class="rarity">
            <span>${starsMarkup(s.rarityStars)}</span>
            <strong>${escapeHtml(s.rarity)}</strong>
            <small>A designed rarity — not a ranking of value.</small>
          </div>

          <div class="core">${bars}</div>

          <div class="result-actions">
            <button class="primary" id="shareBtn">✦ SHARE YOUR STAR</button>
            <button class="secondary" id="communityBtn">JOIN VPLUZ COMMUNITY</button>
          </div>
        </div>
      </div>

      <div class="result-lower">
        <article>
          <p class="eyebrow">YOUR STRENGTHS</p>
          <div class="chips">
            ${s.strengths.map(x => `<span>${escapeHtml(x)}</span>`).join('')}
          </div>
        </article>

        <article>
          <p class="eyebrow">WATCH YOUR ORBIT</p>
          <div class="chips muted">
            ${s.caution.map(x => `<span>${escapeHtml(x)}</span>`).join('')}
          </div>
        </article>

        <article>
          <p class="eyebrow">COSMIC CONNECTIONS</p>
          <div class="matches">
            ${s.compatible.map(id => {
              const x = STAR_TYPES[id];
              return `
                <div class="match">
                  <span>${x.icon}</span>
                  <div>
                    <strong>${escapeHtml(x.name)}</strong>
                    <small>${escapeHtml(x.thai)}</small>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </article>
      </div>
    </section>
  `;

  document.getElementById('restart').onclick = startQuiz;
  document.getElementById('shareBtn').onclick = shareResult;
  document.getElementById('communityBtn').onclick = () => showCommunity();
}

async function shareResult() {
  const s = STAR_TYPES[state.result];
  const text =
`✦ I discovered my star: ${s.name}
${s.thai}

${s.quote}

VPluz STAR MAP — Find the light that belongs to you.`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'VPluz STAR MAP',
        text
      });
      return;
    } catch (e) {}
  }

  try {
    await navigator.clipboard.writeText(text);
    alert('คัดลอกผลลัพธ์แล้ว');
  } catch (e) {
    alert(text);
  }
}

function showCommunity() {
  const existing = document.querySelector('.modal');
  if (existing) existing.remove();

  const s = STAR_TYPES[state.result];
  const safeUrl = DISCORD_URL.includes('REPLACE_ME') ? '#' : DISCORD_URL;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal" role="dialog" aria-modal="true" aria-label="VPluz Community">
      <div class="modal-backdrop"></div>

      <div class="modal-card">
        <button class="modal-close" id="closeModal" aria-label="ปิด">×</button>

        <div class="modal-star">${s.icon}</div>
        <p class="eyebrow">YOUR JOURNEY DOESN'T END HERE</p>
        <h2>Meet the other stars.</h2>

        <p>
          มาพบกับเหล่าดวงดาวดวงอื่นใน<br>
          <strong>VPluz Community</strong>
        </p>

        <img
          class="qr"
          src="${QR_PATH}"
          alt="VPluz Community Discord QR Code"
          onerror="this.style.display='none';this.nextElementSibling.style.display='block';"
        >

        <div class="qr-fallback">
          ใส่ QR Code Discord ของ VPluz ที่<br>
          <code>assets/discord-qr.png</code>
        </div>

        <a
          class="primary link-btn"
          href="${safeUrl}"
          target="_blank"
          rel="noopener"
        >JOIN VPLUZ COMMUNITY ↗</a>

        <button class="later" id="closeLater">Maybe later</button>
      </div>
    </div>
  `);

  document.getElementById('closeModal').onclick = closeModal;
  document.getElementById('closeLater').onclick = closeModal;
  document.querySelector('.modal-backdrop').onclick = closeModal;
}

function closeModal() {
  document.querySelector('.modal')?.remove();
}

renderLanding();
