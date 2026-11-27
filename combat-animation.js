const CombatAnimation = (() => {
  const frameCount = 24;
  const cellWidth = 112, cellHeight = 120, body = 86, foot = 103, columns = 8;
  const groups = {
    motion: ['idle', 'walk', 'run', 'fly'],
    clash: ['attack', 'block', 'hit'],
    power: ['ult', 'stun', 'victory', 'die'],
  };
  const periods = {idle:2400, walk:850, run:520, fly:1200, stun:840, victory:1080};
  const clips = new Map(Object.entries(groups).flatMap(([group,list]) =>
    list.map((action,index)=>[action,{group,index,period:periods[action]}])
  ));
  const newerSheets = new Set(['cipher','grom','lyra','pixel','rain','raven','tesla','zhar']);
  const frontLeft = new Set(['cipher']);
  const backLeft = new Set(['cipher','grom','kairos','lyra','mila','nyx','pixel','raven','scrap','tesla','zhar']);
  const atlas = new Map();
  const stills = new Map();
  let tintCanvas, tintContext;

  function load(cache, source, limit) {
    let entry = cache.get(source);
    if(entry){
      cache.delete(source);
      cache.set(source,entry);
      return entry;
    }
    entry = {image:null, ready:null};
    entry.ready = new Promise(resolve=>{
      const image = new Image();
      image.decoding = 'async';
      image.onload = ()=>{entry.image=image;resolve(image);};
      image.onerror = ()=>resolve(null);
      image.src = source;
    });
    cache.set(source,entry);
    if(cache.size>limit)cache.delete(cache.keys().next().value);
    return entry;
  }

  function facing(hero, dx, dy) {
    const down = dy >= 0;
    const sign = dx < 0 ? -1 : 1;
    const horizontal = Math.abs(dx);
    const vertical = Math.abs(dy);
    const face = down ? 'front' : 'back';
    if(horizontal>vertical*1.65){
      return {view:sign<0?'left':'right',flip:false,sign};
    }
    const original = (down ? frontLeft : backLeft).has(hero) ? -1 : 1;
    const diagonal = horizontal>vertical*.28;
    const alternate = newerSheets.has(hero)===diagonal;
    return {view:face+(alternate?'-alt':''),flip:diagonal&&original!==sign,
      sign:diagonal?sign:original};
  }

  function group(hero,view,name){
    return load(atlas,`art/combat/${hero}-${view}-${name}.webp`,36);
  }
  function still(hero,view){
    const source = hero.startsWith('mob-') ? `art/enemy_${hero.slice(4)}.webp`
      : hero.startsWith('companion-') ? `art/sprite_${hero.slice(10)}.webp`
      : miniatureSource(hero,view);
    return load(stills,source,42);
  }
  function preload(hero,view,names=['motion','clash']){
    return Promise.all(names.map(name=>group(hero,view,name).ready));
  }
  function frameIndex(action,time,progress){
    const clip = clips.get(action==='tap'?'attack':action) || clips.get('idle');
    const phase = clip.period ? ((time%clip.period)+clip.period)%clip.period/clip.period
      : Math.max(0,Math.min(1,progress||0));
    return Math.min(frameCount-1,Math.floor(phase*frameCount));
  }
  function tintedFrame(image,sx,sy,color){
    if(!tintCanvas){
      tintCanvas=document.createElement('canvas');
      tintCanvas.width=cellWidth;tintCanvas.height=cellHeight;
      tintContext=tintCanvas.getContext('2d');
    }
    const g=tintContext;
    g.clearRect(0,0,cellWidth,cellHeight);
    g.drawImage(image,sx,sy,cellWidth,cellHeight,0,0,cellWidth,cellHeight);
    g.globalCompositeOperation='multiply';g.globalAlpha=.68;
    g.fillStyle=color;g.fillRect(0,0,cellWidth,cellHeight);
    g.globalCompositeOperation='color';g.globalAlpha=.48;
    g.fillRect(0,0,cellWidth,cellHeight);
    g.globalCompositeOperation='destination-in';g.globalAlpha=1;
    g.drawImage(image,sx,sy,cellWidth,cellHeight,0,0,cellWidth,cellHeight);
    g.globalCompositeOperation='source-over';
    return tintCanvas;
  }
  function draw(g,hero,view,action,time,progress,height,tint){
    const clip = clips.get(action==='tap'?'attack':action) || clips.get('idle');
    const image = group(hero,view,clip.group).image;
    if(image){
      const frame = frameIndex(action,time,progress);
      const sx = frame%columns*cellWidth;
      const sy = (clip.index*3+Math.floor(frame/columns))*cellHeight;
      const k=height/body;
      if(tint){
        g.drawImage(tintedFrame(image,sx,sy,tint),-cellWidth*k/2,-foot*k,cellWidth*k,cellHeight*k);
      }else{
        g.drawImage(image,sx,sy,cellWidth,cellHeight,-cellWidth*k/2,-foot*k,cellWidth*k,cellHeight*k);
      }
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

  return {frameCount, frameIndex, facing, preload, draw, effect};
})();
