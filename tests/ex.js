const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const p=await (await b.newContext({viewport:{width:1920,height:1080},acceptDownloads:true,permissions:['camera']})).newPage();
 p.on('pageerror',e=>console.log('PAGEERR',e.message));
 await p.route('**/vendor/pose/pose.js',r=>r.fulfill({contentType:'text/javascript',body:require('fs').readFileSync('/tmp/gt/stub_pose.js','utf8')}));
 await p.goto('http://localhost:8099/index.html?total=40&rec=4&clip=12');
 await p.waitForFunction(()=>!document.getElementById('go').textContent.includes('chuẩn bị'),null,{timeout:15000});
 await p.fill('#name','Nguyễn Văn A');await p.fill('#height','162');
 await p.click('#go'); await p.waitForSelector('#rvok',{state:'visible',timeout:70000}); await p.click('#rvok');   // màn xem lại: chốt góc
 await p.waitForFunction(()=>!document.getElementById('done').disabled); await p.click('#done'); await p.waitForSelector('#L3.show',{timeout:30000});
 const d=await p.evaluate(()=>{const R=window.__gait.S.result;return JSON.stringify({ex:R.ex&&R.ex.common,per:R.ex&&R.ex.per&&{L:Object.fromEntries(Object.entries(R.ex.per.L).filter(([k])=>k!=='stride')),R:Object.fromEntries(Object.entries(R.ex.per.R).filter(([k])=>k!=='stride'))},fat:R.fat,row:window.__gait.S.rows[0]})});
 console.log(d.slice(0,120));console.log('REC',await p.evaluate(()=>[window.__gait.S.recAt,window.__gait.S.recWhy,window.__gait.S.curCad]));
 await p.click('#tgdetail'); await p.screenshot({path:'/tmp/gt/detail.png'});
 await b.close();
})();
