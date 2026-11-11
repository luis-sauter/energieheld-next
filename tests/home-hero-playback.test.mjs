import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind } from 'typescript';

const code = transpileModule(readFileSync(new URL('../src/lib/home-hero-playback.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ModuleKind.ESNext } }).outputText;
const { observeHeroPlayback } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

function fixture(t, { complete = false, observer = true, ...network } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const motion = Object.assign(new EventTarget(), { matches: false });
  const connection = Object.assign(new EventTarget(), network);
  const page = Object.assign(new EventTarget(), { readyState: complete ? 'complete' : 'loading', hidden: false });
  const states = [];
  let intersect;
  let disconnected = false;
  const browser = Object.assign(new EventTarget(), {
    matchMedia: () => motion,
    IntersectionObserver: observer ? class {
      constructor(callback) { intersect = visible => callback([{ isIntersecting: visible }]); }
      observe() {}
      disconnect() { disconnected = true; }
    } : undefined,
  });
  const stop = observeHeroPlayback({ setAttribute() {} }, value => states.push(value), browser, page, connection);
  t.after(stop);
  return { browser, page, connection, motion, states, stop, disconnected: () => disconnected,
    visible: value => intersect?.(value), tick: () => t.mock.timers.tick(1500),
    event: (target, type) => target.dispatchEvent(new Event(type)) };
}

test('waits for both page load and visible hero before downloading motion', t => {
  const f = fixture(t);
  f.visible(true); f.tick(); assert.deepEqual(f.states, []);
  f.event(f.browser, 'load'); f.tick(); assert.deepEqual(f.states, [true]);
});
test('does not load a hero below the viewport, pauses and resumes without another mount', t => {
  const f = fixture(t, { complete: true });
  f.tick(); assert.deepEqual(f.states, []);
  f.visible(true); f.tick(); f.visible(false);
  assert.deepEqual(f.states, [true, false]);
  f.visible(true); f.tick(); assert.deepEqual(f.states, [true, false, true]);
});
for (const network of [{ saveData: true }, { effectiveType: 'slow-2g' }, { effectiveType: '2g' }, { effectiveType: '3g' }]) {
  test(`uses poster only on constrained connection ${JSON.stringify(network)}`, t => {
    const f = fixture(t, { complete: true, ...network });
    f.visible(true); f.tick(); assert.deepEqual(f.states, []);
  });
}
test('visibility and motion preferences cancel pending starts and pause playback', t => {
  const f = fixture(t, { complete: true });
  f.visible(true); f.page.hidden = true; f.event(f.page, 'visibilitychange');
  f.tick(); assert.deepEqual(f.states, []);
  f.page.hidden = false; f.event(f.page, 'visibilitychange'); f.tick();
  f.motion.matches = true; f.event(f.motion, 'change'); f.tick();
  assert.deepEqual(f.states, [true, false]);
});
test('connection changes cancel a pending start and allow later recovery', t => {
  const f = fixture(t, { complete: true });
  f.visible(true); f.connection.saveData = true; f.event(f.connection, 'change');
  f.tick(); assert.deepEqual(f.states, []);
  f.connection.saveData = false; f.event(f.connection, 'change'); f.tick();
  assert.deepEqual(f.states, [true]);
});
test('cleanup disconnects observation and removes timers and listeners', t => {
  const f = fixture(t, { complete: true });
  f.visible(true); f.stop(); f.tick();
  f.event(f.browser, 'load'); f.event(f.page, 'visibilitychange');
  f.event(f.motion, 'change'); f.event(f.connection, 'change'); f.tick();
  assert.equal(f.disconnected(), true); assert.deepEqual(f.states, []);
});
test('older browsers without intersection observer retain video after load', t => {
  const f = fixture(t, { complete: true, observer: false });
  f.tick(); assert.deepEqual(f.states, [true]);
});
