# Trilha — Estúdio de Ofertas 2.0

Evolução do gerador original de cartazes da Trilha. A aplicação mantém a marca enviada, o recorte de fundo no navegador e a exportação, com editor visual, biblioteca de modelos e impressão em medidas reais. Continua sendo uma aplicação estática: não precisa de servidor de banco de dados, conta ou chave de API.

## Executar

Use o checkout existente; não é necessário criar outro repositório ou worktree. Requer Python 3 para servir os arquivos:

```sh
cd /workspace/etiquetas-trilha
python3 -m http.server 3000 --bind 0.0.0.0
```

Abra o servidor pelo encaminhamento de porta do seu ambiente. Os módulos, o armazenamento e o recorte de imagens devem ser usados por HTTP/HTTPS; abrir o HTML como arquivo não oferece o fluxo completo. Não há dependências npm para instalar nem etapa de build. O mesmo conteúdo funciona no GitHub Pages.

## Fluxo de trabalho

1. Escolha um modelo oficial na barra lateral. Os sete modelos incluem Trilha original, oferta especial, preço baixo, queima de estoque, porcentagem, produto com foto e nome/preço.
2. Edite produto, descrição, peso, preços, marca e validade. O preço anterior é opcional. O desconto usa centavos inteiros e só aparece quando existe economia real.
3. Em **Impressão**, escolha A3, A4 ou A5, vertical ou horizontal. Para etiquetas, escolha 6 × 3 cm, 4 × 6,5 cm, 4 × 4 cm, 10 × 15 cm, 3 × 9 cm ou dimensões próprias em milímetros.
4. Clique em um elemento no cartaz, arraste para mover e use a alça para redimensionar proporcionalmente. O painel permite fonte, peso, alinhamento, posição, tamanho e visibilidade. O logotipo conserva imagem, cores e proporções.
5. Baixe o PNG da arte individual em 300 dpi ou use **Imprimir / PDF** para gerar as páginas com medidas reais.

Os dados de um produto se repetem nas etiquetas. Esta versão não é um cadastro de estoque nem uma ferramenta de impressão em lote de produtos diferentes.

## Modelos e histórico

Os modelos oficiais são definidos no código e não são sobrescritos. **Salvar como modelo** cria uma personalização separada com layout, fontes, cores, chamada e formato, para reutilizar com outros produtos. **Restaurar modelo oficial** recupera o desenho original, mantendo produto, preços e imagens.

Desfazer/refazer conserva um passo por gesto de arrasto. Também pode usar Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z ou Ctrl/Cmd+Y quando estiver no cartaz; dentro dos campos de texto, o navegador mantém seus atalhos normais. Setas movem o elemento, Shift amplia o passo, Delete oculta e Esc remove a seleção.

O zoom oferece ajuste à tela e 100%. A visualização em tamanho real usa a convenção CSS de 96 px por polegada: o tamanho físico mostrado no monitor depende da escala do sistema e do navegador. A impressão usa milímetros, independentemente desse zoom.

## Impressão e etiquetas

Margens, espaçamento, limite de etiquetas por folha e quantidade total são configuráveis. O sistema calcula linhas, colunas e páginas A4, rejeitando configurações em que a etiqueta não cabe. A última página pode conter menos cópias. **Ver folha A4** mostra a primeira folha; a impressão inclui todas as páginas. As configurações podem ser salvas e aplicadas novamente.

Na janela de impressão, selecione o papel correto, **escala 100% / tamanho real**, margens zero e desative cabeçalhos/rodapés. Para guardar um PDF, escolha a impressora **Salvar como PDF**. A reprodução final depende das configurações e da área imprimível da impressora; faça uma prova física antes de uma tiragem. O PNG exporta uma arte individual, com dimensões e metadados correspondentes a 300 dpi.

## Fotos, logotipo e recorte

Fotos: PNG, JPG ou WebP de até 20 MB. Logotipo: mesmos formatos, até 5 MB. As imagens mantêm sua resolução original; a nitidez final depende da foto enviada e do tamanho utilizado no cartaz. O painel informa o DPI aproximado da foto no tamanho atual. Nenhum detalhe desfocado é reconstruído por IA.

O recorte usa ISNet/ONNX Runtime no próprio navegador, sem enviar fotos a um serviço externo. O primeiro uso carrega aproximadamente 91 MB do modelo e 13 MB do runtime, com indicação de progresso. Um worker mantém a interface utilizável durante o processamento. No host de teste, o recorte levou cerca de 11 segundos; o tempo depende do aparelho. Depois, a sessão é reutilizada e o modelo pode ser reaproveitado pelo cache do navegador.

A opção **Limpeza das bordas** ajusta a máscara sem executar novamente a identificação do produto. **Usar original** restaura a foto enviada. Sombras, reflexos, transparências ou fundos complexos ainda podem produzir sobras. O recorte aceita fotos de até 40 megapixels. Origem, integridade e licenças estão em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e [models/README.md](models/README.md).

## Dados salvos

O rascunho, incluindo foto e logotipo, é salvo em IndexedDB. Os modelos personalizados e configurações de impressão ficam em localStorage. O rascunho de texto da versão anterior é migrado automaticamente.

Os dados ficam neste navegador e dispositivo, sem sincronização em nuvem. Se o armazenamento de imagens não estiver disponível, o sistema salva os textos quando possível e informa a limitação. Limpar os dados do navegador também remove os rascunhos, modelos e configurações. O histórico de desfazer/refazer vale para a sessão atual.

## Arquitetura e verificação

- `app.js`: estado, histórico, formulários e integração.
- `poster-renderer.js`: modelos oficiais, formatação monetária e SVG com elementos editáveis.
- `visual-editor.js`: seleção, arrasto, redimensionamento e atalhos.
- `print-engine.js`: medidas, imposição, impressão e PNG com metadado de DPI.
- `persistence.js`: rascunhos, migração e configurações locais.
- `background-removal.js`: recorte de imagens, preservado da versão anterior.

Com Node.js 22 ou superior, execute os testes sem instalar pacotes:

```sh
npm test
```

Os testes verificam valores monetários, descontos, proteção dos modelos oficiais, proporções, distribuição em folha, limites de impressão e metadados do PNG. A integração também foi exercitada no Chromium: edição, zoom, arrasto, histórico, persistência de fotos/logotipo, modelos, exportação e impressão de etiquetas em múltiplas páginas.
