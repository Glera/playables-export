/* v13: source-preserving presentation and explicitly requested transfer timing/collision fixes. */
(() => {
'use strict';
let cc,scene,api,stats,clock=0;const flights=[],stackSlots=new WeakMap(),coinSlots=new WeakMap(),patched=new WeakSet();
const flightDuration=.5,flightGap=.095,channels=new Map(),artCache=new Map();
const path=n=>n.parent?path(n.parent)+'/'+n.name:'/'+n.name;
const nodes=(root=scene)=>{const list=[];const walk=n=>{list.push(n);n.children.forEach(walk)};walk(root);return list;};
const comp=t=>nodes().map(n=>n.getComponent(t)).find(Boolean);
function frame(texture){const f=new cc.SpriteFrame();f.texture=texture;return f;}
function texture(canvas){const t=new cc.Texture2D();t.image=new cc.ImageAsset(canvas);return t;}
function solidArt(tex,alpha=true){const m=new cc.Material();m.initialize({effectName:'builtin-unlit',defines:{USE_TEXTURE:true,USE_ALPHA_TEST:alpha,USE_INSTANCING:true}});m.setProperty('mainTexture',tex);if(alpha)m.setProperty('alphaThreshold',.3);return m;}
async function loadArt(key){const im=new Image();im.src='./polish-art/'+key+'.png';await im.decode();const c=document.createElement('canvas');c.width=640;c.height=Math.round(640*im.height/im.width);c.getContext('2d').drawImage(im,0,0,c.width,c.height);const t=texture(c);artCache.set(key,{texture:t,material:solidArt(t),aspect:im.height/im.width});return artCache.get(key);}
function quadMesh(w,h){return cc.utils.createMesh({positions:[-w/2,0,0,w/2,0,0,w/2,h,0,-w/2,h,0],normals:[0,0,1,0,0,1,0,0,1,0,0,1],uvs:[0,1,1,1,1,0,0,0],indices:[0,1,2,0,2,3]},undefined,{calculateBounds:true});}
function billboard(parent,name,key,x,y,z,width,height){const art=artCache.get(key),n=new cc.Node(name);n.layer=parent.layer;parent.addChild(n);n.setWorldPosition(x,y,z);n.setWorldRotation(comp('CameraMgr').node.worldRotation);n.setWorldScale(1,1,1);const r=n.addComponent('cc.MeshRenderer');r.mesh=quadMesh(width,height||width*art.aspect);r.setSharedMaterial(art.material,0);return n;}
function setupBuildings(){
 const all=nodes();stats.generatedBuildings=[];
 for(const n of all){
  const r=n.getComponent('cc.MeshRenderer');if(!r?.mesh)continue;
  const role=r.mesh.name.replace('RiverWorkshop_','');if(!['shredder','molder','assembly','depot'].includes(role))continue;
  const p=n.worldPosition.clone(),box=r.model?.worldBounds;
  const key={shredder:'body-press-v13',molder:'wheel-fitter-v13',assembly:'toy-finisher-v13',depot:'cottage-v13'}[role];
  const w={shredder:4.6,molder:3.55,assembly:3.2,depot:n.name.endsWith('2')?7:5.4}[role];
  const front={shredder:1,molder:.9,assembly:.8,depot:1.25}[role];
  r.enabled=false;const art=billboard(n,'RiverPainted_'+role,key,p.x,Math.max(.07,p.y),p.z+front,w,w*(role==='depot'?.95:.82));
  // Only the intended source factory animation scales the parent; geometry and
  // alpha-tested depth stay in world space at rest, with no overlay render layer.
  stats.generatedBuildings.push({name:n.name,role,width:w,position:[p.x,p.y,p.z],art:key});
  if(role!=='depot'){
   n.getComponents('cc.Collider').forEach(c=>c.enabled=false);
   const obstacle=new cc.Node('RiverMachineCollider');scene.addChild(obstacle);obstacle.setWorldPosition(p.x,1,p.z-.15);obstacle.setWorldRotationFromEuler(0,0,0);obstacle.setWorldScale(1,1,1);
   const c=obstacle.addComponent('cc.BoxCollider');c.size=new cc.Vec3(role==='assembly'?2.3:w*.90,2,role==='shredder'?2.9:role==='assembly'?1.8:2.35);c.isTrigger=false;c.setGroup(1);c.setMask(35011);obstacle.setParent(n,true);
   stats.machineColliders=(stats.machineColliders||0)+1;
  }
 }
 // The old exterior machine attachments no longer fit the new housing.
 for(const n of all)if(/^SM_JiQi_B_(?!ChuKou)/.test(n.name))n.getComponents('cc.MeshRenderer').forEach(r=>r.enabled=false);
 for(const f of [comp('JiFactory'),comp('JiHeFactory')]){
  const stack=f.stackMeatHigh,oldFly=stack.fly,oldPop=stack.popItemStack;
  const x=f===comp('JiFactory')?-8.15:-9.85,z=f===comp('JiFactory')?-6.55:-1.65;
  f.stackMeatHighParent.setWorldPosition(x,.65,z);
  stack.getNextAddPosition=()=>new cc.Vec3(x,.65,z);
  const setVisible=(item,on)=>item?.getComponentsInChildren('cc.MeshRenderer').forEach(r=>r.enabled=on);
  stack.fly=function(item,adding,changed,duration,arrived){return oldFly.call(this,item,adding,changed,adding?.38:duration,(n)=>{arrived?.(n);if(adding&&this.stackItems.some(a=>a.includes(item)))setVisible(item,false);});};
  stack.popItemStack=function(){const n=oldPop.call(this);setVisible(n,true);return n;};
 }
}
function halfFloat(v){const sign=v&0x8000?-1:1,exponent=(v>>10)&31,fraction=v&1023;return sign*(exponent===0?Math.pow(2,-14)*fraction/1024:Math.pow(2,exponent-15)*(1+fraction/1024));}
function sampleTriangles(n){const r=n.getComponent('cc.MeshRenderer');if(!r?.mesh)return [];const out=[],mesh=r.mesh,mat=n.worldMatrix;
 for(let s=0;s<mesh.struct.primitives.length;s++){let a=mesh.readAttribute(s,'a_position');const ix=mesh.readIndices(s);if(a instanceof Uint16Array)a=Float32Array.from(a,halfFloat);if(!a||!ix)continue;const verts=[];for(let i=0;i<a.length;i+=3)verts.push(cc.Vec3.transformMat4(new cc.Vec3(),new cc.Vec3(a[i],a[i+1],a[i+2]),mat));for(let i=0;i<ix.length;i+=3){const tri=[verts[ix[i]],verts[ix[i+1]],verts[ix[i+2]]];if(tri.every(p=>p.y>-.10&&p.y<.15))out.push(tri);}}
 return out;
}
function inside(x,z,t){const [a,b,c]=t;const d=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(d)<1e-7)return false;const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/d,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/d;return u>=-.001&&v>=-.001&&u+v<=1.001;}
function terrain(){
 const all=nodes(),roads=all.filter(n=>/^SM_ShaDi/.test(n.name)).flatMap(sampleTriangles),grass=all.filter(n=>/^SM_CaoDi/.test(n.name)&&n.activeInHierarchy).flatMap(sampleTriangles);
 const pads=all.filter(n=>n.getComponent('WorkerUnlock')||n.getComponent('UnlockMgr')||n.name.endsWith('Trigger')).map(n=>n.worldPosition.clone());
 const allowed=(x,z)=>!roads.some(t=>inside(x,z,t))&&grass.some(t=>inside(x,z,t))&&pads.every(p=>Math.hypot(x-p.x,z-p.z)>1.3);
 const safe=(x,z)=>[[0,0],[.48,0],[-.48,0],[0,.48],[0,-.48],[.34,.34],[-.34,.34],[.34,-.34],[-.34,-.34]].every(([a,b])=>allowed(x+a,z+b));
 stats.flowerPlacement={roadTriangles:roads.length,grassTriangles:grass.length,moved:0,removed:0,sites:[]};
 api.nature.flowers=api.nature.flowers.filter(f=>{let p=f.node.worldPosition.clone();if(!safe(p.x,p.z)){let found=false;for(let radius=.5;radius<=3&&!found;radius+=.5)for(let i=0;i<16;i++){const a=i*Math.PI/8,x=p.x+Math.cos(a)*radius,z=p.z+Math.sin(a)*radius;if(safe(x,z)){p.set(x,.04,z);found=true;break;}}if(!found){f.node.destroy();stats.flowerPlacement.removed++;return false;}f.node.setWorldPosition(p);stats.flowerPlacement.moved++;}stats.flowerPlacement.sites.push([p.x,p.z]);return true;});
 const root=scene.getChildByName('RiverNature');
 let extra=0;
 for(const [x,z] of [[4.8,-3.5],[3.6,3.5],[5,-4.6],[3.7,-2.4],[3,4.2],[4.8,-.6],[4.4,-6.1]]){if(extra>=2)break;if(!safe(x,z))continue;const holder=new cc.Node('RiverExtraTree');root.addChild(holder);holder.layer=root.layer;holder.setPosition(x,0,z);holder.setScale(.72,.72,.72);api.addMesh(holder,'Trunk',api.bareTree);api.nature.trees.push({crown:api.addMesh(holder,'Blossoms',api.blossoms),threshold:.48});extra++;}
 stats.extraTrees=extra;
 stats.nature.trees=api.nature.trees.length;stats.nature.flowerPatches=api.nature.flowers.length;
 // Shared, repeatable fine grain in existing UVs. No per-frame geometry or scans.
 for(const [key,count,tile] of [['#b4bd87',140,3],['#d9c7a0',110,3]]){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,128,128);let seed=13;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<count;i++){ctx.fillStyle=i%4?'#e0e3da':'#b1bca5';ctx.beginPath();ctx.ellipse(rand()*128,rand()*128,.5+rand()*1.6,.4+rand()*1.0,0,0,Math.PI*2);ctx.fill();}const tex=texture(c);tex.setWrapMode(cc.TextureBase.WrapMode.REPEAT,cc.TextureBase.WrapMode.REPEAT);const previous=api.solid(key),color=previous.getProperty('mainColor'),m=new cc.Material();m.initialize({effectName:'builtin-unlit',defines:{USE_TEXTURE:true,USE_INSTANCING:true}});m.setProperty('mainTexture',tex);m.setProperty('mainColor',color);m.setProperty('tilingOffset',new cc.Vec4(tile,tile,0,0));api.cache.set('solid:'+key+':true',m);for(const n of all)for(const r of n.getComponents('cc.MeshRenderer'))r.sharedMaterials.forEach((old,i)=>{if(old===previous)r.setSharedMaterial(m,i);});}
}
function padFrame(fill){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.lineJoin='round';g.fillStyle=fill;g.beginPath();g.roundRect(6,6,244,244,25);g.fill();g.lineWidth=5;g.strokeStyle='#fff4d5';g.setLineDash([13,9]);g.stroke();return frame(texture(c));}
function pads(){
 const fill=padFrame('#287b83'),active=padFrame('#87d8bb'),all=nodes(),ctrl=scene.getChildByName('GameMgr').getChildByName('UnlockAreaCtrl');
 for(const root of ctrl.children){const transfer=root.name.endsWith('Trigger'),buy=root.getComponent('WorkerUnlock')||root.getComponent('UnlockMgr');if(!transfer&&!buy)continue;
  const a=nodes(root),border=a.find(n=>n.name==='frame'&&n.getComponent('cc.Sprite'));
  if(transfer){const paint=root.getChildByName('RiverPad')?.getComponent('cc.Sprite');if(paint){paint.spriteFrame=fill;const src=border?.getComponent('cc.UITransform');if(src){const u=paint.node.getComponent('cc.UITransform');u.setContentSize(src.width*Math.abs(border.worldScale.x)/Math.abs(paint.node.worldScale.x),src.height*Math.abs(border.worldScale.y)/Math.abs(paint.node.worldScale.y));}const collider=root.getComponent('cc.BoxCollider');if(collider)paint.node.getComponent('cc.UITransform').setContentSize(collider.size.x,collider.size.y);const pp=paint.node.worldPosition;paint.node.setWorldPosition(pp.x,.19,pp.z);if(border)border.getComponent('cc.Sprite').enabled=false;}
   const input=root.getComponent('YuMiFactoryTrigger');if(input){input.itemSpriteW=fill;input.itemSpriteG=active;input.itemSprite.spriteFrame=fill;}
  }
  for(const n of a){const s=n.getComponent('cc.Sprite');if(!s)continue;if(n.name==='back'){s.spriteFrame=fill;s.color=cc.Color.WHITE;}if(n.name==='fill'){s.spriteFrame=active;s.color=cc.Color.WHITE;}if(n.name==='frame')s.enabled=false;
   if(['back','fill'].includes(n.name)&&border&&n!==border){const b=border.getComponent('cc.UITransform'),u=n.getComponent('cc.UITransform');if(b&&u)u.setContentSize(b.width*Math.abs(border.worldScale.x)/Math.abs(n.worldScale.x),b.height*Math.abs(border.worldScale.y)/Math.abs(n.worldScale.y));}
   if(/arrow/i.test(n.name)&&s.spriteFrame){const p=n.worldPosition;n.setWorldPosition(p.x,.23,p.z);}
  }
  if(transfer){
   const target= root.getChildByName('RiverPad')||root.getChildByName('meatArea');
   if(target){
    let material=target.getComponent('cc.Sprite')?.getRenderMaterial(0)||target.getChildByName('back')?.getComponent('cc.Sprite')?.getRenderMaterial(0);
    const icon=new cc.Node('RiverPadProduct');icon.layer=root.layer;root.addChild(icon);icon.addComponent('cc.UITransform').setContentSize(.62/Math.abs(root.worldScale.x),.62/Math.abs(root.worldScale.y));const sprite=icon.addComponent('cc.Sprite');sprite.customMaterial=material;
    const role={YuMiFactoryTrigger:'bottle',canFinishTrigger:'bale',JiFactoryTrigger:'bale',JiFinishTrigger:'toyPart',JiHeFactoryTrigger:'toyPart',JiHeFinishTrigger:'toy',cashierDeskTrigger:'toy',cashierMoneyTrigger:'houseCoin'}[root.name];sprite.spriteFrame=api.spriteArt(role);sprite.sizeMode=0;icon.getComponent('cc.UITransform').setContentSize(.62/Math.abs(root.worldScale.x),.62/Math.abs(root.worldScale.y));icon.setPosition(0,0,0);const p=root.worldPosition;icon.setWorldPosition(p.x,.255,p.z);
   }
  }
 }
 // The moving ground arrow is updated by its controller, so offset its visible
 // child, never its navigation root or an overlay material.
 for(const n of all){const s=n.getComponent('cc.Sprite');if(s?.riverRole==='chevron'&&!path(n).includes('UnlockAreaCtrl')){const p=n.worldPosition;n.setWorldPosition(p.x,Math.max(.24,p.y),p.z);}}
 const desk=comp('CashierDesk'),p=desk.moneyStackParent.worldPosition;desk.moneyStackParent.setWorldPosition(p.x,.25,p.z);
}
function reserve(stack,coin,kind){let slots=stackSlots.get(stack);if(!slots){slots=new Map();stackSlots.set(stack,slots);}let i=0;while(slots.has(i))i++;slots.set(i,coin);coinSlots.set(coin,{slots,i});const columns=kind==='cash'?4:1,col=i%columns,row=Math.floor(i/columns);return kind==='cash'?new cc.Vec3((col%2-.5)*.40,row*.075,(Math.floor(col/2)-.5)*.40):new cc.Vec3(0,row*stack.stackHeight,0);}
function release(coin){const x=coinSlots.get(coin);if(x){x.slots.delete(x.i);coinSlots.delete(coin);}}
function enqueue(coin,destination,complete,channel){
 cc.Tween.stopAllByTarget(coin);const start=Math.max(clock,channels.get(channel)||0);channels.set(channel,start+flightGap);
 flights.push({coin,destination,complete,start,from:null});stats.coinTransfers.queued++;
}
function flyFrame(dt){clock+=Math.min(dt||cc.director.getDeltaTime(),.05);for(let i=flights.length-1;i>=0;i--){const f=flights[i];if(!cc.isValid(f.coin)){flights.splice(i,1);continue;}if(clock<f.start)continue;
 if(!f.from){f.from=f.coin.worldPosition.clone();f.coin.setWorldRotationFromEuler(0,0,0);stats.coinTransfers.started++;}
 const t=Math.min(1,(clock-f.start)/flightDuration),end=f.destination(),p=cc.Vec3.lerp(new cc.Vec3(),f.from,end,t);p.y+=Math.sin(Math.PI*t)*.85;f.coin.setWorldPosition(p);
 if(t===1){flights.splice(i,1);stats.coinTransfers.landed++;f.complete(end);}
 }
}
function moneyStack(stack,kind){if(!stack||patched.has(stack))return;patched.add(stack);const oldFly=stack.fly,oldPop=stack.popItemStack;
 stack.popItemStack=function(){const n=oldPop.call(this);if(n)release(n);return n;};
 stack.fly=function(coin,adding,changed,duration,arrived){if(!coin)return;const target=adding?this.center:this._allocateTarget,local=adding?reserve(this,coin,kind):null;
  if(adding&&kind==='cash'){const p=coin.worldPosition;coin.setWorldPosition(p.x,1.3,p.z);stats.paymentFlights++;}
  const destination=adding?()=>cc.Vec3.transformMat4(new cc.Vec3(),local,target.worldMatrix):()=>{const p=target.worldPosition.clone();p.y=Math.max(.24,p.y);return p;};
  enqueue(coin,destination,(end)=>{const get=this.getNextAddPosition,allocate=this._allocateTarget;this.getNextAddPosition=()=>end;this._allocateTarget={worldPosition:end};try{oldFly.call(this,coin,adding,changed,0,arrived);}finally{this.getNextAddPosition=get;this._allocateTarget=allocate;}},adding?kind:'purchase');
 };
 if(kind==='cash'){const oldDestroy=stack.flyToDestroy;stack.flyToDestroy=function(coin,duration,done){const p=coin.worldPosition;coin.setWorldPosition(p.x,1.3,p.z);enqueue(coin,()=>this.center.worldPosition.clone().add(new cc.Vec3(0,.1,0)),()=>oldDestroy.call(this,coin,.001,done),'cash');};}
}
function transfers(){stats.coinTransfers={queued:0,started:0,landed:0,duration:flightDuration,interval:flightGap};moneyStack(comp('CashierDesk').stackMoneyHigh,'cash');moneyStack(comp('Player').stackMoneyHight,'carry');comp('CashierDesk')._coinFlyIntervalTime=flightGap;
 for(const n of nodes()){const w=n.getComponent('WorkerUnlock');if(w){const update=w.update;let elapsed=0;w.update=function(dt){elapsed+=dt;if(elapsed<flightGap)return;const t=elapsed;elapsed=0;return update.call(this,t);};}const u=n.getComponent('UnlockMgr');if(u)u._time=Math.max(u._time,flightGap);}
 cc.director.on(cc.Director.EVENT_BEFORE_UPDATE,()=>flyFrame(cc.director.getDeltaTime()));
}
function particles(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.fillStyle='#8ae8e0';g.beginPath();g.moveTo(32,2);g.lineTo(40,24);g.lineTo(62,32);g.lineTo(40,40);g.lineTo(32,62);g.lineTo(24,40);g.lineTo(2,32);g.lineTo(24,24);g.fill();const tex=texture(c),seen=new WeakSet();
 const style=n=>{for(const p of n.getComponentsInChildren('cc.ParticleSystem')){if(seen.has(p))continue;if(/yezi|叶子/i.test(path(p.node))||p.sharedMaterials?.some(m=>/yezi/i.test(m?.name||''))){seen.add(p);if(p.renderer)p.renderer.renderMode=0;if(p.startSize){p.startSize.mode=0;p.startSize.constant=.16;}if(p.startLifetime){p.startLifetime.mode=0;p.startLifetime.constant=.4;}for(let i=0;i<p.sharedMaterials.length;i++){const m=p.getMaterialInstance(i);if(m?.effectAsset){m.setProperty('mainTexture',tex);m.setProperty('tintColor',new cc.Color(124,241,226,255));}}stats.replacedLeafEffects=(stats.replacedLeafEffects||0)+1;}}};
 style(scene);const effect=comp('EffectMgr').effectRoot;effect.on(cc.Node.EventType.CHILD_ADDED,style);
}
function restoration(){
 const source=nodes().find(n=>n.name==='ring_1'&&path(n).includes('FX_Levelup_001'))?.getComponent('cc.ParticleSystem');
 const tex=source?.getMaterialInstance(0)?.getProperty('mainTexture'),fired=new Set();stats.restorationWaves=[];
 const launch=(kind,x,z)=>{
  if(!tex)return;const n=new cc.Node('RiverCleanWave_'+kind);scene.addChild(n);n.layer=scene.getChildByName('RiverNature').layer;if(kind==='lawn'){const p=comp('Player').node.worldPosition;x=p.x;z=p.z;}n.setPosition(x,.10,z);n.setRotationFromEuler(-90,kind==='water'?45:0,0);
  const r=n.addComponent('cc.MeshRenderer');r.mesh=cc.utils.createMesh({positions:[-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],normals:[0,0,1,0,0,1,0,0,1,0,0,1],uvs:[0,1,1,1,1,0,0,0],indices:[0,1,2,0,2,3]},undefined,{calculateBounds:true});const m=new cc.Material();m.initialize({effectName:'builtin-unlit',technique:1,defines:{USE_TEXTURE:true}});m.setProperty('mainTexture',tex);r.setSharedMaterial(m,0);let elapsed=0;
  const animate=()=>{elapsed+=Math.min(cc.director.getDeltaTime(),.05);const t=Math.min(1,elapsed/2.4),size=.5+t*(kind==='water'?22:26);n.setScale(kind==='water'?size*.42:size,size,1);const color=kind==='water'?[142,237,255]:[215,255,157];m.setProperty('mainColor',new cc.Color(...color,Math.round(170*Math.sin(Math.PI*t))));if(t===1){cc.director.off(cc.Director.EVENT_BEFORE_UPDATE,animate);n.destroy();}};cc.director.on(cc.Director.EVENT_BEFORE_UPDATE,animate);stats.restorationWaves.push(kind);
 };
 setInterval(()=>{for(const [kind,done,x,z] of [['lawn',stats.grassCleanliness>=.98&&stats.lawnRecovered>=8,0,-3],['water',stats.cleanliness>=.98&&stats.riverRecovered>=56,2.5,-13]])if(done&&!fired.has(kind)){fired.add(kind);launch(kind,x,z);}},100);
}
async function ending(){
 const style=document.createElement('style');style.textContent=`#local-game-end.pp-brand-screen{gap:min(2vh,16px)!important}#local-game-end .pp-brand-logo{width:min(48vw,21vh,180px)}#local-game-end .pp-brand-hero{display:none}#local-game-end .river-alex{width:min(60vw,29vh,270px);height:min(72vw,36vh,330px);object-fit:contain;filter:drop-shadow(0 8px 10px #142e3355)}#local-game-end #local-game-restart{font-family:Fredoka,sans-serif!important;font-size:clamp(25px,6.5vw,32px)!important;letter-spacing:.4px}`;document.head.appendChild(style);
 let started=false;const show=async()=>{const end=document.getElementById('local-game-end'),button=end?.querySelector('#local-game-restart');if(!button||started)return;started=true;button.childNodes.forEach(n=>{if(n.nodeType===3)n.textContent='PLAY AGAIN';});
  try{await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./polish-art/spine-canvas-3.7.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});const [data,atlasText]=await Promise.all([fetch('./polish-art/tasks_alex.json').then(r=>r.json()),fetch('./polish-art/tasks_alex.atlas').then(r=>r.text())]);const image=new Image();image.src='./polish-art/tasks_alex.png';await image.decode();const spine=window.spine,atlas=new spine.TextureAtlas(atlasText,()=>new spine.canvas.CanvasTexture(image)),reader=new spine.SkeletonJson(new spine.AtlasAttachmentLoader(atlas)),skeleton=new spine.Skeleton(reader.readSkeletonData(data)),state=new spine.AnimationState(new spine.AnimationStateData(skeleton.data));state.setAnimation(0,'idle_happy',true);state.apply(skeleton);skeleton.updateWorldTransform();const offset=new spine.Vector2(),size=new spine.Vector2();skeleton.getBounds(offset,size,[]);const c=document.createElement('canvas');c.className='river-alex';c.width=420;c.height=540;c.setAttribute('aria-label','Алекс радуется');end.insertBefore(c,button);const ctx=c.getContext('2d'),renderer=new spine.canvas.SkeletonRenderer(ctx);renderer.triangleRendering=true;let previous=0;stats.endingAnimation={name:'idle_happy',frames:0};const draw=t=>{if(!c.isConnected)return;requestAnimationFrame(draw);if(t-previous<32)return;const dt=previous?Math.min(.05,(t-previous)/1000):0;previous=t;state.update(dt);state.apply(skeleton);skeleton.updateWorldTransform();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,420,540);const scale=Math.min(400/size.x,500/size.y);ctx.translate(210,520);ctx.scale(scale,-scale);ctx.translate(-offset.x-size.x/2,-offset.y);renderer.draw(skeleton);stats.endingAnimation.frames++;};requestAnimationFrame(draw);
  }catch(e){stats.errors.push('End animation: '+e.message);end.querySelector('.pp-brand-hero')?.style.setProperty('display','block');}
 };new MutationObserver(show).observe(document.body,{childList:true,subtree:true});show();
}
async function start(){cc=window.cclegacy||window.cc;stats=window.riverWorkshop;api=window.riverSceneTools;if(!stats?.ready||!api)return false;scene=cc.director.getScene();await Promise.all(['body-press-v13','wheel-fitter-v13','toy-finisher-v13','cottage-v13'].map(loadArt));setupBuildings();terrain();pads();transfers();particles();restoration();ending();stats.polishReady=true;return true;}
let busy=false;const timer=setInterval(async()=>{if(busy)return;busy=true;try{if(await start())clearInterval(timer);}catch(e){clearInterval(timer);(window.riverWorkshop?.errors||[]).push('Polish: '+e.message);console.error(e);}busy=false;},50);
})();
