'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),M=require('../boost-model.js');
const load=n=>JSON.parse(fs.readFileSync(path.join(__dirname,n),'utf8'));
const a=load('boost-javascript-results.json'),b=load('boost-matlab-results.json'),metrics=[];
for(const scenario of ['default','fine','DCM','step'])for(const key of Object.keys(a[scenario])){const x=a[scenario][key],y=b[scenario][key];if(typeof x==='number'){const rel=Math.abs(x-y)/Math.max(Math.abs(y),1e-9);assert.ok(Math.abs(x-y)<1e-8||rel<1e-7,scenario+' '+key);metrics.push({scenario,key,absoluteDifference:Math.abs(x-y),relativeDifference:rel});}else assert.equal(x,y);}
const p=JSON.parse(fs.readFileSync(path.join(__dirname,'../boost-parameters.json'),'utf8'));
const parse=n=>fs.readFileSync(path.join(__dirname,'../results/boost',n),'utf8').trim().split(/\r?\n/).slice(1).map(r=>r.split(',').map(Number));
const compare=(filename,rows)=>{const csv=parse(filename);assert.equal(csv.length,rows.length);let max=0;csv.forEach((row,j)=>Object.values(rows[j]).forEach((v,k)=>{const error=Math.abs(v-row[k]);assert.ok(error<1e-6,filename+' '+j+' '+k);max=Math.max(max,error);}));return {file:filename,rows:rows.length,maxAbsoluteDifference:max};};
const current=M.simulate(p),datasets=[compare('waveforms.csv',current.rows),compare('frequency.csv',M.frequency(p))];
if(current.metrics.mode==='CCM'&&p.D+.02<=.7+1e-12&&M.simulate({...p,D:p.D+.02}).metrics.mode==='CCM')datasets.push(compare('step.csv',M.step(p).rows));
else assert.ok(!fs.existsSync(path.join(__dirname,'../results/boost/step.csv')),'Ineligible work point must not retain stale step CSV');
const report={passed:true,metrics,datasets};fs.writeFileSync(path.join(__dirname,'boost-cross-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,metricsCompared:metrics.length,datasets},null,2));
