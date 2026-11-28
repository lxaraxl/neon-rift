const TitleChase = (() => {
  const duration=7400;
  const chase=[
    {id:'astra',x:.11,y:.010,size:.82,phase:115,color:'#ffd687'},
    {id:'pixel',x:.24,y:.047,size:.76,phase:245,color:'#68f2ff'},
    {id:'volta',x:.35,y:-.027,size:.78,phase:310,color:'#3ad1ff'},
    {id:'silas',x:.48,y:.024,size:.92,phase:20,color:'#a0eaff'},
  ];
  const motes=Array.from({length:18},(_,i)=>({
    x:(.618*i)%1,y:(.439*i)%1,speed:.07+(i%5)*.024,phase:i*.73,
  }));
  const clamp=q=>Math.max(0,Math.min(1,q));
  const ease=q=>{q=clamp(q);return q*q*(3-2*q);};
  const frac=q=>q-Math.floor(q);

  function start(canvas){
    const g=canvas.getContext('2d');
    const image=new Image();
    image.fetchPriority='high';
    image.src='art/bg_title.webp';
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const startTime=performance.now();
    let width=0,height=0,scale=1,raf;
    let staticReady=false;
    Promise.all([
      ...chase.map(({id})=>CombatAnimation.preload(id,'right',['motion','rest'])),
      CombatAnimation.preload('mob-golem','front',['motion','rest']),
    ]).then(()=>{staticReady=false});

    function fit(){
      const w=canvas.clientWidth,h=canvas.clientHeight;
      const d=Math.min(1.75,devicePixelRatio||1);
      if(!w||!h)return false;
      if(width===Math.round(w*d)&&height===Math.round(h*d))return true;
      width=canvas.width=Math.round(w*d);height=canvas.height=Math.round(h*d);scale=d;
      staticReady=false;
      return true;
    }

    function road(t,ground){
      g.save();
      const wash=g.createLinearGradient(0,ground-height*.11,0,ground+height*.10);
      wash.addColorStop(0,'#13072700');
      wash.addColorStop(.5,'#260c4c60');
      wash.addColorStop(1,'#11052000');
      g.fillStyle=wash;g.fillRect(0,ground-height*.11,width,height*.21);
      g.lineCap='round';
      g.globalCompositeOperation='screen';
      for(let i=0;i<16;i++){
        const lane=i%4, speed=.18+lane*.025;
        const x=(frac(i*.382-t*speed/1000)*1.2-.1)*width;
        const y=ground-height*.042+lane*height*.027+Math.sin(i*4.67)*height*.004;
        g.globalAlpha=.18+lane*.042;
        g.strokeStyle=i%3?'#da79ff':'#65d9ff';
        g.lineWidth=(.55+lane*.35)*scale;
        g.beginPath();g.moveTo(x,y);g.lineTo(x+width*(.022+lane*.022),y);g.stroke();
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
      const t=reduced?1150:now-startTime;
      const q=frac(t/duration);
      const ground=BattleLayout.titleGround(width,height,image);
      const h=Math.min(width*.224,height*.126);
      const escape=ease((q-.74)/.23);
      const advance=ease(q/.33);
      const bossHeight=h*1.68;
      const rightEdge=width-bossHeight*.59;
      const bossX=Math.min(rightEdge,width*(.705+advance*.049+escape*.18)+Math.sin(t/705)*width*.011);
      const bossY=ground-height*.008;
      const approach=ease(q/.13);
      const fade=reduced?1:approach*(1-ease((q-.88)/.12));
      g.imageSmoothingEnabled=true;
      g.imageSmoothingQuality='medium';
      g.clearRect(0,0,width,height);
      road(t,ground);
      portal(rightEdge,bossY,h*1.78,ease((q-.65)/.16)*(1-ease((q-.92)/.08)));
      sparks(t,ground,bossX);
      figure('mob-golem','front',reduced?'idle':'run',bossX,bossY,bossHeight*(1-escape*.23),t*.81,fade*(1-escape*.72),'#ff687a');
      for(const actor of chase){
        const stride=Math.sin(t/695+actor.phase)*width*.012;
        const body=h*actor.size;
        const desired=width*(actor.x+advance*.11+escape*.25-(1-approach)*.065)+stride;
        const x=Math.min(width-body*.62,Math.max(body*.62,desired));
        const y=ground+height*actor.y*.65;
        figure(actor.id,'right',reduced?'idle':'run',x,y,body,t+actor.phase,fade,actor.color);
      }
      if(reduced)staticReady=true;
    }
    raf=requestAnimationFrame(frame);
    return ()=>{cancelAnimationFrame(raf);CombatAnimation.release();};
  }

  return {start};
})();
