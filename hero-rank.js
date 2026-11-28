const HeroRank = (() => {
  const starter=4,summoned=5,max=15;
  const costs=[10,20,40,60,90,100,115,130,145,160,180];
  const cost=rank=>costs[rank-starter]??null;
  const steps=rank=>Math.max(0,rank-starter);

  function upgrade(hero,universal=0){
    const need=cost(hero.star);
    if(need===null)return null;
    const personal=Math.min(need,hero.shards||0);
    const wildcard=need-personal;
    return {need,personal,wildcard,ready:wildcard<=universal};
  }

  function badge(rank){
    const digits=rank>10;
    const tone=digits?'neon':rank>5?'red':'gold';
    const face=digits?'<em aria-hidden="true"></em><strong aria-hidden="true">'+rank+'</strong>':
      '<span aria-hidden="true">'+'★'.repeat(rank>5?rank-5:rank)+'</span>';
    return `<span class="hero-rank ${tone}" data-rank="${rank}" role="img" aria-label="${rank} ${rank===4?'звезды':'звёзд'}">${face}</span>`;
  }

  return {starter,summoned,max,cost,steps,upgrade,badge};
})();
