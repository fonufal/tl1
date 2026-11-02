# Em questão — Quiz ao vivo de Teoria Linguística 1

Módulo independente de quiz formativo de TL1 (FALE/UFAL), publicado no GitHub Pages em \`/tl1/quiz/\`. Não altera Teoria em Voz Alta, Apresentações ou seus registros. **Primeira versão experimental**: requer piloto de conexão entre dispositivos e avaliação de capacidade antes de uso com toda a turma.

## Fluxos

- **Docente**: abre a página → seleciona semestre, turma, tema, quantidade de questões, tempo e opções de pontuação/classificação → cria sala → compartilha PIN ou QR Code → inicia → encerra respostas → examina distribuição e justificativa → avança → encerra → exporta CSV agregado.
- **Estudante**: abre o mesmo endereço no celular, entra com PIN e apelido (sem conta/matrícula) → seleciona uma das quatro alternativas → recebe explicação após o encerramento → acompanha a próxima pergunta.
- **Prática individual**: oito questões sorteadas, sem limite de tempo, com feedback ao responder.
- **Banco de questões**: 12 questões-base em \`questions.js\`, organizadas por unidade e relacionadas às definições de \`../data/conceitos.js\`. O docente pode adicionar outras questões pelo editor, importá-las ou exportar JSON. Questões adicionadas são salvas **apenas no navegador utilizado para criá-las**. Não fazem sincronização automática com o GitHub ou outros computadores.

## Infraestrutura e privacidade

- GitHub Pages hospeda arquivos estáticos.
- PeerJS 1.5.5 utiliza o serviço público gratuito PeerJS Cloud para sinalização; depois, os dados são transmitidos por canais WebRTC entre os navegadores, podendo passar por relay quando a rede exigir. Sem serviço próprio ou garantia de disponibilidade/capacidade.
- O computador do professor permanece ativo como anfitrião; fechá-lo, atualizá-lo ou perder a conexão termina a sessão e elimina resultados não exportados.
- Apelidos e respostas circulam durante a sessão; são mantidos temporariamente em memória do navegador do professor. Não há cadastro, associação com matrícula, registro permanente, nem lançamento automático de notas. Apelidos podem ser exibidos quando a classificação é habilitada; recomenda-se apelidos não identificáveis.
- A exportação CSV contém só agregados por pergunta, semestre, turma e código; não contém apelidos, IDs ou respostas individuais.
- O PIN **não é autenticação**. Evite divulgação pública e uso com dados sensíveis. O banco base publicado no repositório pode ser consultado por qualquer pessoa; não usar o quiz como avaliação somativa ou exame seguro.
- Biblioteca PeerJS e QRCode são carregadas por CDN externo. Sem internet ou com bloqueio de WebRTC/servidor de sinalização, a sessão ao vivo não funciona.
- O Google Firebase existente em \`/apresentacoes/\` **não é utilizado**: as regras atuais de segurança são específicas para as avaliações daquela ferramenta.

## Verificação antes de liberar à turma

1. Abrir \`https://fonufal.github.io/tl1/quiz/\` em computador do professor e celular em outra rede.
2. Criar sessão com 3 questões, duração de 15 segundos, pontuação ligada; escanear QR Code e participar.
3. Verificar que uma pessoa responde uma vez por questão e não consegue responder após o cronômetro do professor terminar.
4. Conferir se alternativas corretas e justificativas aparecem **apenas após encerramento**, se os totais estão corretos, se a próxima questão sincroniza, e se a exportação CSV abre corretamente.
5. Repetir piloto com 5–10 participantes e depois testar nas condições reais da rede da FALE/UFAL, com a quantidade esperada de celulares. Conferir navegação por teclado, zoom, contraste e condições alternativas de participação.
6. Se houver falhas de P2P, substituir a sinalização gratuita por uma solução própria ou backend com autenticação, regras de segurança, expiração e validação no servidor. Não reutilizar permissões de Firestore de outro módulo sem revisão específica.

## Distinção permanente / semestral

- Permanentes: código, perguntas-base, explicações, modelos de sessão e procedimentos.
- Semestrais: a escolha da turma e semestre e os CSVs gerados localmente; devem ser guardados, **se forem necessários**, em espaço privado do semestre correspondente no Google Drive da disciplina, não em repositório público.
- SIGAA permanece o registro oficial de avaliação e frequência.

## Arquivos

- \`index.html\`: interface pública.
- \`styles.css\`: estilos responsivos.
- \`questions.js\`: banco permanente de questões.
- \`app.js\`: sessões, comunicação, temporização, apuração, exportação, prática e editor.


## Acesso integrado com Apresentações — versão de homologação (02/11/2026)

Esta segunda implementação está disponível como **código piloto** em \`auth-preview.html\` e \`auth-app.js\`, sem substituir o quiz PeerJS ativo em \`index.html\`. A nova versão usa o mesmo Firebase Project, a mesma aplicação padrão do Firebase Authentication e a mesma origem GitHub Pages do módulo Apresentações; assim, a sessão Google existente é reutilizada no mesmo navegador, desde que continue válida. A prática individual pública do quiz original permanece acessível sem autenticação.

**Não liberar como ferramenta principal antes da publicação das regras de segurança e dos testes com contas reais.** Alterar os arquivos do GitHub não publica regras no Firebase.

### Modelo de identificação

1. Login Google: usa a mesma sessão local persistente de Apresentações; não solicita novo cadastro.
2. Se há \`classes/{classId}/registrations/{uid}\`, considera o estudante identificado e autorizado naquela turma, sem novo formulário.
3. Se não há registro de apresentação, procura \`classes/{classId}/quizIdentities/{uid}\`.
4. Se ainda não existe vínculo, solicita **uma única vez** matrícula e e-mail SIGAA e os confronta com \`classes/{classId}/eligible/{sha256(matricula + "|" + email)}\`.
5. A transação cria \`quizIdentities/{uid}\` e \`quizClaims/{eligibilityId}\`, com verificação atômica por regras do Firestore. Isso não reserva tema nem modifica os dados administrativos de Apresentações.
6. A regra do módulo Apresentações ganhou uma verificação adicional que rejeita reserva por UID diverso daquele já vinculado ao quiz; preservar esta consistência nos próximos semestres.

O mecanismo de matrícula + e-mail segue a opção já usada em Apresentações. **Não comprova sozinho titularidade de e-mail**, portanto não deve ser usado para decisões de avaliação oficial ou outros procedimentos de alto impacto sem um segundo fator/validação institucional.

### Estrutura dos quizzes (Firestore)

- \`classes/{classId}/quizSessions/{pin}\`: sessão, pergunta corrente, janela de tempo, resultado agregado e quadro de classificação por identificadores não nominais.
- \`.../participants/{uid}\`: nome associado à conta e à turma. Leitura do próprio estudante e do professor; **não listado a colegas**.
- \`.../answers/{roundId}__{uid}\`: uma resposta por estudante e rodada, com timestamp confirmado pelo servidor; leitura do estudante titular e do professor.
- \`.../rounds/{roundId}\`: histórico e estatísticas por pergunta, leitura apenas de administradores.
- \`classes/{classId}/quizIdentities/{uid}\` e \`quizClaims/{eligibilityId}\`: vínculo exclusivo com turma; sem duplicar matrícula ou e-mail em documentos do quiz.

As regras novas foram acrescentadas **integralmente** às regras existentes em \`apresentacoes/firestore.rules\`, sem criar um segundo arquivo de regras que pudesse sobrescrever indevidamente as permissões da plataforma de apresentações.

### Publicação e testes pendentes

1. Validar a sintaxe e as permissões do arquivo combinado \`apresentacoes/firestore.rules\` com o Firebase Emulator Suite, incluindo cenário autorizado e tentativas de leitura/listagem de dados de outros estudantes, respostas duplicadas e respostas enviadas após o prazo.
2. Fazer backup das regras atuais do console e implantar **o arquivo combinado inteiro** no projeto Firebase \`tl1-apresentacoes\`, não só o trecho do quiz. Antes da implantação, comparar o conteúdo do console com a versão corrente do GitHub e resolver eventuais alterações que só existam no console.
3. Abrir \`https://fonufal.github.io/tl1/quiz/auth-preview.html\` com o professor (admin Firebase), criar sala e escanear o QR em um celular de estudante previamente registrado em Apresentações. Confirmar entrada sem segundo login e sem digitar matrícula.
4. Testar outro estudante elegível ainda sem reserva de tópico: um único vínculo matrícula/e-mail, sem criar reserva em Apresentações. Verificar que depois ele consegue reservar um tema normalmente.
5. Testar conta não autorizada, matrícula já vinculada a outra conta, resposta repetida, resposta após o prazo e leitura proibida de respostas e nomes dos colegas.
6. Conferir relatório agregado e individual (este último **contém nomes/UIDs e deve ser guardado em pasta privada do semestre**), pontuação, acessibilidade e estabilidade com estudantes usando Wi-Fi e dados móveis.
7. Com todos os testes aprovados, trocar o arquivo principal \`quiz/index.html\` para a implementação integrada; retirar dependências PeerJS da página principal. Manter um caminho de reversão.

As regras do projeto do Firebase não podem ser implantadas automaticamente pela mera alteração deste repositório. Enquanto não forem implantadas, a versão integrada pode mostrar \`Missing or insufficient permissions\`, comportamento esperado nesta etapa.

