import * as stylex from "@stylexjs/stylex";
import { Switch as Base } from "@base-ui/react/switch";
import { color, motion, radius } from "../../styles/tokens.stylex";
import { cx } from "./sx";

export function Switch({
  id,
  checked,
  onChange,
  label,
  disabled,
}: {
  id?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Base.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      disabled={disabled}
      className={(state) =>
        cx(styles.switch, state.checked && styles.switchOn, state.disabled && styles.switchDisabled)
      }
    >
      <Base.Thumb className={(state) => cx(styles.thumb, state.checked && styles.thumbOn)} />
    </Base.Root>
  );
}

const styles = stylex.create({
  switch: {
    position: "relative",
    display: "inline-block",
    flexShrink: 0,
    width: 36,
    height: 22,
    padding: 0,
    borderWidth: 0,
    borderRadius: radius.md,
    cornerShape: "squircle",
    backgroundColor: color.lineStrong,
    cursor: "pointer",
    transitionProperty: "background-color, opacity",
    transitionDuration: "180ms",
    "::before": { content: '""', position: "absolute", inset: -9 },
  },
  switchOn: { backgroundColor: color.accent },
  switchDisabled: { opacity: 0.45, cursor: "not-allowed" },
  thumb: {
    position: "absolute",
    top: 3,
    left: 3,
    width: 16,
    height: 16,
    borderRadius: radius.sm,
    cornerShape: "squircle",
    backgroundColor: "#ffffff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
    transitionProperty: "transform",
    transitionDuration: "180ms",
    transitionTimingFunction: motion.easeOut,
  },
  thumbOn: { transform: "translateX(14px)" },
});
