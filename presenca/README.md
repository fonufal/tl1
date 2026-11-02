# Presença — TL1 (piloto, não homologado)

Código-fonte de ferramenta complementar ao SIGAA, em diretório independente do repositório da disciplina.

## Fluxo

Professor: entrar no endereço /tl1/presenca/?painel=1 com conta autorizada em admins/{uid}; selecionar semestre/turma e data; abrir QR Code inicial (2 tempos) e final (2 tempos), de duração curta e com tokens distintos; conferir registros; registrar exceções com justificativa e auditoria; exportar CSV ou copiar grade tabulada.

Estudante: abrir QR no celular, com sessão Google já usada em Apresentações/quiz; registro depende de vínculo institucional ativo, e-mail institucional autenticado igual ao da lista SIGAA e validade do QR. Quem não reservou tópico em Apresentações pode fazer vínculo único de matrícula/e-mail usando quizIdentities e quizClaims existentes. Os dados do aluno não ficam no site público.

Um QR Code isolado não prova presença física: requer conferência presencial e há alternativa manual para estudantes sem telefone, conta Google institucional elegível ou rede.

## Banco e controle de acesso

Reaproveita o projeto Firebase tl1-apresentacoes e a coleção privada classes/{classId}/eligible, bem como registrations e quizIdentities. Dados de frequência são separados por classe:
- attendanceWindows/{YYYY-MM-DD_start|end}: etapa, data, prazo de expiração, token, autor
- attendanceWindows/{id}/marks/{uid}: criação única, autenticada, validada por regras com tempo de servidor
- attendanceWindows/{id}/corrections/{eligibilityId}: último ajuste administrativo
- attendanceWindows/{id}/correctionLogs/{eventId}: histórico de mudanças, sem exclusão pelo cliente

O painel administrativo só lista registros sob a permissão admins/{uid}. Estudantes só leem os próprios comprovantes e não têm acesso ao token armazenado no documento da janela. O token do QR Code é uma credencial temporária e não deve ser divulgado fora da sala.

## SIGAA e exportação

O PDF disponibilizado pelo docente em 02/11/2026 mostra a interface web de planilha da turma LETP239, 2026.2, turma 02, com colunas por data e 54 linhas de estudantes; a tela descreve lançamento por cliques nas células. Ela **não comprova** que CSV/XLSX possam ser importados ou que uma colagem múltipla funcione diretamente na grade do SIGAA.

O sistema gera:
- grade CSV em UTF-8, separada por ponto e vírgula;
- tabela TSV no clipboard para colar em planilha privada;
- botão Copiar só as faltas: resumo de exceções de encontros concluídos, com matrícula, nome e faltas em cada bloco. No SIGAA, o fluxo de menor esforço tende a ser indicar as presenças da data no cabeçalho e ajustar apenas essas exceções; o funcionamento exato dos cliques deve ser conferido na interface institucional;
- um valor por encontro completo: 0, 2 ou 4 **faltas**. Dias com apenas uma chamada continuam PENDENTE, não são convertidos automaticamente em falta; T depende do estado atual na lista autorizada.

Antes de lançar no SIGAA, conferir o calendário acadêmico, trancamentos, matrículas tardias, feriados, aulas canceladas e substituições. O SIGAA permanece o registro acadêmico oficial.

## Publicação obrigatória antes do uso

1. Comparar as regras em produção no console Firestore com apresentacoes/firestore.rules do GitHub. Fazer backup e mesclar qualquer alteração exclusiva do console. A implantação deve utilizar o **arquivo inteiro** (Apresentações + Quiz + Presença), nunca somente o trecho novo. O GitHub **não implanta** as regras do Firestore.
2. Implantar o arquivo combinado em Firebase > Firestore > Regras do projeto tl1-apresentacoes, preferencialmente após validar no Emulator.
3. Conferir admins/{uid} e classes/{classId}/eligible com a turma atual, inclusive situação de trancamento dos estudantes.
4. Testar com duas contas distintas e uma turma fictícia: ingresso autorizado, identidade já vinculada, primeira e segunda chamada, repetição, QR adulterado/expirado, aluno não matriculado, email Google pessoal, leitura de dados de colegas, correção justificada, CSV e clipboard.
5. Confirmar uso com rede móvel e Wi-Fi, leitores de tela, teclado e estudantes sem smartphone. Manter alternativa presencial.
6. Arquivar exportações apenas em área privada do semestre, respeitando LGPD. Jamais importar ou versionar listas de estudantes no GitHub.

**Status:** a interface e as regras foram criadas no repositório, mas a conexão real com o Firestore, a publicação das regras e o piloto com usuários não foram homologados. Não utilizar para lançamento oficial enquanto essas verificações estiverem pendentes.