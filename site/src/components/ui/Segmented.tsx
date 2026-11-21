import * as stylex from "@stylexjs/stylex";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { motion as m } from "motion/react";
import { useId, type ReactNode } from "react";
import { color, motion, radius, text } from "../../styles/tokens.stylex";
import { cx, type Sx } from "./sx";

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: ReactNode; name?: string }>;
  onChange: (value: T) => void;
  xstyle?: Sx;
}

/** A radio group whose highlight slides to the chosen option. */
export function Segmented<T extends string>({ label, value, options, onChange, xstyle }: SegmentedProps<T>) {
  const indicatorId = useId();
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => onChange(next as T)}
      {...stylex.props(styles.seg, xstyle)}
    >
      {options.map((o) => (
        <Radio.Root
          key={o.value}
          value={o.value}
          aria-label={o.name}
          className={(state) => cx(styles.segItem, state.checked && styles.segOn)}
        >
          {o.value === value && (
            <m.span
              layoutId={indicatorId}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              {...stylex.props(styles.indicator)}
            />
          )}
          <span {...stylex.props(styles.segLabel)}>{o.label}</span>
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

const styles = stylex.create({
  seg: { display: "inline-flex", gap: 2, padding: 2, borderRadius: radius.md, backgroundColor: color.bg },
  segItem: {
    position: "relative",
    display: "inline-grid",
    placeItems: "center",
    minWidth: 32,
    height: 28,
    paddingInline: 10,
    borderWidth: 0,
    borderRadius: radius.sm,
    backgroundColor: "transparent",
    color: { default: color.textDim, ":hover": color.text },
    fontSize: text.sm,
    cursor: "pointer",
    userSelect: "none",
    transitionProperty: "color",
    transitionDuration: motion.base,
  },
  segOn: { color: { default: color.text, ":hover": color.text } },
  indicator: {
    position: "absolute",
    inset: 0,
    borderRadius: radius.sm,
    backgroundColor: color.hover,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  },
  segLabel: { position: "relative", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" },
});
