(function(){
 'use strict';
 const M=window.BoostModel,$=id=>document.getElementById(id),fmt=(v,n=3)=>v.toLocaleString('zh-CN',{maximumFractionDigits:n});
 const fields=[['Vg','输入电压','V',1,6,48,1],['D','占空比','',1,.1,.7,.01],['L','电感','µH',1e6,47,2200,1],['C','电容','µF',1e6,100,2200,1],['R','负载电阻','Ω',1,5,200,1],['fs','开关频率','kHz',.001,20,100,1]];
 let result,transient=null,pending=0,phase=10,frame=0,stepPrediction=null;
 fields.forEach(f=>{
  const div=document.createElement('div');div.className='control-field';
  div.innerHTML='<div class="input-top"><label for="b-num-'+f[0]+'">'+f[1]+' <span class="symbol">'+f[0]+'</span></label><div class="number-wrap"><input type="number" id="b-num-'+f[0]+'" min="'+f[4]+'" max="'+f[5]+'" step="'+f[6]+'" value="'+M.defaults[f[0]]*f[3]+'" inputmode="decimal"><span>'+f[2]+'</span></div></div><input type="range" id="b-range-'+f[0]+'" aria-label="Boost '+f[1]+'滑块" min="'+f[4]+'" max="'+f[5]+'" step="'+f[6]+'" value="'+M.defaults[f[0]]*f[3]+'"><div class="range-labels"><span>'+f[4]+' '+f[2]+'</span><span>'+f[5]+' '+f[2]+'</span></div>';
  $('b-fields').appendChild(div);
  $('b-num-'+f[0]).addEventListener('input',()=>{const v=$('b-num-'+f[0]).valueAsNumber;if(Number.isFinite(v)&&v>=f[4]&&v<=f[5])$('b-range-'+f[0]).value=v;schedule();});
  $('b-range-'+f[0]).addEventListener('input',()=>{$('b-num-'+f[0]).value=$('b-range-'+f[0]).value;schedule();});
 });
 function schedule(){clearTimeout(pending);pending=setTimeout(update,70);}
 function read(){const p={};fields.forEach(f=>{const v=$('b-num-'+f[0]).valueAsNumber;if(!Number.isFinite(v)||v<f[4]||v>f[5])throw new Error(f[1]+'须在 '+f[4]+'–'+f[5]+' '+f[2]+' 之间。');p[f[0]]=v/f[3];});return p;}
 function invalidateStep(){transient=null;$('b-step-plots').hidden=true;$('b-export-step').disabled=true;}
 function set(p){clearTimeout(pending);invalidateStep();fields.forEach(f=>{$('b-num-'+f[0]).value=+(p[f[0]]*f[3]).toPrecision(10);$('b-range-'+f[0]).value=p[f[0]]*f[3];});update();}
 function stepAvailability(){
  const valid=$('b-error').hidden&&result&&result.metrics.mode==='CCM'&&result.parameters.D+.02<=.7+1e-12;
  $('b-run-step').disabled=!valid||stepPrediction===null;
  if(!transient)$('b-step-notice').textContent=!valid?'当前工况不适合 CCM 正阶跃演示（需有效参数、前后 CCM、最终 D≤0.70）。请恢复默认演示工况。':stepPrediction===null?'请先选择预测，再运行真实的时间响应。':'已记录预测。运行时将在 t=0 把占空比从 '+fmt(result.parameters.D,2)+' 增到 '+fmt(result.parameters.D+.02,2)+'。';
 }
 function update(){
  stop();
  try{
   const pnext=read();if(!result||Object.keys(pnext).some(k=>pnext[k]!==result.parameters[k]))invalidateStep();result=M.simulate(pnext);$('b-error').hidden=true;
   const p=result.parameters,m=result.metrics;$('b-v').innerHTML=fmt(m.Vmean)+'<em>V</em>';$('b-i').innerHTML=fmt(m.IinMean)+'<em>A</em>';$('b-mode').textContent=m.mode;
   $('b-v-detail').textContent=m.mode==='CCM'?'CCM 预测 '+fmt(m.Vccm)+' V · 偏差 '+fmt(Math.abs(m.Vmean/m.Vccm-1)*100,4)+'%':'Vg/(1−D)='+fmt(m.Vccm)+' V，当前不适用';
   $('b-i-detail').textContent='输出负载平均电流 '+fmt(m.IoutMean)+' A';$('b-mode-detail').textContent=m.mode==='CCM'?'连续导通 · iL 未触零':'零电流区间 '+fmt(m.zeroFraction*100,2)+'%';
   $('b-notice').classList.toggle('warning',m.mode==='DCM');$('b-notice').textContent=m.mode==='CCM'?'当前 CCM：输入电流连续，二极管电流呈脉冲。理想平均模型可近似核对稳态；不是损耗或器件设计模型。':'当前 DCM：电感电流触零后保持为零，输出由电容独自供电。CCM 变换比、频响和右半平面零点演示不适用。';
   $('b-ripple').textContent='峰峰纹波 '+fmt(m.deltaI)+' A';$('b-stress').textContent='理想稳态：电感峰值 '+fmt(m.Ipeak)+' A，RMS '+fmt(m.Irms)+' A；开关与二极管电压应力约 '+fmt(m.Vstress)+' V。近似边界 Rcrit≈'+fmt(m.Rcrit,2)+' Ω，模式以实际触零事件为准。';
   $('b-freq-tag').textContent='f₀ '+fmt(m.f0,1)+' Hz · fRHP '+fmt(m.fRHP,1)+' Hz';$('b-freq-notice').classList.toggle('warning',m.mode==='DCM');$('b-freq-notice').textContent=m.mode==='CCM'?'CCM 小信号占空比到输出模型。右半平面零点增加相位滞后，图中展开相位可低于 −180°。':'DCM 下以下只保留 CCM 数学参照，不能作为当前工况的实际预测。';
   $('b-label-vg').textContent=fmt(p.Vg)+' V';$('b-label-l').textContent=fmt(p.L*1e6)+' µH';$('b-label-c').textContent=fmt(p.C*1e6)+' µF';$('b-label-r').textContent=fmt(p.R)+' Ω';
   ['params','wave','freq'].forEach(k=>$('b-export-'+k).disabled=false);$('b-readout').textContent='移动或点击曲线读取数值。';drawAll();syncPhase();stepAvailability();
  }catch(e){$('b-error').hidden=false;$('b-error').textContent=e.message+' 保留上一组有效稳态波形。';transient=null;$('b-step-plots').hidden=true;['params','wave','freq','step'].forEach(k=>$('b-export-'+k).disabled=true);stepAvailability();}
 }
 function ns(tag,attrs,text){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.keys(attrs||{}).forEach(k=>e.setAttribute(k,attrs[k]));if(text!==undefined)e.textContent=text;return e;}
 function plot(id,series,o){
  const box=$(id);box.replaceChildren();const w=Math.max(230,Math.floor(box.getBoundingClientRect().width)),h=box.clientHeight,pad={l:59,r:15,t:18,b:37},first=series[0].rows;
  const xmin=o.log?Math.log10(first[0].x):first[0].x,xmax=o.log?Math.log10(first[first.length-1].x):first[first.length-1].x;
  let ymin=Infinity,ymax=-Infinity;series.forEach(s=>s.rows.forEach(r=>{ymin=Math.min(ymin,r.y);ymax=Math.max(ymax,r.y);}));if(o.zero)ymin=Math.min(0,ymin);
  const span=Math.max(ymax-ymin,Math.abs(ymax)*.001,1e-5);ymin-=span*.17;ymax+=span*.17;if(o.zero)ymin=Math.max(0,ymin);
  const sx=x=>pad.l+((o.log?Math.log10(x):x)-xmin)/(xmax-xmin)*(w-pad.l-pad.r),sy=y=>h-pad.b-(y-ymin)/(ymax-ymin)*(h-pad.t-pad.b);
  const svg=ns('svg',{viewBox:'0 0 '+w+' '+h,role:'img','aria-label':o.title});svg.appendChild(ns('title',{},o.title));
  const defs=ns('defs'),clip=ns('clipPath',{id:id+'-clip'});clip.appendChild(ns('rect',{x:pad.l,y:pad.t,width:w-pad.l-pad.r,height:h-pad.t-pad.b}));defs.appendChild(clip);svg.appendChild(defs);
  if(o.shade&&o.shade<first[first.length-1].x){const x=Math.max(pad.l,sx(o.shade));svg.appendChild(ns('rect',{x:x,y:pad.t,width:w-pad.r-x,height:h-pad.t-pad.b,fill:'#f4e7d5',opacity:'.65'}));}
  const decimals=Math.max(0,Math.min(5,Math.ceil(-Math.log10((ymax-ymin)/4))+1));
  for(let j=0;j<=4;j++){const v=ymin+(ymax-ymin)*j/4,y=sy(v);svg.appendChild(ns('line',{x1:pad.l,x2:w-pad.r,y1:y,y2:y,class:'grid'}));svg.appendChild(ns('text',{x:pad.l-9,y:y+4,'text-anchor':'end',class:'axis'},fmt(v,decimals)));}
  const nx=w<450?3:5;for(let j=0;j<nx;j++){const raw=xmin+(xmax-xmin)*j/(nx-1),v=o.log?10**raw:raw;svg.appendChild(ns('text',{x:sx(v),y:h-16,'text-anchor':j===0?'start':j===nx-1?'end':'middle',class:'axis'},fmt(v,o.log&&v>10?0:1)));}
  svg.appendChild(ns('text',{x:pad.l,y:11,class:'axis'},o.yUnit));svg.appendChild(ns('text',{x:w-pad.r,y:h-1,'text-anchor':'end',class:'axis'},o.xUnit));
  const group=ns('g',{'clip-path':'url(#'+id+'-clip)'});
  if(o.baseline!==undefined)group.appendChild(ns('path',{d:'M'+pad.l+' '+sy(o.baseline)+' H'+(w-pad.r),class:'reference'}));
  series.forEach((s,j)=>{const stride=o.points?1:Math.max(1,Math.ceil(s.rows.length/1200));const selected=s.rows.filter((r,k)=>k%stride===0||k===s.rows.length-1);group.appendChild(ns('path',{d:selected.map((r,k)=>(k&&!(o.breakAtZero&&selected[k-1].x<0&&r.x>0)?'L':'M')+sx(r.x).toFixed(2)+' '+sy(r.y).toFixed(2)).join(' '),class:j||o.referenceOnly?'reference':'trace'}));if(o.points)selected.forEach(r=>group.appendChild(ns('circle',{cx:sx(r.x),cy:sy(r.y),r:3,fill:j?'#b96734':'#236b58'})));});svg.appendChild(group);
  if(o.breakAtZero)svg.appendChild(ns('line',{x1:sx(0),x2:sx(0),y1:pad.t,y2:h-pad.b,class:'cursor'}));
  svg.appendChild(ns('rect',{x:pad.l,y:pad.t,width:w-pad.l-pad.r,height:h-pad.t-pad.b,class:'frame'}));
  const hover=ns('rect',{x:pad.l,y:pad.t,width:w-pad.l-pad.r,height:h-pad.t-pad.b,fill:'transparent'});
  hover.addEventListener('pointermove',event=>{const bounds=svg.getBoundingClientRect(),px=(event.clientX-bounds.left)*w/bounds.width,raw=xmin+(px-pad.l)/(w-pad.l-pad.r)*(xmax-xmin),x=o.log?10**raw:raw;const values=series.map(s=>{let a=0,b=s.rows.length-1;while(b-a>1){const mid=(a+b)>>1;if(s.rows[mid].x<x)a=mid;else b=mid;}const p=s.rows[a],q=s.rows[b];if(o.breakAtZero&&p.x<0&&q.x>0)return s.name+'：此处位于周期中点采样之间';const y=p.y+(q.y-p.y)*(x-p.x)/(q.x-p.x||1);return s.name+' '+fmt(y,5)+' '+o.yUnit;});$(o.readout||'b-readout').textContent=o.title+' · '+fmt(x,3)+' '+o.xUnit+'：'+values.join('；');});svg.appendChild(hover);box.appendChild(svg);
 }
 function drawAll(){if(!result||$('b-lab').hidden)return;const p=result.parameters,m=result.metrics,rows=[];for(let k=0;k<3;k++)result.rows.forEach((r,j)=>{if(k&&j===0)return;rows.push({...r,x:(r.t_s+k/p.fs)*1e6});});
  const series=(key,ref)=>[{name:'开关模型',rows:rows.map(r=>({x:r.x,y:r[key]}))},...(ref===undefined?[]:[{name:'CCM参照',rows:[{x:0,y:ref},{x:3e6/p.fs,y:ref}]}])];
  plot('b-voltage-chart',series('v_V',m.Vccm),{title:'输出电压',xUnit:'µs',yUnit:'V',zero:!$('b-zoom').checked});
  plot('b-current-chart',series('iL_A',m.Iccm),{title:'电感 / 输入电流',xUnit:'µs',yUnit:'A',zero:true});plot('b-diode-chart',series('iD_A'),{title:'二极管电流',xUnit:'µs',yUnit:'A',zero:true});
  const f=M.frequency(p);plot('b-gain-chart',[{name:'CCM幅值',rows:f.map(r=>({x:r.f_Hz,y:r.gain_dB}))}],{title:'Boost 幅频响应',xUnit:'Hz（对数）',yUnit:'dB',log:true,shade:p.fs/10,referenceOnly:m.mode==='DCM'});plot('b-phase-chart',[{name:'CCM相位',rows:f.map(r=>({x:r.f_Hz,y:r.phase_deg}))}],{title:'Boost 相频响应',xUnit:'Hz（对数）',yUnit:'°',log:true,shade:p.fs/10,referenceOnly:m.mode==='DCM'});
  if(transient)drawStep();syncPhase();
 }
 function drawStep(){if(!transient||$('b-lab').hidden)return;const rows=transient.rows;
  plot('b-step-chart',[{name:'开关周期均值',rows:rows.map(r=>({x:r.t_s*1000,y:r.v_sw_mean_V}))},{name:'CCM平均方程',rows:rows.map(r=>({x:r.t_s*1000,y:r.v_avg_V}))}],{title:'占空比真实阶跃整体响应',xUnit:'ms',yUnit:'V',breakAtZero:true,readout:'b-step-readout'});
  const early=rows.filter(r=>r.t_s>=-100e-6&&r.t_s<=100e-6);plot('b-step-early-chart',[{name:'开关周期均值变化',rows:early.map(r=>({x:r.t_s*1e6,y:(r.v_sw_mean_V-transient.metrics.oldV)*1000}))},{name:'CCM平均变化',rows:early.map(r=>({x:r.t_s*1e6,y:(r.v_avg_V-result.metrics.Vccm)*1000}))}],{title:'阶跃最初100微秒',xUnit:'µs',yUnit:'Δv / mV',points:true,baseline:0,breakAtZero:true,readout:'b-step-readout'});
 }
 function syncPhase(){if(!result)return;const p=result.parameters,m=result.metrics,t=phase/100/p.fs,ton=p.D/p.fs;const state=t<ton?0:m.zeroFraction>0&&t>=(1-m.zeroFraction)/p.fs?2:1;
  const paths=['M55 99 V65 H170 M258 65 H300 V110 M300 160 V190 H55 V141 M430 65 H530 V95 M530 145 V190 H430','M55 99 V65 H170 M258 65 H365 M395 65 H530 V95 M530 145 V190 H55 V141','M430 65 H530 V95 M530 145 V190 H430'];
  $('b-active').setAttribute('d',paths[state]);$('b-switch').setAttribute('d',state===0?'M300 110 V160':'M300 110 L320 150');
  $('b-caption').textContent=['导通：二极管反偏，输入给电感储能，电容独自给负载供电。','关断续流：输入与电感共同向输出供能，电感电流逐渐减小。','零电流区间：电感和输入电流为零，二极管关断，电容独自供电。'][state];$('b-circuit-title').textContent=$('b-caption').textContent;
  const a=M.on(p,[m.initialI,m.initialV],ton).x;const x=t<=ton?M.on(p,[m.initialI,m.initialV],t).x:M.off(p,a,t-ton).x;
  const vl=state===0?p.Vg:state===1?p.Vg-x[1]:0,id=state===1?Math.max(0,x[0]):0;
  $('b-phase-time').textContent=fmt(t*1e6,2)+' / '+fmt(1e6/p.fs,2)+' µs';$('b-phase-detail').textContent=['导通','关断续流','零电流'][state]+'：vL='+fmt(vl,2)+' V，iL='+fmt(x[0],3)+' A；二极管电流 '+fmt(id)+' A，电容此刻'+(id-x[1]/p.R>=0?'充电':'放电')+'。竖线对应第一个周期的这一时刻。';
  ['b-voltage-chart','b-current-chart','b-diode-chart'].forEach(id=>{const svg=$(id).querySelector('svg');if(!svg)return;let line=svg.querySelector('.b-marker');if(!line){line=ns('line',{class:'b-marker'});svg.appendChild(line);}const rect=svg.querySelector('.frame'),x=+rect.getAttribute('x')+(+rect.getAttribute('width'))*phase/300;line.setAttribute('x1',x);line.setAttribute('x2',x);line.setAttribute('y1',rect.getAttribute('y'));line.setAttribute('y2',+rect.getAttribute('y')+(+rect.getAttribute('height')));});
 }
 function statePhase(state){const p=result.parameters,z=result.metrics.zeroFraction;phase=100*(state===0?p.D/2:state===2?1-z/2:(p.D+1-z)/2);$('b-phase').value=phase;syncPhase();}
 function stop(){cancelAnimationFrame(frame);frame=0;$('b-play').textContent='播放一个周期';}
 $('b-phase').addEventListener('input',()=>{stop();phase=+$('b-phase').value;syncPhase();});$('b-on').addEventListener('click',()=>{stop();statePhase(0);});$('b-off').addEventListener('click',()=>{stop();statePhase(1);});
 $('b-phase-next').addEventListener('click',()=>{stop();const d=result.parameters.D*100,z=result.metrics.zeroFraction*100,state=phase<d?0:z>0&&phase>=100-z?2:1;statePhase((state+1)%(z>0?3:2));});
 $('b-play').addEventListener('click',()=>{if(frame){stop();return;}const start=performance.now();$('b-play').textContent='暂停观察';const tick=now=>{phase=Math.min(100,(now-start)/60);$('b-phase').value=phase;syncPhase();if(phase<100)frame=requestAnimationFrame(tick);else stop();};frame=requestAnimationFrame(tick);});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');function motion(){if(reduced.matches)stop();$('b-play').disabled=reduced.matches;$('b-motion-note').textContent=reduced.matches?'减少动态效果已开启，请手动拖动滑块观察。':'慢放一个周期至6秒；结束自动停止，不循环播放。';}reduced.addEventListener('change',motion);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 function download(name,body,type){if(!$('b-error').hidden)return;const url=URL.createObjectURL(new Blob([body],{type:type||'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 $('b-export-params').addEventListener('click',()=>{update();if($('b-error').hidden)download('boost-parameters.json',JSON.stringify(result.parameters,null,2),'application/json');});
 $('b-export-wave').addEventListener('click',()=>{update();if($('b-error').hidden)download('boost-waveforms.csv',M.csv(result.rows));});
 $('b-export-freq').addEventListener('click',()=>{update();if($('b-error').hidden)download('boost-frequency.csv',M.csv(M.frequency(result.parameters)));});
 $('b-export-step').addEventListener('click',()=>{update();if(transient)download('boost-step.csv',M.csv(transient.rows));});
 $('b-import').addEventListener('click',()=>$('b-import-file').click());$('b-import-file').addEventListener('change',async()=>{const file=$('b-import-file').files[0];if(!file)return;try{const p=JSON.parse(await file.text());M.validate(p);set(p);$('b-import-status').textContent='已载入 '+file.name;}catch(e){$('b-import-status').textContent='载入失败：'+e.message+' 参数保持原值。';}$('b-import-file').value='';});
 $('b-reset').addEventListener('click',()=>{phase=10;$('b-phase').value=phase;$('b-import-status').textContent='';set(M.defaults);});$('b-light').addEventListener('click',()=>set({...M.defaults,L:47e-6,R:200}));$('b-zoom').addEventListener('change',drawAll);
 $('b-parameters').addEventListener('submit',e=>{e.preventDefault();clearTimeout(pending);update();});$('b-parameters').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(pending);update();}});
 const tabs=Array.from(document.querySelectorAll('[role=tab]'));function tab(id){stop();tabs.forEach(button=>{const active=button.getAttribute('aria-controls')===id;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));$(button.getAttribute('aria-controls')).hidden=!active;});if(id==='b-lab')drawAll();}
 tabs.forEach((button,j)=>{button.addEventListener('click',()=>tab(button.getAttribute('aria-controls')));button.addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();const next=tabs[(j+(e.key==='ArrowRight'?1:2))%3];next.focus();tab(next.getAttribute('aria-controls'));}});});$('b-start').addEventListener('click',()=>tab('b-lab'));
 // Guided tasks check both a prediction and an actually changed work point.
 const lessons=[
  {title:'导通：电感储能，谁给负载供电？',text:'开关闭合把电感右端接到公共回线。电感两端为输入 Vg，电流逐渐增大；二极管反偏，输入此时没有直接通向输出的路径。',question:'开关导通期间，负载主要由谁供电？',options:['电容','二极管把输入直接送到输出','没有供电，输出瞬间归零'],answer:0,explain:'二极管反偏，iD=0。电容电流 iC=−v/R，所以电容在放电；电感电压 Vg>0，电感正在储能。'},
  {title:'关断：输入与电感一起抬高输出',text:'开关断开，电感电流不能跳变，开关节点电位被抬高，使二极管导通。输入与电感共同向输出支路供能。',question:'CCM 关断续流时，电感电压是哪一项？',options:['Vg','Vg−v，通常为负','0'],answer:1,explain:'电感左端是输入 Vg，右端通过二极管接输出 v，vL=Vg−v。升压时 v>Vg，所以电流下降；并不是“关断时没有电流”。'},
  {title:'先预测，再只改变占空比',text:'默认输入24 V、占空比0.40，平均输出约40 V。先选预测，再准备实验，然后只把占空比调到0.50，保持其他默认参数不变。',question:'新的 CCM 平均输出应该约为多少？',options:['48 V','12 V','仍然40 V'],answer:0,explain:'V=Vg/(1−D)=24/0.50=48 V。Boost 的分母是1−D；不能套用 Buck 的 V=DVg。两个工作点都是周期稳态，尚未模拟它们之间的动态。'},
  {title:'把两段电感电压拼成平均方程',text:'导通段电感电压Vg，关断段Vg−v。分别按d和1−d加权。输出电容只在关断续流时接收电感电流。',question:'dVg+(1−d)(Vg−v)化简为？',options:['dVg−v','Vg−(1−d)v','(1−d)Vg−v'],answer:1,explain:'两段都有Vg，所以加权后输入项是Vg。平均方程 L·dīL/dt=Vg−(1−d)v̄；C·dv̄/dt=(1−d)īL−v̄/R。稳态由此得到升压变换比。'}
 ];
 let lesson=0,ready=false;const answers=[null,null,null,null],completed=new Set();
 ['1 导通','2 关断','3 调参','4 平均'].forEach((label,j)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>{lesson=j;renderLesson();});$('b-steps').appendChild(button);});
 function renderLesson(){const l=lessons[lesson];Array.from($('b-steps').children).forEach((button,j)=>{button.setAttribute('aria-pressed',String(j===lesson));button.textContent=['1 导通','2 关断','3 调参','4 平均'][j]+(completed.has(j)?' ✓':'');});$('b-progress').textContent=completed.size+' / 4 已完成';$('b-lesson-title').textContent=l.title;$('b-lesson-text').textContent=l.text;$('b-lesson-question').textContent=l.question;$('b-lesson-options').replaceChildren();l.options.forEach((text,j)=>{const label=document.createElement('label');label.className='choice';const input=document.createElement('input');input.type='radio';input.name='boost-learning-answer';input.value=j;input.checked=answers[lesson]===j;input.addEventListener('change',()=>{answers[lesson]=j;$('b-feedback').hidden=true;});label.append(input,document.createTextNode(text));$('b-lesson-options').appendChild(label);});$('b-observe').hidden=lesson>1;$('b-prepare').hidden=lesson!==2;$('b-next').hidden=lesson===3;$('b-feedback').hidden=true;}
 function feedback(text,ok){$('b-feedback').hidden=false;$('b-feedback').classList.toggle('success',!!ok);$('b-feedback').textContent=text;}
 $('b-check').addEventListener('click',()=>{const l=lessons[lesson];if(answers[lesson]===null){feedback('先点选预测，再检查。',false);return;}if(answers[lesson]!==l.answer){feedback('再想一想。'+l.explain,false);return;}if(lesson===2){if(!ready){feedback('预测正确。先准备实验，再亲手把D调到0.50。',false);return;}clearTimeout(pending);update();if(!$('b-error').hidden){feedback('先修正无效参数。',false);return;}const p=result.parameters;if(Math.abs(p.D-.5)>1e-9||!Object.keys(M.defaults).every(k=>k==='D'||Math.abs(p[k]/M.defaults[k]-1)<1e-9)){feedback('实验未完成：只把D改为0.50，其余保持默认。',false);return;}}completed.add(lesson);$('b-progress').textContent=completed.size+' / 4 已完成';Array.from($('b-steps').children)[lesson].textContent=['1 导通','2 关断','3 调参','4 平均'][lesson]+' ✓';feedback('这一步完成。'+l.explain+(completed.size===4?' 四步完成！接着观察下方阶跃，或进入自测。':''),true);});
 $('b-prepare').addEventListener('click',()=>{if(answers[lesson]===null){feedback('先选一个预测，再准备实验。',false);return;}ready=true;set(M.defaults);feedback('已准备默认工况，请亲手把D从0.40调到0.50。',false);$('b-num-D').focus();$('b-num-D').scrollIntoView({block:'center'});});$('b-observe').addEventListener('click',()=>{set(M.defaults);statePhase(lesson);$('b-circuit-panel').scrollIntoView({block:'start'});});$('b-next').addEventListener('click',()=>{lesson=Math.min(3,lesson+1);renderLesson();});$('b-retry').addEventListener('click',()=>{answers.fill(null);completed.clear();ready=false;lesson=0;renderLesson();});
 document.querySelectorAll('input[name=boost-step-predict]').forEach(input=>input.addEventListener('change',()=>{stepPrediction=+input.value;stepAvailability();if(transient)$('b-step-notice').textContent='预测已更改，请重新运行阶跃检查。';}));
 $('b-step-default').addEventListener('click',()=>set(M.defaults));$('b-run-step').addEventListener('click',()=>{if(stepPrediction===null)return;let p;try{p=read();M.validate(p);}catch(e){update();return;}if(!Object.keys(p).every(k=>p[k]===result.parameters[k])){update();if($('b-run-step').disabled)return;}try{stop();transient=M.step(p);$('b-step-plots').hidden=false;drawStep();$('b-export-step').disabled=false;const m=transient.metrics;const initialDip=m.firstCycleV<m.oldV-1e-9;const observation=initialDip?'第一个阶跃后周期均值从 '+fmt(m.oldV,6)+' V 降到 '+fmt(m.firstCycleV,6)+' V，下降约 '+fmt((m.oldV-m.firstCycleV)*1000,3)+' mV。':'当前周期均值采样未分辨出初始下降；平均方程的初始斜率为负，逆响应可能短于一个周期。建议恢复默认工况观察。';$('b-step-notice').textContent=(stepPrediction===0&&initialDip?'预测正确。':'电容电压不会瞬间跳变。')+observation+' 长期稳态约 '+fmt(m.finalV,6)+' V。平均模型初始斜率 '+fmt(m.averageInitialSlope,3)+' V/s。'+(m.ccmThroughout?'本次开关响应全过程保持CCM。':'过程曾触零，橙色CCM平均曲线仅作参照。');}catch(e){transient=null;$('b-step-plots').hidden=true;$('b-export-step').disabled=true;$('b-step-notice').textContent=e.message;}});
 const quizzes=[
  ['导通时二极管与电容的状态是什么？',['二极管导通，电容不供电','二极管反偏，电容给负载供电','两者都没有电流'],1,'开关把节点拉低，二极管反偏；C·dv/dt=−v/R，电容放电。'],
  ['默认24 V输入、D=0.4，CCM平均输出约多少？',['40 V','9.6 V','24 V'],0,'V=Vg/(1−D)=24/0.6=40 V。不要套用Buck公式。'],
  ['以下哪种电流在CCM下连续？',['二极管电流','开关电流','电感 / 输入电流'],2,'输入串联电感，输入电流等于电感电流；开关和二极管轮流承载脉冲电流。'],
  ['电感电流触零后，理想二极管模型怎样处理？',['继续算成负电流','保持零电流，电容给负载供电','强行保持CCM变换比'],1,'二极管不能反向续流；需要第三种状态，CCM平均公式失效。'],
  ['CCM下占空比正阶跃最初可能怎样？',['电压瞬间跳高','先立刻到最终稳态','平均输出短暂下降再升高'],2,'关断供能时间先缩短，而电感电流不能瞬间增加，电容先补缺口；这是右半平面零点的直观表现。'],
  ['右半平面零点对控制意味着什么？',['增加相位滞后，带宽需留出限制','可以靠提高带宽完全消除','频率就是实际闭环带宽'],0,'RHP零点增加相位滞后；需要结合相位裕度设计较低的穿越频率，不能把它当普通左半平面零点补偿。']
 ];let graded=false;
 quizzes.forEach((q,j)=>{const article=document.createElement('article');article.className='question';article.id='b-question-'+j;const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.innerHTML='<span class="q-number">QUESTION '+String(j+1).padStart(2,'0')+'</span>'+q[0];field.appendChild(legend);q[1].forEach((text,k)=>{const label=document.createElement('label');label.className='choice';const radio=document.createElement('input');radio.type='radio';radio.name='bq'+j;radio.value=k;label.append(radio,document.createTextNode(text));field.appendChild(label);});const exp=document.createElement('div');exp.className='explanation';exp.hidden=true;exp.id='b-answer-'+j;exp.innerHTML='<strong>答案：'+q[1][q[2]]+'</strong><p>步骤与错误原因：'+q[3]+'</p>';article.append(field,exp);$('b-quiz-items').appendChild(article);});
 function hideQuiz(){graded=false;quizzes.forEach((q,j)=>{$('b-answer-'+j).hidden=true;$('b-question-'+j).classList.remove('correct','incorrect');});$('b-score').textContent='尚未提交';}
 $('b-quiz-form').addEventListener('submit',e=>{e.preventDefault();const a=quizzes.map((q,j)=>document.querySelector('input[name=bq'+j+']:checked'));if(a.some(x=>!x)){$('b-quiz-message').textContent='还有 '+a.filter(x=>!x).length+' 道题未作答。';return;}let score=0;quizzes.forEach((q,j)=>{const ok=+a[j].value===q[2];if(ok)score++;$('b-question-'+j).classList.toggle('correct',ok);$('b-question-'+j).classList.toggle('incorrect',!ok);$('b-answer-'+j).hidden=false;});graded=true;$('b-score').textContent=score+' / 6';$('b-quiz-message').textContent='已显示解析，可以重做并复述原因。';});$('b-quiz-form').addEventListener('change',()=>{if(graded){hideQuiz();$('b-quiz-message').textContent='选择已改变，请重新提交。';}});$('b-quiz-reset').addEventListener('click',()=>{$('b-quiz-form').reset();hideQuiz();$('b-quiz-message').textContent='已清空选择和解析。';});
 let resize;window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(drawAll,120);});
 window.BoostLab={get result(){return result;},get transient(){return transient;},setParameters:set,showTab:tab};renderLesson();update();motion();
})();
