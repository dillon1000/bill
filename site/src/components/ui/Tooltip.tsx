import * as stylex from "@stylexjs/stylex";
import { Tooltip as Base } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";
import { color, layer, motion, radius, shadow, text } from "../../styles/tokens.stylex";
import { cx, hidden } from "./sx";

/*
 * The first tooltip waits so passing the cursor over a toolbar doesn't flash labels.
 * Once one has shown, neighbours open immediately and without animation.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Base.Provider delay={450} closeDelay={0} timeout={400}>
      {children}
    </Base.Provider>
  );
}

interface TooltipProps {
  label: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  /** Shortcut keys shown after the label. */
  keys?: ReactNode;
  /** A roomier panel for richer content, such as exact timestamps. */
  card?: boolean;
  children: ReactElement<Record<string, unknown>>;
}

export function Tooltip({ label, side = "top", keys, card, children }: TooltipProps) {
  if (!label) return children;
  return (
    <Base.Root>
      <Base.Trigger render={children} />
      <Base.Portal>
        <Base.Positioner side={side} sideOffset={8} {...stylex.props(styles.positioner)}>
          <Base.Popup
            className={(state) =>
              cx(
                styles.tip,
                Boolean(keys) && styles.withKeys,
                card && styles.card,
                hidden(state) && styles.hidden,
                Boolean(state.instant) && styles.instant,
              )
            }
          >
            {label}
            {keys && <span {...stylex.props(styles.keys)}>{keys}</span>}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}

const styles = stylex.create({
  positioner: { zIndex: layer.tooltip },
  tip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    paddingBlock: 5,
    paddingInline: 8,
    borderRadius: radius.sm,
    backgroundColor: color.overlay,
    boxShadow: shadow.tip,
    color: color.text,
    fontSize: text.xs,
    fontWeight: 500,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    transformOrigin: "var(--transform-origin)",
    transitionProperty: "opacity, scale",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easeOut,
    opacity: 1,
    scale: "1",
  },
  hidden: { opacity: 0, scale: "0.97" },
  instant: { transitionDuration: "0ms" },
  // 5px around the 5px-cornered key caps at the end, so 10px corners.
  withKeys: { paddingRight: 5, borderRadius: 10 },
  // 8px around 6px-cornered chips, so 14px corners. Text inside carries its own inset.
  card: { display: "block", padding: 8, borderRadius: 14, fontSize: text.base, fontWeight: 400, whiteSpace: "normal" },
  keys: { display: "inline-flex", gap: 3, color: color.textDim },
});
