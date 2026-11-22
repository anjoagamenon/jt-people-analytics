/* ============================================================
   J&T PEOPLE ANALYTICS — BACKEND DO BANCO DE TALENTOS
   Google Apps Script (Web App)

   COMO INSTALAR (2 minutos):
   1) No Google Drive, abra a planilha "Banco de Dados de Talentos -
      SC-MRB e MRB" (ID 1myXTFVRY-Nq5JEoovbQrWs9ajgkgKUylVcPHhyflBDo).
   2) Extensões → Apps Script. (Ou crie um projeto novo em
      script.google.com e cole este código.)
   3) Apague o conteúdo de Code.gs e cole este arquivo inteiro.
   4) Salve (Ctrl+S).
   5) Implantar → Nova implantação → Tipo: Aplicativo da Web.
      - Executar como: "Eu (seu e-mail)"
      - Quem tem acesso: "Qualquer pessoa" (necessário para o
        painel estático chamar via JSONP; os dados são de uso
        interno — não compartilhe a URL publicamente)
   6) Autorize o escopo de Planilhas.
   7) Copie a URL https://script.google.com/macros/s/.../exec
      e cole no campo "URL do backend" na aba ⚙ Config do painel
      Banco de Talentos (ou mantenha a URL padrão já preenchida).

   O painel chama:
     URL?action=GET_TALENTOS&callback=nomeDoCallback
   E recebe: nomeDoCallback({ ...json... })

   SE JÁ USA UM APPS SCRIPT NO PAINEL:
   Não precisa substituir o atual. Basta adicionar a função
   handleTalentos(e) ao seu Code.gs e, dentro do doGet(e) atual,
   colocar no início:
       if (e.parameter.action === 'GET_TALENTOS') return handleTalentos(e);
   ============================================================ */

var TALENTOS_SS_ID = '1myXTFVRY-Nq5JEoovbQrWs9ajgkgKUylVcPHhyflBDo';
var TALENTOS_ABAS = ['Talentos-SC-MRB', 'Talentos-MRB'];

/** Converte "12/03/2024" para "2024-03-12" (ISO). */
function _isoData(v) {
  var s = String(v || '').trim();
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0, 10);
  return s;
}

/** Descobre a linha do cabeçalho (onde aparece "ID Candidato"). */
function _cabecalho(sheet) {
  var valores = sheet.getRange(1, 1, Math.min(12, sheet.getLastRow()), 26).getValues();
  for (var i = 0; i < valores.length; i++) {
    for (var j = 0; j < valores[i].length; j++) {
      if (String(valores[i][j]).trim().toLowerCase() === 'id candidato') {
        return { linha: i + 1, colunas: valores[i].map(function (h) { return String(h).trim(); }) };
      }
    }
  }
  return { linha: 4, colunas: [] };
}

function _valorPorColuna(colunas, nome) {
  for (var i = 0; i < colunas.length; i++) {
    if (colunas[i].toLowerCase() === nome.toLowerCase()) return i;
  }
  return -1;
}

function _linhaParaObjeto(colunas, linha) {
  function pega(nome) {
    var i = _valorPorColuna(colunas, nome);
    return i < 0 ? '' : String(linha[i] == null ? '' : linha[i]).trim();
  }
  var pasta = pega('Categoria / Pasta');
  return {
    id: pega('ID Candidato'),
    nome: pega('Nome Completo'),
    email: pega('E-mail'),
    telefone: pega('Telefone / WhatsApp'),
    cargo: pega('Cargo / Função'),
    pasta: pasta,
    unidade: /MRB/.test(pasta) && !/SC/.test(pasta) ? 'MRB' : 'SC-MRB',
    status: pega('Status do Candidato'),
    cadastro: _isoData(pega('Data de Cadastro')),
    curriculo: pega('Link do Currículo / Pasta'),
    notas: pega('Notas / Observações')
  };
}

/** Lê as abas Talentos-SC-MRB e Talentos-MRB e devolve JSONP. */
function handleTalentos(e) {
  var callback = String(e.parameter.callback || 'callback').replace(/[^A-Za-z0-9_$]/g, '');
  try {
    var ss = SpreadsheetApp.openById(TALENTOS_SS_ID);
    var candidatos = [];
    TALENTOS_ABAS.forEach(function (nomeAba) {
      var sheet = ss.getSheetByName(nomeAba);
      if (!sheet) return;
      var h = _cabecalho(sheet);
      var ultima = sheet.getLastRow();
      if (ultima <= h.linha) return;
      var dados = sheet.getRange(h.linha + 1, 1, ultima - h.linha, h.colunas.length || 26).getValues();
      dados.forEach(function (linha) {
        var obj = _linhaParaObjeto(h.colunas, linha);
        if (obj.id || obj.nome) candidatos.push(obj);
      });
    });
    var payload = {
      ok: true,
      atualizadoEm: new Date().toISOString(),
      fonte: 'Google Sheets (ao vivo)',
      candidatos: candidatos
    };
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(payload) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } catch (err) {
    var erro = { ok: false, erro: String(err && err.message || err) };
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(erro) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

/**
 * Recebe um cadastro vindo do Portal de Talentos e o espelha na planilha:
 *  - acrescenta no "Banco Geral" (base mestre)
 *  - acrescenta também na aba da unidade (Talentos-SC-MRB ou Talentos-MRB)
 * Evita duplicatas pelo e-mail.
 */
function handleAddTalento(e) {
  var p = e.parameter;
  var callback = String(p.callback || 'callback').replace(/[^A-Za-z0-9_$]/g, '');
  try {
    var ss = SpreadsheetApp.openById(TALENTOS_SS_ID);
    var email = String(p.email || '').trim().toLowerCase();
    var geral = ss.getSheetByName('Banco Geral');
    if (!geral) throw new Error('Aba Banco Geral não encontrada');

    var h = _cabecalho(geral);
    var ultima = Math.max(geral.getLastRow(), h.linha);
    var existentes = ultima > h.linha
      ? geral.getRange(h.linha + 1, 1, ultima - h.linha, h.colunas.length || 10).getValues()
      : [];
    var colEmail = _valorPorColuna(h.colunas, 'E-mail');
    for (var i = 0; i < existentes.length; i++) {
      if (colEmail >= 0 && String(existentes[i][colEmail] || '').trim().toLowerCase() === email) {
        return ContentService.createTextOutput(callback + '(' + JSON.stringify({ ok: true, duplicado: true }) + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
    }

    // A aba é definida pela origem: colaboradores do painel → SC-MRB; público → MRB
    var unidade = String(p.unidade || 'MRB');
    var abaNome = String(p.aba || '').trim();
    if (!abaNome) abaNome = /MRB/.test(unidade) && !/SC/.test(unidade) ? 'Talentos-MRB' : 'Talentos-SC-MRB';
    if (abaNome !== 'Talentos-SC-MRB' && abaNome !== 'Talentos-MRB') abaNome = 'Talentos-MRB';
    var linha = [
      String(p.id || '').trim(),
      String(p.nome || '').trim(),
      email,
      String(p.telefone || '').trim(),
      String(p.cargo || '').trim(),
      abaNome,
      String(p.status || 'Pendente').trim(),
      _isoData(p.cadastro),
      String(p.curriculo || '').trim(),
      String(p.notas || '').trim()
    ];

    geral.appendRow(linha);
    var aba = ss.getSheetByName(abaNome);
    if (aba) {
      var ha = _cabecalho(aba);
      var vb = aba.getRange(1, 1, Math.max(ha.linha, aba.getLastRow()), 26).getValues();
      var nova = [];
      for (var c = 0; c < 26; c++) nova.push(c < linha.length ? linha[c] : '');
      // reordena conforme o cabeçalho da aba, se ele existir
      if (ha.colunas.length) {
        nova = ha.colunas.map(function (nomeCol) {
          var idx = [
            'ID Candidato', 'Nome Completo', 'E-mail', 'Telefone / WhatsApp', 'Cargo / Função',
            'Categoria / Pasta', 'Status do Candidato', 'Data de Cadastro',
            'Link do Currículo / Pasta', 'Notas / Observações'
          ].indexOf(nomeCol);
          return idx < 0 ? '' : linha[idx];
        });
      }
      aba.appendRow(nova);
    }
    return ContentService.createTextOutput(callback + '(' + JSON.stringify({ ok: true, aba: abaNome }) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } catch (err) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify({ ok: false, erro: String(err && err.message || err) }) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

/**
 * Envia mensagem de WhatsApp ao candidato (WhatsApp Business Cloud API).
 * CONFIGURAÇÃO (uma vez, no Apps Script):
 *   Projeto → Configurações do projeto (⚙) → Propriedades do script:
 *     WA_TOKEN     = token de acesso do Meta
 *     WA_PHONE_ID  = ID do número de telefone do WhatsApp Business
 * Se não estiver configurado, o painel abre o WhatsApp com a mensagem pronta (envio manual).
 */
function handleNotify(e) {
  var p = e.parameter;
  var callback = String(p.callback || 'callback').replace(/[^A-Za-z0-9_$]/g, '');
  var phone = String(p.phone || '').replace(/\D/g, '');
  var text = String(p.text || '');
  try {
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty('WA_TOKEN') || '';
    var phoneId = props.getProperty('WA_PHONE_ID') || '';
    if (!token || !phoneId) {
      return ContentService.createTextOutput(callback + '(' + JSON.stringify({ ok: false, erro: 'WA_TOKEN/WA_PHONE_ID não configurados' }) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    var payload = { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text } };
    var res = UrlFetchApp.fetch('https://graph.facebook.com/v19.0/' + phoneId + '/messages', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    var body = res.getContentText();
    return ContentService.createTextOutput(callback + '(' + JSON.stringify({ ok: code >= 200 && code < 300, status: code, resposta: body.slice(0, 500) }) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } catch (err) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify({ ok: false, erro: String(err && err.message || err) }) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

/**
 * Envia e-mail de acompanhamento ao candidato usando GmailApp (sem API paga).
 * Na primeira execução o Apps Script pedirá autorização para enviar e-mails.
 */
function handleNotifyEmail(e) {
  var p = e.parameter;
  var callback = String(p.callback || 'callback').replace(/[^A-Za-z0-9_$]/g, '');
  var email = String(p.email || '').trim();
  var assunto = String(p.assunto || 'Atualização da sua candidatura — J&T Express');
  var corpo = String(p.texto || '');
  try {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido');
    GmailApp.sendEmail(email, assunto, corpo, { name: 'Gestão de Pessoas — J&T Express' });
    return ContentService.createTextOutput(callback + '(' + JSON.stringify({ ok: true, para: email }) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } catch (err) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify({ ok: false, erro: String(err && err.message || err) }) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

/** Web App padrão. Se você já tem um doGet, apenas adicione os ifs abaixo no início dele. */
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'GET_TALENTOS') return handleTalentos(e);
  if (e && e.parameter && e.parameter.action === 'ADD_TALENTO') return handleAddTalento(e);
  if (e && e.parameter && e.parameter.action === 'NOTIFY_EMAIL') return handleNotifyEmail(e);
  if (e && e.parameter && e.parameter.action === 'NOTIFY_WHATSAPP') return handleNotify(e);
  var callback = String((e && e.parameter && e.parameter.callback) || 'callback').replace(/[^A-Za-z0-9_$]/g, '');
  return ContentService.createTextOutput(callback + '(' + JSON.stringify({ ok: false, erro: 'ação desconhecida' }) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
