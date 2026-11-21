import * as stylex from "@stylexjs/stylex";

/** What a component accepts as its `xstyle` override. */
export type Sx = stylex.StyleXStyles;

type Arg = Readonly<Record<string, unknown>> | boolean | null | undefined | ReadonlyArray<Arg>;

const props = stylex.props as (...styles: Arg[]) => { className?: string };

/** StyleX styles as a class name, for Base UI's `className={(state) => ...}` callbacks. */
export const cx = (...styles: Arg[]): string => props(...styles).className ?? "";

/**
 * Base UI marks a popup for one frame as it mounts and again while it leaves. Applying a "hidden"
 * style in both states is what lets a plain CSS transition run in each direction.
 */
export const hidden = (state: { transitionStatus?: string | undefined }) =>
  state.transitionStatus === "starting" || state.transitionStatus === "ending";
