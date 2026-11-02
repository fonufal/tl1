# Portal TL1 — estudos de estrutura e design

Este diretório contém propostas **exploratórias**, não uma homepage definitiva. O procedimento segue o documento do Google Drive **“01_PROTOCOLO_MESTRE — Identidades gráficas e websites”** (v1.0, setembro de 2026) e o escopo do Portal TL1 na pasta `05_Portal_e_Ferramentas/00_Portal_TL1`.

## Estratégia de implantação

A página de origem do repositório (`/tl1/`) continua pertencendo à ferramenta **Teoria em Voz Alta**. O Portal TL1 foi criado na rota independente `/tl1/portal/`, preservando as ferramentas existentes e seus URLs. As propostas são comparáveis em links acessíveis por teclado:

- `index.html` + `styles.css` — **Índice editorial**: índice numerado, grandes escalas tipográficas, navegação aberta e módulos apresentados em linhas.
- `alternativas/caderno.html` — **Caderno de estudos**: editorial de leitura, navegação lateral e organização por capítulos.
- `alternativas/percurso.html` — **Percurso de aula**: organização por movimentos de aprendizagem, ordem de ações e amplas faixas cromáticas.

Estas três direções são distintas em arquitetura, hierarquia, paleta e navegação. A publicação **não implica aprovação** do Gate 1/2; cabe validar a direção antes de consolidar páginas internas.

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

Escolher e validar uma direção. Só depois derivar outras páginas, carregar links de materiais e configurar dados específicos da turma atual.