import {cpSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const source='node_modules/@mediapipe/tasks-vision/wasm';
if(!existsSync(source))throw new Error('MediaPipe WASM assets not installed: '+source);
const target='public/wasm';mkdirSync(target,{recursive:true});
for(const name of readdirSync(source)){if(/\.(wasm|js)$/.test(name))cpSync(join(source,name),join(target,name))}
console.log('Copied MediaPipe runtime files to '+target);
