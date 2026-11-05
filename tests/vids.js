const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const p=await (await b.newContext({viewport:{width:1920,height:1080},acceptDownloads:true,permissions:['camera']})).newPage();
 p.on('pageerror',e=>console.log('PAGEERR',e.message));
 await p.route('**/vendor/pose/pose.js',r=>r.fulfill({contentType:'text/javascript',body:require('fs').readFileSync('/tmp/gt/stub_slow4.js','utf8')}));
 await p.goto('http://localhost:8099/index.html');
 await p.waitForFunction(()=>!document.getElementById('go').textContent.includes('chuẩn bị'),null,{timeout:15000});
 await p.click('#mFile'); await p.fill('#name','Tran Thi B');await p.fill('#height','158');
 await p.setInputFiles('#vfile','/tmp/gt/long.mp4'); await p.waitForTimeout(800);
 await p.fill('#vstart','0');
 await p.screenshot({path:'/tmp/gt/v1.png'});
 await p.click('#go'); await p.waitForTimeout(6000); await p.screenshot({path:'/tmp/gt/v2.png'});
 await p.waitForSelector('#L3.show',{timeout:150000});
 await p.waitForTimeout(500); await p.screenshot({path:'/tmp/gt/v3.png'});
 console.log(await p.evaluate(()=>JSON.stringify([window.__gait.S.slow,window.__gait.S.result.comb.common,window.__gait.S.result.q])));
 await b.close();
})();
