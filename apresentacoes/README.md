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
