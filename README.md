# J&T People Analytics

Painel público de assiduidade, DSR e presença — J&T Express Marabá 01BG.

## Acesso

- URL pública: https://anjoagamenon.github.io/jt-people-analytics/
- Senha interna (prática restrita): `jetexpress10`
- Sem necessidade de login para diretoria; acesso público limitado ao painel.

## Recursos

- Distribuição por tooltip / turno (Turno 1, Turno 2, ADM)
- Destaque do dia (aniversários, folgas)
- Indicadores e assiduidade do mês
- Decisões futuras de volumetria por dia da semana
- Ficha do colaborador com fonte legível, **foto → botões → texto** e foto ampliável em tela cheia
  (clique na foto; mostra nome e matrícula; fecha com ✕, clique fora ou Esc)
- Envio de alerta por WhatsApp para todos os celulares com o app
- **★ Portal de Talentos** — botão na área **Destaque da equipe** do painel, ao lado dos filtros
  Todos / Turno 1 / Turno 2 / Qualidade / ADM, e também por acesso direto:
  `https://anjoagamenon.github.io/jt-people-analytics/talentos.html`
  (o botão é um link isolado — os filtros originais continuam funcionando igual)
- **📝 Site público de cadastro**: `.../cadastro.html` — currículo profissional completo,
  75 profissões com digitação livre, foto por câmera/arquivo, vagas abertas e candidatura.
- **▤ Funil de Talentos**: `.../funil.html` — kanban por etapa com arrastar-e-soltar e
  acompanhamento por WhatsApp.

## ★ Portal de Talentos

Portal **somente de análise** — não há formulário de cadastro aqui. As pessoas se cadastram
em **outro site**, e os dados chegam a esta tela em tempo real via Firebase.

- **Talentos-SC-MRB** → somente **colaboradores do painel** (interno).
- **Talentos-MRB** → candidatos vindos do site de cadastro externo.

### Fluxo

1. **Site externo de cadastro**: grava cada pessoa em `talentos/cadastros/v1/{id}` no Firebase
   com os campos `nome`, `email`, `telefone`, `unidade` (MRB), `profissao` (seletor da logística),
   `cargo`, `foto` (data URL da câmera/arquivo, redimensionada), `experiencia`,
   `status` (Pendente), `criadoEm` e `origem: "Portal"`.
2. **Colaboradores do painel**: o botão **"⇩ Trazer colaboradores do painel"** importa os
   `colabs` reais para `talentos/internos/v1` (origem `Painel`, SC-MRB).
3. **Firebase** é a fonte viva: `talentos/cadastros/v1` (externo) e `talentos/internos/v1`
   (painel). Esta tela escuta os dois caminhos — novos cadastros aparecem sozinhos.
4. **Espelhamento opcional na planilha**: o Apps Script anexa cada registro ao `Banco Geral`
   e à aba correta — externos em `Talentos-MRB`, colaboradores em `Talentos-SC-MRB`.
5. **Cadastro de vagas**: na aba **Gerenciar Vagas** do portal (`talentos.html`, senha
   `jetexpress10`), clique em **+ Nova vaga**, preencha título, unidade, urgência, resumo,
   requisitos e desejáveis, e salve. As vagas vão para `talentos/config/v1/web.vagas`
   e aparecem **na hora** no site público (`cadastro.html`) e no cálculo de match do portal/funil.
   Vagas com status **Fechada** não aparecem no cadastro público.
6. **Área de gestão** (senha `jetexpress10`):
   - busca por nome/cargo/competência/e-mail, filtros por origem, unidade e status;
   - **busca por nome de vaga** → mostra quem é candidato, ordenado por match;
   - ao criar uma vaga (botão 👥 em "Gerenciar Vagas"), aparece o ranking **1º talentos da casa**
     e, se não houver match ≥ 40%, **2º talentos de fora** com o link do cadastro público;
   - campo **Matrícula** → abre o pré-cadastro do colaborador da casa;
   - candidatura interna sem duplicidade: no site público, o colaborador marca "Já sou colaborador",
     informa a matrícula completa (sem lista de nomes: os dados só aparecem após a matrícula exata) e tem os existentes preenchidos automaticamente (nome, e-mail,
      telefone, CPF, nascimento, cargo, formação, certificações etc.), completando só o que falta — isso
     **atualiza o cadastro existente** em `talentos/internos/v1`; o gestor vê o interesse na vaga
     em **Gerenciar Vagas → 👥** e decide **Autorizar / Recusar** (com aviso por e-mail + WhatsApp pronto);
   - **sem segunda senha**: ao desbloquear o painel principal, portal e funil entram direto
     (a sessão `dsr_dash_ok` do painel é reaproveitada);
   - cards com **foto** e modal de **currículo** no estilo da ficha do painel;
   - triagem (Pendente → Triagem → Entrevista → Aprovado → Banco/Contratado);
   - match com vagas (0–100%) e destaque de **talento escondido**;
   - **9-box** (Potencial × Prontidão), trilhas de carreira, mapa de sucessão e PDI;
   - exportação CSV e contato direto via WhatsApp.
7. **Site público de cadastro** (`cadastro.html`): Banner no topo, currículo profissional
   (resumo, experiências, formação, certificações, idiomas, habilidades, LinkedIn e foto),
   seletor de 75 profissões com digitação livre, lista de vagas com resumo e candidatura.
   - **Validações**: CPF com dígitos verificadores reais, idade mínima de 18 anos e
     situação militar obrigatória para homens (Dispensado/reservista em dia/isento).
   - **Anti-duplicidade**: mesmo sem marcar "sou colaborador", o CPF (ou e-mail/telefone)
     identifica o registro existente — interno ou externo — e atualiza a candidatura em vez
     de criar outro cadastro.
   - **Desistência**: "Limpar seleção da vaga" antes de enviar e "Desistir da candidatura"
     por protocolo ou matrícula depois de enviado; o status `Desistida` aparece no painel.
   Grava em `talentos/cadastros/v1` com `vagaId`/`vagaTitulo` e histórico `notificacoes`.
8. **Funil de Talentos** (`funil.html`): colunas por etapa (Pendente → Triagem → Entrevista →
   Aprovado → Contratado, além de Não selecionado / Colaborador ativo / Desligado), arrastar
   cards, prazo por etapa (Pendente 3d, Triagem 5d, Entrevista 7d, Aprovado 3d, Contratado 2d),
   badge "dias / prazo" com alerta de atraso, filtro **Só atrasados** e filtro por **função/cargo**;
   taxas de conversão e tempo médio por etapa.
9. **Notificações (sem depender de um único canal)**: a cada mudança de etapa, ou quando o
   gestor usa "Enviar mensagem" no perfil, o sistema **registra a notificação no painel**
   (badge 🔔 com histórico). O **e-mail é automático** via GmailApp. O **WhatsApp é manual**:
   ao marcar esse canal, o portal abre o `wa.me` com a mensagem pronta para o gestor confirmar
   o envio no celular — sem API paga. O histórico mostra "e-mail ✓ enviado" e
   "WhatsApp pronta (manual)".
   - O badge só aparece para match ≥ 40% nos cards, evitando ruído de perfis sem aderência.

### Arquivos

| Arquivo | Função |
|---|---|
| `talentos.html` | Interface do portal (cadastro + gestão) |
| `talentos.css` | Identidade visual J&T (tema claro/escuro) |
| `talentos.js` | Firebase, busca, match, carreira, PDI, CSV |
| `backend/talentos-backend.gs` | Apps Script: `GET_TALENTOS` e `ADD_TALENTO` (JSONP) |
| `data/talentos.json` | Estrutura de referência (vagas, IDs das abas) |
| `data/talentos-ficticios-backup.json` | Backup dos 14 registros fictícios removidos — **não usar** |

### Backend já implantado (nov/2026)

- **Projeto Apps Script:** `Banco de Talentos J&T` (ID `11egVJR4_NrHEkTKUoQ8oqSdC6Ihlsuhaqhum74228n6Iingt12_Wd9fy`)
- **URL Web App:** `https://script.google.com/macros/s/AKfycbyUbsMfMEAB8_ghjRVblCwXOmlMmxOCzScSMSzNfMkAKSmiVQ_Kk6xD2eP4zM0_TKUc/exec`
- Acesso: **Qualquer pessoa** · Executar como: `anjoagamenon@gmail.com`
- Ações: `GET_TALENTOS`, `ADD_TALENTO`, `NOTIFY_EMAIL`, `NOTIFY_WHATSAPP`
- URL já salva no portal em Configuração (Firebase `talentos/config/v1/web.backend`).
- **Envio de e-mail testado com sucesso** (`GmailApp`).
- WhatsApp: **envio manual** com mensagem pré-pronta via `wa.me` (sem API e sem custo).

### Instalação do backend (caso precise refazer)

1. Abra a planilha **Banco de Dados de Talentos - SC-MRB e MRB**
   (ID `1myXTFVRY-Nq5JEoovbQrWs9ajgkgKUylVcPHhyflBDo`).
2. Extensões → Apps Script → cole o conteúdo de `backend/talentos-backend.gs`.
3. Implantar → Nova implantação → **Aplicativo da Web**
   (executar como você; acesso: qualquer pessoa — não divulgue a URL).
4. Cole a URL gerada em **Gestão → Configuração → URL do backend**.
5. Botão **Testar conexão** para validar.

> Observação: as abas `Talentos-SC-MRB` e `Talentos-MRB` são visões `FILTER` do
> `Banco Geral`. Os 14 registros fictícios inseridos pelo Gemini foram removidos
> da base (as abas agora exibem "Nenhum candidato encontrado").

## Leitura restrita

Acesso via senha (`jetexpress10`) somente para gestão.

Mantido pelo time de operação — J&T Express Marabá 01BG.
