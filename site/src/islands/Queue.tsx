import * as stylex from "@stylexjs/stylex";
import { AnimatePresence, motion as m, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { color, font, radius, text } from "../styles/tokens.stylex";

type Outcome = "answered" | "handed off" | "closed" | "issue filed";

// Typical consumer-app questions, and the tool calls Bill would make for each.
const items: { q: string; trail: string[]; outcome: Outcome }[] = [
  { q: "phone stopped syncing since yesterday", trail: ["my_account", "recent_errors", "search_docs"], outcome: "answered" },
  { q: "charged twice this month??", trail: ["my_account", "my_support_history", "hand_off"], outcome: "handed off" },
  { q: "how do I share a folder read-only", trail: ["search_docs", "read_doc"], outcome: "answered" },
  { q: "signed back in, it works now", trail: ["close_ticket"], outcome: "closed" },
  { q: "PDF export downloads a file called .pdf", trail: ["search_code", "read_file", "recent_changes", "file_issue"], outcome: "issue filed" },
  { q: "please delete my account and data", trail: ["my_account", "hand_off"], outcome: "handed off" },
  { q: "did the dark mode toggle move?", trail: ["recent_changes", "search_pull_requests"], outcome: "answered" },
  { q: "upload stuck at 99%", trail: ["recent_errors", "search_issues"], outcome: "answered" },
  { q: "thanks, sorted", trail: ["close_ticket"], outcome: "closed" },
  { q: "someone else is logged into my account", trail: ["hand_off"], outcome: "handed off" },
];

const VISIBLE = 5;

export default function Queue() {
  const [head, setHead] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setHead((h) => h + 1), 2600);
    return () => clearInterval(id);
  }, [reduced]);
  const shown = Array.from({ length: VISIBLE }, (_, i) => ({ n: head + i, ...items[(head + i) % items.length]! }));

  return (
    <div {...stylex.props(s.panel)} aria-label="Bill working through a support queue" role="img">
      <div {...stylex.props(s.head)}>
        <span>Queue</span>
        <span {...stylex.props(s.headDim)}>tickets · forum · DMs · in-app</span>
      </div>
      <ol {...stylex.props(s.list)}>
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((item, i) => (
            <m.li
              key={item.n}
              layout
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24, transition: { duration: 0.3 } }}
              transition={{ type: "spring", duration: 0.6, bounce: 0 }}
              {...stylex.props(s.item)}
            >
              <p {...stylex.props(s.q)}>{item.q}</p>
              <div {...stylex.props(s.trail)}>
                <span {...stylex.props(s.tools)}>
                {item.trail.map((t, j) => (
                  <m.span
                    key={t}
                    initial={false}
                    animate={{ opacity: i === VISIBLE - 1 ? 0 : 1, x: i === VISIBLE - 1 ? -4 : 0 }}
                    transition={{ delay: i === VISIBLE - 2 ? 0.25 + j * 0.18 : 0, duration: 0.3 }}
                    {...stylex.props(s.tool)}
                  >
                    {t}
                  </m.span>
                ))}
                </span>
                <m.span
                  initial={false}
                  animate={{ opacity: i >= VISIBLE - 1 ? 0 : 1, scale: i >= VISIBLE - 1 ? 0.9 : 1 }}
                  transition={{ delay: i === VISIBLE - 2 ? 0.35 + item.trail.length * 0.18 : 0, type: "spring", duration: 0.4, bounce: 0.3 }}
                  {...stylex.props(s.outcome, s[item.outcome === "handed off" ? "handed" : item.outcome === "issue filed" ? "issue" : item.outcome])}
                >
                  {item.outcome}
                </m.span>
              </div>
            </m.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}

const sq = { cornerShape: "squircle" } as const;

const s = stylex.create({
  panel: { ...sq, borderRadius: radius.xl, backgroundColor: color.bg, boxShadow: "0 0 0 1px rgba(17,18,20,0.09), 0 24px 60px -24px rgba(17,18,20,0.16)", overflow: "hidden", fontFamily: font.sans },
  head: { display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${color.line}`, fontSize: text.sm, fontWeight: 600, color: color.text },
  headDim: { fontWeight: 400, color: color.textFaint },
  list: { listStyle: "none", margin: 0, padding: 0, height: 5 * 76, overflow: "hidden", display: "flex", flexDirection: "column" },
  item: { height: 76, boxSizing: "border-box", padding: "12px 16px", borderBottom: `1px solid ${color.line}`, display: "grid", alignContent: "center", gap: 6 },
  q: { margin: 0, fontSize: text.base, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  trail: { display: "flex", gap: 8, alignItems: "center" },
  tools: { display: "flex", gap: 6, flex: 1, minWidth: 0, overflow: "hidden", maskImage: "linear-gradient(to right, #000 85%, transparent)" },
  tool: { fontFamily: font.mono, fontSize: 12, color: color.textFaint, whiteSpace: "nowrap" },
  outcome: { ...sq, marginLeft: "auto", flexShrink: 0, fontSize: 12, fontWeight: 500, padding: "2px 7px", borderRadius: radius.sm },
  answered: { backgroundColor: color.accentSoft, color: color.accentText },
  closed: { backgroundColor: color.greenSoft, color: "#0f6b31" },
  handed: { backgroundColor: color.yellowSoft, color: "#7a5b00" },
  issue: { backgroundColor: color.hover, color: color.textDim },
});
