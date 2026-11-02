# Portal TL1 — estudos de estrutura e design

A **direção 01 — Índice editorial** foi escolhida para aprofundamento em 2 de novembro de 2026. A homepage foi revisada, mas ainda precisa de aprovação final antes de derivar páginas internas. As direções 02 e 03 permanecem como referências exploratórias. O procedimento segue o documento do Google Drive **“01_PROTOCOLO_MESTRE — Identidades gráficas e websites”** (v1.0, setembro de 2026) e o escopo do Portal TL1 na pasta `05_Portal_e_Ferramentas/00_Portal_TL1`.

## Estratégia de implantação

A página de origem do repositório (`/tl1/`) continua pertencendo à ferramenta **Teoria em Voz Alta**. O Portal TL1 foi criado na rota independente `/tl1/portal/`, preservando as ferramentas existentes e seus URLs. As três propostas permanecem em arquivos separados; a barra de comparação foi retirada da homepage escolhida para não competir com a navegação do estudante:

- `index.html` + `styles.css` — **Índice editorial**: índice numerado, grandes escalas tipográficas, navegação aberta e módulos apresentados em linhas.
- `alternativas/caderno.html` — **Caderno de estudos**: editorial de leitura, navegação lateral e organização por capítulos.
- `alternativas/percurso.html` — **Percurso de aula**: organização por movimentos de aprendizagem, ordem de ações e amplas faixas cromáticas.

As três direções diferem em arquitetura, hierarquia, paleta e navegação. A direção 01 foi selecionada, mas sua versão revisada ainda está sujeita à validação visual final. Nenhuma ferramenta existente foi alterada.

## Fonte de informação

Conteúdo institucional estático e permanente. Nenhuma programação de semestre, nota, lista de alunos, horário de aula ou link institucional não verificado é incluído. As ferramentas publicadas mantêm os links:

- https://fonufal.github.io/tl1/ — Teoria em Voz Alta
- https://fonufal.github.io/tl1/apresentacoes/ — Apresentações

Quiz interativo e Chamada por QR Code são explicitamente exibidos como **planejados**, sem links falsos ou formulários funcionais. O SIGAA permanece fonte oficial para notas, presença, avisos e entregas.

## Orientação visual

Mapeamento: **percurso** → andamento; **estudo** → espaços e hierarquia editorial; **participação** → ações claramente identificadas; **continuidade** → numeração, remissões e módulos reutilizáveis. Cores econômicas, tipografia estrutural, pouco uso de cards, responsividade própria e ausência de fotografia decorativa.

Referências de princípio (não reproduzir layouts ou código): cursos organizados por syllabus/materiais/atividades do MIT OpenCourseWare; separação e indexação de conteúdo editorial da Wellcome Collection; tipografia como elemento de identidade na plataforma Are.na.

## Verificação mínima

Validar viewport desktop e mobile, ordem de tabulação, navegação por âncoras, leitura sem CSS, foco visível, distinção entre disponível e planejado, links preservados, ausência de dados pessoais, ausência de overflow horizontal e respeito a `prefers-reduced-motion`.

## Próxima etapa

Validar a versão revisada da homepage editorial em desktop e mobile. Só depois derivar páginas internas, carregar links de materiais e configurar dados específicos da turma atual.

## Revisão visual da direção 01 — 2 de novembro de 2026

- O cabeçalho identifica imediatamente a disciplina e seus três destinos principais, sem barra de comparação entre propostas.
- A abertura foi encurtada e inclui dois atalhos diretos para as ferramentas existentes.
- A seção Ferramentas antecede a área Estudar, ainda não preenchida com materiais canônicos.
- O sistema mantém composição editorial, serifada expressiva, sem serifa para leitura, paleta creme/verde/terracota, numeração e filetes.
- O mobile recebeu cabeçalho e navegação específicos: três destinos de 48 px de altura, colunas reordenadas, tipografia adaptada e estados de módulos preservados.
- Testes locais com capturas nos viewports 320, 390, 768, 1024 e 1440 px: não houve transbordamento horizontal; os dois únicos links de ferramentas apontam para os endereços já existentes; os módulos futuros permanecem não clicáveis.
- A conferência em navegador local usou fontes de reserva porque a execução de rede foi bloqueada. A avaliação final com as fontes web carregadas, além de teste completo com leitores de tela, segue pendente.

**Fontes de referência para decisões:** protocolo mestre de identidades gráficas e websites (Drive) e documento de escopo do Portal TL1. Não usar esta revisão para modificar os sites do Teoria em Voz Alta ou das Apresentações.
