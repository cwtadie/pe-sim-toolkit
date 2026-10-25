'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const M=require('../model.js');
const checks=[];
function check(name,fn){fn();checks.push({name,passed:true});}
const p={...M.defaults};
const base=M.simulate(p),fine=M.simulate(p,256);
check('Shared parameter file has valid SI inputs',()=>M.validate(JSON.parse(fs.readFileSync(path.join(__dirname,'../parameters.json'),'utf8'))));
check('CCM default mean voltage/current under 1%',()=>{assert.equal(base.metrics.mode,'CCM');assert.ok(Math.abs(base.metrics.Vmean/9.6-1)<.01);assert.ok(Math.abs(base.metrics.Imean/1.92-1)<.01);});
check('DC gain and natural frequency',()=>{assert.equal(base.metrics.Gdc,24);assert.ok(Math.abs(base.metrics.f0/495-1)<.001);});
check('Sampling convergence (128 to 256 per interval)',()=>{assert.ok(Math.abs(base.metrics.Vmean/fine.metrics.Vmean-1)<1e-5);assert.ok(Math.abs(base.metrics.Imean/fine.metrics.Imean-1)<1e-5);});
// Independent RK4 ODE integrator: do not reuse the exact matrix flow.
function rk4(x,u,h){const f=y=>[(u-y[1])/p.L,(y[0]-y[1]/p.R)/p.C];const a=f(x),b=f(x.map((v,j)=>v+h*a[j]/2)),c=f(x.map((v,j)=>v+h*b[j]/2)),d=f(x.map((v,j)=>v+h*c[j]));return x.map((v,j)=>v+h*(a[j]+2*b[j]+2*c[j]+d[j])/6);}
check('Independent RK4 trajectory matches default',()=>{let x=[base.metrics.initialI,base.metrics.initialV];for(let k=0;k<2;k++){const h=(k===0?p.D:1-p.D)/p.fs/2000;for(let j=0;j<2000;j++)x=rk4(x,k===0?p.Vg:0,h);}assert.ok(Math.abs(x[0]-base.metrics.initialI)<1e-9);assert.ok(Math.abs(x[1]-base.metrics.initialV)<1e-9);});
const light=M.simulate({...p,R:100,L:22e-6,fs:20000});
check('DCM zero-current interval and periodic residual',()=>{assert.equal(light.metrics.mode,'DCM');assert.ok(light.metrics.zeroFraction>0);assert.ok(light.rows.every(x=>x.i_sw_A>=-1e-10));assert.ok(light.metrics.residual<1e-8);assert.ok(light.metrics.Vmean>light.metrics.Vccm);});
check('Invalid/nonfinite/out-of-range input rejected',()=>{for(const bad of [NaN,Infinity,-1,0,49])assert.throws(()=>M.simulate({...p,Vg:bad}));assert.throws(()=>M.simulate({...p,D:1}));assert.throws(()=>M.simulate(p,0));});
const sweep=[];
check('64 boundary corners, no negative diode current or periodic drift',()=>{for(let mask=0;mask<64;mask++){const q={};Object.keys(p).forEach((k,j)=>q[k]=M.limits[k][(mask>>j)&1]);const r=M.simulate(q,256);assert.ok(r.metrics.residual<1e-7);assert.ok(r.rows.every(v=>v.i_sw_A>=-1e-9&&v.v_sw_V>=0));assert.ok(Math.abs(r.metrics.Imean-r.metrics.Vmean/q.R)<Math.max(1e-4,r.metrics.Imean*.01));sweep.push({parameters:q,metrics:r.metrics});}});
check('CSV SI header and Bode frequency monotonicity',()=>{assert.ok(M.csv(base).startsWith('t_s,v_sw_V,i_sw_A,v_avg_V,i_avg_A,gate'));const f=M.frequency(p);assert.ok(f.every((x,j)=>!j||x.f_Hz>f[j-1].f_Hz));});
const report={timestamp:new Date().toISOString(),checks,default:base.metrics,fine:fine.metrics,DCM:light.metrics,boundaryCases:sweep.length};
fs.writeFileSync(path.join(__dirname,'javascript-results.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(__dirname,'javascript-default.csv'),M.csv(base));
console.log(JSON.stringify(report,null,2));
