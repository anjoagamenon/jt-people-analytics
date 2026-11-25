/* Portal público de cadastro — grava em talentos/cadastros/v1 (Firebase) */
(function () {
  'use strict';
  var FB = {
    apiKey: 'AIzaSyAlmwzlPZAW4sU2gfBnJ0lWsp_u4brtHQ4',
    authDomain: 'superb-firefly-515408-i3.firebaseapp.com',
    databaseURL: 'https://superb-firefly-515408-i3-default-rtdb.firebaseio.com',
    projectId: 'superb-firefly-515408-i3',
    appId: '1:823561383768:web:6400e5b250287c2e287f2d'
  };
  var USER = 'salvadosjetmrb@gmail.com', PASS = 'jetexpress10';
  var PATH = 'talentos/cadastros/v1', PATH_CFG = 'talentos/config/v1/web', PATH_INT = 'talentos/internos/v1';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
  var uid = function () { return 'JT-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0'); };
  var db = null, fotoAtual = '', fotoColab = '', vagas = [], vagaSel = null, cfgWeb = {}, internos = {}, ultimoRegistro = null, colabEncontrado = null;

  function validarCPF(v) {
    var s = String(v || '').replace(/\D/g, '');
    if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false;
    var digito = function (base) {
      var soma = 0;
      for (var i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
      var d = (soma * 10) % 11;
      return d === 10 ? 0 : d;
    };
    return digito(s.slice(0, 9)) === Number(s[9]) && digito(s.slice(0, 10)) === Number(s[10]);
  }
  function mascaraCPF(v) {
    var s = String(v || '').replace(/\D/g, '').slice(0, 11);
    return s.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  function idadeDe(v) {
    if (!v) return 0;
    var d = new Date(v + 'T12:00:00'); if (isNaN(d)) return 0;
    var hoje = new Date(), idade = hoje.getFullYear() - d.getFullYear();
    var m = hoje.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;
    return idade;
  }

  var VAGAS_PADRAO = [
    { id: 'V-001', titulo: 'Líder de Turno', unidade: 'SC-MRB', urgencia: 'Alta', descricao: 'Liderança de equipe operacional, gestão de indicadores e acompanhamento de D+1.', requisitos: ['Liderança', 'Indicadores', 'Hub de distribuição'], desejaveis: ['D+1', 'Gestão de equipe'] },
    { id: 'V-002', titulo: 'Supervisor Operacional', unidade: 'MRB', urgencia: 'Alta', descricao: 'Supervisão da operação de expedição com foco em SLA e desenvolvimento de equipe.', requisitos: ['Liderança', 'SLA', 'Gestão de equipe'], desejaveis: ['Expedição', 'Indicadores'] },
    { id: 'V-003', titulo: 'Analista de Logística', unidade: 'SC-MRB', urgencia: 'Média', descricao: 'Análise de KPIs de entrega, relatórios e indicadores operacionais.', requisitos: ['Excel avançado', 'KPIs', 'Superior em Logística'], desejaveis: ['Entrega', 'Indicadores'] },
    { id: 'V-004', titulo: 'Motorista Carreteiro', unidade: 'SC-MRB', urgencia: 'Média', descricao: 'Transporte intermunicipal com CNH E e MOPP em dia.', requisitos: ['CNH E', 'MOPP', 'Viagens intermunicipais'], desejaveis: ['Disponibilidade imediata', 'Rota regional'] },
    { id: 'V-005', titulo: 'Conferente', unidade: 'MRB', urgencia: 'Baixa', descricao: 'Conferência de notas fiscais, CTEs e auditoria de pesagem.', requisitos: ['Conferência de NF', 'Auditoria de pesagem'], desejaveis: ['Leitor óptico', 'Bipagem'] }
  ];

  var PROFISSOES = [
    ['1. Operações e logística', ['Auxiliar Operacional','Operador de Logística','Auxiliar de Expedição','Conferente de Mercadorias','Operador de Triagem','Operador de Esteira','Separador de Encomendas','Auxiliar de Carga e Descarga','Movimentador de Mercadorias','Operador de Empilhadeira','Auxiliar de Armazém','Controlador de Estoque','Assistente de Logística','Analista de Logística','Operador de Coleta']],
    ['2. Liderança e supervisão', ['Líder Operacional','Líder de Expedição','Líder de Triagem','Líder de Turno','Encarregado Operacional','Supervisor Operacional','Supervisor de Logística','Coordenador Operacional','Coordenador de Logística','Gerente Operacional','Gerente de Centro de Distribuição']],
    ['3. Transporte e distribuição', ['Motorista de Entrega','Motorista de Transferência','Motorista de Caminhão','Motorista de Carreta','Motociclista Entregador','Auxiliar de Transporte','Assistente de Transporte','Analista de Transporte','Roteirizador','Controlador de Frota','Supervisor de Transporte','Coordenador de Transportes']],
    ['4. Administrativo e recursos humanos', ['Auxiliar Administrativo','Assistente Administrativo','Analista Administrativo','Recepcionista','Assistente de Recursos Humanos','Analista de Recursos Humanos','Analista de Recrutamento e Seleção','Assistente de Departamento Pessoal','Analista de Departamento Pessoal','Coordenador de Recursos Humanos','Gerente Administrativo']],
    ['5. Tecnologia e sistemas', ['Técnico de Informática','Analista de Suporte de TI','Analista de Sistemas','Analista de Dados','Analista de BI','Desenvolvedor de Sistemas','Analista de Infraestrutura','Coordenador de TI']],
    ['6. Segurança e qualidade', ['Técnico de Segurança do Trabalho','Engenheiro de Segurança do Trabalho','Assistente de Qualidade','Analista de Qualidade','Analista de Prevenção de Perdas','Assistente de Monitoramento','Controlador de Acesso','Supervisor de Segurança Patrimonial']],
    ['7. Atendimento, comercial e financeiro', ['Atendente de SAC','Assistente de Atendimento','Analista de Atendimento','Assistente Comercial','Executivo de Contas','Analista Comercial','Assistente Financeiro','Analista Financeiro','Assistente de Faturamento','Analista de Custos']]
  ];

  function alerta(msg, tipo) {
    var el = $('#alert'); el.className = 'alert show ' + (tipo || 'ok'); el.innerHTML = msg;
    window.clearTimeout(alerta._t); alerta._t = window.setTimeout(function () { el.className = 'alert'; }, 8000);
  }
  function sync(on, txt) {
    var p = $('#syncPill'); p.className = 'sync-pill ' + (on ? 'on' : 'off'); $('#syncTxt').textContent = txt;
  }
  function carregarProfissoes() {
    var dl = $('#profissoesList');
    dl.innerHTML = PROFISSOES.map(function (g) {
      return g[1].map(function (p) { return '<option value="' + esc(p) + '">' + esc(g[0]) + '</option>'; }).join('');
    }).join('');
  }
  function lerFoto(file, cb) {
    if (!file || !/^image\//.test(file.type)) return alerta('Escolha uma imagem.', 'err');
    if (file.size > 12 * 1024 * 1024) return alerta('Imagem muito grande (máx. 12 MB).', 'err');
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 480, w = img.width, h = img.height;
        if (w > max || h > max) { var r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h); cb(cv.toDataURL('image/jpeg', 0.78));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  function renderVagas() {
    var box = $('#vagasLista'); if (!box) return;
    var limpar = $('#btnLimparVaga'); if (limpar) limpar.hidden = !vagaSel;
    if (!vagas.length) {
      box.innerHTML = '<div class="empty">Nenhuma vaga aberta no momento. Você ainda pode cadastrar seu currículo para oportunidades futuras.</div>';
      return;
    }
    box.innerHTML = vagas.map(function (v, i) {
      return '<div class="card vaga-card' + (vagaSel === v.id ? ' sel' : '') + '" data-vaga="' + esc(v.id) + '">' +
        '<div class="card-top"><div class="avatar" style="width:38px;height:38px;font-size:14px">◎</div><div>' +
        '<div class="card-name">' + esc(v.titulo) + '</div><div class="card-role">' + esc(v.unidade) + ' • ' + esc(v.urgencia || '—') + '</div></div></div>' +
        (v.descricao ? '<div class="card-notes">' + esc(v.descricao) + '</div>' : '') +
        '<div class="card-meta"><span class="badge red">Vaga ' + (i + 1) + '</span>' +
        (v.requisitos || []).map(function (r) { return '<span class="badge blue">' + esc(r) + '</span>'; }).join('') + '</div>' +
        (v.desejaveis && v.desejaveis.length ? '<div class="card-meta"><span class="hint">Desejáveis: ' + v.desejaveis.map(esc).join(', ') + '</span></div>' : '') +
        '<div class="fcard-actions"><button class="btn sm primary" type="button" data-vaga="' + esc(v.id) + '">' +
        (vagaSel === v.id ? '✓ Selecionada' : 'Candidatar-se a esta vaga') + '</button></div></div>';
    }).join('');
    $$('#vagasLista [data-vaga]').forEach(function (el) {
      el.addEventListener('click', function () {
        vagaSel = el.getAttribute('data-vaga');
        var v = vagas.filter(function (x) { return x.id === vagaSel; })[0];
        $('#vagaSelecionada').className = 'alert ok show';
        $('#vagaSelecionada').innerHTML = '✅ Vaga selecionada: <b>' + esc(v ? v.titulo : vagaSel) + '</b>. Preencha o currículo abaixo e envie.';
        renderVagas();
      });
    });
  }
  function adicionarExp() {
    var div = document.createElement('div'); div.className = 'cv-row';
    div.innerHTML = '<input class="exp-empresa" placeholder="Empresa" maxlength="80">' +
      '<input class="exp-cargo" placeholder="Cargo" maxlength="80">' +
      '<input class="exp-periodo" placeholder="Período (ex.: 2022–2024)" maxlength="50">' +
      '<input class="exp-desc full" placeholder="Principais atividades e resultados" maxlength="300">' +
      '<button class="btn sm danger" type="button" data-del>Remover</button>';
    div.querySelector('[data-del]').onclick = function () { div.remove(); };
    $('#expList').appendChild(div);
  }
  function adicionarForm() {
    var div = document.createElement('div'); div.className = 'cv-row';
    div.innerHTML = '<input class="form-curso" placeholder="Curso / formação" maxlength="90">' +
      '<input class="form-inst" placeholder="Instituição" maxlength="90">' +
      '<input class="form-ano full" placeholder="Ano de conclusão" maxlength="20">' +
      '<button class="btn sm danger" type="button" data-del>Remover</button>';
    div.querySelector('[data-del]').onclick = function () { div.remove(); };
    $('#formList').appendChild(div);
  }
  function coletar(sel, campos) {
    return $$(sel).map(function (row) {
      var obj = {}; campos.forEach(function (c) { obj[c.k] = (row.querySelector('.' + c.c) || {}).value || ''; });
      return obj;
    }).filter(function (o) { return Object.keys(o).some(function (k) { return o[k]; }); });
  }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      var s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = res; s.onerror = function () { rej(new Error('falha ao carregar')); };
      document.head.appendChild(s);
    });
  }
  async function init() {
    vagas = VAGAS_PADRAO;
    carregarProfissoes();
    $('#btnCam').addEventListener('click', function () { $('#cFotoCam').click(); });
    $('#btnArq').addEventListener('click', function () { $('#cFotoArq').click(); });
    ['#cFotoCam', '#cFotoArq'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        lerFoto(this.files && this.files[0], function (d) { fotoAtual = d; $('#cFotoPreview').src = d; $('#cFotoPreview').hidden = false; });
        this.value = '';
      });
    });
    $('#btnCamColab').addEventListener('click', function () { $('#cFotoColabCam').click(); });
    $('#btnArqColab').addEventListener('click', function () { $('#cFotoColabArq').click(); });
    ['#cFotoColabCam', '#cFotoColabArq'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        lerFoto(this.files && this.files[0], function (d) { fotoColab = d; $('#cFotoColabPreview').src = d; $('#cFotoColabPreview').hidden = false; });
        this.value = '';
      });
    });
    $('#cCpf').addEventListener('input', function () { this.value = mascaraCPF(this.value); });
    $('#cSexo').addEventListener('change', function () {
      var homem = this.value === 'Masculino';
      $('#lblMilitar').hidden = !homem;
      $('#cMilitar').required = homem;
      if (!homem) $('#cMilitar').value = '';
    });
    $('#btnLimparVaga').addEventListener('click', function () {
      vagaSel = null;
      $('#vagaSelecionada').className = 'alert';
      $('#vagaSelecionada').innerHTML = '';
      renderVagas();
    });
    $('#btnDesistir').addEventListener('click', function () { desistir($('#dIdentificador').value); });
    $('#cMatricula').addEventListener('change', function () { buscarColaborador(this.value); });
    $('#cMatricula').addEventListener('blur', function () { buscarColaborador(this.value); });
    $('#btnDesistirAqui').addEventListener('click', function () {
      if (ultimoRegistro) desistir(ultimoRegistro);
    });
    $('#cColaborador').addEventListener('change', function () {
      var sim = this.checked;
      $('#lblMatricula').hidden = !sim;
      $('#complementoColab').hidden = !sim;
      ['#cNome', '#cEmail', '#cTel', '#cCargo'].forEach(function (id) { $(id).required = !sim; });
      if (sim) $('#cMatricula').focus();
    });
    $('#addExp').addEventListener('click', adicionarExp);
    $('#addForm').addEventListener('click', adicionarForm);
    renderVagas();
    $('#formCadastro').addEventListener('submit', enviar);
    try {
      if (!window.firebase || !firebase.apps || !firebase.apps.length) {
        var b = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-';
        await loadScript(b + 'app-compat.js'); await loadScript(b + 'auth-compat.js'); await loadScript(b + 'database-compat.js');
        firebase.initializeApp(FB);
      }
      var auth = firebase.auth();
      try { await auth.signInWithEmailAndPassword(USER, PASS); } catch (e) { if (!auth.currentUser) throw e; }
      db = firebase.database(); sync(true, 'Conectado');
      db.ref(PATH_INT).on('value', function (snap) { internos = snap.val() || {}; });
      db.ref(PATH_CFG).on('value', function (snap) {
        var v = snap.val();
        cfgWeb = v || {};
        vagas = (v && Array.isArray(v.vagas) && v.vagas.length) ? v.vagas : VAGAS_PADRAO;
        vagas = vagas.filter(function (x) { return !x.status || /aberta/i.test(x.status); });
        renderVagas();
      });
    } catch (e) { sync(false, 'Sem conexão — tentarei ao enviar'); }
  }
  function espelhar(reg) {
    var url = cfgWeb.backend || 'https://script.google.com/macros/s/AKfycbyUbsMfMEAB8_ghjRVblCwXOmlMmxOCzScSMSzNfMkAKSmiVQ_Kk6xD2eP4zM0_TKUc/exec';
    if (cfgWeb.espelhar === false) return;
    var cb = '__jtEsp_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    var s = document.createElement('script');
    var fim = setTimeout(function () { limpar(); }, 15000);
    function limpar() { clearTimeout(fim); try { delete window[cb]; } catch (e) {} if (s.parentNode) s.parentNode.removeChild(s); }
    window[cb] = function (r) { limpar(); console.info('[espelho]', r); };
    s.onerror = function () { limpar(); };
    var q = '?action=ADD_TALENTO&callback=' + cb +
      '&aba=Talentos-MRB&origem=Portal&id=' + encodeURIComponent(reg.id) +
      '&nome=' + encodeURIComponent(reg.nome) + '&email=' + encodeURIComponent(reg.email) +
      '&telefone=' + encodeURIComponent(reg.telefone) + '&unidade=MRB' +
      '&cargo=' + encodeURIComponent(reg.profissao || reg.cargo) + '&status=Pendente' +
      '&cadastro=' + encodeURIComponent(String(reg.criadoEm).slice(0, 10)) +
      '&curriculo=' + encodeURIComponent(reg.curriculo || '') +
      '&notas=' + encodeURIComponent('Vaga: ' + (reg.vagaTitulo || '') + ' | ' + (reg.experiencia || ''));
    s.src = url + q; document.head.appendChild(s);
  }
  async function desistir(identificador) {
    var chave = String(identificador || '').trim();
    if (!chave) return alerta('Informe o protocolo ou a matrícula.', 'err');
    if (!db) return alerta('Sem conexão com a base.', 'err');
    var apenasDigitos = chave.replace(/\D/g, '');
    var encontrado = false;
    var alvos = [
      { ref: PATH_INT, tipo: 'interno' },
      { ref: PATH, tipo: 'externo' }
    ];
    for (var i = 0; i < alvos.length; i++) {
      var snap = await db.ref(alvos[i].ref).once('value');
      var dados = snap.val() || {};
      for (var k in dados) {
        var r = dados[k];
        var match = String(r.id || '').toUpperCase() === chave.toUpperCase() ||
          (apenasDigitos.length >= 6 && String(r.matricula || '').replace(/\D/g, '') === apenasDigitos) ||
          (apenasDigitos.length >= 6 && String(r.cpf || '').replace(/\D/g, '') === apenasDigitos);
        if (!match) continue;
        var copia = Object.assign({}, r, {
          candidaturaStatus: 'Desistida',
          desistiuEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
          candidaturas: (r.candidaturas || []).map(function (c) {
            return /aguardando/i.test(c.status) ? Object.assign({}, c, { status: 'Desistida', desistiuEm: new Date().toISOString() }) : c;
          })
        });
        await db.ref(alvos[i].ref + '/' + k).set(copia);
        encontrado = true;
        break;
      }
      if (encontrado) break;
    }
    if (!encontrado) return alerta('Protocolo ou matrícula não encontrado.', 'err');
    $('#dIdentificador').value = '';
    alerta('✅ Candidatura retirada. Você pode se candidatar novamente quando quiser.', 'ok');
  }
  async function buscarColaborador(matricula) {
    var chave = String(matricula || '').replace(/\D/g, '');
    if (chave.length < 4) { colabEncontrado = null; return; }
    if (!db) return;
    var snap = await db.ref(PATH_INT).once('value');
    internos = snap.val() || {};
    var registro = null, rid = '';
    Object.keys(internos).forEach(function (k) {
      if (String(internos[k].matricula || '').replace(/\D/g, '') === chave) { registro = internos[k]; rid = k; }
    });
    if (!registro) {
      colabEncontrado = null;
      alerta('Matrícula não encontrada no efetivo. Confira o número.', 'warn');
      return;
    }
    colabEncontrado = { id: rid, registro: registro };
    var preencher = function (id, valor) { var el = document.getElementById(id); if (el && valor) el.value = valor; };
    preencher('cNome', registro.name || registro.nome);
    preencher('cEmail', registro.email);
    preencher('cTel', registro.telefone);
    preencher('cCpf', registro.cpf ? mascaraCPF(registro.cpf) : '');
    preencher('cNasc', registro.nascimento || registro.admissao);
    preencher('cCargo', registro.cargo || registro.funcao);
    preencher('cProfissao', registro.profissao || registro.cargo || registro.funcao);
    preencher('cCidade', registro.cidade);
    preencher('cFormacaoExtra', typeof registro.formacao === 'string' ? registro.formacao : '');
    preencher('cCertExtra', registro.certificacoes);
    preencher('cIdiomasExtra', registro.idiomas);
    preencher('cSkillsExtra', registro.habilidades);
    preencher('cLinkedinExtra', registro.linkedin);
    if (registro.sexo) {
      var sx = document.getElementById('cSexo'); sx.value = registro.sexo;
      sx.dispatchEvent(new Event('change', { bubbles: true }));
      preencher('cMilitar', registro.situacaoMilitar);
    }
    var aviso = document.getElementById('dadosPainel');
    if (aviso) {
      aviso.hidden = false; aviso.className = 'alert ok show';
      aviso.innerHTML = '✅ Dados encontrados para <b>' + esc(registro.name || registro.nome || '') + '</b>. Confira e complete apenas o que falta.';
    }
  }
  async function candidaturaInterna(matricula, vaga) {
    var chave = String(matricula || '').replace(/\D/g, '');
    if (!chave) return alerta('Informe a matrícula.', 'err');
    if (!db) return alerta('Sem conexão com a base. Tente novamente.', 'err');
    var registro = colabEncontrado ? colabEncontrado.registro : null, rid = colabEncontrado ? colabEncontrado.id : '';
    if (!registro) {
      var snap = await db.ref(PATH_INT).once('value');
      internos = snap.val() || {};
      Object.keys(internos).forEach(function (k) {
        if (String(internos[k].matricula || '').replace(/\D/g, '') === chave) { registro = internos[k]; rid = k; }
      });
    }
    if (!registro) return alerta('Matrícula não encontrada no efetivo. Confira o número digitado.', 'err');
    var titulo = vaga ? vaga.titulo : vagaSel;
    var ja = (registro.candidaturas || []).filter(function (c) { return c.vagaId === vagaSel && /aguardando/i.test(c.status); })[0];
    if (ja) return alerta('Você já tem uma solicitação pendente para esta vaga. Aguarde a análise da gestão.', 'warn');
    var extra = {
      candidaturas: (registro.candidaturas || []).concat([{
        vagaId: vagaSel, vagaTitulo: titulo, status: 'Aguardando análise', criadoEm: new Date().toISOString()
      }]),
      atualizadoEm: new Date().toISOString()
    };
    // Complementos opcionais do colaborador enriquecem o cadastro existente (sem duplicar)
    var formacao = $('#cFormacaoExtra').value.trim();
    var cert = $('#cCertExtra').value.trim();
    var idiomas = $('#cIdiomasExtra').value.trim();
    var skills = $('#cSkillsExtra').value.trim();
    var linkedin = $('#cLinkedinExtra').value.trim();
    var cpfI = $('#cCpf').value.trim(), nascI = $('#cNasc').value, sexoI = $('#cSexo').value;
    if (cpfI) extra.cpf = cpfI.replace(/\D/g, '');
    if (nascI) extra.nascimento = nascI;
    if (sexoI) { extra.sexo = sexoI; extra.situacaoMilitar = sexoI === 'Masculino' ? $('#cMilitar').value : ''; }
    if (formacao) extra.formacao = (registro.formacao || '') + (registro.formacao ? '; ' : '') + formacao;
    if (cert) extra.certificacoes = (registro.certificacoes || '') + (registro.certificacoes ? '; ' : '') + cert;
    if (idiomas) extra.idiomas = idiomas;
    if (skills) extra.habilidades = (registro.habilidades || '') + (registro.habilidades ? '; ' : '') + skills;
    if (linkedin) extra.linkedin = linkedin;
    if (fotoColab) extra.foto = fotoColab;
    extra.perfilAtualizadoEm = new Date().toISOString();
    var copia = Object.assign({}, registro, extra);
    await db.ref(PATH_INT + '/' + rid).set(copia);
    $('#cardForm').hidden = true; $('#cardSucesso').hidden = false;
    $('#protoc').textContent = registro.matricula + ' / ' + titulo;
    ultimoRegistro = String(registro.matricula || rid);
    $('#formHint').textContent = 'Solicitação registrada sem duplicidade';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function localizarIdentidade(cpf, email, tel) {
    if (!db) return null;
    var cpfNum = String(cpf || '').replace(/\D/g, '');
    var telNum = String(tel || '').replace(/\D/g, '');
    var alvos = [{ ref: PATH_INT, tipo: 'interno' }, { ref: PATH, tipo: 'externo' }];
    for (var i = 0; i < alvos.length; i++) {
      var snap = await db.ref(alvos[i].ref).once('value');
      var dados = snap.val() || {};
      for (var k in dados) {
        var r = dados[k];
        var rCpf = String(r.cpf || '').replace(/\D/g, '');
        var rTel = String(r.telefone || '').replace(/\D/g, '');
        if ((cpfNum && rCpf === cpfNum) ||
            (email && String(r.email || '').toLowerCase() === String(email).toLowerCase()) ||
            (telNum && rTel === telNum)) {
          return { tipo: alvos[i].tipo, id: k, registro: r };
        }
      }
    }
    return null;
  }
  async function registrarEmRegistroexistente(encontrado, dados, vaga) {
    var titulo = vaga ? vaga.titulo : vagaSel;
    var atual = encontrado.registro;
    var copia = Object.assign({}, atual, dados, {
      candidaturas: (atual.candidaturas || []).concat([{
        vagaId: vagaSel, vagaTitulo: titulo, status: 'Aguardando análise', criadoEm: new Date().toISOString()
      }]),
      atualizadoEm: new Date().toISOString()
    });
    await db.ref((encontrado.tipo === 'interno' ? PATH_INT : PATH) + '/' + encontrado.id).set(copia);
    $('#cardForm').hidden = true; $('#cardSucesso').hidden = false;
    $('#protoc').textContent = (encontrado.tipo === 'interno' ? (atual.matricula || encontrado.id) : encontrado.id) + ' / ' + titulo;
    ultimoRegistro = encontrado.tipo === 'interno' ? String(atual.matricula || encontrado.id) : encontrado.id;
    $('#formHint').textContent = 'Cadastro identificado — sem duplicidade';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function enviar(ev) {
    ev.preventDefault();
    if (!vagaSel) return alerta('Selecione a vaga desejada na lista acima antes de enviar.', 'warn');
    if (!$('#cConsent').checked) return alerta('Aceite a política de privacidade.', 'err');
    // Colaborador: atualiza o cadastro existente, sem criar duplicidade
    if ($('#cColaborador').checked) {
      var cpfI = $('#cCpf').value.trim(), nascI = $('#cNasc').value, sexoI = $('#cSexo').value;
      if (!validarCPF(cpfI)) return alerta('CPF inválido. Confira os números digitados.', 'err');
      if (idadeDe(nascI) < 18) return alerta('É necessário ter 18 anos ou mais.', 'err');
      if (sexoI === 'Masculino' && !$('#cMilitar').value) return alerta('Informe a situação militar (reservista/dispensa).', 'err');
      var btnInt = $('#btnEnviar'); btnInt.disabled = true; btnInt.innerHTML = '<span class="spinner"></span> Enviando…';
      try {
        await candidaturaInterna($('#cMatricula').value, vagas.filter(function (x) { return x.id === vagaSel; })[0]);
      } catch (e) { alerta('Não foi possível registrar a candidatura. Tente novamente.', 'err'); }
      btnInt.disabled = false; btnInt.textContent = 'Enviar cadastro';
      return;
    }
    var nome = $('#cNome').value.trim(), email = $('#cEmail').value.trim(), tel = $('#cTel').value.trim();
    var prof = $('#cProfissao').value.trim(), cargo = $('#cCargo').value.trim();
    var cpf = $('#cCpf').value.trim(), nasc = $('#cNasc').value, sexo = $('#cSexo').value;
    var militar = $('#cMilitar').value;
    if (!nome || !email || !tel || !prof || !cargo || !cpf || !nasc || !sexo)
      return alerta('Preencha todos os campos obrigatórios (*).', 'err');
    if (!validarCPF(cpf)) return alerta('CPF inválido. Confira os números digitados.', 'err');
    if (idadeDe(nasc) < 18) return alerta('É necessário ter 18 anos ou mais para se candidatar.', 'err');
    if (sexo === 'Masculino' && !militar) return alerta('Informe a situação militar (reservista/dispensa).', 'err');
    var btn = $('#btnEnviar'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Enviando…';
    var vagaObj = vagas.filter(function (x) { return x.id === vagaSel; })[0];
    var complementos = {
      cpf: cpf.replace(/\D/g, ''), nascimento: nasc, sexo: sexo, situacaoMilitar: sexo === 'Masculino' ? militar : '',
      profissao: prof,
      formacao: $('#cFormacaoExtra').value.trim() || undefined
    };
    Object.keys(complementos).forEach(function (k) { if (complementos[k] === undefined) delete complementos[k]; });
    var encontrado = await localizarIdentidade(cpf, email, tel);
    if (encontrado) {
      await registrarEmRegistroexistente(encontrado, complementos, vagaObj);
      btn.disabled = false; btn.textContent = 'Enviar cadastro';
      return;
    }
    var id = uid();
    var reg = {
      id: id, nome: nome, email: email, telefone: tel, unidade: 'MRB',
      cpf: cpf.replace(/\D/g, ''), nascimento: nasc, sexo: sexo,
      situacaoMilitar: sexo === 'Masculino' ? militar : '',
      cidade: $('#cCidade').value.trim(), profissao: prof, cargo: cargo,
      foto: fotoAtual, experiencia: $('#cExp').value.trim(), disponibilidade: $('#cDisp').value,
      curriculo: $('#cCurriculo').value.trim(), observacoes: $('#cObs').value.trim(),
      certificacoes: $('#cCert').value.trim(), idiomas: $('#cIdiomas').value.trim(),
      habilidades: $('#cSkills').value.trim(), linkedin: $('#cLinkedin').value.trim(),
      experiencias: coletar('#expList .cv-row', [{ k: 'empresa', c: 'exp-empresa' }, { k: 'cargo', c: 'exp-cargo' }, { k: 'periodo', c: 'exp-periodo' }, { k: 'descricao', c: 'exp-desc' }]),
      formacao: coletar('#formList .cv-row', [{ k: 'curso', c: 'form-curso' }, { k: 'instituicao', c: 'form-inst' }, { k: 'ano', c: 'form-ano' }]),
      vagaId: vagaSel, vagaTitulo: (vagas.filter(function (v) { return v.id === vagaSel; })[0] || {}).titulo || vagaSel,
      candidaturaEm: new Date().toISOString(),
      status: 'Pendente', origem: 'Portal', aba: 'Talentos-MRB',
      notificacoes: [{ em: new Date().toISOString(), texto: 'Candidatura recebida para ' + ((vagas.filter(function (v) { return v.id === vagaSel; })[0] || {}).titulo || vagaSel) }],
      criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString()
    };
    try {
      if (!db) {
        var b = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-';
        await loadScript(b + 'app-compat.js'); await loadScript(b + 'auth-compat.js'); await loadScript(b + 'database-compat.js');
        if (!window.firebase.apps || !firebase.apps.length) firebase.initializeApp(FB);
        var auth = firebase.auth();
        try { await auth.signInWithEmailAndPassword(USER, PASS); } catch (e) { if (!auth.currentUser) throw e; }
        db = firebase.database(); sync(true, 'Conectado');
      }
      await db.ref(PATH + '/' + id).set(reg);
      espelhar(reg);
      ultimoRegistro = id;
      $('#cardForm').hidden = true; $('#cardSucesso').hidden = false;
      $('#protoc').textContent = id; window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      alerta('Não foi possível enviar. Tente novamente em instantes.', 'err');
      btn.disabled = false; btn.textContent = 'Enviar cadastro';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
