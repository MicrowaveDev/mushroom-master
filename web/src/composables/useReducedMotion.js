// Single source of truth for "should the UI animate?"
//
// Combines two signals:
//   1. System preference via matchMedia('(prefers-reduced-motion: reduce)').
//   2. In-app preference stored at state.bootstrap.settings.reducedMotion.
//
// Either being true → animations should be suppressed. This matches the
// established CSS behavior (media query + .reduced-motion class are both
// honored) and extends it to the JS layer (View Transitions, imperative
// motion) via a plain subscribe/getValue tracker that is vanilla-JS
// testable without a Vue runtime.

function getDefaultWindow() {
  return typeof window === 'undefined' ? null : window;
}

function readSystemPreference(win) {
  if (!win?.matchMedia) return false;
  try {
    return !!win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_error) {
    return false;
  }
}

function subscribeSystem(win, handler) {
  if (!win?.matchMedia) return () => {};
  let mql;
  try {
    mql = win.matchMedia('(prefers-reduced-motion: reduce)');
  } catch (_error) {
    return () => {};
  }
  // Older Safari uses addListener/removeListener; modern browsers use
  // addEventListener/removeEventListener. Support both.
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }
  if (typeof mql.addListener === 'function') {
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }
  return () => {};
}

export function createReducedMotionTracker({ win = getDefaultWindow() } = {}) {
  let appPreference = false;
  let systemPreference = readSystemPreference(win);
  const subscribers = new Set();

  function currentValue() {
    return appPreference || systemPreference;
  }

  function notify() {
    const value = currentValue();
    for (const subscriber of subscribers) {
      try {
        subscriber(value);
      } catch (_error) {
        // Subscriber errors must not prevent other subscribers from firing.
      }
    }
  }

  const unsubscribeSystem = subscribeSystem(win, (event) => {
    systemPreference = !!event?.matches;
    notify();
  });

  return {
    getValue: currentValue,
    setAppPreference(value) {
      const next = !!value;
      if (next === appPreference) return;
      appPreference = next;
      notify();
    },
    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    destroy() {
      unsubscribeSystem();
      subscribers.clear();
    }
  };
}

// Vue-facing composable. `syncWithRef(targetRef, readAppPreference)` wires
// the tracker to a reactive ref and to a getter for the app setting, so
// both CSS and JS read the same truth. Returns a cleanup fn.
export function bindReducedMotionTracker(tracker, { onChange, readAppPreference } = {}) {
  if (typeof readAppPreference === 'function') {
    tracker.setAppPreference(!!readAppPreference());
  }
  if (typeof onChange === 'function') {
    onChange(tracker.getValue());
    return tracker.subscribe(onChange);
  }
  return () => {};
}
