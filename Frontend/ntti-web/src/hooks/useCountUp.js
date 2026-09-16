import { useState, useEffect, useRef } from "react";

export default function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  const start = useRef(null);

  useEffect(() => {
    if (target === 0) {
      setVal(0);
      return;
    }
    start.current = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return val;
}