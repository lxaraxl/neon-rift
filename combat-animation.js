const CombatAnimation = (() => {
  const frameCount = 24;
  const columns = 8;
  const heroSize = {width:192,height:204,body:150,foot:175};
  const creatureSize = {width:144,height:153,body:111,foot:131};
  const groups = {
    rest: ['idle'],
    motion: ['walk', 'run', 'fly'],
    clash: ['attack', 'block', 'hit'],
    power: ['ult', 'stun', 'victory', 'die'],
  };
  const periods = {idle:2400, walk:850, run:520, fly:1200, stun:840, victory:1080};
  const clips = new Map(Object.entries(groups).flatMap(([group,list]) =>
    list.map((action,index)=>[action,{group,index,period:periods[action]}])
  ));
  const newerSheets = new Set(['cipher','grom','lyra','pixel','rain','raven','tesla','zhar']);
  const frontLeft = new Set(['cipher']);
  const backLeft = new Set(['bastion','cipher','grom','kairos','lyra','mila','nyx','pixel','raven','scrap','tesla','zhar']);
  const atlas = Object.fromEntries(Object.keys(groups).map(name=>[name,new Map()]));
  const atlasBudget = {rest:15e6,motion:14.5e6,clash:17e6,power:10e6};
  const stills=new Map(),turns=new Map(),tints=new Map();
  const turnViews=['front','front-alt','back','back-alt','left','right'];
  const pending=[],deferred=new Map();
  const unavailable={image:null,ready:Promise.resolve(null)};
  let activeLoads=0;

  function drain(){
    while(activeLoads<3&&pending.length){
      const entry=pending.shift();
      if(entry.cancelled){entry.resolve(null);continue}
      activeLoads++;
      fetchImage(entry,()=>{
        activeLoads--;
        drain();
      });
    }
  }

  function fetchImage(entry,done=()=>{}){
    const image=new Image();
    image.decoding='async';
    if(entry.weight>1)image.fetchPriority='low';
    const finish=ok=>{
      entry.settled=true;
      if(ok&&!entry.cancelled)entry.image=image;
      entry.resolve(entry.image);
      done();
    };
    image.onload=()=>finish(true);
    image.onerror=()=>finish(false);
    image.src=entry.source;
  }

  function load(cache,source,limit,weight=1){
    let entry=cache.get(source);
    const time=performance.now();
    if(entry){
      entry.used=time;
      return entry;
    }
    if((deferred.get(source)||0)>time)return unavailable;
    let total=0;
    for(const item of cache.values())total+=item.weight;
    if(total+weight>limit){
      const stale=[...cache.values()].filter(item=>item.settled&&time-item.used>1100)
        .sort((a,b)=>a.used-b.used);
      for(const item of stale){
        cache.delete(item.source);total-=item.weight;
        if(total+weight<=limit)break;
      }
    }
    // A crowded frame keeps its current assets. Ready turn poses cover clips
    // that would overshoot the budget, and are never part of the large queue.
    if(weight>1&&total+weight>limit){
      deferred.set(source,time+240);
      return unavailable;
    }
    deferred.delete(source);
    if(weight===1&&cache.size>=limit){
      const oldest=[...cache.values()].sort((a,b)=>a.used-b.used)[0];
      if(oldest)cache.delete(oldest.source);
    }
    entry={source,weight,image:null,used:time,settled:false,cancelled:false};
    entry.ready=new Promise(resolve=>{entry.resolve=resolve});
    cache.set(source,entry);
    if(weight>1){pending.push(entry);drain()}else fetchImage(entry);
    return entry;
  }

  function facing(hero, dx, dy, previous) {
    const down = dy >= 0;
    const sign = dx < 0 ? -1 : 1;
    const horizontal = Math.abs(dx);
    const vertical = Math.abs(dy);
    const face = down ? 'front' : 'back';
    const wasSide=previous?.view==='left'||previous?.view==='right';
    const sideways=wasSide?1.44:1.72;
    if(horizontal>vertical*sideways){
      return {view:sign<0?'left':'right',flip:false,sign};
    }
    const original = (down ? frontLeft : backLeft).has(hero) ? -1 : 1;
    const sameSide=previous?.view.startsWith(face);
    const isNew=newerSheets.has(hero);
    const wasDiagonal=sameSide&&(previous.view.endsWith('-alt')===isNew);
    const diagonal=horizontal>vertical*(wasDiagonal?.14:.19);
    const alternate=isNew===diagonal;
    const flip=horizontal<=vertical*.08&&sameSide?previous.flip:horizontal>vertical*.08&&original!==sign;
    return {view:face+(alternate?'-alt':''),flip,sign:flip?-original:original};
  }

  function size(hero){
    return hero.startsWith('mob-')||hero.startsWith('companion-')?creatureSize:heroSize;
  }
  function group(hero,view,name){
    const {width,height}=size(hero);
    const weight=width*height*frameCount*groups[name].length;
    const revised=name==='motion'||hero==='bastion';
    return load(atlas[name],`art/combat/${hero}-${view}-${name}.webp?v=${revised?'stride2':'hd1'}`,atlasBudget[name],weight);
  }
  function warmTurn(hero){
    return load(turns,`art/combat/${hero}-turn.webp`,48);
  }
  function release(){
    for(const cache of Object.values(atlas)){
      for(const entry of cache.values())entry.cancelled=true;
      cache.clear();
    }
    for(const entry of pending.splice(0))entry.resolve(null);
    tints.clear();deferred.clear();
  }
  function still(hero,view){
    const source = hero.startsWith('mob-') ? `art/enemy_${hero.slice(4)}.webp`
      : hero.startsWith('companion-') ? `art/sprite_${hero.slice(10)}.webp`
      : miniatureSource(hero,view);
    return load(stills,source,42);
  }
  function preload(hero,view,names=['rest']){
    return Promise.all([warmTurn(hero).ready,...names.map(name=>group(hero,view,name).ready)]);
  }
  function frameIndex(action,time,progress){
    const clip = clips.get(action==='tap'?'attack':action) || clips.get('idle');
    const phase = clip.period ? ((time%clip.period)+clip.period)%clip.period/clip.period
      : Math.max(0,Math.min(1,progress||0));
    return Math.min(frameCount-1,Math.floor(phase*frameCount));
  }
  function tintedFrame(image,sx,sy,color,cellWidth,cellHeight){
    const key=image.src+'|'+sx+'|'+sy+'|'+color;
    if(tints.has(key))return tints.get(key);
    const tile=document.createElement('canvas');
    tile.width=cellWidth;tile.height=cellHeight;
    const g=tile.getContext('2d');
    g.drawImage(image,sx,sy,cellWidth,cellHeight,0,0,cellWidth,cellHeight);
    g.globalCompositeOperation='multiply';g.globalAlpha=.68;
    g.fillStyle=color;g.fillRect(0,0,cellWidth,cellHeight);
    g.globalCompositeOperation='color';g.globalAlpha=.48;
    g.fillRect(0,0,cellWidth,cellHeight);
    g.globalCompositeOperation='destination-in';g.globalAlpha=1;
    g.drawImage(image,sx,sy,cellWidth,cellHeight,0,0,cellWidth,cellHeight);
    if(tints.size>=160)tints.delete(tints.keys().next().value);
    tints.set(key,tile);
    return tile;
  }
  function draw(g,hero,view,action,time,progress,height,tint){
    const clip = clips.get(action==='tap'?'attack':action) || clips.get('idle');
    const image = group(hero,view,clip.group).image;
    if(image){
      const {width:cellWidth,height:cellHeight,body,foot}=size(hero);
      const frame = frameIndex(action,time,progress);
      const sx = frame%columns*cellWidth;
      const sy = (clip.index*3+Math.floor(frame/columns))*cellHeight;
      const k=height/body;
      if(tint){
        g.drawImage(tintedFrame(image,sx,sy,tint,cellWidth,cellHeight),-cellWidth*k/2,-foot*k,cellWidth*k,cellHeight*k);
      }else{
        g.drawImage(image,sx,sy,cellWidth,cellHeight,-cellWidth*k/2,-foot*k,cellWidth*k,cellHeight*k);
      }
      return true;
    }
    const turn=warmTurn(hero).image;
    if(turn){
      const {width,height:cellHeight,body,foot}=size(hero),k=height/body;
      const sw=width/2,sh=Math.floor(cellHeight/2);
      const sx=turn.naturalWidth===sw?0:Math.max(0,turnViews.indexOf(view))*sw;
      if(tint)g.drawImage(tintedFrame(turn,sx,0,tint,sw,sh),-width*k/2,-foot*k,width*k,cellHeight*k);
      else g.drawImage(turn,sx,0,sw,sh,-width*k/2,-foot*k,width*k,cellHeight*k);
      return true;
    }
    if(tint)return false;
    const fallback = still(hero,view).image;
    if(!fallback)return false;
    const w = height*fallback.naturalWidth/fallback.naturalHeight;
    g.drawImage(fallback,-w/2,-height,w,height);
    return true;
  }

  function effect(g,action,time,progress,height,color,angle,style) {
    const q = frameIndex(action,time,progress)/(frameCount-1);
    const melee = style==='war'||style==='tank';
    const attack = action==='attack' && q>.24 && q<.77;
    const block = action==='block' && q>.08 && q<.94;
    const power = action==='ult' && q>.08 && q<.96;
    if(!attack&&!block&&!power&&action!=='stun')return;
    g.save();
    g.lineCap='round';
    if(attack&&melee){
      const t=(q-.24)/.53, alpha=Math.sin(t*Math.PI);
      const side=Math.cos(angle)<0?-1:1;
      g.translate(Math.cos(angle)*height*.23,-height*.50+Math.sin(angle)*height*.12);
      g.scale(side,1);
      g.rotate(angle*.22*side);
      const edge=-1.56+t*2.42;
      g.globalAlpha*=alpha*.89;
      g.strokeStyle=color;
      g.lineWidth=height*.068;
      g.beginPath();
      g.ellipse(0,0,height*.50,height*.29,-.20,edge-.96,edge);
      g.stroke();
      g.strokeStyle='#f4fcff';
      g.lineWidth=height*.022;
      g.beginPath();
      g.ellipse(0,0,height*.50,height*.29,-.20,edge-.71,edge+.032);
      g.stroke();
    }else if(attack){
      const flow=(q-.24)/.53, r=height*(.065+.045*Math.sin(flow*Math.PI));
      g.translate(Math.cos(angle)*height*.28,-height*.59+Math.sin(angle)*height*.12);
      g.globalAlpha*=Math.sin(flow*Math.PI)*.80;
      g.strokeStyle=color;
      g.lineWidth=height*.019;
      g.beginPath();
      g.ellipse(0,0,r*1.36,r,.6,0,Math.PI*2);
      g.stroke();
      g.fillStyle='#ecfaff';
      g.beginPath();g.arc(0,0,r*.42,0,Math.PI*2);g.fill();
    }else if(block){
      const a=(q-.08)/.86, d=height*.30, alpha=Math.sin(a*Math.PI);
      g.translate(Math.cos(angle)*d,-height*.48+Math.sin(angle)*d*.38);
      g.rotate(Math.cos(angle)*.18);
      g.globalAlpha*=alpha*.88;
      g.strokeStyle='#baeeff';g.fillStyle='#55b3ff38';
      g.lineWidth=height*.021;
      g.beginPath();
      for(let i=0;i<6;i++){
        const v=i*Math.PI/3;
        const x=Math.sin(v)*height*.25,y=Math.cos(v)*height*.34;
        if(i)g.lineTo(x,y);else g.moveTo(x,y);
      }
      g.closePath();g.fill();g.stroke();
    }else if(power){
      g.translate(0,-height*.22-q*height*.40);
      g.globalAlpha*=Math.sin(q*Math.PI)*.8;
      g.strokeStyle=color;
      g.lineWidth=height*.021;
      g.beginPath();
      for(let i=0;i<3;i++){
        const a=(q*.8+i/3)*Math.PI*2;
        g.ellipse(0,0,height*.41,height*.14,0,a,a+.83);
        g.stroke();
        g.beginPath();
      }
    }else{
      g.translate(0,-height*1.02);
      g.fillStyle='#ffdc8d';
      for(let i=0;i<3;i++){
        const a=(q+i/3)*Math.PI*2;
        g.globalAlpha=.62+.28*Math.sin(a);
        g.beginPath();g.arc(Math.cos(a)*height*.24,Math.sin(a)*height*.055,height*.023,0,Math.PI*2);g.fill();
      }
    }
    g.restore();
  }

  return {frameCount, frameIndex, facing, preload, draw, effect, release};
})();
