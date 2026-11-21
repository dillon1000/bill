import * as stylex from "@stylexjs/stylex";
import { AnimatePresence, motion as m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Swaps one small thing for another in the same spot, such as a copy icon for a tick. The old one
 * shrinks and blurs away as the new one grows into focus, so the change reads as one object
 * turning into another. Change `id` whenever the content changes.
 */
export function Swap({ id, children }: { id: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  const away = reduced ? { opacity: 0 } : { opacity: 0, transform: "scale(0.25)", filter: "blur(4px)" };
  return (
    <span {...stylex.props(styles.slot)}>
      <AnimatePresence initial={false} mode="popLayout">
        <m.span
          key={id}
          initial={away}
          animate={{ opacity: 1, transform: "scale(1)", filter: "blur(0px)" }}
          exit={away}
          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
          {...stylex.props(styles.inner)}
        >
          {children}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

const styles = stylex.create({
  // Both share one grid cell, so the slot keeps its size while they cross.
  slot: { position: "relative", display: "inline-grid", placeItems: "center" },
  inner: { gridArea: "1 / 1", display: "inline-flex" },
});
