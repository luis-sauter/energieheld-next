import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {transpileModule,ModuleKind,JsxEmit} from 'typescript';
let states=[],refs=[],effects=[],cursor=0,refCursor=0,effectCursor=0,pending=[];
globalThis.__motionHooks={
 state(v){let i=cursor++;if(!(i in states))states[i]=v;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]},
 ref(v){let i=refCursor++;return refs[i]??=( {current:v} )},
 effect(fn,deps){let i=effectCursor++;if(!effects[i]||deps.some((d,j)=>d!==effects[i].deps[j]))pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()}})}
};
registerHooks({resolve(s,c,next){
 if(s==='react'&&(c.parentURL?.endsWith('/use-rotation-motion.ts') || c.parentURL?.endsWith('/image-gallery.tsx') || c.parentURL?.endsWith('/theme-scroller.tsx')))return{url:'data:text/javascript,'+encodeURIComponent('export const useCallback=f=>f,useState=v=>globalThis.__motionHooks.state(v),useRef=v=>globalThis.__motionHooks.ref(v),useEffect=(f,d)=>globalThis.__motionHooks.effect(f,d);'),shortCircuit:true};
 if(s==='next/image')return{url:'data:text/javascript,export default "img"',shortCircuit:true};
 if(s.endsWith('.module.css'))return{url:'data:text/javascript,export default {}',shortCircuit:true};
 if(s.startsWith('@/')||s.startsWith('.')){const b=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(existsSync(new URL(b.href+ext)))return next(b.href+ext,c)}return next(s,c);
},load(url,c,next){if(/\.tsx?$/.test(url))return{format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return next(url,c)}});
const {useRotationMotion}=await import('../src/components/portal/use-rotation-motion.ts');
const {nextThemeScroll,themeScrollerDelay,continuousThemeScroll,compactScrollSpeed,ThemeScroller}=await import('../src/components/portal/theme-scroller.tsx');
test('homepage navigation advances one card, wraps at either end and handles empty/nonoverflowing rails',()=>{
 assert.equal(themeScrollerDelay,3000);assert.equal(nextThemeScroll(0,300,900,1),300);assert.equal(nextThemeScroll(300,300,900,-1),0);assert.equal(nextThemeScroll(900,300,900,1),0);assert.equal(nextThemeScroll(0,300,900,-1),900);assert.equal(nextThemeScroll(0,300,0,1),0);
});
test('executed shared idle lifecycle respects 3 seconds, full restart and independent hover/focus/pointer/motion/visibility pauses',context=>{
 context.mock.timers.enable({apis:['setTimeout']});states=[];refs=[];effects=[];pending=[];
 const original={window:globalThis.window,document:globalThis.document,IntersectionObserver:globalThis.IntersectionObserver};
 let observe,changedMotion,changedTab,reduced=false,advanced=0;
 globalThis.window={matchMedia:()=>({get matches(){return reduced},addEventListener(_,f){changedMotion=f},removeEventListener(){}})};
 globalThis.document={hidden:false,addEventListener(_,f){changedTab=f},removeEventListener(){}};
 globalThis.IntersectionObserver=class{constructor(f){observe=f}observe(){}disconnect(){}};
 const advance=()=>advanced++;const Render=()=>{cursor=refCursor=effectCursor=0;const m=useRotationMotion(4,advance,0,3000);for(const fn of pending.splice(0))fn();return m};
 try{
  let m=Render();observe([{isIntersecting:true}]);m=Render();context.mock.timers.tick(2999);assert.equal(advanced,0);context.mock.timers.tick(1);assert.equal(advanced,1);
  m.interact();m=Render();context.mock.timers.tick(1000);m.handlers.onMouseEnter();m=Render();m.handlers.onFocusCapture();m=Render();m.handlers.onMouseLeave();m=Render();context.mock.timers.tick(10000);assert.equal(advanced,1,'focus must outlive mouse leave');
  m.handlers.onBlurCapture({currentTarget:{contains:()=>false},relatedTarget:null});m=Render();context.mock.timers.tick(2999);assert.equal(advanced,1);context.mock.timers.tick(1);assert.equal(advanced,2);
  for(const end of ['onPointerUp','onPointerCancel','onPointerLeave']){m.handlers.onPointerDown();m=Render();context.mock.timers.tick(5000);assert.equal(advanced,2);m.handlers[end]();m=Render();context.mock.timers.tick(1000);}
  reduced=true;changedMotion();m=Render();context.mock.timers.tick(10000);assert.equal(advanced,2);reduced=false;changedMotion();m=Render();
  globalThis.document.hidden=true;changedTab();m=Render();context.mock.timers.tick(10000);assert.equal(advanced,2);globalThis.document.hidden=false;changedTab();m=Render();
  observe([{isIntersecting:false}]);m=Render();context.mock.timers.tick(10000);assert.equal(advanced,2);observe([{isIntersecting:true}]);m=Render();m.toggle();m=Render();context.mock.timers.tick(10000);assert.equal(advanced,2);m.toggle();Render();context.mock.timers.tick(3000);assert.equal(advanced,3);
 }finally{effects.forEach(e=>e.cleanup?.());Object.assign(globalThis,original)}
});
test('both homepage areas use the same SSR child scroller and public labels retain technical theme keys',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const home=read('src/app/(energieheld)/page.tsx');assert.equal((home.match(/<ThemeScroller/g)||[]).length,2);assert.equal((home.match(/travelThemes\.map/g)||[]).length,2);assert.doesNotMatch(home,/quickThemes|featuredThemes/);assert.match(home,/discoveryAudiences\.map/);assert.match(home,/discoveryAudienceShortcuts\(terms\)/);assert.match(home,/href=\{`\/unterkuenfte-a-z\?thema=\$\{entry.slug\}`\}/);assert.match(home,/basePath="\/mottoreisen"/);
 const finder=read('src/components/portal/travel-finder.tsx');assert.match(finder,/key: "theme", label: "Motto", all: "Alle Mottoreisen"/);
 const css=read('src/components/portal/theme-scroller.module.css');assert.match(css,/overflow-x: auto/);assert.match(css,/max-width: 640px/);assert.match(css,/flex-basis: 100%/);assert.match(css,/focus-visible/);
 const component=read('src/components/portal/theme-scroller.tsx');
 assert.doesNotMatch(component,/fetch\(|supabase|Math.random|Automatisch|aria-pressed|onClick=\{toggle\}/);
 assert.match(component,/!compact && <div className=\{styles.header\}/);
 assert.match(component,/\{heading\}[\s\S]*styles.controls[\s\S]*\{moreLink\}[\s\S]*zurück[\s\S]*weiter/);
 assert.match(css,/scrollbar-width: none/);assert.match(css,/::-webkit-scrollbar \{ display: none/);
 assert.match(css,/data-theme-image.*:is\(:hover, :focus-visible\)/);assert.match(css,/rgb\(14 68 96 \/ 72%\)/);assert.match(css,/color: white/);assert.match(css,/travel-quicklink-icon\) \{ color: inherit; background: rgb\(14 68 96 \/ 60%\)/);
 assert.match(home,/loading="lazy"/);assert.match(home,/alt="" fill/);
 assert.match(css,/transition: none/);assert.match(css,/transform: none/);
});

test('executed gallery keeps hover, focus and pointer pauses independent and advances only after two idle seconds',async context=>{
 const {ImageGallery}=await import('../src/components/portal/image-gallery.tsx');
 context.mock.timers.enable({apis:['setTimeout']});states=[];refs=[];effects=[];pending=[];
 const original=globalThis.window;let change,reduced=false;
 globalThis.window={setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,matchMedia:()=>({get matches(){return reduced},addEventListener(_,fn){change=fn},removeEventListener(){}})};
 const Render=()=>{cursor=refCursor=effectCursor=0;const tree=ImageGallery({images:[{src:'/a.jpg',alt:'A'},{src:'/b.jpg',alt:'B'}]});for(const fn of pending.splice(0))fn();return tree};
 try{let tree=Render();tree=Render();context.mock.timers.tick(1999);assert.equal(states[0],0);context.mock.timers.tick(1);assert.equal(states[0],1);tree=Render();
 tree.props.onMouseEnter();tree=Render();tree.props.onFocusCapture();tree=Render();tree.props.onMouseLeave();tree=Render();context.mock.timers.tick(5000);assert.equal(states[0],1);
 tree.props.onBlurCapture({currentTarget:{contains:()=>false},relatedTarget:null});tree=Render();tree.props.onPointerDown();tree=Render();context.mock.timers.tick(5000);assert.equal(states[0],1);tree.props.onPointerCancel();Render();context.mock.timers.tick(2000);assert.equal(states[0],0);
 reduced=true;change();Render();context.mock.timers.tick(5000);assert.equal(states[0],0);
 }finally{effects.forEach(e=>e.cleanup?.());globalThis.window=original}
});


test('compact motion is time-based, fractional, slow and reverses without endpoint jumps',()=>{
 assert.equal(compactScrollSpeed,18);
 assert.deepEqual(continuousThemeScroll(0,1,100,1),{left:18,direction:1});
 assert.ok(continuousThemeScroll(0,1/60,100,1).left<1);
 assert.deepEqual(continuousThemeScroll(99,1,100,1),{left:100,direction:-1});
 assert.deepEqual(continuousThemeScroll(1,1,100,-1),{left:0,direction:1});
});
test('executed compact animation accumulates subpixels without React frame updates and stops for hover, focus, pointer and reduced motion',()=>{
 states=[];refs=[];effects=[];pending=[];
 const old={window:globalThis.window,document:globalThis.document,IntersectionObserver:globalThis.IntersectionObserver,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
 let observe,change,reduced=false,frame,frames=0,cancelled=0;
 globalThis.window={matchMedia:()=>({get matches(){return reduced},addEventListener(_,f){change=f},removeEventListener(){}})};
 globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
 globalThis.IntersectionObserver=class{constructor(f){observe=f}observe(){}disconnect(){}};
 globalThis.requestAnimationFrame=f=>{frame=f;return ++frames};globalThis.cancelAnimationFrame=()=>{frame=null;cancelled++};
 const rail={scrollLeft:0,scrollWidth:900,clientWidth:300};
 const render=()=>{cursor=refCursor=effectCursor=0;const tree=ThemeScroller({count:12,label:'Mottoreisen',compact:true});refs[0].current=rail;states[1]=true;for(const f of pending.splice(0))f();return tree};
 try{let t=render();observe([{isIntersecting:true}]);t=render();assert.ok(frame);frame(0);for(let time=16;time<=1600;time+=16)frame(time);assert.ok(rail.scrollLeft>28&&rail.scrollLeft<30);const before=rail.scrollLeft;
 for(const pause of ['onMouseEnter','onFocusCapture','onPointerDown']){t.props[pause]();t=render();assert.equal(frame,null);assert.equal(rail.scrollLeft,before);if(pause==='onMouseEnter')t.props.onMouseLeave();if(pause==='onFocusCapture')t.props.onBlurCapture({currentTarget:{contains:()=>false},relatedTarget:null});if(pause==='onPointerDown')t.props.onPointerUp();t=render();assert.ok(frame);}
 reduced=true;change();render();assert.equal(frame,null);assert.ok(cancelled>=4);
 }finally{effects.forEach(e=>e.cleanup?.());Object.assign(globalThis,old)}
});
