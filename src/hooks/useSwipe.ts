'use client';

import { useEffect, useRef } from 'react';

interface SwipeHandlers {
  enabled?: boolean;
  minDistance?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function useSwipe<T extends HTMLElement>({
  enabled = true,
  minDistance = 50,
  onSwipeLeft,
  onSwipeRight,
}: SwipeHandlers) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!enabled || !ref.current) {
      return;
    }

    const element = ref.current;
    let startX = 0;
    let startY = 0;

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (Math.abs(deltaX) < minDistance || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return;
      }

      if (deltaX < 0) {
        onSwipeLeft?.();
        return;
      }

      onSwipeRight?.();
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, minDistance, onSwipeLeft, onSwipeRight]);

  return ref;
}
