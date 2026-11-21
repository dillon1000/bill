import * as stylex from "@stylexjs/stylex";
import { useEffect, useState } from "react";
import { chain } from "../lib/chain";
import { color, font, radius } from "../styles/tokens.stylex";
import { scenarios, type Beat } from "./scenarios";

type Audit = Extract<Beat, { type: "audit" }>;
const audits = scenarios.flatMap((sc) => sc.beats.filter((b): b is Audit => b.type === "audit"));
const half = Math.ceil(audits.length / 2);

/** Every audit event from the replays, hash-chained, drifting past in two rows. */
export default function Stream() {
  const [hashes, setHashes] = useState<string[]>([]);
  useEffect(() => {
    chain(audits.map((a) => ({ kind: a.kind, tool: a.tool ?? null, scope: a.scope ?? null, data: a.data }))).then((links) => setHashes(links.map((l) => l.hash)));
  }, []);
  const rows = [audits.slice(0, half), audits.slice(half)];
  return (
    <div {...stylex.props(s.band)} aria-hidden="true">
      {rows.map((row, r) => (
        <div key={r} {...stylex.props(s.track, r === 1 && s.trackReverse)}>
          {[0, 1].map((copy) => (
            <div key={copy} {...stylex.props(s.run)}>
              {row.map((a, i) => (
                <span key={i} {...stylex.props(s.event)}>
                  <span {...stylex.props(s.mark, s[`mark_${a.kind}`])} />
                  <span {...stylex.props(s.kind)}>{a.kind}</span>
                  {a.tool && <span {...stylex.props(s.tool)}>{a.tool}</span>}
                  <span {...stylex.props(s.hash)}>{(hashes[r * half + i] ?? "").slice(0, 8)}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const drift = stylex.keyframes({ from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } });
const sq = { cornerShape: "squircle" } as const;

const s = stylex.create({
  band: { display: "grid", gap: 10, overflow: "hidden", maskImage: "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)", fontFamily: font.mono, fontSize: 12 },
  track: {
    display: "flex",
    width: "max-content",
    animationName: drift,
    animationDuration: "140s",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
    ":hover": { animationPlayState: "paused" },
    "@media (prefers-reduced-motion: reduce)": { animationName: "none" },
  },
  trackReverse: { animationDirection: "reverse", animationDuration: "170s" },
  run: { display: "flex", gap: 10, paddingRight: 10 },
  event: { ...sq, display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: radius.md, backgroundColor: color.bg, boxShadow: `0 0 0 1px ${color.line}`, whiteSpace: "nowrap" },
  mark: { ...sq, width: 7, height: 7, borderRadius: 2 },
  mark_started: { backgroundColor: color.text },
  mark_step: { backgroundColor: color.blue },
  mark_tool_call: { backgroundColor: color.accent },
  mark_tool_result: { backgroundColor: color.green },
  mark_denied: { backgroundColor: color.red },
  mark_reply: { backgroundColor: color.text },
  kind: { color: color.textDim },
  tool: { color: color.text, fontWeight: 500 },
  hash: { color: color.textFaint },
});
