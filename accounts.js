const NeonAccounts = (() => {
  const config=window.NEON_AUTH||{};
  const sessionKey='neonrift_device_session_v1';
  const guestKey='neonrift_save_v1';
  const iterations=600000;
  const accents=['violet','cyan','amber'];
  const encoder=new TextEncoder();
  let active=null,client=null,opening=null,restoreSave=null,revision=null;
  let queued=null,timer=0,sending=false,conflict=false;
  const configured=Boolean(config.url&&config.publishableKey);

  const nickname=value=>String(value||'').normalize('NFC').trim().replace(/ +/g,' ');
  const validNick=value=>/^[\p{L}\p{N}][\p{L}\p{N}_ -]{1,18}[\p{L}\p{N}]$/u.test(value);
  const normalizeLogin=value=>String(value||'').normalize('NFKC').trim().toLowerCase().replace(/@neonrift\.invalid$/,'');
  const validLogin=value=>/^[a-z0-9][a-z0-9._-]{2,23}$/.test(value);
  const gameKey=()=>active?`neonrift_${active.kind}_${active.id}_save`:guestKey;
  const syncKey=()=>gameKey()+'_pending';
  const random=()=>crypto.getRandomValues(new Uint8Array(16));
  const toHex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');

  function db(){
    if(!opening)opening=new Promise((resolve,reject)=>{
      const request=indexedDB.open('neonrift_accounts',1);
      request.onupgradeneeded=()=>{
        const store=request.result.createObjectStore('accounts',{keyPath:'id'});
        store.createIndex('login','login',{unique:true});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('Закройте другие вкладки игры и повторите.'));
    }).catch(error=>{opening=null;throw error});
    return opening;
  }

  async function deviceRequest(mode,operation){
    const base=await db();
    return new Promise((resolve,reject)=>{
      const tx=base.transaction('accounts',mode);
      let req;
      tx.oncomplete=()=>resolve(req.result);
      tx.onabort=()=>reject(tx.error||new Error('Хранилище устройства недоступно.'));
      req=operation(tx.objectStore('accounts'));
    });
  }

  async function passwordHash(password,salt){
    if(!globalThis.crypto?.subtle)throw new Error('Для входа откройте игру по HTTPS.');
    const secret=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations,salt},secret,256);
    return new Uint8Array(bits);
  }
  function passwordOk(password){return password.length>=8&&password.length<=128}
  function equal(a,b){
    let difference=a.length^b.length;
    for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
    return difference===0;
  }
  function publicIdentity(record){
    const {id,login,nickname,avatar,accent}=record;
    return {kind:'device',id,login,nickname,avatar,accent};
  }

  async function deviceSignUp(login,password,name,progress){
    if(!validLogin(login))throw new Error('Логин должен содержать 3–24 латинских символа, цифры, точку, дефис или подчёркивание.');
    if(!passwordOk(password))throw new Error('Введите пароль длиной от 8 до 128 символов.');
    if(!validNick(name))throw new Error('Введите ник длиной от 3 до 20 символов.');
    const salt=random(),hash=await passwordHash(password,salt);
    const record={id:toHex(random()),login,nickname:name,salt,hash,avatar:'',accent:accents[0]};
    if(!active&&progress)localStorage.setItem(`neonrift_device_${record.id}_save`,progress);
    try{await deviceRequest('readwrite',s=>s.add(record))}
    catch(error){
      localStorage.removeItem(`neonrift_device_${record.id}_save`);
      if(error.name==='ConstraintError')throw new Error('Этот игровой логин уже занят на устройстве.');
      throw error;
    }
    localStorage.setItem(sessionKey,record.id);
    return record.id;
  }

  async function deviceSignIn(login,password){
    if(!validLogin(login)||!passwordOk(password))throw new Error('Неверный игровой логин или пароль.');
    const record=await deviceRequest('readonly',s=>s.index('login').get(login));
    const hash=await passwordHash(password,record?.salt||random());
    if(!record||!equal(hash,record.hash))throw new Error('Неверный игровой логин или пароль.');
    localStorage.setItem(sessionKey,record.id);
  }

  async function cloud(){
    if(!configured)return null;
    if(!client){
      const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.89.0?bundle');
      client=createClient(config.url,config.publishableKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    }
    return client;
  }

  async function restore(){
    try{
      if(configured){
        try{
          const remote=await cloud();
          const {data:{session}}=await remote.auth.getSession();
          if(session){
            const id=session.user.id;
            active={kind:'cloud',id,nickname:'',avatar:'',accent:accents[0]};
            const [profile,save]=await Promise.all([
              remote.from('neon_profiles').select('nickname,avatar,accent').eq('id',id).maybeSingle(),
              remote.from('neon_progress').select('data,revision').eq('id',id).maybeSingle(),
            ]);
            if(profile.error)throw profile.error;
            if(profile.data)Object.assign(active,profile.data);
            if(!save.error){
              revision=save.data?.revision??0;
              restoreSave=save.data?JSON.stringify(save.data.data):null;
              const pending=localStorage.getItem(syncKey());
              if(pending!==null){
                const current=localStorage.getItem(gameKey());
                if(Number(pending)===revision&&current){
                  restoreSave=current;
                  syncLater(current);
                }else{
                  if(current)localStorage.setItem(gameKey()+'_conflict',current);
                  localStorage.removeItem(syncKey());
                  conflict=true;
                }
              }
            }
            if(location.search.includes('code='))history.replaceState(null,'',location.pathname);
            return conflict?{...active,error:'Облачный прогресс изменился. Локальная копия сохранена.'}:active;
          }
        }catch{
          if(active)throw new Error('Не удалось загрузить облачный профиль.');
        }
      }
      const id=localStorage.getItem(sessionKey);
      if(id){
        const record=await deviceRequest('readonly',s=>s.get(id));
        if(record)active=publicIdentity(record);
        else localStorage.removeItem(sessionKey);
      }
    }catch(error){return {error:error.message}}
    return active;
  }

  async function oauth(provider){
    if(!configured)throw new Error('Этот способ входа пока не подключён.');
    const remote=await cloud();
    const {error}=await remote.auth.signInWithOAuth({provider,options:{redirectTo:new URL(location.pathname,location.origin).href}});
    if(error)throw new Error('Не удалось открыть вход. Попробуйте ещё раз.');
  }

  async function setNickname(name){
    if(!active||active.kind!=='cloud'||active.nickname)throw new Error('Ник уже выбран.');
    if(!validNick(name))throw new Error('Введите ник длиной от 3 до 20 символов.');
    const {error}=await client.from('neon_profiles').insert({id:active.id,nickname:name});
    if(error)throw new Error(error.code==='23505'?'Этот ник уже занят.':'Не удалось сохранить ник.');
    active.nickname=name;
  }

  async function customize(avatar,accent){
    if(!active)return;
    if(!accents.includes(accent))throw new Error('Выберите оформление профиля.');
    if(active.kind==='device'){
      const record=await deviceRequest('readonly',s=>s.get(active.id));
      await deviceRequest('readwrite',s=>s.put({...record,avatar,accent}));
    }else{
      const {error}=await client.from('neon_profiles').update({avatar,accent}).eq('id',active.id);
      if(error)throw new Error('Не удалось сохранить оформление.');
    }
    Object.assign(active,{avatar,accent});
  }

  async function signOut(){
    if(active?.kind==='cloud'){
      clearTimeout(timer);
      await sync();
      const {error}=await client.auth.signOut({scope:'local'});
      if(error)throw new Error('Не удалось выйти из аккаунта.');
    }
    localStorage.removeItem(sessionKey);
  }

  function syncLater(raw){
    if(active?.kind!=='cloud'||!active.nickname||revision===null||conflict)return;
    queued=raw;
    try{localStorage.setItem(syncKey(),String(revision))}catch{}
    clearTimeout(timer);
    timer=setTimeout(sync,800);
  }
  async function sync(){
    if(!queued||sending||conflict)return;
    const raw=queued;
    queued=null;sending=true;
    try{
      const {data,error}=await client.rpc('neon_save_progress',{payload:JSON.parse(raw),expected_revision:revision});
      if(error){
        if(error.code==='40001'){
          conflict=true;
          try{localStorage.setItem(gameKey()+'_conflict',queued||raw)}catch{}
          window.dispatchEvent(new Event('neon-save-conflict'));
        }
        else queued=queued||raw;
      }else{
        revision=Number(data);
        try{
          if(queued)localStorage.setItem(syncKey(),String(revision));
          else localStorage.removeItem(syncKey());
        }catch{}
      }
    }catch{queued=queued||raw}
    finally{sending=false}
    // A failed network request waits for the next save or an online event.
    if(queued&&queued!==raw&&!conflict){clearTimeout(timer);timer=setTimeout(sync,800)}
  }
  window.addEventListener('online',()=>{if(queued)sync()});
  return {accents, configured,nickname,validNick,normalizeLogin,deviceSignUp,deviceSignIn,oauth,
    restore,setNickname,customize,signOut,gameKey,syncLater,
    get active(){return active},get restoreSave(){return restoreSave}};
})();
