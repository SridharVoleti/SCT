(function(){
'use strict';
const canvas=document.getElementById('manual-overlay'),ctx=canvas.getContext('2d');
const status=document.getElementById('status'),toggle=document.getElementById('manual-fit');
const size=document.getElementById('manual-size'),x=document.getElementById('manual-x'),y=document.getElementById('manual-y'),opacity=document.getElementById('fabric-opacity'),sel=document.getElementById('saree');
let enabled=true;
function paint(){
 const box=canvas.getBoundingClientRect(),w=box.width,h=box.height,d=Math.min(window.devicePixelRatio||1,2);
 if(!w||!h)return;
 canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);
 if(!enabled)return;
 const k=Number(size.value)/100,cx=w*(.5+Number(x.value)/100),cy=h*(.48+Number(y.value)/100);
 const shoulder=w*.35*k,hip=w*.29*k,top=cy-h*.26*k,waist=cy+h*.02*k,hem=Math.min(h*.97,cy+h*.46*k),alpha=Number(opacity.value)/100;
 const colors={yellowpurple:['#edcc4c','#7650ad'],rose:['#ab3367','#f3a4c7'],teal:['#11727c','#61d8cb'],gold:['#a67521','#f5d383']};
 const [base,pallu]=colors[sel.value]||colors.yellowpurple;
 function polygon(p,color){ctx.beginPath();p.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fillStyle=color;ctx.fill()}
 const left=cx-hip*.68,right=cx+hip*.68;
 ctx.save();ctx.globalAlpha=alpha;
 polygon([[cx-hip*.55,waist],[cx+hip*.55,waist],[right+hip*.45,hem],[left-hip*.45,hem]],base);
 const borderH=Math.max(18,(hem-waist)*.20);
 const gradient=ctx.createLinearGradient(0,hem-borderH,0,hem);gradient.addColorStop(0,'#b9943b');gradient.addColorStop(.32,'#fff0a6');gradient.addColorStop(.68,'#b99232');gradient.addColorStop(1,'#f6d36e');
 ctx.fillStyle=gradient;ctx.fillRect(left-hip*.45,hem-borderH,right-left+hip*.9,borderH);
 ctx.fillStyle='#fff3ad';ctx.fillRect(left-hip*.45,hem-5,right-left+hip*.9,3);
 ctx.fillStyle='#fff1a4b0';for(let row=0;row<4;row++)for(let col=0;col<4;col++){const mx=cx+(col-1.5)*hip*.36,my=waist+25+row*(hem-waist-borderH-35)/4;ctx.beginPath();ctx.ellipse(mx,my,3.5,6,-.3,0,Math.PI*2);ctx.fill()}
 polygon([[cx+shoulder*.20,top],[cx+shoulder*.57,top],[cx+hip*.65,waist+h*.07],[cx-hip*.30,waist+h*.08],[cx-hip*.15,waist],[cx+shoulder*.06,top+h*.06]],pallu);
 ctx.strokeStyle='#f8df87';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(cx+shoulder*.51,top);ctx.lineTo(cx+hip*.60,waist+h*.07);ctx.stroke();
 ctx.strokeStyle='#fff0b6';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cx+shoulder*.43,top);ctx.lineTo(cx+hip*.53,waist+h*.07);ctx.stroke();
 ctx.restore();
}
window.addEventListener('resize',paint);
for(const el of [size,x,y,opacity,sel])el.addEventListener('input',paint);
toggle.addEventListener('click',()=>{enabled=!enabled;canvas.style.display=enabled?'block':'none';toggle.textContent=enabled?'Manual fit: ON':'Manual fit: OFF';paint();});
const observer=new ResizeObserver(paint);observer.observe(canvas.parentElement);
window.requestAnimationFrame(paint);
window.setTimeout(paint,300);
window.__sareeManualFallback=true;
})();