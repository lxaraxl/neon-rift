// Walkable floor in the coordinate system of the painted backgrounds.
const BattleLayout = (() => {
  const open=[[.34,.19,.81],[.47,.12,.88],[.71,.12,.88],[.83,.23,.77]];
  const docks=[[.33,.19,.81],[.43,.13,.87],[.70,.13,.87],[.82,.25,.75]];
  const platforms={
    ch_core:[[.31,.29,.71],[.42,.13,.87],[.54,.125,.875],[.65,.18,.82],[.72,.32,.68]],
    rift_battle:[[.35,.27,.73],[.48,.15,.85],[.64,.15,.85],[.74,.34,.66]],
    worldboss:[[.40,.23,.77],[.51,.12,.88],[.68,.12,.88],[.80,.28,.72]],
    guild_boss:[[.34,.26,.74],[.47,.12,.88],[.67,.135,.865],[.79,.30,.70]],
    forest:[[.36,.29,.71],[.46,.18,.82],[.62,.15,.85],[.76,.27,.73]],
    ch_metro:[[.33,.19,.81],[.43,.10,.87],[.69,.075,.91],[.82,.10,.90],[.89,.22,.78]],
    ch_market:docks,ch_docks:docks,ch_roof:docks,ch_lab:docks,
  };
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const legacyHorizon={forest:.34,town:.40,arena:.44,cave:.42,tower:.50};

  function floor(name,w,h,art){
    const rows=platforms[name]||open;
    const cover=art?Math.max(w/art.width,h/art.height):0;
    const aw=art?art.width*cover:w,ah=art?art.height*cover:h;
    const x0=(w-aw)/2,y0=(h-ah)/2;
    const bands=rows.map(([y,l,r])=>[y0+y*ah,x0+l*aw,x0+r*aw]);
    const top=clamp(bands[0][0]+h*.025,h*.25,h*.54);
    const bottom=clamp(bands.at(-1)[0]-h*.036,top+h*.07,h*.83);

    function span(y,radius){
      const b=bands.findIndex(row=>row[0]>=y);
      const low=bands[b<0?bands.length-1:Math.max(b-1,0)];
      const high=bands[b<0?bands.length-1:b];
      const p=high[0]>low[0]?clamp((y-low[0])/(high[0]-low[0]),0,1):0;
      const left=Math.max(w*.045,mix(low[1],high[1],p));
      const right=Math.min(w*.955,mix(low[2],high[2],p));
      const margin=clamp(radius,0,Math.max(0,(right-left)*.43));
      return [left+margin,right-margin];
    }
    function project(x,y,radius=0){
      y=clamp(y,top,bottom);
      const [left,right]=span(y,radius);
      return {x:clamp(x,left,right),y};
    }
    function formation(side,front,back,radius){
      const enemyY=Math.max(.39,(legacyHorizon[name]??.38)+.10)*h;
      const allyY=clamp(enemyY+.24*h,.64*h,.80*h);
      const ally=side==='a';
      const dx=.26*w,dy=enemyY-allyY,length=Math.hypot(dx,dy);
      const rowGap=Math.min(w*.19,h*.095),colGap=Math.min(w*.24,h*.125);
      const offsets=[];
      for(const [row,count] of [['f',front],['b',back]]){
        const along=(back?rowGap*.55:0)*(row==='f'?1:-1)*(ally?1:-1);
        for(let i=0;i<count;i++){
          const across=(i-(count-1)/2)*colGap*(count>3?.82:1);
          offsets.push({row,x:(dx*along-dy*across)/length,y:(dy*along+dx*across)/length});
        }
      }
      if(!offsets.length)return [];
      // Shift the whole formation before compressing it on a narrow platform.
      const split=clamp((allyY+enemyY)/2,mix(top,bottom,.43),mix(top,bottom,.57));
      const lo=ally?split+h*.013:top,hi=ally?bottom:split-h*.013;
      const minY=Math.min(...offsets.map(p=>p.y)),maxY=Math.max(...offsets.map(p=>p.y));
      const scaleY=Math.min(1,(hi-lo)/Math.max(1,maxY-minY));
      const centerY=clamp(ally?allyY:enemyY,lo-minY*scaleY,hi-maxY*scaleY);
      const slots=offsets.map(p=>{
        const y=centerY+p.y*scaleY;
        return {...p,y,span:span(y,radius)};
      });
      let scaleX=1;
      let left,right;
      do{
        left=Math.max(...slots.map(p=>p.span[0]-p.x*scaleX));
        right=Math.min(...slots.map(p=>p.span[1]-p.x*scaleX));
        if(left<=right||scaleX<=.60)break;
        scaleX-=.08;
      }while(true);
      const centerX=clamp((ally?.38:.64)*w,left,right);
      return slots.map(p=>({...project(centerX+p.x*scaleX,p.y,radius),row:p.row}));
    }

    function companion(side,size,occupied){
      const ally=side==='a',edge=ally?bottom:top;
      const mid=mix(top,bottom,.5);
      let best=null,bestScore=-Infinity;
      for(let row=0;row<=10;row++){
        const y=mix(edge,mid,row/10);
        const [left,right]=span(y,size*.4);
        for(let col=0;col<=12;col++){
          const x=mix(left,right,col/12),flank=ally?col/12:1-col/12;
          let clearance=2;
          for(const unit of occupied){
            const horizontal=Math.abs(x-unit.x)/(size*.59+unit.halfWidth);
            const behind=(y-unit.y)/(size*1.06);
            const ahead=(unit.y-y)/unit.height;
            clearance=Math.min(clearance,Math.max(horizontal,behind,ahead));
          }
          const score=(clearance>=1?2:0)+Math.min(1.18,clearance)-.38*flank-.15*row/10;
          if(score>bestScore){best={x,y};bestScore=score}
        }
      }
      return best;
    }
    return {top,bottom,project,formation,companion};
  }

  function titleGround(w,h,image,zoom=1.13){
    if(!image?.naturalHeight)return h*.81;
    const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight)*zoom;
    // The near side of the bridge starts just below the buttresses in bg_title.
    return clamp((h-image.naturalHeight*scale)/2+image.naturalHeight*scale*.837,h*.79,h*.83);
  }

  return {floor,titleGround};
})();
