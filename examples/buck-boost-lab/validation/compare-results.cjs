'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const M=require('../model.js');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const js=read('javascript-results.json'),matlab=read('matlab-results.json'),comparisons=[];
for(const scenario of ['default','fine','DCM'])for(const key of ['Vmean','Imean','deltaI','deltaV','f0','Q','zeroFraction']){
 const a=js[scenario][key],b=matlab[scenario][key];
 const relativeError=Math.abs(a-b)/Math.max(Math.abs(b),1e-12);
 assert.ok(relativeError<.01,scenario+' '+key+' exceeded 1%');
 comparisons.push({scenario,metric:key,javascript:a,matlab:b,relativeError});
}
assert.equal(js.default.mode,matlab.default.mode);assert.equal(js.DCM.mode,matlab.DCM.mode);
const parseCSV=filename=>fs.readFileSync(filename,'utf8').trim().split(/\r?\n/).slice(1).map(x=>x.split(',').map(Number));
const samples=parseCSV(path.join(__dirname,'../results/matlab-waveforms.csv'));
const result=M.simulate(JSON.parse(fs.readFileSync(path.join(__dirname,'../parameters.json'),'utf8')));
assert.equal(samples.length,result.rows.length);
let maxVoltageError=0,maxCurrentError=0;
samples.forEach((row,j)=>{maxVoltageError=Math.max(maxVoltageError,Math.abs(row[1]-result.rows[j].v_sw_V));maxCurrentError=Math.max(maxCurrentError,Math.abs(row[2]-result.rows[j].i_sw_A));});
assert.ok(maxVoltageError<1e-7&&maxCurrentError<1e-7);
const frequencies=parseCSV(path.join(__dirname,'../results/matlab-frequency.csv')),jsFreq=M.frequency(result.parameters);
assert.equal(frequencies.length,jsFreq.length);
let maxGainError=0,maxPhaseError=0;
frequencies.forEach((row,j)=>{maxGainError=Math.max(maxGainError,Math.abs(row[1]-jsFreq[j].gain_dB));maxPhaseError=Math.max(maxPhaseError,Math.abs(row[2]-jsFreq[j].phase_deg));});
assert.ok(maxGainError<1e-8&&maxPhaseError<1e-8);
const report={passed:true,comparisons,rowsCompared:samples.length,maxVoltageError_V:maxVoltageError,maxCurrentError_A:maxCurrentError,frequencyRowsCompared:frequencies.length,maxGainError_dB:maxGainError,maxPhaseError_deg:maxPhaseError};
fs.writeFileSync(path.join(__dirname,'cross-results.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
