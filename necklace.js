// SCT-002: On-device pose tracking and a sample necklace overlay.
// Load the AI dependency only after a user taps the button. A blocked CDN must not disable the UI.
import {PoseLandmarker, FaceLandmarker, FilesetResolver} from '@mediapipe/tasks-vision';
const video=document.getElementById('camera');
const canvas=document.getElementById('necklace-overlay');
const toggle=document.getElementById('necklace-toggle');
const hint=document.getElementById('necklace-hint');
const ctx=canvas.getContext('2d');
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
function clear(){ctx.clearRect(0,0,canvas.width,canvas.height)}
function resize(){const dpr=Math.min(window.devicePixelRatio||1,2);const r=canvas.getBoundingClientRect();const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}ctx.setTransform(dpr,0,0,dpr,0,0);return {w:r.width,h:r.height}}
function point(p,w,h){const vw=video.videoWidth,vh=video.videoHeight;const scale=Math.min(w/vw,h/vh);const dw=vw*scale,dh=vh*scale;return {x:(w-dw)/2+(1-p.x)*dw,y:(h-dh)/2+p.y*dh}}
// Shoulder landmarks are used for the neck position; all coordinates are mirrored to match video.
let smooth=null;
function drawNecklace(landmarks,faceLandmarks,w,h){
 const left=landmarks[11],right=landmarks[12],nose=landmarks[0],chin=faceLandmarks?.[152];
 if(!left||!right||!nose||!chin||Math.min(left.visibility??1,right.visibility??1,nose.visibility??1)<.65){smooth=null;return false}
 const a=point(left,w,h),b=point(right,w,h),face=point(nose,w,h),jaw=point(chin,w,h);
 const span=Math.hypot(b.x-a.x,b.y-a.y);
 const shoulderY=(a.y+b.y)/2,shoulderX=(a.x+b.x)/2;
 if(span<65||!productReady||!Number.isFinite(span)){smooth=null;return false}
 // A shoulder estimate above the face is not a reliable neckline.
 if(shoulderY<=jaw.y+span*.06){smooth=null;return false}
 // The top of the product must sit at the upper chest, never across the face.
 const collarAdjustment=Number(collarSlider.value)/100;
 const topY=Math.max(shoulderY+span*(.12+collarAdjustment),jaw.y+span*.30);
 const target={x:shoulderX,y:topY,width:span*.88,angle:Math.atan2(b.y-a.y,b.x-a.x)};
 if(!smooth)smooth=target;
 else{
  const alpha=.12;
  // Reset instead of slowly drifting after a sudden detection jump.
  if(Math.hypot(target.x-smooth.x,target.y-smooth.y)>span*.35)smooth=target;
  else for(const k of ['x','y','width','angle'])smooth[k]+=alpha*(target[k]-smooth[k]);
 }
 const imageWidth=smooth.width;
 const imageHeight=imageWidth*productImage.naturalHeight/productImage.naturalWidth;
 ctx.save();ctx.translate(smooth.x,smooth.y);ctx.rotate(smooth.angle);
 ctx.drawImage(productImage,-imageWidth/2,0,imageWidth,imageHeight);
 ctx.restore();return true;
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
function loop(token){if(token!==generation||!enabled)return;const {w,h}=resize();clear();if(video.readyState>=2&&video.videoWidth){const now=performance.now();if(now-lastTrack>75&&video.currentTime!==lastVideoTime){lastTrack=now;lastVideoTime=video.currentTime;try{pose=landmarker.detectForVideo(video,now).landmarks?.[0]||null;facePose=faceLandmarker.detectForVideo(video,now).faceLandmarks?.[0]||null}catch(e){pose=null;facePose=null;hint.textContent='Tracking paused. Try restarting the mirror.'}}if(pose){const found=drawNecklace(pose,facePose,w,h);if(found)hint.textContent='Shreshta necklace · move slowly';else hint.textContent=productReady?'Move back: show your face, neck and both shoulders':'Necklace image not installed yet'}else hint.textContent='Move back so your face and shoulders are visible'}requestAnimationFrame(()=>loop(token))}
function off(){enabled=false;generation++;pose=null;facePose=null;smooth=null;clear();toggle.textContent='Try Necklace';toggle.setAttribute('aria-pressed','false');hint.textContent=''}
toggle.addEventListener('click',async()=>{if(enabled){off();return}if(!video.srcObject){hint.textContent='Start the mirror first';return}if(!productReady){hint.textContent='Tap Choose Necklace Image to add your product photo first';return}toggle.disabled=true;try{await load();if(!video.srcObject){off();return}enabled=true;generation++;toggle.textContent='Remove Necklace';toggle.setAttribute('aria-pressed','true');loop(generation)}catch(e){hint.textContent='Tracking failed at '+loadStage+': '+(e?.message||'unknown error');console.error('SCT-002 model loading failed',e)}finally{toggle.disabled=false}});
document.getElementById('stop').addEventListener('click',off);document.addEventListener('visibilitychange',()=>{if(document.hidden)off()});window.addEventListener('pagehide',off);
