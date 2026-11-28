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
    ch_market:docks,ch_metro:docks,ch_docks:docks,ch_roof:docks,ch_lab:docks,
  };
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const mix=(a,b,t)=>a+(b-a)*t;

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
    function formation(side,row,index,count,radius){
      const depth=side==='a'?(row==='f'?.68:.94):(row==='f'?.39:.12);
      const across=count===1?0:index/(count-1)-.5;
      const y=clamp(mix(top,bottom,depth+across*.067),top,bottom);
      const [left,right]=span(y,radius);
      const lane=count===1?(side==='a'?.46:.54):.1+.8*index/(count-1);
      return {x:mix(left,right,lane),y};
    }
    return {top,bottom,project,formation};
  }

  function titleGround(w,h,image,zoom=1.13){
    if(!image?.naturalHeight)return h*.81;
    const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight)*zoom;
    // The near side of the bridge starts just below the buttresses in bg_title.
    return clamp((h-image.naturalHeight*scale)/2+image.naturalHeight*scale*.837,h*.79,h*.83);
  }

  return {floor,titleGround};
})();
