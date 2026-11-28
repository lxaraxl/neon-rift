const HeroShowcase = (() => {
  const width=112,height=119,frames=24,columns=6,body=87.5,foot=102.08;
  const periods={
    astra:4600,bastion:3900,cipher:3500,glitch:4800,grom:3750,kairos:5200,lyra:4100,
    mila:3150,murr:4250,nyx:4700,phoenix:5100,pixel:3350,pyro:4400,rain:4750,raven:5250,
    scrap:3850,silas:4000,sol:4900,tesla:3600,volta:3450,zhar:3250,
  };
  const phases=Object.fromEntries(Object.keys(periods).map((id,i)=>[id,(i*.61803398875)%1]));
  const images=new Map(),views=new WeakMap();

  function load(id){
    if(!images.has(id)){
      const image=new Image();
      image.decoding='async';
      image.fetchPriority='low';
      image.src=`art/showcase/${id}.webp`;
      images.set(id,image);
    }
    return images.get(id);
  }

  function frame(id,time){
    const cycle=time/periods[id]+phases[id];
    return Math.floor((cycle-Math.floor(cycle))*frames);
  }

  function paint(g,image,i,x,y,w,h){
    g.drawImage(image,(i%columns)*width,Math.floor(i/columns)*height,width,height,x,y,w,h);
  }

  function draw(g,id,t,x,y,size){
    const image=load(id),scale=size/body;
    if(!image.complete||!image.naturalWidth)return false;
    paint(g,image,frame(id,t),x-width*scale/2,y-foot*scale,width*scale,height*scale);
    return true;
  }

  function watch(container,covered){
    views.get(container)?.();
    const cards=[...container.querySelectorAll('.ranked-card[data-id]')];
    const visible=new Map();
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    let raf=0,lastTick=-Infinity;
    const observer=new IntersectionObserver(entries=>{
      for(const {isIntersecting,target} of entries){
        if(isIntersecting&&!visible.has(target)){
          const canvas=target.querySelector('.showcase');
          const id=target.dataset.id;
          visible.set(target,{id,canvas,g:canvas.getContext('2d'),previous:-1});
        }else if(!isIntersecting)visible.delete(target);
      }
    },{root:container,threshold:.04});

    function loop(t){
      if(!container.isConnected){stop();return}
      raf=requestAnimationFrame(loop);
      if(t-lastTick<1000/24||covered()||document.hidden)return;
      lastTick=t;
      for(const [card,state] of visible){
        if(motion.matches){
          state.canvas.hidden=true;
          card.classList.remove('showcase-active');
          state.previous=-1;
          continue;
        }
        const image=load(state.id),i=frame(state.id,t);
        if(i===state.previous||!image.complete||!image.naturalWidth)continue;
        state.previous=i;
        state.g.clearRect(0,0,width,height);
        paint(state.g,image,i,0,0,width,height);
        state.canvas.hidden=false;
        card.classList.add('showcase-active');
      }
    }
    function stop(){
      cancelAnimationFrame(raf);
      observer.disconnect();
      views.delete(container);
    }
    cards.forEach(card=>observer.observe(card));
    views.set(container,stop);
    if(cards.length)raf=requestAnimationFrame(loop);
  }

  return {draw,watch};
})();
