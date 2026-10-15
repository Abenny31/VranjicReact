import { RefObject, useEffect } from 'react';

type AnyEvent = MouseEvent | TouchEvent;

export function useOnClickOutside(ref: RefObject<HTMLElement | null>, handler: (event: AnyEvent) => void) {
  useEffect(() => {
    const listener = (event: AnyEvent) => {
      if (!ref.current || !(event.target instanceof Node) || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}
