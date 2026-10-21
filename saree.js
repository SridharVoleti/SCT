import {PoseLandmarker,FilesetResolver} from '@mediapipe/tasks-vision';
const video=document.getElementById('camera'),canvas=document.getElementById('overlay'),ctx=canvas.getContext('2d'),status=document.getElementById('status'),start=document.getElementById('start'),stop=document.getElementById('stop'),guide=document.getElementById('guide'),select=document.getElementById('saree'),picker=document.getElementById('fabric');
let poseModel,stream,active=false,landmarks=null,photo=null,lastFrame=-1,lastDetect=0,token=0;
const opacity=document.getElementById('fabric-opacity'),opacityValue=document.getElementById('opacity-value');opacity.addEventListener('input',()=>opacityValue.textContent=opacity.value+'%');
const palette={yellowpurple:['#eac642','#7650ae'],rose:['#a52c64','#f7a3ca'],teal:['#096b72','#61d8cb'],gold:['#9b6519','#f5d383']};
function dimensions(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(r.width*d)||canvas.height!==Math.round(r.height*d)){canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d)}ctx.setTransform(d,0,0,d,0,0);return [r.width,r.height]}
function pt(p,w,h){const scale=Math.min(w/video.videoWidth,h/video.videoHeight),vw=video.videoWidth*scale,vh=video.videoHeight*scale;return {x:(w-vw)/2+(1-p.x)*vw,y:(h-vh)/2+p.y*vh}}
function path(points,fill,stroke,width=2){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}}
function line(a,b,color,width=2){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
function draw(w,h){
 ctx.clearRect(0,0,w,h);
 // Human outline stays visible before the pose model has a reliable full-body track.
 const cx=w/2,cy=h*.48,scale=Math.min(w*.72,h*.8);
 if(guide.checked){ctx.save();ctx.setLineDash([9,7]);ctx.strokeStyle='#b4f7e1';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(cx,cy-scale*.33,scale*.09,scale*.12,0,0,Math.PI*2);ctx.stroke();line({x:cx-scale*.24,y:cy-scale*.18},{x:cx+scale*.24,y:cy-scale*.18},'#b4f7e1');ctx.beginPath();ctx.moveTo(cx-scale*.24,cy-scale*.18);ctx.lineTo(cx-scale*.17,cy+scale*.12);ctx.lineTo(cx-scale*.14,cy+scale*.47);ctx.moveTo(cx+scale*.24,cy-scale*.18);ctx.lineTo(cx+scale*.17,cy+scale*.12);ctx.lineTo(cx+scale*.14,cy+scale*.47);ctx.stroke();ctx.restore()}
 if(!landmarks||!video.videoWidth)return;
 const ids=[11,12,23,24,25,26,27,28];if(ids.some(i=>!landmarks[i]||(landmarks[i].visibility??1)<.48))return;
 const [ls,rs,lh,rh,lk,rk,la,ra]=ids.map(i=>pt(landmarks[i],w,h));
 const shoulder=Math.hypot(ls.x-rs.x,ls.y-rs.y),hip=Math.hypot(lh.x-rh.x,lh.y-rh.y);
 if(shoulder<35||hip<20)return;
 const center=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
 const waist=center(lh,rh),knees=center(lk,rk),ankles=center(la,ra);
 const fullBody=ankles.y>h*.72&&Math.min(ls.y,rs.y)<h*.46;
 status.textContent=fullBody?'Body tracked · adjust your position and choose a saree':'Step back until your shoulders, hips and feet are visible';
 const [base,shine]=palette[select.value]||palette.yellowpurple;
 const leftHip=lh.x<rh.x?lh:rh,rightHip=lh.x<rh.x?rh:lh;
 const leftShoulder=ls.x<rs.x?ls:rs,rightShoulder=ls.x<rs.x?rs:ls;
 const hemY=Math.min(h*.99,Math.max(ankles.y,waist.y+hip*2.2));
 const skirt=[{x:leftHip.x-hip*.18,y:waist.y},{x:rightHip.x+hip*.18,y:waist.y},{x:rightHip.x+hip*.70,y:hemY},{x:leftHip.x-hip*.70,y:hemY}];
 ctx.save();ctx.globalAlpha=Number(opacity.value)/100;path(skirt,base,'#ffe8b7',1.3);
 const pallu=[{x:rightShoulder.x-shoulder*.09,y:rightShoulder.y},{x:rightShoulder.x+shoulder*.19,y:rightShoulder.y},{x:rightHip.x+hip*.2,y:waist.y+hip*.25},{x:waist.x-hip*.25,y:waist.y+hip*.24},{x:leftHip.x-hip*.07,y:waist.y},{x:waist.x,y:waist.y-hip*.18}];
 path(pallu,shine,'#fff1c5',1.2);
 if(select.value==='yellowpurple'){
  // Distinctive gold zari hem: multiple bands and subtle woven highlights.
  ctx.save();ctx.beginPath();skirt.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
  const borderTop=hemY-Math.max(18,(hemY-waist.y)*.19);const grad=ctx.createLinearGradient(0,borderTop,0,hemY);grad.addColorStop(0,'#c5a24a');grad.addColorStop(.25,'#f8e79b');grad.addColorStop(.62,'#c6a441');grad.addColorStop(1,'#fff0ac');ctx.fillStyle=grad;ctx.fillRect(skirt[3].x,borderTop,skirt[2].x-skirt[3].x,hemY-borderTop);ctx.fillStyle='#fff4bd';ctx.fillRect(skirt[3].x,hemY-5,skirt[2].x-skirt[3].x,3);
  ctx.strokeStyle='#fff6cb55';ctx.lineWidth=.7;for(let y=borderTop+4;y<hemY;y+=5){ctx.beginPath();ctx.moveTo(skirt[3].x,y);ctx.lineTo(skirt[2].x,y);ctx.stroke()}ctx.restore();
  // Sparse buttas on the body, clipped to the drape.
  ctx.save();ctx.beginPath();skirt.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();ctx.fillStyle='#fff2aa99';const step=Math.max(22,hip*.40);for(let y=waist.y+step*.6;y<borderTop-step*.2;y+=step){for(let x=skirt[3].x+step*.5;x<skirt[2].x;x+=step){ctx.beginPath();ctx.ellipse(x+Math.sin(y*.05)*step*.15,y,step*.09,step*.15,-.3,0,Math.PI*2);ctx.fill()}}ctx.restore();
  // Purple pallu, metallic gold transition bands and small woven detailing.
  ctx.save();ctx.beginPath();pallu.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();ctx.strokeStyle='#f6d77d';ctx.lineWidth=Math.max(5,shoulder*.065);line({x:rightShoulder.x+shoulder*.10,y:rightShoulder.y},{x:rightHip.x+hip*.12,y:waist.y+hip*.25},'#e8ce79',Math.max(5,shoulder*.065));line({x:rightShoulder.x+shoulder*.15,y:rightShoulder.y},{x:rightHip.x+hip*.18,y:waist.y+hip*.25},'#f9e5a6',2);ctx.restore();
 }
 for(let i=1;i<=5;i++){const x=skirt[3].x+(skirt[2].x-skirt[3].x)*i/6;line({x:waist.x+(x-waist.x)*.20,y:waist.y+5},{x,y:hemY},'#ffe7b877',1)}
 if(photo?.complete&&photo.naturalWidth){ctx.save();ctx.beginPath();skirt.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();ctx.globalAlpha=.26;ctx.drawImage(photo,skirt[3].x,waist.y,skirt[2].x-skirt[3].x,hemY-waist.y);ctx.restore()}
 ctx.restore();
 if(guide.checked){for(const [a,b] of [[ls,rs],[ls,lh],[rs,rh],[lh,rh],[lh,lk],[rh,rk],[lk,la],[rk,ra]])line(a,b,'#8df5db',2);for(const p of [ls,rs,lh,rh,lk,rk,la,ra]){ctx.fillStyle='#a8fff0';ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill()}}
}
async function frame(id){if(!active||id!==token)return;const [w,h]=dimensions();const now=performance.now();if(video.readyState>=2&&now-lastDetect>110&&video.currentTime!==lastFrame){lastFrame=video.currentTime;lastDetect=now;try{landmarks=poseModel.detectForVideo(video,now).landmarks?.[0]||null}catch(e){status.textContent='Tracking unavailable';landmarks=null}}draw(w,h);requestAnimationFrame(()=>frame(id))}
start.onclick=async()=>{start.disabled=true;status.textContent='Loading full-body tracker…';try{const vision=await FilesetResolver.forVisionTasks('/wasm');poseModel=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1});stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:720},height:{ideal:1280}}});video.srcObject=stream;await video.play();active=true;stop.disabled=false;frame(++token)}catch(e){status.textContent='Could not start camera or body tracking. Check permission and network.';start.disabled=false;if(stream)stream.getTracks().forEach(t=>t.stop())}};
function halt(){active=false;token++;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;landmarks=null;start.disabled=false;stop.disabled=true;status.textContent='Camera off'}stop.onclick=halt;window.addEventListener('pagehide',halt);document.addEventListener('visibilitychange',()=>{if(document.hidden)halt()});
picker.onchange=()=>{const f=picker.files?.[0];if(!f)return;if(!f.type.startsWith('image/')||f.size>5*1024*1024){status.textContent='Choose an image under 5 MB';return}const url=URL.createObjectURL(f),img=new Image();img.onload=()=>{if(photo?.dataset?.url)URL.revokeObjectURL(photo.dataset.url);photo=img;img.dataset.url=url;status.textContent='Saree image loaded locally (rough texture preview)'};img.onerror=()=>URL.revokeObjectURL(url);img.src=url};
