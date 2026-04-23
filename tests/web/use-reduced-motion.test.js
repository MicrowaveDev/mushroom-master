import test from 'node:test';
import assert from 'node:assert/strict';
import { createReducedMotionTracker } from '../../web/src/composables/useReducedMotion.js';

function makeWindow({ systemReduced = false } = {}) {
  const listeners = new Set();
  const mql = {
    matches: systemReduced,
    addEventListener(event, handler) {
      if (event === 'change') listeners.add(handler);
    },
    removeEventListener(event, handler) {
      if (event === 'change') listeners.delete(handler);
    }
  };
  return {
    win: {
      matchMedia: (_query) => mql
    },
    fireSystemChange(nextMatches) {
      mql.matches = nextMatches;
      for (const l of listeners) l({ matches: nextMatches });
    },
    listenerCount: () => listeners.size
  };
}

test('[reduced-motion][AC1] system preference alone yields true', () => {
  const { win } = makeWindow({ systemReduced: true });
  const tracker = createReducedMotionTracker({ win });
  assert.equal(tracker.getValue(), true);
  tracker.destroy();
});

test('[reduced-motion][AC2] app preference alone yields true', () => {
  const { win } = makeWindow({ systemReduced: false });
  const tracker = createReducedMotionTracker({ win });
  assert.equal(tracker.getValue(), false);
  tracker.setAppPreference(true);
  assert.equal(tracker.getValue(), true);
  tracker.destroy();
});

test('[reduced-motion][AC5] truth table — neither yields false', () => {
  const { win } = makeWindow({ systemReduced: false });
  const tracker = createReducedMotionTracker({ win });
  assert.equal(tracker.getValue(), false);
  tracker.destroy();
});

test('[reduced-motion][AC5] truth table — both yields true', () => {
  const { win } = makeWindow({ systemReduced: true });
  const tracker = createReducedMotionTracker({ win });
  tracker.setAppPreference(true);
  assert.equal(tracker.getValue(), true);
  tracker.destroy();
});

test('[reduced-motion][AC3] system change fires subscribers', () => {
  const harness = makeWindow({ systemReduced: false });
  const tracker = createReducedMotionTracker({ win: harness.win });
  const seen = [];
  const unsubscribe = tracker.subscribe((v) => seen.push(v));
  harness.fireSystemChange(true);
  harness.fireSystemChange(false);
  assert.deepEqual(seen, [true, false]);
  unsubscribe();
  tracker.destroy();
});

test('[reduced-motion][AC3] app change fires subscribers (dedup identical writes)', () => {
  const { win } = makeWindow({ systemReduced: false });
  const tracker = createReducedMotionTracker({ win });
  const seen = [];
  tracker.subscribe((v) => seen.push(v));
  tracker.setAppPreference(true);
  tracker.setAppPreference(true); // no-op
  tracker.setAppPreference(false);
  assert.deepEqual(seen, [true, false]);
  tracker.destroy();
});

test('[reduced-motion][AC4] SSR-safe: no window does not throw', () => {
  assert.doesNotThrow(() => {
    const tracker = createReducedMotionTracker({ win: null });
    assert.equal(tracker.getValue(), false);
    tracker.setAppPreference(true);
    assert.equal(tracker.getValue(), true);
    tracker.destroy();
  });
});

test('[reduced-motion] destroy detaches system listener and clears subscribers', () => {
  const harness = makeWindow({ systemReduced: false });
  const tracker = createReducedMotionTracker({ win: harness.win });
  assert.equal(harness.listenerCount(), 1);
  const calls = [];
  tracker.subscribe((v) => calls.push(v));
  tracker.destroy();
  assert.equal(harness.listenerCount(), 0);
  // After destroy, system changes should not reach ex-subscribers.
  harness.fireSystemChange(true);
  assert.deepEqual(calls, []);
});

test('[reduced-motion] legacy Safari-style addListener/removeListener is supported', () => {
  const listeners = new Set();
  const mql = {
    matches: false,
    addListener(handler) { listeners.add(handler); },
    removeListener(handler) { listeners.delete(handler); }
  };
  const win = { matchMedia: () => mql };
  const tracker = createReducedMotionTracker({ win });
  const seen = [];
  tracker.subscribe((v) => seen.push(v));
  // Simulate legacy change event shape.
  for (const l of listeners) l({ matches: true });
  assert.deepEqual(seen, [true]);
  tracker.destroy();
  assert.equal(listeners.size, 0);
});
