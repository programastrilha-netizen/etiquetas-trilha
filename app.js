const ids=['product','description','weight','oldPrice','price','unit','headline','store','validity','footer'];
const defaults=Object.fromEntries(ids.map(id=>[id,document.getElementById(id).value]));
let color='#07377c',photo='',logo='';
const escapeXML=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function amount(s){const cleaned=s.trim().replace(/\s|R\$/g,'');if(!/^\d+(?:[.,]\d{1,2})?$/.test(cleaned))return null;const n=Number(cleaned.replace(',','.'));return Number.isFinite(n)&&n>0?n:null;}
// Measure the complete price so the cents follow the comma for any digit count.
const priceMeasure=document.createElement('canvas').getContext('2d');
function priceLayout(integer,cents){
const maxWidth=390,baseSize=184,centRatio=1;
function widths(size){priceMeasure.font=`900 ${size}px Arial`;const whole=priceMeasure.measureText(integer+',').width;priceMeasure.font=`900 ${size*centRatio}px Arial`;return {whole,cents:priceMeasure.measureText(cents).width};}
let size=baseSize,measured=widths(size);
const natural=measured.whole+measured.cents+4;
if(natural>maxWidth){size*=maxWidth/natural;measured=widths(size);}
const total=measured.whole+measured.cents+4;
return {size,centSize:size*centRatio,start:148+(maxWidth-total)/2,centX:measured.whole+4,centY:764,total};
}
function textWidth(text,size,weight='400'){
priceMeasure.font=`${weight} ${size}px Arial`;
return priceMeasure.measureText(text).width;
}
function wrapMeasured(text,width,size,weight='400'){
const rows=[];let row='';
for(const word of text.trim().split(/\s+/).filter(Boolean)){
if(row&&textWidth(row+' '+word,size,weight)>width){rows.push(row);row='';}
let piece='';
for(const char of word){if(piece&&textWidth(piece+char,size,weight)>width){rows.push(piece);piece='';}piece+=char;}
if(row)row+=' '+piece;else row=piece;
}
if(row)rows.push(row);
return rows;
}
function productDetails(v,old,current,hasPhoto){
const colX=hasPhoto?360:62,width=hasPhoto?196:476,top=250,bottom=605;
let titleSize=hasPhoto?42:50,descriptionSize=hasPhoto?26:30,weightSize=22,layout;
for(let attempt=0;attempt<25;attempt++){
const titleRows=wrapMeasured(v.product.toUpperCase(),width,titleSize,'900');
const descriptionRows=wrapMeasured(v.description,width,descriptionSize,'500');
const titleHeight=titleRows.length*titleSize*1.08;
const descriptionHeight=descriptionRows.length*descriptionSize*1.2;
const bodyHeight=titleHeight+(descriptionRows.length?12+descriptionHeight:0)+(v.weight?10+weightSize:0);
layout={titleRows,descriptionRows,titleHeight,bodyHeight};
const longestWord=Math.max(0,...v.product.toUpperCase().trim().split(/\s+/).map(word=>textWidth(word,titleSize,'900')));
if(bodyHeight<=(bottom-top)-(old?126:0)&&(longestWord<=width||titleSize===22))break;
titleSize=Math.max(22,titleSize-1);descriptionSize=Math.max(18,descriptionSize-1);weightSize=Math.max(18,weightSize-.25);
}
const textX=hasPhoto?colX:300,anchor=hasPhoto?'start':'middle';let cursor=top;
let svg=`<g fill="#031c45" data-product-details="true">`;
if(layout.titleRows.length){svg+=`<text data-product-title="true" x="${textX}" y="${cursor+titleSize*.82}" text-anchor="${anchor}" font-size="${titleSize}" font-weight="900">${layout.titleRows.map((row,index)=>`<tspan x="${textX}" dy="${index?titleSize*1.08:0}">${escapeXML(row)}</tspan>`).join('')}</text>`;cursor+=layout.titleHeight;}
if(layout.descriptionRows.length){cursor+=12;svg+=`<text data-product-description="true" x="${textX}" y="${cursor+descriptionSize*.82}" text-anchor="${anchor}" font-size="${descriptionSize}" font-weight="500">${layout.descriptionRows.map((row,index)=>`<tspan x="${textX}" dy="${index?descriptionSize*1.2:0}">${escapeXML(row)}</tspan>`).join('')}</text>`;cursor+=layout.descriptionRows.length*descriptionSize*1.2;}
if(v.weight){cursor+=10;const size=Math.min(weightSize,weightSize*width/Math.max(1,textWidth(v.weight,weightSize,'700')));svg+=`<text data-product-weight="true" x="${textX}" y="${cursor+size*.82}" text-anchor="${anchor}" font-size="${size}" font-weight="700">${escapeXML(v.weight)}</text>`;cursor+=weightSize;}
if(old){
const boxX=hasPhoto?colX:170,boxWidth=hasPhoto?width:260,boxTop=cursor+16,boxHeight=Math.min(180,bottom-boxTop);
const value=old.toFixed(2).replace('.',','),numberSize=Math.min(54,(boxWidth-32)/Math.max(1,textWidth(value,54,'900'))*54);
const valueX=boxX+16,valueY=boxTop+Math.min(97,boxHeight-38),valueWidth=textWidth(value,numberSize,'900');
const savings=current&&old>current?`ECONOMIZE R$ ${(old-current).toFixed(2).replace('.',',')}`:'PREÇO ANTERIOR';
const savingsSize=Math.min(13,13*(boxWidth-32)/Math.max(1,textWidth(savings,13,'700')));
svg+=`<g data-old-price="true"><rect x="${boxX}" y="${boxTop}" width="${boxWidth}" height="${boxHeight}" rx="12" fill="#edf3fb" stroke="#dce6f4"/><text x="${valueX}" y="${boxTop+28}" font-size="16" font-weight="700" fill="#566a85">DE R$</text><text data-old-price-value="true" x="${valueX}" y="${valueY}" font-size="${numberSize}" font-weight="900">${value}</text><path d="M${valueX-2} ${valueY-4}L${valueX+valueWidth+2} ${valueY-numberSize*.62}" stroke="#d12f3d" stroke-width="3" stroke-linecap="round"/><text x="${valueX}" y="${boxTop+boxHeight-15}" font-size="${savingsSize}" font-weight="700" fill="${current&&old>current?'#176145':'#566a85'}">${escapeXML(savings)}</text></g>`;
}
return svg+'</g>';
}
function render(){const v=Object.fromEntries(ids.map(id=>[id,document.getElementById(id).value]));const val=amount(v.price),old=amount(v.oldPrice);const price=(val??0).toFixed(2).split('.');const pricePosition=priceLayout(price[0],price[1]);const brandSize=v.store.length>24?23:29;const valid=v.validity?`Válido até ${v.validity.split('-').reverse().join('/')}. `:'';
const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="1698" viewBox="0 0 600 849" role="img" aria-label="Cartaz de oferta de ${escapeXML(v.product)}"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#00183b"/></linearGradient><linearGradient id="yellow" x2="1" y2="1"><stop stop-color="#fff51c"/><stop offset="1" stop-color="#ffda00"/></linearGradient><filter id="offer-shadow" x="-5%" y="-10%" width="110%" height="130%" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#991b1b" flood-opacity=".22"/></filter></defs><rect width="600" height="849" fill="url(#bg)"/><circle cx="-30" cy="-22" r="133" fill="none" stroke="${color}" stroke-width="48" opacity=".9"/><circle cx="620" cy="0" r="114" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="50"/><g font-family="Arial, sans-serif" fill="white">${logo?`<image data-store-logo="true" href="${logo}" x="190" y="14" width="220" height="58" preserveAspectRatio="xMidYMid meet"/>`:""}<text x="300" y="${logo?95:65}" text-anchor="middle" font-size="${logo?16:brandSize}" font-weight="900" letter-spacing="2">${escapeXML(v.store.toUpperCase())}</text><path d="${logo?"M200 106H400":"M200 82H400"}" stroke="white" stroke-opacity=".5"/><text x="300" y="182" text-anchor="middle" font-size="${v.headline.length>10?62:89}" font-weight="900" letter-spacing="-3">${escapeXML(v.headline)}</text><path d="M111 200Q300 194 489 200" fill="none" stroke="#3baaff" stroke-width="5" stroke-linecap="round"/><rect x="15" y="220" width="570" height="592" rx="22" fill="white"/>${photo?`<image href="${photo}" x="30" y="242" width="312" height="369" preserveAspectRatio="xMidYMid meet"/>`:''}${productDetails(v,old,val,!!photo)}<rect data-offer-highlight="true" x="24" y="622" width="552" height="180" rx="21" fill="url(#yellow)" stroke="#cf1826" stroke-width="3" filter="url(#offer-shadow)"/><g fill="#031c45"><text x="44" y="662" font-size="25" font-weight="900">Por</text><text x="44" y="688" font-size="25" font-weight="900">apenas</text><path d="M44 700H131" stroke="#031c45" stroke-width="2"/><text x="44" y="754" font-size="44" font-weight="900" fill="#cf1826">R$</text><g data-price-group="true" fill="#cf1826" transform="translate(${pricePosition.start},0)"><text data-price-whole="true" x="0" y="764" font-size="${pricePosition.size}" font-weight="900">${price[0]},</text><text data-price-cents="true" x="${pricePosition.centX}" y="${pricePosition.centY}" font-size="${pricePosition.centSize}" font-weight="900">${price[1]}</text><text data-price-unit="true" fill="#031c45" x="${pricePosition.total}" y="789" text-anchor="end" font-size="19" font-weight="700">${escapeXML(v.unit)}</text></g></g><text x="300" y="833" text-anchor="middle" font-size="${(valid+v.footer).length>95?7:9}" fill="white" opacity=".8">${escapeXML(valid+v.footer)}</text></g></svg>`;
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
const refinement=document.getElementById('background-refinement'),strength=document.getElementById('background-strength');
const cutButton=document.getElementById('cut-background'),restoreButton=document.getElementById('restore-photo'),backgroundStatus=document.getElementById('background-status');
async function cutBackground(){
if(!originalPhoto||backgroundBusy)return;
const generation=++photoGeneration,source=originalPhoto;
backgroundBusy=true;strength.disabled=true;cutButton.disabled=true;cutButton.textContent='Removendo fundo…';
document.getElementById('error').textContent='';
try{
const result=await window.removeProductBackground(source,message=>{if(generation===photoGeneration)backgroundStatus.textContent=message;},Number(strength.value));
if(generation!==photoGeneration)return;
photo=result;restoreButton.hidden=false;refinement.hidden=false;render();backgroundStatus.textContent='Fundo removido! O produto já está no cartaz.';
}catch(error){if(generation===photoGeneration){backgroundStatus.textContent='A imagem anterior foi mantida.';document.getElementById('error').textContent=/^(Não (foi possível|consegui)|Para recortar)/.test(error.message||'')?error.message:'Não foi possível remover o fundo. Verifique a conexão e tente novamente com uma foto menor.';}}
finally{if(generation===photoGeneration){backgroundBusy=false;strength.disabled=false;cutButton.disabled=!originalPhoto;cutButton.textContent='Remover fundo novamente';}}
}
cutButton.onclick=cutBackground;
strength.addEventListener('input',()=>{document.getElementById('background-strength-value').textContent=Number(strength.value)<30?'Suave':Number(strength.value)>70?'Forte':'Equilibrada';});
strength.addEventListener('change',()=>{if(originalPhoto&&!backgroundBusy)cutBackground();});
restoreButton.onclick=()=>{photoGeneration++;backgroundBusy=false;strength.disabled=false;refinement.hidden=true;photo=originalPhoto;restoreButton.hidden=true;cutButton.disabled=!originalPhoto;cutButton.textContent='Remover fundo';backgroundStatus.textContent='Foto original restaurada.';render();};
bindImageUpload('photo','error',value=>{
photoGeneration++;backgroundBusy=false;strength.disabled=false;refinement.hidden=true;originalPhoto=value;photo=value;restoreButton.hidden=true;cutButton.disabled=!value;cutButton.textContent='Remover fundo';backgroundStatus.textContent='';
if(value&&document.getElementById('auto-background').checked)cutBackground();
});
bindImageUpload('logo','logo-error',value=>logo=value);
function validate(){if(backgroundBusy){document.getElementById('status').textContent='Aguarde a remoção do fundo antes de exportar ou imprimir.';return false;}if(!document.getElementById('editor').reportValidity())return false;if(amount(document.getElementById('price').value)===null){document.getElementById('status').textContent='Informe um preço de oferta válido, como 6,99.';return false;}if(document.getElementById('oldPrice').value.trim()&&amount(document.getElementById('oldPrice').value)===null){document.getElementById('status').textContent='Corrija o preço original ou deixe o campo vazio.';return false;}document.getElementById('status').textContent='';return true;}
document.getElementById('print').onclick=()=>{if(validate())window.print();};
document.getElementById('download').onclick=async()=>{if(!validate())return;const btn=document.getElementById('download');btn.disabled=true;const url=URL.createObjectURL(new Blob([render()],{type:'image/svg+xml;charset=utf-8'}));try{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=2480;c.height=3508;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,c.width,c.height);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error();const link=document.createElement('a');const downloadURL=URL.createObjectURL(blob);link.href=downloadURL;link.download='oferta-trilha.png';link.click();setTimeout(()=>URL.revokeObjectURL(downloadURL),1000);document.getElementById('status').textContent='Cartaz exportado em alta resolução: 2480 × 3508 px (A4 a 300 dpi).';}catch{document.getElementById('status').textContent='Não foi possível exportar. Você pode usar a opção Imprimir.';}finally{URL.revokeObjectURL(url);btn.disabled=false;}};
document.getElementById('reset').onclick=()=>{if(!confirm('Limpar as alterações e começar um novo cartaz?'))return;ids.forEach(id=>document.getElementById(id).value=defaults[id]);color='#07377c';strength.value='50';document.getElementById('background-strength-value').textContent='Equilibrada';document.getElementById('remove-photo').click();document.getElementById('remove-logo').click();updateSwatches();document.getElementById('status').textContent='';render();};
updateSwatches();render();
