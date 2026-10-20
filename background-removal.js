/* Local inference using ONNX Runtime (MIT) and U²-Net (Apache-2.0).
   See THIRD_PARTY_NOTICES.md. No image is sent to a remote service. */
(() => {
  let sessionPromise;
  const base = new URL('.', document.currentScript.src);
  function loadRuntime() {
    if (window.ort) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('vendor/onnx/ort.wasm.min.js', base).href;
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error('Não foi possível carregar o recorte. Verifique a conexão e tente novamente.')); };
      document.head.append(script);
    });
  }
  async function getSession(progress) {
    if (!sessionPromise) {
      sessionPromise = (async () => {
        progress('Preparando o recorte na primeira utilização…');
        await loadRuntime();
        ort.env.wasm.wasmPaths = new URL('vendor/onnx/', base).href;
        ort.env.wasm.numThreads = 1;
        return ort.InferenceSession.create(new URL('models/u2netp.onnx', base).href, {
          executionProviders: ['wasm'], graphOptimizationLevel: 'all'
        });
      })().catch(error => { sessionPromise = undefined; throw error; });
    }
    return sessionPromise;
  }
  window.removeProductBackground = async (source, progress = () => {}) => {
    const session = await getSession(progress);
    progress('Identificando o produto e removendo o fundo…');
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    const blob = await (await fetch(source)).blob();
    const image = await createImageBitmap(blob);
    try {
      if (image.width * image.height > 40000000) throw new Error('Para recortar, escolha uma foto com até 40 megapixels.');
      const size = 320, pixels = size * size;
      const small = document.createElement('canvas'); small.width = small.height = size;
      const ctx = small.getContext('2d', {willReadFrequently: true});
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size); ctx.drawImage(image, 0, 0, size, size);
      const rgba = ctx.getImageData(0, 0, size, size).data;
      let max = 1;
      for (let i = 0; i < rgba.length; i += 4) max = Math.max(max, rgba[i], rgba[i+1], rgba[i+2]);
      const data = new Float32Array(3 * pixels), mean = [.485,.456,.406], std = [.229,.224,.225];
      for (let i=0; i<pixels; i++) for (let c=0;c<3;c++) data[c*pixels+i] = (rgba[i*4+c]/max-mean[c])/std[c];
      const result = await session.run({[session.inputNames[0]]: new ort.Tensor('float32', data, [1,3,size,size])});
      const mask = result[session.outputNames[0]].data;
      let lo = Infinity, hi = -Infinity;
      for (let i=0;i<pixels;i++) {lo=Math.min(lo,mask[i]);hi=Math.max(hi,mask[i]);}
      if (!Number.isFinite(lo) || hi-lo<.00001) throw new Error('Não consegui identificar o produto. Tente uma foto com o produto mais destacado.');
      const maskPixels = ctx.createImageData(size,size);
      let left=size,top=size,right=0,bottom=0;
      for (let i=0;i<pixels;i++) {
        const alpha=Math.max(0,Math.min(1,((mask[i]-lo)/(hi-lo)-.08)/.84));
        maskPixels.data[i*4]=maskPixels.data[i*4+1]=maskPixels.data[i*4+2]=255;maskPixels.data[i*4+3]=Math.round(255*alpha);
        if(alpha>.15){left=Math.min(left,i%size);right=Math.max(right,i%size);top=Math.min(top,Math.floor(i/size));bottom=Math.max(bottom,Math.floor(i/size));}
      }
      if(left>right||top>bottom)throw new Error('Não consegui identificar o produto. Tente uma foto com fundo mais simples.');
      left=Math.max(0,left-5);top=Math.max(0,top-5);right=Math.min(size,right+6);bottom=Math.min(size,bottom+6);
      const sx=Math.floor(left*image.width/size),sy=Math.floor(top*image.height/size);
      const width=Math.min(image.width-sx,Math.ceil((right-left)*image.width/size));
      const height=Math.min(image.height-sy,Math.ceil((bottom-top)*image.height/size));
      ctx.putImageData(maskPixels,0,0);
      progress('Finalizando o produto com fundo transparente…');
      const output = document.createElement('canvas');output.width=width;output.height=height;
      const out = output.getContext('2d');out.drawImage(image,sx,sy,width,height,0,0,width,height);
      out.globalCompositeOperation='destination-in';out.imageSmoothingEnabled=true;out.imageSmoothingQuality='high';
      out.drawImage(small,-sx,-sy,image.width,image.height);
      const png = await new Promise(resolve=>output.toBlob(resolve,'image/png'));
      if (!png) throw new Error('Não foi possível gerar o recorte. Tente uma foto menor.');
      return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(png);});
    } finally {image.close();}
  };
})();
