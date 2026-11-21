import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { color, font, radius, text } from "../../styles/tokens.stylex";

export type Tone = "neutral" | "accent" | "green" | "yellow" | "red";

export function Badge({ tone = "neutral", children, mono }: { tone?: Tone; children: ReactNode; mono?: boolean }) {
  return <span {...stylex.props(styles.badge, styles[tone], mono && styles.mono)}>{children}</span>;
}

/** A dot and a label: the quiet way to show a state in a table. */
export function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span {...stylex.props(styles.status)}>
      <span aria-hidden {...stylex.props(styles.dot, dots[tone])} />
      {children}
    </span>
  );
}

const styles = stylex.create({
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    height: 22,
    paddingInline: 7,
    borderRadius: radius.sm,
    fontSize: text.xs,
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  mono: { fontFamily: font.mono, fontWeight: 400 },
  neutral: { backgroundColor: color.raised, color: color.textDim },
  accent: { backgroundColor: color.accentSoft, color: color.accentText },
  green: { backgroundColor: color.greenSoft, color: color.green },
  yellow: { backgroundColor: color.yellowSoft, color: color.yellow },
  red: { backgroundColor: color.redSoft, color: color.redText },
  status: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: text.sm, color: color.textDim, whiteSpace: "nowrap" },
  dot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
});

const dots = stylex.create({
  neutral: { backgroundColor: color.textFaint },
  accent: { backgroundColor: color.accent },
  green: { backgroundColor: color.green },
  yellow: { backgroundColor: color.yellow },
  red: { backgroundColor: color.red },
});
