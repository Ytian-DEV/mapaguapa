import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

type PointerVars = {
  active: boolean;
  x: number;
  y: number;
  gridShiftX: number;
  gridShiftY: number;
  lensShiftX: number;
  lensShiftY: number;
};

type PointerGlowOptions = {
  centerXRatio?: number;
  centerYRatio?: number;
};

export function usePointerGlow(options: PointerGlowOptions = {}) {
  const { centerXRatio = 0.32, centerYRatio = 0.38 } = options;
  const pageRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef<PointerVars>({
    active: false,
    x: 0,
    y: 0,
    gridShiftX: 0,
    gridShiftY: 0,
    lensShiftX: 0,
    lensShiftY: 0,
  });

  const applyPointerVars = () => {
    const page = pageRef.current;
    if (!page) {
      return;
    }

    const pointer = pointerRef.current;
    page.style.setProperty("--pointer-x", `${pointer.x}px`);
    page.style.setProperty("--pointer-y", `${pointer.y}px`);
    page.style.setProperty("--pointer-grid-shift-x", `${pointer.gridShiftX}px`);
    page.style.setProperty("--pointer-grid-shift-y", `${pointer.gridShiftY}px`);
    page.style.setProperty("--pointer-lens-shift-x", `${pointer.lensShiftX}px`);
    page.style.setProperty("--pointer-lens-shift-y", `${pointer.lensShiftY}px`);
    page.style.setProperty("--pointer-opacity", pointer.active ? "1" : "0");
  };

  const schedulePointerPaint = () => {
    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      applyPointerVars();
    });
  };

  useEffect(() => {
    const page = pageRef.current;
    if (!page) {
      return;
    }

    pointerRef.current = {
      active: false,
      x: page.clientWidth * centerXRatio,
      y: page.clientHeight * centerYRatio,
      gridShiftX: 0,
      gridShiftY: 0,
      lensShiftX: 0,
      lensShiftY: 0,
    };

    applyPointerVars();

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [centerXRatio, centerYRatio]);

  const updatePointer = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") {
      return;
    }

    const page = pageRef.current;
    if (!page) {
      return;
    }

    const rect = page.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rx = rect.width === 0 ? 0.5 : x / rect.width;
    const ry = rect.height === 0 ? 0.5 : y / rect.height;

    pointerRef.current = {
      active: true,
      x,
      y,
      gridShiftX: (0.5 - rx) * 18,
      gridShiftY: (0.5 - ry) * 18,
      lensShiftX: (rx - 0.5) * 8,
      lensShiftY: (ry - 0.5) * 8,
    };

    schedulePointerPaint();
  };

  const hidePointer = () => {
    pointerRef.current = {
      ...pointerRef.current,
      active: false,
      gridShiftX: 0,
      gridShiftY: 0,
      lensShiftX: 0,
      lensShiftY: 0,
    };

    schedulePointerPaint();
  };

  return {
    pageRef,
    handlePointerEnter: updatePointer,
    handlePointerMove: updatePointer,
    handlePointerLeave: hidePointer,
  };
}