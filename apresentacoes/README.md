# TL1 — Plataforma de apresentações

Aplicação para escolha exclusiva de tópicos, sorteio da ordem de apresentação, cronômetro e avaliação por pares das turmas de Teoria Linguística 1.

## Arquitetura sem custo

- GitHub Pages: interface pública, em `/apresentacoes/`.
- Firebase Authentication (plano Spark): login com Google.
- Cloud Firestore (plano Spark): reservas, sessão ao vivo e avaliações.
- Google Apps Script: somente envio de e-mail de confirmação, fora do fluxo de avaliação em tempo real.
- Google Sheets: registro administrativo e log de e-mails.

O projeto foi desenhado para permanecer no plano gratuito. Não habilite o plano Blaze do Firebase.

## Fluxo

1. O aluno entra pelo link específico da turma e autentica com Google.
2. Informa nome e matrícula e escolhe um tópico ainda livre.
3. A reserva usa transação atômica: um tópico só pode ter um aluno e um aluno só pode ter um tópico por turma.
4. O Apps Script envia o e-mail de confirmação.
5. No dia da aula, o professor cria uma sessão e sorteia a ordem.
6. Cada apresentação tem 180 s; ao fim, abre-se uma janela de 30 s para avaliação.
7. O QR code da turma é fixo: os alunos escaneiam uma vez e a página acompanha automaticamente o apresentador atual.
8. Cada avaliador pode enviar uma única nota por apresentador; autoavaliação é bloqueada.
9. A nota final é a média aritmética de todas as avaliações válidas.

## Estrutura de dados

`classes/{classId}`: configuração da turma.
`classes/{classId}/claims/{topicId}`: reserva exclusiva do tópico.
`classes/{classId}/registrations/{uid}`: dados privados do aluno.
`classes/{classId}/roster/{uid}`: nome e tópico, sem e-mail/matrícula.
`classes/{classId}/sessions/{sessionId}`: ordem e estado da apresentação.
`classes/{classId}/sessions/{sessionId}/evaluations/{presenterUid}__{evaluatorUid}`: nota única.
`admins/{uid}`: administradores.

## Configuração necessária

1. Criar um projeto Firebase no plano Spark.
2. Ativar Authentication > Google.
3. Criar um Cloud Firestore Standard.
4. Copiar `firestore.rules` para as regras do Firestore.
5. Registrar uma Web App e colocar a configuração em `firebase-config.js`.
6. Adicionar `fonufal.github.io` aos domínios autorizados do Authentication.
7. Fazer o primeiro login do professor e, no console Firestore, criar manualmente `admins/SEU_UID` com `active: true`.
8. Criar as turmas pelo painel `admin.html`.
9. Copiar `apps-script/Code.gs` para o Apps Script vinculado à planilha de dados e publicar como Web App.

O arquivo `firebase-config.js` contém apenas configuração pública do cliente. A proteção dos dados depende das regras do Firestore, não de esconder essa configuração.


## Fechamento de produção — 2026.2

O painel administrativo inclui um atalho para criar as duas turmas reais:
- `tl1-2026-2-01` — TL1 — Turma 01
- `tl1-2026-2-02` — TL1 — Turma 02

A data da apresentação pode permanecer vazia até ser definida.

### Serviço de e-mail

No Apps Script vinculado à planilha de dados:

1. Copie integralmente `apps-script/Code.gs`.
2. Em Configurações do projeto > Propriedades do script, crie:
   - `FIREBASE_API_KEY`
   - `FIREBASE_PROJECT_ID` = `tl1-apresentacoes`
3. Execute manualmente `validateSetup()`.
4. Execute manualmente `sendTestEmail()` e confirme o recebimento.
5. Implantar > Nova implantação > Aplicativo da Web.
6. Executar como: usuário que implantou.
7. Acesso: qualquer pessoa, inclusive anônima. A segurança do endpoint é feita pela validação do token Firebase em `doPost`.
8. Copie a URL terminada em `/exec` e coloque-a em `MAIL_WEBAPP_URL` de `runtime-config.js`.
9. Execute uma vez `installDailyMailTrigger()` para criar o gatilho diário da fila.

### Resultados

O painel mostra, por aluno, o número de avaliações recebidas sobre o número esperado e a média com uma casa decimal. O CSV usa a mesma precisão.


## Controle de acesso por lista oficial

As turmas reais usam uma subcoleção privada `eligible` no Firestore.

Fluxo:
1. O professor importa no admin a lista oficial do SIGAA.
2. Cada registro autorizado é identificado por um SHA-256 de matrícula + e-mail do SIGAA.
3. O aluno autentica com Google e informa matrícula + e-mail do SIGAA.
4. Se a combinação existir, o nome é recuperado da lista oficial e o seletor de tópicos é liberado.
5. No momento da reserva, a identidade autorizada, a conta Google, a matrícula e o tópico são vinculados na mesma transação.
6. Uma identidade já vinculada não pode ser usada por uma segunda conta Google.
7. Uma conta Google só pode ter um registro por turma.
8. Pessoas que não estejam na lista oficial não conseguem reservar tópicos.
9. O e-mail de confirmação é enviado para o endereço oficial da lista do SIGAA, mesmo que a conta Google usada para autenticação seja outra.

A lista `eligible` não pode ser listada por alunos; somente administradores têm acesso de listagem. O aluno consegue consultar apenas um documento opaco cujo identificador deriva da combinação exata de matrícula e e-mail informados.

### Importação das listas do SIGAA

O painel do professor aceita arquivos TXT copiados diretamente da página de discentes do SIGAA ou um JSON com `name`, `matricula`, `email` e `course`.
O painel verifica T01/T02 antes de importar e mostra o total de alunos autorizados da turma.


## Link único para os alunos

O endereço público principal é:

`https://fonufal.github.io/tl1/apresentacoes/`

Sem o parâmetro `turma`, a página funciona como portal de entrada e oferece Turma 01 e Turma 02. Após a escolha, o aluno é encaminhado ao fluxo da turma correspondente, onde matrícula e e-mail do SIGAA são verificados contra a lista oficial.

Os links diretos por turma continuam existindo e são usados pelo QR e quando for conveniente abrir uma turma específica.
