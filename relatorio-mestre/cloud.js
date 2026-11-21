/* ============================================================
   Relatório Mestre — CAMADA DE NUVEM
   - Firebase Auth + Realtime Database (fonte única de dados)
   - Cloud Text-to-Speech (áudio MP3)
   - Web Share (compartilhar arquivos)
   ============================================================ */
(function () {
  'use strict';

  var FB = {
    apiKey: 'AIzaSyAlmwzlPZAW4sU2gfBnJ0lWsp_u4brtHQ4',
    authDomain: 'superb-firefly-515408-i3.firebaseapp.com',
    databaseURL: 'https://superb-firefly-515408-i3-default-rtdb.firebaseio.com',
    projectId: 'superb-firefly-515408-i3',
    appId: '1:823561383768:web:6400e5b250287c2e287f2d'
  };
  var USER = 'salvadosjetmrb@gmail.com';
  var PASS = 'jetexpress10';
  var DB_PATH = 'relatorio/estado/v1';

  var app = null, db = null, auth = null, user = null;
  var lastLocal = 0, applying = false;
  var onRemote = null;

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = res; s.onerror = function () { rej(new Error('falha ao carregar ' + src)); };
      document.head.appendChild(s);
    });
  }

  async function ensureFirebase() {
    if (window.firebase && firebase.apps && firebase.apps.length) {
      if (!auth) auth = firebase.auth();
      if (!db) db = firebase.database();
      return true;
    }
    var base = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-';
    await loadScript(base + 'app-compat.js');
    await loadScript(base + 'auth-compat.js');
    await loadScript(base + 'database-compat.js');
    app = firebase.initializeApp(FB);
    auth = firebase.auth();
    db = firebase.database();
    return true;
  }

  async function init(onData) {
    onRemote = onData;
    try {
      await ensureFirebase();
      await auth.signInWithEmailAndPassword(USER, PASS);
      user = auth.currentUser;
      /* escuta alterações de QUALQUER dispositivo em tempo real */
      db.ref(DB_PATH).on('value', function (snap) {
        if (applying) return;
        var v = snap.val();
        if (!v || !v._ts || v._ts <= lastLocal) return;
        lastLocal = v._ts;
        if (onRemote) onRemote(v.data);
      });
      return { ok: true, user: user.email };
    } catch (e) {
      console.warn('[nuvem]', e);
      return { ok: false, erro: String(e && e.message || e) };
    }
  }

  async function save(data) {
    var ts = Date.now();
    lastLocal = ts;
    try {
      // tenta (re)conectar antes de gravar: se o login expirou, o painel ficaria com dados antigos
      await ensureFirebase();
      if (!auth.currentUser) await auth.signInWithEmailAndPassword(USER, PASS);
      user = auth.currentUser;
      db = firebase.database();
      await db.ref(DB_PATH).set({ _ts: ts, _por: user.email, data: data });
      return true;
    } catch (e) { console.warn('[nuvem] save', e); return false; }
  }

  /* ---- Cloud Text-to-Speech via backend J&T (Qwen Flash, chave só no servidor) ---- */
  var EXEC_URL = 'https://script.google.com/macros/s/AKfycbwXdpCBShUsGv0jFIt7rW4v4UDtKlPxto-myPpDxRUzT4hmMQ6_7yYkuIwptWfeYweU/exec';
  function pcmBytes(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function wavBlob(partes) {
    var n = partes.reduce(function (s, p) { return s + p.length; }, 0);
    var buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    function put(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    put(0, 'RIFF'); v.setUint32(4, 36 + n, true); put(8, 'WAVE'); put(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 24000, true); v.setUint32(28, 48000, true); v.setUint16(32, 2, true);
    v.setUint16(34, 16, true); put(36, 'data'); v.setUint32(40, n, true);
    var off = 44;
    partes.forEach(function (p) { new Uint8Array(buf, off, p.length).set(p); off += p.length; });
    return new Blob([buf], { type: 'audio/wav' });
  }
  async function tts(text, lang) {
    var cb = '__rmTts_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    var url = EXEC_URL + '?action=TTS&callback=' + cb + '&voice=Charon&text=' + encodeURIComponent(String(text || '').slice(0, 1400));
    return await new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      var timer = setTimeout(function () { cleanup(); reject(new Error('tempo limite na geração do áudio')); }, 180000);
      function cleanup() {
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) {}
        if (s.parentNode) s.parentNode.removeChild(s);
      }
      window[cb] = function (r) {
        cleanup();
        if (r && r.ok && r.audioBase64) resolve(pcmBytes(r.audioBase64));
        else reject(new Error('voz indisponível: ' + ((r && r.erro) || '?')));
      };
      s.onerror = function () { cleanup(); reject(new Error('falha de rede com a voz')); };
      s.src = url;
      document.head.appendChild(s);
    });
  }

  /* ---- compartilhamento ---- */
  async function share(blob, name, mime) {
    try {
      if (navigator.share && window.File && navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type: mime })] })) {
        await navigator.share({ title: name, files: [new File([blob], name, { type: mime })] });
        return 'compartilhado';
      }
      if (navigator.share) {
        try { await navigator.share({ title: name, text: 'Relatório Mestre' }); return 'compartilhado-texto'; } catch (e) { if (e.name === 'AbortError') return 'cancelado'; }
      }
    } catch (e) { console.warn('share', e); }
    download(blob, name);
    return 'baixado';
  }

  function download(blob, name) {
    var a = document.createElement('a');
    var url = URL.createObjectURL(blob);
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  window.RMCloud = {
    init: init, save: save, tts: tts, wav: wavBlob, share: share, download: download,
    get user() { return user && user.email; },
    get ok() { return !!(db && user); },
    config: FB
  };
})();
