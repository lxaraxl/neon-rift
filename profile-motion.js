const ProfileMotion = (() => {
  const FPS=60;
  const TAU=Math.PI*2;
  // Per portrait: cycle length in seconds, lift, lean, head center, two moving
  // regions [center X, center Y, radius, travel X, travel Y, rotation],
  // and the accent [kind, center X, center Y, color].
  const rigs={
    astra:  [5.1,.022,.012,.52,.20, [.20,.19,.24,-.033,-.037,-.15], [.25,.57,.34,.035,-.018,.10], ['constellation',.20,.18,'#ffe4a0']],
    bastion:[3.5,.003,.010,.45,.13, [.74,.57,.28,-.060,-.024,-.17], [.26,.72,.21,.025,.005,.08], ['barrier',.74,.53,'#f5ce7f']],
    cipher: [4.2,.007,.018,.49,.13, [.36,.26,.18,.047,-.028,.25], [.75,.47,.23,.049,.014,.18], ['cards',.36,.27,'#df85ff']],
    glitch: [4.8,.025,.010,.47,.16, [.79,.24,.23,.024,-.043,.14], [.21,.48,.28,-.043,.020,-.19], ['fracture',.80,.23,'#b5a3ff']],
    grom:   [3.9,.003,.018,.47,.11, [.29,.49,.25,-.072,-.016,-.22], [.69,.32,.27,.031,.016,.13], ['shockwave',.24,.56,'#69d9ff']],
    kairos: [5.8,.012,.009,.53,.14, [.32,.26,.23,-.032,-.028,-.17], [.77,.31,.24,.045,-.027,.18], ['clock',.32,.20,'#d18efc']],
    lyra:   [4.5,.009,.020,.52,.13, [.77,.25,.18,.037,-.032,.22], [.23,.42,.30,-.036,.015,-.16], ['song',.76,.24,'#ffe2a1']],
    mila:   [3.3,.008,.026,.47,.15, [.76,.35,.24,.055,-.035,.21], [.24,.41,.26,-.027,-.020,-.16], ['equalizer',.77,.35,'#ff8ace']],
    murr:   [3.7,.004,.022,.53,.14, [.31,.25,.23,.053,-.020,.28], [.27,.73,.23,-.052,-.012,-.22], ['sight',.81,.18,'#ffdf72']],
    nyx:    [5.5,.014,.014,.48,.15, [.33,.60,.28,-.039,-.021,-.20], [.74,.72,.28,.066,-.024,.21], ['shade',.25,.60,'#d3a2ff']],
    phoenix:[5.3,.030,.011,.52,.18, [.21,.36,.34,-.073,-.048,-.21], [.80,.36,.32,.073,-.049,.22], ['feathers',.51,.34,'#ffc173']],
    pixel:  [3.6,.007,.017,.49,.14, [.66,.25,.20,.027,-.047,.22], [.28,.55,.29,-.044,-.023,-.21], ['scan',.68,.23,'#81f9ff']],
    pyro:   [4.7,.021,.013,.54,.18, [.33,.40,.22,-.052,-.026,-.20], [.70,.19,.26,.050,-.032,.20], ['flame',.30,.40,'#ffab65']],
    rain:   [5.2,.010,.012,.57,.13, [.33,.25,.24,-.032,-.041,-.20], [.74,.56,.30,.046,-.021,.20], ['orb',.29,.16,'#8ebdff']],
    raven:  [5.7,.012,.012,.48,.15, [.25,.26,.23,-.045,-.032,-.21], [.75,.48,.32,.052,-.021,.22], ['ravens',.21,.24,'#e29bff']],
    scrap:  [4.4,.004,.016,.50,.15, [.30,.25,.22,.012,-.049,-.22], [.72,.36,.29,.042,-.012,.19], ['weld',.30,.23,'#ffd09a']],
    silas:  [4.1,.004,.020,.45,.13, [.71,.29,.24,.063,-.033,.20], [.21,.64,.26,-.044,-.042,-.23], ['blade',.23,.66,'#9aeaff']],
    sol:    [5.4,.008,.013,.49,.16, [.29,.27,.24,-.040,-.045,-.16], [.78,.31,.22,.049,-.035,.21], ['sun',.23,.20,'#ffe19a']],
    tesla:  [4.3,.005,.015,.49,.12, [.30,.22,.21,-.028,-.041,-.20], [.70,.21,.23,.033,-.034,.18], ['gears',.22,.55,'#9cecff']],
    volta:  [3.8,.007,.018,.46,.15, [.74,.22,.23,.038,-.041,.21], [.24,.41,.27,-.036,-.020,-.19], ['rail',.80,.20,'#8dfbff']],
    zhar:   [3.4,.004,.024,.50,.14, [.33,.29,.21,-.062,-.020,-.24], [.64,.31,.21,.048,-.032,.19], ['fists',.34,.30,'#ffae70']],
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const key=(frames,q)=>{
    const i=q*(frames.length-1);
    const lo=Math.floor(i),f=i-lo;
    return mix(frames[lo],frames[Math.min(lo+1,frames.length-1)],f*f*(3-2*f));
  };
  // Main gestures are timed separately from the head, breathing and fabric.
  const stances={
    astra:  [0,.06,.28,.72,1,.91,.51,.12,0],
    bastion:[0,-.11,.36,.94,1,.94,.65,.19,0],
    cipher: [0,-.26,-.44,.65,.17,.93,.40,-.11,0],
    glitch: [0,.15,.55,.27,.87,1,.51,.07,0],
    grom:   [0,-.18,.48,1,.84,.43,.57,.06,0],
    kairos: [0,-.06,.21,.37,.69,1,.94,.43,0],
    lyra:   [0,.38,.88,.55,-.24,.20,.72,.16,0],
    mila:   [0,.30,.91,-.32,-.70,.52,.84,.10,0],
    murr:   [0,-.26,-.38,.14,.81,1,.89,.41,0],
    nyx:    [0,-.15,.34,.87,1,.56,-.20,-.12,0],
    phoenix:[0,.04,.52,1,.68,.91,.55,.23,0],
    pixel:  [0,-.20,.87,.32,.55,.74,.18,-.12,0],
    pyro:   [0,-.30,-.49,.13,.99,.83,.43,.14,0],
    rain:   [0,.17,.37,.64,1,.76,.89,.33,0],
    raven:  [0,.05,.28,.61,.94,1,.72,.14,0],
    scrap:  [0,.14,.50,1,.76,.33,-.16,-.06,0],
    silas:  [0,-.12,-.39,-.24,.98,.85,.30,-.15,0],
    sol:    [0,.26,.53,.67,.98,.93,.67,.25,0],
    tesla:  [0,-.23,.60,.89,.34,.71,.31,-.09,0],
    volta:  [0,-.21,-.37,.26,.91,.72,.23,-.08,0],
    zhar:   [0,.19,.94,-.45,.74,.18,-.39,.04,0],
  };

  const poses=new Map();
  function reelFor(id){
    if(poses.has(id))return poses.get(id);
    const [seconds,lift,lean,hx,hy,first,second]=rigs[id];
    const count=Math.round(seconds*FPS);
    const joints=new Float32Array([hx,hy,.16,...first.slice(0,3),...second.slice(0,3)]);
    const reel=Array.from({length:count},(_,i)=>{
      const phase=i/count, angle=phase*TAU;
      const breath=Math.sin(angle*2-.4);
      const move=key(stances[id],phase);
      const follow=key(stances[id],(phase+.92)%1);
      const gaze=key(stances[id],(phase+.045)%1);
      const fabric=.014*Math.sin(angle-.83)+second[3]*.37*follow;
      return {
        phase,move,
        drift:new Float32Array([lean*(.40*Math.sin(angle)+.60*move), lift*Math.cos(angle)-.002*breath,breath,fabric]),
        joints,
        turns:new Float32Array([
          lean*(.83*gaze+.18*breath),-.006*breath-.010*gaze,-lean*4*gaze,
          first[3]*move*1.26,first[4]*move*1.22,first[5]*move*1.24,
          second[3]*follow*1.18,second[4]*follow*1.12,second[5]*follow*1.13,
        ]),
      };
    });
    poses.set(id,reel);
    return reel;
  }

  let mesh;
  function createMesh(){
    const canvas=document.createElement('canvas');
    canvas.className='portrait-body';
    canvas.setAttribute('aria-hidden','true');
    const gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
    if(!gl)return null;
    const vertex=`
      attribute vec2 uv;
      varying vec2 tex;
      uniform vec4 rect;
      uniform vec4 drift;
      uniform vec3 joint[3];
      uniform vec3 turn[3];
      void main(){
        vec2 p=uv;
        for(int i=0;i<3;i++){
          vec2 d=uv-joint[i].xy;
          float weight=exp(-dot(d,d)/(joint[i].z*joint[i].z));
          float angle=turn[i].z;
          vec2 spin=vec2(cos(angle)*d.x-sin(angle)*d.y,sin(angle)*d.x+cos(angle)*d.y)-d;
          p+=weight*(turn[i].xy+spin);
        }
        float anchor=1.0-smoothstep(0.58,0.96,uv.y);
        float ribs=(uv.y-0.39)*5.0;
        float chest=exp(-ribs*ribs);
        float outer=smoothstep(.10,.49,abs(uv.x-.50));
        float hem=smoothstep(.38,.66,uv.y)*(1.0-smoothstep(.78,.98,uv.y));
        p+=vec2(drift.x*anchor+(uv.x-0.5)*chest*drift.z*0.018,
                -drift.y-chest*drift.z*0.004);
        p+=vec2(drift.w*outer*hem,-abs(drift.w)*outer*hem*.45);
        tex=uv;
        vec2 xy=rect.xy+rect.zw*p;
        gl_Position=vec4(xy.x*2.0-1.0,1.0-xy.y*2.0,0.0,1.0);
      }`;
    const fragment=`
      precision mediump float;
      varying vec2 tex;
      uniform sampler2D art;
      void main(){gl_FragColor=texture2D(art,tex);}`;
    function shader(type,code){
      const shader=gl.createShader(type);
      gl.shaderSource(shader,code);
      gl.compileShader(shader);
      if(gl.getShaderParameter(shader,gl.COMPILE_STATUS))return shader;
      gl.deleteShader(shader);
      return null;
    }
    const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);
    if(!vs||!fs)return null;
    const program=gl.createProgram();
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))return null;
    gl.useProgram(program);

    const cols=24,rows=28,points=[],triangles=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++)points.push(i/cols,j/rows);
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const a=j*(cols+1)+i,b=a+cols+1;
      triangles.push(a,a+1,b,a+1,b+1,b);
    }
    const vertices=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,vertices);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);
    const uv=gl.getAttribLocation(program,'uv');
    gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,0,0);
    const faces=gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,faces);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(triangles),gl.STATIC_DRAW);

    const image=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,image);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    gl.uniform1i(gl.getUniformLocation(program,'art'),0);
    const rect=gl.getUniformLocation(program,'rect');
    const drift=gl.getUniformLocation(program,'drift');
    const joint=gl.getUniformLocation(program,'joint[0]');
    const turn=gl.getUniformLocation(program,'turn[0]');
    let lastImage, lastPose, lastRect;
    canvas.addEventListener('webglcontextlost',event=>{
      event.preventDefault();
      canvas.remove();
      mesh=null;
    });
    canvas.addEventListener('webglcontextrestored',()=>{if(mesh===null)mesh=undefined});
    return {canvas,draw(im,box,pose,W,H){
      if(gl.isContextLost())return false;
      if(im!==lastImage){
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);
        lastImage=im;
      }
      if(canvas.width!==W||canvas.height!==H){
        canvas.width=W;canvas.height=H;gl.viewport(0,0,W,H);
        lastRect=undefined;
      }
      if(box!==lastRect){
        gl.uniform4f(rect,box.x/W,box.y/H,box.w/W,box.h/H);
        lastRect=box;
      }
      if(pose.joints!==lastPose?.joints)gl.uniform3fv(joint,pose.joints);
      gl.uniform4fv(drift,pose.drift);gl.uniform3fv(turn,pose.turns);
      lastPose=pose;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES,triangles.length,gl.UNSIGNED_SHORT,0);
      return true;
    }};
  }

  function fallback(g,im,b,pose){
    const strips=16,sh=im.height/strips;
    const {x,y,w,h}=b;
    const offset=v=>{
      let dx=pose.drift[0]*Math.max(0,1-v/.86),dy=-pose.drift[1];
      for(let i=0;i<9;i+=3){
        const z=pose.joints[i+2];
        const influence=Math.exp(-((v-pose.joints[i+1])**2)/(z*z))*.48;
        dx+=influence*pose.turns[i];
        dy+=influence*pose.turns[i+1];
      }
      return [dx*w,dy*h];
    };
    let top=offset(0);
    for(let i=0;i<strips;i++){
      const bottom=offset((i+1)/strips),dh=h/strips+bottom[1]-top[1];
      g.setTransform(1,0,(bottom[0]-top[0])/dh,1,x+top[0],y+i*h/strips+top[1]);
      const overlap=i===strips-1?0:.85;
      g.drawImage(im,0,i*sh,im.width,sh+overlap,0,0,w,dh*(1+overlap/sh));
      top=bottom;
    }
    g.setTransform(1,0,0,1,0,0);
  }

  function star(g,x,y,size){
    g.beginPath();g.moveTo(x-size,y);g.lineTo(x-size*.16,y-size*.23);g.lineTo(x,y-size);
    g.lineTo(x+size*.16,y-size*.23);g.lineTo(x+size,y);g.lineTo(x+size*.16,y+size*.23);
    g.lineTo(x,y+size);g.lineTo(x-size*.16,y+size*.23);g.closePath();g.fill();
  }
  function trace(g,pts){
    g.beginPath();
    pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));
    g.stroke();
  }
  function orbit(g,r,flat,a,length){
    g.beginPath();g.ellipse(0,0,r,r*flat,-.28,a,a+length);g.stroke();
  }
  function accent(g,b,pose,[kind,u,v,color]){
    const {phase,move,turns}=pose;
    const a=phase*TAU,pulse=clamp(Math.abs(move),0,1);
    const x=b.x+b.w*(u+turns[3]*.66);
    const y=b.y+b.h*(v+turns[4]*.66-pose.drift[1]);
    const size=Math.min(b.w,b.h)*.16;
    g.save();g.translate(x,y);g.scale(size,size);
    g.globalCompositeOperation='screen';
    g.strokeStyle=color;g.fillStyle=color;g.lineWidth=.028;g.lineJoin='round';g.lineCap='round';
    g.globalAlpha=.32+.43*pulse;

    switch(kind){
      case 'constellation':{
        orbit(g,.82,.53,a,4.6);
        const points=Array.from({length:5},(_,i)=>[Math.cos(a+i*1.36)*(.72+i*.06),Math.sin(a+i*1.36)*.50]);
        trace(g,points);
        points.forEach(([sx,sy],i)=>star(g,sx,sy,.065+(i%3)*.024));
        break;
      }
      case 'barrier':
        for(let i=0;i<2;i++){
          const r=.43+.23*i+.28*pulse;
          const pts=Array.from({length:7},(_,j)=>[Math.cos(j*TAU/6)*r,Math.sin(j*TAU/6)*r*1.48]);
          trace(g,pts);
        }
        break;
      case 'cards':
        for(let i=0;i<4;i++){
          g.save();g.rotate(a+i*.52);g.translate(.39+i*.14,0);g.rotate(.4-i*.16);
          g.strokeRect(-.13,-.21,.26,.42);star(g,0,0,.072);g.restore();
        }
        break;
      case 'fracture':
        for(let i=0;i<7;i++){
          const q=a+i*2.399, r=.32+(i%3)*.19+pulse*.24;
          const sx=Math.cos(q)*r,sy=Math.sin(q*2)*.56;
          trace(g,[[sx,sy-.1],[sx+.16,sy+.02],[sx+.04,sy+.17],[sx,sy-.1]]);
        }
        break;
      case 'shockwave':
        for(let i=0;i<3;i++){
          const q=(phase*2+i/3)%1;
          g.globalAlpha=Math.sin(q*Math.PI)*(.15+pulse*.63);
          orbit(g,.25+q*.90,.42,Math.PI*.03,Math.PI*1.22);
        }
        break;
      case 'clock':
      case 'sun':{
        const ticks=kind==='clock'?12:16;
        orbit(g,.73,1,0,TAU);
        for(let i=0;i<ticks;i++){
          const r=i*TAU/ticks+(kind==='sun'?a*.5:0);
          const length=i%4===0?.25:.12;
          trace(g,[[Math.cos(r)*(.65-length),Math.sin(r)*(.65-length)],[Math.cos(r)*.66,Math.sin(r)*.66]]);
        }
        if(kind==='clock')trace(g,[[Math.cos(-a)*.54,Math.sin(-a)*.54],[0,0],[Math.cos(a*2)*.32,Math.sin(a*2)*.32]]);
        else star(g,0,0,.27+.12*pulse);
        break;
      }
      case 'song':
        for(let i=0;i<4;i++){
          const q=(phase+i*.25)%1;
          const nx=q*.85-.28,ny=-q*.96+.2*Math.sin(a+i);
          g.globalAlpha=Math.sin(q*Math.PI)*(.4+pulse*.44);
          g.beginPath();g.ellipse(nx,ny,.086,.060,-.3,0,TAU);g.fill();
          trace(g,[[nx+.067,ny],[nx+.067,ny-.28],[nx+.22,ny-.21]]);
        }
        break;
      case 'equalizer':
        for(let i=0;i<7;i++){
          const bar=.08+Math.abs(Math.sin(a*3+i*.73))*(.27+.32*pulse);
          g.fillRect(.13*i-.40,.48-bar,.068,bar);
        }
        break;
      case 'sight':
        orbit(g,.37,1,a,4.8);
        for(let i=0;i<4;i++){
          g.save();g.rotate(i*TAU/4);trace(g,[[.23,0],[.43,0]]);g.restore();
        }
        star(g,.32+.32*pulse,0,.08+.12*pulse);
        break;
      case 'shade':
      case 'flame':
        for(let i=0;i<4;i++){
          const q=(phase+i/4)%1,k=kind==='shade'?1.28:.65;
          g.globalAlpha=Math.sin(Math.PI*q)*(.25+.42*pulse);
          g.beginPath();g.moveTo(-.35+i*.21,.60-q*k);
          g.bezierCurveTo(-.53+i*.24,.28-q*k,.05+i*.19,.31-q*k,.16*Math.sin(a+i)+i*.14,-q*k);
          g.stroke();
        }
        break;
      case 'feathers':
        for(let i=0;i<8;i++){
          const q=(phase+i*.125)%1,side=i%2?1:-1;
          const sx=side*(.20+q*1.38),sy=.97*q-.65;
          g.globalAlpha=Math.sin(q*Math.PI)*(.35+.5*pulse);
          g.beginPath();g.ellipse(sx,sy,.06,.19,side*(.4+q),0,TAU);g.fill();
        }
        break;
      case 'scan':
        for(let row=0;row<3;row++){
          const q=(phase+row/3)%1,ny=q*.95-.48;
          g.globalAlpha=Math.sin(q*Math.PI)*(.37+.48*pulse);
          for(let j=0;j<5;j++)g.fillRect(j*.23-.52,ny,.055+((row+j)%3)*.032,.033);
        }
        break;
      case 'orb':
        for(let i=0;i<3;i++){
          g.save();g.rotate(a*.3+i*TAU/3);orbit(g,.45+i*.07,.42,a,4.5);g.restore();
        }
        star(g,0,0,.15+.11*pulse);
        break;
      case 'ravens':
        for(let i=0;i<3;i++){
          const q=(phase+i/3)%1,px=.99*q-.53,py=-.82*q+.42;
          g.globalAlpha=Math.sin(q*Math.PI)*(.36+.5*pulse);
          const flap=Math.sin(a*4+i)*.10;
          trace(g,[[px-.24,py-.07-flap],[px-.12,py-.04-flap],[px,py+.06],[px+.13,py-.06-flap],[px+.24,py-.11-flap]]);
        }
        break;
      case 'weld':
        for(let i=0;i<7;i++){
          const q=(phase*2+i/7)%1,theta=-i*.53;
          g.globalAlpha=(1-q)*pulse*.86;
          trace(g,[[q*Math.cos(theta),q*Math.sin(theta)+q*q*.47],[(q+.12)*Math.cos(theta),(q+.12)*Math.sin(theta)+q*q*.47]]);
        }
        star(g,0,0,.08+.14*pulse);
        break;
      case 'blade':
        g.save();g.rotate(-.7+.64*move);
        orbit(g,.89,.65,2.1+pulse*.45,2.35);
        trace(g,[[-.53,.38],[-.36,.17],[-.47,.14],[-.12,-.18],[-.23,-.19],[.23,-.37],[.48,-.67]]);
        g.restore();
        break;
      case 'gears':
        for(let i=0;i<2;i++){
          g.save();g.translate(i*.44,i*.34);g.rotate(a*(i?-2:1));g.scale(i?.67:1,i?.67:1);
          orbit(g,.22,1,0,TAU);
          const teeth=Array.from({length:33},(_,j)=>{
            const r=.43+(j%4<2?.10:0),angle=j*TAU/32;
            return [Math.cos(angle)*r,Math.sin(angle)*r];
          });
          trace(g,teeth);g.restore();
        }
        break;
      case 'rail':
        g.save();g.rotate(-.27);
        for(let i=0;i<3;i++)trace(g,[[-.33,.12*i-.12],[.12,.12*i-.12],[.55+.30*pulse,.07*i-.07]]);
        star(g,.59+.22*pulse,0,.10+.16*pulse);
        g.restore();
        break;
      case 'fists':
        for(let i=0;i<2;i++){
          g.save();g.translate(i*1.93,.12*i);
          g.globalAlpha=(.19+.57*pulse)*(i?.78:1);
          orbit(g,.34+.35*pulse,.62,a+i*2.1,3.9);g.restore();
        }
        break;
    }
    g.restore();
  }

  function mount(fx,id,getImage){
    const g=fx.getContext('2d'),motion=matchMedia('(prefers-reduced-motion: reduce)');
    const reel=reelFor(id),effect=rigs[id][6];
    const start=performance.now();
    let lastFrame=-1,lastImage,lastReduced,box;
    let width=fx.clientWidth,height=fx.clientHeight;
    const resize=new ResizeObserver(([entry])=>{
      width=entry.contentRect.width;height=entry.contentRect.height;
    });
    resize.observe(fx);
    function loop(now){
      if(!fx.isConnected){resize.disconnect();return}
      requestAnimationFrame(loop);
      const im=getImage();
      if(!im.width||!im.height)return;
      const dpr=Math.min(2,devicePixelRatio||1);
      const W=Math.round(width*dpr),H=Math.round(height*dpr);
      if(!W||!H)return;
      const reduced=motion.matches;
      const elapsed=Math.max(0,now-start);
      const i=reduced?0:Math.floor(elapsed*FPS/1000)%reel.length;
      const resized=fx.width!==W||fx.height!==H;
      if(resized){fx.width=W;fx.height=H}
      if(resized||im!==lastImage||!box){
        const scale=Math.min(W*.94/im.width,H*.92/im.height),w=im.width*scale,h=im.height*scale;
        box={x:(W-w)/2,y:H-h-H*.04,w,h};
      }
      if(!resized&&lastFrame===i&&lastImage===im&&lastReduced===reduced)return;
      lastFrame=i;lastImage=im;lastReduced=reduced;
      g.clearRect(0,0,W,H);
      if(reduced){
        if(mesh?.canvas.nextElementSibling===fx)mesh.canvas.remove();
        g.drawImage(im,box.x,box.y,box.w,box.h);
        return;
      }
      const pose=reel[i];
      if(mesh===undefined){
        try{mesh=createMesh()}catch{mesh=null}
      }
      if(mesh&&mesh.canvas.nextElementSibling!==fx)fx.before(mesh.canvas);
      if(!mesh?.draw(im,box,pose,W,H))fallback(g,im,box,pose);
      accent(g,box,pose,effect);
    }
    requestAnimationFrame(loop);
  }

  return {fps:FPS,mount};
})();
