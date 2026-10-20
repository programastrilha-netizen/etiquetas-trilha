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
