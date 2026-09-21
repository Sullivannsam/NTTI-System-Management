import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Portal-based, viewport-clamped dropdown positioning.
 *
 * An absolutely-positioned panel inside a right-aligned toolbar will always
 * spill off the edge of the screen, and any ancestor with `overflow:hidden`
 * (every `.card` on this app) will clip it. So the panel is rendered into
 * document.body with `position: fixed` and its coordinates are measured from
 * the trigger, then clamped so it can never leave the viewport:
 *
 *   - horizontally: shifted left until it fits, never past the left margin
 *   - vertically:   flipped above the trigger when there isn't room below
 *   - height:       capped to the space actually available, then scrolls
 *
 * Returns `pos` (null while closed/unmeasured) and `menuRef`, which must be
 * attached to the panel so scrolling inside it doesn't dismiss it.
 */
export function useDropPos(ref, open, opts = {}) {
  const {
    rows = 5,
    rowHeight = 34,
    extraHeight = 16,
    minWidth = 160,
    maxWidth = 460,
    maxHeight = 320,
    onClose,
  } = opts;

  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  // keep the latest onClose without re-running the effect on every render
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }

    const GAP = 6;
    const MARGIN = 10;

    const measure = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const est = Math.min(maxHeight, rows * rowHeight + extraHeight);
      const spaceBelow = vh - r.bottom;
      const spaceAbove = r.top;
      const up = spaceBelow < est + GAP + MARGIN && spaceAbove > spaceBelow;

      // never wider than the trigger needs, the cap, or the viewport itself
      const room = Math.max(180, vw - MARGIN * 2);
      const width = Math.min(Math.max(r.width, minWidth), maxWidth, room);

      // clamp horizontally: slide left until it fits, but never past the margin
      let left = r.left;
      if (left + width > vw - MARGIN) left = vw - MARGIN - width;
      if (left < MARGIN) left = MARGIN;

      const avail = (up ? spaceAbove : spaceBelow) - GAP - MARGIN;
      setPos({
        left,
        width,
        up,
        maxHeight: Math.max(140, Math.min(est, avail)),
        ...(up ? { bottom: vh - r.top + GAP } : { top: r.bottom + GAP }),
      });
    };

    const close = () => {
      setPos(null);
      closeRef.current?.();
    };

    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    const onScroll = (e) => {
      // scrolling *inside* the panel is fine; scrolling the page dismisses it
      const t = e.target;
      if (menuRef.current && t instanceof Node && menuRef.current.contains(t)) return;
      close();
    };

    measure();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, ref, rows, rowHeight, extraHeight, minWidth, maxWidth, maxHeight]);

  return { pos, menuRef };
}

/**
 * The panel itself: a click-catching backdrop plus a fixed, clamped card,
 * both portaled to <body> so no ancestor can clip them.
 *
 * The backdrop closes on `click` (not `mousedown`) on purpose — closing on
 * mousedown removes the backdrop before mouseup, so the click lands on the
 * trigger underneath and immediately re-opens the menu.
 */
export function DropdownPanel({ pos, menuRef, onClose, className = "", style, children }) {
  if (!pos) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={menuRef}
        className={`fixed z-50 card flex flex-col overflow-hidden shadow-xl ${
          pos.up ? "animate-fade-down" : "animate-fade-up"
        } ${className}`}
        style={{
          left: pos.left,
          width: pos.width,
          maxHeight: pos.maxHeight,
          top: pos.top,
          bottom: pos.bottom,
          ...style,
        }}
      >
        {children}
      </div>
    </>,
    document.body
  );
}
