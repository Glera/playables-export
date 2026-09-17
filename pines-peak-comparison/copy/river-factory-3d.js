/* Real factory parts; only original pooled gameplay items travel along the belts. */
(() => {
'use strict';
let cc,api,scene,stats,Factory,Types,config,dataPromise,clock=0;
const models=[],states=new Map(),journeys=[];
const definitions={
 shredder:{asset:'wheel_press',type:'YuMiFactory',item:'Can',scale:1,width:4.05,depth:2.30,belt:[-.79,.64,.77,1.87],count:()=>config.materialCanNum,cadence:.02,gap:.14,lanes:1},
 molder:{asset:'chassis_station',type:'JiFactory',item:'JiDan',scale:.85,width:3.7,depth:2.10,belt:[0,.67,.64,1.76],count:()=>4,cadence:.2,gap:.045,lanes:3},
 assembly:{asset:'toy_finisher',type:'JiHeFactory',item:'JiDanHe',scale:.78,width:3.34,depth:2.04,belt:[0,.64,.62,1.76],count:()=>1,cadence:.02,gap:.14,lanes:1},
 depot:{asset:'cottage'}
};
function find(type){let result;const visit=n=>{result ||= n.getComponent(type);if(!result)n.children.forEach(visit);};visit(scene);return result;}
function within(node,parent){for(let n=node;n;n=n.parent)if(n===parent)return true;return false;}
async function loadData(){
 if(!dataPromise)dataPromise=fetch('./factory-3d/workshop-v15.json').then(r=>{if(!r.ok)throw Error('3D workshop asset '+r.status);return r.json()}).then(data=>{
  const products={};for(const [role,key] of [['bale','wheel_product'],['toyPart','unfinished_truck'],['toy','finished_truck']]){
   const p=data.assets[key].parts[0],g={positions:[],normals:[],colors:[...p.colors],indices:[...p.indices],uvs:[]};
   for(let i=0;i<p.positions.length;i+=3){let x=p.positions[i],y=-p.positions[i+2],z=p.positions[i+1],nx=p.normals[i],ny=-p.normals[i+2],nz=p.normals[i+1];
    if(role==='bale'){[y,z]=[-z,y];[ny,nz]=[-nz,ny];}
    g.positions.push(x,y,z);g.normals.push(nx,ny,nz);g.uvs.push(0,0);
   }products[role]=g;
  }window.riverProductGeometry=products;return data;
 });return dataPromise;
}
async function prepare(engine,helpers,root){
 cc=engine;api=helpers;scene=root;stats=window.riverWorkshop;
 const data=await loadData(),f=await System.import('chunks:///_virtual/Factory.ts');Factory=f.Factory;Types=f.EFactroyType;config=(await System.import('chunks:///_virtual/GameConfig.ts')).default;
 stats.factories3D={};stats.productBelts={spawned:0,landed:0,returned:0,active:0,displayProducts:0};
 for(const [role,def] of Object.entries(definitions)){
  const asset=data.assets[def.asset];def.parts=asset.parts.map(p=>({...p,mesh:cc.utils.createMesh({positions:p.positions,normals:p.normals,colors:p.colors,indices:p.indices},undefined,{calculateBounds:true})}));
  if(!def.type)continue;
  const factory=find(def.type),state={role,def,factory,until:0,phase:0,next:0,serial:0,root:null,cycles:0,working:false};
  states.set(role,state);stats.factories3D[role]={triangles:asset.triangles,drawCalls:asset.drawCallsPerMachine,productionCycles:0,working:false,lamps:[false,false,false],shellScale:[1,1,1]};
  if(role==='shredder')stats.firstConveyor3D=stats.factories3D[role];
  if(factory.ani){factory.ani.stop();factory.ani.play=()=>undefined;}
  for(const method of ['allocate','popItem']){const old=factory.stackMeatHigh[method];factory.stackMeatHigh[method]=function(...args){state.until=Math.max(state.until,clock+.85);return old.apply(this,args);};}
  factory.addCan=function(){state.until=clock+1;state.cycles++;for(let i=0;i<def.count();i++)this.scheduleOnce(()=>spawn(state),Math.max(0,def.cadence*(i-1)));};
 }
 const effect=find('EffectMgr'),oldPlay=effect.Play;
 effect.Play=function(type,...args){if(type===Types.Yezi){stats.suppressedFactoryParticles=(stats.suppressedFactoryParticles||0)+1;return;}return oldPlay.call(this,type,...args);};
 for(const n of effect.effectRoot.children)if(/叶子|yezi/i.test(n.name)){n.getComponentsInChildren('cc.ParticleSystem').forEach(p=>{p.stop();p.clear();});n.active=false;}
 cc.director.on(cc.Director.EVENT_BEFORE_UPDATE,update);
}
function build(source,p,role){
 const def=definitions[role],root=new cc.Node(role==='shredder'?'RiverWheelPress3D':'River3D_'+role);scene.addChild(root);root.layer=source.layer;
 const front=cc.Vec3.transformQuat(new cc.Vec3(),role==='depot'?new cc.Vec3(0,-1,0):new cc.Vec3(1,0,0),source.worldRotation),yaw=(role==='depot'?Math.atan2(-p.x,-4-p.z):Math.atan2(front.x,front.z))*180/Math.PI;
 const scale=def.scale||(source.name.endsWith('2')?1.23:1.08);root.setWorldPosition(p.x,.05,p.z);root.setWorldRotationFromEuler(0,yaw,0);root.setWorldScale(scale,scale,scale);
 const state=states.get(role),owns=state&&within(source,state.factory.node),instance={root,source,role,state:owns?state:null,parts:[]};
 if(owns){state.root=root;state.yaw=yaw;const f=state.factory,world=(x,y,z)=>cc.Vec3.transformMat4(new cc.Vec3(),new cc.Vec3(x,y,z),root.worldMatrix);
  if(role==='shredder'){f.materialPutPoint_1.setWorldPosition(world(1.49,2.7,-.22));f.materialPutPoint_2.setWorldPosition(world(1.49,1.65,-.22));}
  else{f.stackMeatHighParent.setWorldPosition(world(def.width*.32,.78,-.14));const stack=f.stackMeatHigh,oldFly=stack.fly,oldPop=stack.popItemStack;
   stack.getNextAddPosition=()=>world(def.width*.32,.78,-.14);
   const visible=(n,on)=>n?.getComponentsInChildren('cc.MeshRenderer').forEach(r=>r.enabled=on);
   stack.fly=function(item,adding,changed,duration,arrived){return oldFly.call(this,item,adding,changed,adding?.35:duration,n=>{arrived?.(n);if(adding&&this.stackItems.some(a=>a.includes(item)))visible(item,false);});};
   stack.popItemStack=function(){const n=oldPop.call(this);visible(n,true);return n;};
  }
  const b=def.belt;f.canBornPoint.setWorldPosition(world(b[0],b[1],b[2]));if(f.canBornPoint_2)f.canBornPoint_2.setWorldPosition(world(b[0],b[1],b[3]));
  Object.assign(stats.factories3D[role],{yaw,scale,shellScale:[scale,scale,scale],position:[p.x,.05,p.z]});
 }
 for(const part of def.parts){const n=new cc.Node('Factory3D_'+part.name);root.addChild(n);n.layer=root.layer;n.setPosition(...part.pivot);const r=n.addComponent('cc.MeshRenderer');r.mesh=part.mesh;
  let m=api.vertexMaterial;if(part.name.startsWith('lamp_')){m=new cc.Material();m.initialize({effectName:'builtin-unlit',defines:{USE_VERTEX_COLOR:true,USE_INSTANCING:true}});}r.setSharedMaterial(m,0);instance.parts.push({node:n,name:part.name,pivot:part.pivot,mat:m,on:null});
 }
 if(role!=='depot'){
  function box(name,pos,size){const n=new cc.Node(name);root.addChild(n);n.setPosition(...pos);const c=n.addComponent('cc.BoxCollider');c.size=new cc.Vec3(...size);c.isTrigger=false;c.setGroup(1);c.setMask(35011);}
  box('Factory3D_housingCollider',[0,1.24,0],[def.width,2.48,def.depth]);
  box('Factory3D_beltCollider',[def.belt[0],.42,1.45],[role==='shredder'?1.22:1.75,.84,1.06]);
 }
 models.push(instance);return root;
}
function spawn(state){
 if(!state.root)return;const {def,factory}=state,item=Factory.getSync(Types[def.item],factory.canParent);if(!item)return;
 item.active=true;item.setParent(scene,true);item.setWorldScale(1,1,1);
 const q=new cc.Quat();cc.Quat.fromEuler(q,def.item==='JiDanHe'?-90:0,state.yaw-90,0);item.setWorldRotation(q);
 const start=Math.max(clock,state.next),lane=(state.serial++%def.lanes)-(def.lanes-1)/2;state.next=start+def.gap;
 const b=def.belt,from=cc.Vec3.transformMat4(new cc.Vec3(),new cc.Vec3(b[0]+lane*.39,b[1],b[2]),state.root.worldMatrix),to=cc.Vec3.transformMat4(new cc.Vec3(),new cc.Vec3(b[0]+lane*.39,b[1],b[3]),state.root.worldMatrix);
 item.setWorldPosition(from);journeys.push({item,state,from,to,start});stats.productBelts.spawned++;
}
function update(){
 const dt=Math.min(cc.director.getDeltaTime(),.05);clock+=dt;
 for(let i=journeys.length-1;i>=0;i--){const j=journeys[i];if(!cc.isValid(j.item)){journeys.splice(i,1);continue;}if(clock<j.start){j.item.active=false;continue;}j.item.active=true;
  const t=Math.min(1,(clock-j.start)/.55);j.item.setWorldPosition(cc.Vec3.lerp(new cc.Vec3(),j.from,j.to,t));j.state.until=Math.max(j.state.until,clock+.12);
  if(t>=1){journeys.splice(i,1);const stack=j.state.factory.stackCanHigh;if(stack.isNeedMore())stack.addItem(j.item,.25,()=>stats.productBelts.landed++);else{Factory.put(j.item);stats.productBelts.returned++;}}
 }stats.productBelts.active=journeys.length;
 for(const state of states.values()){state.working=clock<state.until;if(state.working)state.phase+=dt*1.55;}
 for(const model of models){model.root.active=model.source.activeInHierarchy;if(!model.root.active||!model.state)continue;const {state}=model,t=state.phase%1,working=state.working,press=t<.28?t/.28:t<.51?1:t<.80?1-(t-.51)/.29:0,lamps=[working&&t>.65,working&&t<=.65,false];
  for(const p of model.parts){const {node,name,pivot}=p;
   if(name.startsWith('press_head'))node.setPosition(pivot[0],pivot[1]-(working?press*.31:0),pivot[2]);
   else if(name.startsWith('rotor'))node.setRotationFromEuler(0,0,state.phase*360);
   else if(name.startsWith('roller'))node.setRotationFromEuler(-state.phase*540,0,0);
   else if(name.startsWith('arm_'))node.setRotationFromEuler(0,0,(name.includes('left')?-1:1)*(working?Math.sin(t*Math.PI)*18:0));
   else if(name.startsWith('lamp_')){const on=lamps[Number(name.split('.')[0].slice(-1))];if(on!==p.on){p.on=on;const v=on?255:64;p.mat.setProperty('mainColor',new cc.Color(v,v,v,255));}}
  }Object.assign(stats.factories3D[state.role],{productionCycles:state.cycles,working,lamps,phase:t});
 }
}
window.riverFactory3D={loadData,prepare,build};
})();
