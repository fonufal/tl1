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
