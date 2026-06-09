/**
 * script.js · Chá Revelação — Thalyson & Jessica
 * Fairy lights, RSVP form, palpite counter, progress bars, PIX modal
 */

/* ════════════════════════════════════════
   1. FAIRY LIGHTS (Canvas)
════════════════════════════════════════ */
(function initFairyLights() {
  const canvas = document.getElementById('fairylights');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const particles = [];
  const COUNT = 55;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Gera pontos de luz distribuídos em todo o canvas
  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x:      Math.random() * window.innerWidth,
      y:      Math.random() * window.innerHeight,
      r:      Math.random() * 2.4 + 0.8,
      alpha:  Math.random(),
      speed:  Math.random() * 0.008 + 0.003,
      phase:  Math.random() * Math.PI * 2,
      hue:    Math.random() > 0.5 ? 45 : 38, // dourado quente
      sat:    Math.round(70 + Math.random() * 20),
    });
  }

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;
    particles.forEach(p => {
      p.phase += p.speed;
      const a = (Math.sin(p.phase) + 1) / 2;         // 0 → 1 → 0
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      glow.addColorStop(0, `hsla(${p.hue},${p.sat}%,78%,${a * 0.85})`);
      glow.addColorStop(1, `hsla(${p.hue},${p.sat}%,78%,0)`);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
      // centro sólido
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue},${p.sat}%,92%,${a})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();


/* ════════════════════════════════════════
   2. INTERSECTION OBSERVER (fade-in seções)
════════════════════════════════════════ */
(function initScrollReveal() {
  const sections = document.querySelectorAll('.fade-in-section');
  if (!sections.length) return;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  sections.forEach(s => observer.observe(s));
})();


/* ════════════════════════════════════════
   3. BARRA DE PROGRESSO (animação lazy)
════════════════════════════════════════ */
(function initProgressBars() {
  /**
   * Em produção, estes valores viriam de uma chamada fetch() à API/backend.
   * Aqui simulamos os dados que o banco retornaria.
   */
  const metasMock = {
    fraldas: { valor_arrecadado: 450,  valor_meta: 1200 },
    higiene: { valor_arrecadado: 180,  valor_meta: 400  },
    ninho:   { valor_arrecadado: 120,  valor_meta: 300  },
  };

  /**
   * Função que seria chamada com dados reais:
   * async function fetchMetas() {
   *   const res = await fetch('/api/metas');
   *   return await res.json();
   * }
   */

  function renderProgressBars(metas) {
    document.querySelectorAll('.goal-card').forEach(card => {
      const metaId = card.getAttribute('data-meta-id');
      const meta   = metas[metaId];
      if (!meta) return;

      const fill     = card.querySelector('.goal-progress-fill');
      const percent  = Math.min((meta.valor_arrecadado / meta.valor_meta) * 100, 100).toFixed(1);
      const bar      = card.querySelector('.goal-progress-bar');

      // Atualiza aria
      bar.setAttribute('aria-valuenow', meta.valor_arrecadado);
      bar.setAttribute('aria-valuemax', meta.valor_meta);

      // Anima via setTimeout para o CSS transition funcionar após render
      setTimeout(() => {
        fill.style.width = percent + '%';
      }, 200);

      // Atualiza texto de valor arrecadado
      const raisedEl = card.querySelector('.goal-raised');
      if (raisedEl) {
        raisedEl.textContent = 'R$ ' + meta.valor_arrecadado.toLocaleString('pt-BR');
      }
    });
  }

  // Observa as barras de progresso para animar só quando visíveis
  const goalsSection = document.getElementById('goalsGrid');
  if (!goalsSection) return;

  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      renderProgressBars(metasMock);
      obs.disconnect();
    }
  }, { threshold: 0.2 });

  obs.observe(goalsSection);
})();


/* ════════════════════════════════════════
   4. CONTAGEM DE PALPITES (mock local)
════════════════════════════════════════ */
// Em produção, buscar do backend via fetch('/api/palpites/contagem')
let palpitesCount = { menino: 12, menina: 9 };

function updatePalpiteCounters() {
  const elMenino = document.getElementById('countMenino');
  const elMenina = document.getElementById('countMenina');
  if (elMenino) elMenino.textContent = palpitesCount.menino + (palpitesCount.menino === 1 ? ' voto' : ' votos');
  if (elMenina) elMenina.textContent = palpitesCount.menina + (palpitesCount.menina === 1 ? ' voto' : ' votos');
}
updatePalpiteCounters();


/* ════════════════════════════════════════
   5. FORMULÁRIO RSVP
════════════════════════════════════════ */
(function initRSVP() {
  const form           = document.getElementById('rsvpForm');
  if (!form) return;

  const nomeInput      = document.getElementById('nomeConvidado');
  const presencaInput  = document.getElementById('presencaInput');
  const palpiteInput   = document.getElementById('palpiteInput');
  const btnEnviar      = document.getElementById('btnEnviar');
  const btnTexto       = document.getElementById('btnTexto');
  const btnLoader      = document.getElementById('btnLoader');
  const formSuccess    = document.getElementById('formSuccess');

  let presencaSelecionada = '';
  let palpiteSelecionado  = '';

  // ── Botões de presença ──
  document.querySelectorAll('.btn-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-choice').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      presencaSelecionada = btn.dataset.value;
      presencaInput.value = presencaSelecionada;
      clearError('erroPresenca');
    });
  });

  // ── Botões de palpite ──
  document.querySelectorAll('.btn-palpite').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-palpite').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      palpiteSelecionado = btn.dataset.value;
      palpiteInput.value = palpiteSelecionado;
      clearError('erroPalpite');
    });
  });

  // ── Validação ──
  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  }
  function clearError(id) {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  }

  function validate() {
    let ok = true;
    if (!nomeInput.value.trim()) {
      showError('erroNome', '⚠️ Por favor, informe seu nome.');
      nomeInput.focus();
      ok = false;
    } else {
      clearError('erroNome');
    }
    if (!presencaSelecionada) {
      showError('erroPresenca', '⚠️ Selecione se você irá ou não.');
      ok = false;
    } else {
      clearError('erroPresenca');
    }
    if (!palpiteSelecionado) {
      showError('erroPalpite', '⚠️ Escolha seu palpite!');
      ok = false;
    } else {
      clearError('erroPalpite');
    }
    return ok;
  }

  // ── Envio ──
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      nome_convidado: nomeInput.value.trim(),
      presenca:       presencaSelecionada === 'sim',
      palpite:        palpiteSelecionado,
    };

    // Estado de loading
    btnTexto.style.display = 'none';
    btnLoader.style.display = 'inline';
    btnEnviar.disabled = true;

    try {
      /**
       * ── ENVIO REAL PARA O BACKEND ──
       * Substitua a URL abaixo pelo endpoint real da sua API.
       * O backend deve receber o JSON e inserir na tabela `confirmacoes`.
       *
       * const response = await fetch('/api/confirmacoes', {
       *   method: 'POST',
       *   headers: { 'Content-Type': 'application/json' },
       *   body: JSON.stringify(payload),
       * });
       * if (!response.ok) throw new Error('Erro no servidor');
       * const data = await response.json();
       */

      // ── MOCK: simula delay de rede ──
      await new Promise(resolve => setTimeout(resolve, 1400));
      console.log('[RSVP] Enviado (mock):', payload);

      // Atualiza contagem local de palpites
      if (palpiteSelecionado === 'menino') palpitesCount.menino++;
      if (palpiteSelecionado === 'menina') palpitesCount.menina++;
      updatePalpiteCounters();

      // Exibe sucesso
      form.style.display = 'none';
      formSuccess.style.display = 'block';
      formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } catch (err) {
      console.error('[RSVP] Erro:', err);
      btnTexto.style.display = 'inline';
      btnLoader.style.display = 'none';
      btnEnviar.disabled = false;
      showError('erroNome', '❌ Algo deu errado. Tente novamente.');
    }
  });
})();


/* ════════════════════════════════════════
   6. MODAL PIX
════════════════════════════════════════ */
(function initPixModal() {
  const modal       = document.getElementById('pixModal');
  const closeBtn    = document.getElementById('modalClose');
  const metaNameEl  = document.getElementById('modalMetaName');
  const copyBtn     = document.getElementById('btnCopyPix');
  const copyFeedback = document.getElementById('copyFeedback');

  // Chave PIX real — substitua pelo valor real
  const PIX_CHAVE   = 'jessica@email.com';
  const PIX_TITULAR = 'Jessica Souza';

  function openModal(titulo) {
    if (!modal) return;
    if (metaNameEl) metaNameEl.textContent = 'Para: ' + titulo;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    closeBtn?.focus();
    if (copyFeedback) copyFeedback.style.display = 'none';
  }

  function closeModal() {
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  // Botões PIX em todos os cards
  document.querySelectorAll('.btn-pix').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.titulo || 'Contribuição'));
  });

  // Fechar
  closeBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // Copiar chave PIX
  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(PIX_CHAVE);
    } catch {
      // Fallback para navegadores mais antigos
      const ta = document.createElement('textarea');
      ta.value = PIX_CHAVE;
      ta.style.position = 'fixed';
      ta.style.opacity  = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    if (copyFeedback) {
      copyFeedback.style.display = 'block';
      copyBtn.textContent = '✅ Copiado!';
      setTimeout(() => {
        copyFeedback.style.display = 'none';
        copyBtn.innerHTML = '📋 &nbsp;Copiar Chave';
      }, 2800);
    }
  });
})();


/* ════════════════════════════════════════
   7. SMOOTH NAV (âncoras internas)
════════════════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
