const ProfileMotion = (() => {
  const TAU = Math.PI*2;
  const fps=60, cycleFrames=168;
  const frames = Array.from({length:cycleFrames},(_,i)=>{
    const q=i/cycleFrames, phase=q*TAU;
    return {breath:Math.sin(phase), drift:Math.sin(phase-.6), pulse:(1+Math.cos(phase))/2, q};
  });
  const particles = Array.from({length:22},(_,i)=>({
    phase:(i*.61803398875)%1,
    radius:.35+(i%6)*.045,
    span:.36+(i%5)*.11,
    size:.007+(i%4)*.0027,
    seed:i*2.399963,
  }));

  function frameIndex(time){return Math.floor(time*fps/1000)%frames.length;}

  function body(g,im,x,y,w,h,frame){
    const count=20, sh=im.height/count;
    // The feet sit on the same line through the entire cycle. Most displacement is at the ribs.
    const shift=v=>{
      const anchor=Math.max(0,1-v/.79);
      const chest=Math.exp(-((v-.43)**2)/.035)*Math.min(1,anchor*3);
      return {
        x:w*(frame.drift*.009*anchor + frame.breath*.004*chest),
        y:h*(-frame.breath*.009*chest),
        width:1+frame.breath*.012*chest,
      };
    };
    for(let i=0;i<count;i++){
      const top=shift(i/count),bottom=shift((i+1)/count);
      const slice=h/count+bottom.y-top.y;
      const sw=w*(top.width+bottom.width)/2;
      const overlap=i<count-1 ? Math.min(1.25,sh*.06) : 0;
      g.save();
      g.translate(x+(w-sw)/2+top.x,y+i*h/count+top.y);
      g.transform(1,0,(bottom.x-top.x)/slice,1,0,0);
      g.drawImage(im,0,i*sh,im.width,sh+overlap,0,0,sw,slice*(1+overlap/sh));
      g.restore();
    }
  }

  function aura(g,x,y,w,h,frame,color){
    const cx=x+w*.5,cy=y+h*.53;
    const r=Math.max(1,w*.51);
    const glow=g.createRadialGradient(cx,cy,r*.12,cx,cy,r);
    glow.addColorStop(0,color+'24');
    glow.addColorStop(.58,color+'34');
    glow.addColorStop(1,color+'00');
    g.save();
    g.globalCompositeOperation='screen';
    g.globalAlpha=.56+frame.pulse*.44;
    g.fillStyle=glow;g.fillRect(x,y,w,h);
    g.restore();
  }

  const glows=new Map();
  function particleGlow(color){
    if(glows.has(color))return glows.get(color);
    const tile=document.createElement('canvas');
    tile.width=tile.height=64;
    const g=tile.getContext('2d');
    const gradient=g.createRadialGradient(32,32,0,32,32,32);
    gradient.addColorStop(0,color+'ac');
    gradient.addColorStop(1,color+'00');
    g.fillStyle=gradient;g.fillRect(0,0,64,64);
    glows.set(color,tile);
    return tile;
  }
  function effects(g,x,y,w,h,frame,element,color,seed){
    g.save();
    g.globalCompositeOperation='screen';
    g.lineCap='round';
    for(let i=0;i<particles.length;i++){
      const star=particles[i];
      const age=(frame.q+star.phase)%1;
      const angle=star.seed+seed+age*star.span;
      const px=x+w*(.5+Math.cos(angle)*star.radius);
      const py=y+h*(.95-age*.80+Math.sin(angle*1.7)*.055);
      const size=Math.max(.6,w*star.size*(.62+(1-age)*.38));
      const alpha=Math.sin(age*Math.PI)**2;
      // Keep the face clear. Most glints frame the silhouette instead of crossing it.
      if(Math.abs(px-(x+w*.5))<w*.23&&py<y+h*.47)continue;

      g.globalAlpha=alpha*.78;
      g.drawImage(particleGlow(color),px-size*3.6,py-size*3.6,size*7.2,size*7.2);
      g.strokeStyle=color;g.fillStyle='#f3faff';g.lineWidth=Math.max(.7,size*.37);
      g.globalAlpha=alpha*.83;
      if(element==='storm'&&i%3===0){
        const length=size*(4+2*frame.pulse);
        g.beginPath();g.moveTo(px-length,py+length*.5);
        g.lineTo(px-length*.27,py+length*.16);
        g.lineTo(px-length*.45,py-length*.09);
        g.lineTo(px+length*.20,py-length*.21);
        g.lineTo(px+length*.47,py-length*.57);
        g.stroke();
        g.globalAlpha*=.58;g.strokeStyle='#f3faff';g.lineWidth*=.55;g.stroke();
      }else if(element==='void'&&i%3===0){
        g.beginPath();g.arc(px,py,size*1.8,angle,angle+Math.PI*1.42);g.stroke();
      }else if(element==='fire'){
        g.beginPath();g.ellipse(px,py,size*.55,size*1.45,Math.sin(angle)*.5,0,TAU);g.fill();
      }else{
        g.beginPath();
        g.moveTo(px-size*1.6,py);g.lineTo(px,py-size*.55);
        g.lineTo(px+size*1.6,py);g.lineTo(px,py+size*.55);g.closePath();
        g.fill();
      }
    }
    g.restore();
  }

  function draw(g,im,x,y,w,h,index,element,color,seed,animated){
    const frame=frames[animated?index:0];
    aura(g,x,y,w,h,frame,color);
    g.fillStyle='rgba(14,7,30,.28)';
    g.beginPath();g.ellipse(x+w*.5,y+h*.995,w*.30,h*.019,0,0,TAU);g.fill();
    if(animated){
      body(g,im,x,y,w,h,frame);
      effects(g,x,y,w,h,frame,element,color,seed);
    }else{
      g.drawImage(im,x,y,w,h);
    }
  }

  return {fps, frameCount:frames.length, frameIndex, draw};
})();
