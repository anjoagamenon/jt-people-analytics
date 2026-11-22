/* Funil de Talentos — lê cadastros do Firebase e permite mover entre etapas */
(function () {
  'use strict';
  var FB = {
    apiKey: 'AIzaSyAlmwzlPZAW4sU2gfBnJ0lWsp_u4brtHQ4',
    authDomain: 'superb-firefly-515408-i3.firebaseapp.com',
    databaseURL: 'https://superb-firefly-515408-i3-default-rtdb.firebaseio.com',
    projectId: 'superb-firefly-515408-i3',
    appId: '1:823561383768:web:6400e5b250287c2e287f2d'
  };
  var USER = 'salvadosjetmrb@gmail.com', PASS = 'jetexpress10', GATE = 'jetexpress10';
  var PATH_CAD = 'talentos/cadastros/v1', PATH_INT = 'talentos/internos/v1';
  var ETAPAS = [
    { nome: 'Pendente', cls: 'entrada' }, { nome: 'Em Triagem', cls: 'triagem' },
    { nome: 'Entrevista', cls: 'entrevista' }, { nome: 'Aprovado', cls: 'aprovado' },
    { nome: 'Contratado', cls: 'contratado' }, { nome: 'Não selecionado', cls: 'fora' },
    { nome: 'Colaborador ativo', cls: 'aprovado' }, { nome: 'Desligado', cls: 'fora' }
  ];
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); };
  var iniciais = function (n) { var p = String(n || '').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); };
  var nomeCurto = function (n) {
    var p = String(n || '').trim().split(/\s+/).filter(Boolean);
    if (p.length <= 3) return p.join(' ');
    var meio = p.slice(1, -1).slice(0, 2).map(function (x) { return x[0] + '.'; }).join(' ');
    return p[0] + (meio ? ' ' + meio : '') + ' ' + p[p.length - 1];
  };
  var DB = { cadastros: {}, internos: {} }, db = null, admin = false, atual = null;

  function alerta(msg, tipo) {
    var el = $('#alert'); el.className = 'alert show ' + (tipo || 'ok'); el.innerHTML = msg;
    window.clearTimeout(alerta._t); alerta._t = setTimeout(function () { el.className = 'alert'; }, 6000);
  }
  function sync(on, txt) { var p = $('#syncPill'); p.className = 'sync-pill ' + (on ? 'on' : 'off'); $('#syncTxt').textContent = txt; }
  function lista() {
    return Object.keys(DB.cadastros).map(function (k) { return DB.cadastros[k]; })
      .concat(Object.keys(DB.internos).map(function (k) { return DB.internos[k]; })).filter(Boolean);
  }
  function foto(p, size) {
    var f = String(p.foto || '').trim(), cls = 'avatar' + (p.origem === 'Painel' ? '' : ' pub');
    var st = 'width:' + size + 'px;height:' + size + 'px;';
    if (f && /^(data:image|https?:\/\/)/.test(f)) return '<img class="' + cls + '" style="' + st + '" src="' + esc(f) + '" alt="">';
    return '<div class="' + cls + '" style="' + st + '"><div class="initials">' + esc(iniciais(p.nome)) + '</div></div>';
  }
  function aplicarFotos() {
    var f = {}; try { f = JSON.parse(localStorage.getItem('jt_portal_fotos_v1') || '{}'); } catch (e) {}
    Object.keys(DB.internos || {}).forEach(function (k) { if (f[k]) DB.internos[k].foto = f[k]; });
  }
  function carregar() {
    try {
      var c = JSON.parse(localStorage.getItem('jt_funil_cache') || 'null');
      if (c) { DB.cadastros = c.cadastros || {}; DB.internos = c.internos || {}; }
    } catch (e) {}
    aplicarFotos();
  }
  function salvar() { try { localStorage.setItem('jt_funil_cache', JSON.stringify(DB)); } catch (e) {} }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      var s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = res; s.onerror = function () { rej(new Error('falha')); };
      document.head.appendChild(s);
    });
  }
  async function initFirebase() {
    try {
      if (!window.firebase || !firebase.apps || !firebase.apps.length) {
        var b = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-';
        await loadScript(b + 'app-compat.js'); await loadScript(b + 'auth-compat.js'); await loadScript(b + 'database-compat.js');
        firebase.initializeApp(FB);
      }
      var auth = firebase.auth();
      try { await auth.signInWithEmailAndPassword(USER, PASS); } catch (e) { if (!auth.currentUser) throw e; }
      db = firebase.database(); sync(true, 'Firebase online');
      db.ref(PATH_CAD).on('value', function (snap) { DB.cadastros = snap.val() || {}; salvar(); render(); renderNotify(); });
      db.ref(PATH_INT).on('value', function (snap) { DB.internos = snap.val() || {}; aplicarFotos(); salvar(); render(); renderNotify(); });
    } catch (e) { sync(false, 'Modo local'); }
  }

  function filtrar() {
    var q = norm($('#fBusca') ? $('#fBusca').value : '');
    var o = $('#fOrigem') ? $('#fOrigem').value : '', u = $('#fUnidade') ? $('#fUnidade').value : '';
    return lista().filter(function (p) {
      return (!q || norm([p.nome, p.cargo, p.profissao, p.email].join(' ')).indexOf(q) >= 0) &&
        (!o || (o === 'Painel' ? p.origem === 'Painel' : p.origem !== 'Painel')) && (!u || p.unidade === u);
    });
  }
  function render() {
    var l = filtrar();
    if ($('#contador')) $('#contador').textContent = l.length + ' pessoa(s) no funil';
    var kpi = [
      ['No funil', l.length, ''],
      ['Aguardando', l.filter(function (p) { return /pendente/i.test(p.status || ''); }).length, 'warn'],
      ['Em entrevista', l.filter(function (p) { return /entrevista/i.test(p.status || ''); }).length, 'info'],
      ['Aprovados', l.filter(function (p) { return /aprovado/i.test(p.status || ''); }).length, 'good'],
      ['Contratados', l.filter(function (p) { return /contratado/i.test(p.status || ''); }).length, 'good']
    ];
    $('#kpisFunil').innerHTML = kpi.map(function (k) {
      return '<div class="kpi ' + k[2] + '"><div class="kpi-label">' + k[0] + '</div><div class="kpi-value">' + k[1] + '</div></div>';
    }).join('');

    $('#funil').innerHTML = ETAPAS.map(function (et) {
      var ps = l.filter(function (p) { return (p.status || 'Pendente') === et.nome; });
      return '<div class="fcol ' + et.cls + '" data-etapa="' + esc(et.nome) + '">' +
        '<div class="fcol-head"><b>' + esc(et.nome) + '</b><span>' + ps.length + '</span></div>' +
        '<div class="fcol-body">' + ps.map(card).join('') + '</div></div>';
    }).join('');

    $$('#funil .fcard').forEach(function (el) {
      el.addEventListener('click', function (e) { if (!e.target.closest('button')) abrir(el.getAttribute('data-id')); });
      el.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', el.getAttribute('data-id')); });
    });
    $$('#funil .fcol').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', function () { col.classList.remove('over'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault(); col.classList.remove('over');
        var id = e.dataTransfer.getData('text/plain');
        if (id) mover(id, col.getAttribute('data-etapa'));
      });
    });
    $$('#funil .fcard-actions button').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = b.getAttribute('data-id'), dir = +b.getAttribute('data-dir');
        var p = lista().filter(function (x) { return x.id === id; })[0]; if (!p) return;
        var i = ETAPAS.map(function (x) { return x.nome; }).indexOf(p.status || 'Pendente');
        var novo = ETAPAS[Math.min(ETAPAS.length - 1, Math.max(0, i + dir))];
        if (novo) mover(id, novo.nome);
      });
    });

    var total = l.length || 1;
    $('#conversao').innerHTML = ETAPAS.slice(0, 5).map(function (et, i) {
      var n = l.filter(function (p) { return (p.status || 'Pendente') === et.nome; }).length;
      var pct = Math.round(n / total * 100);
      return '<div class="conv"><b>' + esc(et.nome) + '</b><div class="conv-bar"><i style="width:' + pct + '%"></i></div><span>' + n + ' (' + pct + '%)</span></div>';
    }).join('');
  }
  function card(p) {
    var i = ETAPAS.map(function (x) { return x.nome; }).indexOf(p.status || 'Pendente');
    return '<div class="fcard" draggable="true" data-id="' + esc(p.id) + '">' +
      '<div class="fcard-top">' + foto(p, 34) + '<div><div class="fcard-name" title="' + esc(p.nome) + '">' + esc(nomeCurto(p.nome)) + '</div>' +
      '<div class="fcard-role">' + esc(p.profissao || p.cargo || '—') + '</div></div></div>' +
      '<div class="fcard-meta"><span class="badge ' + (p.origem === 'Painel' ? 'blue' : 'green') + '">' +
      (p.origem === 'Painel' ? 'Casa' : 'Externo') + '</span><span class="badge">' + esc(p.unidade) + '</span>' +
      (p.vagaTitulo ? '<span class="badge purple">' + esc(p.vagaTitulo) + '</span>' : '') + '</div>' +
      '<div class="fcard-actions">' +
      '<button class="btn sm" data-id="' + esc(p.id) + '" data-dir="-1" title="Voltar etapa"' + (i <= 0 ? ' disabled' : '') + '>◀</button>' +
      '<button class="btn sm primary" data-id="' + esc(p.id) + '" data-dir="1" title="Avançar etapa"' + (i >= ETAPAS.length - 1 ? ' disabled' : '') + '>▶</button></div></div>';
  }
  function backendUrl() {
    try { var c = JSON.parse(localStorage.getItem('jt_portal_cfg_v1') || '{}'); return c.backend || ''; } catch (e) { return ''; }
  }
  function notificar(p, texto, etapa, canais) {
    canais = canais || { email: true, whats: true };
    var nota = {
      id: 'N-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      em: new Date().toISOString(), texto: texto, etapa: etapa || 'mensagem',
      para: p.email || '', telefone: p.telefone || '', nome: p.nome,
      canais: canais, estado: {}, lido: false
    };
    var copia = Object.assign({}, p, {
      notificacoes: (p.notificacoes || []).concat([nota]), atualizadoEm: new Date().toISOString()
    });
    var path = (p.origem === 'Painel' ? PATH_INT : PATH_CAD) + '/' + p.id;
    if (p.origem === 'Painel') DB.internos[p.id] = copia; else DB.cadastros[p.id] = copia;
    salvar(); render(); renderNotify();
    if (db) db.ref(path).set(copia);
    var url = backendUrl();
    if (!url) { alerta('Notificação registrada no painel. Configure o backend para enviar pelos canais.', 'warn'); return; }
    var finalizar = function () {
      if (db) db.ref(path).set(Object.assign({}, copia, { notificacoes: copia.notificacoes.map(function (n) { return n.id === nota.id ? nota : n; }) }));
      render(); renderNotify();
      var ok = Object.keys(nota.estado).filter(function (k) { return nota.estado[k]; });
      alerta('Notificação registrada no painel. Canais confirmados: <b>' + (ok.join(', ') || 'nenhum') + '</b>.', ok.length ? 'ok' : 'warn');
    };
    var pendente = 0;
    function enviarCanal(canal) {
      pendente++;
      var cb = '__jtN_' + canal + '_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
      var s = document.createElement('script');
      var done = false;
      var fim = setTimeout(function () { if (!done) { done = true; limpar(); nota.estado[canal] = false; if (--pendente === 0) finalizar(); } }, 12000);
      function limpar() { clearTimeout(fim); try { delete window[cb]; } catch (e) {} if (s.parentNode) s.parentNode.removeChild(s); }
      window[cb] = function (r) {
        if (done) return; done = true; limpar();
        nota.estado[canal] = !!(r && r.ok);
        if (canal === 'whats' && !nota.estado.whats) {
          var tel = String(p.telefone || '').replace(/\D/g, '');
          if (tel.length === 10 || tel.length === 11) tel = '55' + tel;
          if (tel) window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
        }
        if (--pendente === 0) finalizar();
      };
      s.onerror = function () { if (done) return; done = true; limpar(); nota.estado[canal] = false; if (--pendente === 0) finalizar(); };
      if (canal === 'email') {
        s.src = url + '?action=NOTIFY_EMAIL&callback=' + cb + '&email=' + encodeURIComponent(p.email || '') +
          '&assunto=' + encodeURIComponent('Atualização da sua candidatura — J&T Express') + '&texto=' + encodeURIComponent(texto);
      } else {
        var tel = String(p.telefone || '').replace(/\D/g, '');
        if (tel.length === 10 || tel.length === 11) tel = '55' + tel;
        s.src = url + '?action=NOTIFY_WHATSAPP&callback=' + cb + '&phone=' + encodeURIComponent(tel) + '&text=' + encodeURIComponent(texto);
      }
      document.head.appendChild(s);
    }
    if (canais.email) enviarCanal('email');
    if (canais.whats) enviarCanal('whats');
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
    badge.textContent = naoLidas;
    badge.hidden = naoLidas === 0;
    var box = $('#notifyList'); if (!box) return;
    box.innerHTML = todas.length ? todas.slice(0, 40).map(function (n) {
      var ch = (n.canais && Object.keys(n.canais).filter(function (k) { return n.canais[k]; })) || ['painel'];
      var est = n.estado || {};
      return '<div class="match-row"><div style="flex:1"><b style="font-size:12px">' + esc(n.nome) + '</b> ' +
        ch.map(function (c) { return '<span class="badge ' + (est[c] ? 'green' : 'amber') + '">' + (c === 'email' ? 'e-mail' : 'WhatsApp') + (est[c] ? ' ✓' : ' ⚠') + '</span>'; }).join(' ') +
        '<div class="hint">' + esc(n.etapa) + ' • ' + esc(new Date(n.em).toLocaleString('pt-BR')) + '</div>' +
        '<div class="hint" style="margin-top:3px;color:var(--ink)">' + esc(n.texto).slice(0, 160) + '</div></div></div>';
    }).join('') : '<div class="empty">Nenhuma notificação registrada.</div>';
  }
  function mover(id, etapa) {
    var p = lista().filter(function (x) { return x.id === id; })[0]; if (!p || p.status === etapa) return;
    var primeiro = String(p.nome || '').trim().split(/\s+/)[0];
    var msg = 'Olá, ' + primeiro + '! 👋\n\nSua candidatura' + (p.vagaTitulo ? ' à vaga *' + p.vagaTitulo + '*' : '') +
      ' foi atualizada para: *' + etapa + '*.\n\n' +
      (etapa === 'Aprovado' ? 'Parabéns! Em breve entraremos em contato com os próximos passos.' :
       etapa === 'Contratado' ? 'Seja bem-vindo(a) ao time J&T Express! 🎉' :
       etapa === 'Não selecionado' ? 'Agradecemos seu interesse. Desejamos sucesso na sua jornada!' :
       'Continuamos acompanhando seu perfil. Obrigado!') +
      '\n\n— Equipe de Gestão de Pessoas J&T Express';
    var copia = Object.assign({}, p, { status: etapa, atualizadoEm: new Date().toISOString() });
    if (p.origem === 'Painel') DB.internos[id] = copia; else DB.cadastros[id] = copia;
    salvar(); render();
    var path = (p.origem === 'Painel' ? PATH_INT : PATH_CAD) + '/' + id;
    if (db) db.ref(path).set(copia);
    alerta('<b>' + esc(p.nome) + '</b> movido para <b>' + esc(etapa) + '</b>. Avisando pelo WhatsApp…');
    notificar(copia, msg, etapa);
  }
  function abrir(id) {
    var p = lista().filter(function (x) { return x.id === id; })[0]; if (!p) return;
    atual = id;
    $('#modalTitle').textContent = p.nome;
    $('#modalBody').innerHTML = '<div class="curri-head"><div class="curri-avatar">' + foto(p, 96) + '</div><div>' +
      '<div class="curri-name">' + esc(p.nome) + '</div><div class="curri-role">' + esc(p.profissao || p.cargo || '—') + '</div>' +
      '<div class="curri-badges"><span class="badge ' + (p.origem === 'Painel' ? 'blue' : 'green') + '">' +
      (p.origem === 'Painel' ? 'Colaborador da casa' : 'Candidato externo') + '</span>' +
      '<span class="badge amber">' + esc(p.status) + '</span></div></div></div>' +
      '<div class="curri-chips"><div class="pchip"><b>' + (p.origem === 'Painel' ? 'Matrícula' : 'Protocolo') + '</b>' + esc(p.matricula || p.id) + '</div>' +
      '<div class="pchip"><b>Unidade</b>' + esc(p.unidade) + '</div><div class="pchip"><b>E-mail</b>' + esc(p.email) + '</div>' +
      '<div class="pchip"><b>Telefone</b>' + esc(p.telefone) + '</div></div>' +
      (p.experiencia ? '<div class="curri-sec"><h4><i>◎</i> Experiência</h4><p style="font-size:12.5px">' + esc(p.experiencia) + '</p></div>' : '') +
      (p.vagaTitulo ? '<div class="curri-sec"><h4><i>◎</i> Candidatura</h4><p style="font-size:12.5px">Vaga: <b>' + esc(p.vagaTitulo) + '</b></p></div>' : '') +
      (p.experiencias && p.experiencias.length ? '<div class="curri-sec"><h4><i>▤</i> Experiências</h4>' + p.experiencias.map(function (e) {
        return '<div class="cv-row"><b>' + esc(e.empresa) + ' — ' + esc(e.cargo) + '</b><span class="hint">' + esc(e.periodo) + '</span><br><span class="hint">' + esc(e.descricao) + '</span></div>';
      }).join('') + '</div>' : '') +
      (p.formacao && p.formacao.length ? '<div class="curri-sec"><h4><i>🎓</i> Formação</h4>' + p.formacao.map(function (f) {
        return '<div class="hint">' + esc(f.curso) + ' — ' + esc(f.instituicao) + ' (' + esc(f.ano) + ')</div>';
      }).join('') + '</div>' : '') +
      (p.notificacoes && p.notificacoes.length ? '<div class="curri-sec"><h4><i>💬</i> Acompanhamento WhatsApp</h4>' + p.notificacoes.map(function (n) {
        return '<div class="hint">' + esc(new Date(n.em).toLocaleString('pt-BR')) + ' — ' + esc(n.etapa || 'candidatura') + '</div>';
      }).join('') + '</div>' : '') +
      (p.curriculo ? '<div class="curri-sec"><a href="' + esc(p.curriculo) + '" target="_blank" rel="noopener">Abrir currículo ↗</a></div>' : '') +
      '<div class="curri-sec"><h4><i>✉</i> Enviar mensagem específica</h4>' +
      '<textarea id="msgCustom" rows="3" placeholder="Escreva a mensagem para este candidato…" style="width:100%;box-sizing:border-box"></textarea>' +
      '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:8px">' +
      '<label class="check"><input type="checkbox" id="chEmail" checked><span>Por e-mail</span></label>' +
      '<label class="check"><input type="checkbox" id="chWhats"><span>Por WhatsApp</span></label></div></div>';
    $('#modalFoot').innerHTML = '<select id="fStatusModal">' + ETAPAS.map(function (e) {
      return '<option' + (e.nome === p.status ? ' selected' : '') + '>' + e.nome + '</option>'; }).join('') + '</select>' +
      '<button class="btn sm primary" id="mSalvar" type="button">Salvar etapa</button>' +
      '<button class="btn sm primary" id="mEnviar" type="button">✉ Enviar mensagem</button>' +
      '<button class="btn sm" id="mWhats" type="button">Abrir WhatsApp</button>';
    $('#modal').classList.add('open');
    $('#mSalvar').onclick = function () { mover(id, $('#fStatusModal').value); fechar(); };
    $('#mEnviar').onclick = function () {
      var texto = $('#msgCustom').value.trim();
      if (!texto) return alerta('Escreva a mensagem antes de enviar.', 'warn');
      var canais = { email: $('#chEmail').checked, whats: $('#chWhats').checked };
      if (!canais.email && !canais.whats) return alerta('Selecione pelo menos um canal.', 'warn');
      notificar(p, texto, 'mensagem', canais);
      $('#msgCustom').value = '';
    };
    $('#mWhats').onclick = function () {
      var t = String(p.telefone || '').replace(/\D/g, ''); if (t.length === 10 || t.length === 11) t = '55' + t;
      if (t) window.open('https://wa.me/' + t, '_blank', 'noopener'); else alerta('Sem telefone.', 'err');
    };
  }
  function fechar() { $('#modal').classList.remove('open'); }

  function verificar() {
    if ($('#gatePass').value.trim() === GATE) { $('#gate').hidden = true; admin = true; render(); }
    else $('#gateErr').textContent = 'SENHA INCORRETA';
  }
  function init() {
    carregar();
    $('#gate').hidden = false;
    $('#gateBtn').addEventListener('click', verificar);
    $('#gatePass').addEventListener('keydown', function (e) { if (e.key === 'Enter') verificar(); });
    $('#btnLogin').addEventListener('click', function () { $('#gate').hidden = false; });
    $('#modalX').addEventListener('click', fechar);
    $('#modal').addEventListener('click', function (e) { if (e.target === this) fechar(); });
    $('#btnNotify').addEventListener('click', function () { renderNotify(); $('#notifyModal').classList.add('open'); });
    $('#notifyX').addEventListener('click', function () { $('#notifyModal').classList.remove('open'); });
    $('#notifyModal').addEventListener('click', function (e) { if (e.target === this) this.classList.remove('open'); });
    $('#fBusca').addEventListener('input', render);
    $('#fOrigem').addEventListener('input', render);
    $('#fUnidade').addEventListener('input', render);
    render(); renderNotify(); initFirebase().then(function () { render(); renderNotify(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
