// SCT-002: On-device pose tracking and a sample necklace overlay.
// Load the AI dependency only after a user taps the button. A blocked CDN must not disable the UI.
let PoseLandmarker, FilesetResolver;
const video=document.getElementById('camera');
const canvas=document.getElementById('necklace-overlay');
const toggle=document.getElementById('necklace-toggle');
const hint=document.getElementById('necklace-hint');
const ctx=canvas.getContext('2d');
const productImage=new Image();let productReady=false;productImage.onload=()=>{productReady=true};productImage.onerror=()=>{productReady=false};productImage.src='./products/necklace-001.png';
let landmarker=null, enabled=false, generation=0, lastVideoTime=-1, lastTrack=0, pose=null;
function clear(){ctx.clearRect(0,0,canvas.width,canvas.height)}
function resize(){const dpr=Math.min(window.devicePixelRatio||1,2);const r=canvas.getBoundingClientRect();const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}ctx.setTransform(dpr,0,0,dpr,0,0);return {w:r.width,h:r.height}}
function point(p,w,h){const vw=video.videoWidth,vh=video.videoHeight;const scale=Math.min(w/vw,h/vh);const dw=vw*scale,dh=vh*scale;return {x:(w-dw)/2+(1-p.x)*dw,y:(h-dh)/2+p.y*dh}}
function drawNecklace(landmarks,w,h){
 const left=landmarks[11],right=landmarks[12],nose=landmarks[0];
 if(!left||!right||!nose||Math.min(left.visibility??1,right.visibility??1)<.55)return false;
 const a=point(left,w,h),b=point(right,w,h);const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
 const width=Math.hypot(b.x-a.x,b.y-a.y);if(width<35)return false;
 const angle=Math.atan2(b.y-a.y,b.x-a.x);const size=width*.78;
 ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.lineCap='round';
 if(productReady){const imgWidth=size*1.18;const imgHeight=imgWidth*productImage.naturalHeight/productImage.naturalWidth;ctx.drawImage(productImage,-imgWidth/2,-size*.18,imgWidth,imgHeight);ctx.restore();return true;}
 // Curved gold chain, hanging from the approximate collar area.
 const top=-size*.10,bottom=size*.53;
 ctx.shadowColor='#b98738';ctx.shadowBlur=6;
 ctx.beginPath();ctx.moveTo(-size*.50,top);ctx.bezierCurveTo(-size*.47,size*.23,-size*.22,bottom,0,bottom);ctx.bezierCurveTo(size*.22,bottom,size*.47,size*.23,size*.50,top);
 ctx.strokeStyle='#6e4715';ctx.lineWidth=Math.max(4,size*.035);ctx.stroke();
 ctx.shadowBlur=0;ctx.strokeStyle='#f6d57b';ctx.lineWidth=Math.max(2,size*.020);ctx.stroke();
 for(let i=0;i<=12;i++){const t=i/12;const x=(t-.5)*size;const y=top+(bottom-top)*Math.pow(Math.max(0,1-Math.pow(Math.abs(2*t-1),1.7)),.85);ctx.beginPath();ctx.ellipse(x,y,Math.max(3,size*.035),Math.max(4,size*.048),0,0,Math.PI*2);ctx.fillStyle=i%2?'#e4b954':'#fff0a8';ctx.fill();ctx.strokeStyle='#8a601e';ctx.lineWidth=1;ctx.stroke()}
 ctx.beginPath();ctx.moveTo(0,bottom-size*.03);ctx.lineTo(-size*.12,bottom+size*.16);ctx.lineTo(0,bottom+size*.36);ctx.lineTo(size*.12,bottom+size*.16);ctx.closePath();ctx.fillStyle='#d5a643';ctx.fill();ctx.strokeStyle='#fff0aa';ctx.lineWidth=2;ctx.stroke();
 ctx.beginPath();ctx.ellipse(0,bottom+size*.14,size*.05,size*.075,0,0,Math.PI*2);ctx.fillStyle='#a52a50';ctx.fill();ctx.restore();return true;
}
let loadStage='idle';
async function load(){
 if(landmarker)return landmarker;
 if(!PoseLandmarker){
  loadStage='library';hint.textContent='Loading tracking library…';
  let lastError;
  for(const url of ['https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm','https://esm.sh/@mediapipe/tasks-vision@0.10.22']){
   try{const sdk=await import(url);if(!sdk.PoseLandmarker||!sdk.FilesetResolver)throw Error('Missing exports');PoseLandmarker=sdk.PoseLandmarker;FilesetResolver=sdk.FilesetResolver;break}catch(e){lastError=e}
  }
  if(!PoseLandmarker)throw Error('Library unavailable: '+(lastError?.message||'unknown'));
 }
 loadStage='wasm';hint.textContent='Loading tracking engine…';
 let vision,lastError;
 for(const path of ['https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm','https://unpkg.com/@mediapipe/tasks-vision@0.10.22/wasm']){
  try{vision=await FilesetResolver.forVisionTasks(path);break}catch(e){lastError=e}
 }
 if(!vision)throw Error('Tracking engine unavailable: '+(lastError?.message||'unknown'));
 loadStage='model';hint.textContent='Loading pose model…';
 landmarker=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.55,minTrackingConfidence:.5});
 loadStage='ready';return landmarker;
}
function loop(token){if(token!==generation||!enabled)return;const {w,h}=resize();clear();if(video.readyState>=2&&video.videoWidth){const now=performance.now();if(now-lastTrack>75&&video.currentTime!==lastVideoTime){lastTrack=now;lastVideoTime=video.currentTime;try{pose=landmarker.detectForVideo(video,now).landmarks?.[0]||null}catch(e){pose=null;hint.textContent='Tracking paused. Try restarting the mirror.'}}if(pose){const found=drawNecklace(pose,w,h);if(found)hint.textContent=productReady?'Shreshta necklace · move slowly':'Sample necklace · product image pending';else hint.textContent='Keep your shoulders visible'}else hint.textContent='Move back so your face and shoulders are visible'}requestAnimationFrame(()=>loop(token))}
function off(){enabled=false;generation++;pose=null;clear();toggle.textContent='Try Necklace';toggle.setAttribute('aria-pressed','false');hint.textContent=''}
toggle.addEventListener('click',async()=>{if(enabled){off();return}if(!video.srcObject){hint.textContent='Start the mirror first';return}toggle.disabled=true;try{await load();if(!video.srcObject){off();return}enabled=true;generation++;toggle.textContent='Remove Necklace';toggle.setAttribute('aria-pressed','true');loop(generation)}catch(e){hint.textContent='Tracking failed at '+loadStage+': '+(e?.message||'unknown error');console.error('SCT-002 model loading failed',e)}finally{toggle.disabled=false}});
document.getElementById('stop').addEventListener('click',off);document.addEventListener('visibilitychange',()=>{if(document.hidden)off()});window.addEventListener('pagehide',off);
