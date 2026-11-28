const CampPatrol = (() => {
  const cycle=5600;
  const enemies=['golem','slime','bot','ghost','bat'];
  // Coordinates are on the painted road, from each gate to the courtyard.
  const routes=[
    [[.89,.346],[.78,.374],[.701,.411],[.664,.460],[.677,.521],[.594,.557]],
    [[.101,.654],[.176,.609],[.227,.565],[.245,.524],[.344,.532],[.433,.567]],
  ];
  const posts=[[.483,.614],[.680,.608],[.593,.676],[.389,.467],[.495,.480]];
  const clamp=q=>Math.max(0,Math.min(1,q));
  const ease=q=>{q=clamp(q);return q*q*(3-2*q);};
  const mix=(a,b,p)=>a+(b-a)*p;
  const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
  const facing=(actor,a,b)=>CombatAnimation.facing(actor.id,b.x-a.x,b.y-a.y,actor.facing);

  function path(points){
    const lengths=[0];
    for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+distance(points[i-1],points[i]));
    const total=lengths.at(-1);
    function at(q){
      const travelled=clamp(q)*total;
      let i=1;
      while(i<lengths.length-1&&travelled>lengths[i])i++;
      const p=(travelled-lengths[i-1])/(lengths[i]-lengths[i-1]||1);
      const a=points[i-1],b=points[i];
      return {x:mix(a.x,b.x,p),y:mix(a.y,b.y,p),dx:b.x-a.x,dy:b.y-a.y};
    }
    return {at,total};
  }

  function create(canvas,team,stage){
    const g=canvas.getContext('2d');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let start=null,w=0,h=0,scene,drawn=[],lastWave=-1;
    const lead=team.findIndex(hero=>['war','tank'].includes(hero.cls));
    const front=lead<0?0:lead;
    const actors=team.map((hero,i)=>({hero,id:hero.id,slot:posts[(i-front+team.length)%team.length]}));
    const shooter=actors.findIndex((a,i)=>i!==front&&!['war','tank'].includes(a.hero.cls));
    const monster=wave=>enemies[(Math.max(0,stage-1)+wave)%enemies.length];
    function fit(){
      const dpr=Math.min(1.65,devicePixelRatio||1);
      const width=Math.round(canvas.clientWidth*dpr),height=Math.round(canvas.clientHeight*dpr);
      if(w===width&&h===height)return;
      w=canvas.width=width;h=canvas.height=height;
      const sw=Math.max(w,h*2/3),sh=sw*1.5;
      const place=([x,y])=>({x:(w-sw)*.5+x*sw,y:(h-sh)*.5+y*sh});
      scene={size:Math.min(w*.169,h*.108),fire:place([.258,.35]),
        homes:actors.map(a=>place(a.slot)),paths:routes.map(road=>path(road.map(place)))};
    }
    function silhouette(o){
      const {x,y,h,id,action,progress,elapsed,alpha,angle}=o;
      g.save();g.translate(x,y);
      g.globalAlpha=alpha*.40;
      g.fillStyle='#281622';
      g.beginPath();g.ellipse(0,1,h*.27,h*.060,0,0,Math.PI*2);g.fill();
      g.globalAlpha=alpha;
      g.save();
      if(o.facing.flip)g.scale(-1,1);
      CombatAnimation.draw(g,id,o.facing.view,action,elapsed,progress,h,o.tint);
      g.restore();
      if(!reduced.matches&&o.hero)CombatAnimation.effect(g,action,elapsed,progress,h,o.hero.color,angle,o.hero.cls);
      g.restore();
    }

    function projectile(from,to,p,color){
      const x=mix(from.x,to.x,p),y=mix(from.y-from.h*.53,to.y-to.h*.40,p)-Math.sin(p*Math.PI)*from.h*.20;
      const r=from.h*.13;
      g.save();g.globalCompositeOperation='screen';
      g.drawImage(PERF.glow(color),x-r*1.8,y-r*1.8,r*3.6,r*3.6);
      g.fillStyle='#fff3da';g.beginPath();g.arc(x,y,r*.42,0,Math.PI*2);g.fill();g.restore();
    }
    function impact(enemy,p,color){
      const y=enemy.y-enemy.h*.47, r=enemy.h*(.26+.69*p);
      g.save();g.globalAlpha=1-p;g.globalCompositeOperation='screen';
      g.drawImage(PERF.glow(color),enemy.x-r,y-r,r*2,r*2);
      g.lineWidth=Math.max(1,enemy.h*.022);g.strokeStyle=color;
      g.beginPath();g.ellipse(enemy.x,y,r*.87,r*.48,0,0,Math.PI*2);g.stroke();g.restore();
    }

    function draw(now){
      fit();
      if(!scene||!w||!h)return;
      if(start===null)start=now;
      const still=reduced.matches;
      const time=still?1300:now-start+720;
      const wave=Math.floor(time/cycle), t=time%cycle;
      const {size,homes,paths,fire}=scene;
      const road=paths[wave%2], walking=t<1850, travelled=clamp(t/1850);
      const entry=road.at(travelled), meeting=road.at(1), id='mob-'+monster(wave);
      const leadHome=homes[front];
      const target=leadHome?{x:mix(meeting.x,leadHome.x,.39),y:mix(meeting.y,leadHome.y,.39)}:meeting;
      const hitAt=3190,fallAt=3920;
      const enemy={...entry,id,facing:{view:'front',flip:entry.dx<0},h:size,
        alpha:ease(t/400)*(1-ease((t-fallAt)/760)),angle:0,progress:0,elapsed:time,tint:wave%2?'#e77969':undefined,
        action:walking?'walk':'idle'};
      if(t>=2220&&t<2730){enemy.action='attack';enemy.progress=(t-2220)/510}
      if(t>=2980&&t<3380){enemy.action='hit';enemy.progress=(t-2980)/400}
      if(t>=fallAt){enemy.action='die';enemy.progress=clamp((t-fallAt)/760)}
      if(walking)enemy.elapsed=travelled*road.total/size*1880;

      if(wave!==lastWave&&!still){
        lastWave=wave;
        CombatAnimation.preload(id,'front');
        if(leadHome){
          const leadActor=actors[front];
          const direction=facing(leadActor,leadHome,meeting);
          CombatAnimation.preload(leadActor.id,direction.view,['rest','motion','clash']);
          CombatAnimation.preload(leadActor.id,facing(leadActor,meeting,leadHome).view,['motion']);
        }
      }
      const advance=ease((t-1240)/960),returning=t>=4350;
      const p=returning?1-ease((t-4350)/1130):advance;
      const activeMelee=lead>=0;
      const figures=actors.map((a,i)=>{
        const anchor=homes[i], isLead=i===front, moving=isLead&&activeMelee&&!still;
        const x=moving?mix(anchor.x,target.x,p):anchor.x;
        const y=moving?mix(anchor.y,target.y,p):anchor.y;
        const actor={...a,x,y,h:size,alpha:1,action:'idle',progress:0,elapsed:time+i*347,
          angle:Math.atan2(enemy.y-y,enemy.x-x)};
        let heading=facing(a,anchor,meeting);
        if(moving&&(t>=1240&&t<2200||returning&&p>.005)){
          actor.action=returning?'walk':'run';
          heading=returning?facing(a,target,anchor):facing(a,anchor,target);
          actor.elapsed=CombatAnimation.strideTime(distance(anchor,target)*(returning?1-p:p),size,actor.action);
        }else if(!still&&isLead&&activeMelee&&t>=2220&&t<2710){
          actor.action='block';actor.progress=(t-2220)/490;
        }else if(!still&&(i===shooter||isLead)&&(t>=2740&&t<3440)){
          actor.action='attack';actor.progress=(t-2740)/700;
        }
        a.facing=actor.facing=heading;
        return actor;
      });
      drawn=figures;
      g.clearRect(0,0,w,h);
      g.save();
      g.globalAlpha=still?.17:.18+.045*Math.sin(time*.014);
      g.globalCompositeOperation='screen';
      g.drawImage(PERF.glow('#ff8939'),fire.x-size*.60,fire.y-size*.92,size*1.2,size*1.35);
      g.restore();
      const present=figures.length&&!still&&enemy.alpha>.01?[...figures,enemy]:figures;
      present.sort((a,b)=>a.y-b.y).forEach(silhouette);
      if(still||!figures.length)return;
      const ranged=figures[shooter]||(!activeMelee?figures[front]:null);
      if(ranged&&t>=2890&&t<hitAt)projectile(ranged,enemy,(t-2890)/(hitAt-2890),ranged.hero.color);
      if(t>=hitAt&&t<hitAt+350)impact(enemy,(t-hitAt)/350,ranged?.hero.color||figures[front].hero.color);
    }
    function heroAt(event){
      const rect=canvas.getBoundingClientRect();
      const x=(event.clientX-rect.left)*canvas.width/rect.width;
      const y=(event.clientY-rect.top)*canvas.height/rect.height;
      return drawn.slice().sort((a,b)=>b.y-a.y).find(o=>Math.abs(x-o.x)<o.h*.43&&y<o.y&&y>o.y-o.h)?.id;
    }
    return {draw,heroAt};
  }
  return {create};
})();
