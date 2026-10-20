const ids=['product','description','weight','oldPrice','price','unit','headline','store','validity','footer'];
const defaults=Object.fromEntries(ids.map(id=>[id,document.getElementById(id).value]));
let color='#07377c',photo='',logo='';
const escapeXML=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function amount(s){const cleaned=s.trim().replace(/\s|R\$/g,'');if(!/^\d+(?:[.,]\d{1,2})?$/.test(cleaned))return null;const n=Number(cleaned.replace(',','.'));return Number.isFinite(n)&&n>0?n:null;}
function lines(text,max){const words=text.trim().split(/\s+/);let rows=[''];for(const word of words){const i=rows.length-1;if(rows[i].length+word.length+1>max&&rows[i])rows.push(word);else rows[i]+=(rows[i]?' ':'')+word;}return rows;}
function render(){const v=Object.fromEntries(ids.map(id=>[id,document.getElementById(id).value]));const val=amount(v.price),old=amount(v.oldPrice);const price=(val??0).toFixed(2).split('.');const title=lines(v.product.toUpperCase(),photo?9:22);const x=photo?369:300;const anchor=photo?'start':'middle';const titleSize=photo?37:47;const brandSize=v.store.length>24?23:29;const valid=v.validity?`Válido até ${v.validity.split('-').reverse().join('/')}. `:'';
const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="1698" viewBox="0 0 600 849" role="img" aria-label="Cartaz de oferta de ${escapeXML(v.product)}"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#00183b"/></linearGradient><linearGradient id="yellow" x2="1" y2="1"><stop stop-color="#fff51c"/><stop offset="1" stop-color="#ffda00"/></linearGradient></defs><rect width="600" height="849" fill="url(#bg)"/><circle cx="-30" cy="-22" r="133" fill="none" stroke="${color}" stroke-width="48" opacity=".9"/><circle cx="620" cy="0" r="114" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="50"/><g font-family="Arial, sans-serif" fill="white">${logo?`<image data-store-logo="true" href="${logo}" x="190" y="14" width="220" height="58" preserveAspectRatio="xMidYMid meet"/>`:""}<text x="300" y="${logo?95:65}" text-anchor="middle" font-size="${logo?16:brandSize}" font-weight="900" letter-spacing="2">${escapeXML(v.store.toUpperCase())}</text><path d="${logo?"M200 106H400":"M200 82H400"}" stroke="white" stroke-opacity=".5"/><text x="300" y="182" text-anchor="middle" font-size="${v.headline.length>10?62:89}" font-weight="900" letter-spacing="-3">${escapeXML(v.headline)}</text><path d="M111 200Q300 194 489 200" fill="none" stroke="#3baaff" stroke-width="5" stroke-linecap="round"/><rect x="15" y="220" width="570" height="592" rx="22" fill="white"/>${photo?`<image href="${photo}" x="30" y="242" width="312" height="369" preserveAspectRatio="xMidYMid meet"/>`:''}<g fill="#031c45"><text x="${x}" y="${photo?295:335}" text-anchor="${anchor}" font-size="${titleSize}" font-weight="900">${title.slice(0,4).map((t,i)=>`<tspan x="${x}" dy="${i?titleSize+3:0}" ${t.length*(titleSize*.72)>(photo?188:510)?`textLength="${photo?188:510}" lengthAdjust="spacingAndGlyphs"`:""}>${escapeXML(t)}</tspan>`).join('')}</text><text x="${x}" y="${photo?295+Math.min(title.length,4)*(titleSize+3)+12:335+Math.min(title.length,4)*(titleSize+3)+12}" text-anchor="${anchor}" font-size="${photo?16:22}" ${v.description.length> (photo?20:44)?`textLength="${photo?188:510}" lengthAdjust="spacingAndGlyphs"`:""}>${escapeXML(v.description)}</text><text x="${x}" y="${photo?295+Math.min(title.length,4)*(titleSize+3)+39:335+Math.min(title.length,4)*(titleSize+3)+43}" text-anchor="${anchor}" font-size="20" font-weight="700">${escapeXML(v.weight)}</text>${old?`<path d="M${photo?369:175} 518H${photo?555:425}" stroke="#d2d8df" stroke-width="2"/><text x="${x}" y="549" text-anchor="${anchor}" font-size="16">De: R$ ${old.toFixed(2).replace('.',',')}</text><path d="M${photo?389:229} 550L${photo?508:375} 527" stroke="#d63135" stroke-width="2"/>`:''}</g><rect x="24" y="622" width="552" height="180" rx="21" fill="url(#yellow)"/><g fill="#031c45"><text x="44" y="662" font-size="25" font-weight="900">Por</text><text x="44" y="688" font-size="25" font-weight="900">apenas</text><path d="M44 700H131" stroke="#031c45" stroke-width="2"/><text x="44" y="754" font-size="44" font-weight="900">R$</text><text x="${price[0].length>2?144:152}" y="767" font-size="${price[0].length>3?85:price[0].length>2?112:145}" font-weight="900" letter-spacing="-8">${price[0]},</text><text x="529" y="709" text-anchor="end" font-size="83" font-weight="900" letter-spacing="-5">${price[1]}</text><text x="519" y="762" text-anchor="end" font-size="19" font-weight="700">${escapeXML(v.unit)}</text></g><text x="300" y="833" text-anchor="middle" font-size="${(valid+v.footer).length>95?7:9}" fill="white" opacity=".8">${escapeXML(valid+v.footer)}</text></g></svg>`;
document.getElementById('poster').innerHTML=svg;
try{localStorage.setItem('trilha-offer',JSON.stringify({v,color}));document.querySelector('.local').lastChild.textContent=' Salvo neste navegador';}catch{document.querySelector('.local').lastChild.textContent=' Prévia local';}
return svg;}
try{const saved=JSON.parse(localStorage.getItem('trilha-offer'));if(saved?.v){ids.forEach(id=>{if(typeof saved.v[id]==='string')document.getElementById(id).value=saved.v[id]});if(/^#[0-9a-f]{6}$/i.test(saved.color))color=saved.color;}}catch{}
function updateSwatches(){document.querySelectorAll('.swatch').forEach(b=>{const active=b.dataset.color===color;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});}
document.getElementById('editor').addEventListener('input',render);
document.querySelectorAll('.swatch').forEach(b=>b.onclick=()=>{color=b.dataset.color;updateSwatches();render();});
function bindImageUpload(id,errorId,onChange){
const input=document.getElementById(id),remove=document.getElementById('remove-'+id),error=document.getElementById(errorId);
let version=0;
input.addEventListener('change',async()=>{
const current=++version,f=input.files[0];if(!f)return;error.textContent='';
const limit=id==='photo'?20:5;
if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>limit*1024*1024){error.textContent=`Escolha uma imagem PNG, JPG ou WebP de até ${limit} MB.`;input.value='';return;}
try{
const bitmap=await createImageBitmap(f);const {width,height}=bitmap;bitmap.close();
const original=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(f);});
if(current!==version)return;
onChange(original);remove.hidden=false;
if(id==='photo'){
const scale=Math.min(1290/width,1525/height),dpi=Math.round(300/scale);
const info=document.getElementById('photo-quality');info.hidden=false;info.classList.toggle('low-quality',dpi<250);
info.textContent=`${width} × ${height} px · ${dpi>=250?'Boa resolução para impressão.':'Resolução baixa para impressão. Prefira uma foto maior e bem iluminada.'} Foto original preservada, sem cortes.`;
}
render();
}catch{if(current===version)error.textContent='Não foi possível abrir essa imagem. Tente outro arquivo.';}
});
remove.onclick=()=>{version++;onChange('');input.value='';remove.hidden=true;error.textContent='';if(id==='photo'){document.getElementById('photo-quality').hidden=true;document.getElementById('photo-quality').textContent='';}render();};
}
let originalPhoto='',photoGeneration=0,backgroundBusy=false;
const cutButton=document.getElementById('cut-background'),restoreButton=document.getElementById('restore-photo'),backgroundStatus=document.getElementById('background-status');
async function cutBackground(){
if(!originalPhoto||backgroundBusy)return;
const generation=++photoGeneration,source=originalPhoto;
backgroundBusy=true;cutButton.disabled=true;cutButton.textContent='Removendo fundo…';
document.getElementById('error').textContent='';
try{
const result=await window.removeProductBackground(source,message=>{if(generation===photoGeneration)backgroundStatus.textContent=message;});
if(generation!==photoGeneration)return;
photo=result;restoreButton.hidden=false;render();backgroundStatus.textContent='Fundo removido! O produto já está no cartaz.';
}catch(error){if(generation===photoGeneration){backgroundStatus.textContent='A foto original foi mantida.';document.getElementById('error').textContent=/^(Não (foi possível|consegui)|Para recortar)/.test(error.message||'')?error.message:'Não foi possível remover o fundo. Verifique a conexão e tente novamente com uma foto menor.';}}
finally{if(generation===photoGeneration){backgroundBusy=false;cutButton.disabled=!originalPhoto;cutButton.textContent='Remover fundo novamente';}}
}
cutButton.onclick=cutBackground;
restoreButton.onclick=()=>{photoGeneration++;backgroundBusy=false;photo=originalPhoto;restoreButton.hidden=true;cutButton.disabled=!originalPhoto;cutButton.textContent='Remover fundo';backgroundStatus.textContent='Foto original restaurada.';render();};
bindImageUpload('photo','error',value=>{
photoGeneration++;backgroundBusy=false;originalPhoto=value;photo=value;restoreButton.hidden=true;cutButton.disabled=!value;cutButton.textContent='Remover fundo';backgroundStatus.textContent='';
if(value&&document.getElementById('auto-background').checked)cutBackground();
});
bindImageUpload('logo','logo-error',value=>logo=value);
function validate(){if(backgroundBusy){document.getElementById('status').textContent='Aguarde a remoção do fundo antes de exportar ou imprimir.';return false;}if(!document.getElementById('editor').reportValidity())return false;if(amount(document.getElementById('price').value)===null){document.getElementById('status').textContent='Informe um preço de oferta válido, como 6,99.';return false;}if(document.getElementById('oldPrice').value.trim()&&amount(document.getElementById('oldPrice').value)===null){document.getElementById('status').textContent='Corrija o preço original ou deixe o campo vazio.';return false;}document.getElementById('status').textContent='';return true;}
document.getElementById('print').onclick=()=>{if(validate())window.print();};
document.getElementById('download').onclick=async()=>{if(!validate())return;const btn=document.getElementById('download');btn.disabled=true;const url=URL.createObjectURL(new Blob([render()],{type:'image/svg+xml;charset=utf-8'}));try{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=2480;c.height=3508;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,c.width,c.height);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error();const link=document.createElement('a');const downloadURL=URL.createObjectURL(blob);link.href=downloadURL;link.download='oferta-trilha.png';link.click();setTimeout(()=>URL.revokeObjectURL(downloadURL),1000);document.getElementById('status').textContent='Cartaz exportado em alta resolução: 2480 × 3508 px (A4 a 300 dpi).';}catch{document.getElementById('status').textContent='Não foi possível exportar. Você pode usar a opção Imprimir.';}finally{URL.revokeObjectURL(url);btn.disabled=false;}};
document.getElementById('reset').onclick=()=>{if(!confirm('Limpar as alterações e começar um novo cartaz?'))return;ids.forEach(id=>document.getElementById(id).value=defaults[id]);color='#07377c';document.getElementById('remove-photo').click();document.getElementById('remove-logo').click();updateSwatches();document.getElementById('status').textContent='';render();};
updateSwatches();render();
