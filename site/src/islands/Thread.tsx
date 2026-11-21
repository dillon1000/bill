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

// Typical consumer-app questions, the tools Bill would call for each with what came back, and its reply.
const tickets: { who: string; q: string; calls: [string, string][]; outcome: Outcome; reply: string }[] = [
  {
    who: "Maya",
    q: "my phone stopped syncing since yesterday",
    calls: [["my_account", "pro · Pixel 8, MacBook Air"], ["recent_errors", "Pixel 8: 401 token_expired ×212"], ["search_docs", "Changing your password"]],
    outcome: "answered",
    reply: "Your Pixel has been signed out since your password change yesterday. Sign out and back in on the phone and sync picks up where it stopped.",
  },
  {
    who: "Sam",
    q: "PDF export downloads a file called .pdf",
    calls: [["search_code", "src/export/filename.ts"], ["read_file", "strips [^a-z0-9 _-]"], ["recent_changes", "9c1e04ab, Nov 18"], ["file_issue", "#418"]],
    outcome: "issue filed",
    reply: "That's a bug since Nov 18: titles without Latin letters end up as an empty name. Filed as #418. Add one letter to the title as a workaround.",
  },
  {
    who: "Jonas",
    q: "I was charged twice for Pro this month",
    calls: [["my_account", "pro · active · renews Dec 3"], ["my_support_history", "email on Nov 18"], ["hand_off", "priority high"]],
    outcome: "handed off",
    reply: "A person decides refunds, so I've passed this to the team with your email from the 18th. They'll follow up here.",
  },
  {
    who: "Maya",
    q: "signed back in and it's syncing, thanks!",
    calls: [["close_ticket", "quote found in message"]],
    outcome: "closed",
    reply: "Glad it's back. I've closed this ticket.",
  },
];

const CALL_GAP = 0.55;

export default function Thread() {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();
  const ticket = tickets[index % tickets.length]!;
  const replyAt = 0.9 + ticket.calls.length * CALL_GAP;
  const hold = (replyAt + ticket.reply.length / 90 + 2.6) * 1000;

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setIndex((i) => i + 1), hold);
    return () => clearTimeout(t);
  }, [index, hold, reduced]);

  return (
    <div {...stylex.props(s.thread)} aria-live="off">
      <AnimatePresence mode="wait">
        <m.div
          key={index}
          initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -24, filter: "blur(6px)" }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          {...stylex.props(s.inner)}
        >
          <div {...stylex.props(s.row)}>
            <span {...stylex.props(s.avatar)}>{ticket.who[0]}</span>
            <div>
              <span {...stylex.props(s.name)}>{ticket.who}</span>
              <p {...stylex.props(s.bubble)}>{ticket.q}</p>
            </div>
          </div>

          <div {...stylex.props(s.trace)}>
            <m.span
              {...stylex.props(s.rail)}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.5, duration: ticket.calls.length * CALL_GAP, ease: "linear" }}
            />
            {ticket.calls.map(([tool, got], j) => (
              <m.div
                key={tool}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + j * CALL_GAP, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                {...stylex.props(s.call)}
              >
                <m.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.75 + j * CALL_GAP, type: "spring", duration: 0.4, bounce: 0.45 }}
                  {...stylex.props(s.mark, tool === "hand_off" ? s.markHand : tool === "file_issue" ? s.markWrite : null)}
                />
                <span {...stylex.props(s.tool)}>{tool}</span>
                <span {...stylex.props(s.scope)}>{scopes[tool]}</span>
                <m.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95 + j * CALL_GAP }} {...stylex.props(s.got)}>
                  {got}
                </m.span>
              </m.div>
            ))}
          </div>

          <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: replyAt - 0.2, duration: 0.35 }} {...stylex.props(s.row)}>
            <img src="/goose.svg" alt="" width={36} height={36} {...stylex.props(s.avatar, s.goose)} />
            <div>
              <span {...stylex.props(s.name, s.billName)}>Bill</span>
              <Typed text={ticket.reply} delay={replyAt} />
              <m.span
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: replyAt + ticket.reply.length / 90 + 0.3, type: "spring", duration: 0.45, bounce: 0.35 }}
                {...stylex.props(s.outcome, s[tone(ticket.outcome)])}
              >
                {ticket.outcome}
              </m.span>
            </div>
          </m.div>
        </m.div>
      </AnimatePresence>
    </div>
  );
}

function tone(o: Outcome) {
  return o === "handed off" ? "handed" : o === "issue filed" ? "issue" : o;
}

function Typed({ text: full, delay }: { text: string; delay: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    let i = 0;
    const start = setTimeout(() => {
      id = setInterval(() => {
        i = Math.min(full.length, i + 3);
        setN(i);
        if (i >= full.length) clearInterval(id);
      }, 33);
    }, delay * 1000);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, [full, delay]);
  return (
    <p {...stylex.props(s.reply)}>
      <span>{full.slice(0, n)}</span>
      <span {...stylex.props(s.ghost)}>{full.slice(n)}</span>
    </p>
  );
}

const sq = { cornerShape: "squircle" } as const;

const s = stylex.create({
  thread: { position: "relative", minHeight: 440, fontFamily: font.sans },
  inner: { display: "grid", gap: 22 },
  row: { display: "grid", gridTemplateColumns: "36px minmax(0, 1fr)", gap: 14, alignItems: "start" },
  avatar: { ...sq, display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: radius.md, backgroundColor: "#d77a3e", color: "#fff", fontWeight: 600, fontSize: text.md },
  goose: { boxSizing: "border-box", padding: 5, backgroundColor: "rgba(255,255,255,0.9)", boxShadow: `inset 0 0 0 1px ${color.line}` },
  name: { display: "block", fontSize: text.sm, fontWeight: 600, color: color.text, marginBottom: 4 },
  billName: { color: color.accentText },
  bubble: { margin: 0, fontSize: 22, lineHeight: 1.35, color: color.text },
  trace: { position: "relative", display: "grid", gap: 10, marginLeft: 17, paddingLeft: 30 },
  rail: { position: "absolute", left: 0, top: -12, bottom: -12, width: 1, backgroundColor: color.lineStrong, transformOrigin: "50% 0" },
  call: { position: "relative", display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "2px 10px", fontFamily: font.mono, fontSize: text.sm },
  mark: { ...sq, position: "absolute", left: -34.5, top: 4, width: 9, height: 9, borderRadius: 3, backgroundColor: color.green, boxShadow: "0 0 0 4px rgba(255,255,255,0.9)" },
  markHand: { backgroundColor: color.yellow },
  markWrite: { backgroundColor: color.accent },
  tool: { color: color.text, fontWeight: 600 },
  scope: { color: color.textFaint },
  got: { flexBasis: "100%", color: color.textDim, fontSize: 12 },
  reply: { margin: 0, fontSize: 19, lineHeight: 1.45, color: color.text, maxWidth: 520 },
  ghost: { color: "transparent" },
  outcome: { ...sq, display: "inline-block", marginTop: 12, fontSize: 13, fontWeight: 500, padding: "3px 9px", borderRadius: radius.sm },
  answered: { backgroundColor: color.accentSoft, color: color.accentText },
  closed: { backgroundColor: color.greenSoft, color: "#0f6b31" },
  handed: { backgroundColor: color.yellowSoft, color: "#7a5b00" },
  issue: { backgroundColor: color.hover, color: color.textDim },
});
