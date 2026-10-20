# Componentes do recorte de fundo

O recorte é executado localmente no navegador. O código da aplicação não depende de um serviço pago ou chave de API.

- ONNX Runtime Web **1.21.0**, Microsoft, licença MIT. Arquivos distribuídos sem alterações em `vendor/onnx/`, obtidos de `https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/`. Licença: `vendor/onnx/LICENSE.txt`. Código-fonte: https://github.com/microsoft/onnxruntime/tree/v1.21.0
- U²-Net, Xuebin Qin e colaboradores, licença Apache-2.0. Modelo compacto U2NETP distribuído em `models/u2netp.onnx`, obtido de https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx . MD5 publicado pelo projeto rembg: `8e83ca70e441ab06c318d82300c84806`. Licença: `models/LICENSE-U2NET.txt`. Código-fonte: https://github.com/xuebinqin/U-2-Net

O modelo é uma ferramenta de segmentação geral: o resultado pode variar com fundo, iluminação, transparência e contornos do produto. A foto original pode ser restaurada.
