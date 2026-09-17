/* v14 first-conveyor trial: real Blender mesh parts, driven by source production. */
(() => {
'use strict';
let cc,api,scene,stats,parts,factory,clock=0,until=0,phase=0;
const models=[];
function find(type){let result;const visit=n=>{result ||= n.getComponent(type);if(!result)n.children.forEach(visit);};visit(scene);return result;}
function material(){const m=new cc.Material();m.initialize({effectName:'builtin-unlit',defines:{USE_VERTEX_COLOR:true,USE_INSTANCING:true}});return m;}
async function prepare(engine,tools,root){
 cc=engine;api=tools;scene=root;stats=window.riverWorkshop;
 const response=await fetch('./factory-3d/first-conveyor.json');if(!response.ok)throw Error('3D conveyor asset '+response.status);const data=await response.json();
 parts=data.parts.map(p=>({...p,mesh:cc.utils.createMesh({positions:p.positions,normals:p.normals,colors:p.colors,indices:p.indices},undefined,{calculateBounds:true})}));
 stats.firstConveyor3D={triangles:data.triangles,drawCalls:data.drawCallsPerMachine,instances:0,productionCycles:0,frames:0,working:false,lamps:[false,false,false],shellScale:[1,1,1]};
 factory=find('YuMiFactory');const oldAdd=factory.addCan;
 factory.addCan=function(...args){until=clock+1.15;stats.firstConveyor3D.productionCycles++;return oldAdd.apply(this,args);};
 // The original clip only squashes the old housing. Keep production callbacks,
 // but give the new mechanical parts their own motion and a fixed shell.
 factory.ani.stop();factory.ani.play=()=>undefined;
 const allocate=factory.stackMeatHigh.allocate;
 factory.stackMeatHigh.allocate=function(...args){until=Math.max(until,clock+.9);return allocate.apply(this,args);};
 cc.director.on(cc.Director.EVENT_BEFORE_UPDATE,update);
}
function build(source,p){
 const root=new cc.Node('RiverWheelPress3D');scene.addChild(root);root.layer=source.layer;
 const forward=cc.Vec3.transformQuat(new cc.Vec3(),new cc.Vec3(1,0,0),source.worldRotation);
 const yaw=Math.atan2(forward.x,forward.z)*180/Math.PI;
 root.setWorldPosition(p.x,.05,p.z);root.setWorldRotationFromEuler(0,yaw,0);root.setWorldScale(1,1,1);
 if(source===factory.buildNode){
  const world=(x,y,z)=>cc.Vec3.transformMat4(new cc.Vec3(),new cc.Vec3(x,y,z),root.worldMatrix);
  factory.materialPutPoint_1.setWorldPosition(world(1.49,2.7,-.22));
  factory.materialPutPoint_2.setWorldPosition(world(1.49,1.65,-.22));
  factory.canBornPoint.setWorldPosition(world(-.79,.72,1.80));
  factory.effectNode.setWorldPosition(world(1.49,2.55,-.22));
  Object.assign(stats.firstConveyor3D,{yaw,portLayout:'source-aligned: input +X, output -X',position:[p.x,.05,p.z]});
 }
 const belt=new cc.Node('Factory3D_beltCollider');root.addChild(belt);belt.setPosition(-.79,.42,1.52);
 const collider=belt.addComponent('cc.BoxCollider');collider.size=new cc.Vec3(1.22,.84,1.02);collider.isTrigger=false;collider.setGroup(1);collider.setMask(35011);
 const instance={root,source,parts:[]};
 for(const part of parts){const n=new cc.Node('Factory3D_'+part.name);root.addChild(n);n.layer=root.layer;n.setPosition(...part.pivot);const r=n.addComponent('cc.MeshRenderer');r.mesh=part.mesh;
  let m=api.vertexMaterial;if(part.name.startsWith('lamp_'))m=material();r.setSharedMaterial(m,0);
  instance.parts.push({node:n,name:part.name,pivot:part.pivot,mat:m});
 }
 models.push(instance);stats.firstConveyor3D.instances=models.length;return root;
}
function update(){
 const dt=Math.min(cc.director.getDeltaTime(),.05);clock+=dt;const working=clock<until;if(working)phase+=dt*1.55;
 const t=phase%1,press=t<.28?t/.28:t<.51?1:t<.80?1-(t-.51)/.29:0;
 const lamp=[working&&t>.65,working&&t<=.65,false];
 for(const model of models){model.root.active=model.source.activeInHierarchy;if(!model.root.active)continue;
  for(const part of model.parts){const {node,name,pivot}=part;
   if(name==='press_head')node.setPosition(pivot[0],pivot[1]-(working?press*.31:0),pivot[2]);
   else if(name==='rotor')node.setRotationFromEuler(0,0,phase*360);
   else if(name.startsWith('roller'))node.setRotationFromEuler(-phase*540,0,0);
   else if(name==='product_preview'){node.active=working;node.setPosition(pivot[0],pivot[1],pivot[2]+Math.max(0,(t-.42)/.58)*.65);}
   else if(name.startsWith('lamp_')){const on=lamp[Number(name.slice(-1))];if(part.on===on)continue;part.on=on;const v=on?255:64;part.mat.setProperty('mainColor',new cc.Color(v,v,v,255));}
  }
 }
 Object.assign(stats.firstConveyor3D,{frames:stats.firstConveyor3D.frames+1,working,phase:t,lamps:lamp});
}
window.riverFactory3D={prepare,build};
})();
