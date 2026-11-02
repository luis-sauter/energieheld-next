import test from 'node:test';
import assert from 'node:assert/strict';
import {equalPremiumCards} from '../src/components/portal/equal-premium-cards.ts';

function environment(context){
 let queued,resize,mutate,css='',width=900,heights=[238,276,337],disconnected=0;
 context.mock.method(globalThis,'requestAnimationFrame',fn=>{queued=fn;return 1;});
 context.mock.method(globalThis,'cancelAnimationFrame',()=>{queued=undefined;});
 const previous={ResizeObserver:globalThis.ResizeObserver,MutationObserver:globalThis.MutationObserver,document:globalThis.document};
 globalThis.ResizeObserver=class {constructor(fn){resize=fn;}observe(){}disconnect(){disconnected++;}};
 globalThis.MutationObserver=class {constructor(fn){mutate=fn;}observe(){}disconnect(){disconnected++;}};
 globalThis.document={fonts:{ready:Promise.resolve()}};
 const root={style:{setProperty(_,value){css=value;},removeProperty(){css='';}},getBoundingClientRect:()=>({width}),
  querySelectorAll(selector){assert.equal(selector,'.listing-row--premium');return heights.map(height=>({getBoundingClientRect:()=>({height:Math.max(height,parseFloat(css)||0)})}));}};
 context.after(()=>Object.assign(globalThis,previous));
 return {root,resize:()=>resize(),mutate:()=>mutate(),flush(){const fn=queued;queued=undefined;fn?.();},get queued(){return Boolean(queued)},get height(){return css},get disconnected(){return disconnected},set widths(v){width=v;},set heights(v){heights=v;}};
}

// Native browser globals are provided just for this standalone lifecycle test.
globalThis.requestAnimationFrame??=()=>0;
globalThis.cancelAnimationFrame??=()=>{};
test('premium cards follow the tallest natural content after paging, filtering and responsive reflow without retaining a stale maximum',async context=>{
 const e=environment(context),cleanup=equalPremiumCards(e.root);e.flush();assert.equal(e.height,'337px');
 e.heights=[238,337,403.3];e.mutate();e.flush();assert.equal(e.height,'404px');
 e.heights=[245,260];e.mutate();e.flush();assert.equal(e.height,'260px','filtering must shrink the shared height again');
 e.widths=360;e.heights=[820,912];e.resize();e.flush();assert.equal(e.height,'912px');
 e.resize();assert.equal(e.queued,false,'height-only resize notifications must not schedule a feedback loop');
 await Promise.resolve();e.flush();cleanup();assert.equal(e.disconnected,2);assert.equal(e.height,'');
});
test('unmount cancels scheduled work and late font readiness cannot restart detached observers',async context=>{
 const e=environment(context),cleanup=equalPremiumCards(e.root);assert(e.queued);cleanup();
 await Promise.resolve();assert.equal(e.queued,false);assert.equal(e.height,'');assert.equal(e.disconnected,2);
});
