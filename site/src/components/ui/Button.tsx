import * as stylex from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";
import { color, font, motion, radius, shadow, text } from "../../styles/tokens.stylex";
import type { Sx } from "./sx";
import { Tooltip } from "./Tooltip";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerFilled";
type Size = "sm" | "md";

interface ButtonProps extends Omit<ComponentProps<"button">, "className" | "style"> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  xstyle?: Sx;
}

/** The same look for anything that isn't a `<button>`, such as a router link. */
export const buttonStyle = (variant: Variant = "secondary", size: Size = "md") => [
  styles.base,
  styles[size],
  styles[variant],
  styles.press,
];

export function Button({ variant = "secondary", size = "md", icon, xstyle, children, ...rest }: ButtonProps) {
  return (
    <button type="button" {...rest} {...stylex.props(buttonStyle(variant, size), xstyle)}>
      {icon && <span {...stylex.props(styles.icon)}>{icon}</span>}
      {children}
    </button>
  );
}

interface IconButtonProps extends Omit<ComponentProps<"button">, "className" | "style"> {
  label: string;
  children: ReactNode;
  active?: boolean;
  size?: Size;
  /** Shortcut keys shown in the tooltip. */
  keys?: ReactNode;
  tipSide?: "top" | "right" | "bottom" | "left";
  xstyle?: Sx;
}

/** A square icon button with a tooltip and a hit area 8px larger than it looks. */
export function IconButton({
  label,
  children,
  active,
  size = "md",
  keys,
  tipSide,
  xstyle,
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip label={label} keys={keys} side={tipSide}>
      <button
        type="button"
        aria-label={label}
        {...rest}
        {...stylex.props(
          styles.iconButton,
          size === "sm" && styles.iconButtonSm,
          active && styles.iconActive,
          styles.press,
          xstyle,
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

const styles = stylex.create({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "transparent",
    borderRadius: radius.md,
    fontFamily: font.sans,
    fontWeight: 500,
    whiteSpace: "nowrap",
    textDecoration: "none",
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    opacity: { default: 1, ":disabled": 0.5 },
    transitionProperty: "background-color, border-color, color, transform",
    transitionDuration: motion.base,
    transitionTimingFunction: motion.easeOut,
    userSelect: "none",
  },
  press: { transform: { default: null, ":active": "scale(0.96)" } },
  sm: { height: 32, paddingInline: 12, fontSize: text.sm },
  md: { height: 36, paddingInline: 14, fontSize: text.base },
  primary: {
    backgroundColor: { default: color.accent, ":hover": color.accentHover },
    color: color.onAccent,
    boxShadow: shadow.inset,
  },
  secondary: {
    backgroundColor: { default: color.raised, ":hover": color.hover },
    color: color.text,
    // A fill this close to the page has a soft edge, and beside an outlined button of the same
    // size it reads as the smaller one. A hairline gives it an edge as definite as theirs. It's
    // the border itself, at the very edge: an inset shadow would sit a pixel inside it.
    borderColor: color.line,
  },
  ghost: {
    backgroundColor: { default: "transparent", ":hover": color.raised },
    color: { default: color.textDim, ":hover": color.text },
  },
  danger: {
    backgroundColor: { default: "transparent", ":hover": color.redSoft },
    borderColor: color.redLine,
    color: color.redText,
  },
  dangerFilled: {
    backgroundColor: { default: color.redSolid, ":hover": color.redSolidHover },
    color: color.onAccent,
    boxShadow: shadow.inset,
  },
  icon: { display: "inline-flex", marginInlineStart: -2 },
  iconButton: {
    position: "relative",
    display: "inline-grid",
    placeItems: "center",
    flexShrink: 0,
    width: 34,
    height: 34,
    padding: 0,
    borderWidth: 0,
    borderRadius: radius.md,
    backgroundColor: { default: "transparent", ":hover": color.raised },
    color: { default: color.textDim, ":hover": color.text },
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    opacity: { default: 1, ":disabled": 0.4 },
    transitionProperty: "background-color, color, transform",
    transitionDuration: motion.base,
    transitionTimingFunction: motion.easeOut,
    "::before": { content: '""', position: "absolute", inset: -4 },
  },
  // The hit area grows by what the button lost, so it's still 40px to the touch.
  iconButtonSm: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    "::before": { content: '""', position: "absolute", inset: -6 },
  },
  iconActive: { backgroundColor: color.accentSoft, color: color.accentText },
});
