const TitleChase = (() => {
  const duration=8600;
  const fps=60;
  const chase=[
    {id:'astra',x:.11,y:-.004,phase:115,color:'#ffd687'},
    {id:'pixel',x:.25,y:.014,phase:245,color:'#68f2ff'},
    {id:'volta',x:.34,y:-.029,phase:310,color:'#3ad1ff'},
    {id:'silas',x:.50,y:.007,phase:20,color:'#a0eaff'},
  ];
  const motes=Array.from({length:18},(_,i)=>({
    x:(.618*i)%1,y:(.439*i)%1,speed:.07+(i%5)*.024,phase:i*.73,
  }));
  const clamp=q=>Math.max(0,Math.min(1,q));
  const ease=q=>{q=clamp(q);return q*q*(3-2*q);};
  const frac=q=>q-Math.floor(q);

  function camera(time){
    const frame=Math.floor(time*fps/1000);
    const q=frac(frame*1000/fps/duration);
    const escape=ease((q-.74)/.23);
    // The runners head right. The city and near road both travel left.
    const distance=q*.82+escape*.18;
    const veil=1-ease(Math.min(q/.052,(1-q)/.073));
    return {frame,q,distance,escape,veil};
  }

  function start(canvas,world,transition){
    const g=canvas.getContext('2d');
    const image=new Image();
    image.fetchPriority='high';
    image.src='art/bg_title_city.webp';
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const startTime=performance.now();
    let width=0,height=0,scale=1,raf,tile=0;
    let staticReady=false,lastFrame=-1;
    let clientWidth=canvas.clientWidth,clientHeight=canvas.clientHeight;
    const resize=new ResizeObserver(([entry])=>{
      clientWidth=entry.contentRect.width;clientHeight=entry.contentRect.height;
    });
    resize.observe(canvas);
    Promise.all([
      ...chase.map(({id})=>CombatAnimation.preload(id,'right',['motion','rest'])),
      CombatAnimation.preload('mob-golem','front',['motion','rest']),
    ]).then(()=>{staticReady=false});

    function fit(){
      const d=Math.min(1.75,devicePixelRatio||1);
      const w=Math.round(clientWidth*d),h=Math.round(clientHeight*d);
      if(!w||!h)return false;
      const tileWidth=clientHeight*.86*(image.naturalWidth/image.naturalHeight||3);
      if(width===w&&height===h&&tile===tileWidth)return true;
      width=canvas.width=w;height=canvas.height=h;scale=d;
      tile=tileWidth;
      world.style.width=Math.ceil(tile*2+clientWidth)+'px';
      world.style.backgroundSize=tile+'px 100%';
      staticReady=false;lastFrame=-1;
      return true;
    }

    function road(distance,ground){
      g.save();
      const wash=g.createLinearGradient(0,ground-height*.11,0,ground+height*.10);
      wash.addColorStop(0,'#13072700');
      wash.addColorStop(.5,'#260c4c60');
      wash.addColorStop(1,'#11052000');
      g.fillStyle=wash;g.fillRect(0,ground-height*.11,width,height*.21);
      g.lineCap='round';
      g.globalCompositeOperation='screen';
      for(let i=0;i<12;i++){
        const lane=i%3;
        const x=(frac(i*.382-distance*(1.6+lane*.35))*1.2-.1)*width;
        const y=ground-height*.02+lane*height*.014;
        g.globalAlpha=.16+lane*.06;
        g.strokeStyle=i%3?'#f284e6':'#65d9ff';
        g.lineWidth=(.55+lane*.42)*scale;
        g.beginPath();g.moveTo(x,y);g.lineTo(x+width*(.025+lane*.025),y);g.stroke();
      }
      g.restore();
    }

    function portal(x,y,h,q){
      if(q<=.02)return;
      g.save();g.translate(x,y-h*.60);
      g.globalCompositeOperation='screen';
      g.globalAlpha=q;
      g.strokeStyle='#ff7ee5';g.lineWidth=2.8*scale;
      const ring=g.createRadialGradient(0,0,h*.12,0,0,h*.6);
      ring.addColorStop(0,'#8466ff3b');ring.addColorStop(.66,'#c44fffbb');ring.addColorStop(1,'#6d27ff00');
      g.scale(.50,1);
      g.fillStyle=ring;g.fillRect(-h*.62,-h*.62,h*1.24,h*1.24);
      g.beginPath();g.ellipse(0,0,h*.44,h*.52,-.10,0,Math.PI*2);g.stroke();
      g.strokeStyle='#8df0ff';g.lineWidth=1.2*scale;
      g.beginPath();g.ellipse(0,0,h*.36,h*.47,.13,0,Math.PI*2);g.stroke();
      g.restore();
    }

    function figure(id,view,action,x,y,h,t,alpha,color){
      g.save();g.translate(x,y);
      g.globalAlpha=alpha*.50;g.fillStyle='#090419';
      g.beginPath();g.ellipse(0,1.5*scale,h*.32,h*.065,0,0,Math.PI*2);g.fill();
      g.globalAlpha=alpha*.16;g.fillStyle=color;
      g.beginPath();g.ellipse(0,0,h*.29,h*.032,0,0,Math.PI*2);g.fill();
      g.globalAlpha=alpha;
      CombatAnimation.draw(g,id,view,action,t,0,h);
      g.restore();
    }

    function sparks(t,ground,bossX){
      g.save();g.globalCompositeOperation='screen';g.lineCap='round';
      for(let i=0;i<motes.length;i++){
        const p=motes[i];
        const age=frac(p.x+t*p.speed/1000);
        const x=bossX-age*width*(.52+p.y*.30);
        const y=ground+(p.y-.5)*height*.22-age*height*.09;
        const r=(1.2+(i%5)*.75)*scale;
        g.globalAlpha=Math.sin(age*Math.PI)*(.28+p.y*.45);
        g.strokeStyle=i%4===0?'#ff9d7f':i%2?'#bc7bff':'#8ef1ff';
        g.lineWidth=(.85+(i%3)*.43)*scale;
        g.beginPath();g.moveTo(x-r*2.1,y+r*.31);
        g.lineTo(x+r*.60,y-r*.21);g.stroke();
      }
      g.restore();
    }

    function frame(now){
      if(!canvas.isConnected)return;
      raf=requestAnimationFrame(frame);
      const reduced=motion.matches;
      if(!fit()||(reduced&&staticReady&&image.complete))return;
      const t=reduced?1150:Math.max(0,now-startTime);
      const shot=camera(t);
      if(lastFrame===shot.frame&&!reduced)return;
      lastFrame=shot.frame;
      const {q,distance,escape,veil}=shot;
      const travel=width*(.31+distance*2.35);
      world.style.transform=`translate3d(${-(travel/scale%tile)}px,0,0)`;
      transition.style.opacity=reduced?0:veil;
      const ground=height*.741;
      const h=Math.min(width*.183,height*.098);
      const advance=ease(q/.33);
      const bossHeight=h*1.52;
      const rightEdge=width-bossHeight*.59;
      const bossX=Math.min(rightEdge,width*(.705+advance*.049+escape*.18)+Math.sin(t/705)*width*.011);
      const bossY=ground-height*.008;
      const approach=ease(q/.13);
      const fade=reduced?1:approach*(1-ease((q-.88)/.12));
      g.imageSmoothingEnabled=true;
      g.imageSmoothingQuality='medium';
      g.clearRect(0,0,width,height);
      road(reduced?0:distance,ground);
      portal(rightEdge,bossY,h*1.78,ease((q-.65)/.16)*(1-ease((q-.92)/.08)));
      sparks(t,ground,bossX);
      figure('mob-golem','front',reduced?'idle':'run',bossX,bossY,bossHeight*(1-escape*.23),t*.81,fade*(1-escape*.72),'#ff687a');
      for(const actor of chase){
        const body=h;
        const desired=width*(actor.x+advance*.095+escape*.25-(1-approach)*.060);
        const x=Math.min(width-body*.62,Math.max(body*.62,desired));
        const y=ground+height*actor.y;
        const steps=CombatAnimation.strideTime(travel+width*(advance*.095+escape*.25),body,'run')+actor.phase;
        figure(actor.id,'right',reduced?'idle':'run',x,y,body,steps,fade,actor.color);
      }
      if(reduced)staticReady=true;
    }
    raf=requestAnimationFrame(frame);
    return ()=>{cancelAnimationFrame(raf);resize.disconnect();CombatAnimation.release();};
  }

  return {start};
})();
