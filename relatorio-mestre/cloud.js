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

  /* ---- Cloud Text-to-Speech ---- */
  async function tts(text, lang) {
    var url = 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + FB.apiKey;
    var parts = String(text || '').slice(0, 4500);
    var r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: parts },
        voice: { languageCode: lang === 'zh-CN' ? 'cmn-CN' : 'pt-BR', name: lang === 'zh-CN' ? 'cmn-CN-Standard-A' : 'pt-BR-Neural2-A' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1 }
      })
    });
    if (!r.ok) throw new Error('TTS ' + r.status + ' — ' + (await r.text()).slice(0, 140));
    var j = await r.json();
    var bin = atob(j.audioContent);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'audio/mpeg' });
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
    init: init, save: save, tts: tts, share: share, download: download,
    get user() { return user && user.email; },
    get ok() { return !!(db && user); },
    config: FB
  };
})();
