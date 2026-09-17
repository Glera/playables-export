/* v15: source-preserving presentation and explicitly requested transfer timing/collision fixes. */
(() => {
'use strict';
let cc,scene,api,stats,clock=0;const flights=[],stackSlots=new WeakMap(),coinSlots=new WeakMap(),patched=new WeakSet();
const flightDuration=.5,flightGap=.095,channels=new Map(),artCache=new Map();
const path=n=>n.parent?path(n.parent)+'/'+n.name:'/'+n.name;
const nodes=(root=scene)=>{const list=[];const walk=n=>{list.push(n);n.children.forEach(walk)};walk(root);return list;};
const comp=t=>nodes().map(n=>n.getComponent(t)).find(Boolean);
function frame(texture){const f=new cc.SpriteFrame();f.texture=texture;return f;}
function texture(canvas){const t=new cc.Texture2D();t.image=new cc.ImageAsset(canvas);return t;}
function setupBuildings(){
 const all=nodes();stats.generatedBuildings=[];
 for(const n of all){const r=n.getComponent('cc.MeshRenderer');if(!r?.mesh)continue;const role=r.mesh.name.replace('RiverWorkshop_','');if(!['shredder','molder','assembly','depot'].includes(role))continue;
  const p=n.worldPosition.clone();r.enabled=false;window.riverFactory3D.build(n,p,role);n.getComponents('cc.Collider').forEach(c=>c.enabled=false);stats.generatedBuildings.push({name:n.name,role,position:[p.x,p.y,p.z],art:'Higgsfield real 3D geometry v15'});
 }
 for(const n of all)if(/^SM_JiQi_B_/.test(n.name))n.getComponents('cc.MeshRenderer').forEach(r=>r.enabled=false);
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
function schematic(role){
 const key='scheme:'+role;if(artCache.has(key))return artCache.get(key);const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.strokeStyle=g.fillStyle='#ffffff';g.lineWidth=8;g.lineJoin='round';g.lineCap='round';
 if(role==='bottle'){g.strokeRect(52,9,24,15);g.beginPath();g.moveTo(51,29);g.lineTo(40,42);g.lineTo(40,108);g.quadraticCurveTo(40,118,50,118);g.lineTo(78,118);g.quadraticCurveTo(88,118,88,108);g.lineTo(88,42);g.lineTo(77,29);g.closePath();g.stroke();g.strokeRect(41,65,46,25);}
 else if(role==='bale'){for(const r of [47,21]){g.beginPath();g.arc(64,64,r,0,Math.PI*2);g.stroke();}for(let i=0;i<8;i++){const a=i*Math.PI/4;g.beginPath();g.moveTo(64+Math.cos(a)*35,64+Math.sin(a)*35);g.lineTo(64+Math.cos(a)*43,64+Math.sin(a)*43);g.stroke();}}
 else if(role==='houseCoin'){g.beginPath();g.arc(64,64,48,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(35,62);g.lineTo(64,36);g.lineTo(93,62);g.moveTo(43,57);g.lineTo(43,89);g.lineTo(84,89);g.lineTo(84,57);g.moveTo(58,89);g.lineTo(58,72);g.lineTo(70,72);g.lineTo(70,89);g.stroke();}
 else {g.beginPath();g.moveTo(13,85);g.lineTo(13,61);g.lineTo(70,61);g.lineTo(70,30);g.lineTo(101,30);g.lineTo(116,62);g.lineTo(116,85);g.closePath();g.stroke();for(const x of [32,96]){g.beginPath();g.arc(x,88,13,0,Math.PI*2);g.fill();}if(role==='toy'){g.strokeRect(79,40,18,16);g.beginPath();g.moveTo(19,59);g.lineTo(19,44);g.lineTo(61,44);g.lineTo(61,59);g.stroke();}}
 const sf=frame(texture(c));artCache.set(key,sf);return sf;
}
function pads(){
 const fill=padFrame('#287b83'),active=padFrame('#70ba9e'),all=nodes(),ctrl=scene.getChildByName('GameMgr').getChildByName('UnlockAreaCtrl'),progress=[];
 stats.padPresentation=[];stats.removedPadPlatforms=0;for(const n of all)if(/^SM_MuBan(?:-|$)/.test(n.name)){for(const r of n.getComponents('cc.MeshRenderer')){r.enabled=false;stats.removedPadPlatforms++;}}
 const roles={YuMiFactoryTrigger:'bottle',canFinishTrigger:'bale',JiFactoryTrigger:'bale',JiFinishTrigger:'toyPart',JiHeFactoryTrigger:'toyPart',JiHeFinishTrigger:'toy',cashierDeskTrigger:'toy',cashierMoneyTrigger:'houseCoin'};
 for(const root of ctrl.children){const transfer=!!roles[root.name],buy=root.getComponent('WorkerUnlock')||root.getComponent('UnlockMgr');if(!transfer&&!buy)continue;
  const a=nodes(root),sprites=a.map(n=>n.getComponent('cc.Sprite')).filter(Boolean),border=a.find(n=>n.name==='frame'&&n.getComponent('cc.Sprite')),back=a.find(n=>n.name==='back'&&n.getComponent('cc.Sprite')),existing=root.getChildByName('RiverPad');
  const source=(existing||back||border)?.getComponent('cc.Sprite');if(!source)continue;const mat=source.customMaterial||source.getRenderMaterial(0),reference=border||back||existing,u=reference.getComponent('cc.UITransform');
  let paint=transfer?existing?.getComponent('cc.Sprite'):back?.getComponent('cc.Sprite');
  if(!paint){const n=new cc.Node('RiverPad');root.addChild(n);n.layer=root.layer;n.addComponent('cc.UITransform');paint=n.addComponent('cc.Sprite');}
  const paintNode=paint.node;paint.customMaterial=mat;paint.spriteFrame=fill;paint.type=0;paint.sizeMode=0;paint.enabled=true;paint.color=cc.Color.WHITE;
  if(transfer){paintNode.setRotationFromEuler(0,0,0);paintNode.setScale(1,1,1);paintNode.setPosition(0,0,0);const collider=root.getComponent('cc.BoxCollider'),scale=Math.max(.001,Math.abs(root.worldScale.x));const width=collider?collider.size.x:u.width*Math.abs(reference.worldScale.x)/scale,height=collider?collider.size.y:u.height*Math.abs(reference.worldScale.y)/scale;paintNode.getComponent('cc.UITransform').setContentSize(width,height);}
  else paintNode.getComponent('cc.UITransform').setContentSize(u.width*Math.abs(reference.worldScale.x)/Math.max(.001,Math.abs(paintNode.worldScale.x)),u.height*Math.abs(reference.worldScale.y)/Math.max(.001,Math.abs(paintNode.worldScale.y)));
  const pos=paintNode.worldPosition;paintNode.setWorldPosition(pos.x,.17,pos.z);
  for(const sprite of sprites)if(sprite!==paint)sprite.enabled=false;
  const input=root.getComponent('YuMiFactoryTrigger');if(input){input.itemSprite=paint;input.itemSpriteW=fill;input.itemSpriteG=active;}
  const oldIcon=root.getChildByName('RiverPadProduct');if(oldIcon)oldIcon.destroy();
  const icon=new cc.Node('RiverPadSchematic');paintNode.addChild(icon);icon.layer=paintNode.layer;const ui=icon.addComponent('cc.UITransform'),size=paintNode.getComponent('cc.UITransform').contentSize;ui.setContentSize(size.width*.34,size.height*.34);const sp=icon.addComponent('cc.Sprite');sp.customMaterial=mat;sp.spriteFrame=schematic(roles[root.name]||'houseCoin');sp.type=0;sp.sizeMode=0;ui.setContentSize(size.width*.34,size.height*.34);icon.setPosition(0,buy?size.height*.10:0,.014/Math.max(.001,Math.abs(paintNode.worldScale.x)));
  if(buy){progress.push({paint,buy,last:-1});for(const n of a){const label=n.getComponent('cc.Label');if(label){label.color=cc.Color.WHITE;const p=n.worldPosition;n.setWorldPosition(p.x,.21,p.z);}}}
  stats.padPresentation.push({name:root.name,background:paintNode.name,schematic:roles[root.name]||'houseCoin',legacySpritesDisabled:sprites.filter(s=>s!==paint).length});
 }
 // Payment progresses by tint on the same plane, with no stacked fill rectangle.
 cc.director.on(cc.Director.EVENT_BEFORE_UPDATE,()=>{for(const p of progress){const v=p.buy.fillProgressSp?.fillRange??p.buy.progressSprite?.fillRange??0;if(v===p.last)continue;p.last=v;p.paint.color=new cc.Color(255,255,255,255);p.paint.spriteFrame=v>0?active:fill;}});
 const desk=comp('CashierDesk'),p=desk.moneyStackParent.worldPosition;desk.moneyStackParent.setWorldPosition(p.x,.25,p.z);
}
function stableArrows(){
 const guide=comp('ArrowGuide'),old=guide.guideToTarget;let angle=null,target=null,near=false;
 stats.arrowStability={mode:'camera facing after animation; shortest-path ground turns with arrival dead zone',maxTurnPerFrame:0};
 guide.guideToTarget=function(node){old.call(this,node);const p=this.playerNode.worldPosition,q=node.worldPosition,d=Math.hypot(q.x-p.x,q.z-p.z),goal=-Math.atan2(q.z-p.z,q.x-p.x)*180/Math.PI;
  if(node!==target||angle===null){target=node;angle=goal;near=d<1.4;}
  if(near?d>1.9:d<1.4)near=!near;
  const delta=((goal-angle+540)%360)-180,step=Math.max(-240*cc.director.getDeltaTime(),Math.min(240*cc.director.getDeltaTime(),delta));
  if(!near){angle+=step;stats.arrowStability.maxTurnPerFrame=Math.max(stats.arrowStability.maxTurnPerFrame,Math.abs(step));}
  this.node.setRotationFromEuler(0,angle,0);for(const arrow of this.childArrow)arrow.active=!near;
 };
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
 for(const n of nodes()){const w=n.getComponent('WorkerUnlock');if(w){const update=w.update;let elapsed=0;w.update=function(dt){elapsed+=dt;if(elapsed<flightGap)return;const t=elapsed;elapsed=0;return update.call(this,t);};}const u=n.getComponent('UnlockMgr');if(u){u._time=Math.max(u._time,flightGap);
   // Source needNum counts currency units, but every real coin pays ten.
   // Reserve the number of coins at launch so delayed arrivals cannot overspend.
   const quota=()=>{for(const row of u.unlockItemArray)if(row.dataKey==='money')row.needNum=Math.min(row.needNum,Math.ceil(Math.max(0,row.targetItemNum-row.itemNum)/10));};
   const reset=u.ResetTargetScore;u.ResetTargetScore=function(...args){const result=reset.apply(this,args);quota();return result;};quota();
  }}
 cc.director.on(cc.Director.EVENT_BEFORE_UPDATE,()=>flyFrame(cc.director.getDeltaTime()));
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
async function start(){cc=window.cclegacy||window.cc;stats=window.riverWorkshop;api=window.riverSceneTools;if(!stats?.ready||!api)return false;scene=cc.director.getScene();await window.riverFactory3D.prepare(cc,api,scene);setupBuildings();terrain();pads();transfers();stableArrows();restoration();ending();stats.polishReady=true;return true;}
let busy=false;const timer=setInterval(async()=>{if(busy)return;busy=true;try{if(await start())clearInterval(timer);}catch(e){clearInterval(timer);(window.riverWorkshop?.errors||[]).push('Polish: '+e.message);console.error(e);}busy=false;},50);
})();
