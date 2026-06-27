/**
 * script.js · Chá Revelação — Thalyson & Jessica
 * Fairy lights, RSVP form, Firebase integration, local PIX generator, Mercado Pago links
 */

// ── CONFIGURAÇÕES DO FIREBASE ──
const firebaseConfig = {
  apiKey: "AIzaSyA5ukmBNl9oNlvL4HscSqLmJUCC9oJpTRM",
  authDomain: "cha-revelacao-ot0.firebaseapp.com",
  projectId: "cha-revelacao-ot0",
  storageBucket: "cha-revelacao-ot0.firebasestorage.app",
  messagingSenderId: "687528032807",
  appId: "1:687528032807:web:35dc4bf41ce7989d6bec02",
  measurementId: "G-X6V9SZ67QR"
};

// ── CONFIGURAÇÕES DO RECEBIMENTO PIX / MERCADO PAGO ──
const PIX_CONFIG = {
  chave: "jessica@email.com",   // Sua chave PIX (e-mail, CPF, celular ou chave aleatória)
  titular: "Jessica Souza",    // Nome completo do titular da conta bancária
  cidade: "Bananeiras",        // Cidade do titular da conta (sem acentos, máx 15 chars)
  
  // Links de Pagamento Mercado Pago (Opcionais)
  // Se configurados, a modal exibirá um botão redirecionando para pagar lá (útil para cartão/boleto)
  mercadoPagoMimosUrl: "",     // Ex: "https://mpago.la/..." (Link flexível / valor livre)
  
  // Mapeamento de Links de pagamento fixos para itens do Carrinho de Bebê
  mercadoPagoItens: {
    "Carrinho de Bebê": "",      // Ex: "https://mpago.la/carrinho"
    "Banheira com Suporte": "",
    "Cadeirão de Alimentação": "",
    "Kit de Mamadeiras": "",
    "Bolsa Maternidade": ""
  }
};

// Inicialização do Firebase Firestore com modo Fallback Seguro
let db = null;
let isFirebaseEnabled = false;

if (typeof firebase !== 'undefined' && firebaseConfig.apiKey && firebaseConfig.apiKey !== "SUA_API_KEY") {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    isFirebaseEnabled = true;
    console.log("[Firebase] Conectado e ativo com sucesso!");
  } catch (error) {
    console.error("[Firebase] Falha ao inicializar o Firebase. Rodando em modo de simulação.", error);
  }
} else {
  console.warn("[Firebase] Firebase SDK não importado ou chaves de API não configuradas. Executando em modo de simulação (Mock/LocalStorage).");
}

/* ════════════════════════════════════════
   1. FAIRY LIGHTS (Canvas)
   ════════════════════════════════════════ */
(function initFairyLights() {
  const canvas = document.getElementById('fairylights');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const particles = [];
  const COUNT = 35;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

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

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.phase += p.speed;
      const a = (Math.sin(p.phase) + 1) / 2;
      
      // Simple transparent outer glow for extremely low CPU usage
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue},${p.sat}%,78%,${a * 0.22})`;
      ctx.fill();
      
      // Center particle
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
   2. INTERSECTION OBSERVER (Fade-in seções)
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
    { threshold: 0.02 }
  );

  sections.forEach(s => observer.observe(s));
})();

/* ════════════════════════════════════════
   3. GERADOR DE PIX ESTÁTICO (EMV / BR Code)
   ════════════════════════════════════════ */
// Função de cálculo CRC16 para fechar a string do PIX
function crc16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

// Gera o código PIX Copia e Cola estático
function generatePixPayload(key, amount, description, name, city) {
  let pixKey = key.trim();
  
  // Remove acentos e caracteres especiais para validação EMV (ASCII puro)
  const cleanString = (str, limit) => {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .substring(0, limit)
      .trim();
  };

  let cleanName = cleanString(name || "Jessica Souza", 25);
  let cleanCity = cleanString(city || "Bananeiras", 15);
  let cleanDesc = cleanString(description || "ChadeBebe", 25);
  
  const tag = (num, val) => num + val.length.toString().padStart(2, '0') + val;

  // Merchant Account Information (Tag 26)
  let merchantInfo = tag("00", "br.gov.bcb.pix") + tag("01", pixKey);
  if (cleanDesc) {
    merchantInfo += tag("02", cleanDesc);
  }

  let payload = "";
  payload += tag("00", "01"); // Payload Format Indicator
  payload += tag("26", merchantInfo);
  payload += tag("52", "0000"); // Category Code
  payload += tag("53", "986");  // Moeda: BRL (986)
  
  if (amount && Number(amount) > 0) {
    let formattedAmount = Number(amount).toFixed(2);
    payload += tag("54", formattedAmount); // Valor da transação
  }
  
  payload += tag("58", "BR"); // Country
  payload += tag("59", cleanName);
  payload += tag("60", cleanCity);
  payload += tag("62", tag("05", "***")); // ID da Transação (Padrão genérico)
  
  payload += "6304"; // Tag CRC16 + tamanho (4 digitos)
  let crc = crc16(payload);
  return payload + crc;
}

/* ════════════════════════════════════════
   4. DADOS MOCK / LOCAL FALLBACKS
   ════════════════════════════════════════ */
const metasMock = {
  fraldas: { valor_arrecadado: 450,  valor_meta: 1200, titulo: "Estoque de Fraldas" },
  higiene: { valor_arrecadado: 180,  valor_meta: 400,  titulo: "Higiene do Bebê"  },
  ninho:   { valor_arrecadado: 120,  valor_meta: 300,  titulo: "Ninho e Conforto do Berço"  },
};

const metaThemes = {
  fraldas: { 
    icon: '🍼', 
    iconClass: 'goal-icon-peach', 
    badgeClass: '', 
    fillClass: 'goal-fill-peach', 
    emoji: '💛', 
    title: 'Estoque de Fraldas',
    desc: 'Cada fralda é um abraço de conforto para o bebê nos primeiros meses de vida.' 
  },
  higiene: { 
    icon: '🧴', 
    iconClass: 'goal-icon-blue', 
    badgeClass: 'goal-badge-blue', 
    fillClass: 'goal-fill-blue', 
    emoji: '💙', 
    title: 'Higiene do Bebê',
    desc: 'Lenços umedecidos, pomadas e creminhos para cuidar da pele mais delicada.' 
  },
  ninho: { 
    icon: '🛏️', 
    iconClass: 'goal-icon-sage', 
    badgeClass: 'goal-badge-sage', 
    fillClass: 'goal-fill-sage', 
    emoji: '🌿', 
    title: 'Ninho e Conforto do Berço',
    desc: 'Redutor, travesseiros e itens para um soninho tranquilo, quentinho e seguro.' 
  }
};

let palpitesCount = { menino: 12, menina: 9 };

function updatePalpiteCounters() {
  const elMenino = document.getElementById('countMenino');
  const elMenina = document.getElementById('countMenina');
  if (elMenino) elMenino.textContent = palpitesCount.menino + (palpitesCount.menino === 1 ? ' voto' : ' votos');
  if (elMenina) elMenina.textContent = palpitesCount.menina + (palpitesCount.menina === 1 ? ' voto' : ' votos');
}

function renderProgressBars(metas) {
  const grid = document.getElementById('goalsGrid');
  if (!grid) return;

  grid.innerHTML = '';

  for (const metaId in metas) {
    const meta = metas[metaId];
    const theme = metaThemes[metaId] || { 
      icon: '🎁', 
      iconClass: 'goal-icon-peach', 
      badgeClass: '', 
      fillClass: 'goal-fill-peach', 
      emoji: '💛', 
      title: 'Meta',
      desc: '' 
    };

    const valorMeta = meta.valor_meta !== undefined ? meta.valor_meta : meta.meta_valor;
    const arrecadado = Number(meta.valor_arrecadado);
    const percent = Math.min((arrecadado / valorMeta) * 100, 100);

    const card = document.createElement('div');
    card.className = 'goal-card';
    card.setAttribute('data-meta-id', metaId);

    card.innerHTML = `
      <div class="goal-card-header">
        <div class="goal-icon-wrap ${theme.iconClass}" aria-hidden="true">${theme.icon}</div>
        <div class="goal-badge ${theme.badgeClass}">${Math.round(percent)}%</div>
      </div>
      <h3 class="goal-title">${meta.titulo || theme.title}</h3>
      <p class="goal-desc">${theme.desc}</p>
      <div class="goal-progress-wrap">
        <div class="goal-progress-bar" role="progressbar" 
             aria-valuenow="${arrecadado}" aria-valuemin="0" aria-valuemax="${valorMeta}"
             aria-label="Progresso: R$${arrecadado} de R$${valorMeta}">
          <div class="goal-progress-fill ${theme.fillClass}" style="width: 0%" data-width="${percent}"></div>
        </div>
        <div class="goal-values">
          <span class="goal-raised">R$ ${arrecadado.toLocaleString('pt-BR')}</span>
          <span class="goal-target">de R$ ${Number(valorMeta).toLocaleString('pt-BR')}</span>
        </div>
      </div>
      <div class="goal-card-footer">
        <span class="goal-contributors">${theme.emoji} Seja o próximo a contribuir!</span>
        <button type="button" class="btn btn-pix" data-meta="${metaId}" data-titulo="${meta.titulo || theme.title}">
          💚 &nbsp;Contribuir via PIX
        </button>
      </div>
    `;

    grid.appendChild(card);
  }

  // Animação lazy das barras
  setTimeout(() => {
    grid.querySelectorAll('.goal-progress-fill').forEach(fill => {
      fill.style.width = fill.getAttribute('data-width') + '%';
    });
  }, 100);
}

/* ════════════════════════════════════════
   5. SINCRONIZAÇÃO E CARREGAMENTO (Firebase / LocalStorage)
   ════════════════════════════════════════ */
async function loadAndSyncData() {
  if (!isFirebaseEnabled) {
    // Modo Mock: sincroniza com LocalStorage
    const storedPalpites = localStorage.getItem("palpitesCount");
    if (storedPalpites) {
      palpitesCount = JSON.parse(storedPalpites);
    } else {
      localStorage.setItem("palpitesCount", JSON.stringify(palpitesCount));
    }
    updatePalpiteCounters();

    // Metas
    const storedMetas = localStorage.getItem("metasMock");
    let metas = metasMock;
    if (storedMetas) {
      metas = JSON.parse(storedMetas);
    } else {
      localStorage.setItem("metasMock", JSON.stringify(metasMock));
    }
    renderProgressBars(metas);

    return;
  }

  try {
    // 0. Carrega Configurações do PIX / Mercado Pago do Firestore
    const pixRef = db.collection("config").doc("pix");
    const docPix = await pixRef.get();
    if (docPix.exists) {
      const dbPix = docPix.data();
      if (dbPix.chave) PIX_CONFIG.chave = dbPix.chave;
      if (dbPix.titular) PIX_CONFIG.titular = dbPix.titular;
      if (dbPix.cidade) PIX_CONFIG.cidade = dbPix.cidade;
      if (dbPix.mercadoPagoMimosUrl !== undefined) PIX_CONFIG.mercadoPagoMimosUrl = dbPix.mercadoPagoMimosUrl;
      if (dbPix.mercadoPagoItens) {
        PIX_CONFIG.mercadoPagoItens = { ...PIX_CONFIG.mercadoPagoItens, ...dbPix.mercadoPagoItens };
      }
      console.log("[Firebase] Configurações de PIX/MP carregadas do Firestore.");
    } else {
      // Cria o documento com os defaults locais para servir de modelo no painel do Firebase
      await pixRef.set(PIX_CONFIG);
      console.log("[Firebase] Template de PIX_CONFIG criado no Firestore.");
    }

    // 1. Carrega Palpites do Firestore
    const palpitesRef = db.collection("config").doc("palpites");
    const docPalpites = await palpitesRef.get();
    if (docPalpites.exists) {
      palpitesCount = docPalpites.data();
    } else {
      // Cria o documento se não existir
      await palpitesRef.set({ menino: 0, menina: 0 });
      palpitesCount = { menino: 0, menina: 0 };
    }
    updatePalpiteCounters();

    // 2. Carrega Metas do Firestore
    const metasSnapshot = await db.collection("metas_pix").get();
    let metas = {};
    if (!metasSnapshot.empty) {
      metasSnapshot.forEach(doc => {
        metas[doc.id] = doc.data();
      });
      console.log("[Firebase] Metas (Mimos) carregadas com sucesso. IDs encontrados:", Object.keys(metas), metas);
    } else {
      // Popula dados iniciais no Firestore se estiver vazio
      for (const key in metasMock) {
        await db.collection("metas_pix").doc(key).set(metasMock[key]);
      }
      metas = metasMock;
      console.log("[Firebase] Metas vazias. Populadas com valores padrão:", Object.keys(metas));
    }
    renderProgressBars(metas);

  } catch (error) {
    console.error("[Firebase] Erro ao sincronizar dados. Usando fallbacks locais.", error);
    renderProgressBars(metasMock);
  }
}

// Inicializa o observer de visibilidade para carregar os dados reais
window.addEventListener('DOMContentLoaded', () => {
  const goalsSection = document.getElementById('goalsGrid');
  
  if (goalsSection) {
    // Carrega tudo no início para sincronia
    loadAndSyncData();
  }
});

/* ════════════════════════════════════════
   6. FORMULÁRIO RSVP
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

  document.querySelectorAll('.btn-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-choice').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      presencaSelecionada = btn.dataset.value;
      presencaInput.value = presencaSelecionada;
      clearError('erroPresenca');
    });
  });

  document.querySelectorAll('.btn-palpite').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-palpite').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      palpiteSelecionado = btn.dataset.value;
      palpiteInput.value = palpiteSelecionado;
      clearError('erroPalpite');
    });
  });

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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      nome_convidado: nomeInput.value.trim(),
      presenca:       presencaSelecionada === 'sim',
      palpite:        palpiteSelecionado,
    };

    btnTexto.style.display = 'none';
    btnLoader.style.display = 'inline';
    btnEnviar.disabled = true;

    try {
      if (isFirebaseEnabled) {
        // Grava no Firestore
        await db.collection("confirmacoes").add({
          ...payload,
          data_resposta: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Incrementa o contador de palpites no Firestore
        const counterRef = db.collection("config").doc("palpites");
        await counterRef.update({
          [payload.palpite]: firebase.firestore.FieldValue.increment(1)
        });

        // Atualiza contagem local relendo os palpites
        const updatedDoc = await counterRef.get();
        if (updatedDoc.exists) {
          palpitesCount = updatedDoc.data();
        }
      } else {
        // Fallback: Simulador local
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        palpitesCount[payload.palpite]++;
        localStorage.setItem("palpitesCount", JSON.stringify(palpitesCount));
      }

      updatePalpiteCounters();

      form.style.display = 'none';
      formSuccess.style.display = 'block';
      formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } catch (err) {
      console.error('[RSVP] Erro:', err);
      btnTexto.style.display = 'inline';
      btnLoader.style.display = 'none';
      btnEnviar.disabled = false;
      showError('erroNome', '❌ Algo deu errado ao enviar. Tente novamente.');
    }
  });
})();

/* ════════════════════════════════════════
   7. MODAL DE PAGAMENTO PIX E MERCADO PAGO
   ════════════════════════════════════════ */
(function initPixModal() {
  const modal             = document.getElementById('pixModal');
  const closeBtn          = document.getElementById('modalClose');
  const metaNameEl        = document.getElementById('modalMetaName');
  const modalTitleEl      = document.getElementById('modalTitle');
  const pixKeyEl          = document.getElementById('pixKey');
  const modalTitularEl    = document.getElementById('modalTitular');
  const qrLoadingEl       = document.getElementById('qrLoading');
  const qrCodeImgEl       = document.getElementById('qrCodeImg');
  const copiaColaSection  = document.getElementById('copiaColaSection');
  const copiaColaText     = document.getElementById('copiaColaText');
  
  // Elementos do valor customizado (Mimos)
  const amountSectionEl   = document.getElementById('modalAmountSection');
  const customAmountInput = document.getElementById('customAmountInput');
  const btnCopyPix        = document.getElementById('btnCopyPix');
  const btnCopyCopiaCola  = document.getElementById('btnCopyCopiaCola');
  const copyFeedback      = document.getElementById('copyFeedback');
  const btnMpRedirect     = document.getElementById('btnMpRedirect');

  let currentTitulo = "";
  let currentTipo = ""; // 'mimos' | 'carrinho'
  let currentValorFixo = 0;

  // Atualiza as chaves do PIX da configuração global
  if (pixKeyEl) pixKeyEl.textContent = PIX_CONFIG.chave;
  if (modalTitularEl) modalTitularEl.textContent = PIX_CONFIG.titular;

  function generateAndShowPayment(amount) {
    if (qrLoadingEl) qrLoadingEl.style.display = "flex";
    if (qrCodeImgEl) qrCodeImgEl.style.display = "none";
    if (copiaColaText) copiaColaText.value = "";
    
    // Titulo limpo para o PIX (sem acentos, máx 25 chars)
    const cleanDesc = (currentTitulo || "ChadeBebe")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .substring(0, 20);

    // Gera Payload PIX localmente
    const payload = generatePixPayload(
      PIX_CONFIG.chave,
      amount,
      cleanDesc,
      PIX_CONFIG.titular,
      PIX_CONFIG.cidade
    );

    if (copiaColaText) copiaColaText.value = payload;
    if (copiaColaSection) copiaColaSection.style.display = "flex";

    // URL do QR Code
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payload)}`;
    
    if (qrCodeImgEl) {
      const tempImg = new Image();
      tempImg.onload = () => {
        qrCodeImgEl.src = qrUrl;
        if (qrLoadingEl) qrLoadingEl.style.display = "none";
        qrCodeImgEl.style.display = "block";
      };
      tempImg.src = qrUrl;
    }

    // Configura Mercado Pago Redirect
    let mpUrl = PIX_CONFIG.mercadoPagoMimosUrl;

    if (btnMpRedirect) {
      if (mpUrl) {
        btnMpRedirect.href = mpUrl;
        btnMpRedirect.style.display = "inline-flex";
      } else {
        btnMpRedirect.style.display = "none";
      }
    }
  }

  function openModal(titulo, tipo, valorFixo) {
    if (!modal) return;
    currentTitulo = titulo;
    currentTipo = tipo;
    currentValorFixo = valorFixo;

    // Atualiza as chaves do PIX da modal de forma dinâmica com as configurações atualizadas
    if (pixKeyEl) pixKeyEl.textContent = PIX_CONFIG.chave;
    if (modalTitularEl) modalTitularEl.textContent = PIX_CONFIG.titular;

    if (metaNameEl) {
      metaNameEl.textContent = `Presentear: ${titulo}`;
    }

    if (tipo === 'mimos') {
      // Permite alterar o valor
      if (amountSectionEl) amountSectionEl.style.display = "flex";
      if (modalTitleEl) modalTitleEl.textContent = "Contribuir via PIX";
      
      const defaultAmount = customAmountInput ? Number(customAmountInput.value) : 50;
      generateAndShowPayment(defaultAmount);
    } else {
      // Valor fixo
      if (amountSectionEl) amountSectionEl.style.display = "none";
      if (modalTitleEl) modalTitleEl.textContent = `Presentear (R$ ${valorFixo})`;
      generateAndShowPayment(valorFixo);
    }

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

  // Monitora cliques para abrir modal
  document.addEventListener('click', e => {
    // 1. Cliques nos cards de "Mimos" (valor livre)
    const btnPix = e.target.closest('.btn-pix');
    if (btnPix) {
      openModal(btnPix.dataset.titulo || 'Mimos para o Bebê', 'mimos', 0);
      return;
    }
  });

  // Fechar Modal
  closeBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // Alteração dinâmica do valor no input
  if (customAmountInput) {
    customAmountInput.addEventListener('input', () => {
      let amount = Number(customAmountInput.value);
      if (amount <= 0) amount = 1;
      
      // Desmarca os botões rápidos se o valor digitado não coincidir
      document.querySelectorAll('.btn-quick-amount').forEach(btn => {
        if (Number(btn.dataset.amount) === amount) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      generateAndShowPayment(amount);
    });
  }

  // Cliques nos botões rápidos de valor
  document.querySelectorAll('.btn-quick-amount').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-quick-amount').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const amount = Number(btn.dataset.amount);
      if (customAmountInput) {
        customAmountInput.value = amount;
      }
      generateAndShowPayment(amount);
    });
  });

  // Funções de copiar
  async function copyText(text, targetBtn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity  = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    if (copyFeedback) {
      copyFeedback.style.display = 'block';
      const originalText = targetBtn.innerHTML;
      targetBtn.innerHTML = '✅ Copiado!';
      setTimeout(() => {
        copyFeedback.style.display = 'none';
        targetBtn.innerHTML = originalText;
      }, 2500);
    }
  }

  btnCopyPix?.addEventListener('click', () => {
    copyText(PIX_CONFIG.chave, btnCopyPix);
  });

  btnCopyCopiaCola?.addEventListener('click', () => {
    if (copiaColaText) {
      copyText(copiaColaText.value, btnCopyCopiaCola);
    }
  });

})();

/* ════════════════════════════════════════
   8. SMOOTH NAV (Âncoras internas)
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
