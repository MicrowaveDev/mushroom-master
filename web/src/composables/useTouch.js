/**
 * Pointer-first artifact drag-and-drop composable.
 *
 * Uses Pointer Events for mouse, pen, and touch in modern WebViews. Touch
 * events remain as the fallback for older WebViews.
 *
 * Usage: call `attachTouch(rootEl)` in onMounted with the app's root DOM element.
 */
export function useTouch(state) {
  let dragEl = null;
  let ghostEl = null;
  let startX = 0;
  let startY = 0;
  let moved = false;
  let activePointerId = null;
  let usingPointerEvents = false;

  function findDraggable(el) {
    if (el?.closest?.('.artifact-piece-rotate')) return null;
    let node = el;
    while (node && node !== document.body) {
      if (node.dataset?.artifactId) {
        if (node.getAttribute('aria-disabled') === 'true') return null;
        if (node.dataset.artifactDraggable === 'false') return null;
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function findDropZone(x, y) {
    // Temporarily hide the ghost so elementFromPoint can see through it
    if (ghostEl) ghostEl.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    if (ghostEl) ghostEl.style.display = '';
    if (!el) return null;

    // Walk up to find a drop zone
    let node = el;
    while (node && node !== document.body) {
      // Grid cell
      if (node.dataset?.cellX !== undefined && node.dataset?.cellY !== undefined) {
        return { type: 'cell', x: Number(node.dataset.cellX), y: Number(node.dataset.cellY), el: node };
      }
      // Sell zone
      if (node.classList?.contains('sell-zone')) {
        return { type: 'sell', el: node };
      }
      // Container zone
      if (node.classList?.contains('artifact-container-zone')) {
        return { type: 'container', el: node };
      }
      // Shop zone
      if (node.classList?.contains('artifact-shop')) {
        return { type: 'shop', el: node };
      }
      node = node.parentElement;
    }
    return null;
  }

  function createGhost(el, x, y) {
    const rect = el.getBoundingClientRect();
    ghostEl = el.cloneNode(true);
    ghostEl.classList.add('touch-drag-ghost');
    ghostEl.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      opacity: 0.8;
      pointer-events: none;
      z-index: 9999;
      transition: none;
      will-change: transform;
    `;
    document.body.appendChild(ghostEl);
    startX = x - rect.left;
    startY = y - rect.top;
  }

  function moveGhost(x, y) {
    if (!ghostEl) return;
    const left = Number.parseFloat(ghostEl.style.left) || 0;
    const top = Number.parseFloat(ghostEl.style.top) || 0;
    ghostEl.style.transform = `translate3d(${x - startX - left}px, ${y - startY - top}px, 0) scale(1.05)`;
  }

  function removeGhost() {
    if (ghostEl) {
      ghostEl.remove();
      ghostEl = null;
    }
  }

  function inferSource(el) {
    let node = el;
    while (node && node !== document.body) {
      if (node.classList?.contains('artifact-shop-items') || node.classList?.contains('artifact-shop')) return 'shop';
      if (node.classList?.contains('artifact-container-zone') || node.classList?.contains('artifact-container-items')) return 'container';
      if (node.classList?.contains('artifact-grid-pieces') || node.classList?.contains('inventory-shell')) return 'inventory';
      node = node.parentElement;
    }
    return '';
  }

  function inferArtifactId(el) {
    let node = el;
    while (node && node !== document.body) {
      if (node.dataset?.artifactId) return node.dataset.artifactId;
      node = node.parentElement;
    }
    return '';
  }

  function inferArtifactItem(el, artifactId) {
    let node = el;
    while (node && node !== document.body) {
      const data = node.dataset || {};
      if (data.artifactId) {
        if (data.artifactX !== undefined && data.artifactY !== undefined) {
          return {
            id: data.artifactRowId || undefined,
            artifactId: data.artifactId,
            x: Number(data.artifactX),
            y: Number(data.artifactY),
            width: Number(data.artifactWidth),
            height: Number(data.artifactHeight),
            bagId: data.artifactBagId || null
          };
        }
        if (data.artifactRowId) {
          return { id: data.artifactRowId, artifactId: data.artifactId };
        }
      }
      node = node.parentElement;
    }
    return artifactId ? { artifactId } : null;
  }

  function setDraggingState(target) {
    const artifactId = inferArtifactId(target);
    const source = inferSource(target);
    if (!artifactId || !source) return;
    state.draggingArtifactId = artifactId;
    state.draggingSource = source;
    state.draggingItem = source === 'shop' ? null : inferArtifactItem(target, artifactId);
  }

  function onTouchStart(e) {
    const target = findDraggable(e.target);
    if (!target) return;

    const touch = e.touches[0];
    dragEl = target;
    moved = false;
    startX = touch.clientX;
    startY = touch.clientY;

    setDraggingState(target);
  }

  function onTouchMove(e) {
    if (!dragEl) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - startX);
    const dy = Math.abs(touch.clientY - startY);

    if (!moved && (dx > 8 || dy > 8)) {
      moved = true;
      createGhost(dragEl, touch.clientX, touch.clientY);
    }

    if (moved) {
      e.preventDefault(); // prevent scroll while dragging
      moveGhost(touch.clientX, touch.clientY);

      // Highlight sell zone
      const zone = findDropZone(touch.clientX, touch.clientY);
      state.sellDragOver = zone?.type === 'sell';
    }
  }

  function onTouchEnd(e) {
    if (!dragEl || !moved) {
      dragEl = null;
      removeGhost();
      state.draggingArtifactId = '';
      state.draggingItem = null;
      state.draggingSource = '';
      return;
    }

    const touch = e.changedTouches[0];
    const zone = findDropZone(touch.clientX, touch.clientY);

    if (zone) {
      // Dispatch a synthetic drop based on zone type
      if (zone.type === 'cell') {
        zone.el.dispatchEvent(new CustomEvent('drop', {
          bubbles: true,
          detail: { x: zone.x, y: zone.y, touchDrop: true }
        }));
        // Also dispatch the grid board's cell-drop
        const gridBoard = zone.el.closest('.artifact-grid-board');
        if (gridBoard) {
          // The ArtifactGridBoard component handles cell-drop via @drop on cells;
          // also trigger the Vue event system with a custom event.
          const cellDropEvent = new CustomEvent('cell-drop-touch', {
            bubbles: true,
            detail: { x: zone.x, y: zone.y }
          });
          zone.el.dispatchEvent(cellDropEvent);
        }
      } else if (zone.type === 'sell') {
        zone.el.dispatchEvent(new Event('drop', { bubbles: true }));
      } else if (zone.type === 'container') {
        zone.el.dispatchEvent(new Event('drop', { bubbles: true }));
      } else if (zone.type === 'shop') {
        zone.el.dispatchEvent(new Event('drop', { bubbles: true }));
      }
    }

    // Cleanup
    removeGhost();
    state.sellDragOver = false;
    state.draggingArtifactId = '';
    state.draggingItem = null;
    state.draggingSource = '';
    dragEl = null;
    moved = false;
  }

  function onPointerDown(e) {
    const target = findDraggable(e.target);
    if (!target) return;

    dragEl = target;
    moved = false;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;

    setDraggingState(target);

    if (typeof target.setPointerCapture === 'function') {
      try { target.setPointerCapture(e.pointerId); } catch (_error) {}
    }
  }

  function onPointerMove(e) {
    if (!dragEl || e.pointerId !== activePointerId) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);

    if (!moved && (dx > 8 || dy > 8)) {
      moved = true;
      createGhost(dragEl, e.clientX, e.clientY);
    }

    if (moved) {
      e.preventDefault();
      moveGhost(e.clientX, e.clientY);
      const zone = findDropZone(e.clientX, e.clientY);
      state.sellDragOver = zone?.type === 'sell';
    }
  }

  function dispatchDropForZone(zone) {
    if (!zone) return;
    if (zone.type === 'cell') {
      zone.el.dispatchEvent(new CustomEvent('drop', {
        bubbles: true,
        detail: { x: zone.x, y: zone.y, touchDrop: true }
      }));
      zone.el.dispatchEvent(new CustomEvent('cell-drop-touch', {
        bubbles: true,
        detail: { x: zone.x, y: zone.y }
      }));
    } else {
      zone.el.dispatchEvent(new Event('drop', { bubbles: true }));
    }
  }

  function clearPointerDrag(target) {
    if (target && activePointerId != null && typeof target.releasePointerCapture === 'function') {
      try { target.releasePointerCapture(activePointerId); } catch (_error) {}
    }
    removeGhost();
    state.sellDragOver = false;
    state.draggingArtifactId = '';
    state.draggingSource = '';
    dragEl = null;
    activePointerId = null;
    moved = false;
  }

  function onPointerUp(e) {
    if (!dragEl || e.pointerId !== activePointerId) return;
    if (moved) {
      const zone = findDropZone(e.clientX, e.clientY);
      dispatchDropForZone(zone);
    }
    clearPointerDrag(dragEl);
  }

  function onPointerCancel(e) {
    if (e.pointerId !== activePointerId) return;
    clearPointerDrag(dragEl);
  }

  function attachTouch(rootEl) {
    if (!rootEl) return;
    usingPointerEvents = typeof window !== 'undefined' && 'PointerEvent' in window;
    if (usingPointerEvents) {
      rootEl.addEventListener('pointerdown', onPointerDown, { passive: true });
      rootEl.addEventListener('pointermove', onPointerMove, { passive: false });
      rootEl.addEventListener('pointerup', onPointerUp, { passive: true });
      rootEl.addEventListener('pointercancel', onPointerCancel, { passive: true });
      return;
    }
    rootEl.addEventListener('touchstart', onTouchStart, { passive: true });
    rootEl.addEventListener('touchmove', onTouchMove, { passive: false });
    rootEl.addEventListener('touchend', onTouchEnd, { passive: true });
  }

  function detachTouch(rootEl) {
    if (!rootEl) return;
    if (usingPointerEvents) {
      rootEl.removeEventListener('pointerdown', onPointerDown);
      rootEl.removeEventListener('pointermove', onPointerMove);
      rootEl.removeEventListener('pointerup', onPointerUp);
      rootEl.removeEventListener('pointercancel', onPointerCancel);
      usingPointerEvents = false;
      return;
    }
    rootEl.removeEventListener('touchstart', onTouchStart);
    rootEl.removeEventListener('touchmove', onTouchMove);
    rootEl.removeEventListener('touchend', onTouchEnd);
  }

  return { attachTouch, detachTouch };
}
