const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const assert=require('node:assert/strict');

function load(file,global,context={}){
  const source=readFileSync(join(__dirname,'..',file),'utf8');
  return vm.runInNewContext(source+'\n'+global,context);
}

test('the core platform holds both formations and their lunge points',()=>{
  const layout=load('battle-layout.js','BattleLayout');
  for(const [width,height] of [[320,580],[430,910],[740,430]]){
    const floor=layout.floor('ch_core',width,height,{width:720,height:1280});
    for(const side of ['a','e'])for(const home of floor.formation(side,2,3,22)){
      for(const target of [[home.x,home.y],[-90,-10],[width+80,height+140]]){
        const position=floor.project(...target,22);
        assert(position.x>0&&position.x<width);
        assert(position.y>=floor.top&&position.y<=floor.bottom);
      }
    }
    const cover=Math.max(width/720,height/1280);
    const mapEdge=height/2+1280*cover*(.72-.5);
    assert(floor.bottom<=height*.83&&floor.bottom<mapEdge);
  }
});

test('metro keeps the diagonal formation and gives the companion its own space',()=>{
  const layout=load('battle-layout.js','BattleLayout');
  for(const [width,height] of [[320,580],[430,850],[550,1064]]){
    const floor=layout.floor('ch_metro',width,height,{width:916,height:1717});
    const ally=floor.formation('a',2,3,width*.053);
    const enemy=floor.formation('e',2,3,width*.053);
    assert(ally[0].x<ally[1].x&&ally[0].y<ally[1].y);
    assert(ally[2].y<ally[3].y&&ally[3].y<ally[4].y);
    assert(Math.abs(ally[3].x/width-.36)<.055);
    assert(Math.abs(ally[3].y/height-.766)<.02);
    assert(Math.max(...enemy.map(p=>p.y))<Math.min(...ally.map(p=>p.y)));
    const occupied=[...ally,...enemy].map(p=>({...p,height:width*.23,halfWidth:width*.115}));
    const size=width*.104*1.25;
    const pet=floor.companion('a',size,occupied);
    if(width>=430)assert(pet.x<width*.32);
    assert(pet.y<=floor.bottom);
    for(const unit of occupied){
      const separateX=Math.abs(pet.x-unit.x)>size*.59+unit.halfWidth;
      const separateY=pet.y-size>unit.y||pet.y<unit.y-unit.height;
      assert(separateX||separateY);
    }
  }
});

test('the title chase uses the bottom bridge',()=>{
  const layout=load('battle-layout.js','BattleLayout');
  for(const [width,height] of [[320,640],[430,910],[540,750]]){
    const ground=layout.titleGround(width,height,{naturalWidth:720,naturalHeight:1280});
    assert(ground>=height*.79&&ground<=height*.83);
  }
});

test('Bastion faces a foe on either side of the rear angle',()=>{
  const animation=load('combat-animation.js','CombatAnimation');
  const left=animation.facing('bastion',-48,-100);
  const right=animation.facing('bastion',48,-100);
  assert.equal(left.view,'back');
  assert.equal(right.view,'back');
  assert.equal(left.flip,false);
  assert.equal(right.flip,true);
});

test('the requested angle stays visible while its action sheet loads',async()=>{
  const atlasRequests=[];
  class PendingImage{
    set src(source){
      this.path=source;
      if(source.endsWith('-turn.webp')){
        this.naturalWidth=576;
        queueMicrotask(()=>this.onload());
      }else{
        atlasRequests.push(this);
      }
    }
    get src(){return this.path}
  }
  const animation=load('combat-animation.js','CombatAnimation',{
    Image:PendingImage,performance,miniatureSource:()=>null,
  });
  const painted=[];
  const g={drawImage:(source,...args)=>painted.push({source:source.src,x:args[0]})};
  await animation.preload('bastion','back',[]);
  assert.equal(animation.draw(g,'bastion','back','attack',0,.4,100),true);
  assert.equal(animation.draw(g,'bastion','right','attack',0,.4,100),true);
  assert.equal(painted[0].x,192);
  assert.equal(painted[1].x,480);
  assert(painted.every(p=>p.source.endsWith('-turn.webp')));
  atlasRequests[1].onload();
  assert.equal(animation.draw(g,'bastion','right','attack',0,.5,100),true);
  assert.match(painted.at(-1).source,/bastion-right-clash\.webp/);
  atlasRequests[0].onload();
});
