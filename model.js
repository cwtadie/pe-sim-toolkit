/* Ideal nonsynchronous Buck. All inputs and exported data use SI units.
 * Solve dx/dt=A*x+b using the exact matrix exponential in each switch state.
 * This is an ODE solution, not a DC conversion-ratio curve generator. */
(function(root) {
  'use strict';
  const defaults = Object.freeze({ Vg:24, D:0.4, L:220e-6, C:470e-6, R:5, fs:20000 });
  const limits = Object.freeze({ Vg:[6,48], D:[0.05,0.95], L:[22e-6,2200e-6], C:[47e-6,2200e-6], R:[1,100], fs:[20000,100000] });
  function validate(p) {
    Object.keys(defaults).forEach(function(k) {
      if (typeof p[k] !== 'number' || !Number.isFinite(p[k]) || p[k]<limits[k][0]*(1-1e-12) || p[k]>limits[k][1]*(1+1e-12)) {
        throw new Error(k+' 超出允许范围，或不是有限数值。');
      }
    });
  }
  function matrix(p,h) {
    const a=1/(2*p.R*p.C), w2=1/(p.L*p.C)-a*a;
    let c,s;
    if (Math.abs(w2)*h*h < 1e-12) { c=1-w2*h*h/2; s=h-w2*h*h*h/6; }
    else if (w2>0) { const w=Math.sqrt(w2); c=Math.cos(w*h); s=Math.sin(w*h)/w; }
    else { const w=Math.sqrt(-w2); c=Math.cosh(w*h); s=Math.sinh(w*h)/w; }
    const e=Math.exp(-a*h);
    return [e*(c+a*s),-e*s/p.L,e*s/p.C,e*(c-a*s)];
  }
  function mul(A,x) { return [A[0]*x[0]+A[1]*x[1],A[2]*x[0]+A[3]*x[1]]; }
  function flow(p,x,h,u) {
    const z=mul(matrix(p,h),[x[0]-u/p.R,x[1]-u]);
    return [z[0]+u/p.R,z[1]+u];
  }
  function off(p,x,h) {
    if(x[0]<=0) return {x:[0,x[1]*Math.exp(-h/(p.R*p.C))],zero:h};
    const end=flow(p,x,h,0);
    if(end[0]>=0) return {x:end,zero:0};
    let lo=0,hi=h;
    for(let j=0;j<48;j++) { const mid=(lo+hi)/2; if(flow(p,x,mid,0)[0]>0) lo=mid; else hi=mid; }
    const hit=(lo+hi)/2,vhit=flow(p,x,hit,0)[1];
    return {x:[0,vhit*Math.exp(-(h-hit)/(p.R*p.C))],zero:h-hit};
  }
  function cycle(p,x) {
    return off(p,flow(p,x,p.D/p.fs,p.Vg),(1-p.D)/p.fs);
  }
  function periodic(p) {
    const E1=matrix(p,p.D/p.fs),E2=matrix(p,(1-p.D)/p.fs);
    const P=[E2[0]*E1[0]+E2[1]*E1[2],E2[0]*E1[1]+E2[1]*E1[3],E2[2]*E1[0]+E2[3]*E1[2],E2[2]*E1[1]+E2[3]*E1[3]];
    const q=mul(E2,flow(p,[0,0],p.D/p.fs,p.Vg));
    const a=1-P[0],b=-P[1],c=-P[2],d=1-P[3],det=a*d-b*c;
    const x=[(d*q[0]-b*q[1])/det,(a*q[1]-c*q[0])/det];
    if(x[0]>=0) return {x:x,mode:'CCM',zero:0};
    let lo=0,hi=p.Vg;
    for(let j=0;j<64;j++) {
      const v=(lo+hi)/2,delta=cycle(p,[0,v]).x[1]-v;
      if(delta>0) lo=v; else hi=v;
    }
    const xd=[0,(lo+hi)/2],result=cycle(p,xd);
    return {x:xd,mode:'DCM',zero:result.zero};
  }
  function simulate(p,resolution) {
    validate(p);
    const n=resolution===undefined?128:resolution;
    if(!Number.isInteger(n)||n<16||n>4096) throw new Error('积分采样数须为 16–4096 的整数。');
    const ss=periodic(p), T=1/p.fs, rows=[];
    let integralV=0,integralI=0,minI=Infinity,maxI=-Infinity,minV=Infinity,maxV=-Infinity;
    const times=[];
    for(let j=0;j<=n;j++) times.push(j/n*p.D*T);
    for(let j=1;j<=n;j++) times.push(p.D*T+j/n*(1-p.D)*T);
    if(ss.zero>0) times.push(T-ss.zero);
    times.sort(function(a,b){return a-b;});
    for(let k=0;k<times.length;k++) {
      const on=times[k]<=p.D*T,h=on?times[k]:times[k]-p.D*T;
      const peak=flow(p,ss.x,p.D*T,p.Vg);
      const x=on?flow(p,ss.x,h,p.Vg):off(p,peak,h).x;
      const t=times[k];
      rows.push({t_s:t,v_sw_V:x[1],i_sw_A:x[0],v_avg_V:p.D*p.Vg,i_avg_A:p.D*p.Vg/p.R,gate:t<p.D*T?1:0});
      minI=Math.min(minI,x[0]); maxI=Math.max(maxI,x[0]); minV=Math.min(minV,x[1]); maxV=Math.max(maxV,x[1]);
      if(k) {const prev=rows[k-1],dt=t-prev.t_s; integralV+=(prev.v_sw_V+x[1])*dt/2;integralI+=(prev.i_sw_A+x[0])*dt/2;}
    }
    const end=cycle(p,ss.x).x;
    const metrics={mode:ss.mode,Vmean:integralV/T,Imean:integralI/T,deltaI:maxI-minI,deltaV:maxV-minV,minI:minI,maxI:maxI,Vccm:p.D*p.Vg,ILccm:p.D*p.Vg/p.R,Gdc:p.Vg,f0:1/(2*Math.PI*Math.sqrt(p.L*p.C)),Q:p.R*Math.sqrt(p.C/p.L),zeroFraction:ss.zero/T,residual:Math.max(Math.abs(end[0]-ss.x[0]),Math.abs(end[1]-ss.x[1])),initialI:ss.x[0],initialV:ss.x[1]};
    if(!Object.values(metrics).filter(function(v){return typeof v==='number';}).every(Number.isFinite)) throw new Error('数值解异常，请恢复默认参数。');
    return {parameters:Object.assign({},p),metrics:metrics,rows:rows};
  }
  function frequency(p,count) {
    validate(p);
    const f0=1/(2*Math.PI*Math.sqrt(p.L*p.C)),low=Math.max(1,f0/30),high=Math.max(f0*10,p.fs/10),out=[];
    for(let j=0;j<(count||180);j++) { const f=low*Math.pow(high/low,j/((count||180)-1)),w=2*Math.PI*f,re=1-w*w*p.L*p.C,im=w*p.L/p.R;out.push({f_Hz:f,gain_dB:20*Math.log10(p.Vg/Math.hypot(re,im)),phase_deg:-Math.atan2(im,re)*180/Math.PI}); }
    return out;
  }
  function csv(result) {
    const keys=['t_s','v_sw_V','i_sw_A','v_avg_V','i_avg_A','gate'];
    return keys.join(',')+'\r\n'+result.rows.map(function(row){return keys.map(function(k){return row[k];}).join(',');}).join('\r\n');
  }
  const api={defaults:defaults,limits:limits,validate:validate,flow:flow,simulate:simulate,frequency:frequency,csv:csv};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.BuckModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
