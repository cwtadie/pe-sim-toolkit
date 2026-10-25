(function(){
 'use strict';
 const M=window.BuckModel,$=id=>document.getElementById(id);
 const fields=[['Vg','输入电压','Vg','V',1,6,48,1],['D','占空比','d','',1,.05,.95,.01],['L','电感','L','µH',1e6,22,2200,1],['C','电容','C','µF',1e6,47,2200,1],['R','负载电阻','R','Ω',1,1,100,1],['fs','开关频率','fs','kHz',.001,20,100,1]];
 const questions=[
 {q:'输入 24 V，占空比 0.4。CCM 下的平均输出电压是多少？',options:['24 V','9.6 V','0.4 V','60 V'],answer:1,steps:'稳态电感伏秒平衡：0 = D(Vg−V) + (1−D)(−V)。整理得到 V = DVg = 0.4 × 24 = 9.6 V。',wrong:'输出工作点由占空比乘输入电压决定；不要把除法当作降压关系。'},
 {q:'开关断开、电感仍在续流时，电感电压是多少？',options:['Vg−v','0','−v','Vg'],answer:2,steps:'续流二极管导通，将电感左端钳在 0 V；电感右端是输出 v。按左正右负：vL = 0−v = −v。',wrong:'二极管使电感左端为零，不代表电感两端电压为零。'},
 {q:'电容电流如何表示？',options:['iL + v/R','v/R','iL−v/R','−iL'],answer:2,steps:'在输出节点列 KCL：iL = iC + iR，且 iR = v/R，所以 iC = iL−v/R。',wrong:'电容只承担电感电流与负载电流的差值；平均 iC 为零时，瞬时 iC 仍可能不为零。'},
 {q:'默认工作点下，占空比到输出电压的直流增益 Gvd(0) 是多少？',options:['9.6 V / 单位占空比','24 V / 单位占空比','0.4 V / 单位占空比','1.92 A / 单位占空比'],answer:1,steps:'Gvd(0) = dV/dD。由 V = DVg，在 Vg 固定时求导得到 Vg = 24 V / 单位占空比。',wrong:'9.6 V 是工作点，不是对占空比求导得到的斜率。'},
 {q:'占空比从 0.40 增加到 0.41，CCM 稳态输出大约增加多少？',options:['0.01 V','0.096 V','0.24 V','24 V'],answer:2,steps:'Δd = 0.41−0.40 = 0.01。ΔV = Gvd(0)Δd = 24 × 0.01 = 0.24 V。新输出为 9.84 V。',wrong:'增加 1 个百分点是 0.01，而不是 1；增益要乘扰动量才是电压变化。'},
 {q:'保持其他条件不变，L 或 C 增大，固有频率 f₀ 会怎样？',options:['增大','减小','不变','等于开关频率'],answer:1,steps:'f₀ = 1/(2π√LC)。L 或 C 增大使分母增大，所以 f₀ 减小。两者同时翻倍时 f₀ 减半。',wrong:'固有频率取决于 L、C，不由开关频率直接指定。'},
 {q:'轻载下 iL 降到零，并持续一段时间。哪种处理正确？',options:['继续积分成负电流','继续保证 V = DVg','进入零电流状态，并重新求稳态','把负载电阻设为零'],answer:2,steps:'二极管不能提供反向续流。iL = 0 后进入第三状态，电容独自放电：C dv/dt = −v/R。这是 DCM，原来的两状态 CCM 公式不适用。',wrong:'不能为了匹配 CCM 公式而允许二极管反向电流；应该更换适用模型。'},
 {q:'平均模型输出是直线，开关模型有纹波，说明什么？',options:['一定有一个程序出错','平均模型消去了周期内的开关细节','理想电容电压完全不能变化','实际电路不会有纹波'],answer:1,steps:'平均模型描述周期平均量和慢动态；开关模型保留周期内的能量交换。稳态平均值一致但瞬时波形不同，是正常的模型层次差异。',wrong:'区分瞬时值和平均值。理想电容满足 iC = C dv/dt，允许连续变化，只是不允许电压瞬时跳变。'}
 ];
 let result,pending=0,circuitState=0,graded=false;
 fields.forEach(f=>{
   const div=document.createElement('div');div.className='control-field';
   div.innerHTML='<div class="input-top"><label for="num-'+f[0]+'">'+f[1]+' <span class="symbol">'+f[2]+'</span></label><div class="number-wrap"><input type="number" id="num-'+f[0]+'" min="'+f[5]+'" max="'+f[6]+'" step="'+f[7]+'" value="'+M.defaults[f[0]]*f[4]+'" inputmode="decimal"><span>'+f[3]+'</span></div></div><input type="range" aria-label="'+f[1]+'滑块" id="range-'+f[0]+'" min="'+f[5]+'" max="'+f[6]+'" step="'+f[7]+'" value="'+M.defaults[f[0]]*f[4]+'"><div class="range-labels"><span>'+f[5]+' '+f[3]+'</span><span>'+f[6]+' '+f[3]+'</span></div>';
   $('parameter-fields').appendChild(div);
   $('num-'+f[0]).addEventListener('input',()=>{const v=$('num-'+f[0]).valueAsNumber;if(Number.isFinite(v)&&v>=f[5]&&v<=f[6])$('range-'+f[0]).value=v;schedule();});
   $('range-'+f[0]).addEventListener('input',()=>{$('num-'+f[0]).value=$('range-'+f[0]).value;schedule();});
 });
 function schedule(){clearTimeout(pending);pending=setTimeout(update,70);}
 function read(){const p={};fields.forEach(f=>{const el=$('num-'+f[0]),v=el.valueAsNumber;if(!Number.isFinite(v)||v<f[5]||v>f[6])throw new Error(f[1]+'须在 '+f[5]+'–'+f[6]+' '+f[3]+' 之间。');p[f[0]]=v/f[4];});return p;}
 function set(p){fields.forEach(f=>{$('num-'+f[0]).value=+(p[f[0]]*f[4]).toPrecision(10);$('range-'+f[0]).value=p[f[0]]*f[4];});update();}
 function fmt(n,d){return n.toLocaleString('zh-CN',{maximumFractionDigits:d===undefined?3:d,minimumFractionDigits:0});}
 function update(){
  try{
   const p=read();result=M.simulate(p);$('input-error').hidden=true;const m=result.metrics;
   $('voltage-value').innerHTML=fmt(m.Vmean,3)+'<em>V</em>';$('current-value').innerHTML=fmt(m.Imean,3)+'<em>A</em>';
   $('voltage-detail').textContent=m.mode==='CCM'?'CCM 预测 '+fmt(m.Vccm)+' V · 误差 '+fmt(Math.abs(m.Vmean/m.Vccm-1)*100,5)+'%':'CCM 公式 '+fmt(m.Vccm)+' V，当前不适用';
   $('current-detail').textContent='电压峰峰纹波 '+fmt(m.deltaV*1000,2)+' mV';
   $('mode-value').textContent=m.mode;$('mode-detail').textContent=m.mode==='CCM'?'连续导通 · 电流始终大于零':'断续导通 · 零电流占 '+fmt(m.zeroFraction*100,1)+'%';
   $('mode-notice').classList.toggle('warning',m.mode==='DCM');
   $('mode-notice').textContent=m.mode==='CCM'?'观察重点：平均值几乎重合，周期内的纹波仍然存在。当前为 CCM，V = DVg 可用于核对稳态。':'当前为 DCM：电流在周期内保持零一段时间。V = DVg 和下方 CCM 小信号模型不适用；虚线仅作对照。';
   $('ripple-label').textContent='峰峰纹波 '+fmt(m.deltaI,3)+' A';
   $('f0-tag').textContent='f₀ '+fmt(m.f0,2)+' Hz · Q '+fmt(m.Q,2);
   $('bode-notice').classList.toggle('warning',m.mode==='DCM');
   $('bode-notice').textContent=m.mode==='CCM'?'输入为占空比小扰动，输出为电压小扰动；在工作点附近使用。高频阴影区域请勿用于预测实际开关电路。':'当前 DCM：以下仅保留 CCM 数学参照，不能解释此工作点的真实增益和相位。';
   $('diagram-vg').textContent=fmt(p.Vg)+' V';$('diagram-l').textContent=fmt(p.L*1e6)+' µH';$('diagram-c').textContent=fmt(p.C*1e6)+' µF';$('diagram-r').textContent=fmt(p.R)+' Ω';
   $('wave-readout').textContent='在曲线上移动，查看某一时刻的数值。';updateCircuit();drawAll();
   ['export-params','export-wave','export-bode'].forEach(id=>$(id).disabled=false);
   window.dispatchEvent(new Event('buck:updated'));
  }catch(e){$('input-error').textContent=e.message+' 波形保留上一次有效结果。';$('input-error').hidden=false;['export-params','export-wave','export-bode'].forEach(id=>$(id).disabled=true);}
 }
 function updateCircuit(){
  const captions=['开关闭合：电感电压为 Vg − v，输入向电感和负载供能。','开关断开、二极管续流：电感电压为 −v，电感继续给负载供电。','零电流区间：二极管关断，电容独自供电；只在 DCM 稳态中出现。'];
  if(result.metrics.mode==='CCM'&&circuitState===2)circuitState=0;
  const paths=['M55 65 H125 M190 65 H245 M335 65 H510 V91 M510 125 V150 H55 V112','M211 129 V150 H510 V125 M510 91 V65 H335 M245 65 H211 V103','M395 65 H510 V91 M510 125 V150 H395'];
  $('active-path').setAttribute('d',paths[circuitState]);$('switch-arm').setAttribute('d',circuitState===0?'M125 65 L190 65':'M125 65 L180 43');
  $('circuit-caption').textContent=captions[circuitState];$('circuit-title').textContent=captions[circuitState];
  $('circuit-next').textContent=circuitState===0?'切换到续流 →':circuitState===1&&result.metrics.mode==='DCM'?'看看零电流区间 →':'返回导通状态 →';
 }
 function ns(tag,attrs,text){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.keys(attrs||{}).forEach(k=>e.setAttribute(k,attrs[k]));if(text!==undefined)e.textContent=text;return e;}
 function plot(id,data,options){
  const box=$(id);box.replaceChildren();const w=Math.max(240,Math.floor(box.getBoundingClientRect().width)),h=box.clientHeight,pad={l:59,r:15,t:18,b:37};
  const x0=options.log?Math.log10(data[0].x):data[0].x,x1=options.log?Math.log10(data[data.length-1].x):data[data.length-1].x;
  let ymin=Infinity,ymax=-Infinity;data.forEach(r=>{ymin=Math.min(ymin,r.y,options.ref===undefined?r.y:options.ref);ymax=Math.max(ymax,r.y,options.ref===undefined?r.y:options.ref);});
  if(options.zero)ymin=Math.min(0,ymin);
  const span=Math.max(ymax-ymin,Math.abs(ymax)*.001,1e-5);ymin-=span*.17;ymax+=span*.17;
  if(options.zero)ymin=Math.max(0,ymin);
  const sx=x=>pad.l+((options.log?Math.log10(x):x)-x0)/(x1-x0)*(w-pad.l-pad.r),sy=y=>h-pad.b-(y-ymin)/(ymax-ymin)*(h-pad.t-pad.b);
  const svg=ns('svg',{viewBox:'0 0 '+w+' '+h,role:'img','aria-label':options.title});svg.appendChild(ns('title',{},options.title));
  const unique=id+'-clip',defs=ns('defs'),clip=ns('clipPath',{id:unique});clip.appendChild(ns('rect',{x:pad.l,y:pad.t,width:w-pad.l-pad.r,height:h-pad.t-pad.b}));defs.appendChild(clip);svg.appendChild(defs);
  if(options.shade&&options.shade<data[data.length-1].x){const start=Math.max(pad.l,sx(options.shade));svg.appendChild(ns('rect',{x:start,y:pad.t,width:w-pad.r-start,height:h-pad.t-pad.b,fill:'#f4e7d5',opacity:'.65'}));}
  const tickCount=4,decimals=Math.max(0,Math.min(5,Math.ceil(-Math.log10((ymax-ymin)/tickCount))+1));
  for(let j=0;j<=tickCount;j++){const v=ymin+(ymax-ymin)*j/tickCount,y=sy(v);svg.appendChild(ns('line',{x1:pad.l,y1:y,x2:w-pad.r,y2:y,class:'grid'}));svg.appendChild(ns('text',{x:pad.l-9,y:y+4,'text-anchor':'end',class:'axis'},fmt(v,decimals)));}
  const nx=w<450?3:5;
  for(let j=0;j<nx;j++){const raw=x0+(x1-x0)*j/(nx-1),v=options.log?Math.pow(10,raw):raw,x=sx(v);svg.appendChild(ns('text',{x:x,y:h-16,'text-anchor':j===0?'start':j===nx-1?'end':'middle',class:'axis'},options.log?fmt(v,v<10?1:0):fmt(v,1)));}
  svg.appendChild(ns('text',{x:pad.l,y:11,class:'axis'},options.yUnit));svg.appendChild(ns('text',{x:w-pad.r,y:h-1,'text-anchor':'end',class:'axis'},options.xUnit));
  const traces=ns('g',{'clip-path':'url(#'+unique+')'});if(options.ref!==undefined)traces.appendChild(ns('path',{d:'M'+pad.l+' '+sy(options.ref)+' H'+(w-pad.r),class:'reference'}));
  traces.appendChild(ns('path',{d:data.map((r,j)=>(j?'L':'M')+sx(r.x).toFixed(2)+' '+sy(r.y).toFixed(2)).join(' '),class:options.referenceOnly?'reference':'trace'}));svg.appendChild(traces);
  if(options.gate){for(let k=0;k<3;k++){const left=sx(k*options.period),right=sx((k+result.parameters.D)*options.period);svg.appendChild(ns('rect',{x:left,y:h-pad.b+1,width:right-left,height:4,fill:'#9bbd9d'}));}}
  svg.appendChild(ns('rect',{x:pad.l,y:pad.t,width:w-pad.l-pad.r,height:h-pad.t-pad.b,class:'frame'}));
  const cursor=ns('line',{x1:pad.l,x2:pad.l,y1:pad.t,y2:h-pad.b,class:'cursor',visibility:'hidden'});svg.appendChild(cursor);
  const hit=ns('rect',{x:pad.l,y:pad.t,width:w-pad.l-pad.r,height:h-pad.t-pad.b,fill:'transparent'});
  hit.addEventListener('pointermove',event=>{const r=svg.getBoundingClientRect(),px=(event.clientX-r.left)*w/r.width,xv=x0+(px-pad.l)/(w-pad.l-pad.r)*(x1-x0),x=options.log?Math.pow(10,xv):xv;cursor.setAttribute('x1',px);cursor.setAttribute('x2',px);cursor.setAttribute('visibility','visible');let lo=0,hi=data.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(data[mid].x<x)lo=mid;else hi=mid;}const a=data[lo],b=data[hi],y=a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x||1);$('wave-readout').textContent=options.title+' · '+fmt(x,2)+' '+options.xUnit+' → '+fmt(y,5)+' '+options.yUnit+(options.ref!==undefined?'；CCM 参照 '+fmt(options.ref,4)+' '+options.yUnit:'');});
  hit.addEventListener('pointerleave',()=>cursor.setAttribute('visibility','hidden'));svg.appendChild(hit);box.appendChild(svg);
 }
 function drawAll(){if(!result||$('lab').hidden)return;const p=result.parameters,m=result.metrics,repeat=[];for(let k=0;k<3;k++)result.rows.forEach((r,j)=>{if(k&&j===0)return;repeat.push({x:(r.t_s+k/p.fs)*1e6,v:r.v_sw_V,i:r.i_sw_A});});
  plot('voltage-chart',repeat.map(r=>({x:r.x,y:r.v})),{title:'输出电压',xUnit:'µs',yUnit:'V',ref:m.Vccm,zero:!$('zoom-voltage').checked,gate:true,period:1e6/p.fs});
  plot('current-chart',repeat.map(r=>({x:r.x,y:r.i})),{title:'电感电流',xUnit:'µs',yUnit:'A',ref:m.ILccm,zero:true,gate:true,period:1e6/p.fs});
  const freq=M.frequency(p);plot('gain-chart',freq.map(r=>({x:r.f_Hz,y:r.gain_dB})),{title:'幅频响应',xUnit:'Hz（对数）',yUnit:'dB',log:true,shade:p.fs/10,referenceOnly:m.mode==='DCM'});plot('phase-chart',freq.map(r=>({x:r.f_Hz,y:r.phase_deg})),{title:'相频响应',xUnit:'Hz（对数）',yUnit:'°',log:true,shade:p.fs/10,referenceOnly:m.mode==='DCM'});
  window.dispatchEvent(new Event('buck:drawn'));
 }
 function download(name,body,type){if(!$('input-error').hidden)return;const url=URL.createObjectURL(new Blob([body],{type:type||'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 $('export-params').addEventListener('click',()=>{update();download('buck-parameters.json',JSON.stringify(result.parameters,null,2),'application/json');});
 $('export-wave').addEventListener('click',()=>{update();download('buck-waveforms.csv',M.csv(result),'text/csv');});
 $('export-bode').addEventListener('click',()=>{update();download('buck-frequency.csv','f_Hz,gain_dB,phase_deg\r\n'+M.frequency(result.parameters).map(r=>[r.f_Hz,r.gain_dB,r.phase_deg].join(',')).join('\r\n'),'text/csv');});
 $('parameters').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(pending);update();}});
 $('parameters').addEventListener('submit',e=>{e.preventDefault();clearTimeout(pending);update();});
 $('import-json').addEventListener('click',()=>$('import-file').click());
 $('import-file').addEventListener('change',async()=>{const file=$('import-file').files[0];if(!file)return;try{const p=JSON.parse(await file.text());M.validate(p);clearTimeout(pending);set(p);$('import-status').textContent='已载入 '+file.name+'；数值已换算为界面单位。';}catch(e){$('import-status').textContent='载入失败：'+e.message+' 当前参数保持原值。';}$('import-file').value='';});
 $('reset').addEventListener('click',()=>{clearTimeout(pending);circuitState=0;$('import-status').textContent='';set(M.defaults);});$('light-load').addEventListener('click',()=>{clearTimeout(pending);set(Object.assign({},M.defaults,{L:22e-6,R:100}));});$('zoom-voltage').addEventListener('change',drawAll);
 $('circuit-next').addEventListener('click',()=>{circuitState=(circuitState+1)%(result.metrics.mode==='DCM'?3:2);updateCircuit();});
 const tabs=Array.from(document.querySelectorAll('[role=tab]'));
 function tab(id){tabs.forEach(el=>{const active=el.getAttribute('aria-controls')===id;el.setAttribute('aria-selected',String(active));el.classList.toggle('active',active);$(el.getAttribute('aria-controls')).hidden=!active;});window.dispatchEvent(new Event('buck:tab'));if(id==='lab')drawAll();}
 tabs.forEach((el,j)=>{el.addEventListener('click',()=>tab(el.getAttribute('aria-controls')));el.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=tabs[(j+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];next.focus();tab(next.getAttribute('aria-controls'));}});});$('go-quiz').addEventListener('click',()=>{tab('quiz');$('tab-quiz').focus();});
 questions.forEach((q,j)=>{const article=document.createElement('article');article.className='question';article.id='question-'+j;const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.innerHTML='<span class="q-number">QUESTION '+String(j+1).padStart(2,'0')+'</span>'+q.q;field.appendChild(legend);q.options.forEach((text,k)=>{const label=document.createElement('label');label.className='choice';const radio=document.createElement('input');radio.type='radio';radio.name='q'+j;radio.value=k;label.appendChild(radio);label.appendChild(document.createTextNode(String.fromCharCode(65+k)+'　'+text));field.appendChild(label);});article.appendChild(field);const exp=document.createElement('div');exp.className='explanation';exp.hidden=true;exp.id='answer-'+j;exp.innerHTML='<strong>答案：'+String.fromCharCode(65+q.answer)+' · '+q.options[q.answer]+'</strong><p>步骤与公式：'+q.steps+'</p><p>错误与避免：'+q.wrong+'</p>';article.appendChild(exp);$('quiz-items').appendChild(article);});
 function hideAnswers(){questions.forEach((q,j)=>{$('answer-'+j).hidden=true;$('question-'+j).classList.remove('correct','incorrect');});graded=false;$('quiz-score').innerHTML='还没提交<br><small>理解比速度重要</small>';}
 $('quiz-form').addEventListener('submit',e=>{e.preventDefault();const answers=questions.map((q,j)=>document.querySelector('input[name="q'+j+'"]:checked'));if(answers.some(x=>!x)){$('quiz-message').textContent='还有 '+answers.filter(x=>!x).length+' 道题未选择，请先完成作答。';const missing=answers.findIndex(x=>!x);$('question-'+missing).querySelector('input').focus();return;}let score=0;questions.forEach((q,j)=>{const ok=Number(answers[j].value)===q.answer;if(ok)score++;$('question-'+j).classList.toggle('correct',ok);$('question-'+j).classList.toggle('incorrect',!ok);$('answer-'+j).hidden=false;});graded=true;$('quiz-score').innerHTML=score+' / 8<br><small>'+ (score===8?'全部答对，试着合上笔记复述。':'看懂解析，再用自己的话重讲一次。')+'</small>';$('quiz-message').textContent='已显示全部解析；共答对 '+score+' 题。';});
 $('quiz-form').addEventListener('change',()=>{if(graded){hideAnswers();$('quiz-message').textContent='答案已更改，请重新提交。';}});$('quiz-reset').addEventListener('click',()=>{$('quiz-form').reset();hideAnswers();$('quiz-message').textContent='已清空选择和解析。';});
 let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(drawAll,120);});
 window.BuckLab={get result(){return result;},get circuitState(){return circuitState;},setCircuitState(state){circuitState=state;updateCircuit();},refreshParameters:update,setParameters:set,showTab:tab};update();
})();
