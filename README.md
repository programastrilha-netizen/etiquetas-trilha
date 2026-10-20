# Trilha · Estúdio de ofertas

Gerador de cartazes para mercado, com prévia em tempo real, foto do produto, preços, cores, nome e logotipo da loja e validade. Exporta PNG (2480 × 3508, equivalente a A4 em 300 dpi) e imprime A4, inclusive em PDF pelo navegador.

## Executar

Requer Python 3, sem dependências externas de aplicação:

```sh
cd /workspace/etiquetas-trilha
python3 -m http.server 3000 --bind 0.0.0.0
```

Abra o servidor no navegador pelo encaminhamento de porta do seu ambiente. Os textos são salvos no armazenamento local do navegador; fotos e logotipos precisam ser reenviados após recarregar. Nenhum dado é enviado para um servidor. Fontes externas são opcionais, com fallback local.

## Uso

1. Preencha produto, descrição e peso. Adicione uma foto PNG, JPG ou WebP de até 20 MB.
2. Informe os preços com vírgula ou ponto; o preço original é opcional.
3. Personalize nome da loja, cor, validade e rodapé. Envie o logotipo da loja em PNG, JPG ou WebP de até 5 MB (prefira PNG transparente).
4. Baixe o PNG ou imprima em A4. Na caixa de impressão, escolha salvar como PDF se desejar.

Esta versão cria um cartaz por vez. Não possui cadastro de produtos, login ou sincronização entre dispositivos.

As imagens são incorporadas ao cartaz sem redução de resolução e sem cortes. O sistema mostra as dimensões e avisa sobre resolução baixa para impressão. A qualidade final depende da foto original; não há reconstrução de detalhes por IA.

## Remover o fundo da foto

Ao enviar uma foto, o recorte automático é ativado por padrão. Aguarde a mensagem de conclusão para exportar ou imprimir. Desmarque a opção antes de enviar para usar a foto inteira, ou clique em “Usar foto original” para desfazer. O botão “Remover fundo” permite tentar manualmente. As margens vazias ao redor do recorte são ajustadas para destacar o produto no cartaz; a foto original permanece disponível para restaurar.

O processamento usa ISNet/ONNX Runtime no navegador, sem enviar a imagem a servidores. O modelo preciso ocupa cerca de 91 MB, mais 13 MB do runtime, carregados do próprio site na primeira utilização com indicação de progresso. As utilizações seguintes reaproveitam a sessão e o cache do navegador. O tempo varia com o aparelho; no teste de desktop, a identificação levou cerca de 11 segundos por foto. O resultado pode variar com o fundo e a iluminação, e sombras/reflexos podem exigir ajuste das bordas ou outra foto. Fotos de até 40 megapixels podem ser recortadas. Os arquivos de modelo e runtime devem ser publicados junto do site. Para executar localmente, use o servidor Python documentado acima; o recorte não funciona abrindo o HTML diretamente por `file://`. Consulte THIRD_PARTY_NOTICES.md para origem e licenças.

Após o recorte, ajuste “Limpeza das bordas” para retirar sombras e sobras suaves ou preservar mais detalhes. Ajustes fortes podem apagar detalhes de baixo contraste; a opção de restaurar a foto original continua disponível. A máscara é reutilizada durante esses ajustes, sem executar novamente a identificação do produto.

A descrição usa quebra de linhas e tamanho adaptável. O preço original aparece em um bloco destacado com valor grande, risco vermelho e economia calculada quando for maior que o preço da oferta.
