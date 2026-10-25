/* Ideal nonsynchronous Boost: exact piecewise ODE flow, diode zero-current
 * event, periodic orbit, and genuine time-domain duty-step trajectories.
 * SI parameters. No dependencies. */
(function(root){
 'use strict';
 const defaults=Object.freeze({Vg:24,D:.4,L:220e-6,C:470e-6,R:20,fs:20000});
 const limits=Object.freeze({Vg:[6,48],D:[.1,.7],L:[47e-6,2200e-6],C:[100e-6,2200e-6],R:[5,200],fs:[20000,100000]});
 function validate(p){if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('参数须为包含 Vg、D、L、C、R、fs 的 JSON 对象。');for(const k of Object.keys(defaults))if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<limits[k][0]*(1-1e-12)||p[k]>limits[k][1]*(1+1e-12))throw new Error(k+' 超出 Boost 支持范围或不是有限数值。');}
 function matrix(p,h,k){
  const a=1/(2*p.R*p.C),w2=k*k/(p.L*p.C)-a*a;let c,s;
  if(Math.abs(w2)*h*h<1e-12){c=1-w2*h*h/2;s=h-w2*h*h*h/6;}
  else if(w2>0){const w=Math.sqrt(w2);c=Math.cos(w*h);s=Math.sin(w*h)/w;}
  else{const w=Math.sqrt(-w2);c=Math.cosh(w*h);s=Math.sinh(w*h)/w;}
  const e=Math.exp(-a*h);return [e*(c+a*s),-e*k*s/p.L,e*k*s/p.C,e*(c-a*s)];
 }
 function mul(A,x){return [A[0]*x[0]+A[1]*x[1],A[2]*x[0]+A[3]*x[1]];}
 function flow(p,x,h,k){const eq=[p.Vg/(p.R*k*k),p.Vg/k],y=mul(matrix(p,h,k),[x[0]-eq[0],x[1]-eq[1]]);return [y[0]+eq[0],y[1]+eq[1]];}
 function on(p,x,h){const end=[x[0]+p.Vg*h/p.L,x[1]*Math.exp(-h/(p.R*p.C))];return {x:end,vInt:p.R*p.C*(x[1]-end[1]),iInt:x[0]*h+p.Vg*h*h/(2*p.L),zero:0};}
 function off(p,x,h){
  // In the supported steady states and positive-duty step, v remains above
  // Vg during an idle interval, so the diode stays reverse-biased there.
  const end=flow(p,x,h,1);
  if(x[0]>0&&end[0]>=0){const vi=p.Vg*h-p.L*(end[0]-x[0]);return {x:end,vInt:vi,iInt:p.C*(end[1]-x[1])+vi/p.R,zero:0};}
  let hit=0;
  if(x[0]>0){let lo=0,hi=h;for(let j=0;j<48;j++){const mid=(lo+hi)/2;if(flow(p,x,mid,1)[0]>0)lo=mid;else hi=mid;}hit=(lo+hi)/2;}
  const vh=hit?flow(p,x,hit,1)[1]:x[1],idle=h-hit,ve=vh*Math.exp(-idle/(p.R*p.C));
  if(ve<p.Vg*(1-1e-9))throw new Error('当前零电流区间发生二极管重新导通，超出本教学模型的有效工况。');
  const vi=p.Vg*hit+p.L*x[0];return {x:[0,ve],vInt:vi+p.R*p.C*(vh-ve),iInt:p.C*(vh-x[1])+vi/p.R,zero:idle};
 }
 function cycle(p,x){const a=on(p,x,p.D/p.fs),b=off(p,a.x,(1-p.D)/p.fs);return {x:b.x,vInt:a.vInt+b.vInt,iInt:a.iInt+b.iInt,zero:b.zero};}
 function periodic(p){
  const E=matrix(p,(1-p.D)/p.fs,1),decay=Math.exp(-p.D/(p.fs*p.R*p.C));
  const P=[E[0],E[1]*decay,E[2],E[3]*decay];
  const eq=[p.Vg/p.R,p.Vg],z=mul(E,[p.Vg*p.D/(p.fs*p.L)-eq[0],-eq[1]]),q=[z[0]+eq[0],z[1]+eq[1]];
  const a=1-P[0],b=-P[1],c=-P[2],d=1-P[3],det=a*d-b*c;
  const x=[(d*q[0]-b*q[1])/det,(a*q[1]-c*q[0])/det];
  if(x[0]>=0)return {x:x,mode:'CCM'};
  let lo=Math.max(p.Vg,x[1]),hi=Math.max(p.Vg/(1-p.D)*2,lo*2);
  // At the ideal CCM voltage the DCM orbit charges the capacitor. A larger
  // upper bound is found by inspection of the true switched cycle map.
  lo=p.Vg/(1-p.D);
  for(let j=0;cycle(p,[0,hi]).x[1]>hi&&j<30;j++)hi*=2;
  if(cycle(p,[0,hi]).x[1]>hi)throw new Error('未能包围周期稳态根。');
  for(let j=0;j<64;j++){const v=(lo+hi)/2;if(cycle(p,[0,v]).x[1]>v)lo=v;else hi=v;}
  return {x:[0,(lo+hi)/2],mode:'DCM'};
 }
 function simulate(p,n){
  validate(p);n=n===undefined?128:n;if(!Number.isInteger(n)||n<16||n>4096)throw new Error('采样间隔须为16–4096整数。');
  const ss=periodic(p),T=1/p.fs,ton=p.D*T,peak=on(p,ss.x,ton).x,end=cycle(p,ss.x),times=[];
  for(let j=0;j<=n;j++)times.push(j/n*ton);for(let j=1;j<=n;j++)times.push(ton+j/n*(T-ton));
  if(end.zero>0)times.push(T-end.zero);times.sort((a,b)=>a-b);
  const rows=times.map(t=>{const isOn=t<ton,x=t<=ton?on(p,ss.x,t).x:off(p,peak,t-ton).x;const idle=!isOn&&end.zero>0&&t>=T-end.zero;const id=isOn||idle?0:Math.max(0,x[0]);return {t_s:t,v_V:x[1],iL_A:x[0],vL_V:isOn?p.Vg:idle?0:p.Vg-x[1],iC_A:id-x[1]/p.R,iD_A:id,iS_A:isOn?x[0]:0,gate:isOn?1:0,region:isOn?1:idle?3:2};});
  let rms=0;for(let j=1;j<rows.length;j++)rms+=(rows[j-1].iL_A**2+rows[j].iL_A**2)*(rows[j].t_s-rows[j-1].t_s)/2/T;
  const vs=rows.map(r=>r.v_V),is=rows.map(r=>r.iL_A),k=1-p.D;
  const m={mode:ss.mode,Vmean:end.vInt/T,IinMean:end.iInt/T,IoutMean:end.vInt/T/p.R,Vccm:p.Vg/k,Iccm:p.Vg/(p.R*k*k),deltaV:Math.max(...vs)-Math.min(...vs),deltaI:Math.max(...is)-Math.min(...is),Ipeak:Math.max(...is),Imin:Math.min(...is),Irms:Math.sqrt(rms),Vstress:Math.max(...vs),zeroFraction:end.zero/T,initialI:ss.x[0],initialV:ss.x[1],residual:Math.max(Math.abs(end.x[0]-ss.x[0]),Math.abs(end.x[1]-ss.x[1])),Gdc:p.Vg/(k*k),f0:k/(2*Math.PI*Math.sqrt(p.L*p.C)),fRHP:p.R*k*k/(2*Math.PI*p.L),Rcrit:2*p.L*p.fs/(p.D*k*k)};
  if(!Object.values(m).filter(v=>typeof v==='number').every(Number.isFinite))throw new Error('求解出现非有限结果。');
  return {parameters:{...p},metrics:m,rows};
 }
 function frequency(p,count){validate(p);const k=1-p.D,f0=k/(2*Math.PI*Math.sqrt(p.L*p.C)),fz=p.R*k*k/(2*Math.PI*p.L),low=Math.max(1,f0/30),high=Math.max(fz*4,f0*10,p.fs/10),rows=[];
  for(let j=0;j<(count||240);j++){const f=low*(high/low)**(j/((count||240)-1)),w=2*Math.PI*f,re=1-w*w*p.L*p.C/(k*k),im=w*p.L/(p.R*k*k),z=w*p.L/(p.R*k*k);rows.push({f_Hz:f,gain_dB:20*Math.log10(p.Vg/(k*k)*Math.hypot(1,z)/Math.hypot(re,im)),phase_deg:(-Math.atan(z)-Math.atan2(im,re))*180/Math.PI});}return rows;
 }
 function step(p,delta){
  validate(p);delta=delta===undefined?.02:delta;
  if(!Number.isFinite(delta)||delta<=0||delta>.05||p.D+delta>limits.D[1]+1e-12)throw new Error('阶跃需为0–0.05的正增量，且最终占空比不超过0.70。');
  const old=simulate(p),p2={...p,D:p.D+delta},final=simulate(p2);
  if(old.metrics.mode!=='CCM'||final.metrics.mode!=='CCM')throw new Error('右半平面零点演示要求阶跃前后均为CCM；请恢复默认参数。');
  const T=1/p.fs,duration=Math.min(.25,Math.max(.02,10*p.R*p.C)),cycles=Math.ceil(duration/T),rows=[];
  const xavg=[old.metrics.Iccm,old.metrics.Vccm];let x=[old.metrics.initialI,old.metrics.initialV],minI=Infinity;
  for(let j=-10;j<cycles;j++){
    if(j<0){rows.push({t_s:(j+.5)*T,v_sw_mean_V:old.metrics.Vmean,i_sw_mean_A:old.metrics.IinMean,v_avg_V:xavg[1],i_avg_A:xavg[0],D:p.D});continue;}
    const a=on(p2,x,p2.D*T),b=off(p2,a.x,(1-p2.D)*T),avg=flow(p,xavg,(j+.5)*T,1-p2.D);
    rows.push({t_s:(j+.5)*T,v_sw_mean_V:(a.vInt+b.vInt)/T,i_sw_mean_A:(a.iInt+b.iInt)/T,v_avg_V:avg[1],i_avg_A:avg[0],D:p2.D});
    minI=Math.min(minI,x[0],a.x[0],b.x[0]);x=b.x;
  }
  return {parameters:{...p},delta,rows,metrics:{oldV:old.metrics.Vmean,finalV:final.metrics.Vmean,averageInitialSlope:-old.metrics.Iccm*delta/p.C,firstCycleV:rows[10].v_sw_mean_V,minCycleV:Math.min(...rows.slice(10).map(r=>r.v_sw_mean_V)),averageMinV:Math.min(...rows.slice(10).map(r=>r.v_avg_V)),lastCycleV:rows[rows.length-1].v_sw_mean_V,ccmThroughout:minI>0,minCurrent:minI,duration:cycles*T}};
 }
 function csv(rows){const keys=Object.keys(rows[0]);return keys.join(',')+'\r\n'+rows.map(r=>keys.map(k=>r[k]).join(',')).join('\r\n');}
 const api={defaults,limits,validate,simulate,frequency,step,csv,on,off,flow};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BoostModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
