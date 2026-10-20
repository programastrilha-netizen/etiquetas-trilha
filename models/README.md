# Modelo de recorte preciso

`isnet-general-use-fp16.onnx` é derivado do IS-Net general-use (DIS), de Xuebin Qin e colaboradores, sob Apache-2.0. Veja `LICENSE-ISNET.txt` e https://github.com/xuebinqin/DIS .

## Origem e integridade

- Modelo original: https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx
- MD5 publicado pelo rembg: `fc16ebd8b0c10d971d3513d564d01e29`.
- SHA256 original: `60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a`.
- SHA256 do arquivo distribuído: `05b09da7df30ae8f4c54dade1533855277584e79ee377506a5a2ecad82778532`.
- Tamanho distribuído: 90.635.832 bytes (86,44 MiB).

Os pesos maiores que 16 elementos são armazenados em FP16 e convertidos de volta a FP32 por nós Cast. A aritmética do modelo continua FP32; a conversão reduz o download sem quantizar as ativações. Somente a saída `output_image` é exposta; mapas intermediários que não são usados pela aplicação foram removidos das saídas públicas do grafo. O arquivo foi validado pelo ONNX checker. Comparação com o original na foto de teste de plantas: erro médio do alfa de 0,0144/255, IoU de 0,99966. Quantização dinâmica INT8 foi investigada e rejeitada por deteriorar o recorte.

## Reprodução opcional

Não é necessário gerar o modelo para executar o site; o arquivo pronto acompanha a aplicação. Para reproduzi-lo, use Python e um ambiente isolado com `onnx==1.23.2` e `numpy==2.5.4`:

```sh
curl -fL https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx -o /tmp/isnet-general-use.onnx
python3 models/prepare-isnet.py /tmp/isnet-general-use.onnx /tmp/isnet-derived.onnx
sha256sum /tmp/isnet-derived.onnx
```

O script verifica os hashes originais antes de converter os pesos.

## Inferência no navegador

- ONNX Runtime Web 1.21, WASM, uma thread, com proxy worker para manter a interface responsiva; sem envio da foto a serviço remoto.
- Entrada RGB em `[1,3,1024,1024]`, dividida pelo maior canal da foto reduzida e com média `0.5` subtraída, conforme o processamento oficial do rembg ISNet.
- Primeira saída normalizada por mínimo/máximo; máscara reaplicada à resolução da foto original, com limpeza ajustável e margens transparentes recortadas.
- Teste real por HTTP no Chromium: criação da sessão ~1 s, inferência ~11 s no host de desenvolvimento. Teste completo da interface com o modelo servido por HTTP: primeiro recorte em 12,65 s e 126 atualizações de uma rotina de 100 ms durante o processamento, confirmando que a interface permaneceu ativa. A velocidade varia com o aparelho; a primeira utilização também baixa o modelo.
- O recorte é uma previsão: fundos complexos, transparências, reflexos e produtos encostados em outros objetos continuam sujeitos a erros. A foto original permanece disponível.
