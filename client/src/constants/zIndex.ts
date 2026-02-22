/** Z-index layers for overlays and sticky UI. Use these instead of magic numbers. */
export const Z_INDEX = {
  /** Floating overlays (preview popover, tooltips) – above sticky footer */
  OVERLAY: 50,
  /** Sticky bottom action bar */
  STICKY_FOOTER: 40,
} as const;

/** Approximate height of the sticky footer (px) – used to position success banner above it. */
export const STICKY_FOOTER_HEIGHT_PX = 80;
