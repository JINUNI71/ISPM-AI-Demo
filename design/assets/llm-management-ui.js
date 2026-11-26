(function () {
  'use strict';
  const C=globalThis.OapLlmModel, $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key='oap-llm-management-v4',previousKey='oap-llm-management-v3',earlierKey='oap-llm-management-v2',oldKey='oap-llm-model-prototype-v1';
  let state=C.copy(C.seed),callback=null,returnFocus=null,timer,storageNotice='',drafts=new Map(),newRows=[];
  try {
    const prefix='oap-llm-prototype-migration:';
    const moved=window.name.startsWith(prefix) ? window.name.slice(prefix.length) : '';
    if (moved) window.name='';
    const raw=localStorage.getItem(key)||localStorage.getItem(previousKey)||localStorage.getItem(earlierKey)||moved||localStorage.getItem(oldKey);
    if (raw) { state=C.normalize(JSON.parse(raw)); localStorage.setItem(key,JSON.stringify(state)); }
  } catch (e) { storageNotice='저장된 설정을 불러오지 못했습니다. 원본 저장값은 유지하며 초기 시안을 표시합니다. '+e.message; }
  const stamp=()=>new Date().toLocaleString('ko-KR'), uid=()=>crypto.randomUUID();
  const meta=old=>({updatedAt:stamp(),updatedBy:'시안 사용자'});
  const button=(label,action,id='',style='')=>'<button type="button" class="btn sm '+style+'" data-llm-action="'+action+'" data-id="'+esc(id)+'">'+label+'</button>';
  const input=(id,label,value='',placeholder='',type='text')=>'<div class="field"><label for="'+id+'">'+label+'</label><input class="input" id="'+id+'" type="'+type+'" value="'+esc(value??'')+'" placeholder="'+esc(placeholder)+'" maxlength="'+(type==='password'?4096:500)+'" autocomplete="off" /></div>';
  const select=(id,label,options,value='')=>'<div class="field"><label for="'+id+'">'+label+'</label><select class="select" id="'+id+'">'+options.map(o=>'<option value="'+esc(o.value)+'" '+(o.value===value?'selected ':'')+(o.disabled?'disabled':'')+'>'+esc(o.label)+'</option>').join('')+'</select></div>';
  const hint=v=>'<p class="field-hint">'+v+'</p>';
  const pair=(label,value)=>'<dt>'+label+'</dt><dd>'+esc(value||'확인 전')+'</dd>';
  const purposeText=m=>m.purposes.map(p=>C.purposes[p]).join(' · ');
  const keyLabel=c=>c.keyState==='reference'?'배포 키 참조':c.keyState==='demo'?'입력됨 (시안)':'미등록';
  function notify(message) { $('toast').textContent=message; $('toast').classList.add('open'); clearTimeout(timer); timer=setTimeout(()=>$('toast').classList.remove('open'),3800); }
  function commit(next,message) {
    state=C.normalize(next);
    let suffix=' (시안)'; try { localStorage.setItem(key,JSON.stringify(state)); } catch { suffix=' · 이 브라우저에서 저장할 수 없어 새로고침하면 초기화됩니다'; }
    render(); notify(message+suffix);
  }
  function close() {
    $('llmModal').classList.remove('open');$('llmBackdrop').classList.remove('open');$('llmModal').inert=true;
    $('llmMBody').replaceChildren();$('llmError').textContent='';callback=null;document.body.style.overflow='';
    if(returnFocus?.isConnected&&returnFocus.getClientRects().length&&!returnFocus.closest?.('[inert]'))returnFocus.focus();else $('lmAdd').focus();
  }
  function open(title,body,label,save) {
    returnFocus=document.activeElement;callback=save||null;
    $('llmMTitle').textContent=title;$('llmMBody').innerHTML=body;$('llmError').textContent='';
    $('llmCancel').textContent=save?'취소':'닫기';$('llmSave').textContent=label||'저장';$('llmSave').hidden=!save;$('llmModal').inert=false;
    $('llmModal').classList.add('open');$('llmBackdrop').classList.add('open');document.body.style.overflow='hidden';
    ($('llmMBody').querySelector('input,select,button:not(:disabled)')||$('llmModal').querySelector('[data-close]')).focus();
  }
  const val=id=>$(id)?.value.trim()||'';
  const numeric=id=>val(id)===''?null:Number(val(id));
  const providerFor=m=>state.providers.find(p=>p.uid===m?.providerUid);
  const usable=p=>C.runnable(p)&&p.check.status!=='failed';
  const modelsOf=id=>state.models.filter(m=>m.providerUid===id);
  const healthLabel=p=>p.keyState==='none'?'인증키 필요':p.check.status==='ok'?'성공':p.check.status==='failed'?'실패':'미확인';
  const rowEmpty=(message,n)=>'<tr><td colspan="'+n+'" class="llm-empty">'+message+'</td></tr>';
  function recentCheck(p){return '<span class="'+(p.check.status==='failed'||p.keyState==='none'?'llm-alert':'llm-muted')+'">'+esc(healthLabel(p))+'</span><small class="llm-secondary">'+esc(p.check.at||'확인 기록 없음')+'</small>';}
  function providerTargets(p){const names=[...new Set(C.providerUse(state,p.uid).map(r=>r.system))];return names.length?names.map(x=>'<span class="lp-target">'+esc(x)+'</span>').join(' '):'<span class="llm-muted">미지정</span>';}
  function render(){
    $('llmStorageNotice').textContent=storageNotice;$('llmStorageNotice').hidden=!storageNotice;
    const pending=state.models.filter(m=>!m.providerUid).length;
    $('lmLegacyHint').textContent=pending?'이전 미지정 모델 '+pending+'개는 프로바이더의 모델 관리에서 등록할 수 있습니다.':'';$('lmLegacyHint').hidden=!pending;
    const n=document.querySelector('#tab-llm .n');if(n)n.textContent=state.providers.length;
    let body='';
    for(const kind of ['reference','custom']){
      body+='<tr class="llm-group"><td colspan="8"><strong>'+(kind==='reference'?'Reference':'Custom')+'</strong>'+(kind==='reference'?'벤더 제공 프로바이더':'사용자 등록 프로바이더')+'</td></tr>';
      body+=state.providers.filter(p=>p.kind===kind).map(p=>'<tr data-provider="'+esc(p.uid)+'"><td><strong>'+esc(p.name)+'</strong></td><td class="llm-address mono">'+esc(p.endpoint)+'</td><td><span class="llm-key mono" title="'+esc(keyLabel(p))+'">'+esc(p.keyState==='none'?'미등록':p.keyMask||'****')+'</span><small class="llm-secondary">'+button('키관리','keys',p.uid)+'</small></td><td>'+button(p.enabled?'사용':'중지','provider-status',p.uid)+'</td><td>'+recentCheck(p)+'</td><td class="lp-targets">'+providerTargets(p)+'</td><td class="lt-note">'+esc(p.remark||'—')+'</td><td><div class="llm-actions">'+button('모델 관리 · '+modelsOf(p.uid).length,'models-manage',p.uid)+button('편집','provider-edit',p.uid)+button('설정 복사','provider-copy',p.uid)+(kind==='custom'?button('삭제','provider-delete',p.uid):'')+'</div></td></tr>').join('')||rowEmpty('등록된 프로바이더가 없습니다.',8);
    }
    $('lmConnections').innerHTML=body;
    $('ltRoutes').innerHTML=[...state.routes,...newRows].map(renderRoute).join('')||rowEmpty('대상시스템을 추가하고 프로바이더와 모델을 선택하세요.',5);
  }
  function routeStatus(r){const v=C.resolve(state,r);return '저장됨'+(v.status==='configured'?(v.provider.check.status==='unknown'?' · 연결 확인 전':''):' · '+v.reason);}
  function draftFor(r){return drafts.get(r.uid)||{system:r.system,purpose:r.purpose,providerUid:r.mode==='disabled'?'disabled':r.providerUid,modelUid:r.modelUid,remark:r.remark};}
  function renderRoute(r){
    const d=draftFor(r),p=state.providers.find(p=>p.uid===d.providerUid),m=state.models.find(m=>m.uid===d.modelUid),saved=state.routes.some(x=>x.uid===r.uid);
    let providers='<option value="" '+(!d.providerUid?'selected':'')+'>프로바이더 선택</option>';
    for(const kind of ['reference','custom'])providers+='<optgroup label="'+(kind==='reference'?'Reference':'Custom')+'">'+state.providers.filter(p=>p.kind===kind).map(p=>'<option value="'+esc(p.uid)+'" '+(d.providerUid===p.uid?'selected ':'')+(!usable(p)||!C.candidates(state,p.uid,d.purpose).length?'disabled':'')+'>'+esc(p.name+(!usable(p)?' · 사용 불가':!C.candidates(state,p.uid,d.purpose).length?' · 해당 용도 모델 없음':''))+'</option>').join('')+'</optgroup>';
    providers+='<option value="disabled" '+(d.providerUid==='disabled'?'selected':'')+'>사용 안 함</option>';
    const models='<option value="" '+(!d.modelUid?'selected':'')+'>모델 선택</option>'+C.candidates(state,d.providerUid,d.purpose).map(m=>'<option value="'+esc(m.uid)+'" '+(d.modelUid===m.uid?'selected':'')+'>'+esc(m.name)+'</option>').join('');
    const field=(name,label,html,extra='')=>'<label class="sr-only" for="rt'+name+'-'+r.uid+'">'+label+'</label>'+html+(extra?'<small class="llm-secondary" id="rt'+name+'Detail-'+r.uid+'">'+esc(extra)+'</small>':'');
    return '<tr data-route="'+esc(r.uid)+'"><td>'+field('System','대상시스템','<input class="input" id="rtSystem-'+r.uid+'" data-route-field="system" value="'+esc(d.system)+'" maxlength="200" placeholder="대상시스템 입력" />')+'<label class="lt-purpose" for="rtPurpose-'+r.uid+'">용도 <select class="select" id="rtPurpose-'+r.uid+'" data-route-field="purpose">'+Object.entries(C.purposes).map(([v,t])=>'<option value="'+v+'" '+(d.purpose===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label></td><td>'+field('Provider','프로바이더','<select class="select" id="rtProvider-'+r.uid+'" data-route-field="providerUid">'+providers+'</select>',p?.endpoint||(d.providerUid==='disabled'?'이 시스템에서 사용하지 않습니다.':'프로바이더를 먼저 선택하세요.'))+'</td><td>'+field('Model','모델','<select class="select" id="rtModel-'+r.uid+'" data-route-field="modelUid" '+(!p?'disabled':'')+'>'+models+'</select>',m?.providerUid===p?.uid?m?.requestModel||'모델 선택 필요':'모델 선택 필요')+'</td><td>'+field('Remark','비고','<input class="input" id="rtRemark-'+r.uid+'" data-route-field="remark" value="'+esc(d.remark)+'" maxlength="1000" placeholder="비고 입력" />')+'</td><td><div class="llm-actions">'+button('저장','route-save',r.uid,'primary')+button(saved?'삭제':'취소','route-delete',r.uid)+'</div><span class="lt-message '+(drafts.has(r.uid)?'dirty':'')+'" role="status" id="rtMessage-'+r.uid+'">'+(drafts.has(r.uid)?'저장 전':saved?esc(routeStatus(r)):'새 설정')+'</span></td></tr>';
  }
  function routeInput(e){
    const field=e.target.dataset?.routeField;if(!field)return;
    const id=e.target.closest('[data-route]')?.dataset.route,r=[...state.routes,...newRows].find(r=>r.uid===id);if(!r)return;
    const d={...draftFor(r),[field]:e.target.value};
    if(field==='providerUid')d.modelUid='';
    if(field==='purpose'&&!C.candidates(state,d.providerUid,d.purpose).some(m=>m.uid===d.modelUid))d.modelUid='';
    drafts.set(id,d);
    if(field==='providerUid'||field==='purpose'){render();$('rtModel-'+id).focus();return;}
    $('rtMessage-'+id).textContent='저장 전';$('rtMessage-'+id).className='lt-message dirty';
    if(field==='modelUid')$('rtModelDetail-'+id).textContent=state.models.find(m=>m.uid===d.modelUid)?.requestModel||'모델 선택 필요';
  }
  function saveRoute(id){
    const r=[...state.routes,...newRows].find(r=>r.uid===id);if(!r)return;
    const d=draftFor(r),next=C.copy(state),entry={uid:id,system:d.system.trim(),purpose:d.purpose,mode:d.providerUid==='disabled'?'disabled':'connection',providerUid:d.providerUid==='disabled'?'':d.providerUid,modelUid:d.providerUid==='disabled'?'':d.modelUid,remark:d.remark.trim(),...meta()};
    C.validateRoute(next,entry);
    const previous=state.routes.find(r=>r.uid===id),same=previous?.mode==='connection'&&previous.system===entry.system&&previous.purpose===entry.purpose&&previous.providerUid===entry.providerUid&&previous.modelUid===entry.modelUid;
    if(entry.mode==='connection'&&!same&&!usable(next.providers.find(p=>p.uid===entry.providerUid)))throw Error('사용 가능한 프로바이더를 선택하세요.');
    const index=next.routes.findIndex(r=>r.uid===id);if(index<0)next.routes.push(entry);else next.routes[index]=entry;
    drafts.delete(id);newRows=newRows.filter(r=>r.uid!==id);commit(next,'대상시스템의 프로바이더와 모델을 저장했습니다');
  }
  function usageList(p){const uses=C.providerUse(state,p.uid);return uses.length?'<ul class="llm-apilist">'+uses.map(r=>'<li>'+esc(r.system)+' · '+esc(C.purposes[r.purpose])+' · '+esc(state.models.find(m=>m.uid===r.modelUid)?.name)+'</li>').join('')+'</ul>':hint('지정된 대상시스템이 없습니다.');}
  function manageStatus(id){
    const p=state.providers.find(p=>p.uid===id);if(!p)return;
    open(p.name+' · 상태',select('lpStatus','사용 설정',[{value:'yes',label:'사용'},{value:'no',label:'중지'}],p.enabled?'yes':'no')+
      '<dl class="llm-key-summary">'+pair('최근 연결 확인',healthLabel(p))+pair('확인 시각',p.check.at||'확인 기록 없음')+(p.check.reason?pair('상세',p.check.reason):'')+'</dl>'+hint('이 시안에서는 실제 연결 확인을 수행하지 않습니다.')+'<h3>지정된 대상시스템</h3>'+usageList(p)+hint('중지하면 이 프로바이더의 모델을 사용하는 설정에서 호출할 수 없습니다.')+'<details class="llm-advanced"><summary>변경 정보</summary><dl class="llm-key-summary">'+pair('최종 수정일',p.updatedAt||'변경 기록 없음')+pair('최종 수정자',p.updatedBy||'변경 기록 없음')+'</dl></details>','상태 저장',()=>{
        const enabled=val('lpStatus')==='yes';if(enabled===p.enabled)return true;
        const next=C.copy(state),target=next.providers.find(p=>p.uid===id);target.enabled=enabled;Object.assign(target,meta());commit(next,enabled?'프로바이더 사용을 재개했습니다':'프로바이더를 중지했습니다');return true;
      });
  }
  function editProvider(id,copyFrom){
    const old=state.providers.find(p=>p.uid===id),p=old||copyFrom;
    open(old?'프로바이더 편집':p?'프로바이더 설정 복사':'프로바이더 등록',
      input('lpName','프로바이더명 *',old?.name||(p?p.name+' · 복사본':''),'예: 소프트웍스 LLM, 업무용 LLM')+
      input('lpEndpoint','엔드포인트 *',p?.endpoint||'','https://llm.example.com/v1','url')+
      input('lpKey','인증키'+(old&&old.keyState!=='none'?' · 비워두면 기존 키 유지':' *'),'','새 인증키 입력','password')+
      input('lpRemark','비고',p?.remark||'')+
      hint(p&&!old?'등록 모델과 설정을 복사합니다. 인증키와 대상시스템 지정은 복사하지 않습니다.':'주소를 변경하면 새 인증키를 입력하세요.')+
      (old&&C.providerUse(state,id).length?hint('변경 내용은 '+C.providerUse(state,id).length+'개 대상시스템 설정에 반영됩니다.'):''),
      '저장',()=>{
        const fresh=val('lpKey'),endpoint=val('lpEndpoint').replace(/\/+$/,'');
        if(!fresh&&!(old&&old.keyState!=='none'&&old.endpoint===endpoint))throw Error('인증키를 입력하세요. 주소를 변경하면 새 키가 필요합니다.');
        const entry={uid:old?.uid||uid(),name:val('lpName'),kind:old?.kind||'custom',endpoint,remark:val('lpRemark'),timeout:p?.timeout??null,enabled:p?.enabled!==false,keyState:fresh?'demo':old.keyState,keyMask:fresh?C.maskKey(fresh):old?.keyMask||'',keyUpdatedAt:fresh?stamp():old?.keyUpdatedAt||'',keyHistory:C.copy(old?.keyHistory||[]),check:C.unknownCheck(),...meta()};
        if(fresh)entry.keyHistory.push({at:entry.keyUpdatedAt,action:old&&old.keyState!=='none'?'교체':'등록'});entry.check=C.cleanCheck(entry,old,!!fresh);
        const next=C.copy(state);C.validateProvider(next,entry);
        if(old)next.providers[next.providers.findIndex(p=>p.uid===id)]=entry;else{next.providers.push(entry);if(copyFrom)for(const m of modelsOf(copyFrom.uid))next.models.push({...C.copy(m),uid:uid(),providerUid:entry.uid,kind:'custom',...meta()});}
        commit(next,'프로바이더를 저장했습니다');if(!old){modelManager(entry.uid);return false;}return true;
      });
  }
  function modelManager(id){
    const p=state.providers.find(p=>p.uid===id);if(!p)return;
    const list=modelsOf(id),pending=state.models.filter(m=>!m.providerUid);
    let body=hint(esc(p.endpoint))+'<div class="llm-actions">'+button('+ 모델 추가','model-add',id)+'</div>';
    body+=list.map(m=>'<div class="llm-catalog-row"><div><strong>'+esc(m.name)+'</strong><small class="llm-secondary mono">'+esc(m.requestModel)+'</small><small class="llm-secondary">'+esc(m.purposes.map(x=>C.purposes[x]).join(' · '))+'</small></div><div class="llm-actions">'+button('정보','model-detail',m.uid)+button('설정 복사','model-copy',m.uid)+(m.kind==='custom'?button('편집','model-edit',m.uid)+button('삭제','model-delete',m.uid):'')+'</div></div>').join('')||hint('등록된 모델이 없습니다.');
    if(pending.length)body+='<h3>이전 미지정 모델</h3>'+pending.map(m=>'<div class="llm-catalog-row"><strong>'+esc(m.name)+'</strong><button type="button" class="btn sm" data-llm-action="model-place" data-id="'+esc(m.uid)+'" data-provider="'+esc(id)+'">이 프로바이더에 등록</button></div>').join('');
    open(p.name+' · 모델 관리',body,'',null);
  }
  function editModel(id,copyFrom,providerUid){
    const old=state.models.find(m=>m.uid===id);if(old?.providerUid&&old.kind==='reference')return;
    const source=old||copyFrom,p=state.providers.find(p=>p.uid===(providerUid||source?.providerUid));if(!p)return;
    open(p.name+' · '+(old?'모델 편집':copyFrom?'모델 설정 복사':'모델 추가'),
      input('lmName','모델명 *',old?.name||(source?source.name+' · 복사본':''))+
      input('lmRequest','요청 모델 ID *',source?.requestModel||'','예: poc-gemma4-26b-nothink')+
      '<div class="field"><span class="flabel">지원 용도 *</span><div class="llm-checks">'+Object.entries(C.purposes).map(([v,t])=>'<label><input type="checkbox" name="lmPurpose" value="'+v+'" '+((source?.purposes||['chat']).includes(v)?'checked':'')+' /> '+t+'</label>').join('')+'</div></div>',
      '저장',()=>{
        const m={uid:old?.uid||uid(),providerUid:p.uid,name:val('lmName'),requestModel:val('lmRequest'),kind:'custom',purposes:Array.from(document.querySelectorAll('input[name="lmPurpose"]:checked')).map(e=>e.value),features:source?.features||'미확인',contextTokens:source?.contextTokens??null,maxOutput:source?.maxOutput??null,...meta()};
        const next=C.copy(state);C.validateModel(next,m);
        if(old)next.models[next.models.findIndex(m=>m.uid===id)]=m;else next.models.push(m);
        next.providers.find(x=>x.uid===p.uid).check=C.unknownCheck();commit(next,'프로바이더의 모델을 저장했습니다');modelManager(p.uid);return false;
      });
  }
  function showModel(id){
    const m=state.models.find(m=>m.uid===id);if(!m)return;const p=providerFor(m),uses=C.useCount(state,id);
    open(m.name+' · 모델 정보','<dl class="llm-key-summary">'+pair('프로바이더',p?.name)+pair('모델 ID',m.requestModel)+pair('지원 용도',m.purposes.map(x=>C.purposes[x]).join(' · '))+pair('사용 대상시스템',uses.map(r=>r.system).join(', ')||'미지정')+'</dl><div class="llm-actions">'+button('모델 목록','models-manage',p.uid)+'</div>','',null);
  }
  function removeEntity(type,id){
    const item=state[type].find(x=>x.uid===id);if(!item||item.kind==='reference')return;
    const uses=type==='providers'?C.providerUse(state,id):C.useCount(state,id);
    if(uses.length){open('사용 중인 설정',hint('대상시스템에서 사용 중입니다. 하단에서 모델을 변경하거나 사용 안 함으로 저장한 후 삭제하세요.'),'',null);return;}
    const p=type==='models'?providerFor(item):null;
    open(type==='providers'?'프로바이더 삭제':'모델 삭제','<p><b>'+esc(item.name)+'</b>을 삭제할까요?</p>'+(type==='providers'?hint('등록된 모델도 함께 삭제합니다.'):''),'삭제',()=>{
      const next=C.copy(state);next[type]=next[type].filter(x=>x.uid!==id);if(type==='providers')next.models=next.models.filter(m=>m.providerUid!==id);else next.providers.find(x=>x.uid===p.uid).check=C.unknownCheck();
      commit(next,'설정을 삭제했습니다');if(p){modelManager(p.uid);return false;}return true;
    });
  }
  function manageKey(id){
    const p=state.providers.find(p=>p.uid===id);if(!p)return;
    const registered=p.keyHistory.find(e=>e.action==='등록');
    open(p.name+' · 인증키 관리','<dl class="llm-key-summary">'+pair('프로바이더',p.name)+pair('키 상태',keyLabel(p))+pair('키 (마스킹)',p.keyState==='none'?'등록된 키 없음':p.keyMask||'****')+(p.keyState==='reference'?pair('키 참조','oap-llm Secret · 원문 미조회'):'')+pair('등록일',registered?.at||'기록 없음')+pair('최종 변경일',p.keyUpdatedAt||'기록 없음')+'</dl><div class="llm-actions">'+button(p.keyState==='none'?'키 등록':'키 교체','key-edit',id)+(p.keyState!=='none'?button('키 삭제','key-delete',id):'')+'</div><h3>변경 이력</h3>'+(p.keyHistory.length?'<table class="llm-key-history"><thead><tr><th>시각</th><th>내용</th></tr></thead><tbody>'+p.keyHistory.slice().reverse().map(e=>'<tr><td>'+esc(e.at)+'</td><td>'+esc(e.action)+'</td></tr>').join('')+'</tbody></table>':hint('이 시안에서 기록한 이력이 없습니다.')),'',null);
  }
  function editKey(id){
    const p=state.providers.find(p=>p.uid===id),action=p.keyState==='none'?'등록':'교체';
    open(p.name+' · 인증키 '+action,input('lkNew','새 인증키 *','','시안 확인용 값','password')+hint('마스킹 표시만 보관하며 원문은 저장·전송하지 않습니다.'),'키 '+action,()=>{
      if(!val('lkNew'))throw Error('인증키를 입력하세요.');const next=C.copy(state),p=next.providers.find(p=>p.uid===id);p.keyState='demo';p.keyMask=C.maskKey(val('lkNew'));p.keyUpdatedAt=stamp();p.keyHistory.push({at:p.keyUpdatedAt,action});p.check=C.unknownCheck();Object.assign(p,meta());commit(next,'인증키를 '+action+'했습니다');return true;
    });
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-close]')){close();return;}
    const b=e.target.closest('[data-llm-action]');if(!b)return;
    const id=b.dataset.id,a=b.dataset.llmAction;
    if(a==='provider-add')editProvider();if(a==='provider-edit')editProvider(id);if(a==='provider-copy')editProvider(undefined,state.providers.find(p=>p.uid===id));if(a==='provider-delete')removeEntity('providers',id);if(a==='provider-status')manageStatus(id);
    if(a==='models-manage')modelManager(id);if(a==='model-add')editModel(undefined,undefined,id);if(a==='model-edit')editModel(id);if(a==='model-copy')editModel(undefined,state.models.find(m=>m.uid===id));if(a==='model-place')editModel(id,undefined,b.dataset.provider);if(a==='model-detail')showModel(id);if(a==='model-delete')removeEntity('models',id);
    if(a==='keys')manageKey(id);if(a==='key-edit')editKey(id);
    if(a==='key-delete'){
      const p=state.providers.find(p=>p.uid===id);open('인증키 삭제','<p><b>'+esc(p.name)+'</b>의 인증키를 삭제할까요?</p>'+hint('영향받는 대상시스템 설정 '+C.providerUse(state,id).length+'개. 다시 등록할 때까지 호출할 수 없습니다.'),'키 삭제',()=>{const next=C.copy(state),p=next.providers.find(p=>p.uid===id);p.keyState='none';p.keyMask='';p.keyUpdatedAt=stamp();p.keyHistory.push({at:p.keyUpdatedAt,action:'삭제'});p.check=C.unknownCheck();Object.assign(p,meta());commit(next,'인증키를 삭제했습니다');return true;});
    }
    if(a==='route-add'){const r={uid:uid(),system:'',purpose:'chat',providerUid:'',modelUid:'',mode:'unresolved',remark:''};newRows.push(r);render();$('rtSystem-'+r.uid).focus();}
    if(a==='route-save'){try{saveRoute(id);}catch(e){$('rtMessage-'+id).textContent=e.message;$('rtMessage-'+id).className='lt-message error';}}
    if(a==='route-delete'){
      const r=state.routes.find(r=>r.uid===id);if(!r){drafts.delete(id);newRows=newRows.filter(r=>r.uid!==id);render();}
      else open('대상시스템 설정 삭제','<p><b>'+esc(r.system)+'</b>의 '+esc(C.purposes[r.purpose])+' 설정을 삭제할까요?</p>','삭제',()=>{const next=C.copy(state);next.routes=next.routes.filter(r=>r.uid!==id);drafts.delete(id);commit(next,'대상시스템 설정을 삭제했습니다');return true;});
    }
  });
  document.addEventListener('input',routeInput);document.addEventListener('change',routeInput);
  $('llmForm').addEventListener('submit',e=>{e.preventDefault();try{if(callback?.()===true)close();}catch(e){$('llmError').textContent=e.message;}});
  $('llmBackdrop').addEventListener('click',close);
  document.addEventListener('keydown',e=>{
    if(!$('llmModal').classList.contains('open'))return;if(e.key==='Escape'){close();return;}
    if(e.key==='Tab'){const items=Array.from($('llmModal').querySelectorAll('input,select,button,summary')).filter(x=>!x.disabled&&x.getClientRects().length),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  render();
})();
