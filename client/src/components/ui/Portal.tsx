import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface PortalProps {
  children: ReactNode;
  /** Target container. Default: document.body */
  container?: HTMLElement | null;
}

/**
 * Renders children into a DOM node outside the component tree (default: document.body).
 * Use for overlays, tooltips, and modals so they are not clipped by overflow or stacking context.
 */
export function Portal({ children, container = typeof document !== 'undefined' ? document.body : null }: PortalProps) {
  if (!container) return null;
  return createPortal(children, container);
}
