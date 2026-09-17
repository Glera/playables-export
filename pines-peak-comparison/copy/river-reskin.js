/* Pines Peak / River Workshop, 2026-09-17.
 * v11 raises purchase-pad artwork above terrain without moving purchase triggers.
 * v10 stabilizes helper waypoint arrival and upright visual turns.
 * v9 restores source depth-tested floor materials on replacement pads.
 * v8 adds the requested lawn-first opening: relocate eight real bottles and
 * temporarily pause river pickups/spawning. Afterward the source loop resumes.
 * Production, prices, movement speed, pools and later upgrade rules stay original.
 */
(() => {
  'use strict';
  const stats = {version:11,meshes:0,sprites:0,labels:0,materials:0,errors:[],roles:{},bottlesRecovered:0,lawnRecovered:0,riverRecovered:0,lawnGoal:8,riverGoal:56,cleanupStage:'lawn',grassCleanliness:0,cleanliness:0,stableHelpers:0,incrementalFlushes:0,visitedNodes:0};
  window.riverWorkshop = stats;
  const palette={teal:'#208f98',mint:'#9ce6cb',deep:'#214754',navy:'#284457',yellow:'#ffcc5d',cream:'#f6e8ca',coral:'#e97d58',blue:'#70c9de',dark:'#243b46',white:'#edf9ed',green:'#4f997f'};
  let cc, mainCamera, vertexMaterial, coinMaterial, waterMaterial, waterSurface, recoveryText, recoveryFill;
  const nature={trees:[],flowers:[],animals:[],pads:[],pointers:[],tins:[]}, bottleSources=new WeakMap();
  const cache=new Map(), processed=new WeakSet(), styled=new WeakSet(), recovered=new WeakSet();
  const watched=new WeakSet(),decorationRoots=new WeakSet(),pending=new Set(),dynamicRoots=new Set(),labels=new Set();
  const origins=new WeakMap(),lawnBottles=new Set(),introLabels=new Set(),introLocations=new Set();
  const stableHelpers=new WeakSet();
  let lawnIntro;
  const animalCenters=[[3.7,-3.8],[5.2,-5.6],[3.2,3.7]];
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
  function geometry(){return {positions:[],normals:[],colors:[],uvs:[],indices:[]};}
  function tri(g,a,b,c,color){
    const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
    let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const len=Math.hypot(...n)||1;n=n.map(v=>v/len);
    const shade=.77+.23*Math.max(0,n[0]*-.35+n[1]*-.45+n[2]*.82),col=rgb(color);
    for(const p of [a,b,c]){g.indices.push(g.positions.length/3);g.positions.push(...p);g.normals.push(...n);g.colors.push(...col.map(v=>v*shade),1);g.uvs.push(0,0);}
  }
  function quad(g,a,b,c,d,color){tri(g,a,b,c,color);tri(g,a,c,d,color);}
  function box(g,x,y,z,w,d,h,color){
    const a=[x-w/2,y-d/2,z],b=[x+w/2,y-d/2,z],c=[x+w/2,y+d/2,z],d0=[x-w/2,y+d/2,z];
    const top=p=>[p[0],p[1],p[2]+h],A=top(a),B=top(b),C=top(c),D=top(d0);
    quad(g,a,d0,c,b,color);quad(g,A,B,C,D,color);quad(g,a,b,B,A,color);quad(g,b,c,C,B,color);quad(g,c,d0,D,C,color);quad(g,d0,a,A,D,color);
  }
  function rings(g,x,y,rings,colors,segments=12){
    for(let k=0;k<rings.length-1;k++)for(let j=0;j<segments;j++){
      const t=j/segments*Math.PI*2,u=(j+1)/segments*Math.PI*2,[z,r]=rings[k],[Z,R]=rings[k+1];
      quad(g,[x+r*Math.cos(t),y+r*Math.sin(t),z],[x+r*Math.cos(u),y+r*Math.sin(u),z],[x+R*Math.cos(u),y+R*Math.sin(u),Z],[x+R*Math.cos(t),y+R*Math.sin(t),Z],colors[Math.min(k,colors.length-1)]);
    }
  }
  function bottle(){const g=geometry();rings(g,0,0,[[0,0],[.025,.15],[.06,.17],[.13,.17],[.16,.155],[.19,.17],[.40,.17],[.43,.155],[.46,.17],[.56,.14],[.64,.067],[.74,.067],[.74,.08],[.81,.08],[.81,0]],['#72c7d1','#b4e8e5','#80d5db','#67b9c8','#beece6','#72cbd3','#e1f3dd','#70c1ce','#b9e6e5','#89d8dd','#5ba9b7','#ffcc5d','#ffcc5d','#ffcc5d']);return g;}
  function bale(){const g=geometry();box(g,0,0,0,.68,.49,.25,palette.teal);for(const x of [-.22,.22])box(g,x,0,.252,.035,.5,.012,palette.cream);for(let i=0;i<8;i++)box(g,-.26+(i%4)*.17,-.14+Math.floor(i/4)*.25,.267,.10,.07,.018,i%2?palette.blue:palette.mint);return g;}
  function toyPart(){const g=geometry();box(g,0,0,0,.36,.23,.07,palette.coral);for(const x of [-.095,.095])for(const y of [-.056,.056])rings(g,x,y,[[.07,.04],[.105,.04],[.105,0]],[palette.yellow],8);return g;}
  function wheel(g,x,y,z){
    const w=geometry();rings(w,0,0,[[-.037,0],[-.037,.077],[.037,.077],[.037,.033],[.041,.033],[.041,0]],[palette.navy,palette.navy,palette.navy,palette.cream,palette.cream],10);
    // Rotate the cylinder onto its axle; one mesh keeps whole toy stacks instanced.
    for(let i=0;i<w.positions.length;i+=3){const p=w.positions.slice(i,i+3),n=w.normals.slice(i,i+3);w.positions.splice(i,3,p[0]+x,p[2]+y,-p[1]+z);w.normals.splice(i,3,n[0],n[2],-n[1]);}
    const offset=g.positions.length/3;for(const k of ['positions','normals','colors','uvs'])g[k].push(...w[k]);g.indices.push(...w.indices.map(i=>i+offset));
  }
  function toy(){
    const g=geometry();box(g,0,0,.066,.61,.28,.065,palette.teal);
    box(g,-.145,0,.132,.30,.28,.105,palette.coral);box(g,-.145,0,.237,.32,.30,.028,palette.yellow);
    box(g,.14,0,.132,.24,.28,.173,palette.yellow);box(g,.14,0,.305,.28,.31,.025,palette.coral);
    for(const y of [-.142,.142])box(g,.145,y,.218,.12,.005,.071,palette.blue);
    box(g,.262,0,.218,.005,.20,.071,palette.blue);box(g,.271,0,.14,.026,.30,.035,palette.cream);
    for(const x of [-.19,.19])for(const y of [-.157,.157])wheel(g,x,y,.077);
    return g;
  }
  function tin(){
    const g=geometry();rings(g,0,0,[[0,0],[0,.20],[.025,.215],[.05,.20],[.12,.20],[.14,.208],[.17,.20],[.32,.20],[.35,.208],[.38,.20],[.45,.20],[.47,.215],[.495,.215],[.495,.183],[.48,.18],[.48,0]],['#d5e6e5','#889d9e','#ecf4ec','#91a6a7',palette.coral,'#abc0be',palette.coral,'#abc0be',palette.coral,'#91a6a7','#d5e6e5','#f3f6e9','#91a6a7','#d5e6e5','#d5e6e5'],12);
    rings(g,0,-.02,[[.486,.07],[.505,.07],[.505,.037],[.486,.037]],['#627e84','#627e84','#627e84'],8);
    box(g,0,-.203,.20,.17,.009,.075,palette.cream);return g;
  }
  function houseCoin(){
    const g=geometry(),segments=24,r=.20,z=.024;
    const face=(points,uvs)=>{const start=g.uvs.length;tri(g,...points,'#ffffff');g.uvs.splice(start,6,...uvs.flat());for(let i=g.colors.length-12;i<g.colors.length;i++)g.colors[i]=1;};
    for(let i=0;i<segments;i++){
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,A=[Math.cos(a),Math.sin(a)],B=[Math.cos(b),Math.sin(b)];
      const uv=p=>[.5+p[0]*.45,.5-p[1]*.45];
      face([[0,0,z],[A[0]*r,A[1]*r,z],[B[0]*r,B[1]*r,z]],[[.5,.5],uv(A),uv(B)]);
      face([[0,0,-z],[B[0]*r,B[1]*r,-z],[A[0]*r,A[1]*r,-z]],[[.5,.5],uv([-B[0],B[1]]),uv([-A[0],A[1]])]);
      const start=g.uvs.length;quad(g,[A[0]*r,A[1]*r,-z],[B[0]*r,B[1]*r,-z],[B[0]*r,B[1]*r,z],[A[0]*r,A[1]*r,z],palette.yellow);g.uvs.splice(start,12,...Array(6).fill([.5,.12]).flat());
    }
    return g;
  }
  function pointer(){
    const g=geometry();
    const shape=(width,bottom,top,neck,shaft,z,color)=>{
      tri(g,[-width,neck,z],[0,bottom,z],[width,neck,z],color);
      quad(g,[-shaft,neck,z],[shaft,neck,z],[shaft,top,z],[-shaft,top,z],color);
    };
    shape(.58,-.77,.77,-.02,.23,0,palette.deep);
    shape(.46,-.61,.67,.02,.145,.012,palette.cream);
    shape(.30,-.45,.54,.065,.085,.024,palette.coral);
    return g;
  }
  function addPointer(source,renderer){
    // Keep the target and bobbing animation. A separate visible arrow faces
    // the camera, so it never collapses to a thin edge during the source spin.
    renderer.enabled=false;const node=new cc.Node('RiverPointerFace');node.layer=source.layer;source.addChild(node);node.setScale(2,2,2);
    let mesh=cache.get('pointerFace');if(!mesh){mesh=cc.utils.createMesh(pointer(),undefined,{calculateBounds:true});mesh.name='RiverWorkshop_pointerFace';cache.set('pointerFace',mesh);}
    const r=node.addComponent('cc.MeshRenderer');r.mesh=mesh;r.setSharedMaterial(vertexMaterial,0);processed.add(r);nature.pointers.push(node);stats.roles.pointer=(stats.roles.pointer||0)+1;stats.meshes++;
  }
  function ellipsoid(g,x,y,z,rx,ry,rz,color){
    const segments=8,rows=5,p=(i,j)=>{const a=i/segments*Math.PI*2,b=j/rows*Math.PI;return[x+Math.cos(a)*Math.sin(b)*rx,y+Math.sin(a)*Math.sin(b)*ry,z+Math.cos(b)*rz];};
    for(let j=0;j<rows;j++)for(let i=0;i<segments;i++)quad(g,p(i,j),p(i,j+1),p(i+1,j+1),p(i+1,j),color);
  }
  function branch(g,a,b,r0,r1){
    const d=b.map((v,i)=>v-a[i]),len=Math.hypot(...d),axis=d.map(v=>v/len),u=[axis[2],0,-axis[0]],ul=Math.hypot(...u)||1;for(let i=0;i<3;i++)u[i]/=ul;
    const v=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]],point=(p,r,t)=>p.map((x,i)=>x+r*(u[i]*Math.cos(t)+v[i]*Math.sin(t)));
    for(let i=0;i<7;i++){const t=i/7*Math.PI*2,w=(i+1)/7*Math.PI*2;quad(g,point(a,r0,t),point(a,r0,w),point(b,r1,w),point(b,r1,t),'#826655');}
  }
  function bareTree(){const g=geometry();rings(g,0,0,[[0,.13],[1.25,.1],[2.15,.025]],['#826655'],7);for(const [x,y,z] of [[-.49,.02,1.85],[.5,.12,1.95],[.05,-.46,1.88],[.12,.43,1.96]])branch(g,[0,0,1.05],[x,y,z],.085,.028);return g;}
  function blossoms(){const g=geometry();for(const [x,y,z,r,col] of [[0,0,2.12,.68,'#ffc1d8'],[-.49,.02,1.82,.59,'#f494bc'],[.5,.12,1.95,.56,'#ffadd0'],[.05,-.46,1.88,.53,'#ffcee1'],[.12,.43,1.96,.52,'#e786b0']])ellipsoid(g,x,y,z,r,r*.83,r*.8,col);return g;}
  function flowers(){const g=geometry();for(let i=0;i<5;i++){const a=i*2.4,x=Math.cos(a)*(.13+i*.055),y=Math.sin(a)*(.13+i*.055),z=.13+(i%3)*.045;box(g,x,y,0,.023,.023,z,'#478646');for(let j=0;j<5;j++){const a=j*1.256;ellipsoid(g,x+Math.cos(a)*.065,y+Math.sin(a)*.065,z,.07,.05,.023,i%2?'#fff5d7':'#ffa0cb');}ellipsoid(g,x,y,z+.02,.03,.03,.019,'#ffcb51');}return g;}
  function pine(){const g=geometry();rings(g,0,0,[[0,.09],[.85,.075]],['#85644a'],8);for(let i=0;i<4;i++)rings(g,0,0,[[.5+i*.5,0],[.5+i*.5,1-i*.2],[1.5+i*.5,0]],['#347b76',i%2?'#70ae88':'#529e86'],8);return g;}
  function bin(){const g=geometry();box(g,0,0,0,.72,.7,.90,palette.teal);box(g,0,0,.9,.80,.78,.1,palette.yellow);box(g,0,-.353,.35,.38,.015,.28,palette.cream);for(let i=0;i<3;i++)box(g,-.13+i*.13,-.366,.4,.06,.016,.17,palette.teal);return g;}
  function machine(kind){
    const g=geometry(),w=kind==='molder'?3.4:2.65,d=kind==='shredder'?3.65:2.1;
    box(g,0,0,0,w,d,.18,palette.deep);
    for(const x of [-w*.39,w*.39])for(const y of [-d*.37,d*.37])box(g,x,y,.18,.18,.18,.32,palette.yellow);
    box(g,0,0,.4,w*.93,d*.86,1.0,kind==='assembly'?palette.coral:palette.teal);
    box(g,0,0,1.4,w*.99,d*.91,.14,palette.cream);
    if(kind==='shredder'){
      box(g,0,.25,1.54,1.5,1.4,.55,palette.yellow);box(g,0,.25,2.095,1.21,1.12,.025,palette.dark);
      for(let i=0;i<5;i++)box(g,-.48+i*.24,.25,2.13,.11,.95,.09,palette.cream);
      box(g,0,-d*.44,.8,1.15,.10,.43,palette.deep);
    }else if(kind==='molder'){
      for(const x of [-1.1,0,1.1]){box(g,x,0,1.54,.16,.7,.75,palette.navy);box(g,x,-.05,2.22,.72,1.1,.17,palette.yellow);box(g,x,-.2,1.56,.67,.8,.12,palette.coral);}
    }else{
      for(const x of [-.98,.98])box(g,x,0,1.54,.19,1.55,.58,palette.deep);
      box(g,0,0,2.12,2.24,1.55,.18,palette.yellow);box(g,0,0,1.54,1.5,1.35,.08,palette.mint);
    }
    box(g,w*.3,-d*.435,1.01,.50,.03,.34,palette.deep);box(g,w*.3,-d*.453,1.12,.29,.015,.13,palette.mint);
    for(let i=0;i<3;i++)box(g,-w*.32+i*.22,-d*.44,.57,.10,.028,.42,palette.navy);
    return g;
  }
  function depot(){const g=geometry();box(g,0,0,0,4,3,.18,palette.deep);box(g,0,0,.18,3.8,2.8,2.5,palette.cream);box(g,0,0,2.68,4.2,3.2,.28,palette.teal);for(const x of [-1.25,0,1.25]){box(g,x,-1.415,.5,.95,.025,1.8,palette.deep);box(g,x,-1.44,.85,.8,.025,.9,palette.blue);}box(g,0,-1.48,2.39,3.5,.06,.42,palette.yellow);return g;}
  function mapMesh(source,role){
    if(source.name==='RiverWorkshop_'+role)return source;
    const key=source.uuid+':'+role;if(cache.has(key))return cache.get(key);
    let g=({bottle,bottleStack:bottle,bale,toyPart,toy,tin,tinRiver:tin,houseCoin,pine,bin,depot,pointer}[role]||(()=>machine(role)))();
    // Models use Z-up; floating corn has its long axis in Y, horizontal corn in X.
    const lo=source.struct.minPosition,hi=source.struct.maxPosition;
    const size=['x','y','z'].map(k=>hi[k]-lo[k]);
    // Respect the source 0.30 vertical toy pitch and 0.25 block grid.
    if(role==='toy')size.splice(0,3,.60,.38,.285);
    if(role==='toyPart')size.splice(0,3,.23,.22,.095);
    if(role==='houseCoin')size.splice(0,3,.40,.40,.048);
    if(role==='tin')size.splice(0,3,.46,.46,.53);
    if(role==='pointer')size[1]=size[0]; // Avoid the thin source arrow's edge-on silhouette.
    if(role==='bottle'||role==='bottleStack'||role==='tinRiver'){
      const axis=size.indexOf(Math.max(...size));
      // A held item must fit the original 0.20 stack pitch. The previous
      // 0.43 diameter fused consecutive bottles into a tall sheet at the worker.
      if(role==='bottleStack')for(let a=0;a<3;a++)size[a]=a===axis?.70:.17;
      if(role==='tinRiver')for(let a=0;a<3;a++)size[a]=a===axis?.65:.38;
      for(let i=0;i<g.positions.length;i+=3){const [x,y,z]=g.positions.slice(i,i+3),[a,b,c]=g.normals.slice(i,i+3);if(axis===1){g.positions.splice(i,3,x,z,-y);g.normals.splice(i,3,a,c,-b);}else if(axis===0){g.positions.splice(i,3,z,y,-x);g.normals.splice(i,3,c,b,-a);}}
    }
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<g.positions.length;i++) {let a=i%3;min[a]=Math.min(min[a],g.positions[i]);max[a]=Math.max(max[a],g.positions[i]);}
    const extra=role==='bottle'?1.25:role==='pointer'?1.3:1;
    for(let i=0;i<g.positions.length;i++){const a=i%3,k='xyz'[a],center=a===2&&['toy','toyPart'].includes(role)?lo.z+size[2]/2:(lo[k]+hi[k])/2;g.positions[i]=((g.positions[i]-min[a])/(max[a]-min[a]||1)-.5)*Math.max(size[a],.04)*extra+center;}
    const mesh=cc.utils.createMesh(g,undefined,{calculateBounds:true});mesh.name='RiverWorkshop_'+role;cache.set(key,mesh);return mesh;
  }
  function solid(hex,instanced=true){const key='solid:'+hex+':'+instanced;if(cache.has(key))return cache.get(key);const m=new cc.Material();m.initialize({effectName:'builtin-standard',defines:{USE_ALBEDO_MAP:false,USE_INSTANCING:instanced}});m.setProperty('mainColor',new cc.Color(...rgb(hex).map(x=>Math.round(x*255)),255));m.setProperty('roughness',.8);cache.set(key,m);return m;}
  function spriteArt(type){
    const key='sprite:'+type;if(cache.has(key))return cache.get(key);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
    c.lineJoin='round';c.lineCap='round';
    if(type==='chevron'){
      c.beginPath();c.moveTo(64,8);c.lineTo(111,56);c.lineTo(85,56);c.lineTo(85,115);c.lineTo(43,115);c.lineTo(43,56);c.lineTo(17,56);c.closePath();c.fillStyle=palette.coral;c.strokeStyle=palette.deep;c.lineWidth=10;c.fill();c.stroke();
    }else if(type==='bottle'){
      c.fillStyle=palette.deep;c.fillRect(49,8,30,18);c.fillStyle=palette.blue;c.beginPath();c.roundRect(35,29,58,91,16);c.fill();c.fillRect(48,22,32,18);c.fillStyle=palette.cream;c.fillRect(36,60,56,30);c.strokeStyle=palette.teal;c.lineWidth=5;c.strokeRect(36,60,56,30);
    }else if(type==='toyPart'){c.fillStyle=palette.deep;c.fillRect(13,46,102,57);c.fillStyle=palette.coral;c.fillRect(17,40,94,56);for(const x of [38,85]){c.fillStyle=palette.yellow;c.fillRect(x-13,28,26,16);c.beginPath();c.ellipse(x,28,13,6,0,0,7);c.fill();}}
    else if(type==='bale'){c.fillStyle=palette.deep;c.fillRect(13,27,102,78);c.fillStyle=palette.teal;c.fillRect(17,20,94,75);c.fillStyle=palette.cream;c.fillRect(34,20,10,75);c.fillRect(83,20,10,75);}
    else if(type==='toy'){c.fillStyle=palette.deep;c.beginPath();c.roundRect(7,57,114,36,7);c.fill();c.fillStyle=palette.teal;c.fillRect(11,69,106,17);c.fillStyle=palette.coral;c.fillRect(12,44,55,29);c.fillStyle=palette.yellow;c.fillRect(9,40,61,9);c.beginPath();c.roundRect(72,28,40,49,6);c.fill();c.fillStyle=palette.coral;c.fillRect(69,25,46,9);c.fillStyle=palette.blue;c.fillRect(82,38,26,21);c.fillStyle=palette.cream;c.fillRect(110,69,10,10);for(const x of [33,95]){c.fillStyle=palette.navy;c.beginPath();c.arc(x,89,17,0,7);c.fill();c.fillStyle=palette.cream;c.beginPath();c.arc(x,89,7,0,7);c.fill();}}
    else if(type==='pad'||type==='padActive'){c.fillStyle=type==='padActive'?palette.mint:palette.deep;c.beginPath();c.roundRect(6,6,116,116,24);c.fill();c.strokeStyle=palette.cream;c.lineWidth=7;c.stroke();c.strokeStyle=type==='padActive'?palette.teal:palette.yellow;c.lineWidth=3;c.beginPath();c.roundRect(15,15,98,98,16);c.stroke();}
    const img=new cc.ImageAsset(canvas),tex=new cc.Texture2D();tex.image=img;const frame=new cc.SpriteFrame();frame.texture=tex;cache.set(key,frame);return frame;
  }
  function roleFor(n,c,path){
    const name=n.name,mid=c.mesh?.uuid||'',mat=c.sharedMaterials?.map(x=>x?.name).join(' ')||'';
    if(/JianTou/.test(name)||path.includes('/GuideArrow/'))return 'pointer';
    let ancestor=n,flag;while(ancestor){flag=ancestor.getComponent('PrefabType')?.flag;if(flag)break;ancestor=ancestor.parent;}
    if(flag==='罐头')return 'bale';
    if(flag==='Coin'||/SM_JinBi/.test(name))return 'houseCoin';
    if(/SM_FanQie/.test(name))return 'tin';
    if(/CornResource/.test(name)||mat==='M_CornResource')return path.includes('/Model-001/')&&path.includes('/河里/')?'tinRiver':'bottle';
    if(/SM_JiDanHe/.test(name))return 'toy';
    if(/SM_JiDan/.test(name))return 'toyPart';
    if(/SM_YuMi|SM_Can|SM_GuanTou/.test(name)||/罐头/.test(path))return 'bale';
    if(/SM_Tree/.test(name))return 'pine';
    if(/SM_CaoDuo/.test(name))return 'bale';
    if(/SM_ZhuangShiWu_(DaiZi|MuTong|MuXiang)/.test(name))return 'bin';
    if(/^SM_JiQi_B$/.test(name))return 'shredder';
    if(/^SM_JiQi_A$/.test(name))return 'assembly';
    if(/SM_JiJuan/.test(name))return 'molder';
    if(/SM_NongShe/.test(name))return 'depot';
    return null;
  }
  function findNode(root,predicate){if(predicate(root))return root;for(const n of root.children){const found=findNode(n,predicate);if(found)return found;}return null;}
  function liftZones(scene){
    const ctrl=findNode(scene,n=>n.name==='UnlockAreaCtrl');if(!ctrl)return;
    for(const n of ctrl.children){
      if(!/Trigger$/.test(n.name))continue;
      // Lift only the paint. Trigger roots, rigid bodies and collision volumes stay put.
      const areas=n.children.filter(x=>x.name==='meatArea'||['back','frame','icon','fill','arrow'].includes(x.name));
      for(const visual of areas){const p=visual.worldPosition;visual.setWorldPosition(p.x,p.y+.12,p.z);}
      const source=n.getComponent('cc.Sprite'),ui=n.getComponent('cc.UITransform');
      if(source?.spriteFrame&&ui){
        const visual=new cc.Node('RiverPad');visual.layer=n.layer;n.addChild(visual);
        visual.addComponent('cc.UITransform').setContentSize(ui.width,ui.height);
        const paint=visual.addComponent('cc.Sprite');
        // These are floor decals, not HUD overlays. The source Unlock material
        // tests scene depth; the default UI material paints over the player's legs.
        paint.customMaterial=source.getRenderMaterial(0);
        paint.spriteFrame=spriteArt('pad');paint.type=0;paint.sizeMode=0;
        visual.getComponent('cc.UITransform').setContentSize(ui.width,ui.height);
        visual.setPosition(0,0,.12/Math.abs(n.worldScale.x));
        source.enabled=false;nature.pads.push({source,paint});
      }
      const input=n.getComponent('YuMiFactoryTrigger');if(input){input.itemSpriteW=spriteArt('pad');input.itemSpriteG=spriteArt('padActive');input.itemSprite.spriteFrame=input.itemSpriteW;input.itemSprite.color=new cc.Color(255,255,255,255);}
    }
    // Give the pad fill, border and icon distinct depth planes as well.
    function separate(n){const sprite=n.getComponent('cc.Sprite');if(sprite&&!n.getComponent('cc.Collider')&&['back','fill','frame','icon','arrow'].includes(n.name)){const p=n.worldPosition,y={back:.115,fill:.125,frame:.135,icon:.16,arrow:.16}[n.name];n.setWorldPosition(p.x,y,p.z);}n.children.forEach(separate);}
    ctrl.children.filter(n=>/Trigger$/.test(n.name)).forEach(separate);
    stats.raisedZones=ctrl.children.filter(n=>/Trigger$/.test(n.name)).map(n=>n.name);
    // Purchase pads are separate from transfer triggers. Move their existing
    // visual containers, keeping source sprites, fill references and materials.
    // The container's show tween changes scale only; this lift survives it.
    const purchases=ctrl.children.filter(n=>n.getComponent('WorkerUnlock')||n.getComponent('UnlockMgr'));
    for(const n of purchases){
      const purchase=n.getComponent('WorkerUnlock')||n.getComponent('UnlockMgr');
      const visual=purchase.containerNode||purchase.container;
      if(!visual||visual===n)continue;
      const p=visual.worldPosition;visual.setWorldPosition(p.x,p.y+.12,p.z);
      function layers(node){
        const sprite=node.getComponent('cc.Sprite'),label=node.getComponent('cc.Label');
        if((sprite||label)&&!node.getComponent('cc.Collider')){
          const y=label?.16:({back:.115,fill:.125,frame:.135}[node.name]??.15),p=node.worldPosition;
          node.setWorldPosition(p.x,y,p.z);
        }
        node.children.forEach(layers);
      }
      layers(visual);
    }
    stats.raisedPurchaseZones=purchases.map(n=>n.name);
  }
  function addMesh(parent,name,makeGeometry){const node=new cc.Node(name);node.layer=parent.layer;parent.addChild(node);const r=node.addComponent('cc.MeshRenderer');let mesh=cache.get('nature:'+name);if(!mesh){mesh=cc.utils.createMesh(makeGeometry(),undefined,{calculateBounds:true});mesh.name='RiverNature_'+name;cache.set('nature:'+name,mesh);}r.mesh=mesh;r.setSharedMaterial(vertexMaterial,0);node.setRotationFromEuler(-90,0,0);return node;}
  function createNature(scene){
    mainCamera=findNode(scene,n=>n.name==='mainCamera-竖屏');
    const root=new cc.Node('RiverNature');decorationRoots.add(root);scene.addChild(root);const sample=findNode(scene,n=>n.name==='SM_Tree');root.layer=sample?.layer||1;
    // Dress existing tree positions; keep their roots and colliders intact.
    let treeIndex=0;
    function trees(n){if(/^SM_Tree/.test(n.name)&&n.getComponent('cc.MeshRenderer')){const r=n.getComponent('cc.MeshRenderer');r.enabled=false;const holder=new cc.Node('RiverBlossomTree');decorationRoots.add(holder);holder.layer=root.layer;n.addChild(holder);holder.setRotationFromEuler(90,0,0);addMesh(holder,'Trunk',bareTree);const crown=addMesh(holder,'Blossoms',blossoms),threshold=.22+(treeIndex++%5)*.08;nature.trees.push({crown,threshold});}else n.children.slice().forEach(trees);}
    trees(scene);
    // Two small flowering accents sit off the working lanes near the river.
    for(const [x,z] of [[6.7,-5.6],[5.4,.3]]){const holder=new cc.Node('RiverGardenTree');holder.layer=root.layer;root.addChild(holder);holder.setPosition(x,0,z);holder.setScale(.8,.8,.8);addMesh(holder,'Trunk',bareTree);nature.trees.push({crown:addMesh(holder,'Blossoms',blossoms),threshold:.30});}
    const sites=[[4.6,-6.1],[5.4,-5.8],[5.9,-4.9],[4.5,-3.9],[3.5,-3.2],[4.7,-2.5],[5.4,-1.8],[5.6,-.9],[4.6,.3],[3.8,.0],[3.4,2.8],[3.9,3.5],[2.8,4.4],[1.7,4.8],[-.1,5.2],[-1.2,5.4],[-2.4,5.4],[-6.8,5.8],[-8,4.7],[-9.4,2.4],[-9.7,1.5],[-9.9,-.2],[-9.9,-1.1],[-9.9,-5.5],[-9.5,-6.4],[.8,-9.3],[1.7,-9.2],[2.7,-9.1]];
    sites.forEach(([x,z],i)=>{const flower=addMesh(root,'Flowers',flowers);flower.setPosition(x,.035,z);nature.flowers.push({node:flower,threshold:.18+(i%7)*.065});});
    const rig=findNode(scene,n=>n.name==='BaiE@act');
    if(rig)for(let i=0;i<3;i++){
      const holder=new cc.Node('RiverGoose_'+i);holder.layer=root.layer;root.addChild(holder);const copy=cc.instantiate(rig);holder.addChild(copy);copy.setPosition(0,0,0);copy.setRotationFromEuler(0,0,0);copy.setScale(.76,.76,.76);copy.getComponentsInChildren('cc.SkinnedMeshRenderer').forEach(c=>c.enabled=true);const anim=copy.getComponent('cc.SkeletalAnimation');nature.animals.push({node:holder,anim,index:i,threshold:.46+i*.16,phase:i*4.1,walking:false});holder.active=false;
    }
    stats.nature={trees:nature.trees.length,flowerPatches:nature.flowers.length,animals:nature.animals.length,visibleTrees:0,visibleFlowers:0,visibleAnimals:0};
    cc.director.on(cc.Director.EVENT_BEFORE_UPDATE,animateNature);
  }
  function animateNature(){
    const dt=Math.min(cc.director.getDeltaTime(),.05),t=stats.cleanliness;
    if(mainCamera)for(const pointer of nature.pointers)pointer.setWorldRotation(mainCamera.worldRotation);
    for(const animal of nature.animals){const visible=t>animal.threshold;if(animal.node.active!==visible)animal.node.active=visible;if(!visible)continue;animal.phase+=dt*.35;const a=animal.phase,center=animalCenters[animal.index];animal.node.setPosition(center[0]+Math.cos(a)*.65,.035,center[1]+Math.sin(a)*.48);animal.node.setRotationFromEuler(0,Math.atan2(-Math.sin(a)*.65,Math.cos(a)*.48)*180/Math.PI,0);if(!animal.walking){animal.anim?.play('walk');animal.walking=true;}}
    for(const can of nature.tins){if(!can.node.activeInHierarchy)continue;can.phase+=dt;can.node.setPosition(Math.sin(can.phase*.38)*.10,Math.cos(can.phase*.31)*.075,Math.sin(can.phase*1.1)*.035);can.node.setRotationFromEuler(Math.sin(can.phase*.8)*7,Math.cos(can.phase*.6)*6,Math.sin(can.phase*.32)*9);}
  }
  function growNature(t){
    const progress=(threshold)=>Math.max(0,Math.min(1,(t-threshold)/.20));
    for(const tree of nature.trees){const p=progress(tree.threshold);if(tree.progress===p)continue;tree.progress=p;tree.crown.active=p>.015;tree.crown.setScale(p,p,p);}
    for(const flower of nature.flowers){const p=progress(flower.threshold);if(flower.progress===p)continue;flower.progress=p;flower.node.active=p>.015;flower.node.setScale(p,p,p);}
    if(stats.nature){stats.nature.visibleTrees=nature.trees.filter(x=>x.crown.activeInHierarchy).length;stats.nature.visibleFlowers=nature.flowers.filter(x=>x.node.activeInHierarchy).length;stats.nature.visibleAnimals=nature.animals.filter(x=>x.node.activeInHierarchy).length;}
  }
  function setupLawnIntro(scene){
    const game=scene.getChildByName('GameMgr').getComponent('GameMgr'),root=scene.getChildByName('GlobalData').getChildByName('YuMiMgr'),manager=root.getComponent('YuMiMgr');
    const items=root.children.filter(n=>n.name==='Meat'&&n.getComponent('Meat'));
    const sites=[[1.5,-5.5],[-1.5,-5.8],[0,-4.2],[2,-3.9],[-1.7,-4],[.1,-2.5],[1.1,-1.3],[-1.5,-.9]];
    if(items.length<sites.length)throw Error('Lawn intro requires eight existing source bottles');
    lawnIntro={root,manager,managerEnabled:manager.enabled,paused:[],nearest:manager.GetMeatMove,nearestDescriptor:Object.getOwnPropertyDescriptor(manager,'GetMeatMove')};
    manager.enabled=false;
    items.forEach((n,i)=>{
      const meat=n.getComponent('Meat');
      if(i<sites.length){
        origins.set(n,'lawn');lawnBottles.add(n);meat.SetStop();n.setWorldPosition(sites[i][0],.235,sites[i][1]);n.setWorldRotationFromEuler(0,(i*137+24)%360,0);
      }else{
        origins.set(n,'river');const colliders=n.getComponentsInChildren('cc.Collider').map(c=>({c,enabled:c.enabled}));
        lawnIntro.paused.push({meat,enabled:meat.enabled,colliders});meat.enabled=false;colliders.forEach(x=>x.c.enabled=false);
      }
    });
    // Guide searches use the remaining lawn litter until all eight are picked up.
    // The source production guide still takes over normally when the load is ready.
    manager.GetMeatMove=function(position){let nearest=null,distance=Infinity;for(const n of lawnBottles){if(n.parent!==root)continue;const d=cc.Vec3.squaredDistance(position,n.worldPosition);if(d<distance){distance=d;nearest=n;}}return nearest||lawnIntro.nearest.call(this,position);};
    const player=game.player.node;player.setWorldPosition(0,0,-6);
    const camera=scene.getComponentInChildren('CameraMgr');
    if(camera){camera.node.getComponent('cc.Animation')?.stop();camera.node.setWorldPosition(player.worldPosition.clone().add(camera._offset));}
    const target=manager.GetMeatMove(player.worldPosition);game.guideController.WaterResource.setWorldPosition(target.worldPosition);game.guideController.guideToTarget(0,game.guideController.WaterResource);
    stats.intro={lawnBottleIds:[...lawnBottles].map(n=>n.uuid),sites,heldRiverBottles:lawnIntro.paused.length,riverReleased:false};
  }
  function releaseRiver(){
    if(!lawnIntro||stats.intro.riverReleased)return;
    stats.cleanupStage='river';stats.intro.riverReleased=true;
    const {manager,nearestDescriptor,paused}=lawnIntro;
    if(nearestDescriptor)Object.defineProperty(manager,'GetMeatMove',nearestDescriptor);else delete manager.GetMeatMove;
    paused.forEach(({meat,enabled,colliders})=>{if(cc.isValid(meat)){meat.enabled=enabled;colliders.forEach(x=>{if(cc.isValid(x.c))x.c.enabled=x.enabled;});}});
    paused.length=0;manager.enabled=lawnIntro.managerEnabled;
    introLocations.forEach(c=>c.enText='CLEAN THE RIVER');introLabels.forEach(c=>c.string='CLEAN THE RIVER');
  }
  function observeChild(child){
    // Reset immediately when the pool returns a bottle to the river, even if
    // it is picked up again before the next rendered frame.
    if(child.name==='Meat'&&child.parent?.name==='YuMiMgr'){recovered.delete(child);origins.set(child,'river');}
    pending.add(child);
  }
  function observeComponent(component){pending.add(component.node);}
  function watchNode(n){if(watched.has(n))return;watched.add(n);n.on(cc.Node.EventType.CHILD_ADDED,observeChild);n.on(cc.Node.EventType.COMPONENT_ADDED,observeComponent);}
  function flushChanges(){
    if(!pending.size)return;
    const started=performance.now(),batch=new Set(pending);pending.clear();
    try{for(const n of batch){if(!cc.isValid(n)||!n.parent)continue;let p=n.parent,path='',nested=false;while(p){if(batch.has(p)){nested=true;break;}path='/'+p.name+path;p=p.parent;}if(!nested)processNode(n,path,true);}}
    catch(e){if(!stats.errors.includes(e.message)){stats.errors.push(e.message);console.error('[River Workshop]',e);}}
    stats.incrementalFlushes++;stats.lastScanMs=performance.now()-started;
  }
  function styleLabel(c){if(!cc.isValid(c)){labels.delete(c);return;}if(styled.has(c)&&c.fontFamily==='Fredoka')return;styled.add(c);c.font=null;c.useSystemFont=true;c.fontFamily='Fredoka';c.isBold=false;if(c.string==='DRAG TO MOVE')c.string=stats.cleanupStage==='lawn'?'CLEAN THE LAWN':'CLEAN THE RIVER';stats.labels++;}
  function stabilizeHelper(buddy){
    if(stableHelpers.has(buddy))return;
    const mover=buddy.node.getComponent('NPCPathMove3D');if(!mover)return;
    stableHelpers.add(buddy);stats.stableHelpers++;
    const sourceInit=mover.init,sourceStep=mover.logicUpdate;
    const from=new cc.Vec3(),direction=new cc.Vec3(),previous=new cc.Quat(),targetRotation=new cc.Quat(),rotation=new cc.Quat();
    let hasStarted=false;
    mover.init=function(points,onArrive){
      const position=this.node.worldPosition.clone(),keepPosition=hasStarted;
      sourceInit.call(this,points,onArrive);
      // Subsequent routes already begin at the helper. Do not snap the last
      // few centimetres back to their first waypoint on every work cycle.
      if(keepPosition)this.node.setWorldPosition(position);
      if(this._inited)hasStarted=true;
    };
    mover.logicUpdate=function(dt){
      const point=this.pathPoints?.[this.currentIndex];
      if(!this._inited||this._bPause||!point||!(dt>0))return sourceStep.call(this,dt);
      cc.Vec3.copy(from,this.node.worldPosition);cc.Quat.copy(previous,this.node.worldRotation);
      cc.Vec3.subtract(direction,point.worldPosition,from);
      const distance=direction.length(),horizontal=Math.hypot(direction.x,direction.z);
      // Keep the source speed and river height calculation. Clamp only a step
      // that would pass the waypoint, which otherwise causes backtracking.
      const step=this.speed>0?Math.min(dt,distance/this.speed):dt;
      sourceStep.call(this,step);
      if(horizontal<.1)return;
      direction.y=0;direction.normalize();
      cc.Quat.fromViewUp(targetRotation,direction,cc.Vec3.UP);
      cc.Quat.normalize(previous,previous);cc.Quat.normalize(targetRotation,targetRotation);
      const dot=Math.abs(cc.Quat.dot(previous,targetRotation));
      const angle=2*Math.acos(Math.min(1,dot)),maxTurn=Math.min(dt,.05)*Math.PI*2;
      cc.Quat.slerp(rotation,previous,targetRotation,angle>1e-6?Math.min(1,maxTurn/angle):1);
      this.node.setWorldRotation(rotation);
    };
  }
  function processNode(n,path='',observe=false){
    if(decorationRoots.has(n))return;
    stats.visitedNodes++;observe=observe||dynamicRoots.has(n);if(observe)watchNode(n);
    path+='/'+n.name;
    // Observe real transfers. A pooled bottle can be counted again only after
    // its next appearance in the river. Never count placement or idle time.
    if(n.name==='Meat'){
      if(n.parent?.name==='YuMiMgr')recovered.delete(n);
      else if(/PlayerRoot|BuddyMgr/.test(path)&&!recovered.has(n)){
        recovered.add(n);stats.bottlesRecovered++;
        if(origins.get(n)==='lawn'&&lawnBottles.delete(n)){stats.lawnRecovered++;if(stats.lawnRecovered===stats.lawnGoal)releaseRiver();}
        else{stats.riverRecovered++;if(stats.riverRecovered>=stats.riverGoal)stats.cleanupStage='complete';}
      }
    }
    for(const c of n.components||[]){
      const type=cc.js.getClassName(c);
      if(type==='Buddy')stabilizeHelper(c);
      if(type==='cc.ParticleSystem'&&n.name==='水流'&&!waterMaterial)waterMaterial=c.getMaterialInstance(0);
      // Pooled bottles change only their visible mesh when carried. Keep every
      // inventory object, stack position and pickup/production timing unchanged.
      if(bottleSources.has(c)){const held=!path.includes('/YuMiMgr/');const role=held?'bottleStack':'bottle';if(c.mesh.name!=='RiverWorkshop_'+role)c.mesh=mapMesh(bottleSources.get(c),role);}
      if(c.mesh&&!processed.has(c)){
        processed.add(c);let role=roleFor(n,c,path);
        if(role==='pointer'){addPointer(n,c);continue;}
        // Animal renderers and nests belong to the old production dressing only.
        if(/SM_Ji\.001|SM_JiWo|SM_WeiShiCao|SM_BaiE/.test(n.name)||(/SM_JiDan-/.test(n.name)&&(path.includes('/JiDanHe/')||path.includes('/收银台/')))){c.enabled=false;continue;}
        if(role){if(role==='bottle'&&n.name==='MeatIn'){bottleSources.set(c,c.mesh);if(!path.includes('/YuMiMgr/'))role='bottleStack';}c.mesh=mapMesh(c.mesh,role);c.setSharedMaterial(role==='houseCoin'?coinMaterial:vertexMaterial,0);stats.meshes++;stats.roles[role]=(stats.roles[role]||0)+1;
          // The ending's tomato patch becomes a new stream of tins. Animate
          // only a visual child: the captured scene roots stay byte-for-byte placed.
          if(role==='tin'||role==='tinRiver'){const visual=new cc.Node('RiverFloatingTin');decorationRoots.add(visual);visual.layer=n.layer;n.addChild(visual);const renderer=visual.addComponent('cc.MeshRenderer');renderer.mesh=c.mesh;renderer.setSharedMaterial(vertexMaterial,0);c.enabled=false;nature.tins.push({node:visual,phase:nature.tins.length*2.3});}
        }
        else if(/SM_MuBan|SM_DianZi/.test(n.name)){c.setSharedMaterial(solid(palette.teal),0);stats.materials++;}
        else if(/SM_WeiLan/.test(n.name)){c.setSharedMaterial(solid(palette.deep),0);stats.materials++;}
        else if(/SM_ChuanSongDai/.test(n.name)){c.sharedMaterials.forEach((_,i)=>c.setSharedMaterial(solid(i?palette.deep:palette.yellow),i));stats.materials++;}
        else if(/SM_JiQi_B_/.test(n.name)){c.setSharedMaterial(solid(palette.yellow),0);stats.materials++;}
        else if(/SM_CaoMao/.test(n.name)){c.setSharedMaterial(solid(palette.teal,false),0);stats.materials++;}
        else if(/SM_HeLiu_Di/.test(n.name)){c.setSharedMaterial(solid('#77765a'),0);stats.materials++;}
        else if(/SM_HeLiu/.test(n.name)){
          waterSurface=new cc.Material();waterSurface.initialize({effectName:'builtin-standard',technique:1,defines:{USE_ALBEDO_MAP:false}});waterSurface.setProperty('roughness',.24);c.setSharedMaterial(waterSurface,0);stats.materials++;
        }
        else if(/SM_CaoCong/.test(n.name)){c.setSharedMaterial(solid('#8b8855'),0);stats.materials++;}
        else if(/SM_CaoDi|SM_ShaDi/.test(n.name)){c.sharedMaterials.forEach((m,i)=>{if(/CaoDi/.test(m?.name))c.setSharedMaterial(solid('#b4bd87'),i);else if(/ShaDi/.test(m?.name))c.setSharedMaterial(solid('#d9c7a0'),i);});stats.materials++;}
      }
      if(type==='LocationText'&&path.includes('DRAG TO MOVE')){introLocations.add(c);c.enText=stats.cleanupStage==='lawn'?'CLEAN THE LAWN':'CLEAN THE RIVER';c.enSize=34;}
      if(type==='cc.Label'){if(path.includes('DRAG TO MOVE'))introLabels.add(c);labels.add(c);styleLabel(c);}
      if(type==='cc.Sprite'&&!styled.has(c)){
        // ArrowGuide is an empty 100-world-unit Sprite used as a controller.
        // Only replace existing artwork; painting that root covers the camera.
        if(!c.spriteFrame)continue;
        const uuid=(c.spriteFrame?.uuid||'').split('@')[0];let art;
        if(/arrow|Arrow/.test(n.name)||/GuideArrow/.test(path))art='chevron';
        if(uuid==='0edd1eb1-e16e-47df-b57d-ee8f01582f0a')art=path.includes('JiHeFactory')?'toyPart':path.includes('/JiFactory')?'bale':'bottle';
        if(uuid==='b8370330-81a9-40ef-95fa-f055f30c5f26')art='toy';
        if(uuid==='292867fb-da7d-4c84-a4be-671902149490')art='bale';
        if(uuid==='dea61db7-ce09-406c-89a5-6d87eda04314')art='toyPart';
        if(uuid==='e7fc984c-b9b3-4623-b785-9ec74716756d')art='houseCoin';
        if(uuid==='7a24317c-b96e-4c62-8b38-a2752220618d'){c.color=new cc.Color(31,111,121,235);styled.add(c);}
        if(uuid==='c0175932-bd1c-4985-8bd8-1cb86c3cf5fa'){c.color=new cc.Color(141,222,199,245);styled.add(c);}
        if(art){const trans=n.getComponent('cc.UITransform'),size=trans?{w:trans.width,h:trans.height}:null;c.spriteFrame=spriteArt(art);c.type=0;c.sizeMode=0;if(size)trans.setContentSize(size.w,size.h);c.color=new cc.Color(255,255,255,255);c.riverRole=art;styled.add(c);stats.sprites++;}
      }
    }
    n.children.forEach(child=>processNode(child,path,observe));
  }
  function colorSand(t){return new cc.Color(Math.round(153+73*t),Math.round(137+76*t),Math.round(105+64*t),255);}
  function recovery(){
    const previous=stats.cleanliness,previousGrass=stats.grassCleanliness;
    const smooth=(a,b)=>Math.abs(a-b)<.0005?b:a+(b-a)*.13;
    stats.grassCleanliness=smooth(previousGrass,Math.min(1,stats.lawnRecovered/stats.lawnGoal));
    stats.cleanliness=smooth(previous,Math.min(1,stats.riverRecovered/stats.riverGoal));
    const text=stats.cleanupStage==='lawn'?`1/2 · LAWN ${stats.lawnRecovered}/${stats.lawnGoal}`:stats.cleanupStage==='river'?`2/2 · RIVER ${Math.min(stats.riverRecovered,stats.riverGoal)}/${stats.riverGoal}`:'LAWN & RIVER RESTORED';
    if(recoveryText&&recoveryText.textContent!==text)recoveryText.textContent=text;
    const width=`${Math.round((stats.cleanupStage==='lawn'?stats.grassCleanliness:stats.cleanliness)*100)}%`;if(recoveryFill&&recoveryFill.style.width!==width)recoveryFill.style.width=width;
    if(previous===stats.cleanliness&&previousGrass===stats.grassCleanliness&&recovery.initialized)return;
    recovery.initialized=true;
    const t=stats.cleanliness,g=stats.grassCleanliness;growNature(g);
    solid('#d9c7a0').setProperty('mainColor',colorSand(g));
    const color=(a,b,alpha=255,p=t)=>new cc.Color(...rgb(a).map((v,i)=>Math.round((v+(rgb(b)[i]-v)*p)*255)),alpha);
    solid('#b4bd87').setProperty('mainColor',color('#a4987e','#6fc75a',255,g));
    solid('#8b8855').setProperty('mainColor',color('#8d805e','#3d9b50',255,g));
    solid('#77765a').setProperty('mainColor',color('#6b6851','#a2ded0'));
    if(waterMaterial)waterMaterial.setProperty('tintColor',color('#99824f','#c2fff4',Math.round(250-140*t)));
    if(waterSurface)waterSurface.setProperty('mainColor',color('#77704c','#4fc7db',Math.round(250-155*t)));
  }
  async function start(){
    cc=window.cclegacy||window.cc;const scene=cc?.director?.getScene?.();if(scene?.name!=='Game'||!scene.getChildByName('GameMgr')?.getComponent('GameMgr')?.bIninted)return false;
    await document.fonts.load('24px Fredoka');
    const title=document.getElementById('river-title');
    if(title){const row=document.createElement('div');row.className='river-recovery';recoveryText=document.createElement('span');const track=document.createElement('i');recoveryFill=document.createElement('b');track.append(recoveryFill);row.append(recoveryText,track);title.append(row);}
    vertexMaterial=new cc.Material();vertexMaterial.initialize({effectName:'builtin-unlit',defines:{USE_VERTEX_COLOR:true,USE_INSTANCING:true}});
    const coinImage=new Image();coinImage.src=window.riverHouseCoin;await coinImage.decode();
    const coinTexture=new cc.Texture2D();coinTexture.image=new cc.ImageAsset(coinImage);const coinFrame=new cc.SpriteFrame();coinFrame.texture=coinTexture;cache.set('sprite:houseCoin',coinFrame);
    coinMaterial=new cc.Material();coinMaterial.initialize({effectName:'builtin-unlit',defines:{USE_TEXTURE:true,USE_VERTEX_COLOR:true,USE_INSTANCING:true}});coinMaterial.setProperty('mainTexture',coinTexture);
    // Static environment is styled once, including inactive upgrade variants.
    // Only runtime inventory, factories and UI create/reparent objects later.
    for(const name of ['GameMgr','GlobalData','UICanvas']){const root=scene.getChildByName(name);if(root)dynamicRoots.add(root);}
    setupLawnIntro(scene);processNode(scene);liftZones(scene);createNature(scene);recovery();
    cc.director.on(cc.Director.EVENT_AFTER_UPDATE,flushChanges);
    // Only localization can reset an existing label without a node event.
    setInterval(()=>labels.forEach(styleLabel),1000);
    setInterval(recovery,100);
    const syncTitle=()=>{if(title)title.hidden=!!document.getElementById('local-game-end')||!!document.getElementById('radar-brand-loader');};
    new MutationObserver(syncTitle).observe(document.body,{childList:true});syncTitle();stats.ready=true;
    return true;
  }
  let busy=false;const timer=setInterval(async()=>{if(busy)return;busy=true;try{if(await start())clearInterval(timer);}catch(e){stats.errors.push(e.message);clearInterval(timer);console.error(e);}busy=false;},50);
})();
