const CombatAnimation = (() => {
  const frameCount = 24;
  const wave = q => Math.sin(Math.PI * 2 * q);
  const arc = q => Math.sin(Math.PI * q);
  const clamp = q => Math.max(0, Math.min(1, q));
  const ease = q => { q = clamp(q); return q*q*(3-2*q); };
  // Each pose is [x, y, rotation, width, height, upper-body bend, effect intensity].
  const actions = {
    idle: { period: 2200, pose: q => [0,0,wave(q)*.012,1-wave(q)*.008,1+wave(q)*.016,wave(q)*.025,0] },
    walk: { period: 780, pose: q => [wave(q)*.016,-(wave(q)**2)*.035,wave(q)*.038,1,1,wave(q)*.034,0] },
    run: { period: 600, pose: q => [wave(q)*.018,-(wave(q)**2)*.074,.075+wave(q)*.045,1,1.02,.055+wave(q)*.035,0] },
    fly: { period: 1200, pose: q => [wave(q)*.025,-.07-wave(q)*.055,wave(q)*.035,1,1,wave(q)*.065,0] },
    attack: { pose(q, style) {
      const wind = arc(clamp(q/.27));
      const strike = ease((q-.19)/.23)*(1-ease((q-.42)/.58));
      const drive = style==='war'||style==='tank' ? 1 : .55;
      return [drive*(.19*strike-.075*wind),-.055*strike,drive*(.19*strike-.14*wind),
        1+.075*strike,1-.075*wind+.035*strike,.13*strike-.08*wind,strike];
    } },
    ult: { pose(q, style) {
      const surge = arc(q), release = ease((q-.29)/.29)*(1-ease((q-.69)/.31));
      const weight = style==='tank' ? .65 : 1;
      return [.07*release,-surge*.17*weight,.12*release-.075*surge,
        1+.09*release,1+.1*surge,.16*release-.06*surge,release];
    } },
    block: { pose(q) {
      const brace = ease(q/.18)*(1-ease((q-.49)/.51));
      return [-.09*brace,.025*brace,-.14*brace,1+.09*brace,1-.12*brace,-.12*brace,brace];
    } },
    hit: { pose(q) {
      const recoil = ease(q/.16)*(1-ease((q-.16)/.84));
      return [-.15*recoil,-.034*recoil,-.26*recoil,1+.05*recoil,1-.08*recoil,-.1*recoil,0];
    } },
    stun: { period: 880, pose: q => [wave(q)*.032,0,wave(q)*.072,1,1-wave(q)*.023,wave(q)*.095,0] },
    victory: { period: 960, pose: q => [0,-Math.max(0,wave(q))*.15,wave(q)*.055,1-wave(q)*.025,1+wave(q)*.04,wave(q)*.07,0] },
    die: { pose: q => [-.11*ease(q),.09*q,-1.24*ease(q),1+.06*q,1-.11*q,-.12*q,0] },
  };
  const clips = Object.fromEntries(['war','tank','arch','mage','sup'].map(style=>[
    style, Object.fromEntries(Object.entries(actions).map(([name,{period,pose}])=>[
      name, Array.from({length:frameCount},(_,i)=>pose(i/(period?frameCount:frameCount-1),style))
    ]))
  ]));
  function frame(action, style, time, progress) {
    const name = action==='tap' ? 'attack' : Object.hasOwn(actions,action) ? action : 'idle';
    const period = actions[name].period;
    const phase = period ? ((time%period)+period)%period/period : clamp(progress||0);
    return (clips[style]||clips.war)[name][Math.min(frameCount-1,Math.floor(phase*frameCount))];
  }
  function draw(g, im, height, pose, action, color) {
    const [dx,dy,angle,sx,sy,bend,effect] = pose;
    const width = height*im.naturalWidth/im.naturalHeight;
    g.translate(dx*height,dy*height);
    g.rotate(angle);
    g.scale(sx,sy);

    // Local shear varies from the grounded feet to the head and cape.
    g.translate(0,-height);
    const bands = 5;
    const sourceHeight = im.naturalHeight/bands;
    const bandHeight = height/bands;
    for(let i=0;i<bands;i++){
      const top = (1-i/bands)**2 * bend*height;
      const bottom = (1-(i+1)/bands)**2 * bend*height;
      g.save();
      g.transform(1,0,(bottom-top)/bandHeight,1,top,0);
      const overlap = i<bands-1 ? .65 : 0;
      g.drawImage(im,0,i*sourceHeight,im.naturalWidth,sourceHeight+overlap,-width/2,0,width,bandHeight*(1+overlap/sourceHeight));
      g.restore();
      g.translate(0,bandHeight);
    }

    if(effect>.06&&action==='block'){
      g.globalAlpha*=effect*.85;
      g.strokeStyle='#b9edff';
      g.lineWidth=height*.018;
      g.beginPath();
      g.ellipse(width*.24,height*.43,width*.36,height*.37,-.16,-1.48,1.36);
      g.stroke();
    }else if(effect>.1&&action==='ult'){
      g.globalAlpha*=effect*.68;
      g.strokeStyle=color;
      g.lineWidth=height*.012;
      g.beginPath();
      g.ellipse(0,height*.82,width*.62,height*.09,0,0,Math.PI*2);
      g.stroke();
    }
  }
  return {frameCount, frame, draw};
})();
