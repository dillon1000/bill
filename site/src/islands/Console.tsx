import * as stylex from "@stylexjs/stylex";
import { AnimatePresence, motion as m, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { color, font, radius, text } from "../styles/tokens.stylex";

type Outcome = "answered" | "handed off" | "closed" | "issue filed";

const scopes: Record<string, string> = {
  my_account: "account:read",
  my_support_history: "history:read",
  recent_errors: "account:detail",
  search_docs: "docs:read",
  read_doc: "docs:read",
  search_code: "code:read",
  read_file: "code:read",
  recent_changes: "code:read",
  search_pull_requests: "code:read",
  search_issues: "code:read",
  file_issue: "issues:write",
  hand_off: "ticket:handoff",
  close_ticket: "ticket:close",
};

// Typical consumer-app questions, the tools Bill would call for each, and the start of its reply.
const items: { who: string; q: string; trail: string[]; outcome: Outcome; reply: string }[] = [
  { who: "Maya", q: "phone stopped syncing since yesterday", trail: ["my_account", "recent_errors", "search_docs"], outcome: "answered", reply: "Your Pixel has been getting 401 token_expired since you changed your password. Sign out and back in on the phone." },
  { who: "Jonas", q: "charged twice this month??", trail: ["my_account", "my_support_history", "hand_off"], outcome: "handed off", reply: "A person decides refunds, so I've passed this to the team with your email from the 18th." },
  { who: "Lea", q: "how do I share a folder read-only", trail: ["search_docs", "read_doc"], outcome: "answered", reply: "Open the folder, choose Share, then set the link to Can view. Details in Sharing folders." },
  { who: "Maya", q: "signed back in, it's syncing now", trail: ["close_ticket"], outcome: "closed", reply: "Glad it's back. I've closed this ticket." },
  { who: "Sam", q: "PDF export downloads a file called .pdf", trail: ["search_code", "read_file", "recent_changes", "file_issue"], outcome: "issue filed", reply: "That's a bug since Nov 18: titles without Latin letters become an empty file name. Filed as #418." },
  { who: "Ana", q: "please delete my account and data", trail: ["my_account", "hand_off"], outcome: "handed off", reply: "Deleting data is done by a person on the team. I've passed it on, and they'll confirm here." },
  { who: "Kai", q: "did the dark mode toggle move?", trail: ["recent_changes", "search_pull_requests"], outcome: "answered", reply: "Yes, Tuesday's release moved it to Settings, then Appearance." },
  { who: "Noor", q: "upload stuck at 99%", trail: ["recent_errors", "search_issues"], outcome: "answered", reply: "Your last uploads failed on a 2 GB file, which is over the limit on your plan. Smaller files go through." },
];

const VISIBLE = 5;
const TICK = 3600;

export default function Console() {
  const [head, setHead] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setHead((h) => h + 1), TICK);
    return () => clearInterval(id);
  }, [reduced]);
  const shown = Array.from({ length: VISIBLE }, (_, i) => ({ n: head + i, ...items[(head + i) % items.length]! }));
  const active = shown[VISIBLE - 2]!;

  return (
    <div {...stylex.props(s.console)} role="img" aria-label="Bill working through a support queue, one ticket at a time">
      <div {...stylex.props(s.chrome)}>
        <span {...stylex.props(s.lights)}>
          <span {...stylex.props(s.light)} />
          <span {...stylex.props(s.light)} />
          <span {...stylex.props(s.light)} />
        </span>
        <span {...stylex.props(s.chromeTitle)}>bill · queue</span>
        <span {...stylex.props(s.chromeMeta)}>openai/gpt-6-luna</span>
      </div>
      <div {...stylex.props(s.body)}>
        <ol {...stylex.props(s.list)}>
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((item, i) => {
              const state = i === VISIBLE - 1 ? "new" : i === VISIBLE - 2 ? "active" : "done";
              return (
                <m.li
                  key={item.n}
                  layout
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: state === "done" ? 0.62 : 1, y: 0 }}
                  exit={{ opacity: 0, y: -30, transition: { duration: 0.3 } }}
                  transition={{ type: "spring", duration: 0.7, bounce: 0 }}
                  {...stylex.props(s.item, state === "active" && s.itemActive)}
                >
                  <span {...stylex.props(s.avatar)}>{item.who[0]}</span>
                  <span {...stylex.props(s.itemText)}>
                    <span {...stylex.props(s.itemWho)}>{item.who}</span>
                    <span {...stylex.props(s.itemQ)}>{item.q}</span>
                  </span>
                  <m.span initial={false} animate={{ opacity: state === "done" ? 1 : 0 }} {...stylex.props(s.outcome, s[tone(item.outcome)])}>
                    {item.outcome}
                  </m.span>
                </m.li>
              );
            })}
          </AnimatePresence>
        </ol>
        <div {...stylex.props(s.detail)}>
          <AnimatePresence mode="wait">
            <m.div key={active.n} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }} {...stylex.props(s.detailInner)}>
              <div {...stylex.props(s.bubbleRow)}>
                <span {...stylex.props(s.avatar)}>{active.who[0]}</span>
                <p {...stylex.props(s.bubble)}>{active.q}</p>
              </div>
              <ol {...stylex.props(s.calls)}>
                {active.trail.map((t, j) => (
                  <m.li key={t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + j * 0.32, duration: 0.3 }} {...stylex.props(s.call)}>
                    <m.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.55 + j * 0.32, type: "spring", duration: 0.35, bounce: 0.4 }} {...stylex.props(s.callMark, t === "hand_off" ? s.callMarkHand : null)} />
                    <span {...stylex.props(s.callName)}>{t}</span>
                    <span {...stylex.props(s.callScope)}>{scopes[t]}</span>
                    <span {...stylex.props(s.callMs)}>{140 + ((active.n * 37 + j * 91) % 380)} ms</span>
                  </m.li>
                ))}
              </ol>
              <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + active.trail.length * 0.32 }} {...stylex.props(s.replyRow)}>
                <img src="/goose.svg" alt="" width={28} height={28} {...stylex.props(s.goose)} />
                <Typed text={active.reply} delay={0.6 + active.trail.length * 0.32} />
              </m.div>
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function tone(o: Outcome) {
  return o === "handed off" ? "handed" : o === "issue filed" ? "issue" : o;
}

function Typed({ text: full, delay }: { text: string; delay: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let i = 0;
    let id: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      id = setInterval(() => {
        i += 2;
        setN(Math.min(i, full.length));
        if (i >= full.length) clearInterval(id);
      }, 16);
    }, delay * 1000);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, [full, delay]);
  return (
    <p {...stylex.props(s.reply)}>
      {full.slice(0, n)}
      <span {...stylex.props(s.caret, n >= full.length && s.caretDone)} />
    </p>
  );
}

const sq = { cornerShape: "squircle" } as const;
const ROW = 64;

const s = stylex.create({
  console: { ...sq, borderRadius: radius.xl, backgroundColor: color.bg, overflow: "hidden", fontFamily: font.sans, boxShadow: "0 0 0 1px rgba(17,18,20,0.08), 0 50px 100px -30px rgba(40,30,120,0.28), 0 20px 40px -20px rgba(17,18,20,0.18)" },
  chrome: { display: "flex", alignItems: "center", gap: 12, height: 44, padding: "0 16px", borderBottom: `1px solid ${color.line}`, backgroundColor: color.surface },
  lights: { display: "flex", gap: 6 },
  light: { ...sq, width: 10, height: 10, borderRadius: 3, backgroundColor: color.lineStrong },
  chromeTitle: { fontFamily: font.mono, fontSize: text.sm, color: color.textDim },
  chromeMeta: { marginLeft: "auto", fontFamily: font.mono, fontSize: text.xs, color: color.textFaint },
  body: { display: "grid", gridTemplateColumns: { default: "minmax(0, 0.9fr) minmax(0, 1.1fr)", "@media (max-width: 820px)": "1fr" } },
  list: { listStyle: "none", margin: 0, padding: 8, height: VISIBLE * ROW + 16, boxSizing: "border-box", overflow: "hidden", display: "flex", flexDirection: "column", borderRight: { default: `1px solid ${color.line}`, "@media (max-width: 820px)": "none" } },
  item: { ...sq, display: "flex", alignItems: "center", gap: 12, height: ROW, flexShrink: 0, boxSizing: "border-box", padding: "0 12px", borderRadius: radius.lg, transitionProperty: "background-color", transitionDuration: "300ms" },
  itemActive: { backgroundColor: color.accentSoft },
  avatar: { ...sq, display: "grid", placeItems: "center", flexShrink: 0, width: 30, height: 30, borderRadius: radius.md, backgroundColor: color.hover, color: color.textDim, fontWeight: 600, fontSize: text.sm },
  itemText: { display: "grid", minWidth: 0, flex: 1 },
  itemWho: { fontSize: text.xs, color: color.textFaint },
  itemQ: { fontSize: text.base, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  outcome: { ...sq, flexShrink: 0, fontSize: 12, fontWeight: 500, padding: "2px 7px", borderRadius: radius.sm },
  answered: { backgroundColor: color.accentSoft, color: color.accentText },
  closed: { backgroundColor: color.greenSoft, color: "#0f6b31" },
  handed: { backgroundColor: color.yellowSoft, color: "#7a5b00" },
  issue: { backgroundColor: color.hover, color: color.textDim },
  detail: { position: "relative", minHeight: VISIBLE * ROW + 16, display: { default: "block", "@media (max-width: 820px)": "none" }, backgroundImage: `linear-gradient(${color.line} 1px, transparent 1px)`, backgroundSize: "100% 32px" },
  detailInner: { position: "absolute", inset: 0, padding: 24, display: "grid", alignContent: "start", gap: 20 },
  bubbleRow: { display: "flex", gap: 10, alignItems: "flex-start" },
  bubble: { ...sq, margin: 0, padding: "10px 14px", borderRadius: radius.lg, backgroundColor: color.surface, boxShadow: `inset 0 0 0 1px ${color.line}`, fontSize: text.md, color: color.text },
  calls: { listStyle: "none", margin: 0, padding: "0 0 0 40px", display: "grid", gap: 8 },
  call: { display: "flex", alignItems: "center", gap: 10, fontFamily: font.mono, fontSize: text.sm },
  callMark: { ...sq, width: 8, height: 8, borderRadius: 2, backgroundColor: color.green, flexShrink: 0 },
  callMarkHand: { backgroundColor: color.yellow },
  callName: { color: color.text, fontWeight: 500 },
  callScope: { color: color.textFaint },
  callMs: { marginLeft: "auto", color: color.textFaint, fontVariantNumeric: "tabular-nums" },
  replyRow: { display: "flex", gap: 10, alignItems: "flex-start" },
  goose: { ...sq, flexShrink: 0, boxSizing: "border-box", padding: 4, borderRadius: radius.md, backgroundColor: color.surface, boxShadow: `inset 0 0 0 1px ${color.line}`, width: 30, height: 30 },
  reply: { margin: 0, fontSize: text.md, lineHeight: 1.55, color: color.text },
  caret: { display: "inline-block", width: 2, height: "1.05em", marginLeft: 2, verticalAlign: "-0.15em", backgroundColor: color.accent, animationName: stylex.keyframes({ "0%, 100%": { opacity: 1 }, "50%": { opacity: 0 } }), animationDuration: "1s", animationIterationCount: "infinite" },
  caretDone: { opacity: 0, animationName: "none" },
});
