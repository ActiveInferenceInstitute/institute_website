import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { browserSession } from "./browser_session.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = process.env.WEBSITE_AUDIT_OUTPUT;
assert.ok(output, "Set WEBSITE_AUDIT_OUTPUT to a private evidence directory");
assert.ok(process.env.CHROME_BIN, "Set CHROME_BIN to real Chrome");
await mkdir(output, { recursive: true });
const baseline = process.argv.includes("--baseline");
const quick = process.argv.includes("--quick");
const simulationOnly=process.argv.find(a=>a.startsWith("--simulation="))?.split("=")[1];
if(simulationOnly)assert.match(simulationOnly,/^[A-Za-z0-9_-]+\.html$/);
const controlsOnly = process.argv.includes("--controls")||Boolean(simulationOnly);
const zoomOnly = process.argv.includes("--zoom");
const tabletOnly = process.argv.includes("--tablet");
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };
let fontDelay = 0, blockRedirect = false;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const file = resolve(root, "." + decodeURIComponent(url.pathname) + (url.pathname.endsWith("/") ? "index.html" : ""));
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403); res.end(); return; }
    if (blockRedirect && url.pathname === "/assets/js/redirects.js") { res.writeHead(503); res.end(); return; }
    if (file.endsWith(".woff2") && fontDelay) await new Promise(done => setTimeout(done, fontDelay));
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(body);
  } catch (error) {
    if (error.code !== "ENOENT") { res.writeHead(500); res.end(String(error)); return; }
    res.writeHead(404, { "Content-Type": "text/html" }); res.end(await readFile(resolve(root, "404.html")));
  }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const receipts = [];
const pause = ms => new Promise(done => setTimeout(done, ms));
async function settle(evaluate) {
  for (let n = 0; n < 100; n++) {
    if (await evaluate('document.readyState === "complete"')) return;
    await pause(50);
  }
  throw new Error("Page did not finish loading");
}
const observe = `window.__auditShifts=[];window.__auditLcp=null;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__auditShifts.push({value:e.value,time:e.startTime,sources:e.sources.map(s=>s.node?.id||s.node?.tagName)})}).observe({type:'layout-shift',buffered:true});new PerformanceObserver(list=>{window.__auditLcp=list.getEntries().at(-1)?.startTime}).observe({type:'largest-contentful-paint',buffered:true});`;
async function browse(path, width, extra = {}) {
  const run = await browserSession(process.env.CHROME_BIN, async ({command,evaluate,events}) => {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: extra.pixelRatio || 1, mobile: extra.desktop ? false : width < 768 });
    if (extra.noJs) await command("Emulation.setScriptExecutionDisabled", { value: true });
    await command("Page.addScriptToEvaluateOnNewDocument", { source: observe });
    await command("Page.navigate", { url: origin + path }); await settle(evaluate);
    await evaluate("document.fonts.ready.then(()=>true)"); await pause(extra.performance ? 900 : 100);
    if(extra.pageScale)await command("Emulation.setPageScaleFactor",{pageScaleFactor:extra.pageScale});
    const state = await evaluate(`(()=>{const s=document.querySelector('.build-stamp');return {url:location.href,width:innerWidth,scroll:document.documentElement.scrollWidth,title:document.title,shifts:window.__auditShifts||[],fontStatus:document.fonts.status,stamp:s?{color:getComputedStyle(s).color,opacity:getComputedStyle(s).opacity,background:getComputedStyle(document.body).backgroundColor}:null,controls:[...document.querySelectorAll('button,input,select')].map(e=>({tag:e.tagName,type:e.type||'',id:e.id,label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,80)}))}})()`);
    assert.equal(state.width, width, "Requested viewport was not applied");
    state.headerHeight=await evaluate("document.querySelector('.site-header')?.getBoundingClientRect().height||0");
    // No-JS navigation deliberately exposes its links instead of a dead toggle.
    const headerBudget=extra.noJs?500:300;
    if(!path.startsWith('/simulations/')&&width<=960)assert.ok(state.headerHeight<=headerBudget,`Responsive header consumes the viewport: ${state.headerHeight}px`);
    state.visualViewport=await evaluate("({scale:visualViewport.scale,width:visualViewport.width,height:visualViewport.height,pixelRatio:devicePixelRatio})");
    state.performance=await evaluate("({fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,lcp:window.__auditLcp,fonts:performance.getEntriesByType('resource').filter(e=>e.name.endsWith('.woff2')).map(e=>({name:e.name.split('/').at(-1),start:e.startTime,duration:e.duration}))})");
    if(extra.pageScale)assert.equal(state.visualViewport.scale,extra.pageScale);
    if (path === "/") assert.ok(state.stamp && /Active Inference Institute/.test(state.title), "The real homepage must load before measuring it");
    assert.ok(state.scroll <= width + 1, `Horizontal overflow: ${path}: ${state.scroll}/${width}`);
    if (extra.keyboard) {
      await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", windowsVirtualKeyCode: 9 });
      await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", windowsVirtualKeyCode: 9 });
      state.firstFocus = await evaluate("({text:document.activeElement.textContent,href:document.activeElement.getAttribute('href'),outline:getComputedStyle(document.activeElement).outlineStyle})");
      assert.equal(state.firstFocus.href, "#main", "Keyboard first action must be the skip link");
    }
    if (controlsOnly && path.startsWith("/simulations/") && width===390) {
      const selectors={"Ink.html":[".env-panel",".stats-panel",".controls"],"fep_surprise.html":[".model-panel",".stats-panel",".controls"],"fep_tutorial.html":[".left-panel",".fish-viewport",".right-panel"],"t_maze_fep.html":[".tutorial-panel",".sim-area"],"dopamine_daniel.html":["#ui"],"self_evidencing_tree.html":["#hud","#fep-hud","#controls"],"tree_with_quiz.html":["#hud","#fep-hud","#controls"]}[path.split('/').at(-1)];
      if(selectors){
        const probe=`(()=>{const selectors=${JSON.stringify(selectors)};const rows=selectors.map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {selector:s,x:r.x,y:r.y,width:r.width,height:r.height,position:getComputedStyle(e).position}});return {rows,fit:rows.every(r=>r.width>0&&r.x>=-1&&r.x+r.width<=innerWidth+1&&!(r.position==='fixed'&&(r.y>=innerHeight||r.y+r.height<=0))),stacked:rows.every((r,i)=>!i||r.y>=rows[i-1].y+rows[i-1].height-1)}})()`;
        state.mobileLayout=await evaluate(probe);
        assert.ok(state.mobileLayout.fit&&state.mobileLayout.stacked,`Mobile panels overlap or leave the viewport: ${JSON.stringify(state.mobileLayout)}`);
        await evaluate("document.getElementById('institute-mobile-layout').media='not all'");
        await pause(450);
        state.mobileNegativeControl=await evaluate(probe);
        await evaluate("document.getElementById('institute-mobile-layout').media='all'");
        await pause(450);
        assert.ok(!state.mobileNegativeControl.fit||!state.mobileNegativeControl.stacked,`Original mobile layout must reproduce its failing panel geometry: ${path}: ${JSON.stringify(state.mobileNegativeControl)}`);
        const initial=await command("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
        await writeFile(resolve(output,path.split('/').at(-1)+"-initial-390.png"),Buffer.from(initial.data,"base64"));
        await evaluate(`document.querySelector(${JSON.stringify(selectors.at(-1))}).scrollIntoView({block:'center'})`);
        await pause(400);
        const panel=await command("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
        await writeFile(resolve(output,path.split('/').at(-1)+"-panels-390.png"),Buffer.from(panel.data,"base64"));
        await evaluate("scrollTo(0,0);document.querySelector('#tab1')?.scrollTo(0,0)");
      }
    }
    if (extra.exercise) {
      await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      const exercised = await evaluate(`(()=>{const result=[];for(const e of document.querySelectorAll('button,input[type=range],input[type=checkbox],select')){if(!e.getClientRects().length||e.disabled)continue; const label=e.getAttribute('aria-label')||e.id||e.textContent.trim().slice(0,60);if(e.tagName==='BUTTON'){if(e.id!=='tts-toggle'&&/start|pause|reset|step|random|clear|stop|play|run|update|theme|menu/i.test(label)){e.click();result.push(label)}}else if(e.type==='range'){e.value=(Number(e.min||0)+Number(e.max||100))/2;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));result.push(label)}else if(e.type==='checkbox'){e.click();result.push(label)}else if(e.options?.length>1){e.selectedIndex=1;e.dispatchEvent(new Event('change',{bubbles:true}));result.push(label)}}return result})()`);
      state.exercised = exercised; await pause(150);
      if (path.startsWith("/simulations/")) {
        state.controlGroups = await evaluate(`(()=>{const visited=[];const seen=new Set();const visible=e=>e.getClientRects().length&&!e.disabled;function group(){for(const e of document.querySelectorAll('input[type=range],input[type=checkbox],select')){if(!visible(e))continue;if(e.type==='range'){e.value=(Number(e.min||0)+Number(e.max||100))/2;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}else if(e.type==='checkbox')e.click();else if(e.options.length>1){e.selectedIndex=1;e.dispatchEvent(new Event('change',{bubbles:true}))}visited.push(e.id||e.tagName)}for(const b of document.querySelectorAll('button')){if(!visible(b)||b.id==='tts-toggle'||b.matches('.tab-btn')||seen.has(b)||/download|export|save|share/i.test(b.textContent))continue;seen.add(b);b.click();visited.push(b.id||b.textContent.trim().slice(0,60))}}group();for(const tab of document.querySelectorAll('.tab-btn')){tab.click();visited.push(tab.textContent.trim());group()}const next=document.getElementById('nextBtn');for(let i=0;next&&i<12&&!next.disabled;i++){next.click();visited.push('nextBtn');group()}const prev=document.getElementById('prevBtn');if(prev&&!prev.disabled){prev.click();visited.push('prevBtn')}return [...new Set(visited)]})()`);
        const canvas = await evaluate("(()=>{const c=document.querySelector('canvas');if(!c)return null;const r=c.getBoundingClientRect();if(r.width<1||r.height<1||r.top>=innerHeight)return null;return {x:r.left+r.width/2,y:r.top+Math.min(r.height/2,400)}})()");
        if(canvas){
          await command("Input.dispatchMouseEvent",{type:"mouseMoved",x:canvas.x,y:canvas.y});
          await command("Input.dispatchMouseEvent",{type:"mousePressed",x:canvas.x,y:canvas.y,button:"left",clickCount:1});
          await command("Input.dispatchMouseEvent",{type:"mouseReleased",x:canvas.x,y:canvas.y,button:"left",clickCount:1});
          state.canvasPointer=true;
        }
        await pause(700);
      }
      if(path==="/resources/"){
        state.resourceFilter=await evaluate(`(()=>{const q=document.getElementById('resource-search'),s=document.getElementById('resource-category');for(const other of document.querySelectorAll('#resource-type,#resource-audience,#resource-tag')){other.value='';other.dispatchEvent(new Event('change',{bubbles:true}))}q.value='zzznomatchaudit';q.dispatchEvent(new Event('input',{bubbles:true}));const zero=[...document.querySelectorAll('.resource-card[data-category]')].filter(c=>!c.hidden).length;q.value='';q.dispatchEvent(new Event('input',{bubbles:true}));const option=[...s.options].find(o=>/support/i.test(o.value+' '+o.textContent));if(!option)throw Error('Support option missing');s.value=option.value;s.dispatchEvent(new Event('change',{bubbles:true}));const shown=[...document.querySelectorAll('.resource-card[data-category]')].filter(c=>!c.hidden);return {zero,supportCount:shown.length,onlySupport:shown.every(c=>c.dataset.category===option.value)}})()`);
        assert.equal(state.resourceFilter.zero,0);assert.ok(state.resourceFilter.supportCount>0&&state.resourceFilter.onlySupport);
      }
    }
    if (extra.interactions) {
      const mobileToggle = await evaluate("(()=>{const b=document.getElementById('nav-toggle');if(getComputedStyle(b).display==='none')return false;b.click();return b.getAttribute('aria-expanded')==='true'})()");
      state.mobileMenuOpened=mobileToggle;
      await evaluate("document.querySelector('.nav-menu-button').focus()");
      assert.equal(await evaluate("document.querySelector('.nav-menu-button').getAttribute('aria-expanded')"), "false", "Focus alone must not advertise a hidden menu as expanded");
      await evaluate("document.querySelector('.nav-menu-button').click()");
      assert.equal(await evaluate("document.querySelector('.nav-menu-button').getAttribute('aria-expanded')"), "true");
      await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", windowsVirtualKeyCode: 27 });
      await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", windowsVirtualKeyCode: 27 });
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.nav-menu')).display"), "none", "Escape must dismiss the focused menu visually as well as in ARIA");
      await evaluate("document.querySelector('.lang-switcher summary').focus();document.querySelector('.lang-switcher summary').click()");
      assert.equal(await evaluate("document.querySelector('.lang-switcher').open"),true);
      await command("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",windowsVirtualKeyCode:27});
      await command("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",windowsVirtualKeyCode:27});
      assert.equal(await evaluate("document.querySelector('.lang-switcher').open"),false,"Escape must dismiss the language disclosure");
      state.contrast = await evaluate(`(async()=>{const out=[];for(let i=0;i<2;i++){await new Promise(done=>setTimeout(done,450));const s=document.querySelector('.build-stamp');const c=getComputedStyle(s),b=getComputedStyle(document.body);out.push({theme:document.documentElement.classList.contains('theme-light')?'light':'dark',color:c.color,background:b.backgroundColor,opacity:c.opacity});document.getElementById('theme-toggle').click()}return out})()`);
      const rgb = text => text.match(/[\d.]+/g).slice(0,3).map(Number);
      const lum = values => values.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
      for (const row of state.contrast) {
        const bg=rgb(row.background), color=rgb(row.color).map((c,i)=>c*Number(row.opacity)+bg[i]*(1-Number(row.opacity)));
        const a=lum(color),b=lum(bg);row.ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        assert.ok(row.ratio>=4.5, `Footer contrast failed: ${JSON.stringify(row)}`);
      }
      state.sound = await evaluate(`(()=>{const b=document.getElementById('tts-toggle');if(!b||b.hidden)return {available:false};b.click();const started=b.getAttribute('aria-pressed');b.click();speechSynthesis.cancel();return {available:true,started,stopped:b.getAttribute('aria-pressed')}})()`);
      if(state.sound.available)assert.equal(state.sound.stopped,"false");
      await pause(450);
    }
    if (extra.screenshot || (controlsOnly && path.startsWith("/simulations/"))) {
      const shot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      await writeFile(resolve(output, extra.screenshot || path.split('/').at(-1)+`-${width}.png`), Buffer.from(shot.data, "base64"));
    }
    state.errors = events.filter(e=>e.method === "Runtime.exceptionThrown").map(e=>e.params.exceptionDetails);
    state.consoleErrors=events.filter(e=>e.method==='Runtime.consoleAPICalled'&&e.params.type==='error').map(e=>e.params.args.map(a=>a.value||a.description).join(' '));
    assert.deepEqual(state.errors, [], `Browser runtime errors: ${path}`);
    assert.deepEqual(state.consoleErrors,[],`Browser console errors: ${path}`);
    return state;
  });
  receipts.push({ path, ...run.result }); return run.result;
}
try {
  if (quick) await browse("/",1440,{interactions:true});
  if(tabletOnly)for(const path of ['/','/ar/'])await browse(path,768,{keyboard:true,interactions:true,screenshot:path==='/'?'tablet-en.png':'tablet-ar.png'});
  if(zoomOnly){
    for(const scale of [2,4])await browse("/",390,{pageScale:scale,screenshot:`pinch-${scale}x.png`});
    for(const [width,ratio] of [[720,2],[360,4]])await browse("/",width,{desktop:true,pixelRatio:ratio,keyboard:true,screenshot:`desktop-reflow-${ratio}x.png`});
  }
  // Same browser version, cold profile, viewport and delayed font responses in
  // all six runs. This is a reproducible font-loading stress test, not PSI/CrUX.
  fontDelay = 600;
  if (!quick && !controlsOnly && !zoomOnly && !tabletOnly) for (const width of [390,1440]) for (let i=0;i<3;i++) await browse("/", width, { performance: true });
  fontDelay = 0;
  if (controlsOnly) {
    if(!simulationOnly)for(const path of ["/resources/","/directory/","/video/","/search/?q=zzznomatchaudit"])await browse(path,390,{exercise:true});
    const files=JSON.parse(await readFile(resolve(root,"data/redirects.json"),"utf8"));
    for(const path of [...new Set(files.filter(x=>x.to.startsWith("simulations/")&&(!simulationOnly||x.to==="simulations/"+simulationOnly)).map(x=>"/"+x.to))])for(const width of [390,1440])await browse(path,width,{exercise:true});
  }
  if (!baseline && !quick && !controlsOnly && !zoomOnly && !tabletOnly) {
    for (const [from,to] of [["/ru/internship/","/ru/programs/internship/"],["/fellowship/","/programs/fellowship/"],["/es/simulations/Ink.html","/simulations/Ink.html"]]) {
      const tail="?a=one%20two&a=%2F%26#next-actions%20encoded";
      const state=await browse(from+tail,390);
      assert.equal(state.url,origin+to+tail,"Redirect dropped or changed URL tails");
    }
    const noJs=await browse("/ru/internship/",390,{noJs:true});
    assert.equal(noJs.url,origin+"/ru/programs/internship/");
    blockRedirect=true;
    const blocked=await browse("/ru/internship/",390);
    assert.equal(blocked.url,origin+"/ru/internship/","Script failure must leave manual continuation available");
    blockRedirect=false;
    for (const width of [320,390,768,1440]) await browse("/",width,{keyboard:true,interactions:true,screenshot:`home-${width}.png`});
    for (const path of ["/resources/","/directory/","/search/?q=zzznomatchaudit","/calendar/","/ar/","/programs/fellowship/"]) await browse(path,390,{exercise:true});
    const files=JSON.parse(await readFile(resolve(root,"data/redirects.json"),"utf8"));
    const simulations=[...new Set(files.filter(x=>x.to.startsWith("simulations/")).map(x=>"/"+x.to))];
    assert.equal(simulations.length,12);
    for (const path of simulations) for (const width of [390,1440]) await browse(path,width,{exercise:true});
  }
  await writeFile(resolve(output,"browser-receipts.json"),JSON.stringify({baseline,scope:tabletOnly?"Measured 768 px English and Arabic responsive navigation":zoomOnly?"Measured 200/400% pinch scale and desktop reflow-equivalent widths; not desktop browser UI zoom":controlsOnly?"Targeted real-browser control groups":quick?"Targeted real-browser disclosure/contrast/audio acceptance":"Local real Chrome; six controlled cold font stress runs; no Google indexing or field performance claim",receipts},null,2));
  console.log(`Verified ${receipts.length} real-browser scenarios; evidence ${output}`);
} catch(error) {
  await writeFile(resolve(output,"browser-partial.json"),JSON.stringify({error:error.message,receipts},null,2));
  throw error;
} finally { await new Promise(done=>server.close(done)); }
