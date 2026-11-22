/* ============================================================
   J&T PEOPLE ANALYTICS — PORTAL DE TALENTOS
   - Cadastro público (candidato) → Firebase + espelho na planilha
   - Área de gestão (senha institucional) → busca, triagem, match, carreira
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- CONFIG ---------------- */
  var FB = {
    apiKey: 'AIzaSyAlmwzlPZAW4sU2gfBnJ0lWsp_u4brtHQ4',
    authDomain: 'superb-firefly-515408-i3.firebaseapp.com',
    databaseURL: 'https://superb-firefly-515408-i3-default-rtdb.firebaseio.com',
    projectId: 'superb-firefly-515408-i3',
    appId: '1:823561383768:web:6400e5b250287c2e287f2d'
  };
  var USER = 'salvadosjetmrb@gmail.com';
  var PASS = 'jetexpress10';
  var GATE_PASS = 'jetexpress10';
  var PATH_CAD = 'talentos/cadastros/v1';
  var PATH_INT = 'talentos/internos/v1';
  var PATH_CFG = 'talentos/config/v1';
  var PATH_PDI = 'talentos/pdi/v1';
  var CACHE_KEY = 'jt_portal_cache_v1';
  var CFG_KEY = 'jt_portal_cfg_v1';
  var QUEUE_KEY = 'jt_portal_fila_v1';
  var ADMIN_KEY = 'jt_portal_admin';
  var FOTOS_KEY = 'jt_portal_fotos_v1';
  var DEFAULT_BACKEND = 'https://script.google.com/macros/s/AKfycbwXdpCBShUsGv0jFIt7rW4v4UDtKlPxto-myPpDxRUzT4hmMQ6_7yYkuIwptWfeYweU/exec';

  var DEFAULT_VAGAS = [
    { id: 'V-001', titulo: 'Líder de Turno', unidade: 'SC-MRB', cargo: 'Líder de Turno', urgencia: 'Alta',
      requisitos: ['Liderança', 'Indicadores', 'Hub de distribuição'], desejaveis: ['D+1', 'Gestão de equipe'] },
    { id: 'V-002', titulo: 'Supervisor Operacional', unidade: 'MRB', cargo: 'Supervisor Operacional', urgencia: 'Alta',
      requisitos: ['Liderança', 'SLA', 'Gestão de equipe'], desejaveis: ['Expedição', 'Indicadores'] },
    { id: 'V-003', titulo: 'Analista de Logística', unidade: 'SC-MRB', cargo: 'Analista de Logística', urgencia: 'Média',
      requisitos: ['Excel avançado', 'KPIs', 'Superior em Logística'], desejaveis: ['Entrega', 'Indicadores'] },
    { id: 'V-004', titulo: 'Motorista Carreteiro', unidade: 'SC-MRB', cargo: 'Motorista Carreteiro', urgencia: 'Média',
      requisitos: ['CNH E', 'MOPP', 'Viagens intermunicipais'], desejaveis: ['Disponibilidade imediata', 'Rota regional'] },
    { id: 'V-005', titulo: 'Conferente', unidade: 'MRB', cargo: 'Conferente', urgencia: 'Baixa',
      requisitos: ['Conferência de NF', 'Auditoria de pesagem'], desejaveis: ['Leitor óptico', 'Bipagem'] }
  ];

  var STATUS = ['Pendente', 'Em Triagem', 'Entrevista', 'Aprovado', 'Banco de Talentos', 'Contratado', 'Não selecionado', 'Colaborador ativo', 'Desligado'];
  var ETAPAS = [
    { nome: 'Pendente', cls: 'entrada' }, { nome: 'Em Triagem', cls: 'triagem' },
    { nome: 'Entrevista', cls: 'entrevista' }, { nome: 'Aprovado', cls: 'aprovado' },
    { nome: 'Contratado', cls: 'contratado' }, { nome: 'Não selecionado', cls: 'fora' },
    { nome: 'Colaborador ativo', cls: 'aprovado' }, { nome: 'Desligado', cls: 'fora' }
  ];
  var TRILHAS = [
    { nome: 'Operações', niveis: ['Auxiliar de Operações', 'Conferente', 'Operador de Empilhadeira', 'Líder de Turno', 'Supervisor Operacional', 'Coordenador de Operações'] },
    { nome: 'Logística / Tráfego', niveis: ['Assistente de Tráfego', 'Analista de Logística', 'Supervisor de Tráfego', 'Coordenador de Logística'] },
    { nome: 'Transportes', niveis: ['Motorista Coleta/Entrega', 'Motorista Carreteiro', 'Supervisor de Frota', 'Coordenador de Transportes'] },
    { nome: 'Atendimento', niveis: ['Assistente de SAC', 'Analista de SAC', 'Supervisor de SAC'] }
  ];

  /* ---------------- HELPERS ---------------- */
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
  var iniciais = function (n) { var p = String(n || '').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); };
  var nomeCurto = function (n) {
    var p = String(n || '').trim().split(/\s+/).filter(Boolean);
    if (p.length <= 3) return p.join(' ');
    var meio = p.slice(1, -1).slice(0, 2).map(function (x) { return x[0] + '.'; }).join(' ');
    return p[0] + (meio ? ' ' + meio : '') + ' ' + p[p.length - 1];
  };
  var fotoAvatar = function (p, size) {
    var sz = 'width:' + size + 'px;height:' + size + 'px;';
    var cls = 'avatar' + (p.origem === 'Painel' ? '' : ' pub');
    var foto = String(p.foto || '').trim();
    if (foto && /^(data:image|https?:\/\/)/.test(foto)) {
      return '<img class="' + cls + '" style="' + sz + 'object-fit:cover" src="' + esc(foto) + '" alt="">';
    }
    return '<div class="' + cls + '" style="' + sz + '"><div class="initials">' + esc(iniciais(p.nome)) + '</div></div>';
  };
  var uid = function () { return 'JT-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0'); };
  var fotoAtual = '';
  function lerFoto(file, cb) {
    if (!file || !/^image\//.test(file.type)) return alerta('Escolha um arquivo de imagem.', 'err');
    if (file.size > 12 * 1024 * 1024) return alerta('Imagem muito grande (máx. 12 MB).', 'err');
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 480, w = img.width, h = img.height;
        if (w > max || h > max) { var r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(cv.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = function () { alerta('Não foi possível ler a imagem.', 'err'); };
      img.src = fr.result;
    };
    fr.onerror = function () { alerta('Falha ao ler o arquivo.', 'err'); };
    fr.readAsDataURL(file);
  }
  var fmtData = function (iso) { if (!iso) return '—'; var d = new Date(iso); return isNaN(d) ? iso : ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); };

  var DB = { cadastros: {}, internos: {}, vagas: [], pdi: {}, cfg: {} };
  var CFG = { backend: DEFAULT_BACKEND, espelhar: true, alerta: '' };
  var admin = false, dbRef = null, authObj = null, firebaseOk = false;

  function alerta(msg, tipo) {
    var el = $('#alert'); if (!el) return;
    el.className = 'alert show ' + (tipo || 'ok'); el.innerHTML = msg;
    window.clearTimeout(alerta._t);
    alerta._t = window.setTimeout(function () { el.className = 'alert'; }, tipo === 'err' ? 9000 : 5000);
  }
  function syncPill(on, txt) {
    var p = $('#syncPill'); if (!p) return;
    p.className = 'sync-pill ' + (on ? 'on' : 'off');
    $('#syncTxt').textContent = txt;
  }
  function carregarCfgLocal() {
    try { var c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); if (c) CFG = Object.assign(CFG, c); } catch (e) {}
    try { var d = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (d) DB = Object.assign(DB, d); } catch (e) {}
    try { DB.cfg = JSON.parse(localStorage.getItem('jt_portal_vagas_v1') || 'null') || { vagas: DEFAULT_VAGAS }; } catch (e) { DB.cfg = { vagas: DEFAULT_VAGAS }; }
    if (!DB.cfg.vagas || !DB.cfg.vagas.length) DB.cfg.vagas = DEFAULT_VAGAS;
    aplicarFotos();
  }
  function aplicarFotos() {
    var fotos = {}; try { fotos = JSON.parse(localStorage.getItem(FOTOS_KEY) || '{}'); } catch (e) {}
    Object.keys(DB.internos || {}).forEach(function (k) {
      if (fotos[k]) DB.internos[k].foto = fotos[k];
    });
  }
  function salvarCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ cadastros: DB.cadastros, internos: DB.internos, pdi: DB.pdi }));
      localStorage.setItem('jt_portal_vagas_v1', JSON.stringify(DB.cfg));
    } catch (e) {}
  }

  /* ---------------- FIREBASE ---------------- */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      var s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = res; s.onerror = function () { rej(new Error('falha ao carregar ' + src)); };
      document.head.appendChild(s);
    });
  }
  async function initFirebase() {
    try {
      if (!window.firebase || !firebase.apps || !firebase.apps.length) {
        var base = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-';
        await loadScript(base + 'app-compat.js');
        await loadScript(base + 'auth-compat.js');
        await loadScript(base + 'database-compat.js');
        firebase.initializeApp(FB);
      }
      authObj = firebase.auth();
      try { await authObj.signInWithEmailAndPassword(USER, PASS); }
      catch (e) { if (authObj.currentUser) { /* já autenticado */ } else { throw e; } }
      dbRef = firebase.database();
      firebaseOk = true;
      syncPill(true, 'Firebase online');

      dbRef.ref(PATH_CAD).on('value', function (snap) {
        var v = snap.val(); if (v) { DB.cadastros = v; salvarCache(); render(); renderNotify(); }
      });
      dbRef.ref(PATH_INT).on('value', function (snap) {
        var v = snap.val(); if (v) { DB.internos = v; aplicarFotos(); salvarCache(); render(); renderNotify(); }
      });
      dbRef.ref(PATH_CFG).on('value', function (snap) {
        var v = snap.val();
        if (v && Array.isArray(v.vagas)) { DB.cfg = v; salvarCache(); renderVagasConfig(); render(); }
      });
      dbRef.ref(PATH_PDI).on('value', function (snap) {
        var v = snap.val(); if (v) { DB.pdi = v; salvarCache(); render(); }
      });
      esvaziarFila();
      return true;
    } catch (e) {
      console.warn('[portal] firebase', e);
      firebaseOk = false; syncPill(false, 'Modo local');
      return false;
    }
  }
  function gravar(path, dados) {
    if (!firebaseOk || !dbRef) {
      var fila = []; try { fila = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) {}
      fila.push({ path: path, dados: dados }); localStorage.setItem(QUEUE_KEY, JSON.stringify(fila));
      return Promise.resolve(false);
    }
    return dbRef.ref(path).set(dados).then(function () { return true; }, function (e) { console.warn('[portal] gravação', e); return false; });
  }
  async function esvaziarFila() {
    var fila = []; try { fila = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) {}
    if (!fila.length || !firebaseOk) return;
    for (var i = 0; i < fila.length; i++) {
      try { await dbRef.ref(fila[i].path).set(fila[i].dados); } catch (e) {}
    }
    localStorage.removeItem(QUEUE_KEY);
    syncPill(true, 'Fila sincronizada');
  }

  /* ---------------- ESPELHO NA PLANILHA (JSONP) ---------------- */
  function espelhar(reg, abaForcada) {
    if (!CFG.espelhar || !CFG.backend) return;
    var cb = '__jtTal_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    var q = '?action=ADD_TALENTO&callback=' + cb +
      '&aba=' + encodeURIComponent(abaForcada || abaDe(reg)) +
      '&origem=' + encodeURIComponent(reg.origem || 'Portal') +
      '&id=' + encodeURIComponent(reg.id) + '&nome=' + encodeURIComponent(reg.nome) +
      '&email=' + encodeURIComponent(reg.email) + '&telefone=' + encodeURIComponent(reg.telefone) +
      '&unidade=' + encodeURIComponent(reg.unidade) + '&cargo=' + encodeURIComponent(reg.cargo) +
      '&status=' + encodeURIComponent(reg.status) + '&cadastro=' + encodeURIComponent(reg.criadoEm) +
      '&curriculo=' + encodeURIComponent(reg.curriculo || '') + '&notas=' + encodeURIComponent((reg.experiencia || '') + ' | ' + (reg.observacoes || ''));
    window[cb] = function (r) { try { delete window[cb]; } catch (e) {} if (s.parentNode) s.parentNode.removeChild(s); console.info('[portal] espelho', r); };
    var s = document.createElement('script');
    s.src = CFG.backend + q; s.onerror = function () { try { delete window[cb]; } catch (e) {} };
    document.head.appendChild(s);
  }

  /* ---------------- WHATSAPP ---------------- */
  function notificar(p, texto, etapa, canais) {
    canais = canais || { email: true, whats: true };
    var nota = {
      id: 'N-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      em: new Date().toISOString(), texto: texto, etapa: etapa || 'mensagem',
      para: p.email || '', telefone: p.telefone || '', nome: p.nome,
      canais: canais, estado: { email: false, whats: false }, lido: false
    };
    var copia = Object.assign({}, p, {
      notificacoes: (p.notificacoes || []).concat([nota]), atualizadoEm: new Date().toISOString()
    });
    var path = caminhoDe(p);
    if (p.origem === 'Painel') DB.internos[p.id] = copia; else DB.cadastros[p.id] = copia;
    salvarCache(); render(); renderNotify(); gravar(path, copia);

    // WhatsApp: envio manual — abre o app com a mensagem pronta
    if (canais.whats) {
      var tel = String(p.telefone || '').replace(/\D/g, '');
      if (tel.length === 10 || tel.length === 11) tel = '55' + tel;
      if (tel) {
        window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
        nota.estado.whats = 'manual';
      }
    }
    var finalizar = function () {
      gravar(path, Object.assign({}, copia, { notificacoes: copia.notificacoes.map(function (n) { return n.id === nota.id ? nota : n; }) }));
      render(); renderNotify();
      var partes = [];
      if (canais.email) partes.push(nota.estado.email ? 'e-mail enviado' : 'e-mail falhou');
      if (canais.whats) partes.push(nota.estado.whats === 'manual' ? 'WhatsApp pronto para envio' : 'sem telefone');
      alerta('Notificação registrada: <b>' + (partes.join(' • ') || 'salva no painel') + '</b>.', nota.estado.email ? 'ok' : 'warn');
    };
    var url = CFG.backend || '';
    if (!canais.email || !url || !p.email) {
      if (canais.email) nota.estado.email = false;
      finalizar();
      return;
    }
    var cb = '__jtMail_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    var s = document.createElement('script');
    var done = false;
    var fim = setTimeout(function () { if (!done) { done = true; limpar(); nota.estado.email = false; finalizar(); } }, 12000);
    function limpar() { clearTimeout(fim); try { delete window[cb]; } catch (e) {} if (s.parentNode) s.parentNode.removeChild(s); }
    window[cb] = function (r) { if (done) return; done = true; limpar(); nota.estado.email = !!(r && r.ok); finalizar(); };
    s.onerror = function () { if (done) return; done = true; limpar(); nota.estado.email = false; finalizar(); };
    s.src = url + '?action=NOTIFY_EMAIL&callback=' + cb + '&email=' + encodeURIComponent(p.email) +
      '&assunto=' + encodeURIComponent('Atualização da sua candidatura — J&T Express') + '&texto=' + encodeURIComponent(texto);
    document.head.appendChild(s);
  }
  function todasNotificacoes() {
    return lista().reduce(function (acc, p) {
      (p.notificacoes || []).forEach(function (n) { acc.push(Object.assign({}, n, { pessoaId: p.id })); });
      return acc;
    }, []).sort(function (a, b) { return String(b.em).localeCompare(String(a.em)); });
  }
  function renderNotify() {
    var badge = $('#notifyBadge'); if (!badge) return;
    var todas = todasNotificacoes();
    var naoLidas = todas.filter(function (n) { return !n.lido; }).length;
    badge.textContent = naoLidas; badge.hidden = naoLidas === 0;
    var box = $('#notifyList'); if (!box) return;
    box.innerHTML = todas.length ? todas.slice(0, 40).map(function (n) {
      var ch = (n.canais && Object.keys(n.canais).filter(function (k) { return n.canais[k]; })) || ['painel'];
      var est = n.estado || {};
      return '<div class="match-row"><div style="flex:1"><b style="font-size:12px">' + esc(n.nome) + '</b> ' +
        ch.map(function (c) {
          var v = est[c];
          var lbl = c === 'email' ? 'e-mail' : 'WhatsApp';
          return '<span class="badge ' + (v === true ? 'green' : v === 'manual' ? 'purple' : 'amber') + '">' +
            lbl + (v === true ? ' ✓ enviado' : v === 'manual' ? ' pronta (manual)' : ' ⚠') + '</span>';
        }).join(' ') +
        '<div class="hint">' + esc(n.etapa) + ' • ' + esc(new Date(n.em).toLocaleString('pt-BR')) + '</div>' +
        '<div class="hint" style="margin-top:3px;color:var(--ink)">' + esc(n.texto).slice(0, 160) + '</div></div></div>';
    }).join('') : '<div class="empty">Nenhuma notificação registrada.</div>';
  }

  /* ---------------- COLABORADORES DO PAINEL (SC-MRB — INTERNO) ---------------- */
  function sincronizarColaboradores() {
    var cb = '__jtColabs_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    var url = DEFAULT_BACKEND + (DEFAULT_BACKEND.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + cb + '&t=' + Date.now();
    var btn = $('#btnSincronizar');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Sincronizando…'; }
    var s = document.createElement('script');
    var timer = setTimeout(function () { limpar(); alerta('Tempo limite ao consultar o painel.', 'err'); }, 60000);
    function limpar() {
      clearTimeout(timer); try { delete window[cb]; } catch (e) {}
      if (s.parentNode) s.parentNode.removeChild(s);
      if (btn) { btn.disabled = false; btn.textContent = '⇩ Trazer colaboradores do painel'; }
    }
    window[cb] = function (d) {
      limpar();
      if (!d || !Array.isArray(d.colabs)) return alerta('O painel não retornou colaboradores.', 'err');
      var mapa = {};
      d.colabs.forEach(function (c) {
        var mat = String(c.matricula || c.id || '').replace(/\D/g, '');
        var chave = mat || norm(c.name);
        if (!chave) return;
        mapa['INT-' + chave] = {
          id: 'INT-' + chave,
          nome: c.name || '',
          email: c.email || '',
          telefone: c.telefone || '',
          unidade: 'SC-MRB',
          cargo: c.funcao || 'COLABORADOR',
          status: /desligado/i.test(String(c.status || '')) ? 'Desligado' : 'Colaborador ativo',
          origem: 'Painel',
          aba: 'Talentos-SC-MRB',
          matricula: c.matricula || '',
          foto: String(c.avatar || c.fotoBase64 || ''),
          turno: c.turno || '',
          admissao: c.admissao || '',
          score: c.score == null ? '—' : c.score,
          dsr: c.dsr || '',
          criadoEm: c.admissao || '',
          experiencia: [c.turno, c.skillLevel, c.horario].filter(Boolean).join(' • '),
          observacoes: 'Score: ' + (c.score == null ? '—' : c.score) + ' • DSR: ' + (c.dsr || '—'),
          atualizadoEm: new Date().toISOString()
        };
      });
      DB.internos = mapa;
      // Fotos ficam só no dispositivo (base64 é pesado); no Firebase vão os dados sem imagem
      var fotos = {};
      Object.keys(mapa).forEach(function (k) { if (mapa[k].foto) fotos[k] = mapa[k].foto; });
      try { localStorage.setItem(FOTOS_KEY, JSON.stringify(fotos)); } catch (e) {}
      salvarCache(); render();
      // Fotos também vão no Firebase, para acompanhar o banco em qualquer dispositivo
      gravar(PATH_INT, mapa).then(function () {
        alerta('✅ ' + Object.keys(mapa).length + ' colaboradores do painel importados para <b>SC-MRB</b>.');
      });
    };
    s.onerror = function () { limpar(); alerta('Falha de rede ao consultar o painel.', 'err'); };
    s.src = url; document.head.appendChild(s);
  }
  function espelharInternos() {
    var l = Object.keys(DB.internos || {}).map(function (k) { return DB.internos[k]; });
    if (!l.length) return alerta('Não há colaboradores importados. Clique em "Trazer colaboradores do painel" primeiro.', 'warn');
    if (!confirm('Espelhar ' + l.length + ' colaboradores na aba Talentos-SC-MRB da planilha?')) return;
    var btn = $('#btnEspelhar'); if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Espelhando…'; }
    var i = 0;
    (function proximo() {
      if (i >= l.length) { if (btn) { btn.disabled = false; btn.textContent = '⇪ Espelhar SC-MRB na planilha'; } alerta('Espelhamento concluído (' + l.length + ').'); return; }
      espelhar(l[i++], 'Talentos-SC-MRB');
      setTimeout(proximo, 220);
    })();
  }

  /* ---------------- COMPETÊNCIAS ---------------- */
  var SKILL_RULES = [
    { re: /cnh\s*e/i, s: 'CNH E' }, { re: /cnh\s*d/i, s: 'CNH D' },
    { re: /mopp/i, s: 'MOPP' }, { re: /\bear\b/i, s: 'EAR' },
    { re: /nr[-\s]?11|empilhadeira/i, s: 'NR-11 / Empilhadeira' },
    { re: /excel/i, s: 'Excel avançado' }, { re: /kpi/i, s: 'KPIs' },
    { re: /superior|gradua|faculdade/i, s: 'Superior em Logística' },
    { re: /tms/i, s: 'TMS' }, { re: /roteiriza/i, s: 'Roteirização' },
    { re: /sla/i, s: 'SLA' },
    { re: /lideran|gestão de equipe|gestao de equipe/i, s: 'Liderança' },
    { re: /indicador/i, s: 'Indicadores' },
    { re: /hub|distribui/i, s: 'Hub de distribuição' },
    { re: /d\+1/i, s: 'D+1' },
    { re: /conferên|conferen/i, s: 'Conferência de NF' },
    { re: /auditoria|pesagem/i, s: 'Auditoria de pesagem' },
    { re: /leitor.{0,3}óptico|leitor optico/i, s: 'Leitor óptico' },
    { re: /bipagem/i, s: 'Bipagem' },
    { re: /viagem|intermunicip/i, s: 'Viagens intermunicipais' },
    { re: /disponibilidade imediata|imediata/i, s: 'Disponibilidade imediata' },
    { re: /rota regional|regional/i, s: 'Rota regional' },
    { re: /sac|ocorrência|sinistro/i, s: 'SAC' },
    { re: /expedição|expedicao/i, s: 'Expedição' },
    { re: /noturna|turno/i, s: 'Escala noturna' }
  ];
  function skillsDe(p) {
    var txt = [p.cargo, p.experiencia, p.observacoes, p.competencias].join(' ');
    var out = [];
    SKILL_RULES.forEach(function (r) { if (r.re.test(txt) && out.indexOf(r.s) < 0) out.push(r.s); });
    String(p.competencias || '').split(/[,;]/).forEach(function (x) { x = x.trim(); if (x && out.indexOf(x) < 0) out.push(x); });
    return out;
  }
  function casaSkill(skill, lista) {
    var a = norm(skill);
    return lista.some(function (k) { var b = norm(k); return a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0; });
  }
  function matchVaga(p, v) {
    var sk = skillsDe(p), req = v.requisitos || [], des = v.desejaveis || [];
    var hitReq = req.filter(function (s) { return casaSkill(s, sk); });
    var hitDes = des.filter(function (s) { return casaSkill(s, sk); });
    var falhas = req.filter(function (s) { return !casaSkill(s, sk); });
    var cargoOk = norm(p.cargo) === norm(v.cargo);
    var unidOk = p.unidade === v.unidade;
    var score = Math.round((hitReq.length / Math.max(1, req.length)) * 55 +
      (hitDes.length / Math.max(1, des.length)) * 15 + (cargoOk ? 15 : 0) + (unidOk ? 15 : 0));
    score = Math.max(0, Math.min(100, score));
    return { score: score, faltantes: falhas, requisitos: hitReq, desejaveis: hitDes, cargoOk: cargoOk, unidOk: unidOk };
  }
  function melhorMatch(p) {
    var vagas = DB.cfg.vagas || [], best = { score: 0, vaga: null, faltantes: [], requisitos: [], desejaveis: [] };
    vagas.forEach(function (v) {
      var m = matchVaga(p, v);
      if (m.score > best.score) best = { score: m.score, vaga: v, faltantes: m.faltantes, requisitos: m.requisitos, desejaveis: m.desejaveis };
    });
    return best;
  }
  function potencialDe(p) {
    var sk = skillsDe(p).length;
    var txt = [p.experiencia, p.observacoes].join(' ');
    var v = 38 + Math.min(28, sk * 5);
    if (/lideran|supervis|coordenador/i.test(txt)) v += 12;
    if (/superior|gradua/i.test(txt)) v += 10;
    if (String(p.experiencia || '').length > 120) v += 8;
    if (/anos|ano de experi/i.test(txt)) v += 6;
    return Math.max(10, Math.min(100, v));
  }
  function prontidaoDe(p) { return melhorMatch(p).score; }
  function nivelDe(p) {
    var cargo = norm(p.cargo);
    for (var i = 0; i < TRILHAS.length; i++) {
      var ns = TRILHAS[i].niveis;
      for (var j = 0; j < ns.length; j++) {
        var a = norm(ns[j]);
        if (cargo === a || (cargo && (cargo.indexOf(a) >= 0 || a.indexOf(cargo) >= 0))) {
          return { trilha: TRILHAS[i], idx: j, atual: ns[j], proximo: ns[j + 1] || null };
        }
      }
    }
    return { trilha: TRILHAS[0], idx: 0, atual: p.cargo || '—', proximo: TRILHAS[0].niveis[1] };
  }
  function statusCls(s) {
    if (/aprovado|contratado/i.test(s)) return 'green';
    if (/pendente|triagem/i.test(s)) return 'amber';
    if (/não selecionado|nao selecionado|desligado/i.test(s)) return 'red';
    if (/colaborador ativo/i.test(s)) return 'blue';
    return 'blue';
  }
  function lista() {
    return Object.keys(DB.cadastros || {}).map(function (k) { return DB.cadastros[k]; })
      .concat(Object.keys(DB.internos || {}).map(function (k) { return DB.internos[k]; }))
      .filter(Boolean);
  }
  function buscar(id) { return DB.cadastros[id] || DB.internos[id] || null; }
  function caminhoDe(p) { return (p.origem === 'Painel' ? PATH_INT : PATH_CAD) + '/' + p.id; }
  function abaDe(p) { return p.origem === 'Painel' ? 'Talentos-SC-MRB' : 'Talentos-MRB'; }

  /* ---------------- RENDER ---------------- */
  function render() {
    renderKpis(); renderCards(); renderFunil(); renderVagas(); renderCarreira(); preencherFiltros();
  }
  function renderKpis() {
    var l = lista();
    var pend = l.filter(function (p) { return /pendente/i.test(p.status || ''); }).length;
    var aprov = l.filter(function (p) { return /aprovado|contratado/i.test(p.status || ''); }).length;
    var internos = l.filter(function (p) { return p.origem === 'Painel'; }).length;
    var publicos = l.filter(function (p) { return p.origem !== 'Painel'; }).length;
    $('#kpisGestao').innerHTML = [
      ['Colaboradores (SC-MRB)', internos, 'info'], ['Candidatos públicos (MRB)', publicos, ''],
      ['Aguardando triagem', pend, 'warn'], ['Aprovados / contratados', aprov, 'good'],
      ['Total geral', l.length, '']
    ].map(function (k) {
      return '<div class="kpi ' + k[2] + '"><div class="kpi-label">' + k[0] + '</div><div class="kpi-value">' + k[1] + '</div><div class="kpi-foot">Portal de Talentos</div></div>';
    }).join('');
  }
  function filtrar() {
    var q = norm($('#fBusca') ? $('#fBusca').value : '');
    var u = $('#fUnidade') ? $('#fUnidade').value : '';
    var s = $('#fStatus') ? $('#fStatus').value : '';
    var origem = $('#fOrigem') ? $('#fOrigem').value : '';
    var ordem = $('#fOrdem') ? $('#fOrdem').value : 'recentes';
    var l = lista().filter(function (p) {
      var txt = norm([p.nome, p.cargo, p.email, p.experiencia, p.observacoes, (p.competencias || '')].join(' '));
      var okOrigem = !origem || (origem === 'Painel' ? p.origem === 'Painel' : p.origem !== 'Painel');
      return (!q || txt.indexOf(q) >= 0) && (!u || p.unidade === u) && (!s || p.status === s) && okOrigem;
    });
    l.sort(function (a, b) {
      if (ordem === 'nome') return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
      if (ordem === 'match') return melhorMatch(b).score - melhorMatch(a).score;
      return String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''));
    });
    return l;
  }
  function renderCards() {
    var box = $('#cardsCadastros'); if (!box) return;
    var l = filtrar();
    if ($('#contador')) $('#contador').textContent = l.length + ' cadastro(s)';
    if (!l.length) { box.innerHTML = '<div class="empty">Nenhum cadastro encontrado. Ajuste os filtros ou aguarde novos envios.</div>'; return; }
    box.innerHTML = l.map(function (p) {
      var m = melhorMatch(p);
      var skills = skillsDe(p).slice(0, 4);
      return '<div class="card" data-id="' + esc(p.id) + '">' +
        (m.score > 0 ? '<div class="score">' + m.score + '<small>%</small></div>' : '') +
        '<div class="card-top">' + fotoAvatar(p, 48) + '<div>' +
        '<div class="card-name" title="' + esc(p.nome) + '">' + esc(nomeCurto(p.nome)) + '</div><div class="card-role">' + esc(p.cargo || '—') + '</div></div></div>' +
        '<div class="card-meta"><span class="badge ' + (p.origem === 'Painel' ? 'blue' : 'green') + '">' +
        (p.origem === 'Painel' ? 'Colaborador' : 'Público') + '</span>' +
        '<span class="badge ' + statusCls(p.status) + '">' + esc(p.status || '—') + '</span>' +
        '<span class="badge">' + esc(p.unidade) + '</span>' +
        ((p.candidaturas || []).filter(function (c) { return /aguardando/i.test(c.status); }).length ?
          '<span class="badge amber">interesse: ' + esc(p.candidaturas.filter(function (c) { return /aguardando/i.test(c.status); }).map(function (c) { return c.vagaTitulo; }).join(', ')) + '</span>' : '') +
        (m.vaga && m.score >= 40 ? '<span class="badge purple">match ' + m.score + '% · ' + esc(m.vaga.titulo) + '</span>' : '') + '</div>' +
        (skills.length ? '<div class="card-meta">' + skills.map(function (s) { return '<span class="badge blue">' + esc(s) + '</span>'; }).join('') + '</div>' : '') +
        '<div class="card-notes">' + esc(p.experiencia || p.observacoes || 'Sem observações') + '</div></div>';
    }).join('');
    $$('#cardsCadastros .card').forEach(function (c) { c.addEventListener('click', function () { abrirPerfil(c.getAttribute('data-id')); }); });
  }
  function preencherFiltros() {
    var sel = $('#fStatus'); if (!sel) return;
    var atual = sel.value;
    sel.innerHTML = '<option value="">Todos os status</option>' + STATUS.map(function (s) { return '<option>' + s + '</option>'; }).join('') +
      lista().map(function (p) { return p.status; }).filter(function (s, i, a) { return s && STATUS.indexOf(s) < 0 && a.indexOf(s) === i; })
        .map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
    sel.value = atual;
  }
  var vagaAtual = null;
  function renderVagas() {
    var dl = $('#vagasList'); if (!dl) return;
    var vagas = DB.cfg.vagas || [];
    dl.innerHTML = vagas.map(function (v) { return '<option value="' + esc(v.titulo) + '">' + esc(v.unidade) + '</option>'; }).join('');
    if (!vagaAtual && vagas.length) vagaAtual = vagas[0];
    var input = $('#mVagaBusca');
    if (input && vagaAtual && !input.value) input.value = vagaAtual.titulo;
    calcularMatch();
  }
  function vagasPorNome(q) {
    var n = norm(q);
    if (!n) return [];
    var vagas = DB.cfg.vagas || [];
    var exatas = vagas.filter(function (v) { return norm(v.titulo) === n || norm(v.id) === n; });
    if (exatas.length) return exatas;
    return vagas.filter(function (v) {
      return norm(v.titulo).indexOf(n) >= 0 || norm(v.cargo).indexOf(n) >= 0 ||
        (v.unidade && norm(v.unidade).indexOf(n) >= 0) ||
        (v.requisitos || []).some(function (r) { return norm(r).indexOf(n) >= 0; });
    });
  }
  function buscarVaga() {
    var input = $('#mVagaBusca');
    var q = input ? input.value.trim() : '';
    var encontradas = vagasPorNome(q);
    var sug = $('#mVagaSugestoes');
    if (sug) {
      if (!q) sug.innerHTML = '';
      else if (!encontradas.length) sug.innerHTML = '<span class="badge red">Nenhuma vaga encontrada com esse nome</span>';
      else if (encontradas.length > 1) sug.innerHTML = encontradas.map(function (v) {
        return '<button type="button" class="badge blue" data-vaga="' + esc(v.id) + '" style="cursor:pointer">' + esc(v.titulo) + ' — ' + esc(v.unidade) + '</button>';
      }).join('');
      else sug.innerHTML = '';
    }
    if (!q) vagaAtual = (DB.cfg.vagas || [])[0] || null;
    else if (encontradas.length === 1) vagaAtual = encontradas[0];
    else if (!encontradas.length) vagaAtual = null;
    calcularMatch();
  }
  function calcularMatch() {
    var box = $('#mResultados'); if (!box) return;
    var v = vagaAtual;
    if (!v) { box.innerHTML = '<div class="empty">Digite o nome de uma vaga acima para ver os candidatos.</div>'; if ($('#mVagaInfo')) $('#mVagaInfo').textContent = ''; return; }
    if ($('#mVagaInfo')) $('#mVagaInfo').innerHTML = '<b style="color:var(--red)">' + esc(v.titulo) + ' (' + esc(v.unidade) + ')</b> • Requisitos: ' +
      (v.requisitos || []).map(esc).join(', ') +
      (v.desejaveis && v.desejaveis.length ? ' • Desejáveis: ' + v.desejaveis.map(esc).join(', ') : '');
    var res = lista().map(function (p) { return { p: p, m: matchVaga(p, v) }; })
      .sort(function (a, b) { return b.m.score - a.m.score; });
    var bons = res.filter(function (r) { return r.m.score >= 70 && !/contratado|não selecionado|nao selecionado/i.test(r.p.status || ''); });
    var html = '<div class="hint" style="margin-bottom:10px">' + res.length + ' perfil(is) analisado(s) • ' + bons.length + ' com match ≥ 70%</div>';
    res.slice(0, 12).forEach(function (r) {
      var escondido = r.m.score >= 70 && /banco de talentos|triagem/i.test(r.p.status || '');
      html += '<div class="match-row" data-id="' + esc(r.p.id) + '"><div class="avatar" style="width:32px;height:32px;font-size:12px">' + esc(iniciais(r.p.nome)) + '</div>' +
        '<div style="min-width:140px"><b style="font-size:12.5px">' + esc(r.p.nome) + '</b><br><span class="hint">' + esc(r.p.unidade) + ' • ' + esc(r.p.status) + '</span>' +
        (escondido ? ' <span class="badge amber">★ talento escondido</span>' : '') +
        (r.m.faltantes.length ? '<br><span class="hint">Falta: ' + r.m.faltantes.map(esc).join(', ') + '</span>' : '') + '</div>' +
        '<div class="match-bar"><div class="match-fill" style="width:' + r.m.score + '%"></div></div>' +
        '<div class="match-pct">' + r.m.score + '%</div></div>';
    });
    if (!bons.length) {
      html += '<div class="sug" style="margin-top:12px"><b>⚠ Nenhum talento interno com match alto.</b><br>' +
        'Recomenda-se <b>busca externa</b>: divulgar a vaga no portal de cadastro público, grupos de WhatsApp, ' +
        'LinkedIn e parcerias com escolas/cursos de logística de ' + esc(v.unidade) + '. ' +
        'Compartilhe o link do portal: <code>' + esc(location.href.split('?')[0] + '?cadastro=1') + '</code></div>';
    }
    box.innerHTML = html;
    $$('#mResultados .match-row').forEach(function (el) { el.style.cursor = 'pointer'; el.addEventListener('click', function () { abrirPerfil(el.getAttribute('data-id')); }); });
  }
  /* ---------------- FUNIL INTEGRADO ---------------- */
  function moverEtapa(id, etapa) {
    var p = buscar(id); if (!p || (p.status || 'Pendente') === etapa) return;
    var copia = Object.assign({}, p, { status: etapa, atualizadoEm: new Date().toISOString() });
    if (p.origem === 'Painel') DB.internos[id] = copia; else DB.cadastros[id] = copia;
    salvarCache(); render(); gravar(caminhoDe(p), copia);
    var primeiro = String(p.nome || '').trim().split(/\s+/)[0];
    var msg = 'Olá, ' + primeiro + '!\n\nSua candidatura' + (p.vagaTitulo ? ' à vaga *' + p.vagaTitulo + '*' : '') +
      ' foi atualizada para: *' + etapa + '*.\n\n' +
      (etapa === 'Aprovado' ? 'Parabéns! Em breve entraremos em contato com os próximos passos.' :
       etapa === 'Contratado' ? 'Seja bem-vindo(a) ao time J&T Express! 🎉' :
       etapa === 'Não selecionado' ? 'Agradecemos seu interesse. Desejamos sucesso na sua jornada!' :
       'Continuamos acompanhando seu perfil. Obrigado!') +
      '\n\n— Gestão de Pessoas J&T Express';
    notificar(copia, msg, etapa, { email: true, whats: true });
  }
  function renderFunil() {
    var box = $('#funilPortal'); if (!box) return;
    var q = norm($('#ffBusca') ? $('#ffBusca').value : '');
    var origem = $('#ffOrigem') ? $('#ffOrigem').value : '';
    var l = lista().filter(function (p) {
      return (!q || norm([p.nome, p.cargo, p.profissao, p.email].join(' ')).indexOf(q) >= 0) &&
        (!origem || (origem === 'Painel' ? p.origem === 'Painel' : p.origem !== 'Painel'));
    });
    if ($('#ffContador')) $('#ffContador').textContent = l.length + ' pessoa(s)';
    box.innerHTML = ETAPAS.map(function (et) {
      var ps = l.filter(function (p) { return (p.status || 'Pendente') === et.nome; });
      return '<div class="fcol ' + et.cls + '" data-etapa="' + esc(et.nome) + '">' +
        '<div class="fcol-head"><b>' + esc(et.nome) + '</b><span>' + ps.length + '</span></div><div class="fcol-body">' +
        ps.map(function (p) {
          var i = ETAPAS.map(function (x) { return x.nome; }).indexOf(et.nome);
          return '<div class="fcard" draggable="true" data-id="' + esc(p.id) + '">' +
            '<div class="fcard-top">' + fotoAvatar(p, 34) + '<div><div class="fcard-name" title="' + esc(p.nome) + '">' +
            esc(nomeCurto(p.nome)) + '</div><div class="fcard-role">' + esc(p.profissao || p.cargo || '—') + '</div></div></div>' +
            '<div class="fcard-meta"><span class="badge ' + (p.origem === 'Painel' ? 'blue' : 'green') + '">' +
            (p.origem === 'Painel' ? 'Casa' : 'Externo') + '</span>' +
            (p.vagaTitulo ? '<span class="badge purple">' + esc(p.vagaTitulo) + '</span>' : '') + '</div>' +
            '<div class="fcard-actions">' +
            '<button class="btn sm" data-mover="' + esc(p.id) + '" data-dir="-1"' + (i <= 0 ? ' disabled' : '') + '>◀</button>' +
            '<button class="btn sm primary" data-mover="' + esc(p.id) + '" data-dir="1"' + (i >= ETAPAS.length - 1 ? ' disabled' : '') + '>▶</button></div></div>';
        }).join('') + '</div></div>';
    }).join('');

    $$('#funilPortal .fcard').forEach(function (el) {
      el.addEventListener('click', function (e) { if (!e.target.closest('button')) abrirPerfil(el.getAttribute('data-id')); });
      el.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', el.getAttribute('data-id')); });
    });
    $$('#funilPortal .fcol').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', function () { col.classList.remove('over'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault(); col.classList.remove('over');
        var id = e.dataTransfer.getData('text/plain'); if (id) moverEtapa(id, col.getAttribute('data-etapa'));
      });
    });
    $$('#funilPortal [data-mover]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var p = buscar(b.getAttribute('data-mover')); if (!p) return;
        var i = ETAPAS.map(function (x) { return x.nome; }).indexOf(p.status || 'Pendente');
        var novo = ETAPAS[Math.max(0, Math.min(ETAPAS.length - 1, i + (+b.getAttribute('data-dir'))))];
        if (novo) moverEtapa(p.id, novo.nome);
      });
    });
    var total = l.length || 1;
    var conv = $('#conversaoPortal');
    if (conv) conv.innerHTML = ETAPAS.slice(0, 5).map(function (et) {
      var n = l.filter(function (p) { return (p.status || 'Pendente') === et.nome; }).length;
      var pct = Math.round(n / total * 100);
      return '<div class="conv"><b>' + esc(et.nome) + '</b><div class="conv-bar"><i style="width:' + pct + '%"></i></div><span>' + n + ' (' + pct + '%)</span></div>';
    }).join('');
  }
  function renderCarreira() {
    var l = lista();
    var nb = $('#ninebox'); if (!nb) return;
    var celulas = {};
    l.forEach(function (p) {
      var pot = potencialDe(p), pro = prontidaoDe(p);
      var xi = pro >= 70 ? 2 : pro >= 40 ? 1 : 0;
      var yi = pot >= 70 ? 2 : pot >= 40 ? 1 : 0;
      var k = yi + '-' + xi;
      (celulas[k] = celulas[k] || []).push(p);
    });
    var nomes = [
      ['2-0', 'Alto potencial / baixa prontidão', 'Desenvolver'], ['2-1', 'Alto potencial / média prontidão', 'Acelerar'], ['2-2', 'Alto potencial / alta prontidão', 'Sucessão ⭐'],
      ['1-0', 'Médio potencial / baixa prontidão', 'Capacitar'], ['1-1', 'Médio potencial / média prontidão', 'Manter'], ['1-2', 'Médio potencial / alta prontidão', 'Aproveitar'],
      ['0-0', 'Baixo potencial / baixa prontidão', 'Observar'], ['0-1', 'Baixo potencial / média prontidão', 'Especializar'], ['0-2', 'Baixo potencial / alta prontidão', 'Retenção']
    ];
    nb.innerHTML = nomes.map(function (c) {
      var ps = celulas[c[0]] || [];
      return '<div class="nb-cell"><h5>' + esc(c[1]) + '<br><span style="color:var(--red)">' + esc(c[2]) + '</span></h5>' +
        ps.map(function (p) { return '<span class="nb-chip" data-id="' + esc(p.id) + '">' + esc(iniciais(p.nome)) + ' ' + esc(p.nome.split(' ')[0]) + '</span>'; }).join('') + '</div>';
    }).join('');
    $$('#ninebox .nb-chip').forEach(function (c) { c.addEventListener('click', function () { abrirPerfil(c.getAttribute('data-id')); }); });

    var tr = $('#trilhas');
    tr.innerHTML = TRILHAS.map(function (t) {
      return '<div style="margin-bottom:12px"><b style="font-size:12px;color:var(--red)">' + esc(t.nome) + '</b>' +
        '<div class="card-meta">' + t.niveis.map(function (n, i) {
          return '<span class="badge ' + (i === 0 ? '' : 'blue') + '">' + esc(n) + '</span>' + (i < t.niveis.length - 1 ? '<span class="hint">→</span>' : '');
        }).join('') + '</div></div>';
    }).join('');

    var sc = $('#sucessao');
    var chaves = ['Líder de Turno', 'Supervisor Operacional', 'Analista de Logística', 'Conferente'];
    sc.innerHTML = chaves.map(function (cargo) {
      var v = { cargo: cargo, requisitos: [], desejaveis: [], unidade: '' };
      var top = lista().map(function (p) { return { p: p, s: Math.round((matchVaga(p, v).score * 0.3) + nivelDe(p).idx * 8 + potencialDe(p) * 0.3) }; })
        .sort(function (a, b) { return b.s - a.s; }).slice(0, 3);
      return '<div style="margin-bottom:12px"><b style="font-size:12px">' + esc(cargo) + '</b>' +
        '<div style="margin-top:5px">' + (top.length ? top.map(function (t, i) {
          return '<span class="badge ' + (i === 0 ? 'green' : '') + '" style="margin-right:5px">' + (i + 1) + 'º ' + esc(t.p.nome) + ' (' + t.s + ')</span>';
        }).join('') : '<span class="hint">Sem sucessores mapeados</span>') + '</div></div>';
    }).join('');
  }

  /* ---------------- MODAL / PERFIL ---------------- */
  var perfilAtual = null;
  function abrirPerfil(id) {
    var p = buscar(id); if (!p) return;
    perfilAtual = id;
    var m = melhorMatch(p), sk = skillsDe(p), nv = nivelDe(p);
    var interno = p.origem === 'Painel';
    $('#modalTitle').textContent = (interno ? 'Pré-cadastro — ' : 'Currículo — ') + p.nome;
    var pdi = DB.pdi[id] || { metas: [] };
    var chip = function (l, v) { return '<div class="pchip"><b>' + esc(l) + '</b>' + v + '</div>'; };
    var mini = function (v, l) { return '<div class="pmini"><b>' + esc(v) + '</b><span>' + esc(l) + '</span></div>'; };
    $('#modalBody').innerHTML =
      '<div class="curri-head">' +
        '<div class="curri-avatar">' + fotoAvatar(p, 96) + '</div>' +
        '<div><div class="curri-name">' + esc(p.nome) + '</div>' +
        '<div class="curri-role">' + esc(p.cargo || '—') + (interno && p.turno ? ' • ' + esc(p.turno) : '') + '</div>' +
        '<div class="curri-badges">' +
          '<span class="badge ' + (interno ? 'blue' : 'green') + '">' + (interno ? 'Colaborador da casa' : 'Candidato externo') + '</span>' +
          '<span class="badge ' + statusCls(p.status) + '">' + esc(p.status || '—') + '</span>' +
          '<span class="badge">' + esc(p.unidade) + '</span>' +
        '</div></div></div>' +
      '<div class="curri-chips">' +
        chip(interno ? 'Matrícula' : 'Protocolo', '<span style="font-family:ui-monospace,monospace">' + esc(p.matricula || p.id || '—') + '</span>') +
        chip('Unidade', esc(p.unidade)) +
        (interno
          ? chip('Turno', esc(p.turno || '—')) + chip('Admissão', fmtData(p.admissao || p.criadoEm)) + chip('Score', esc(p.score == null ? '—' : p.score))
          : chip('Profissão', esc(p.profissao || p.cargo || '—')) + chip('Cadastro', fmtData(p.criadoEm)) + chip('Disponibilidade', esc(p.disponibilidade || '—'))) +
        chip('Melhor match', m.score + '%') +
      '</div>' +
      '<div class="curri-grid">' +
        mini(sk.length, 'Competências') + mini(m.score + '%', 'Match') + mini(potencialDe(p), 'Potencial/100') +
      '</div>' +
      '<div class="curri-sec"><h4><i>▣</i> ' + (interno ? 'Dados do colaborador' : 'Currículo — dados e contato') + '</h4>' +
        '<dl class="kv">' +
        '<dt>Nome completo</dt><dd>' + esc(p.nome) + '</dd>' +
        '<dt>Cargo / profissão</dt><dd>' + esc(p.cargo || '—') + '</dd>' +
        '<dt>E-mail</dt><dd>' + esc(p.email || '—') + '</dd>' +
        '<dt>Telefone</dt><dd>' + esc(p.telefone || '—') + '</dd>' +
        (p.cidade ? '<dt>Cidade</dt><dd>' + esc(p.cidade) + '</dd>' : '') +
        '<dt>Cadastro em</dt><dd>' + fmtData(p.criadoEm || p.cadastro) + '</dd>' +
        (p.curriculo ? '<dt>Arquivo do currículo</dt><dd><a href="' + esc(p.curriculo) + '" target="_blank" rel="noopener">Abrir link ↗</a></dd>' : '') +
        '</dl></div>' +
      (p.experiencia || p.observacoes ? '<div class="curri-sec"><h4><i>◎</i> Experiência e observações</h4><p style="font-size:12.5px;line-height:1.5">' +
        esc(p.experiencia || '—') + (p.observacoes ? '<br><span class="hint">' + esc(p.observacoes) + '</span>' : '') + '</p></div>' : '') +
      '<div class="curri-sec"><h4><i>★</i> Competências detectadas</h4><div class="card-meta">' +
        (sk.length ? sk.map(function (s) { return '<span class="badge blue">' + esc(s) + '</span>'; }).join('') : '<span class="hint">Nenhuma detectada no texto</span>') + '</div></div>' +
      (m.faltantes.length ? '<div class="curri-sec"><h4><i>⚠</i> Gaps para a vaga ' + esc(m.vaga ? m.vaga.titulo : '') + '</h4><p class="hint">' + m.faltantes.map(esc).join(', ') + '</p></div>' : '') +
      '<div class="curri-sec"><h4><i>↗</i> Carreira</h4>' +
        '<p style="font-size:12.5px;line-height:1.6">Nível atual: <b>' + esc(nv.atual) + '</b> • Próximo: <b>' + esc(nv.proximo || 'Topo da trilha') + '</b> (' + esc(nv.trilha.nome) + ')</p></div>' +
      '<div class="curri-sec"><h4><i>✎</i> Plano de Desenvolvimento Individual (PDI)</h4>' +
      '<div id="pdiList">' + (pdi.metas && pdi.metas.length ? pdi.metas.map(function (mt, i) {
        return '<div class="match-row"><label class="check" style="flex:1"><input type="checkbox" data-meta="' + i + '"' + (mt.ok ? ' checked' : '') + '><span>' + esc(mt.titulo) + '</span></label><span class="hint">' + esc(mt.prazo || '') + '</span></div>';
      }).join('') : '<span class="hint">Nenhuma meta cadastrada.</span>') + '</div>' +
      '<div class="toolbar" style="margin-top:8px"><input id="pdiNova" placeholder="Nova meta de desenvolvimento" maxlength="140" style="max-width:340px">' +
      '<input id="pdiPrazo" placeholder="Prazo" maxlength="30" style="max-width:130px">' +
      '<button class="btn sm primary" id="pdiAdd" type="button">+ Meta</button></div>' +
      ((p.candidaturas || p.formacao || p.certificacoes || p.habilidades) ?
        '<div class="sec-title" style="margin-top:14px">Complementos e candidaturas</div>' +
        '<div class="card-meta">' +
        (p.formacao ? '<span class="badge blue">Formação: ' + esc(p.formacao) + '</span>' : '') +
        (p.certificacoes ? '<span class="badge green">' + esc(p.certificacoes) + '</span>' : '') +
        (p.idiomas ? '<span class="badge">' + esc(p.idiomas) + '</span>' : '') +
        (p.habilidades ? '<span class="badge purple">' + esc(p.habilidades) + '</span>' : '') +
        (p.linkedin ? '<span class="badge blue">LinkedIn</span>' : '') +
        (p.candidaturas || []).map(function (c) {
          return '<span class="badge ' + (/aguardando/i.test(c.status) ? 'amber' : /autorizada/i.test(c.status) ? 'green' : 'red') + '">' +
            esc(c.vagaTitulo) + ' — ' + esc(c.status) + '</span>';
        }).join('') + '</div>' : '') +
      '<div class="sec-title">Enviar mensagem específica</div>' +
      '<textarea id="msgCustom" rows="3" placeholder="Escreva a mensagem para este candidato…" style="width:100%;box-sizing:border-box"></textarea>' +
      '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:8px">' +
      '<label class="check"><input type="checkbox" id="chEmail" checked><span>Por e-mail</span></label>' +
      '<label class="check"><input type="checkbox" id="chWhats"><span>Por WhatsApp</span></label></div>';
    $('#modalFoot').innerHTML =
      '<select id="mStatus" style="max-width:210px">' + STATUS.concat([p.status].filter(function (s) { return s && STATUS.indexOf(s) < 0; }))
        .map(function (s) { return '<option' + (s === p.status ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>' +
      '<button class="btn sm primary" id="mSalvar" type="button">Salvar status</button>' +
      '<button class="btn sm primary" id="mEnviar" type="button">✉ Enviar mensagem por e-mail</button>' +
      '<button class="btn sm danger" id="mExcluir" type="button">Excluir</button>';
    $('#modal').classList.add('open');

    $('#mSalvar').onclick = function () {
      var novo = $('#mStatus').value;
      var copia = Object.assign({}, p, { status: novo, atualizadoEm: new Date().toISOString() });
      if (p.origem === 'Painel') DB.internos[id] = copia; else DB.cadastros[id] = copia;
      salvarCache(); render();
      gravar(caminhoDe(p), copia);
      var primeiro = String(p.nome || '').trim().split(/\s+/)[0];
      var msg = 'Olá, ' + primeiro + '!\n\nSua candidatura' + (p.vagaTitulo ? ' à vaga *' + p.vagaTitulo + '*' : '') +
        ' foi atualizada para: ' + novo + '.\n\n— Gestão de Pessoas J&T Express';
      notificar(copia, msg, novo, { email: true, whats: true });
    };
    $('#mEnviar').onclick = function () {
      var texto = $('#msgCustom').value.trim();
      if (!texto) return alerta('Escreva a mensagem antes de enviar.', 'warn');
      var canais = { email: $('#chEmail').checked, whats: $('#chWhats').checked };
      if (!canais.email && !canais.whats) return alerta('Selecione pelo menos um canal.', 'warn');
      notificar(p, texto, 'mensagem', canais);
      $('#msgCustom').value = '';
    };
    $('#mExcluir').onclick = function () {
      if (!confirm('Excluir o cadastro de ' + p.nome + '? Esta ação não pode ser desfeita.')) return;
      if (p.origem === 'Painel') delete DB.internos[id]; else delete DB.cadastros[id];
      salvarCache(); render(); fecharModal();
      gravar(caminhoDe(p), null).then(function () { alerta('Cadastro excluído.', 'warn'); });
    };
    $('#pdiAdd').onclick = function () {
      var t = $('#pdiNova').value.trim(); if (!t) return;
      var at = DB.pdi[id] || { metas: [] }; at.metas = at.metas || [];
      at.metas.push({ titulo: t, prazo: $('#pdiPrazo').value.trim(), ok: false });
      DB.pdi[id] = at; salvarCache(); gravar(PATH_PDI + '/' + id, at); abrirPerfil(id);
    };
    $$('#pdiList input[data-meta]').forEach(function (cb) {
      cb.onchange = function () {
        var i = +cb.getAttribute('data-meta');
        DB.pdi[id].metas[i].ok = cb.checked;
        salvarCache(); gravar(PATH_PDI + '/' + id, DB.pdi[id]);
      };
    });
  }
  function abrirPorMatricula() {
    var campo = $('#fMatricula');
    var mat = String(campo ? campo.value.trim() : '').replace(/\D/g, '');
    if (!mat) return alerta('Digite a matrícula do colaborador.', 'warn');
    var encontrado = lista().filter(function (p) {
      return p.origem === 'Painel' && String(p.matricula || '').replace(/\D/g, '') === mat;
    })[0];
    if (!encontrado) return alerta('Matrícula não encontrada. Clique em "⇩ Trazer colaboradores do painel" para atualizar a base.', 'warn');
    abrirPerfil(encontrado.id);
  }
  function fecharModal() { $('#modal').classList.remove('open'); perfilAtual = null; }

  /* ---------------- CADASTRO PÚBLICO ---------------- */
  function enviarCadastro(ev) {
    ev.preventDefault();
    var nome = $('#cNome').value.trim(), email = $('#cEmail').value.trim(), tel = $('#cTel').value.trim();
    var unid = 'MRB', cargo = $('#cCargo').value.trim();
    var prof = $('#cProfissao') ? $('#cProfissao').value : cargo;
    if (prof === '__outro__') {
      prof = $('#cProfissaoOutra').value.trim();
      if (!prof) return alerta('Digite sua profissão no campo "Outros".', 'err');
    }
    if (!nome || !email || !tel || !cargo || !prof) return alerta('Preencha todos os campos obrigatórios (*).', 'err');
    if (!$('#cConsent').checked) return alerta('É necessário aceitar a política de privacidade.', 'err');
    var duplicado = lista().filter(function (p) { return norm(p.email) === norm(email) || String(p.telefone || '').replace(/\D/g, '') === tel.replace(/\D/g, ''); })[0];
    if (duplicado) return alerta('Este e-mail ou telefone já está cadastrado (protocolo ' + esc(duplicado.id) + ').', 'warn');

    var id = uid();
    var reg = {
      id: id, nome: nome, email: email, telefone: tel, unidade: unid,
      profissao: prof,
      cargo: cargo, foto: fotoAtual,
      experiencia: $('#cExp').value.trim(), disponibilidade: $('#cDisp').value,
      curriculo: $('#cCurriculo').value.trim(), observacoes: $('#cObs').value.trim(),
      status: 'Pendente', origem: 'Portal', aba: 'Talentos-MRB',
      criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString()
    };
    var btn = $('#btnEnviar'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Enviando…';
    gravar(PATH_CAD + '/' + id, reg).then(function (ok) {
      DB.cadastros[id] = reg; salvarCache(); render();
      espelhar(reg);
      btn.disabled = false; btn.textContent = 'Enviar cadastro';
      $('#formCadastro').reset();
      alerta('✅ Cadastro enviado! Protocolo <b>' + esc(id) + '</b>. A equipe de RH entrará em contato pelo WhatsApp informado.', 'ok');
      $('#formHint').textContent = 'Protocolo: ' + id;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------------- ACESSO / ABAS ---------------- */
  function abrirGestao() {
    if (admin) return mostrarGestao(true);
    $('#gate').hidden = false; $('#gatePass').value = ''; $('#gateErr').textContent = '';
    setTimeout(function () { $('#gatePass').focus(); }, 50);
  }
  function mostrarGestao(sim) {
    admin = !!sim;
    $('#viewCadastro').hidden = true; $('#viewGestao').hidden = !sim;
    $('#gate').hidden = !!sim;
    $('#btnLogin').textContent = sim ? '🔓 Sair da gestão' : '🔒 Gestão';
    if (sim) render();
  }
  function verificarGate() {
    if ($('#gatePass').value.trim() === GATE_PASS) {
      sessionStorage.setItem(ADMIN_KEY, '1'); $('#gate').hidden = true; mostrarGestao(true);
    } else { $('#gateErr').textContent = 'SENHA INCORRETA'; }
  }

  /* ---------------- CONFIG ---------------- */
  function carregarCamposCfg() {
    if ($('#cfgBackend')) $('#cfgBackend').value = CFG.backend || '';
    if ($('#cfgEspelhar')) $('#cfgEspelhar').checked = CFG.espelhar !== false;
    if ($('#cfgAlert')) $('#cfgAlert').value = CFG.alerta || '';
  }
  /* ---------------- GERENCIAR VAGAS ---------------- */
  var vagaEditando = null;
  function renderVagasConfig() {
    var box = $('#listaVagas'); if (!box) return;
    var vs = DB.cfg.vagas || [];
    if (!vs.length) { box.innerHTML = '<div class="empty">Nenhuma vaga cadastrada. Clique em "+ Nova vaga".</div>'; return; }
    box.innerHTML = vs.map(function (v) {
      return '<div class="match-row" style="align-items:flex-start">' +
        '<div style="flex:1"><b style="font-size:13px">' + esc(v.titulo) + '</b>' +
        '<div class="card-meta"><span class="badge">' + esc(v.unidade) + '</span>' +
        '<span class="badge ' + (/alta/i.test(v.urgencia || '') ? 'red' : 'amber') + '">' + esc(v.urgencia || '—') + '</span>' +
        '<span class="badge ' + (/fechada/i.test(v.status || '') ? 'red' : 'green') + '">' + esc(v.status || 'Aberta') + '</span></div>' +
        (v.descricao ? '<div class="hint" style="margin-top:5px">' + esc(v.descricao) + '</div>' : '') +
        '<div class="hint" style="margin-top:4px">Requisitos: ' + (v.requisitos || []).map(esc).join(', ') + '</div></div>' +
        '<div style="display:flex;gap:4px"><button class="btn sm" data-ver="' + esc(v.id) + '" title="Ver quem tem o perfil">👥</button>' +
        '<button class="btn sm" data-edit="' + esc(v.id) + '">✎</button>' +
        '<button class="btn sm danger" data-del="' + esc(v.id) + '">🗑</button></div></div>';
    }).join('');
    $$('#listaVagas [data-ver]').forEach(function (b) {
      b.onclick = function () {
        var v = (DB.cfg.vagas || []).filter(function (x) { return x.id === b.getAttribute('data-ver'); })[0];
        if (v) { mostrarCandidatosVaga(v); $('#matchVaga').scrollIntoView({ behavior: 'smooth' }); }
      };
    });
    $$('#listaVagas [data-edit]').forEach(function (b) { b.onclick = function () { editarVaga(b.getAttribute('data-edit')); }; });
    $$('#listaVagas [data-del]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-del');
        var v = (DB.cfg.vagas || []).filter(function (x) { return x.id === id; })[0];
        if (!confirm('Excluir a vaga "' + (v ? v.titulo : id) + '"?')) return;
        DB.cfg.vagas = (DB.cfg.vagas || []).filter(function (x) { return x.id !== id; });
        persistirVagas(); renderVagasConfig(); renderVagas();
      };
    });
  }
  /* ---------------- CANDIDATOS PARA A VAGA (CASA PRIMEIRO) ---------------- */
  function decidirCandidatura(id, vagaId, decisao) {
    var p = buscar(id); if (!p) return;
    var titulo = vagaId;
    (p.candidaturas || []).forEach(function (c) { if (c.vagaId === vagaId) titulo = c.vagaTitulo; });
    var copia = Object.assign({}, p, {
      candidaturas: (p.candidaturas || []).map(function (c) {
        return c.vagaId === vagaId ? Object.assign({}, c, { status: decisao, decididoEm: new Date().toISOString() }) : c;
      }),
      atualizadoEm: new Date().toISOString()
    });
    if (p.origem === 'Painel') DB.internos[id] = copia; else DB.cadastros[id] = copia;
    salvarCache(); render(); gravar(caminhoDe(p), copia);
    var msg = decisao === 'Autorizada'
      ? 'Olá! Sua solicitação para concorrer à vaga *' + titulo + '* foi **AUTORIZADA**. A gestão entrará em contato com os próximos passos.'
      : 'Olá! Sua solicitação para concorrer à vaga *' + titulo + '* não foi autorizada neste momento. Agradecemos o interesse.';
    notificar(copia, msg, 'candidatura', { email: true, whats: true });
    var vagas = DB.cfg.vagas || [];
    var v = vagas.filter(function (x) { return x.id === vagaId; })[0];
    if (v) mostrarCandidatosVaga(v);
  }
  function mostrarCandidatosVaga(v) {
    var box = $('#matchVaga'); if (!box) return;
    var ranking = lista().map(function (p) { return { p: p, m: matchVaga(p, v) }; })
      .sort(function (a, b) { return b.m.score - a.m.score; });
    var internos = ranking.filter(function (r) { return r.p.origem === 'Painel'; });
    var externos = ranking.filter(function (r) { return r.p.origem !== 'Painel'; });
    var bonsInt = internos.filter(function (r) { return r.m.score >= 40; });

    var linha = function (r) {
      return '<div class="match-row" data-id="' + esc(r.p.id) + '" style="cursor:pointer">' +
        fotoAvatar(r.p, 32) +
        '<div style="min-width:140px;flex:1"><b style="font-size:12px">' + esc(nomeCurto(r.p.nome)) + '</b>' +
        '<div class="hint">' + esc(r.p.profissao || r.p.cargo || '—') + ' • ' + esc(r.p.unidade) + '</div>' +
        (r.m.faltantes.length ? '<div class="hint">Falta: ' + r.m.faltantes.map(esc).join(', ') + '</div>' : '') +
        '</div><div class="match-bar"><div class="match-fill" style="width:' + r.m.score + '%"></div></div>' +
        '<div class="match-pct">' + r.m.score + '%</div></div>';
    };

    var solicitantes = lista().filter(function (p) {
      return p.origem === 'Painel' && (p.candidaturas || []).some(function (c) {
        return c.vagaId === v.id && /aguardando/i.test(c.status);
      });
    });
    var solicitHtml = solicitantes.length ? solicitantes.map(function (p) {
      return '<div class="fcard" style="margin-bottom:8px">' +
        '<div class="fcard-top">' + fotoAvatar(p, 40) + '<div><div class="fcard-name">' + esc(p.nome) + '</div>' +
        '<div class="fcard-role">' + esc(p.cargo || '—') + ' • matrícula ' + esc(p.matricula || '—') + '</div></div></div>' +
        '<div class="card-meta"><span class="badge amber">solicitou esta vaga</span>' +
        (p.perfilAtualizadoEm ? '<span class="badge green">ficha atualizada</span>' : '') + '</div>' +
        ((p.formacao || p.certificacoes || p.idiomas || p.habilidades) ?
          '<div class="hint" style="margin-top:6px;color:var(--ink)">' +
          [p.formacao ? 'Formação: ' + p.formacao : '', p.certificacoes ? 'Certificações: ' + p.certificacoes : '',
           p.idiomas ? 'Idiomas: ' + p.idiomas : '', p.habilidades ? 'Habilidades: ' + p.habilidades : ''].filter(Boolean).join(' • ') + '</div>' : '') +
        '<div class="fcard-actions"><button class="btn sm primary" data-decisao="Autorizada" data-id="' + esc(p.id) + '">✓ Autorizar</button>' +
        '<button class="btn sm danger" data-decisao="Não autorizada" data-id="' + esc(p.id) + '">✕ Recusar</button>' +
        '<button class="btn sm" data-perfil="' + esc(p.id) + '">Ver ficha</button></div></div>';
    }).join('') : '<div class="hint">Nenhum colaborador solicitou esta vaga até agora.</div>';

    box.innerHTML = '<div class="panel" style="margin-top:14px">' +
      '<div class="panel-head"><div class="panel-title"><i>◎</i> Perfis para <span style="color:var(--red)">' + esc(v.titulo) + '</span></div>' +
      '<div class="panel-tag">' + esc(v.unidade) + ' • ' + esc(v.urgencia || '—') + '</div></div>' +

      '<div class="curri-sec"><h4><i>✋</i> Solicitações internas — decisão do gestor</h4>' + solicitHtml + '</div>' +

      '<div class="curri-sec"><h4><i>▣</i> 1º Prioridade — talentos da casa (' + bonsInt.length + ' com match ≥ 40%)</h4>' +
      (bonsInt.length ? bonsInt.slice(0, 10).map(linha).join('') :
        '<div class="sug"><b>Nenhum colaborador com aderência para esta vaga.</b><br>' +
        'Antes de buscar fora, vale capacitar alguém da equipe — veja os perfis mais próximos abaixo.</div>') + '</div>' +

      (internos.length && !bonsInt.length ? '<div class="curri-sec"><h4><i>↗</i> Mais próximos na casa</h4>' + internos.slice(0, 5).map(linha).join('') + '</div>' : '') +

      '<div class="curri-sec"><h4><i>⇢</i> 2º Talentos de fora (banco de talentos)</h4>' +
      (externos.length ? externos.slice(0, 10).map(linha).join('') :
        '<div class="sug">Ainda não há candidatos externos cadastrados para esta vaga.</div>') +
      '<div class="hint" style="margin-top:10px">Compartilhe o link público: <code>' + esc(location.origin + location.pathname.replace(/talentos\.html.*/, 'cadastro.html')) + '</code></div>' +
      '</div></div>';

    $$('#matchVaga .match-row').forEach(function (el) {
      el.addEventListener('click', function () { abrirPerfil(el.getAttribute('data-id')); });
    });
    $$('#matchVaga [data-decisao]').forEach(function (b) {
      b.addEventListener('click', function () {
        decidirCandidatura(b.getAttribute('data-id'), v.id, b.getAttribute('data-decisao'));
      });
    });
    $$('#matchVaga [data-perfil]').forEach(function (b) {
      b.addEventListener('click', function () { abrirPerfil(b.getAttribute('data-perfil')); });
    });
  }
  function persistirVagas() {
    salvarCache();
    gravar(PATH_CFG + '/web', {
      backend: CFG.backend, espelhar: CFG.espelhar, alerta: CFG.alerta, vagas: DB.cfg.vagas
    });
    var av = $('#vagaAviso');
    if (av) { av.className = 'alert ok show'; av.innerHTML = '✅ Vagas salvas. O site público e o funil já estão atualizados.'; }
  }
  function editarVaga(id) {
    var v = (DB.cfg.vagas || []).filter(function (x) { return x.id === id; })[0]; if (!v) return;
    vagaEditando = id;
    $('#vagaFormTitulo').textContent = 'Editar vaga';
    $('#vTitulo').value = v.titulo || ''; $('#vUnidade').value = v.unidade || 'SC-MRB';
    $('#vUrgencia').value = v.urgencia || 'Média'; $('#vDescricao').value = v.descricao || '';
    $('#vRequisitos').value = (v.requisitos || []).join(', ');
    $('#vDesejaveis').value = (v.desejaveis || []).join(', ');
    $('#vStatus').value = v.status || 'Aberta';
    $('#formVagaPanel').hidden = false;
    $('#formVagaPanel').scrollIntoView({ behavior: 'smooth' });
  }
  function novaVaga() {
    vagaEditando = null;
    $('#vagaFormTitulo').textContent = 'Nova vaga';
    ['#vTitulo', '#vDescricao', '#vRequisitos', '#vDesejaveis'].forEach(function (s) { $(s).value = ''; });
    $('#vUnidade').value = 'SC-MRB'; $('#vUrgencia').value = 'Média'; $('#vStatus').value = 'Aberta';
    $('#formVagaPanel').hidden = false;
    $('#formVagaPanel').scrollIntoView({ behavior: 'smooth' });
    $('#vTitulo').focus();
  }
  function salvarVaga() {
    var titulo = $('#vTitulo').value.trim();
    if (!titulo) return alerta('Informe o título da vaga.', 'err');
    var obj = {
      id: vagaEditando || ('V-' + Date.now().toString(36).toUpperCase()),
      titulo: titulo, unidade: $('#vUnidade').value, urgencia: $('#vUrgencia').value,
      descricao: $('#vDescricao').value.trim(),
      requisitos: $('#vRequisitos').value.split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean),
      desejaveis: $('#vDesejaveis').value.split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean),
      status: $('#vStatus').value, atualizadaEm: new Date().toISOString()
    };
    DB.cfg.vagas = DB.cfg.vagas || [];
    var i = -1;
    DB.cfg.vagas.forEach(function (v, idx) { if (v.id === obj.id) i = idx; });
    if (i >= 0) DB.cfg.vagas[i] = obj; else DB.cfg.vagas.push(obj);
    $('#formVagaPanel').hidden = true;
    persistirVagas(); renderVagasConfig(); renderVagas(); render();
    mostrarCandidatosVaga(obj);
    $('#matchVaga').scrollIntoView({ behavior: 'smooth' });
  }
  function salvarCfg() {
    CFG.backend = $('#cfgBackend').value.trim();
    CFG.espelhar = $('#cfgEspelhar').checked;
    CFG.alerta = $('#cfgAlert').value.trim();
    localStorage.setItem(CFG_KEY, JSON.stringify(CFG));
    gravar(PATH_CFG + '/' + 'web', { backend: CFG.backend, espelhar: CFG.espelhar, alerta: CFG.alerta, vagas: DB.cfg.vagas });
    alerta('Configuração salva.');
  }
  function testarCfg() {
    var cb = '__jtTest_' + Date.now();
    alerta('Testando backend…', 'warn');
    window[cb] = function (r) {
      try { delete window[cb]; } catch (e) {}
      alerta(r && r.ok ? '✅ Backend respondeu: ' + esc(r.fonte || 'OK') + ' (' + (r.candidatos ? r.candidatos.length + ' linhas' : 'ok') + ')' : '⚠ Backend respondeu com erro: ' + esc(r && r.erro || '?'), r && r.ok ? 'ok' : 'err');
    };
    var s = document.createElement('script');
    s.src = ($('#cfgBackend').value.trim() || DEFAULT_BACKEND) + '?action=GET_TALENTOS&callback=' + cb;
    s.onerror = function () { alerta('❌ Falha de rede ao acessar o backend.', 'err'); };
    document.head.appendChild(s);
  }
  function exportarCSV() {
    var l = filtrar();
    var cols = ['ID', 'Nome', 'E-mail', 'Telefone', 'Unidade', 'Cargo', 'Status', 'Cadastro', 'Competências', 'Experiência', 'Observações'];
    var escV = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var linhas = [cols.map(escV).join(',')].concat(l.map(function (p) {
      return [p.id, p.nome, p.email, p.telefone, p.unidade, p.cargo, p.status, fmtData(p.criadoEm), skillsDe(p).join('; '), p.experiencia, p.observacoes].map(escV).join(',');
    }));
    var blob = new Blob(['\uFEFF' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'banco-de-talentos-jt.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  /* ---------------- INIT ---------------- */
  function init() {
    carregarCfgLocal(); carregarCamposCfg();
    // Se o painel principal já foi desbloqueado nesta sessão, não pede senha de novo
    var sessaoOkay = sessionStorage.getItem('dsr_dash_ok') === '1' ||
      sessionStorage.getItem('jt_funil_admin') === '1' ||
      sessionStorage.getItem(ADMIN_KEY) === '1';
    if (sessaoOkay) { sessionStorage.setItem(ADMIN_KEY, '1'); mostrarGestao(true); }
    else $('#gate').hidden = false;

    $('#btnLogin').addEventListener('click', function () { if (admin) { sessionStorage.removeItem(ADMIN_KEY); mostrarGestao(false); } else abrirGestao(); });
    $('#gateBtn').addEventListener('click', verificarGate);
    $('#gatePass').addEventListener('keydown', function (e) { if (e.key === 'Enter') verificarGate(); });
    $('#modalX').addEventListener('click', fecharModal);
    $('#btnNotify').addEventListener('click', function () { renderNotify(); $('#notifyModal').classList.add('open'); });
    $('#notifyX').addEventListener('click', function () { $('#notifyModal').classList.remove('open'); });
    $('#notifyModal').addEventListener('click', function (e) { if (e.target === this) this.classList.remove('open'); });
    $('#modal').addEventListener('click', function (e) { if (e.target === this) fecharModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharModal(); });

    $$('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        $$('.tab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        ['cadastros', 'funil', 'vagasconfig', 'vagas', 'carreira', 'config'].forEach(function (n) {
          var el = $('#tab-' + n); if (el) el.hidden = n !== t.getAttribute('data-tab');
        });
        var aba = t.getAttribute('data-tab');
        if (aba === 'vagas') renderVagas();
        if (aba === 'vagasconfig') renderVagasConfig();
      });
    });
    ['ffBusca', 'ffOrigem'].forEach(function (id) {
      var el = $('#' + id); if (el) el.addEventListener('input', renderFunil);
    });
    ['fBusca', 'fUnidade', 'fOrigem', 'fStatus', 'fOrdem'].forEach(function (id) {
      var el = $('#' + id); if (el) el.addEventListener('input', renderCards);
    });
    $('#btnSincronizar').addEventListener('click', sincronizarColaboradores);
    $('#btnEspelhar').addEventListener('click', espelharInternos);
    $('#btnRecarregar').addEventListener('click', function () { initFirebase().then(render); });
    $('#btnExportar').addEventListener('click', exportarCSV);
    $('#mVagaBusca').addEventListener('input', buscarVaga);
    $('#mLimparBusca').addEventListener('click', function () {
      $('#mVagaBusca').value = '';
      vagaAtual = (DB.cfg.vagas || [])[0] || null;
      $('#mVagaBusca').value = vagaAtual ? vagaAtual.titulo : '';
      buscarVaga();
    });
    $('#mVagaSugestoes').addEventListener('click', function (e) {
      var b = e.target.closest('[data-vaga]'); if (!b) return;
      var v = (DB.cfg.vagas || []).filter(function (x) { return x.id === b.getAttribute('data-vaga'); })[0];
      if (v) { $('#mVagaBusca').value = v.titulo; buscarVaga(); }
    });
    $('#btnNovaVaga').addEventListener('click', novaVaga);
    $('#btnSalvarVaga').addEventListener('click', salvarVaga);
    $('#btnCancelarVaga').addEventListener('click', function () { $('#formVagaPanel').hidden = true; });
    $('#btnSalvarCfg').addEventListener('click', salvarCfg);
    $('#btnTestarCfg').addEventListener('click', testarCfg);

    if ($('#cProfissao')) $('#cProfissao').addEventListener('change', function () {
      var outro = this.value === '__outro__';
      var lbl = $('#lblProfissaoOutra'); if (lbl) lbl.hidden = !outro;
      if (outro) $('#cProfissaoOutra').focus();
    });
    // Foto: câmera ou arquivo (formulário de cadastro, usado como modelo pelo site externo)
    var prev = $('#cFotoPreview');
    function aplicarFoto(input) {
      lerFoto(input.files && input.files[0], function (dataUrl) {
        fotoAtual = dataUrl;
        if (prev) { prev.src = dataUrl; prev.hidden = false; }
      });
      input.value = '';
    }
    if ($('#btnCam')) $('#btnCam').addEventListener('click', function () { $('#cFotoCam').click(); });
    if ($('#btnArq')) $('#btnArq').addEventListener('click', function () { $('#cFotoArq').click(); });
    if ($('#cFotoCam')) $('#cFotoCam').addEventListener('change', function () { aplicarFoto(this); });
    if ($('#cFotoArq')) $('#cFotoArq').addEventListener('change', function () { aplicarFoto(this); });
    $('#btnMatricula').addEventListener('click', abrirPorMatricula);
    $('#fMatricula').addEventListener('keydown', function (e) { if (e.key === 'Enter') abrirPorMatricula(); });

    render();
    initFirebase().then(function () { render(); renderNotify(); });
    if (location.search.indexOf('admin=1') >= 0) abrirGestao();
    setInterval(function () { if (admin) render(); }, 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
