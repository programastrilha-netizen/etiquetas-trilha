/** Direct manipulation for the existing SVG poster. All coordinates are SVG units. */
export class VisualEditor {
  constructor({
    container,
    getEdit = () => ({}),
    onSelect = () => {},
    onStart = () => {},
    onChange = () => {},
    onCommit = () => {},
  }) {
    if (!(container instanceof HTMLElement))
      throw new TypeError("O editor precisa de um contêiner HTML.");
    Object.assign(this, {
      container,
      getEdit,
      onSelect,
      onStart,
      onChange,
      onCommit,
    });
    this.selectedId = null;
    this.svg = null;
    this.pointer = null;
    this.destroyed = false;
    this.frame = 0;
    this.previousStyles = {
      position: container.style.position,
      touchAction: container.style.touchAction,
      userSelect: container.style.userSelect,
    };
    this.previousTabindex = container.getAttribute("tabindex");
    if (getComputedStyle(container).position === "static")
      container.style.position = "relative";
    container.style.touchAction = "none";
    container.style.userSelect = "none";
    if (!container.hasAttribute("tabindex")) container.tabIndex = 0;
    this.box = document.createElement("div");
    this.box.className = "selection-box";
    Object.assign(this.box.style, {
      position: "absolute",
      boxSizing: "border-box",
      pointerEvents: "none",
    });
    this.box.hidden = true;
    this.handle = document.createElement("button");
    this.handle.type = "button";
    this.handle.className = "selection-handle";
    this.handle.dataset.editorHandle = "resize";
    this.handle.setAttribute(
      "aria-label",
      "Redimensionar proporcionalmente o elemento selecionado",
    );
    this.handle.title = "Arraste para redimensionar sem deformar";
    this.handle.textContent = "↘";
    Object.assign(this.handle.style, {
      position: "absolute",
      right: "-7px",
      bottom: "-7px",
      pointerEvents: "auto",
      touchAction: "none",
    });
    this.box.append(this.handle);
    this.handlers = {
      down: (event) => this._pointerDown(event),
      move: (event) => this._pointerMove(event),
      up: (event) => this._pointerEnd(event),
      cancel: (event) => this._pointerEnd(event),
      lost: (event) => {
        if (this.pointer && this.pointer.pointerId === event.pointerId)
          this._pointerEnd(event);
      },
      key: (event) => this._keyDown(event),
      layout: () => this._scheduleOverlay(),
      drag: (event) => {
        if (event.target instanceof Element && event.target.closest("svg"))
          event.preventDefault();
      },
    };
    container.addEventListener("pointerdown", this.handlers.down);
    container.addEventListener("pointermove", this.handlers.move);
    container.addEventListener("pointerup", this.handlers.up);
    container.addEventListener("pointercancel", this.handlers.cancel);
    container.addEventListener("lostpointercapture", this.handlers.lost);
    container.addEventListener("dragstart", this.handlers.drag);
    document.addEventListener("keydown", this.handlers.key);
    window.addEventListener("resize", this.handlers.layout);
    window.addEventListener("scroll", this.handlers.layout, {
      capture: true,
      passive: true,
    });
    if (typeof ResizeObserver !== "undefined")
      this.observer = new ResizeObserver(this.handlers.layout);
    this.observer?.observe(container);
    this.refresh();
    document.fonts?.ready.then(() => {
      if (!this.destroyed) this._scheduleOverlay();
    });
  }

  refresh() {
    if (this.destroyed) return;
    const next = this.container.querySelector("svg");
    if (next !== this.svg) {
      if (this.svg) this.observer?.unobserve(this.svg);
      this.svg = next;
      if (next) this.observer?.observe(next);
    }
    if (this.box.parentElement !== this.container)
      this.container.append(this.box);
    this._positionOverlay();
  }

  select(id) {
    const next = id == null ? null : String(id);
    const changed = next !== this.selectedId;
    this.selectedId = next;
    if (changed) this.onSelect(next);
    this._positionOverlay();
    return this.selectedId;
  }

  _find(id = this.selectedId) {
    if (!this.svg || id == null) return null;
    return (
      [...this.svg.querySelectorAll("[data-element]")].find(
        (element) => element.dataset.element === id,
      ) || null
    );
  }

  _point(event) {
    const matrix = this.svg?.getScreenCTM();
    if (!matrix) return null;
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
  }

  _canvasBounds() {
    const box = this.svg.viewBox.baseVal;
    return {
      x: box.x,
      y: box.y,
      width: box.width || 600,
      height: box.height || 849,
    };
  }

  _geometry(element) {
    const rootMatrix = this.svg?.getScreenCTM(),
      matrix = element.getScreenCTM();
    if (!rootMatrix || !matrix) return null;
    const relative = rootMatrix.inverse().multiply(matrix),
      box = element.getBBox();
    const corners = [
      [box.x, box.y],
      [box.x + box.width, box.y],
      [box.x, box.y + box.height],
      [box.x + box.width, box.y + box.height],
    ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(relative));
    const x = Math.min(...corners.map((point) => point.x)),
      y = Math.min(...corners.map((point) => point.y));
    const width = Math.max(...corners.map((point) => point.x)) - x,
      height = Math.max(...corners.map((point) => point.y)) - y;
    const baseX = Number(element.dataset.baseCx),
      baseY = Number(element.dataset.baseCy);
    const center = new DOMPoint(
      Number.isFinite(baseX) ? baseX : box.x + box.width / 2,
      Number.isFinite(baseY) ? baseY : box.y + box.height / 2,
    ).matrixTransform(relative);
    return { x, y, width, height, center };
  }

  _number(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }
  _round(value) {
    return Math.round(value * 1000) / 1000;
  }

  _pointerDown(event) {
    if (
      this.destroyed ||
      this.pointer ||
      event.button !== 0 ||
      event.isPrimary === false ||
      !this.svg
    )
      return;
    const resize =
      event.target instanceof Element &&
      !!event.target.closest('[data-editor-handle="resize"]');
    const target = resize
      ? this._find()
      : event.target instanceof Element
        ? event.target.closest("[data-element]")
        : null;
    if (!target || target.ownerSVGElement !== this.svg) {
      if (!resize) this.select(null);
      return;
    }
    const id = target.dataset.element,
      start = this._point(event),
      bounds = this._geometry(target);
    if (!start || !bounds) return;
    const edit = this.getEdit(id) || {};
    const initial = {
      x: this._number(edit.x),
      y: this._number(edit.y),
      scale: Math.max(0.2, Math.min(4, this._number(edit.scale, 1))),
    };
    this.pointer = {
      pointerId: event.pointerId,
      id,
      mode: resize ? "resize" : "move",
      start,
      clientX: event.clientX,
      clientY: event.clientY,
      bounds,
      initial,
      started: false,
      patch: null,
    };
    event.preventDefault();
    this.container.focus({ preventScroll: true });
    try {
      this.container.setPointerCapture(event.pointerId);
    } catch {
      /* Detached synthetic pointers need no capture. */
    }
    this.select(id);
  }

  _visibleCorrection(bounds) {
    const canvas = this._canvasBounds(),
      insetX = Math.min(16, bounds.width / 2),
      insetY = Math.min(16, bounds.height / 2);
    let x = 0,
      y = 0;
    if (bounds.x + bounds.width < canvas.x + insetX)
      x = canvas.x + insetX - bounds.x - bounds.width;
    if (bounds.x > canvas.x + canvas.width - insetX)
      x = canvas.x + canvas.width - insetX - bounds.x;
    if (bounds.y + bounds.height < canvas.y + insetY)
      y = canvas.y + insetY - bounds.y - bounds.height;
    if (bounds.y > canvas.y + canvas.height - insetY)
      y = canvas.y + canvas.height - insetY - bounds.y;
    return { x, y };
  }

  _pointerMove(event) {
    const drag = this.pointer;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = this._point(event);
    if (!point) return;
    if (
      !drag.started &&
      Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < 2
    )
      return;
    let patch;
    if (drag.mode === "resize") {
      const center = drag.bounds.center;
      // The opposite corner stays fixed while the bottom-right handle follows the pointer.
      const originalX = drag.start.x - drag.bounds.x,
        originalY = drag.start.y - drag.bounds.y;
      const denominator = originalX * originalX + originalY * originalY;
      const factor =
        denominator > 0.001
          ? ((point.x - drag.bounds.x) * originalX +
              (point.y - drag.bounds.y) * originalY) /
            denominator
          : 1;
      const scale = Math.max(0.2, Math.min(4, drag.initial.scale * factor)),
        ratio = scale / drag.initial.scale;
      const anchorX = (drag.bounds.x - center.x) * (1 - ratio),
        anchorY = (drag.bounds.y - center.y) * (1 - ratio);
      const bounds = {
        x: drag.bounds.x,
        y: drag.bounds.y,
        width: drag.bounds.width * ratio,
        height: drag.bounds.height * ratio,
      };
      const correction = this._visibleCorrection(bounds);
      patch = {
        scale: this._round(scale),
        x: this._round(drag.initial.x + anchorX + correction.x),
        y: this._round(drag.initial.y + anchorY + correction.y),
      };
    } else {
      const dx = point.x - drag.start.x,
        dy = point.y - drag.start.y;
      const correction = this._visibleCorrection({
        ...drag.bounds,
        x: drag.bounds.x + dx,
        y: drag.bounds.y + dy,
      });
      patch = {
        x: this._round(drag.initial.x + dx + correction.x),
        y: this._round(drag.initial.y + dy + correction.y),
      };
    }
    if (!drag.started) {
      this.onStart(drag.id);
      drag.started = true;
    }
    drag.patch = patch;
    event.preventDefault();
    this.onChange(drag.id, patch);
    this._positionOverlay();
  }

  _pointerEnd(event) {
    const drag = this.pointer;
    if (!drag || (event && drag.pointerId !== event.pointerId)) return;
    this.pointer = null;
    try {
      if (this.container.hasPointerCapture(drag.pointerId))
        this.container.releasePointerCapture(drag.pointerId);
    } catch {}
    if (drag.started && drag.patch) this.onCommit(drag.id, drag.patch);
    this._positionOverlay();
  }

  _keyDown(event) {
    if (this.destroyed || !this.selectedId || event.defaultPrevented) return;
    const target = event.target;
    if (
      target instanceof Element &&
      (target.closest('input, textarea, select, [contenteditable="true"]') ||
        target.isContentEditable)
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      this._pointerEnd();
      this.select(null);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || this.pointer) return;
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    let patch;
    const edit = this.getEdit(this.selectedId) || {},
      geometry = this._find() && this._geometry(this._find());
    if (directions[event.key] && geometry) {
      const step = event.shiftKey ? 10 : 1,
        [x, y] = directions[event.key];
      const correction = this._visibleCorrection({
        ...geometry,
        x: geometry.x + x * step,
        y: geometry.y + y * step,
      });
      patch = {
        x: this._round(this._number(edit.x) + x * step + correction.x),
        y: this._round(this._number(edit.y) + y * step + correction.y),
      };
    } else if (event.key === "Delete") patch = { hidden: true };
    if (!patch) return;
    event.preventDefault();
    const id = this.selectedId;
    this.onStart(id);
    this.onChange(id, patch);
    this.onCommit(id, patch);
    this._positionOverlay();
  }

  _scheduleOverlay() {
    if (this.destroyed || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this._positionOverlay();
    });
  }

  _positionOverlay() {
    if (this.destroyed) return;
    const target = this._find();
    if (!target || !target.getClientRects().length) {
      this.box.hidden = true;
      return;
    }
    const targetRect = target.getBoundingClientRect(),
      containerRect = this.container.getBoundingClientRect();
    if (!(targetRect.width > 0 && targetRect.height > 0)) {
      this.box.hidden = true;
      return;
    }
    const scaleX =
      containerRect.width /
      (this.container.offsetWidth || containerRect.width || 1);
    const scaleY =
      containerRect.height /
      (this.container.offsetHeight || containerRect.height || 1);
    Object.assign(this.box.style, {
      left: `${(targetRect.left - containerRect.left) / scaleX + this.container.scrollLeft - this.container.clientLeft}px`,
      top: `${(targetRect.top - containerRect.top) / scaleY + this.container.scrollTop - this.container.clientTop}px`,
      width: `${targetRect.width / scaleX}px`,
      height: `${targetRect.height / scaleY}px`,
    });
    this.box.hidden = false;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    const drag = this.pointer;
    this.pointer = null;
    try {
      if (drag && this.container.hasPointerCapture(drag.pointerId))
        this.container.releasePointerCapture(drag.pointerId);
    } catch {}
    this.observer?.disconnect();
    const { container, handlers } = this;
    container.removeEventListener("pointerdown", handlers.down);
    container.removeEventListener("pointermove", handlers.move);
    container.removeEventListener("pointerup", handlers.up);
    container.removeEventListener("pointercancel", handlers.cancel);
    container.removeEventListener("lostpointercapture", handlers.lost);
    container.removeEventListener("dragstart", handlers.drag);
    document.removeEventListener("keydown", handlers.key);
    window.removeEventListener("resize", handlers.layout);
    window.removeEventListener("scroll", handlers.layout, true);
    container.style.position = this.previousStyles.position;
    container.style.touchAction = this.previousStyles.touchAction;
    container.style.userSelect = this.previousStyles.userSelect;
    if (this.previousTabindex == null) container.removeAttribute("tabindex");
    else container.setAttribute("tabindex", this.previousTabindex);
    this.box.remove();
    this.svg = null;
  }
}
