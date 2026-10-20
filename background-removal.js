/* Local inference using ONNX Runtime (MIT) and U²-Net (Apache-2.0).
   See THIRD_PARTY_NOTICES.md. No image is sent to a remote service. */
(() => {
  let sessionPromise, maskCache, maskRequest;
  const size = 320, pixels = size * size;
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
  async function getMask(source, image, progress) {
    if (maskCache?.source === source) {
      progress('Ajustando a limpeza das bordas…');
      return maskCache.mask;
    }
    if (maskRequest?.source === source) return maskRequest.promise;
    const request = { source };
    maskRequest = request;
    request.promise = (async () => {
      const session = await getSession(progress);
      progress('Identificando o produto e removendo o fundo…');
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
      const small = document.createElement('canvas'); small.width = small.height = size;
      const ctx = small.getContext('2d', {willReadFrequently: true});
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size); ctx.drawImage(image, 0, 0, size, size);
      const rgba = ctx.getImageData(0, 0, size, size).data;
      let max = 1;
      for (let i = 0; i < rgba.length; i += 4) max = Math.max(max, rgba[i], rgba[i+1], rgba[i+2]);
      const data = new Float32Array(3 * pixels), mean = [.485,.456,.406], std = [.229,.224,.225];
      for (let i=0; i<pixels; i++) for (let c=0;c<3;c++) data[c*pixels+i] = (rgba[i*4+c]/max-mean[c])/std[c];
      const input = new ort.Tensor('float32', data, [1,3,size,size]);
      let result;
      try {
        result = await session.run({[session.inputNames[0]]: input});
        const raw = result[session.outputNames[0]].data;
        let lo = Infinity, hi = -Infinity;
        for (let i=0;i<pixels;i++) {lo=Math.min(lo,raw[i]);hi=Math.max(hi,raw[i]);}
        if (!Number.isFinite(lo) || hi-lo<.00001) throw new Error('Não consegui identificar o produto. Tente uma foto com o produto mais destacado.');
        const mask = new Float32Array(pixels);
        for (let i=0;i<pixels;i++) mask[i]=(raw[i]-lo)/(hi-lo);
        if (maskRequest === request) maskCache = { source, mask };
        return mask;
      } finally {
        input.dispose();
        if (result) for (const tensor of Object.values(result)) tensor.dispose();
      }
    })();
    try { return await request.promise; }
    finally { if (maskRequest === request) maskRequest = undefined; }
  }
  function refineMask(mask, strength) {
    // Tighten only the uncertain fringe. High-confidence foreground stays opaque.
    const fraction = strength / 100, floor = .06 + .26 * fraction, ceiling = .94 - .10 * fraction;
    const alpha = new Float32Array(pixels);
    for (let i=0;i<pixels;i++) alpha[i]=Math.max(0,Math.min(1,(mask[i]-floor)/(ceiling-floor)));
    // Remove only tiny disconnected islands. Do not keep just the largest object:
    // a product pack may contain several separate pieces.
    const labels = new Int32Array(pixels), queue = new Int32Array(pixels), areas = [0];
    let largest = 0;
    for (let start=0;start<pixels;start++) {
      if (labels[start] || alpha[start] <= .02) continue;
      const label=areas.length;let head=0,tail=1;queue[0]=start;labels[start]=label;
      while (head<tail) {
        const i=queue[head++],x=i%size,y=Math.floor(i/size);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
          const nx=x+dx,ny=y+dy;
          if(nx<0||nx>=size||ny<0||ny>=size)continue;
          const next=ny*size+nx;
          if(!labels[next]&&alpha[next]>.02){labels[next]=label;queue[tail++]=next;}
        }
      }
      areas.push(tail);largest=Math.max(largest,tail);
    }
    const minimumArea = Math.max(2,Math.min(24,largest*.0015))*(.4+fraction);
    for (let i=0;i<pixels;i++) if (labels[i] && areas[labels[i]]<minimumArea) alpha[i]=0;
    return alpha;
  }
  // Reuses the last source's model mask when only strength changes; returns a PNG data URL.
  window.removeProductBackground = async (source, progress = () => {}, strength = 50) => {
    strength=Number(strength);strength=Number.isFinite(strength)?Math.max(0,Math.min(100,strength)):50;
    const blob = await (await fetch(source)).blob();
    const image = await createImageBitmap(blob);
    try {
      if (image.width * image.height > 40000000) throw new Error('Para recortar, escolha uma foto com até 40 megapixels.');
      const alpha = refineMask(await getMask(source,image,progress),strength);
      const small=document.createElement('canvas');small.width=small.height=size;
      const ctx=small.getContext('2d'),maskPixels=ctx.createImageData(size,size);
      let left=size,top=size,right=0,bottom=0;
      for (let i=0;i<pixels;i++) {
        maskPixels.data[i*4]=maskPixels.data[i*4+1]=maskPixels.data[i*4+2]=255;maskPixels.data[i*4+3]=Math.round(255*alpha[i]);
        if(alpha[i]>.15){left=Math.min(left,i%size);right=Math.max(right,i%size);top=Math.min(top,Math.floor(i/size));bottom=Math.max(bottom,Math.floor(i/size));}
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
