/* Provider -> models -> target-system assignments. Local prototype metadata only. */
(function(root){
  'use strict';
  const purposes={chat:'대화',embedding:'임베딩',rerank:'리랭킹'};
  const copy=v=>JSON.parse(JSON.stringify(v)),text=(v,f='')=>typeof v==='string'?v.trim():f,number=v=>v===''||v==null?null:Number(v);
  const unknownCheck=()=>({status:'unknown',at:'',reason:''});
  const validEndpoint=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}};
  const validMask=v=>/^(?:sk-)?\*{4}(?:…[A-Za-z0-9_./+=-]{4})?$/.test(v);
  const maskKey=v=>{const k=text(v);return k.length>12&&/[A-Za-z0-9_./+=-]{4}$/.test(k)?(k.startsWith('sk-')?'sk-':'')+'****…'+k.slice(-4):'****';};
  const seed={version:4,providers:[{uid:'gemma-rke2',name:'소프트웍스 LLM',kind:'reference',endpoint:'https://llm.genworks.co.kr/v1',remark:'',timeout:null,enabled:true,keyState:'reference',keyMask:'',keyUpdatedAt:'',keyHistory:[],check:unknownCheck(),updatedAt:'',updatedBy:''}],models:[{uid:'model-gemma-rke2',providerUid:'gemma-rke2',name:'Gemma 4 · 26B',requestModel:'poc-gemma4-26b-nothink',kind:'reference',purposes:['chat'],features:'미확인',contextTokens:null,maxOutput:null,updatedAt:'',updatedBy:''}],routes:[{uid:'route-ispm-default',system:'ISPM',purpose:'chat',providerUid:'gemma-rke2',modelUid:'model-gemma-rke2',mode:'connection',remark:'',updatedAt:'',updatedBy:''}]};
  function normalize(raw){
    if(!raw||typeof raw!=='object')throw Error('설정 형식을 확인하세요.');
    if(raw.version!==4)return migrate(raw);
    if(![raw.providers,raw.models,raw.routes].every(Array.isArray))throw Error('프로바이더·모델·대상시스템 설정이 필요합니다.');
    const meta=x=>({updatedAt:text(x.updatedAt),updatedBy:text(x.updatedBy)});
    const providers=raw.providers.map(p=>({uid:text(p.uid),name:text(p.name),kind:p.kind==='reference'?'reference':'custom',endpoint:text(p.endpoint).replace(/\/+$/,''),remark:text(p.remark),timeout:number(p.timeout),enabled:p.enabled!==false,keyState:['reference','demo'].includes(p.keyState)?p.keyState:'none',keyMask:['reference','demo'].includes(p.keyState)&&validMask(text(p.keyMask))?text(p.keyMask):'',keyUpdatedAt:text(p.keyUpdatedAt),keyHistory:Array.isArray(p.keyHistory)?p.keyHistory.filter(x=>x&&['등록','교체','삭제'].includes(x.action)).slice(-50).map(x=>({at:text(x.at),action:x.action})):[],check:{status:['ok','failed'].includes(p.check?.status)&&text(p.check?.at)?p.check.status:'unknown',at:text(p.check?.at),reason:text(p.check?.reason)},...meta(p)}));
    const models=raw.models.map(m=>({uid:text(m.uid),providerUid:text(m.providerUid),name:text(m.name),requestModel:text(m.requestModel),kind:m.kind==='reference'?'reference':'custom',purposes:Array.isArray(m.purposes)?[...new Set(m.purposes.filter(p=>purposes[p]))]:[],features:text(m.features,'미확인'),contextTokens:number(m.contextTokens),maxOutput:number(m.maxOutput),...meta(m)}));
    const routes=raw.routes.map(r=>({uid:text(r.uid),system:text(r.system),purpose:text(r.purpose),mode:['connection','disabled','unresolved'].includes(r.mode)?r.mode:'unresolved',providerUid:r.mode==='connection'?text(r.providerUid):'',modelUid:r.mode==='connection'?text(r.modelUid):'',remark:text(r.remark),...meta(r)}));
    const s={version:4,providers,models,routes};
    for(const list of [providers,models,routes])if(list.length>1000||list.some(x=>!x.uid)||new Set(list.map(x=>x.uid)).size!==list.length)throw Error('중복 또는 잘못된 설정 ID입니다.');
    providers.forEach(p=>validateProvider(s,p));models.forEach(m=>validateModel(s,m));routes.forEach(r=>validateRoute(s,r));return s;
  }
  function migrate(raw){
    const old=legacyNormalize(raw),providers=[],models=[],byConnection=new Map(),linked=new Set();
    for(const c of old.connections){
      const m=old.models.find(m=>m.uid===c.modelUid),id=c.uid+'--'+m.uid;
      const generated=c.name==='Gemma 기본 연결'||c.name===m.name+' 연결';
      providers.push({...c,name:generated?(m.provider||'사용자 등록')+' LLM'+(c.kind==='custom'?' · Custom':''):c.name});
      models.push({...m,uid:id,providerUid:c.uid,requestModel:c.requestModel,maxOutput:c.maxOutput});
      byConnection.set(c.uid,id);linked.add(m.uid);
    }
    // Keep unconnected legacy definitions for explicit placement through a provider's model manager.
    for(const m of old.models)if(!linked.has(m.uid))models.push({...m,providerUid:'',requestModel:'',maxOutput:null});
    const routes=old.routes.map(r=>({...r,providerUid:r.mode==='connection'?r.connectionUid:'',modelUid:r.mode==='connection'?byConnection.get(r.connectionUid):''}));
    return normalize({version:4,providers,models,routes});
  }
  function validateProvider(s,p){
    if(!p.name||!validEndpoint(p.endpoint))throw Error('프로바이더명과 http(s) 엔드포인트를 입력하세요. 주소에 인증정보를 넣지 마세요.');
    if(p.timeout!=null&&(!Number.isFinite(p.timeout)||p.timeout<10||p.timeout>600))throw Error('기존 타임아웃 값을 확인하세요.');
  }
  function validateModel(s,m){
    if(!m.name||!m.purposes.length||m.purposes.some(p=>!purposes[p]))throw Error('모델명과 지원 용도를 입력하세요.');
    if(m.providerUid&&(!s.providers.some(p=>p.uid===m.providerUid)||!m.requestModel))throw Error('프로바이더와 요청 모델 ID를 입력하세요.');
    if(m.providerUid&&s.models.some(x=>x.uid!==m.uid&&x.providerUid===m.providerUid&&x.requestModel===m.requestModel))throw Error('이 프로바이더에 같은 요청 모델 ID가 있습니다.');
    if(m.contextTokens!=null&&(!Number.isInteger(m.contextTokens)||m.contextTokens<1))throw Error('입출력 합산 한도를 확인하세요.');
    if(m.maxOutput!=null&&(!Number.isInteger(m.maxOutput)||m.maxOutput<1||(m.contextTokens&&m.maxOutput>m.contextTokens)))throw Error('기존 최대 출력 값을 확인하세요.');
    if(s.routes.some(r=>r.mode==='connection'&&r.modelUid===m.uid&&(r.providerUid!==m.providerUid||!m.purposes.includes(r.purpose))))throw Error('사용 중인 대상시스템의 프로바이더·용도를 먼저 변경하세요.');
  }
  const scopeKey=r=>JSON.stringify([r.system,r.purpose]);
  function validateRoute(s,r){
    if(!r.system||!purposes[r.purpose])throw Error('대상시스템과 용도를 입력하세요.');
    if(s.routes.some(x=>x.uid!==r.uid&&scopeKey(x)===scopeKey(r)))throw Error('같은 대상시스템·용도의 설정이 이미 있습니다.');
    if(['disabled','unresolved'].includes(r.mode))return;
    const m=s.models.find(m=>m.uid===r.modelUid),p=s.providers.find(p=>p.uid===r.providerUid);
    if(!p||!m||m.providerUid!==p.uid||!m.purposes.includes(r.purpose))throw Error('선택한 프로바이더에 속한 해당 용도의 모델을 선택하세요.');
  }
  const runnable=p=>!!p&&p.enabled&&p.keyState!=='none';
  const candidates=(s,providerUid,purpose)=>s.models.filter(m=>m.providerUid===providerUid&&m.purposes.includes(purpose));
  const providerUse=(s,id)=>s.routes.filter(r=>r.mode==='connection'&&r.providerUid===id);
  const useCount=(s,id)=>s.routes.filter(r=>r.mode==='connection'&&r.modelUid===id);
  function resolve(s,q){
    const route=s.routes.find(r=>scopeKey(r)===scopeKey(q));if(!route)return {status:'unset',reason:'대상시스템 모델 미설정'};
    if(route.mode==='disabled')return {status:'disabled',reason:'사용 안 함',route};
    if(route.mode==='unresolved')return {status:'unresolved',reason:'프로바이더·모델 선택 필요',route};
    const provider=s.providers.find(p=>p.uid===route.providerUid),model=s.models.find(m=>m.uid===route.modelUid);
    if(!provider||!model||model.providerUid!==provider.uid||!model.purposes.includes(q.purpose))return {status:'blocked',reason:'프로바이더·모델 확인 필요',route};
    const result={route,provider,model};
    if(!runnable(provider))return {...result,status:'blocked',reason:provider.enabled?'인증키 미등록':'프로바이더 중지'};
    if(provider.check.status==='failed')return {...result,status:'blocked',reason:'최근 연결 확인 실패'};
    return {...result,status:'configured',reason:provider.check.status==='ok'?'최근 연결 성공':'연결 확인 전'};
  }
  const cleanCheck=(p,old,keyChanged=false)=>!old||keyChanged||p.endpoint!==old.endpoint?unknownCheck():copy(old.check);
  function legacyNormalize(raw){const holder={};
/* Prototype metadata only: no provider requests, secret persistence or GPU allocation. */
(function(root){
  'use strict';
  const purposes={chat:'대화',embedding:'임베딩',rerank:'리랭킹'};
  const copy=v=>JSON.parse(JSON.stringify(v)),text=(v,f='')=>typeof v==='string'?v.trim():f;
  const number=v=>v===''||v==null?null:Number(v);
  const unknownCheck=()=>({status:'unknown',at:'',reason:''});
  const validEndpoint=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}};
  const validMask=v=>/^(?:sk-)?\*{4}(?:…[A-Za-z0-9_./+=-]{4})?$/.test(v);
  const maskKey=v=>{const key=text(v);if(key.length<=12||!/[A-Za-z0-9_./+=-]{4}$/.test(key))return '****';return (key.startsWith('sk-')?'sk-':'')+'****…'+key.slice(-4);};
  const seed={version:3,models:[{uid:'model-gemma-rke2',name:'Gemma 4 · 26B',kind:'reference',provider:'소프트웍스',purposes:['chat'],features:'미확인',contextTokens:null,updatedAt:'',updatedBy:''}],connections:[{uid:'gemma-rke2',kind:'reference',modelUid:'model-gemma-rke2',name:'Gemma 기본 연결',gpu:'',requestModel:'poc-gemma4-26b-nothink',endpoint:'https://llm.genworks.co.kr/v1',remark:'',timeout:null,maxOutput:null,enabled:true,keyState:'reference',keyMask:'',keyUpdatedAt:'',keyHistory:[],check:unknownCheck(),updatedAt:'',updatedBy:''}],routes:[{uid:'route-ispm-default',system:'ISPM',purpose:'chat',connectionUid:'gemma-rke2',mode:'connection',remark:'',updatedAt:'',updatedBy:''}]};
  function normalize(raw){
    if(!raw||typeof raw!=='object')throw Error('저장된 설정 형식이 올바르지 않습니다.');
    if(raw.version!==3)return migrate(raw);
    if(![raw.models,raw.connections,raw.routes].every(Array.isArray))throw Error('모델·접속·대상시스템 설정이 필요합니다.');
    const models=raw.models.map(m=>({uid:text(m.uid),name:text(m.name),kind:m.kind==='reference'?'reference':'custom',provider:text(m.provider),purposes:Array.isArray(m.purposes)?[...new Set(m.purposes.filter(p=>purposes[p]))]:[],features:text(m.features,'미확인'),contextTokens:number(m.contextTokens),updatedAt:text(m.updatedAt),updatedBy:text(m.updatedBy)}));
    const connections=raw.connections.map(c=>({uid:text(c.uid),kind:c.kind==='reference'?'reference':'custom',modelUid:text(c.modelUid),name:text(c.name),gpu:text(c.gpu),requestModel:text(c.requestModel),endpoint:text(c.endpoint).replace(/\/+$/,''),remark:text(c.remark),timeout:number(c.timeout),maxOutput:number(c.maxOutput),enabled:c.enabled!==false,keyState:['reference','demo','none'].includes(c.keyState)?c.keyState:'none',keyMask:['reference','demo'].includes(c.keyState)&&validMask(text(c.keyMask))?text(c.keyMask):'',keyUpdatedAt:text(c.keyUpdatedAt),keyHistory:Array.isArray(c.keyHistory)?c.keyHistory.filter(e=>e&&['등록','교체','삭제'].includes(e.action)).slice(-50).map(e=>({at:text(e.at),action:e.action})):[],check:{status:['ok','failed'].includes(c.check?.status)&&text(c.check?.at)?c.check.status:'unknown',at:text(c.check?.at),reason:text(c.check?.reason)},updatedAt:text(c.updatedAt),updatedBy:text(c.updatedBy)}));
    const routes=raw.routes.map(r=>({uid:text(r.uid),system:text(r.system),purpose:text(r.purpose),connectionUid:r.mode==='connection'?text(r.connectionUid):'',mode:['connection','disabled','unresolved'].includes(r.mode)?r.mode:'unresolved',remark:text(r.remark),updatedAt:text(r.updatedAt),updatedBy:text(r.updatedBy)}));
    const s={version:3,models,connections,routes};
    for(const list of [models,connections,routes])if(list.length>500||list.some(x=>!x.uid)||new Set(list.map(x=>x.uid)).size!==list.length)throw Error('중복 또는 잘못된 설정 ID가 있습니다.');
    models.forEach(m=>validateModel(s,m));connections.forEach(c=>validateConnection(s,c));routes.forEach(r=>validateRoute(s,r));return s;
  }
  function migrate(raw){
    if(raw.version!==2){
      if(!Array.isArray(raw.models)||!raw.links)throw Error('이전 저장 형식을 읽을 수 없습니다.');
      const models=[],connections=[];
      for(const m of raw.models){
        if(!text(m.uid)||!text(m.model)||!validEndpoint(m.endpoint))throw Error('이전 모델 정보를 확인하세요.');
        const pristine=m.uid==='gemma-rke2'&&m.name===seed.models[0].name&&m.model===seed.connections[0].requestModel&&m.endpoint===seed.connections[0].endpoint;
        const kind=m.kind==='reference'||(!m.kind&&pristine)?'reference':'custom';
        models.push({uid:'model-'+m.uid,name:m.name,kind,provider:text(m.provider,kind==='reference'?'소프트웍스':'사용자 등록'),purposes:['chat'],features:'미확인'});
        connections.push({uid:m.uid,kind,modelUid:'model-'+m.uid,name:m.name+' 연결',gpu:'',requestModel:m.model,endpoint:m.endpoint,keyState:m.auth==='none'?'none':m.keyState,keyUpdatedAt:m.keyUpdatedAt,keyHistory:m.keyHistory,remark:m.remark});
      }
      return normalize({version:3,models,connections,routes:Object.entries(raw.links).filter(([,id])=>connections.some(c=>c.uid===id)).map(([system,id],i)=>({uid:'legacy-route-'+i,system,purpose:'chat',connectionUid:id,mode:'connection',remark:''}))});
    }
    if(![raw.models,raw.connections,raw.routes].every(Array.isArray))throw Error('이전 설정을 확인하세요.');
    const groups=new Map();for(const r of raw.routes){const key=JSON.stringify([r.system,r.purpose]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
    const routes=[];
    for(const rows of groups.values()){
      const first=rows[0],same=rows.every(r=>r.mode===first.mode&&r.connectionUid===first.connectionUid);
      // Removing organization/department must never silently pick one conflicting model.
      routes.push({uid:first.uid,system:first.system,purpose:first.purpose,connectionUid:same?first.connectionUid:'',mode:same?first.mode:'unresolved',remark:same?text(first.remark):('이전 범위별 모델이 다릅니다. 확인 후 선택: '+rows.map(r=>(r.organization||'')+'/'+(r.department||'기본')+' → '+(raw.connections.find(c=>c.uid===r.connectionUid)?.name||'사용 안 함')).join('; ')).slice(0,1000),updatedAt:first.updatedAt,updatedBy:first.updatedBy});
    }
    return normalize({version:3,models:raw.models,connections:raw.connections.map(c=>({...c,remark:text(c.remark)})),routes});
  }
  function validateModel(s,m){
    if(!m.name||!m.provider||!m.purposes.length||m.purposes.some(p=>!purposes[p]))throw Error('모델명·제공자·지원 용도를 입력하세요.');
    if(m.contextTokens!=null&&(!Number.isInteger(m.contextTokens)||m.contextTokens<1))throw Error('입출력 합산 한도는 양의 정수로 입력하세요.');
    if(s.routes.some(r=>r.mode==='connection'&&s.connections.find(c=>c.uid===r.connectionUid)?.modelUid===m.uid&&!m.purposes.includes(r.purpose)))throw Error('대상시스템에서 사용하는 용도를 먼저 변경하세요.');
    if(m.contextTokens&&s.connections.some(c=>c.modelUid===m.uid&&c.maxOutput>m.contextTokens))throw Error('기존 최대 출력보다 합산 한도를 작게 설정할 수 없습니다.');
  }
  function validateConnection(s,c){
    const m=s.models.find(m=>m.uid===c.modelUid);if(!m||!c.name||!c.requestModel)throw Error('연결명·모델·요청 모델 ID를 입력하세요.');
    if(!validEndpoint(c.endpoint))throw Error('http(s) 기본 주소를 입력하세요. 계정·인증키·쿼리를 주소에 넣지 마세요.');
    if(c.timeout!=null&&(!Number.isFinite(c.timeout)||c.timeout<10||c.timeout>600))throw Error('타임아웃은 10~600초로 입력하세요.');
    if(c.maxOutput!=null&&(!Number.isInteger(c.maxOutput)||c.maxOutput<1||(m.contextTokens&&c.maxOutput>m.contextTokens)))throw Error('최대 출력은 양의 정수이며 등록한 합산 한도 이하여야 합니다.');
    if(s.routes.some(r=>r.mode==='connection'&&r.connectionUid===c.uid&&!m.purposes.includes(r.purpose)))throw Error('대상시스템에서 사용하는 용도를 먼저 변경하세요.');
  }
  const scopeKey=r=>JSON.stringify([r.system,r.purpose]);
  function validateRoute(s,r){
    if(!r.system||!purposes[r.purpose])throw Error('대상시스템과 용도를 입력하세요.');
    if(s.routes.some(x=>x.uid!==r.uid&&scopeKey(x)===scopeKey(r)))throw Error('같은 대상시스템·용도의 설정이 이미 있습니다.');
    if(['disabled','unresolved'].includes(r.mode))return;
    const c=s.connections.find(c=>c.uid===r.connectionUid),m=s.models.find(m=>m.uid===c?.modelUid);
    if(!c||!m?.purposes.includes(r.purpose))throw Error('해당 용도에 맞는 모델 연결을 선택하세요.');
  }
  const runnable=c=>!!c&&c.enabled&&c.keyState!=='none';
  const candidates=(s,purpose)=>s.connections.filter(c=>s.models.find(m=>m.uid===c.modelUid)?.purposes.includes(purpose));
  const useCount=(s,id)=>s.routes.filter(r=>r.mode==='connection'&&r.connectionUid===id);
  function resolve(s,q){
    const route=s.routes.find(r=>scopeKey(r)===scopeKey(q));if(!route)return {status:'unset',reason:'대상시스템의 모델 설정 없음'};
    if(route.mode==='unresolved')return {status:'unresolved',reason:'이전 설정 확인 후 모델 선택 필요',route};
    if(route.mode==='disabled')return {status:'disabled',reason:'사용 안 함',route};
    const connection=s.connections.find(c=>c.uid===route.connectionUid),model=s.models.find(m=>m.uid===connection?.modelUid);
    if(!connection||!model?.purposes.includes(q.purpose))return {status:'blocked',reason:'모델·지원 용도 확인 필요',route};
    if(!runnable(connection))return {status:'blocked',reason:connection.enabled?'인증키 미등록':'사용 중지',route,connection,model};
    if(connection.check.status==='failed')return {status:'blocked',reason:'최근 연결 확인 실패',route,connection,model};
    return {status:'configured',reason:connection.check.status==='ok'?'최근 확인 정상':'실제 연결 미확인',route,connection,model};
  }
  const cleanCheck=(c,old,keyChanged=false)=>!old||keyChanged||['endpoint','requestModel','modelUid','gpu'].some(k=>c[k]!==old[k])?unknownCheck():copy(old.check);
  root.OapLlmModel={purposes,seed,copy,normalize,maskKey,migrate,validEndpoint,validateModel,validateConnection,validateRoute,scopeKey,runnable,candidates,resolve,useCount,cleanCheck,unknownCheck};
})(holder);

return holder.OapLlmModel.normalize(raw);
}
  root.OapLlmModel={purposes,seed,copy,normalize,migrate,maskKey,validEndpoint,validateProvider,validateModel,validateRoute,scopeKey,runnable,candidates,providerUse,useCount,resolve,cleanCheck,unknownCheck};
})(globalThis);
