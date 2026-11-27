/* ============================================================
   Relatório Mestre — formulário + relatório fiel à planilha
   - Fórmulas lidas da própria planilha modelo (layout.js)
   - Carimbo das fotos estilo Timemark (logo + hora + data +
     endereço + mini-mapa + código de verificação + marca d'água)
   ============================================================ */
(function () {
  'use strict';

  const L = window.LAYOUT;
  const KEY = 'relmestre:v1';
  const FONT = '"Segoe UI", Roboto, "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif';

  /* ---------------- utilidades ---------------- */
  const $ = (s) => document.querySelector(s);
  const pad = (n) => String(n).padStart(2, '0');
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const colName = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const refRC = (ref) => { const m = /^([A-Z]+)(\d+)$/.exec(ref); let c = 0; for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64); return { c, r: Number(m[2]) }; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const fmtNum = (n) => (typeof n === 'number' && isFinite(n) ? String(Number(n.toPrecision(10))) : '');
  const numOrNull = (v) => (v === '' || v == null ? '' : (isFinite(Number(v)) ? Number(v) : ''));

  let toastT = null;
  function toast(msg, ms) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms || 3200);
  }

  /* ---------------- geometria ---------------- */
  const COLX = [], ROWY = [];
  let W = 0, H = 0;
  L.cols.forEach((w) => { COLX.push(W); W += w; });
  L.rows.forEach((h) => { ROWY.push(H); H += h; });
  function box(c1, r1, c2, r2) {
    return {
      left: COLX[c1 - 1], top: ROWY[r1 - 1],
      width: sum(L.cols.slice(c1 - 1, c2)), height: sum(L.rows.slice(r1 - 1, r2)),
    };
  }

  /* ---------------- dados ---------------- */
  function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

  function emptyOSS() { return Array.from({ length: 5 }, () => ({ os: '', planejado: '', real: '', pacotes: '', rota: '', motivo: '' })); }
  function emptyTurnos() { return Array.from({ length: 3 }, (_, i) => ({ nome: i === 0 ? 'T1' : (i === 1 ? 'T2' : ''), ent: '', sai: '', clt: '', desc: '', temp: '', dia: '' })); }

  function defaultData() {
    return {
      dataRelatorio: '2026-11-19',
      centro: 'CGR',
      turnos: [
        { nome: 'T1', ent: '20:00', sai: '04:33', clt: 14, desc: 15, temp: 0, dia: 0 },
        { nome: 'T2', ent: '', sai: '', clt: '', desc: '', temp: '', dia: '' },
        { nome: '', ent: '', sai: '', clt: '', desc: '', temp: '', dia: '' },
      ],
      eficiencia: { recebida: 11736, expedida: 11448, processada: 11761, veiculos: 10 },
      obs: '',
      problemas: { naoChegou: 211, avaria: 0, triagem: 200 },
      oss: [
        { os: 'DBGX26111700052', planejado: '2026-11-19T21:20', real: '2026-11-19T22:02', pacotes: 14004, rota: 'NÃO', motivo: '' },
        ...emptyOSS().slice(1),
      ],
      fotos: {
        inicio: window.SAMPLE_PHOTOS ? { src: window.SAMPLE_PHOTOS.inicio, w: 1600, h: 1200, meta: 'Foto de exemplo (planilha modelo)' } : null,
        fim: window.SAMPLE_PHOTOS ? { src: window.SAMPLE_PHOTOS.fim, w: 1280, h: 720, meta: 'Foto de exemplo (planilha modelo)' } : null,
      },
      /* carimbo estilo Timemark */
      carimbar: true,
      usarGps: true,
      usarMapa: true,
      responsavel: '',
      localCarimbo: '',
      coords: null,
      acessibilidade: { gerarVideo: true, audio: true, idioma: 'pt-BR' },
    };
  }

  function clearData() {
    const d = defaultData();
    d.dataRelatorio = todayISO();
    d.centro = '';
    d.turnos = emptyTurnos();
    d.eficiencia = { recebida: '', expedida: '', processada: '', veiculos: '' };
    d.obs = '';
    d.problemas = { naoChegou: '', avaria: '', triagem: '' };
    d.oss = emptyOSS();
    d.fotos = { inicio: null, fim: null };
    d.responsavel = '';
    d.localCarimbo = '';
    d.coords = null;
    return d;
  }

  function mergeData(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    const out = Object.assign({}, base, saved);
    out.eficiencia = Object.assign({}, base.eficiencia, saved.eficiencia || {});
    out.problemas = Object.assign({}, base.problemas, saved.problemas || {});
    out.fotos = Object.assign({}, base.fotos, saved.fotos || {});
    out.acessibilidade = Object.assign({}, base.acessibilidade, saved.acessibilidade || {});
    if (!Array.isArray(out.turnos) || out.turnos.length !== 3) out.turnos = base.turnos;
    if (!Array.isArray(out.oss) || out.oss.length !== 5) out.oss = base.oss;
    return out;
  }

  let data = (() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? mergeData(defaultData(), JSON.parse(raw)) : defaultData();
    } catch (e) { return defaultData(); }
  })();

  let quotaWarned = false;
  let cloudWarned = false;
  // Soma dos pacotes das OS → Quantidade Recebida (aceita "12.761" e "14004")
  function numeroCampo(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const s = String(v == null ? '' : v).trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const n = Number(s.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  function recalcRecebida() {
    const total = (data.oss || []).reduce((s, o) => s + numeroCampo(o.pacotes), 0);
    if (!data.eficiencia) data.eficiencia = {};
    data.eficiencia.recebida = total;
    // D10 do XLSX: processada = recebida − não chegou (C14)
    data.eficiencia.processada = total - numeroCampo(data.problemas.naoChegou);
    const inp = document.querySelector('[data-key="eficiencia.recebida"]');
    if (inp) inp.value = String(total);
    const inpP = document.querySelector('[data-key="eficiencia.processada"]');
    if (inpP) inpP.value = String(data.eficiencia.processada);
  }
  // Fórmulas do XLSX ATUALIZADO (H4-H7, C10, D10)
  function totalUtilizado(i) {
    const t = (data.turnos || [])[i] || {};
    return numeroCampo(t.clt) + numeroCampo(t.temp) + numeroCampo(t.dia);
  }
  function totalUtilizadoGeral() { return [0, 1, 2].reduce((s, i) => s + totalUtilizado(i), 0); }
  function transferencia() { return numeroCampo(data.eficiencia.recebida) + numeroCampo(data.eficiencia.expedida); }
  function produtividade() {
    const hc = totalUtilizadoGeral(); // H7
    return hc > 0 ? Number(((numeroCampo(data.eficiencia.recebida) + numeroCampo(data.eficiencia.expedida)) / hc).toFixed(7)) : 0;
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      const semFotos = Object.assign({}, data, { fotos: { inicio: null, fim: null } });
      try {
        localStorage.setItem(KEY, JSON.stringify(semFotos));
        if (!quotaWarned) { quotaWarned = true; toast('Formulário salvo. As fotos não couberam no armazenamento do navegador (valem nesta sessão).', 5000); }
      } catch (e2) { /* silencioso */ }
    }
    /* envia também para a fonte única na nuvem (sincroniza APK/PC/painel) */
    if (window.RMCloud) {
      clearTimeout(window.__rmCloudSave);
      window.__rmCloudSave = setTimeout(() => RMCloud.save(clone(data)).then((ok) => {
        if (!ok && !cloudWarned) { cloudWarned = true; toast('⚠ Dados salvos neste aparelho, mas a nuvem não recebeu. Use "Reenviar p/ nuvem".', 6000); }
      }).catch(() => {}), 400);
    }
  }

  /* ---------------- histórico de versões ----------------
     Guarda versões completas (dados + fotos) para revisar,
     editar e reenviar depois. Tenta IndexedDB (mais espaço);
     se falhar, cai para localStorage com cortes de emergência. */
  const HKEY = 'relmestre:hist:v1';
  const HIST_LIMIT = 20;
  let histMode = 'idb';
  let histCache = [];

  function idbOpen() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('sem IndexedDB'));
      let rq;
      try { rq = indexedDB.open('relmestre', 1); } catch (e) { return rej(e); }
      rq.onupgradeneeded = () => { rq.result.createObjectStore('hist', { keyPath: 'id' }); };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error || new Error('idb'));
    });
  }
  const histLocalRead = () => { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) { return []; } };

  function histLocalWrite(list) {
    const noFotos = (l) => l.map((r) => Object.assign({}, r, { data: Object.assign({}, r.data, { fotos: { inicio: null, fim: null } }) }));
    const attempts = [
      { list, msg: null },
      { list: noFotos(list), msg: 'Histórico salvo sem as fotos: armazenamento do navegador cheio.' },
      { list: noFotos(list.slice(0, 3)), msg: 'Histórico enxugado (últimas 3 versões) para caber no navegador.' },
      { list: noFotos(list.slice(0, 1)), msg: 'Apenas a versão mais recente coube no armazenamento.' },
    ];
    for (const a of attempts) {
      try {
        localStorage.setItem(HKEY, JSON.stringify(a.list));
        if (a.msg) toast(a.msg, 5500);
        return true;
      } catch (e) { /* tenta o próximo */ }
    }
    return false;
  }

  async function histAll() {
    try {
      const db = await idbOpen();
      const list = await new Promise((res, rej) => {
        const rq = db.transaction('hist', 'readonly').objectStore('hist').getAll();
        rq.onsuccess = () => res(rq.result || []);
        rq.onerror = () => rej(rq.error);
      });
      histMode = 'idb';
      list.sort((a, b) => String(b.salvoEm || '').localeCompare(String(a.salvoEm || '')));
      return list;
    } catch (e) {
      histMode = 'local';
      return histLocalRead();
    }
  }

  async function histPut(rec) {
    try {
      const db = await idbOpen();
      await new Promise((res, rej) => {
        const tx = db.transaction('hist', 'readwrite');
        tx.objectStore('hist').put(rec);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error || new Error('abort'));
      });
      return true;
    } catch (e) {
      histMode = 'local';
      const list = histLocalRead().filter((r) => r.id !== rec.id);
      list.unshift(rec);
      return histLocalWrite(list.slice(0, HIST_LIMIT));
    }
  }

  async function histDelete(id) {
    try {
      const db = await idbOpen();
      await new Promise((res, rej) => {
        const tx = db.transaction('hist', 'readwrite');
        tx.objectStore('hist').delete(id);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      return true;
    } catch (e) {
      histMode = 'local';
      return histLocalWrite(histLocalRead().filter((r) => r.id !== id));
    }
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtDia = (iso) => { if (!iso) return '—'; const p = iso.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso; };
  function whenStr(iso) {
    try { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`; } catch (e) { return ''; }
  }
  function snapTitulo(rec) {
    const d = rec.data || {};
    return `${fmtDia(d.dataRelatorio)} · SC ${(d.centro || '').trim() || '—'}`;
  }
  function snapMeta(rec) {
    const d = rec.data || {};
    const f = (d.fotos ? (d.fotos.inicio ? 1 : 0) + (d.fotos.fim ? 1 : 0) : 0);
    const n = (d.oss || []).filter((o) => o && o.os).length;
    return `${f} foto${f === 1 ? '' : 's'} · ${n} OS${n === 1 ? '' : 's'}`;
  }

  async function renderHist() {
    const list = await histAll();
    histCache = list;
    const el = $('#histList');
    const cnt = $('#histCount');
    if (cnt) cnt.textContent = list.length ? `${list.length} versão(ões) · ${histMode === 'idb' ? 'IndexedDB' : 'localStorage'}` : '';
    if (!list.length) { el.innerHTML = '<div class="hist-empty">Nenhuma versão salva ainda.</div>'; return; }
    el.innerHTML = list.map((rec) => `
      <div class="hist-item" data-hid="${esc(rec.id)}">
        <div class="hi-top">
          <span class="hi-title">${esc(snapTitulo(rec))}</span>
          <span class="hi-when">salvo ${whenStr(rec.salvoEm)}</span>
        </div>
        <div class="hi-meta">${snapMeta(rec)}</div>
        <div class="hi-btns">
          <button type="button" class="btn" data-hact="abrir">✏️ Abrir p/ editar</button>
          <button type="button" class="btn" data-hact="png">⬇ PNG</button>
          <button type="button" class="btn" data-hact="print">🖨 Imprimir</button>
          <button type="button" class="btn danger" data-hact="excluir">🗑</button>
        </div>
      </div>`).join('');
  }

  async function salvarVersao() {
    const rec = { id: 'v' + Date.now() + Math.random().toString(36).slice(2, 6), salvoEm: new Date().toISOString(), data: clone(data) };
    const ok = await histPut(rec);
    await renderHist();
    if (!ok) { toast('Não foi possível salvar: armazenamento do navegador cheio.', 6000); return; }
    if (gDriveOk) {
      try { await driveUpload(rec); toast('Versão salva localmente + no Drive ✓'); }
      catch (e) { toast('Salva localmente. Falha ao enviar ao Drive: ' + e.message, 6000); }
    } else {
      toast('Versão salva ✓ (conecte o Drive para guardar também na nuvem)');
    }
  }

  /* executa algo (exportar/imprimir) usando os dados de uma versão sem perder o rascunho atual */
  async function withSnapshot(rec, fn) {
    const prev = data;
    data = mergeData(defaultData(), clone(rec.data));
    try { refresh(); return await fn(); }
    finally { data = prev; refresh(); }
  }

  /* ---------------- Google Drive (nuvem do histórico) ----------------
     Usa Google Identity Services (sessão do navegador) + scope drive.file
     (só enxerga arquivos criados por este app). Pasta "Relatório Mestre". */
  const GCLIENT_KEY = 'relmestre:gclient';
  let gToken = null, gExp = 0, gFolder = null, gDriveOk = false;

  function driveStatus(cls, msg) {
    const el = $('#driveStatus');
    if (el) { el.className = 'hint ' + (cls || ''); el.textContent = msg; }
    ['btnDriveUp', 'btnDriveDown'].forEach((id) => { const b = document.getElementById(id); if (b) b.disabled = !gDriveOk; });
  }

  function loadGis() {
    return new Promise((res) => {
      if (window.google && google.accounts && google.accounts.oauth2) return res(true);
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = () => res(true);
      s.onerror = () => res(false);
      document.head.appendChild(s);
    });
  }

  async function driveConnect(quiet) {
    // Na abertura não tentamos login silencioso: sem concessão prévia o GIS always
    // chama error_callback e o painel aparecia vermelho "falha no login" à toa.
    if (quiet && !gToken) { driveStatus('', 'desconectado — clique em Conectar Drive'); return false; }
    const id = ($('#fGClient') && $('#fGClient').value.trim()) || localStorage.getItem(GCLIENT_KEY) || '';
    if (!id) {
      if (!quiet) toast('Cole o Client ID do Google antes de conectar.', 4500);
      driveStatus('err', 'sem Client ID');
      return false;
    }
    localStorage.setItem(GCLIENT_KEY, id);
    if (!(await loadGis())) { driveStatus('err', 'sem internet para o login'); return false; }
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok, msg, cls) => { if (settled) return; settled = true; gDriveOk = ok; driveStatus(cls, msg); resolve(ok); };
      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: id,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (r) => {
            if (r && r.access_token) {
              gToken = r.access_token;
              gExp = Date.now() + (Number(r.expires_in || 3600) - 60) * 1000;
              finish(true, 'conectado ✓', 'ok');
            } else finish(false, 'erro: ' + ((r && r.error) || '?'), 'err');
          },
          error_callback: (e) => finish(false,
            (e && e.type === 'popup_closed') ? 'login cancelado'
              : ((e && e.type) ? 'falha no login (' + e.type + ')' : 'falha no login'), 'err'),
        });
        client.requestAccessToken({ prompt: (gToken || quiet) ? '' : 'consent' });
      } catch (e) { finish(false, 'falha: ' + e.message, 'err'); }
    });
  }

  async function driveReq(url, opts, retry) {
    if (!gToken || Date.now() > gExp) {
      const ok = await driveConnect(false);
      if (!ok) throw new Error('Google Drive não conectado');
    }
    const r = await fetch(url, Object.assign({}, opts, {
      headers: Object.assign({}, (opts && opts.headers) || {}, { Authorization: 'Bearer ' + gToken }),
    }));
    if (r.status === 401 && !retry) return driveReq(url, opts, true);
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error('HTTP ' + r.status + (t ? ' — ' + t.slice(0, 140) : '')); }
    return r;
  }

  async function driveFolder() {
    if (gFolder) return gFolder;
    const q = encodeURIComponent("name='Relatório Mestre' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    const r = await driveReq('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)&spaces=drive');
    const j = await r.json();
    if (j.files && j.files.length) return (gFolder = j.files[0].id);
    const cr = await driveReq('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ name: 'Relatório Mestre', mimeType: 'application/vnd.google-apps.folder' }),
    });
    return (gFolder = (await cr.json()).id);
  }

  function snapFileName(rec) {
    const d = rec.data || {};
    const dia = String(d.dataRelatorio || '').replace(/-/g, '') || 'sdata';
    const centro = String(d.centro || '').replace(/[^\w-]/g, '') || 'SC';
    const ts = String(rec.salvoEm || '').replace(/[-:TZ]/g, '').slice(0, 12);
    return `${dia}_${centro}_${ts || 'v'}.json`;
  }

  async function driveUpload(rec) {
    const folder = await driveFolder();
    /* reenvio da mesma versão atualiza o arquivo em vez de duplicar */
    const qq = encodeURIComponent(`appProperties has { key='hid' and value='${rec.id}' } and '${folder}' in parents and trashed=false`);
    const lr = await driveReq('https://www.googleapis.com/drive/v3/files?q=' + qq + '&fields=files(id)');
    const lj = await lr.json();
    const existing = lj.files && lj.files[0] && lj.files[0].id;
    const meta = existing
      ? { name: snapFileName(rec), appProperties: { hid: rec.id, salvoEm: rec.salvoEm || '' } }
      : { name: snapFileName(rec), parents: [folder], appProperties: { hid: rec.id, salvoEm: rec.salvoEm || '' } };
    const b = 'rm' + Date.now();
    const body = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
      '\r\n--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(rec) +
      '\r\n--' + b + '--';
    const url = existing
      ? `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=multipart&fields=id`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
    const r = await driveReq(url, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + b },
      body,
    });
    return (await r.json()).id;
  }

  async function driveUploadAll() {
    const list = await histAll();
    if (!list.length) { toast('Nenhuma versão local para enviar.'); return; }
    const btn = $('#btnDriveUp');
    if (btn) btn.disabled = true;
    let n = 0;
    try {
      for (const rec of list) { await driveUpload(rec); n++; }
      toast(`${n} versão(ões) enviadas ao Drive ✓`);
    } catch (e) { toast('Falha no Drive: ' + e.message, 6000); }
    finally { if (btn) btn.disabled = !gDriveOk; }
  }

  async function driveDownloadAll() {
    const q = encodeURIComponent("'FOLDER' in parents and trashed=false".replace('FOLDER', (await driveFolder())));
    const r = await driveReq('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc');
    const files = (await r.json()).files || [];
    if (!files.length) { toast('Nenhuma versão no Drive ainda.'); return; }
    const existing = new Set((await histAll()).map((x) => x.id));
    let n = 0, dup = 0;
    for (const f of files) {
      try {
        const dr = await driveReq('https://www.googleapis.com/drive/v3/files/' + f.id + '?alt=media');
        const rec = await dr.json();
        if (!rec || !rec.id) continue;
        if (existing.has(rec.id)) { dup++; continue; }
        await histPut(rec);
        existing.add(rec.id);
        n++;
      } catch (e) { console.warn('falha ao baixar', f.name, e); }
    }
    await renderHist();
    toast(`Baixadas ${n} versão(ões) do Drive${dup ? ` (${dup} já estavam aqui)` : ''}.`, 4500);
  }

  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; };

  /* ---------------- fórmulas da planilha ---------------- */
  function evalFormula(expr, vals) {
    let pos = 0;
    const src = expr;
    const ws = () => { while (pos < src.length && src[pos] === ' ') pos++; };
    function primary() {
      ws();
      if (src[pos] === '(') { pos++; const v = add(); ws(); if (src[pos] === ')') pos++; return v; }
      const ref = /^[A-Z]+\d+/.exec(src.slice(pos));
      if (ref) {
        pos += ref[0].length;
        const v = vals[ref[0]];
        if (typeof v === 'number') return v;
        if (v === '' || v == null) return 0;
        const n = Number(v); return isFinite(n) ? n : 0;
      }
      const nm = /^\d+(\.\d+)?/.exec(src.slice(pos));
      if (nm) { pos += nm[0].length; return Number(nm[0]); }
      pos++; return 0;
    }
    function mul() {
      let v = primary();
      for (;;) { ws(); const o = src[pos]; if (o === '*' || o === '/') { pos++; const d = primary(); if (o === '*') v *= d; else v = d === 0 ? NaN : v / d; } else break; }
      return v;
    }
    function add() {
      let v = mul();
      for (;;) { ws(); const o = src[pos]; if (o === '+') { pos++; v += mul(); } else if (o === '-') { pos++; v -= mul(); } else break; }
      return v;
    }
    return add();
  }

  /* ---------------- mapa de valores do relatório ---------------- */
  function fmtDT(iso) {
    if (!iso) return '';
    const [d, t] = iso.split('T');
    if (!d) return '';
    const [y, m, dd] = d.split('-');
    return `${dd}/${m}/${y}${t ? ' ' + t.slice(0, 5) : ''}`;
  }
  const raw = (v) => (v === '' || v == null ? '' : String(v));

  const TEXT_MAP = {};
  TEXT_MAP.A1 = () => {
    const dt = data.dataRelatorio ? data.dataRelatorio.split('-') : null;
    const dmy = dt ? `${Number(dt[2])}/${Number(dt[1])}` : '—';
    const c = (data.centro || '').trim();
    return `中心操作日报表Relatório Diário de Operações do SC${c ? ' ' + c : ''}（${dmy}）`;
  };
  [4, 5, 6].forEach((r, i) => {
    TEXT_MAP['A' + r] = () => raw(data.turnos[i].nome);
    TEXT_MAP['B' + r] = () => raw(data.turnos[i].ent);
    TEXT_MAP['C' + r] = () => raw(data.turnos[i].sai);
    TEXT_MAP['D' + r] = () => raw(data.turnos[i].clt);
    TEXT_MAP['E' + r] = () => raw(data.turnos[i].desc);
    TEXT_MAP['F' + r] = () => raw(data.turnos[i].temp);
    TEXT_MAP['G' + r] = () => raw(data.turnos[i].dia);
    TEXT_MAP['H' + r] = () => raw(totalUtilizado(i));
  });
  ['D', 'E', 'F', 'G', 'H'].forEach((col) => {
    TEXT_MAP[col + '7'] = () => raw(col === 'H' ? totalUtilizadoGeral() :
      [0, 1, 2].reduce((s, i) => s + numeroCampo(data.turnos[i][{ D: 'clt', E: 'desc', F: 'temp', G: 'dia' }[col]]), 0));
  });
  TEXT_MAP.A10 = () => raw(data.eficiencia.recebida);
  TEXT_MAP.B10 = () => raw(data.eficiencia.expedida);
  TEXT_MAP.C10 = () => raw(transferencia());
  TEXT_MAP.D10 = () => raw(data.eficiencia.processada);
  TEXT_MAP.E10 = () => raw(produtividade());
  TEXT_MAP.F10 = () => raw(data.eficiencia.veiculos);
  TEXT_MAP.C14 = () => raw(data.problemas.naoChegou);
  TEXT_MAP.C15 = () => raw(data.problemas.avaria);
  TEXT_MAP.C16 = () => raw(data.problemas.triagem);
  TEXT_MAP.D13 = () => raw(data.obs);
  [0, 1, 2, 3, 4].forEach((i) => {
    const r = 19 + i;
    TEXT_MAP['A' + r] = () => raw(data.oss[i].os);
    TEXT_MAP['B' + r] = () => fmtDT(data.oss[i].planejado);
    TEXT_MAP['C' + r] = () => fmtDT(data.oss[i].real);
    TEXT_MAP['D' + r] = () => raw(data.oss[i].pacotes);
    TEXT_MAP['E' + r] = () => raw(data.oss[i].rota);
    TEXT_MAP['F' + r] = () => raw(data.oss[i].motivo);
  });

  function computeVals() {
    const vals = {};
    for (const ref of Object.keys(L.cells)) {
      const c = L.cells[ref];
      if (c.f) continue;
      const g = TEXT_MAP[ref];
      if (g) vals[ref] = numOrNull(g());
    }
    for (const ref of Object.keys(L.cells)) {
      const c = L.cells[ref];
      if (!c.f) continue;
      vals[ref] = evalFormula(c.f, vals);
    }
    return vals;
  }

  /* ---------------- construção do relatório ---------------- */
  const els = {};
  let reportEl = null;

  function cellSpan(ref) {
    const el = els[ref]; if (!el) return null;
    let s = el.querySelector('.celltext');
    if (!s) { el.innerHTML = ''; s = document.createElement('span'); s.className = 'celltext'; el.appendChild(s); }
    return s;
  }
  function setText(ref, txt) { const s = cellSpan(ref); if (s) s.textContent = txt; }

  function buildReport() {
    const rep = document.createElement('div');
    rep.className = 'report';
    rep.style.width = W + 'px';
    rep.style.height = H + 'px';

    const mergeAnchor = {};
    L.merges.forEach((m) => { mergeAnchor[colName(m.c1) + m.r1] = m; });

    for (const ref of Object.keys(L.cells)) {
      const cell = L.cells[ref];
      const st = L.styles[cell.s] || L.styles[0];
      const m = mergeAnchor[ref];
      const rc = refRC(ref);
      const b = m ? box(m.c1, m.r1, m.c2, m.r2) : box(rc.c, rc.r, rc.c, rc.r);
      const bd = m ? m.border : st.border;

      const el = document.createElement('div');
      el.className = 'cell ' + (st.align.wrap ? 'wrap' : 'nowrap');
      el.style.left = b.left + 'px';
      el.style.top = b.top + 'px';
      el.style.width = b.width + 'px';
      el.style.height = b.height + 'px';
      if (st.bg) el.style.background = st.bg;
      else el.style.background = '#ffffff';
      el.style.borderTop = bd.top || 'none';
      el.style.borderRight = bd.right || 'none';
      el.style.borderBottom = bd.bottom || 'none';
      el.style.borderLeft = bd.left || 'none';
      el.style.font = `${st.font.italic ? 'italic ' : ''}${st.font.bold ? 'bold ' : ''}${(st.font.size * 96 / 72).toFixed(2)}px ${FONT}`;
      el.style.color = st.font.color;
      el.style.justifyContent = st.align.h === 'center' ? 'center' : (st.align.h === 'right' ? 'flex-end' : 'flex-start');
      if (ref === 'E19') el.style.justifyContent = 'flex-start'; // "NÃO" alinhado à esquerda, como as demais linhas
      el.style.alignItems = st.align.v === 'top' ? 'flex-start' : (st.align.v === 'bottom' ? 'flex-end' : 'center');

      const span = document.createElement('span');
      span.className = 'celltext';
      span.textContent = cell.t || '';
      el.appendChild(span);

      rep.appendChild(el);
      els[ref] = el;
    }

    // Emblema no retângulo branco à direita da eficiência (G8:H11)
    const eb = box(7, 8, 8, 11);
    const emblema = document.createElement('img');
    emblema.src = 'emblema.png';
    emblema.alt = '';
    emblema.style.cssText = 'position:absolute;left:' + eb.left + 'px;top:' + eb.top +
      'px;width:' + eb.width + 'px;height:' + eb.height +
      'px;object-fit:contain;pointer-events:none;';
    rep.appendChild(emblema);

    reportEl = rep;
    $('#previewScale').appendChild(rep);
  }

  /* fotos nas células A25 (início) e E25 (fim) */
  function setPhoto(ref, foto) {
    const el = els[ref]; if (!el) return;
    el.innerHTML = '';
    if (!foto || !foto.src) { const s = document.createElement('span'); s.className = 'celltext'; el.appendChild(s); return; }
    const img = document.createElement('img');
    img.alt = '';
    img.onload = () => {
      const bw = el.clientWidth - 2, bh = el.clientHeight - 2;
      const k = Math.min(bw / (foto.w || img.naturalWidth), bh / (foto.h || img.naturalHeight));
      img.style.width = Math.floor((foto.w || img.naturalWidth) * k) + 'px';
      img.style.height = Math.floor((foto.h || img.naturalHeight) * k) + 'px';
    };
    img.src = foto.src;
    el.appendChild(img);
  }

  function refresh() {
    const vals = computeVals();
    for (const ref of Object.keys(TEXT_MAP)) setText(ref, TEXT_MAP[ref]());
    for (const ref of Object.keys(L.cells)) {
      const c = L.cells[ref];
      if (!c.f) continue;
      setText(ref, fmtNum(vals[ref]));
    }
    /* chips do formulário */
    const ct = $('#cTransf'), cp = $('#cProd');
    if (ct) ct.textContent = vals.C10 === undefined ? '—' : fmtNum(vals.C10) || '—';
    if (cp) cp.textContent = (vals.E10 === undefined || !isFinite(vals.E10)) ? '—' : fmtNum(vals.E10);
    document.querySelectorAll('[data-total]').forEach((el) => {
      const v = vals['H' + (4 + Number(el.dataset.total))];
      el.textContent = isFinite(v) ? fmtNum(v) : '—';
    });
    /* rótulos dinâmicos das abas */
    document.querySelectorAll('[data-turno-label]').forEach((el) => {
      const t = data.turnos[Number(el.dataset.turnoLabel)];
      el.textContent = (t && t.nome) ? t.nome : `Turno ${Number(el.dataset.turnoLabel) + 1}`;
    });
    document.querySelectorAll('[data-os-label]').forEach((el) => {
      const o = data.oss[Number(el.dataset.osLabel)];
      const code = (o && o.os) ? String(o.os) : '';
      el.textContent = code ? (code.length > 12 ? code.slice(0, 12) + '…' : code) : `OS ${Number(el.dataset.osLabel) + 1}`;
    });

    setPhoto('A25', data.fotos.inicio);
    setPhoto('E25', data.fotos.fim);
    fitPreview();
  }

  /* ---------------- formulário ---------------- */
  function buildForm() {
    /* turnos em abas */
    const tabBar = (kind, labels) => `
      <div class="tabs" data-tabs="${kind}">
        ${labels.map((l, i) => `<button type="button" class="tab-btn${i === 0 ? ' active' : ''}" data-tab="${i}" data-tabkind="${kind}">${l}</button>`).join('')}
      </div>`;

    $('#turnos').innerHTML =
      tabBar('turnos', data.turnos.map((_, i) => `<span data-turno-label="${i}">Turno ${i + 1}</span>`)) +
      data.turnos.map((_, i) => `
        <div class="tab-panel${i === 0 ? ' active' : ''}" data-panel="${i}" data-kind="turnos">
          <div class="turno">
            <div class="tt"><b>Turno ${i + 1}</b><span class="total-line">Total: <b data-total="${i}">0</b></span></div>
            <label>Nome do turno
              <input type="text" data-key="turnos.${i}.nome" placeholder="T${i + 1}" maxlength="6">
            </label>
            <div class="grid2">
              <label>Entrada <input type="time" data-key="turnos.${i}.ent"></label>
              <label>Saída <input type="time" data-key="turnos.${i}.sai"></label>
              <label>CLT em serviço <input type="number" min="0" step="1" data-key="turnos.${i}.clt"></label>
              <label>CLT em descanso <input type="number" min="0" step="1" data-key="turnos.${i}.desc"></label>
              <label>Temporários <input type="number" min="0" step="1" data-key="turnos.${i}.temp"></label>
              <label>Diaristas <input type="number" min="0" step="1" data-key="turnos.${i}.dia"></label>
            </div>
          </div>
        </div>`).join('');

    /* ordens de serviço em abas */
    $('#oss').innerHTML =
      tabBar('oss', data.oss.map((_, i) => `<span data-os-label="${i}">OS ${i + 1}</span>`)) +
      data.oss.map((_, i) => `
        <div class="tab-panel${i === 0 ? ' active' : ''}" data-panel="${i}" data-kind="oss">
          <div class="os-row">
            <div class="tt"><span>Ordem de Serviço ${i + 1}</span></div>
            <label>OS <input type="text" data-key="oss.${i}.os" placeholder="DBGX..."></label>
            <div class="grid2">
              <label>Horário planejado <input type="datetime-local" data-key="oss.${i}.planejado"></label>
              <label>Horário real <input type="datetime-local" data-key="oss.${i}.real"></label>
              <label>Qtd. pacotes <input type="number" min="0" step="1" data-key="oss.${i}.pacotes"></label>
              <label>Rota com backlog
                <select data-key="oss.${i}.rota">
                  <option value="">—</option><option>SIM</option><option>NÃO</option>
                </select>
              </label>
            </div>
            <label class="full">Motivo do backlog <input type="text" data-key="oss.${i}.motivo"></label>
          </div>
        </div>`).join('');

    /* fotos */
    const fotoBox = (which, titulo) => `
      <div class="foto-box" data-fotobox="${which}">
        <div class="ftitle">${titulo}</div>
        <img class="thumb" alt="">
        <div class="status"></div>
        <div class="fbtns">
          <label class="btn">📷 Tirar foto
            <input type="file" accept="image/*" capture="environment" data-foto="${which}">
          </label>
          <label class="btn">📁 Enviar arquivo
            <input type="file" accept="image/*" data-foto="${which}">
          </label>
        </div>
        <div class="meta"></div>
        <div class="fbtns"><button type="button" class="btn danger" data-clearfoto="${which}">Remover</button></div>
      </div>`;
    $('#fotos').innerHTML = fotoBox('inicio', '📷 Início da operação') + fotoBox('fim', '📷 Fim da operação');

    populate();
    fotoUI();
  }

  function populate() {
    document.querySelectorAll('[data-key]').forEach((el) => {
      const v = getPath(data, el.dataset.key);
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v == null ? '' : v;
    });
  }

  function fotoUI() {
    ['inicio', 'fim'].forEach((which) => {
      const box = document.querySelector(`[data-fotobox="${which}"]`);
      if (!box) return;
      const f = data.fotos[which];
      box.classList.toggle('has-img', !!(f && f.src));
      box.querySelector('.thumb').src = (f && f.src) || '';
      box.querySelector('.meta').textContent = (f && f.meta) || '';
      box.querySelector('[data-clearfoto]').style.display = f ? '' : 'none';
    });
  }

  /* ---------------- logo (para o carimbo) ---------------- */
  let logoAR = 200 / 40.3945;
  let logoP = null;
  function logoImage() {
    if (logoP) return logoP;
    logoP = new Promise((resolve) => {
      const src = window.LOGO_DATA_URL;
      if (!src) return resolve(null);
      logoAR = 1; /* emblema quadrado */
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
    return logoP;
  }

  /* ---------------- geolocalização ---------------- */
  function getCoords() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      const done = false;
      const timer = setTimeout(() => { if (!done) resolve(null); }, 8000);
      navigator.geolocation.getCurrentPosition(
        (p) => { clearTimeout(timer); resolve({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }); },
        () => { clearTimeout(timer); resolve(null); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  async function reverseGeocode(lat, lon) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=pt-BR`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return null;
      const j = await r.json();
      const a = j.address || {};
      const parts = [a.road || a.neighbourhood || a.suburb || a.hamlet, a.city || a.town || a.village || a.county, a.state].filter(Boolean);
      return parts.length ? parts.join(', ') : (j.display_name || null);
    } catch (e) { return null; }
  }

  /* mini-mapa (tiles OSM) com fallback para cartão de coordenadas */
  function loadTile(url) {
    return new Promise((resolve, reject) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      const t = setTimeout(() => reject(new Error('timeout')), 5000);
      im.onload = () => { clearTimeout(t); resolve(im); };
      im.onerror = () => { clearTimeout(t); reject(new Error('tile')); };
      im.src = url;
    });
  }
  function mapCanvas(lat, lon) {
    return new Promise((resolve) => {
      const z = 16, n = Math.pow(2, z);
      const xf = ((lon + 180) / 360) * n;
      const rad = (lat * Math.PI) / 180;
      const yf = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
      const x0 = Math.floor(xf) - 1, y0 = Math.floor(yf) - 1;
      const urls = [];
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const x = ((x0 + dx) % n + n) % n;
        const y = y0 + dy;
        if (y < 0 || y >= n) return resolve(null);
        urls.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
      }
      Promise.all(urls.map(loadTile)).then((tiles) => {
        const T = 256;
        const cv = document.createElement('canvas'); cv.width = T * 2; cv.height = T * 2;
        const cx = cv.getContext('2d');
        tiles.forEach((t, i) => cx.drawImage(t, (i % 2) * T, Math.floor(i / 2) * T));
        /* ponto central (pixel do alvo dentro do 2x2) */
        const px = (xf - x0) * T, py = (yf - y0) * T;
        resolve({ canvas: cv, px, py });
      }).catch(() => resolve(null));
    });
  }

  /* ---------------- carimbo estilo Timemark ---------------- */
  function dText(ctx, str, x, y, size, weight, color, align) {
    ctx.font = `${weight || '400'} ${size}px ${FONT}`;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,.7)';
    ctx.shadowBlur = size * 0.4;
    ctx.shadowOffsetY = size * 0.1;
    ctx.fillStyle = color || '#ffffff';
    ctx.fillText(str, x, y);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function wrapLines(ctx, text, maxW, font) {
    ctx.font = font;
    const words = String(text).split(/\s+/);
    const lines = []; let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width <= maxW || !cur) cur = t;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 4);
  }
  function dateLong(d) {
    const wd = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()];
    const mo = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'][d.getMonth()];
    let s = `${wd}, ${pad(d.getDate())} ${mo} ${d.getFullYear()}`;
    try { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; if (tz.indexOf('America/') === 0) s += ' BRT'; } catch (e) {}
    return s;
  }
  function makeCode(now) {
    const base = `${now.getTime()}|${data.centro || ''}|${data.responsavel || ''}`;
    let h = 2166136261;
    for (let i = 0; i < base.length; i++) { h ^= base.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ('RM' + (h >>> 0).toString(16).toUpperCase() + now.getTime().toString(16).toUpperCase()).slice(0, 14);
  }

  async function buildStampInfo() {
    const now = new Date();
    const info = {
      now,
      time: pad(now.getHours()) + ':' + pad(now.getMinutes()),
      date: dateLong(now),
      code: makeCode(now),
      address: (data.localCarimbo || '').trim(),
      coords: null,
      map: null,
    };
    if (data.usarGps && (data.carimbar)) {
      let c = data.coords;
      if (!c) { c = await getCoords(); if (c) { data.coords = c; } }
      if (c) {
        info.coords = c;
        if (!info.address && data.responsavel !== undefined) {
          const addr = await reverseGeocode(c.lat, c.lon);
          if (addr) { info.address = addr; data.localCarimbo = addr; const inp = $('#fLocal'); if (inp) inp.value = addr; }
        }
        if (data.usarMapa) info.map = await mapCanvas(c.lat, c.lon);
      }
    } else if (data.usarGps) {
      info.coords = data.coords;
    }
    return info;
  }

  function drawStamp(ctx, Wpx, Hpx, info, logo) {
    const u = Wpx / 1600;
    const m = 30 * u;
    const F = (px, w) => `${w} ${px}px ${FONT}`;

    /* ---- mini-mapa (canto superior esquerdo) ---- */
    if (info.map) {
      const mw = 210 * u, mh = 150 * u, frame = 4 * u;
      const sx = Math.max(0, Math.min(info.map.canvas.width - (mw / (mh)) * 0 + 0, info.map.canvas.width));
      /* recorta mantendo a proporção da caixa */
      const srcW = info.map.canvas.width;
      const srcH = Math.round(srcW * (mh / mw));
      const cy = Math.max(0, Math.min(info.map.canvas.height - srcH, info.map.py - srcH / 2));
      const cx0 = Math.max(0, Math.min(srcW - srcW, 0));
      ctx.save();
      roundRect(ctx, m, m, mw + frame * 2, mh + frame * 2, 10 * u);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8 * u; ctx.shadowOffsetY = 2 * u; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.save();
      roundRect(ctx, m + frame, m + frame, mw, mh, 7 * u);
      ctx.clip();
      ctx.drawImage(info.map.canvas, cx0, cy, srcW, srcH, m + frame, m + frame, mw, mh);
      /* pino */
      const px = m + frame + (info.map.px / srcW) * mw;
      const py = m + frame + ((info.map.py - cy) / srcH) * mh;
      ctx.beginPath(); ctx.arc(px, py - 9 * u, 8 * u, 0, Math.PI * 2);
      ctx.fillStyle = '#E60000'; ctx.fill();
      ctx.lineWidth = 3 * u; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - 5 * u, py - 4 * u); ctx.lineTo(px + 5 * u, py - 4 * u); ctx.lineTo(px, py + 8 * u); ctx.closePath();
      ctx.fillStyle = '#E60000'; ctx.fill();
      ctx.restore();
      ctx.font = F(9 * u, '400'); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillText('© OpenStreetMap', m + mw - 2 * u, m + mh - 2 * u);
      ctx.restore();
    } else if (info.coords) {
      const txt = `${info.coords.lat.toFixed(6)}, ${info.coords.lon.toFixed(6)}`;
      ctx.font = F(24 * u, '600');
      const w = ctx.measureText(txt).width + 40 * u;
      roundRect(ctx, m, m, w, 46 * u, 10 * u);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
      dText(ctx, '📍 ' + txt, m + 18 * u, m + 8 * u, 24 * u, '600', '#fff');
    }

    /* ---- marca d'água (canto superior direito) ---- */
    if (logo) {
      const lh = 36 * u, lw = lh * logoAR;
      ctx.save();
      ctx.shadowColor = 'rgba(255,255,255,.9)'; ctx.shadowBlur = 6 * u;
      ctx.drawImage(logo, Wpx - m - lw, m, lw, lh);
      ctx.restore();
      dText(ctx, 'Foto 100% Real', Wpx - m, m + 34 * u, 20 * u, '700', '#f2f2f2', 'right');
    } else {
      dText(ctx, 'Foto 100% Real', Wpx - m, m, 22 * u, '700', '#ffd400', 'right');
    }

    /* ---- código vertical (borda direita) ---- */
    ctx.save();
    ctx.translate(Wpx - 8 * u, 300 * u);
    ctx.rotate(Math.PI / 2);
    dText(ctx, `© ${info.code}  Verificado pelo Relatório Mestre`, 0, 0, 15 * u, '600', '#ffffff');
    ctx.restore();

    /* ---- bloco inferior esquerdo: selo + informações ---- */
    const infoFont = 32 * u;
    const addrLines = info.address ? wrapLines(ctx, info.address, Wpx - 2 * m, F(infoFont, '400')) : [];
    const coordLine = info.coords ? `${info.coords.lat.toFixed(6)}, ${info.coords.lon.toFixed(6)}` : '';
    const nomeLine = (data.responsavel || '').trim() ? `Nome: ${data.responsavel.trim()}` : '';
    const verified = '✓ Tempo verificado pelo Relatório Mestre';

    /* métricas do selo */
    const chipFs = 42 * u, timeFs = 64 * u, logoH = 44 * u;
    const chipTxt = 'SC ' + ((data.centro || '').trim() || '—');
    ctx.font = F(chipFs, '700');
    const chipW = ctx.measureText(chipTxt).width + 30 * u;
    ctx.font = F(timeFs, '700');
    const timeW = ctx.measureText(info.time).width;
    const gap = 18 * u, padB = 16 * u, badgeH = 96 * u;
    const logoW = logo ? logoH * logoAR : 0;
    const badgeW = padB + chipW + gap + timeW + (logoW ? gap + logoW : 0) + padB;

    const rows = [];
    rows.push({ t: info.date, fs: 34 * u, w: '700', lh: 44 * u });
    addrLines.forEach((l) => rows.push({ t: l, fs: infoFont, w: '400', lh: 40 * u }));
    if (coordLine) rows.push({ t: coordLine, fs: 26 * u, w: '400', lh: 34 * u });
    if (nomeLine) rows.push({ t: nomeLine, fs: 30 * u, w: '700', lh: 38 * u });
    rows.push({ t: verified, fs: 22 * u, w: '400', lh: 32 * u, color: 'rgba(255,255,255,.92)' });

    let blockH = badgeH + 14 * u;
    rows.forEach((r) => { blockH += r.lh; });

    let y = Hpx - m - blockH;
    /* selo */
    ctx.save();
    roundRect(ctx, m, y, badgeW, badgeH, 16 * u);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 12 * u; ctx.shadowOffsetY = 3 * u;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    /* chip amarelo */
    const chipX = m + padB, chipY = y + (badgeH - 56 * u) / 2;
    roundRect(ctx, chipX, chipY, chipW, 56 * u, 10 * u);
    ctx.fillStyle = '#FFC000'; ctx.fill();
    ctx.font = F(chipFs, '700'); ctx.fillStyle = '#111111';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(chipTxt, chipX + chipW / 2, chipY + 29 * u);
    /* hora */
    const timeX = chipX + chipW + gap;
    ctx.font = F(timeFs, '700'); ctx.fillStyle = '#111111';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(info.time, timeX, y + badgeH / 2 + 2 * u);
    /* logo dentro do selo */
    if (logo) ctx.drawImage(logo, timeX + timeW + gap, y + (badgeH - logoH) / 2, logoW, logoH);
    ctx.restore();

    /* textos */
    y += badgeH + 14 * u;
    rows.forEach((r) => {
      dText(ctx, r.t, m, y + 2 * u, r.fs, r.w, r.color || '#ffffff');
      y += r.lh;
    });
  }

  /* ---------------- processamento da foto ---------------- */
  function readFile(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(new Error('falha ao ler o arquivo'));
      fr.readAsDataURL(file);
    });
  }
  function loadImage(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('formato de imagem não suportado pelo navegador'));
      im.src = src;
    });
  }

  async function processPhoto(file) {
    const src = await readFile(file);
    const img = await loadImage(src);
    const MAX = 2000;
    const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
    const k = Math.min(1, MAX / Math.max(nw, nh));
    const w = Math.round(nw * k), h = Math.round(nh * k);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    let meta = 'Sem carimbo';
    if (data.carimbar) {
      const [logo, info] = await Promise.all([logoImage(), buildStampInfo()]);
      drawStamp(ctx, w, h, info, logo);
      const bits = [info.date + ' ' + info.time, info.address].filter(Boolean);
      if (info.coords) bits.push(`${info.coords.lat.toFixed(5)}, ${info.coords.lon.toFixed(5)}`);
      meta = bits.join(' · ');
      save();
    }
    return { src: cv.toDataURL('image/jpeg', 0.88), w, h, meta };
  }

  async function handleFoto(file, which, box) {
    const st = box.querySelector('.status');
    st.textContent = 'Processando foto…';
    box.querySelector('label.btn').classList.add('busy');
    try {
      const out = await processPhoto(file);
      data.fotos[which] = out;
      save(); refresh(); fotoUI();
      st.textContent = 'Foto carimbada ✓';
      setTimeout(() => { if (st.textContent.indexOf('✓') >= 0) st.textContent = ''; }, 4000);
    } catch (err) {
      console.error(err);
      st.textContent = 'Erro: ' + (err && err.message ? err.message : err);
      toast('Não foi possível processar a foto.', 4500);
    } finally {
      box.querySelector('label.btn').classList.remove('busy');
    }
  }

  /* ---------------- exportação PNG (alta resolução) ---------------- */
  async function renderPNG(scale) {
    const clone = reportEl.cloneNode(true);
    clone.style.zoom = '';
    const holder = document.createElement('div');
    holder.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;background:#ffffff;z-index:-9999;`;
    holder.appendChild(clone);
    document.body.appendChild(holder);
    try {
      const canvas = await html2canvas(clone, {
        scale: 1, backgroundColor: '#ffffff', useCORS: true, logging: false,
        width: W, height: H, windowWidth: Math.max(W, 1400), windowHeight: Math.max(H, 1200),
        scrollX: 0, scrollY: 0,
      });
      if (scale > 1) {
        const big = document.createElement('canvas');
        big.width = Math.round(W * scale); big.height = Math.round(H * scale);
        const cx = big.getContext('2d');
        cx.imageSmoothingEnabled = true;
        cx.imageSmoothingQuality = 'high';
        cx.drawImage(canvas, 0, 0, big.width, big.height);
        return big;
      }
      return canvas;
    } finally { holder.remove(); }
  }

  async function exportarPDF() {
    const btn = $('#btnPdf');
    if (btn) btn.disabled = true;
    toast('Gerando PDF A4 paisagem…', 30000);
    try {
      const canvas = await renderPNG(2);
      const img = canvas.toDataURL('image/jpeg', 0.92);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
      const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
      const k = Math.min((pw - 24) / canvas.width, (ph - 24) / canvas.height);
      const w = canvas.width * k, h = canvas.height * k;
      pdf.addImage(img, 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h);
      const blob = pdf.output('blob');
      const nome = `Relatorio-Operacoes-SC-${(data.dataRelatorio || 'sem-data').replace(/-/g, '')}.pdf`;
      if (window.RMCloud) await RMCloud.share(blob, nome, 'application/pdf');
      else pdf.save(nome);
      toast('PDF A4 paisagem pronto ✓');
    } catch (e) { console.error(e); toast('Falha no PDF: ' + e.message, 5000); }
    finally { if (btn) btn.disabled = false; }
  }

  async function exportPNG() {
    const btn = $('#btnPng');
    const scale = Number($('#escala').value) || 3;
    btn.disabled = true;
    toast(`Gerando PNG em ${scale}x…`, 60000);
    try {
      const canvas = await renderPNG(scale);
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const nome = `Relatorio-Operacoes-SC-${(data.dataRelatorio || 'sem-data').replace(/-/g, '')}@${scale}x.png`;
      if (blob && window.RMCloud) await RMCloud.share(blob, nome, 'image/png');
      else if (blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = nome; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      } else {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png'); a.download = nome; a.click();
      }
      toast(`PNG gerado: ${canvas.width}×${canvas.height} px`);
    } catch (e) {
      console.error(e);
      toast('Falha ao gerar o PNG: ' + e.message, 5000);
    } finally { btn.disabled = false; }
  }

  /* ---------------- impressão ---------------- */
  function fitPrint() {
    const availW = ((297 - 16) * 96) / 25.4;
    const availH = ((210 - 16) * 96) / 25.4;
    const z = Math.min(availW / W, availH / H, 1);
    if (reportEl) reportEl.style.zoom = z;
  }

  /* ---------------- pré-visualização ---------------- */
  function fitPreview() {
    const wrap = $('#previewWrap'), inner = $('#previewInner'), sc = $('#previewScale');
    if (!wrap || !inner || !sc) return;
    const availW = wrap.clientWidth - 28;
    const k = Math.max(0.1, Math.min(1, availW / W));
    inner.style.width = Math.round(W * k) + 'px';
    inner.style.height = Math.round(H * k) + 'px';
    sc.style.transform = `scale(${k})`;
    const note = $('#previewSize');
    if (note) note.textContent = `${Math.round(W)}×${Math.round(H)} px · zoom ${Math.round(k * 100)}%`;
  }

  /* ---------------- acessibilidade: Libras + áudio + vídeo ----------------
     VLibras: POST /translate (texto -> glosa) -> POST /video -> status -> arquivo.
     Narração: Web Speech API (pt-BR / zh-CN). Compartilhamento: Web Share API. */
  const VLURL_KEY = 'relmestre:vlibras:url';
  const VLTOKEN_KEY = 'relmestre:vlibras:token';
  let videoBlob = null, videoName = '', audioBlob = null, audioName = '';

  const nz = (v) => (v === '' || v == null ? '0' : String(v));
  function reportTextPT() {
    const d = data, e = d.eficiencia, p = d.problemas;
    const turnos = d.turnos.filter((t) => t.nome || t.ent || t.sai || nz(t.clt) !== '0').map((t) =>
      `Turno ${t.nome || 'sem nome'}: entrada ${t.ent || 'não informada'}, saída ${t.sai || 'não informada'}, ` +
      `CLT em serviço ${nz(t.clt)}, CLT em descanso ${nz(t.desc)}, temporários ${nz(t.temp)}, diaristas ${nz(t.dia)}, ` +
      `total ${(Number(t.clt) || 0) + (Number(t.temp) || 0) + (Number(t.dia) || 0)}.`).join(' ');
    const oss = d.oss.filter((o) => o.os).map((o) =>
      `Ordem de serviço ${o.os}, planejado ${fmtDT(o.planejado) || 'não informado'}, real ${fmtDT(o.real) || 'não informado'}, ` +
      `${nz(o.pacotes)} pacotes, rota com backlog ${o.rota || 'não informado'}${o.motivo ? ', motivo: ' + o.motivo : ''}.`).join(' ');
    return `Relatório Diário de Operações do SC, centro ${d.centro || 'não informado'}, data ${fmtDia(d.dataRelatorio)}. ` +
      `${turnos} Quantidade recebida ${nz(e.recebida)}, expedida ${nz(e.expedida)}, processada ${nz(e.processada)}, ` +
      `veículos expedidos ${nz(e.veiculos)}. Problemas: expedido e não chegou ${nz(p.naoChegou)}, avaria ${nz(p.avaria)}, ` +
      `erro de triagem ${nz(p.triagem)}. ${d.obs ? 'Observação: ' + d.obs + '. ' : ''}${oss}`;
  }
  function reportTextZH() {
    const d = data, e = d.eficiencia, p = d.problemas;
    const turnos = d.turnos.filter((t) => t.nome || t.ent || t.sai || nz(t.clt) !== '0').map((t) =>
      `${t.nome || '班次'}: 上班 ${t.ent || '未填写'}, 下班 ${t.sai || '未填写'}, CLT上班 ${nz(t.clt)}, CLT休息 ${nz(t.desc)}, 临时工 ${nz(t.temp)}, 日结工 ${nz(t.dia)}。`).join(' ');
    const oss = d.oss.filter((o) => o.os).map((o) =>
      `任务单 ${o.os}, 计划 ${fmtDT(o.planejado) || '未填写'}, 实际 ${fmtDT(o.real) || '未填写'}, ${nz(o.pacotes)} 件, 积压路线 ${o.rota || '未填写'}。`).join(' ');
    return `中心操作日报表${d.centro || ''}, 日期 ${fmtDia(d.dataRelatorio)}。${turnos} 到件量 ${nz(e.recebida)}, 发件量 ${nz(e.expedida)}, ` +
      `操作量 ${nz(e.processada)}, 发运车辆 ${nz(e.veiculos)}。问题件: 有发未到 ${nz(p.naoChegou)}, 破损 ${nz(p.avaria)}, 分拣错误 ${nz(p.triagem)}。${oss}`;
  }

  const vstatus = (msg) => { const el = $('#videoStatus'); if (el) el.textContent = msg; };

  function falar(texto, lang) {
    if (!('speechSynthesis' in window)) { toast('Este navegador não tem narração (Web Speech).'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = lang; u.rate = 1; u.pitch = 1;
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang.slice(0, 2)));
    if (voices.length) u.voice = voices[0];
    u.onend = () => vstatus(' Narração concluída (' + lang + ').');
    u.onerror = () => vstatus(' Não foi possível narrar neste navegador/idioma.');
    speechSynthesis.speak(u);
    vstatus(' Narrando em ' + lang + '…');
  }

  function ouvirRelatorio() {
    const lang = data.acessibilidade.idioma;
    if (lang === 'ambos') { falar(reportTextPT(), 'pt-BR'); setTimeout(() => falar(reportTextZH(), 'zh-CN'), 500); }
    else if (lang === 'zh-CN') falar(reportTextZH(), 'zh-CN');
    else falar(reportTextPT(), 'pt-BR');
  }

  async function vlibrasReq(path, opts) {
    const base = ($('#fVlibrasUrl').value || 'https://traducao2.vlibras.gov.br').replace(/\/+$/, '');
    const tok = ($('#fVlibrasToken').value || '').trim();
    const headers = Object.assign({}, (opts && opts.headers) || {});
    if (tok) headers.Authorization = 'Bearer ' + tok;
    const r = await fetch(base + path, Object.assign({}, opts, { headers }));
    if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + (await r.text().catch(() => '')).slice(0, 140));
    return r;
  }

  async function gerarVideo() {
    const btn = $('#btnVideo');
    btn.disabled = true;
    try {
      vstatus('1/4 Traduzindo o relatório para glosa em Libras…');
      const r1 = await vlibrasReq('/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reportTextPT() }),
      });
      let glosa = (await r1.text()).trim();
      try { const j = JSON.parse(glosa); glosa = j.glosa || j.text || j.result || glosa; } catch (e) { /* texto puro */ }
      if (!glosa) throw new Error('A API não retornou glosa.');
      vstatus('2/4 Glosa: ' + glosa.slice(0, 140) + (glosa.length > 140 ? '…' : '') + ' — solicitando vídeo…');
      const r2 = await vlibrasReq('/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ gloss: glosa }),
      });
      const j2 = await r2.json().catch(() => ({}));
      const id = j2.id || j2.videoId || j2.video_id || j2._id;
      if (!id) throw new Error('A API não retornou o id do vídeo: ' + JSON.stringify(j2).slice(0, 140));
      vstatus('3/4 Gerando vídeo (id ' + id + ')…');
      let pronto = false;
      for (let i = 0; i < 90; i++) {
        await new Promise((res) => setTimeout(res, 2000));
        const st = await (await vlibrasReq('/video/status/' + encodeURIComponent(id))).text();
        let s; try { s = JSON.parse(st); } catch (e) { s = { status: st }; }
        const status = String(s.status || s.state || '').toLowerCase();
        if (['done', 'ready', 'completed', 'complete', 'concluido', 'success', 'available', 'pronto'].indexOf(status) >= 0) { pronto = true; break; }
        if (['error', 'failed', 'erro'].indexOf(status) >= 0) throw new Error('Falha na geração: ' + JSON.stringify(s).slice(0, 140));
        vstatus('3/4 Gerando vídeo… ' + status + ' (' + ((i + 1) * 2) + 's)');
      }
      if (!pronto) throw new Error('Tempo limite (180s) na geração do vídeo.');
      vstatus('4/4 Baixando vídeo…');
      const rv = await vlibrasReq('/video/' + encodeURIComponent(id));
      videoBlob = await rv.blob();
      videoName = 'Relatorio-Libras-' + (data.dataRelatorio || 'sem-data').replace(/-/g, '') +
        (videoBlob.type.indexOf('mp4') >= 0 ? '.mp4' : '.webm');
      const vp = $('#videoPreview');
      if (vp) { vp.src = URL.createObjectURL(videoBlob); vp.style.display = 'block'; }
      $('#btnShare').disabled = false;
      vstatus(' Vídeo pronto ✓ ' + videoName + ' (' + Math.round(videoBlob.size / 1024) + ' KB).');
      toast('Vídeo em Libras gerado ✓');
    } catch (e) {
      console.error(e);
      vstatus(' Erro: ' + e.message);
      toast('Não foi possível gerar o vídeo: ' + e.message, 7000);
    } finally { btn.disabled = false; }
  }

  async function gerarAudio() {
    const btn = $('#btnAudioFile');
    if (btn) btn.disabled = true;
    try {
      const lang = data.acessibilidade.idioma;
      const lista = lang === 'ambos'
        ? [['pt-BR', reportTextPT()], ['zh-CN', reportTextZH()]]
        : (lang === 'zh-CN' ? [['zh-CN', reportTextZH()]] : [['pt-BR', reportTextPT()]]);
      const partes = [];
      for (const [tl, txt] of lista) {
        vstatus('Gerando áudio em ' + tl + '…');
        if (window.RMCloud) {
          /* Cloud TTS funciona no Pages e no APK (sem proxy local) */
          partes.push(await RMCloud.tts(txt, tl));
        } else {
          const r = await fetch('/tts?tl=' + encodeURIComponent(tl) + '&text=' + encodeURIComponent(txt));
          if (!r.ok) throw new Error('TTS HTTP ' + r.status);
          partes.push(await r.blob());
        }
      }
      audioBlob = RMCloud.wav(partes);
      audioName = 'Relatorio-' + (lang === 'ambos' ? 'pt-zh' : lang) + '-' +
        (data.dataRelatorio || 'sem-data').replace(/-/g, '') + '.wav';
      const ap = $('#audioPreview');
      if (ap) { ap.src = URL.createObjectURL(audioBlob); ap.style.display = 'block'; }
      const sh = $('#btnShare'); if (sh) sh.disabled = false;
      vstatus(' Áudio pronto ✓ ' + audioName + ' (' + Math.round(audioBlob.size / 1024) + ' KB).');
    } catch (e) {
      console.error(e);
      const lang = data.acessibilidade.idioma;
      const texto = lang === 'zh-CN' ? reportTextZH() : reportTextPT();
      if ('speechSynthesis' in window) {
        falar(texto, lang === 'ambos' ? 'pt-BR' : (lang === 'zh-CN' ? 'zh-CN' : 'pt-BR'));
        vstatus(' Narrando com a voz do navegador. Para gerar o arquivo WAV, verifique a conexão com o backend J&T.');
        return;
      }
      vstatus(' Erro no áudio: ' + e.message);
      toast('Não foi possível gerar o áudio: ' + e.message, 6000);
    } finally { if (btn) btn.disabled = false; }
  }

  /* vídeo com o relatório em imagem + narração (alternativa sem Libras) */
  async function gerarVideoNarrado() {
    const btn = $('#btnVideoNarrado');
    if (btn) btn.disabled = true;
    try {
      if (!audioBlob) await gerarAudio();
      if (!audioBlob) throw new Error('Gere o áudio primeiro.');
      if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error('Este navegador não suporta gravação de vídeo (MediaRecorder).');
      vstatus('Renderizando o relatório…');
      const cl = reportEl.cloneNode(true);
      const holder = document.createElement('div');
      holder.style.cssText = `position:absolute;left:-30000px;top:0;width:${W}px;height:${H}px;background:#fff;`;
      holder.appendChild(cl); document.body.appendChild(holder);
      const shot = await html2canvas(cl, { scale: 1, backgroundColor: '#fff', width: W, height: H, windowWidth: W, windowHeight: H, logging: false });
      holder.remove();

      const cv = document.createElement('canvas');
      cv.width = 1280;
      cv.height = Math.round((1280 * shot.height) / shot.width);
      const cx = cv.getContext('2d');
      cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.drawImage(shot, 0, 0, cv.width, cv.height);

      const stream = cv.captureStream(15);
      const ac = new AudioContext();
      const au = new Audio(URL.createObjectURL(audioBlob));
      await new Promise((res) => {
        if (isFinite(au.duration) && au.duration > 0) return res();
        au.onloadedmetadata = res;
        setTimeout(res, 3000);
      });
      const dur = (isFinite(au.duration) && au.duration > 0) ? Math.min(au.duration, 120) : 20;
      const fonte = ac.createMediaElementSource(au);
      const destino = ac.createMediaStreamDestination();
      fonte.connect(destino);
      fonte.connect(ac.destination);
      stream.addTrack(destino.stream.getAudioTracks()[0]);

      const mime = ['video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const partes = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) partes.push(e.data); };
      const pronto = new Promise((res) => { rec.onstop = res; });
      vstatus('Gravando vídeo narrado…');
      rec.start();
      await ac.resume();
      try { await au.play(); }
      catch (e) { throw new Error('O navegador bloqueou o áudio. Clique novamente no botão com um clique real.'); }
      await new Promise((res) => {
        let fim = false;
        const done = () => { if (!fim) { fim = true; res(); } };
        au.onended = done;
        setTimeout(done, (dur + 2) * 1000);
      });
      rec.stop();
      await pronto;
      await ac.close();
      videoBlob = new Blob(partes, { type: 'video/webm' });
      videoName = 'Relatorio-Narrado-' + (data.dataRelatorio || 'sem-data').replace(/-/g, '') + '.webm';
      const vp = $('#videoPreview');
      if (vp) { vp.src = URL.createObjectURL(videoBlob); vp.style.display = 'block'; }
      const sh = $('#btnShare'); if (sh) sh.disabled = false;
      vstatus(' Vídeo narrado pronto ✓ ' + videoName + ' (sem Libras).');
    } catch (e) {
      console.error(e);
      vstatus(' Erro no vídeo: ' + e.message);
      toast('Não foi possível gerar o vídeo: ' + e.message, 6000);
    } finally { if (btn) btn.disabled = false; }
  }

  function baixarBlob(blob, nome) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function compartilhar() {
    const titulo = 'Relatório Diário de Operações do SC';
    const texto = `${titulo} — SC ${data.centro || ''} — ${fmtDia(data.dataRelatorio)}`;
    /* prioriza vídeo → áudio → PNG (arquivo real, nunca .bin) */
    if (videoBlob) {
      const r = window.RMCloud
        ? await RMCloud.share(videoBlob, videoName, videoBlob.type || 'video/webm')
        : (baixarBlob(videoBlob, videoName), 'baixado');
      vstatus(r === 'compartilhado' ? ' Vídeo compartilhado ✓' : ' Vídeo salvo para compartilhar.');
      return;
    }
    if (audioBlob) {
      const r = window.RMCloud
        ? await RMCloud.share(audioBlob, audioName, 'audio/mpeg')
        : (baixarBlob(audioBlob, audioName), 'baixado');
      vstatus(r === 'compartilhado' ? ' Áudio compartilhado ✓' : ' Áudio salvo para compartilhar.');
      return;
    }
    toast('Gerando PNG para compartilhar…');
    try {
      const scale = Number($('#escala').value) || 2;
      const canvas = await renderPNG(Math.min(scale, 2));
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const nome = `Relatorio-Operacoes-SC-${(data.dataRelatorio || 'sem-data').replace(/-/g, '')}.png`;
      if (blob && window.RMCloud) {
        const r = await RMCloud.share(blob, nome, 'image/png');
        toast(r === 'compartilhado' ? 'PNG compartilhado ✓' : 'PNG salvo para compartilhar.');
      } else if (navigator.share) {
        await navigator.share({ title: titulo, text: texto });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(texto); toast('Resumo copiado para compartilhar.');
      }
    } catch (e) { console.error(e); toast('Não foi possível compartilhar: ' + e.message, 5000); }
  }

  /* ---------------- eventos ---------------- */
  function bind() {
    const form = $('#form');

    form.addEventListener('input', (e) => {
      const el = e.target;
      const k = el.dataset && el.dataset.key;
      if (!k) return;
      setPath(data, k, el.type === 'checkbox' ? el.checked : el.value);
      if (/^oss\.\d+\.pacotes$/.test(k)) recalcRecebida();
      save(); refresh();
    });
    form.addEventListener('change', (e) => {
      const el = e.target;
      if (el.matches && el.matches('input[type=file][data-foto]')) {
        const f = el.files && el.files[0];
        if (f) handleFoto(f, el.dataset.foto, el.closest('.foto-box'));
        el.value = '';
        return;
      }
      const k = el.dataset && el.dataset.key;
      if (k && (el.type === 'checkbox' || el.tagName === 'SELECT')) {
        setPath(data, k, el.type === 'checkbox' ? el.checked : el.value);
        save(); refresh();
      }
    });
    form.addEventListener('click', (e) => {
      const tab = e.target.closest && e.target.closest('[data-tab]');
      if (tab) {
        const kind = tab.dataset.tabkind;
        document.querySelectorAll(`[data-tabs="${kind}"] .tab-btn`).forEach((b) => b.classList.toggle('active', b === tab));
        document.querySelectorAll(`.tab-panel[data-kind="${kind}"]`).forEach((p) => p.classList.toggle('active', p.dataset.panel === tab.dataset.tab));
        fitPreview();
        return;
      }
      const b = e.target.closest && e.target.closest('[data-clearfoto]');
      if (!b) return;
      data.fotos[b.dataset.clearfoto] = null;
      save(); refresh(); fotoUI();
      toast('Foto removida.');
    });

    /* ----- histórico ----- */
    $('#btnSalvarVersao').addEventListener('click', salvarVersao);
    const cloudBtn = $('#btnCloudSync');
    if (cloudBtn) cloudBtn.addEventListener('click', async () => {
      const txt = cloudBtn.textContent;
      cloudBtn.disabled = true; cloudBtn.textContent = '⏳ Enviando…';
      try {
        const ok = await RMCloud.save(clone(data));
        cloudWarned = !ok;
        toast(ok ? 'Dados do relatório enviados para a nuvem ✓' : 'Falha ao enviar — verifique a conexão e tente de novo.', 6000);
      } catch (e) { toast('Falha ao enviar: ' + (e && e.message || e), 6000); }
      cloudBtn.disabled = false; cloudBtn.textContent = txt;
    });
    $('#histList').addEventListener('click', async (e) => {
      const b = e.target.closest && e.target.closest('[data-hact]');
      if (!b) return;
      const item = b.closest('[data-hid]');
      const rec = item && histCache.find((r) => r.id === item.dataset.hid);
      if (!rec) return;
      const act = b.dataset.hact;
      if (act === 'abrir') {
        if (!confirm('Abrir esta versão para edição? Os dados atuais do formulário serão substituídos.\n(Salve uma versão agora se quiser preservar o que está na tela.)')) return;
        data = mergeData(defaultData(), clone(rec.data));
        save(); buildForm(); refresh();
        toast('Versão carregada para edição ✓');
      } else if (act === 'png') {
        b.disabled = true;
        try { await withSnapshot(rec, exportPNG); } catch (err) { console.error(err); toast('Falha: ' + err.message, 5000); }
        b.disabled = false;
      } else if (act === 'print') {
        await withSnapshot(rec, () => { fitPrint(); window.print(); });
      } else if (act === 'excluir') {
        if (!confirm('Excluir esta versão do histórico?')) return;
        await histDelete(rec.id);
        await renderHist();
        toast('Versão excluída.');
      }
    });

    /* ----- google drive ----- */
    const gc = $('#fGClient');
    if (gc) {
      gc.value = localStorage.getItem(GCLIENT_KEY) || '';
      gc.addEventListener('change', () => localStorage.setItem(GCLIENT_KEY, gc.value.trim()));
    }
    $('#btnDrive').addEventListener('click', () => driveConnect(false));
    $('#btnDriveUp').addEventListener('click', driveUploadAll);
    $('#btnDriveDown').addEventListener('click', driveDownloadAll);

    /* ----- libras / áudio / vídeo ----- */
    $('#btnOuvir').addEventListener('click', ouvirRelatorio);
    $('#btnPararAudio').addEventListener('click', () => {
      if ('speechSynthesis' in window) { speechSynthesis.cancel(); vstatus(' Narração parada.'); }
    });
    $('#btnAudioFile').addEventListener('click', gerarAudio);
    $('#btnVideoNarrado').addEventListener('click', gerarVideoNarrado);
    $('#btnVideo').addEventListener('click', gerarVideo);
    $('#btnShare').addEventListener('click', compartilhar);
    const topShare = $('#btnShareTop');
    if (topShare) topShare.addEventListener('click', compartilhar);
    const vu = $('#fVlibrasUrl'), vt = $('#fVlibrasToken');
    vu.value = localStorage.getItem(VLURL_KEY) || 'https://traducao2.vlibras.gov.br';
    vu.addEventListener('change', () => localStorage.setItem(VLURL_KEY, vu.value.trim()));
    vt.value = localStorage.getItem(VLTOKEN_KEY) || '';
    vt.addEventListener('change', () => localStorage.setItem(VLTOKEN_KEY, vt.value.trim()));

    $('#btnPng').addEventListener('click', exportPNG);
    $('#btnPdf').addEventListener('click', exportarPDF);    $('#btnPrint').addEventListener('click', () => { fitPrint(); window.print(); });
    window.addEventListener('beforeprint', fitPrint);
    window.addEventListener('afterprint', () => { if (reportEl) reportEl.style.zoom = ''; fitPreview(); });

    $('#btnLimpar').addEventListener('click', () => {
      if (!confirm('Limpar todos os dados e fotos do formulário?')) return;
      data = clearData();
      save(); buildForm(); refresh();
      toast('Formulário limpo.');
    });

    window.addEventListener('resize', fitPreview);
    window.addEventListener('orientationchange', () => setTimeout(fitPreview, 200));
    if (window.ResizeObserver) new ResizeObserver(() => fitPreview()).observe($('#previewWrap'));
  }

  /* ---------------- init ---------------- */
  function init() {
    buildForm();
    buildReport();
    bind();
    recalcRecebida();
    refresh();
    logoImage();
    renderHist().catch((e) => console.warn('hist', e));
    driveStatus('', 'desconectado');
    /* Drive automático: conecta com a sessão Google já logada */
    // Client ID correto (público) — substitui qualquer ID antigo salvo no aparelho
    const CID = '823561383768-bhcr2s64i6f7aj8mafkcna3gi4ts6tc6.apps.googleusercontent.com';
    localStorage.setItem(GCLIENT_KEY, CID);
    if ($('#fGClient')) $('#fGClient').value = CID;
    loadGis().catch(() => {}); // pré-carrega o GIS; o login só acontece no clique do usuário
    /* fonte única: conecta e recebe alterações de outros dispositivos */
    if (window.RMCloud) {
      RMCloud.init((remote) => {
        if (!remote || remote.fotos === undefined) return;
        data = mergeData(defaultData(), remote);
        localStorage.setItem(KEY, JSON.stringify(data));
        buildForm(); recalcRecebida(); refresh();
        toast('Dados atualizados pela nuvem ✓');
      }).then((r) => {
        const st = $('#driveStatus');
        if (st) st.title = r.ok ? ('Nuvem: ' + r.user) : ('Nuvem off: ' + r.erro);
        if (!r.ok) toast('Sem conexão com a nuvem — dados ficam neste aparelho.', 5000);
      }).catch(() => {});
    }
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    setTimeout(fitPreview, 60);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
