'use strict';
// Optional validation tool: Node + Playwright + installed Chromium browser.
// No dependencies are needed to OPEN the lab itself.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BUCK_BROWSER||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1050},offline:true,acceptDownloads:true,reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[],external=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
 async function check(name,fn){await fn();checks.push({name,passed:true});}
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>window.BuckLab?.result);
 await check('file:// page opens while browser is offline',async()=>{assert.ok(await page.title());assert.ok((await page.locator('#voltage-value').innerText()).includes('9.6'));assert.equal(await page.locator('.chart svg').count(),4);});
 await check('Slider, numeric input, keyboard and steady output respond',async()=>{
  await page.locator('#range-D').focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(120);assert.equal(await page.locator('#num-D').inputValue(),'0.41');
  assert.ok(Math.abs((await page.evaluate(()=>BuckLab.result.metrics.Vmean))-9.84)<.001);
  await page.locator('#num-Vg').fill('30');await page.locator('#num-Vg').press('Enter');assert.ok(Math.abs((await page.evaluate(()=>BuckLab.result.metrics.Vmean))-12.3)<.001);
 });
 await check('Invalid input preserves valid result and disables export',async()=>{await page.locator('#num-D').fill('1');await page.waitForTimeout(120);assert.ok(await page.locator('#input-error').isVisible());assert.ok(await page.locator('#export-wave').isDisabled());await page.locator('#num-D').fill('');await page.waitForTimeout(120);assert.ok(await page.locator('#input-error').isVisible());await page.locator('#reset').click();assert.ok(await page.locator('#input-error').isHidden());assert.ok(await page.locator('#export-wave').isEnabled());});
 await check('DCM preset, invalid CCM formula warning and three circuit states',async()=>{await page.locator('#light-load').click();assert.equal(await page.locator('#mode-value').innerText(),'DCM');assert.ok((await page.locator('#mode-notice').innerText()).includes('不适用'));assert.ok(await page.evaluate(()=>BuckLab.result.rows.every(r=>r.i_sw_A>=-1e-10)));await page.locator('#circuit-next').click();await page.locator('#circuit-next').click();assert.ok((await page.locator('#circuit-caption').innerText()).includes('零电流'));await page.locator('#reset').click();assert.equal(await page.locator('#mode-value').innerText(),'CCM');});
 await check('Zoom and pointer readout',async()=>{const before=await page.locator('#voltage-chart path.trace').getAttribute('d');await page.locator('#zoom-voltage').uncheck();const after=await page.locator('#voltage-chart path.trace').getAttribute('d');assert.notEqual(before,after);await page.locator('#zoom-voltage').check();await page.locator('#voltage-chart svg').hover({position:{x:170,y:80}});assert.ok((await page.locator('#wave-readout').innerText()).includes('输出电压'));});
 const downloadDir=path.join(__dirname,'downloads');fs.mkdirSync(downloadDir,{recursive:true});
 await check('Real JSON and two CSV downloads contain SI data',async()=>{for(const id of ['export-params','export-wave','export-bode']){const promise=page.waitForEvent('download');await page.locator('#'+id).click();const download=await promise;const target=path.join(downloadDir,download.suggestedFilename());await download.saveAs(target);const body=fs.readFileSync(target,'utf8');if(id==='export-params')assert.deepEqual(JSON.parse(body),require('../model.js').defaults);else {assert.ok(body.startsWith(id==='export-wave'?'t_s,v_sw_V,i_sw_A,v_avg_V,i_avg_A,gate':'f_Hz,gain_dB,phase_deg'));assert.ok(body.split(/\r?\n/).length>100);}}});
 await check('JSON file import uses SI values and rejects invalid data',async()=>{const p={...require('../model.js').defaults,Vg:30};await page.locator('#import-file').setInputFiles({name:'test-parameters.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await page.waitForFunction(()=>BuckLab.result.parameters.Vg===30);assert.equal(await page.locator('#num-L').inputValue(),'220');await page.locator('#import-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});await page.waitForFunction(()=>document.getElementById('import-status').textContent.includes('失败'));assert.equal(await page.evaluate(()=>BuckLab.result.parameters.Vg),30);await page.locator('#reset').click();});
 await check('Beginner path: missing choice, retry feedback and four-step completion',async()=>{
  assert.ok((await page.locator('#learn-progress').innerText()).includes('0 / 4'));
  await page.locator('#learn-check').click();assert.ok((await page.locator('#learn-feedback').innerText()).includes('先点选'));
  await page.locator('input[name=learning-answer][value="1"]').check();await page.locator('#learn-check').click();assert.ok((await page.locator('#learn-feedback').innerText()).includes('再想一想'));assert.ok((await page.locator('#learn-progress').innerText()).includes('0 / 4'));
  await page.locator('input[name=learning-answer][value="0"]').check();await page.locator('#learn-check').click();assert.ok((await page.locator('#learn-progress').innerText()).includes('1 / 4'));
  await page.locator('#learn-next').click();await page.locator('input[name=learning-answer][value="1"]').check();await page.locator('#learn-check').click();assert.ok((await page.locator('#learn-progress').innerText()).includes('2 / 4'));
  await page.locator('#learn-observe').click();assert.ok((await page.locator('#learn-phase-detail').innerText()).startsWith('续流'));
  await page.locator('#learn-next').click();await page.locator('input[name=learning-answer][value="0"]').check();await page.locator('#learn-check').click();assert.ok((await page.locator('#learn-feedback').innerText()).includes('准备实验'));
  await page.locator('#learn-prepare').click();assert.equal(await page.locator('#num-D').inputValue(),'0.4');await page.locator('#num-D').fill('0.50');await page.locator('#num-R').fill('10');await page.locator('#learn-check').click();assert.ok((await page.locator('#learn-progress').innerText()).includes('2 / 4'));assert.ok((await page.locator('#learn-feedback').innerText()).includes('其余默认参数'));await page.locator('#num-R').fill('5');await page.locator('#learn-check').click();assert.ok((await page.locator('#learn-progress').innerText()).includes('3 / 4'));assert.ok(Math.abs(await page.evaluate(()=>BuckLab.result.metrics.Vmean)-12)<.001);
  await page.locator('#learn-next').click();await page.locator('input[name=learning-answer][value="1"]').check();await page.locator('#learn-check').click();assert.ok((await page.locator('#learn-progress').innerText()).includes('4 / 4'));assert.ok((await page.locator('#learn-feedback').innerText()).includes('四步已完成'));
  await page.locator('#learn-reset').click();assert.ok((await page.locator('#learn-progress').innerText()).includes('0 / 4'));await page.locator('#reset').click();
 });
 await check('Cycle slider links circuit, current state, and both waveform markers',async()=>{
  await page.locator('#learn-on').click();assert.ok((await page.locator('#learn-phase-detail').innerText()).startsWith('导通'));
  const first=await page.locator('#current-chart .learn-marker').getAttribute('x1');
  await page.locator('#learn-off').click();assert.ok((await page.locator('#learn-phase-detail').innerText()).startsWith('续流'));assert.notEqual(first,await page.locator('#current-chart .learn-marker').getAttribute('x1'));
  assert.equal(await page.locator('.learn-marker').count(),2);await page.locator('#light-load').click();await page.locator('#learn-phase').focus();await page.keyboard.press('End');assert.ok((await page.locator('#learn-phase-detail').innerText()).startsWith('零电流'));
  await page.locator('#reset').click();assert.ok(await page.locator('#learn-play').isDisabled());
 });
 await check('Slow playback pauses, stops after one cycle and respects reduced motion',async()=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#learn-play').click();await page.waitForTimeout(180);await page.locator('#learn-play').click();const paused=await page.locator('#learn-phase').inputValue();await page.waitForTimeout(180);assert.equal(await page.locator('#learn-phase').inputValue(),paused);
  await page.locator('#learn-play').click();await page.waitForFunction(()=>document.getElementById('learn-play').textContent==='播放一个周期',{},{timeout:10000});assert.equal(await page.locator('#learn-phase').inputValue(),'100');
  await page.locator('#learn-play').click();await page.locator('#tab-guide').click();assert.equal(await page.locator('#learn-play').innerText(),'播放一个周期');await page.locator('#tab-lab').click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.getElementById('learn-play').disabled);assert.ok(await page.locator('#learn-play').isDisabled());await page.locator('#reset').click();
 });
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(__dirname,'desktop-lab.png'),fullPage:true});
 await check('Tab arrow-key navigation and theory content',async()=>{await page.locator('#tab-lab').focus();await page.keyboard.press('ArrowRight');assert.ok(await page.locator('#guide').isVisible());assert.ok(await page.locator('#lab').isHidden());assert.ok((await page.locator('#guide').innerText()).includes('Gvd(0)'));});
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(__dirname,'desktop-guide.png'),fullPage:true});
 await check('Quiz answers hidden, incomplete submission, 8/8 and changed answers',async()=>{
  await page.locator('#tab-quiz').click();assert.equal(await page.locator('.explanation:visible').count(),0);
  await page.getByRole('button',{name:'提交并查看解析'}).click();assert.equal(await page.locator('.explanation:visible').count(),0);assert.ok((await page.locator('#quiz-message').innerText()).includes('8'));
  const correct=[1,2,2,1,2,1,2,1];for(let j=0;j<8;j++)await page.locator('input[name=q'+j+'][value="'+correct[j]+'"]').check();
  await page.getByRole('button',{name:'提交并查看解析'}).click();assert.ok((await page.locator('#quiz-score').innerText()).includes('8 / 8'));assert.equal(await page.locator('.explanation:visible').count(),8);
  await page.locator('input[name=q0][value="0"]').check();assert.equal(await page.locator('.explanation:visible').count(),0);await page.getByRole('button',{name:'提交并查看解析'}).click();assert.ok((await page.locator('#quiz-score').innerText()).includes('7 / 8'));
 });
 await page.screenshot({path:path.join(__dirname,'desktop-quiz.png'),fullPage:true});
 await page.locator('#quiz-reset').click();assert.equal(await page.locator('input[type=radio]:checked').count(),0);assert.equal(await page.locator('.explanation:visible').count(),0);
 const layouts=[];
 await check('1440, 390 and 320px: all tabs fit without horizontal overflow',async()=>{for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});for(const tab of ['lab','guide','quiz']){await page.locator('#tab-'+tab).click();await page.waitForTimeout(180);const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));layouts.push({tab,...size});assert.ok(size.scroll<=size.width+1,JSON.stringify({tab,...size}));if(tab==='lab'&&width===390)await page.screenshot({path:path.join(__dirname,'mobile-lab.png'),fullPage:true});}}});
 await check('No script errors or external resource requests',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(external,[]);});
 const report={passed:true,urlProtocol:'file:',offline:true,browser:await browser.version(),checks,layouts,errors,externalRequests:external};
 fs.writeFileSync(path.join(__dirname,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
