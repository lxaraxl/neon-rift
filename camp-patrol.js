const CampPatrol = (() => {
  const cycle=5900;
  const enemies=['golem','slime','bot','ghost','bat'];
  const colors=['#df6c77','#59bde2','#be75ee','#eab05a'];
  const slots=[[.65,.61],[.76,.52],[.77,.70],[.25,.54],[.53,.47]];
  const clamp=q=>Math.max(0,Math.min(1,q));
  const ease=q=>{q=clamp(q);return q*q*(3-2*q);};
  const mix=(a,b,p)=>a+(b-a)*p;

  function create(canvas,team,stage,rewardPanel){
    const g=canvas.getContext('2d',{alpha:false});
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let start=null,base,painted=null, fireX,fireY, drawn=[];
    const leader=team.findIndex(hero=>hero.cls==='war'||hero.cls==='tank');
    const support=team.findIndex((hero,i)=>i!==leader&&!['war','tank'].includes(hero.cls));
    const attacker=leader<0?0:leader;
    const actors=team.map((hero,i)=>({hero,slot:slots[(i-attacker+team.length)%team.length]}));
    const monster=wave=>enemies[((stage-1+wave)%enemies.length+enemies.length)%enemies.length];

    LOC.loadBgs(['camp']);
    for(const {hero} of actors)CombatAnimation.preload(hero.id,'left');
    if(actors.length){
      CombatAnimation.preload('mob-'+monster(0),'front');
      CombatAnimation.preload(actors[attacker].hero.id,'left',['motion','clash']);
    }

    function fit(){
      const rect=canvas.getBoundingClientRect(), ratio=Math.min(2,devicePixelRatio||1);
      const w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));
      const art=LOC.BGIMG.camp||null;
      if(base&&w===canvas.width&&h===canvas.height&&art===painted)return false;
      canvas.width=w;canvas.height=h;painted=art;
      base=LOC.fromImage('camp',w,h,{n1:'#ff9a3a',n2:'#ffd84a'},'forest')||LOC.forest(w,h,Math.round(h*.30));
      const cover=art?Math.max(w/art.width,h/art.height):0;
      fireX=w*.5;
      fireY=art?h*.5+art.height*cover*(.387-.5):h*.43;
      return true;
    }

    function silhouette(o){
      g.save();
      g.translate(o.x,o.y);
      g.globalAlpha=o.alpha*.31;
      g.fillStyle='#281521';
      g.beginPath();g.ellipse(0,0,o.h*.29,o.h*.062,0,0,Math.PI*2);g.fill();
      g.globalAlpha=o.alpha;
      CombatAnimation.draw(g,o.id,o.view,o.action,o.elapsed,o.progress,o.h);
      g.restore();
    }

    function trail(from,target,p,color){
      const x=mix(from.x,target.x,p),y=mix(from.y-from.h*.55,target.y-target.h*.42,p)-Math.sin(p*Math.PI)*from.h*.15;
      const size=from.h*.085;
      g.save();
      g.globalCompositeOperation='screen';
      g.lineCap='round';
      g.strokeStyle=color;
      g.globalAlpha=.82;
      g.lineWidth=size*.60;
      g.beginPath();g.moveTo(x,y);g.lineTo(x-Math.sign(target.x-from.x)*size*3.2,y+size*.14);g.stroke();
      g.fillStyle='#fff5dc';
      g.beginPath();g.arc(x,y,size*.49,0,Math.PI*2);g.fill();
      g.restore();
    }

    function impact(enemy,p,color){
      g.save();
      g.translate(enemy.x,enemy.y-enemy.h*.40);
      g.globalCompositeOperation='screen';
      g.lineCap='round';g.strokeStyle=color;
      g.globalAlpha=(1-p)*.86;
      g.lineWidth=Math.max(1,enemy.h*.037*(1-p));
      for(let i=0;i<8;i++){
        const a=i*Math.PI*.25;
        const d=enemy.h*(.12+.52*p), l=enemy.h*(.08+.16*(1-p));
        const x=Math.cos(a), y=Math.sin(a)*.75;
        g.beginPath();g.moveTo(x*d,y*d);g.lineTo(x*(d+l),y*(d+l));g.stroke();
      }
      g.restore();
    }

    function draw(now){
      fit();
      const still=reduced.matches;
      if(start===null)start=now;
      const time=still?3400:now-start+760;
      const wave=Math.floor(time/cycle), phase=time%cycle;
      const w=canvas.width,h=canvas.height;
      const rect=canvas.getBoundingClientRect(),box=rewardPanel.getBoundingClientRect();
      const hud=box.height? (box.top-rect.top)*h/Math.max(1,rect.height):h*.78;
      const laneBottom=Math.max(h*.46,Math.min(h*.76,hud-h*.020));
      const laneTop=Math.max(h*.34,Math.min(laneBottom-h*.12,fireY+h*.055));
      const size=Math.min(w*.209,h*.116);
      const floor=value=>mix(laneTop,laneBottom,clamp((value-.45)/.27));
      g.drawImage(base,0,0);
      g.imageSmoothingQuality='medium';

      // A small warm light anchors the fire to the original illustrated camp.
      const heat=Math.sin(time/177)*.11+.89;
      g.globalCompositeOperation='screen';
      g.globalAlpha=.24*heat;
      g.drawImage(PERF.glow('#ff9447'),fireX-size*.87,fireY-size*1.14,size*1.74,size*1.74);
      g.globalCompositeOperation='source-over';g.globalAlpha=1;

      const advance=ease((phase-1280)/720),retreat=ease((phase-4120)/1000);
      const isMelee=actors[attacker]&&['war','tank'].includes(actors[attacker].hero.cls);
      const enemyId='mob-'+monster(wave);
      const enemy={id:enemyId,view:'front',x:w*mix(.12,.315,ease(phase/1600)),y:floor(.620),
        h:size*1.04,elapsed:phase,progress:0,alpha:ease(phase/450),action:phase<1600?'run':'idle'};
      if(phase>=2100&&phase<2670){enemy.action='attack';enemy.progress=(phase-2100)/570}
      if(phase>=2680&&phase<3040){enemy.action='hit';enemy.progress=(phase-2680)/360}
      if(phase>=3370){enemy.action='die';enemy.progress=clamp((phase-3370)/660);enemy.alpha=1-ease(enemy.progress)}
      const figures=actors.map(({hero,slot},i)=>{
        const active=i===attacker, ranged=i===support||active&&!isMelee;
        const pace=(phase+i*890)%cycle;
        const patrol=!active&&(pace<590||pace>4600&&pace<5310);
        const shift=active&&isMelee?(advance-retreat)*.184
          :(.5-.5*Math.cos(pace/cycle*Math.PI*2))*.043;
        const actor={id:hero.id,view:'left',x:w*(slot[0]-shift),y:floor(slot[1]),
          h:size*(slot[1]>.64?.96:.86),action:'idle',elapsed:time+i*319,progress:0,alpha:1,hero};
        actor.angle=Math.atan2(enemy.y-actor.y,enemy.x-actor.x);
        actor.view=enemy.x<actor.x?'left':'right';
        if(still)return actor;
        if(active&&isMelee&&(phase>=1280&&phase<2000||phase>=4120&&phase<5120)){
          actor.action='run';actor.view=phase<4120?'left':'right';
        }else if(active&&phase>=2130&&phase<2590&&isMelee){
          actor.action='block';actor.progress=(phase-2130)/460;
        }else if(active&&isMelee&&phase>=2430&&phase<2980||ranged&&phase>=2880&&phase<3480){
          actor.action='attack';actor.progress=active&&isMelee?(phase-2430)/550:(phase-2880)/600;
        }else if(active&&phase>=3700&&phase<4120){
          actor.action='victory';actor.elapsed=phase-3700;
        }else if(patrol){
          actor.action='walk';actor.view=pace<590?'left':'right';
        }
        return actor;
      });
      drawn=figures;
      if(actors.length&&!still&&enemy.alpha>.01)figures.concat(enemy).sort((a,b)=>a.y-b.y).forEach(silhouette);
      else figures.slice().sort((a,b)=>a.y-b.y).forEach(silhouette);

      if(still||!actors.length)return;
      for(const actor of figures){
        g.save();g.translate(actor.x,actor.y);
        CombatAnimation.effect(g,actor.action,actor.elapsed,actor.progress,actor.h,actor.hero.color,actor.angle,actor.hero.cls);
        g.restore();
      }
      const shooter=figures[support]||(!isMelee?figures[attacker]:null);
      if(shooter&&phase>=3050&&phase<3380)trail(shooter,enemy,(phase-3050)/330,shooter.hero.color);
      if(phase>=2680&&phase<2980&&isMelee)impact(enemy,(phase-2680)/300,figures[attacker].hero.color);
      if(phase>=3370&&phase<3690)impact(enemy,(phase-3370)/320,shooter?.hero.color||colors[wave%colors.length]);
    }

    function heroAt(event){
      const rect=canvas.getBoundingClientRect();
      const x=(event.clientX-rect.left)*canvas.width/rect.width;
      const y=(event.clientY-rect.top)*canvas.height/rect.height;
      return drawn.slice().sort((a,b)=>b.y-a.y).find(o=>Math.abs(x-o.x)<o.h*.37&&y<o.y&&y>o.y-o.h)?.id;
    }
    return {draw,heroAt};
  }

  return {create};
})();
