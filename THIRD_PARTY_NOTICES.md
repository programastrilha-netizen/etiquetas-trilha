# Componentes do recorte de fundo

O recorte é executado localmente no navegador. O código da aplicação não depende de um serviço pago ou chave de API.

- ONNX Runtime Web **1.21.0**, Microsoft, licença MIT. Arquivos distribuídos sem alterações em `vendor/onnx/`, obtidos de `https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/`. Licença: `vendor/onnx/LICENSE.txt`; outros avisos: `vendor/onnx/ThirdPartyNotices.txt`. Código-fonte: https://github.com/microsoft/onnxruntime/tree/v1.21.0
- IS-Net general-use (DIS), Xuebin Qin e colaboradores, licença Apache-2.0. O modelo em `models/isnet-general-use-fp16.onnx` usa armazenamento FP16 dos pesos com computação FP32 e apenas a primeira saída. Origem, modificações, hashes e reprodução estão em `models/README.md`; licença original em `models/LICENSE-ISNET.txt`. Código-fonte: https://github.com/xuebinqin/DIS

O modelo é uma ferramenta de segmentação geral: o resultado pode variar com fundo, iluminação, transparência e contornos do produto. A foto original pode ser restaurada.
