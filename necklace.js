// SCT-002: On-device pose tracking and a sample necklace overlay.
// Load the AI dependency only after a user taps the button. A blocked CDN must not disable the UI.
import {PoseLandmarker, FaceLandmarker, FilesetResolver} from '@mediapipe/tasks-vision';
const video=document.getElementById('camera');
const canvas=document.getElementById('necklace-overlay');
const toggle=document.getElementById('necklace-toggle');
const hint=document.getElementById('necklace-hint');
const ctx=canvas.getContext('2d');
const debugCanvas=document.getElementById('tracking-overlay');
const debugCtx=debugCanvas.getContext('2d');
const debugToggle=document.getElementById('debug-tracking');
let debugEnabled=true;
debugToggle.addEventListener('change',()=>{debugEnabled=debugToggle.checked;if(!debugEnabled)debugCtx.clearRect(0,0,debugCanvas.width,debugCanvas.height)});
const productImage=new Image();
let productReady=false;
productImage.onload=()=>{productReady=true;hint.textContent='Necklace image ready'};
productImage.onerror=()=>{productReady=false};
const storedImage=localStorage.getItem('sct-necklace-image');
productImage.src=storedImage||'./necklace-001.png';
const productPicker=document.getElementById('product-picker');
productPicker.addEventListener('change',()=>{
 const file=productPicker.files?.[0];if(!file)return;
 if(!file.type.startsWith('image/')){hint.textContent='Choose a PNG or JPEG image';return}
 if(file.size>4*1024*1024){hint.textContent='Choose an image smaller than 4 MB';return}
 const reader=new FileReader();
 reader.onload=()=>{
  try{localStorage.setItem('sct-necklace-image',reader.result);productImage.src=reader.result;hint.textContent='Necklace saved on this device'}
  catch(e){productImage.src=reader.result;hint.textContent='Necklace loaded for this session; device storage unavailable'}
 };
 reader.readAsDataURL(file);
});
let landmarker=null, faceLandmarker=null, enabled=false, generation=0, lastVideoTime=-1, lastTrack=0, pose=null, facePose=null;
const collarSlider=document.getElementById('collar-offset');
const sizeSlider=document.getElementById('necklace-size');
const horizontalSlider=document.getElementById('horizontal-offset');
const angleSlider=document.getElementById('angle-offset');
const angleValue=document.getElementById('angle-value');
const horizontalValue=document.getElementById('horizontal-value');
const resetFit=document.getElementById('reset-fit');
const positionValue=document.getElementById('collar-value');
const sizeValue=document.getElementById('size-value');
function refreshCalibration(){positionValue.textContent=collarSlider.value;sizeValue.textContent=sizeSlider.value+'%';horizontalValue.textContent=horizontalSlider.value+'%';angleValue.textContent=angleSlider.value+'°'}
collarSlider.addEventListener('input',refreshCalibration);sizeSlider.addEventListener('input',refreshCalibration);horizontalSlider.addEventListener('input',refreshCalibration);angleSlider.addEventListener('input',refreshCalibration);
resetFit.addEventListener('click',()=>{collarSlider.value='-210';sizeSlider.value='90';horizontalSlider.value='0';angleSlider.value='0';refreshCalibration()});refreshCalibration();
function clear(){ctx.clearRect(0,0,canvas.width,canvas.height);debugCtx.clearRect(0,0,debugCanvas.width,debugCanvas.height)}
function resize(){const dpr=Math.min(window.devicePixelRatio||1,2);const r=canvas.getBoundingClientRect();const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}ctx.setTransform(dpr,0,0,dpr,0,0);if(debugCanvas.width!==w||debugCanvas.height!==h){debugCanvas.width=w;debugCanvas.height=h}debugCtx.setTransform(dpr,0,0,dpr,0,0);return {w:r.width,h:r.height}}
function point(p,w,h){const vw=video.videoWidth,vh=video.videoHeight;const scale=Math.min(w/vw,h/vh);const dw=vw*scale,dh=vh*scale;return {x:(w-dw)/2+(1-p.x)*dw,y:(h-dh)/2+p.y*dh}}
// Shoulder landmarks are used for the neck position; all coordinates are mirrored to match video.
let smooth=null, lastGoodTrack=0;
const TRACK_HOLD_MS=320;
function renderNecklace(){if(!smooth||!productReady)return false;const imageWidth=smooth.width;const imageHeight=imageWidth*productImage.naturalHeight/productImage.naturalWidth;ctx.save();ctx.translate(smooth.x,smooth.y);ctx.rotate(smooth.angle);ctx.drawImage(productImage,-imageWidth/2,0,imageWidth,imageHeight);ctx.restore();return true;}
function drawNecklace(landmarks,faceLandmarks,w,h){
 const left=landmarks[11],right=landmarks[12],nose=landmarks[0],chin=faceLandmarks?.[152];
 if(!left||!right||!nose||!chin||Math.min(left.visibility??1,right.visibility??1,nose.visibility??1)<.65)return false;
 const a=point(left,w,h),b=point(right,w,h),face=point(nose,w,h),jaw=point(chin,w,h);
 const span=Math.hypot(b.x-a.x,b.y-a.y);
 const shoulderY=(a.y+b.y)/2,shoulderX=(a.x+b.x)/2;
 if(span<65||!productReady||!Number.isFinite(span))return false;
 // A shoulder estimate above the face is not a reliable neckline.
 if(shoulderY<=jaw.y+span*.06)return false;
 // The top of the product must sit at the upper chest, never across the face.
 // Signed vertical calibration: -500 moves up by one shoulder span, +500 down.
 // Do not clamp against chin: it would defeat the user's manual adjustment.
 const collarAdjustment=Number(collarSlider.value)/500;
 const topY=shoulderY+span*(.12+collarAdjustment);
 const shoulderAngle=Math.atan2(b.y-a.y,b.x-a.x);
 const normalizedAngle=Math.atan2(Math.sin(shoulderAngle),Math.cos(shoulderAngle));
 const clampedAngle=Math.max(-Math.PI/9,Math.min(Math.PI/9,normalizedAngle));
 const adjustedAngle=clampedAngle+Number(angleSlider.value)*Math.PI/180;
 // Horizontal offset follows the person's body and rotates with their shoulders.
 const horizontalAdjustment=span*Number(horizontalSlider.value)/100;
 const target={x:shoulderX+Math.cos(adjustedAngle)*horizontalAdjustment,y:topY+Math.sin(adjustedAngle)*horizontalAdjustment,width:span*.88*(Number(sizeSlider.value)/100),angle:adjustedAngle};
 if(!smooth)smooth={...target};
 else{
  const distance=Math.hypot(target.x-smooth.x,target.y-smooth.y);
  // Faster response to intentional movement, stronger filtering when nearly still.
  const alpha=distance>span*.08?.30:.12;
  const maxStep=Math.max(5,span*.12);
  for(const k of ['x','y']){const delta=(target[k]-smooth[k])*alpha;smooth[k]+=Math.max(-maxStep,Math.min(maxStep,delta));}
  smooth.width+=Math.max(-span*.08,Math.min(span*.08,(target.width-smooth.width)*.16));
  const angleDelta=Math.atan2(Math.sin(target.angle-smooth.angle),Math.cos(target.angle-smooth.angle));
  smooth.angle+=Math.max(-.035,Math.min(.035,angleDelta*.18));
 }
 lastGoodTrack=performance.now();return renderNecklace();
}

// Prototype diagnostic overlay. Face tessellation is real Face Landmarker geometry;
// neck and shoulders are Pose Landmarker connections, not a hair mask.
function drawTrackingDebug(w,h){
 if(!debugEnabled||!video.videoWidth)return;
 const drawEdges=(landmarks,edges,color,lineWidth=1)=>{
  if(!landmarks||!edges)return;
  debugCtx.beginPath();debugCtx.strokeStyle=color;debugCtx.lineWidth=lineWidth;
  for(const edge of edges){const p=landmarks[edge.start],q=landmarks[edge.end];if(!p||!q)continue;
   const a=point(p,w,h),b=point(q,w,h);debugCtx.moveTo(a.x,a.y);debugCtx.lineTo(b.x,b.y)}
  debugCtx.stroke();
 };
 if(facePose){
  drawEdges(facePose,FaceLandmarker.FACE_LANDMARKS_TESSELATION,'rgba(70,230,255,.60)',.65);
  drawEdges(facePose,FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,'#6dff83',1.6);
  drawEdges(facePose,FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,'#ffe266',1.7);
  drawEdges(facePose,FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,'#ffe266',1.7);
  drawEdges(facePose,FaceLandmarker.FACE_LANDMARKS_LIPS,'#ff79d9',1.8);
  const chin=facePose[152];if(chin){const p=point(chin,w,h);debugCtx.fillStyle='#ff8b49';debugCtx.beginPath();debugCtx.arc(p.x,p.y,4,0,Math.PI*2);debugCtx.fill()}
 }
 if(pose){
  drawEdges(pose,[{start:11,end:12},{start:11,end:13},{start:12,end:14}], '#ff9c46',2.5);
  for(const id of [11,12]){const p=pose[id];if(!p)continue;const v=point(p,w,h);debugCtx.fillStyle='#ff9c46';debugCtx.beginPath();debugCtx.arc(v.x,v.y,5,0,Math.PI*2);debugCtx.fill()}
 }
 debugCtx.save();debugCtx.font='11px system-ui';debugCtx.fillStyle='#fff';debugCtx.shadowColor='#000';debugCtx.shadowBlur=4;
 debugCtx.fillText('Cyan: face mesh  Green: outline  Yellow: eyes',12,44);
 debugCtx.fillText('Pink: lips  Orange: chin/shoulders',12,59);
 debugCtx.restore();
}

let loadStage='idle';
async function load(){
 if(landmarker)return landmarker;
 loadStage='wasm';hint.textContent='Loading tracking engine…';
 let vision,lastError;
 for(const path of ['/wasm']){
  try{vision=await FilesetResolver.forVisionTasks(path);break}catch(e){lastError=e}
 }
 if(!vision)throw Error('Tracking engine unavailable: '+(lastError?.message||'unknown'));
 loadStage='model';hint.textContent='Loading pose model…';
 landmarker=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.55,minTrackingConfidence:.5});
 loadStage='face model';hint.textContent='Loading chin tracker…';
 faceLandmarker=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numFaces:1});
 loadStage='ready';return landmarker;
}
function loop(token){if(token!==generation||!enabled)return;const {w,h}=resize();clear();if(video.readyState>=2&&video.videoWidth){const now=performance.now();if(now-lastTrack>75&&video.currentTime!==lastVideoTime){lastTrack=now;lastVideoTime=video.currentTime;try{pose=landmarker.detectForVideo(video,now).landmarks?.[0]||null;facePose=faceLandmarker.detectForVideo(video,now).faceLandmarks?.[0]||null}catch(e){pose=null;facePose=null;hint.textContent='Tracking paused. Try restarting the mirror.'}}const found=pose?drawNecklace(pose,facePose,w,h):false;if(found)hint.textContent='Shreshta necklace · move slowly';else if(smooth&&now-lastGoodTrack<TRACK_HOLD_MS){renderNecklace();hint.textContent='Tracking…'}else{smooth=null;hint.textContent=productReady?'Move back: show your face, neck and both shoulders':'Necklace image not installed yet'}}drawTrackingDebug(w,h);requestAnimationFrame(()=>loop(token))}
function off(){enabled=false;generation++;pose=null;facePose=null;smooth=null;lastGoodTrack=0;clear();toggle.textContent='Try Necklace';toggle.setAttribute('aria-pressed','false');hint.textContent=''}
toggle.addEventListener('click',async()=>{if(enabled){off();return}if(!video.srcObject){hint.textContent='Start the mirror first';return}if(!productReady){hint.textContent='Tap Choose Necklace Image to add your product photo first';return}toggle.disabled=true;try{await load();if(!video.srcObject){off();return}enabled=true;generation++;toggle.textContent='Remove Necklace';toggle.setAttribute('aria-pressed','true');loop(generation)}catch(e){hint.textContent='Tracking failed at '+loadStage+': '+(e?.message||'unknown error');console.error('SCT-002 model loading failed',e)}finally{toggle.disabled=false}});
document.getElementById('stop').addEventListener('click',off);document.addEventListener('visibilitychange',()=>{if(document.hidden)off()});window.addEventListener('pagehide',off);
