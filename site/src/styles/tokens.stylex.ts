import * as stylex from "@stylexjs/stylex";

/*
 * The ui.dillonr.ing tokens, in their light form: paper chrome, ink text.
 * One iris accent marks selection and primary actions; green, yellow and red stay reserved for status.
 */
export const color = stylex.defineVars({
  frame: "#f3f3f1",
  bg: "#ffffff",
  surface: "#f7f7f5",
  raised: "#ffffff",
  hover: "#efefec",
  overlay: "#ffffff",
  line: "rgba(17, 18, 20, 0.08)",
  lineStrong: "rgba(17, 18, 20, 0.16)",
  scrim: "rgba(17, 18, 20, 0.32)",
  text: "#111214",
  textDim: "#55575d",
  textFaint: "#8b8d93",

  accent: "#5546f5",
  accentHover: "#4637e6",
  accentSoft: "rgba(85, 70, 245, 0.09)",
  accentText: "#4334d9",
  onAccent: "#ffffff",

  green: "#17a34a",
  greenSoft: "rgba(23, 163, 74, 0.1)",
  yellow: "#b88a00",
  yellowSoft: "rgba(214, 160, 0, 0.12)",
  red: "#d93a31",
  redSoft: "rgba(217, 58, 49, 0.08)",
  redLine: "rgba(217, 58, 49, 0.4)",
  redText: "#c22f27",
  redSolid: "#d23f37",
  redSolidHover: "#bf3830",

  cyan: "#0e9aa0",
  magenta: "#b23cb2",
  blue: "#3b5bf0",
});

export const syntax = stylex.defineVars({
  keyword: "#5546f5",
  string: "#16803c",
  number: "#a86b00",
  property: "#1d6fb8",
  function: "#b4501f",
  comment: "#8b8d93",
  punctuation: "#55575d",
  invalid: "#c22f27",
});

export const font = stylex.defineVars({
  sans: '"Inter Display", "Inter", -apple-system, "Helvetica Neue", Arial, sans-serif',
  display: '"Inter Display", -apple-system, sans-serif',
  mono: '"Iosevka", ui-monospace, "SF Mono", Menlo, monospace',
});

export const text = stylex.defineVars({
  xs: "12px",
  sm: "13px",
  base: "14px",
  md: "15px",
  lg: "18px",
  xl: "26px",
});

export const space = stylex.defineVars({
  xxs: "2px",
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  xxl: "28px",
});

export const radius = stylex.defineVars({
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "20px",
  full: "999px",
});

export const shadow = stylex.defineVars({
  ring: "0 0 0 1px rgba(17, 18, 20, 0.08)",
  pop: "0 0 0 1px rgba(17,18,20,0.08), 0 12px 32px rgba(17,18,20,0.12), 0 2px 6px rgba(17,18,20,0.06)",
  modal: "0 0 0 1px rgba(17,18,20,0.08), 0 24px 64px rgba(17,18,20,0.18)",
  tip: "0 0 0 1px rgba(17,18,20,0.08), 0 6px 16px rgba(17,18,20,0.12)",
  inset: "inset 0 1px 0 rgba(255,255,255,0.5)",
});

export const layer = stylex.defineVars({
  sticky: "10",
  overlay: "50",
  popover: "60",
  tooltip: "70",
  toast: "80",
});

export const layout = stylex.defineVars({
  top: "56px",
  side: "248px",
  gutter: "8px",
  page: "1080px",
});

export const motion = stylex.defineVars({
  easeOut: "cubic-bezier(0.23, 1, 0.32, 1)",
  easeInOut: "cubic-bezier(0.77, 0, 0.175, 1)",
  easeSheet: "cubic-bezier(0.32, 0.72, 0, 1)",
  fast: "120ms",
  base: "160ms",
  slow: "240ms",
});
