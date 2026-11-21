import * as stylex from "@stylexjs/stylex";
import { ArrowCounterClockwiseIcon, HashIcon, PauseIcon, PlayIcon } from "@phosphor-icons/react";
import { AnimatePresence, animate, motion as m, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconButton } from "../components/ui/Button";
import { Segmented } from "../components/ui/Segmented";
import { canonical, chain } from "../lib/chain";
import { color, font, motion, radius, syntax, text } from "../styles/tokens.stylex";
import { scenarios, type Beat } from "./scenarios";

type Audit = Extract<Beat, { type: "audit" }>;

/** How long to wait before a beat appears, so the replay reads at a human pace. */
function delay(beat: Beat | undefined, reduced: boolean) {
  if (!beat) return 0;
  const scale = reduced ? 0.35 : 1;
  switch (beat.type) {
    case "message":
      return (beat.who === "bill" ? 250 : 1100 + Math.min(beat.text.length * 9, 900)) * scale;
    case "note":
      return 700 * scale;
    case "typing":
      return 300 * scale;
    case "audit":
      return beat.ms * scale;
  }
}

export default function Demo() {
  const [id, setId] = useState(scenarios[0]!.id);
  const scenario = scenarios.find((s) => s.id === id)!;
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const inView = useInView(frame, { amount: 0.35, once: true });
  const reduced = useReducedMotion() ?? false;

  useEffect(() => {
    if (inView) setPlaying(true);
  }, [inView]);

  useEffect(() => {
    if (!playing) return;
    if (shown >= scenario.beats.length) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setShown((n) => n + 1), delay(scenario.beats[shown], reduced));
    return () => clearTimeout(t);
  }, [playing, shown, scenario, reduced]);

  const pick = (next: string) => {
    setId(next);
    setShown(0);
    setPlaying(true);
  };
  const replay = () => {
    setShown(0);
    setPlaying(true);
  };

  const beats = scenario.beats.slice(0, shown);
  const lastMessage = beats.findLastIndex((b) => b.type === "message");
  const lastTyping = beats.findLastIndex((b) => b.type === "typing");
  const typing = lastTyping > lastMessage ? (beats[lastTyping] as Extract<Beat, { type: "typing" }>) : null;
  const done = shown >= scenario.beats.length;

  return (
    <div ref={frame} {...stylex.props(s.frame)}>
      <div {...stylex.props(s.bar)}>
        <div {...stylex.props(s.segWrap)}>
          <Segmented label="Conversation" value={id} onChange={pick} options={scenarios.map((x) => ({ value: x.id, label: x.label }))} />
        </div>
        <div {...stylex.props(s.controls)}>
          <span {...stylex.props(s.model)}>openai/gpt-6-luna</span>
          {done ? (
            <IconButton label="Replay" onClick={replay}>
              <ArrowCounterClockwiseIcon size={16} />
            </IconButton>
          ) : (
            <IconButton label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)}>
              {playing ? <PauseIcon size={16} weight="fill" /> : <PlayIcon size={16} weight="fill" />}
            </IconButton>
          )}
        </div>
        <m.div {...stylex.props(s.progress)} animate={{ scaleX: shown / scenario.beats.length }} transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }} />
      </div>
      <div {...stylex.props(s.panes)}>
        <Channel name={scenario.channel} dm={scenario.surface === "dm"} beats={beats} typing={typing} />
        <Trace key={scenario.id} beats={beats} />
      </div>
    </div>
  );
}

function useStickToBottom(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [dep]);
  return ref;
}

const enter = { initial: { opacity: 0, y: 10, filter: "blur(3px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, transition: { duration: 0.42, ease: [0.23, 1, 0.32, 1] as const } };

function Channel({ name, dm, beats, typing }: { name: string; dm: boolean; beats: Beat[]; typing: { name: string } | null }) {
  const messages = beats.filter((b): b is Extract<Beat, { type: "message" }> => b.type === "message");
  const scroller = useStickToBottom(messages.length + (typing ? 0.5 : 0));
  return (
    <section aria-label="Conversation" {...stylex.props(s.channel)}>
      <header {...stylex.props(s.paneHead)}>
        {dm ? <span {...stylex.props(s.headIcon)}>@</span> : <HashIcon size={15} {...stylex.props(s.headIconSvg)} />}
        <span {...stylex.props(s.paneTitle)}>{name}</span>
        <span {...stylex.props(s.paneSub)}>{dm ? "Private" : "The person and the Support Team"}</span>
      </header>
      <div ref={scroller} {...stylex.props(s.scroll)}>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <m.div key={i} {...enter} {...stylex.props(s.msg)}>
              <Avatar who={msg.who} name={msg.name} />
              <div {...stylex.props(s.msgBody)}>
                <div {...stylex.props(s.msgHead)}>
                  <span {...stylex.props(s.msgName, msg.who === "bill" && s.billName)}>{msg.name}</span>
                  {msg.who === "bill" && <span {...stylex.props(s.app)}>App</span>}
                </div>
                <div {...stylex.props(s.msgText)}>
                  {msg.mention && <span {...stylex.props(s.mention)}>@{msg.mention}</span>} <Markdown source={msg.text} />
                </div>
              </div>
            </m.div>
          ))}
          {typing && (
            <m.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} {...stylex.props(s.typing)}>
              <span {...stylex.props(s.typingMarks)}>
                {[0, 1, 2].map((i) => (
                  <m.span key={i} {...stylex.props(s.typingMark)} animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.16 }} />
                ))}
              </span>
              {typing.name} is typing
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function Avatar({ who, name }: { who: string; name: string }) {
  return <span {...stylex.props(s.avatar, who === "bill" ? s.avatarBill : who === "staff" ? s.avatarStaff : s.avatarPerson)}>{who === "bill" ? "b" : name[0]}</span>;
}

/** Just enough Markdown for Bill's replies: paragraphs, numbered steps, bold, links and #channels. */
function Markdown({ source }: { source: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|#[a-z-]+)/g).map((part, i) => {
      if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) return <a key={i} href={link[2]} {...stylex.props(s.link)}>{link[1]}</a>;
      if (/^#[a-z-]+$/.test(part)) return <span key={i} {...stylex.props(s.channelRef)}>{part}</span>;
      return <Fragment key={i}>{part}</Fragment>;
    });
  return (
    <>
      {source.split("\n\n").map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\d+\. /.test(l)))
          return (
            <ol key={i} {...stylex.props(s.ol)}>
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+\. /, ""))}</li>)}
            </ol>
          );
        return <p key={i} {...stylex.props(s.p)}>{inline(block)}</p>;
      })}
    </>
  );
}

function Trace({ beats }: { beats: Beat[] }) {
  const rows = beats.filter((b): b is Audit | Extract<Beat, { type: "note" }> => b.type === "audit" || b.type === "note");
  const audits = useMemo(() => rows.filter((r): r is Audit => r.type === "audit"), [rows]);
  const [hashes, setHashes] = useState<{ previous: string; hash: string }[]>([]);
  useEffect(() => {
    let live = true;
    chain(audits.map((a) => ({ kind: a.kind, tool: a.tool ?? null, scope: a.scope ?? null, data: a.data }))).then((h) => live && setHashes(h));
    return () => {
      live = false;
    };
  }, [audits]);

  const steps = audits.filter((a) => a.kind === "step");
  const tokens = steps.reduce((n, a) => n + Number(a.data.inputTokens ?? 0) + Number(a.data.outputTokens ?? 0), 0);
  const cost = steps.reduce((n, a) => n + Number(a.data.cost ?? 0), 0);
  const calls = audits.filter((a) => a.kind === "tool_call").length;
  const scroller = useStickToBottom(rows.length);
  let auditIndex = -1;

  return (
    <section aria-label="Audit log" {...stylex.props(s.trace)}>
      <header {...stylex.props(s.paneHead)}>
        <span {...stylex.props(s.paneTitle)}>bill_audit</span>
        <span {...stylex.props(s.paneSub)}>Written before each action runs</span>
      </header>
      <div ref={scroller} {...stylex.props(s.scroll, s.traceScroll)}>
        <AnimatePresence initial={false}>
          {rows.map((row, i) => {
            if (row.type === "note")
              return (
                <m.p key={i} {...enter} {...stylex.props(s.note)}>
                  {row.text}
                </m.p>
              );
            auditIndex += 1;
            return <Row key={i} audit={row} link={hashes[auditIndex]} first={auditIndex === 0} />;
          })}
        </AnimatePresence>
      </div>
      <footer {...stylex.props(s.totals)}>
        <Total label="steps" value={steps.length} />
        <Total label="tool calls" value={calls} />
        <Total label="tokens" value={tokens} />
        <Total label="spent" value={cost} money />
      </footer>
    </section>
  );
}

function Total({ label, value, money }: { label: string; value: number; money?: boolean }) {
  const mv = useMotionValue(value);
  const shown = useTransform(mv, (v) => (money ? `$${v.toFixed(4)}` : Math.round(v).toLocaleString("en-US")));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.6, ease: [0.23, 1, 0.32, 1] });
    return () => controls.stop();
  }, [mv, value]);
  return (
    <span {...stylex.props(s.total)}>
      <m.span {...stylex.props(s.totalValue)}>{shown}</m.span> {label}
    </span>
  );
}

function Row({ audit, link, first }: { audit: Audit; link?: { previous: string; hash: string }; first: boolean }) {
  const [open, setOpen] = useState(audit.kind === "tool_result");
  const summary = audit.kind === "step" ? stepSummary(audit.data) : audit.kind === "started" ? `${(audit.data.scopes as string[]).length} scopes` : audit.kind === "reply" ? replySummary(audit.data) : canonical(audit.data.input ?? audit.data.output ?? {});
  return (
    <m.div {...enter} {...stylex.props(s.row)}>
      <div {...stylex.props(s.rail)}>
        {!first && <m.span {...stylex.props(s.railLine)} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }} />}
        <span {...stylex.props(s.railMark, s[`mark_${audit.kind}`])} />
      </div>
      <div {...stylex.props(s.rowMain)}>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} {...stylex.props(s.rowHead)}>
          <span {...stylex.props(s.kind, s[`kind_${audit.kind}`])}>{audit.kind}</span>
          {audit.tool && <span {...stylex.props(s.tool)}>{audit.tool}</span>}
          {audit.scope && <span {...stylex.props(s.scope)}>{audit.scope}</span>}
          <span {...stylex.props(s.summary)}>{summary}</span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }} {...stylex.props(s.detail)}>
              <Json value={audit.data} />
            </m.div>
          )}
        </AnimatePresence>
        <Hash link={link} />
      </div>
    </m.div>
  );
}

function stepSummary(d: Record<string, unknown>) {
  const calls = d.toolCalls as string[];
  return `${calls.length ? calls.join(", ") : "writes the reply"} · ${Number(d.inputTokens).toLocaleString("en-US")} in`;
}
function replySummary(d: Record<string, unknown>) {
  return d.closed ? "closed the ticket" : d.handedOff ? "handed off" : "sent";
}

/** The event's hash, scrambling until SHA-256 has run, then settling. */
function Hash({ link }: { link?: { previous: string; hash: string } }) {
  const [shown, setShown] = useState("················");
  useEffect(() => {
    if (!link) return;
    let frame = 0;
    const target = link.hash.slice(0, 16);
    const hex = "0123456789abcdef";
    const id = setInterval(() => {
      frame += 1;
      setShown([...target].map((c, i) => (i < frame - 4 ? c : hex[Math.floor(Math.random() * 16)])).join(""));
      if (frame > 20) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [link?.hash]);
  return (
    <div {...stylex.props(s.hash)}>
      <span {...stylex.props(s.hashLabel)}>prev</span> {link ? link.previous.slice(0, 8) : "········"} <span {...stylex.props(s.hashLabel)}>hash</span> {shown}
    </div>
  );
}

function Json({ value, depth = 0 }: { value: unknown; depth?: number }): ReactNode {
  if (value === null) return <span {...stylex.props(s.jNull)}>null</span>;
  if (typeof value === "string") return <span {...stylex.props(s.jString)}>"{value}"</span>;
  if (typeof value === "number" || typeof value === "boolean") return <span {...stylex.props(s.jNumber)}>{String(value)}</span>;
  const pad = "  ".repeat(depth + 1), end = "  ".repeat(depth);
  if (Array.isArray(value)) {
    if (!value.length) return <span>[]</span>;
    return (
      <>
        [{"\n"}
        {value.map((v, i) => (
          <Fragment key={i}>
            {pad}
            <Json value={v} depth={depth + 1} />
            {i < value.length - 1 ? "," : ""}
            {"\n"}
          </Fragment>
        ))}
        {end}]
      </>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return <span>{"{}"}</span>;
  return (
    <>
      {"{"}
      {"\n"}
      {entries.map(([k, v], i) => (
        <Fragment key={k}>
          {pad}
          <span {...stylex.props(s.jKey)}>{k}</span>: <Json value={v} depth={depth + 1} />
          {i < entries.length - 1 ? "," : ""}
          {"\n"}
        </Fragment>
      ))}
      {end}
      {"}"}
    </>
  );
}

const sq = { cornerShape: "squircle" } as const;

const s = stylex.create({
  frame: {
    ...sq,
    position: "relative",
    borderRadius: radius.xl,
    backgroundColor: color.bg,
    boxShadow: "0 0 0 1px rgba(17,18,20,0.09), 0 30px 80px -24px rgba(17,18,20,0.18), 0 8px 20px -8px rgba(17,18,20,0.08)",
    overflow: "hidden",
    fontFamily: font.sans,
    color: color.text,
  },
  bar: { position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: 10, borderBottom: `1px solid ${color.line}`, backgroundColor: color.surface },
  segWrap: { minWidth: 0, maxWidth: "100%", overflowX: "auto", scrollbarWidth: "none", flexShrink: 1 },
  controls: { display: "flex", alignItems: "center", gap: 8 },
  model: { fontFamily: font.mono, fontSize: text.xs, color: color.textFaint, display: { default: "inline", "@media (max-width: 640px)": "none" } },
  progress: { position: "absolute", left: 0, right: 0, bottom: -1, height: 2, backgroundColor: color.accent, transformOrigin: "0 50%" },
  panes: { display: "grid", gridTemplateColumns: { default: "minmax(0, 1.05fr) minmax(0, 1fr)", "@media (max-width: 860px)": "1fr" }, height: { default: 600, "@media (max-width: 860px)": "auto" } },
  channel: { display: "flex", flexDirection: "column", minHeight: 0, height: { default: "auto", "@media (max-width: 860px)": 460 }, borderRight: { default: `1px solid ${color.line}`, "@media (max-width: 860px)": "none" } },
  trace: { display: "flex", flexDirection: "column", minHeight: 0, height: { default: "auto", "@media (max-width: 860px)": 460 }, backgroundColor: color.surface, borderTop: { default: "none", "@media (max-width: 860px)": `1px solid ${color.line}` } },
  paneHead: { display: "flex", alignItems: "baseline", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${color.line}`, minWidth: 0 },
  headIcon: { color: color.textFaint, fontWeight: 600 },
  headIconSvg: { color: color.textFaint, alignSelf: "center" },
  paneTitle: { fontWeight: 600, fontSize: text.md, fontFamily: font.mono },
  paneSub: { fontSize: text.sm, color: color.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  scroll: { flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 16, scrollbarWidth: "thin" },
  traceScroll: { gap: 4, padding: "14px 12px 18px" },
  msg: { display: "grid", gridTemplateColumns: "34px 1fr", gap: 12 },
  avatar: { ...sq, width: 34, height: 34, borderRadius: radius.md, display: "grid", placeItems: "center", fontWeight: 600, fontSize: text.md, color: "#fff" },
  avatarBill: { backgroundColor: color.accent, fontFamily: font.mono, fontSize: 18 },
  avatarPerson: { backgroundColor: "#d77a3e" },
  avatarStaff: { backgroundColor: "#2f8f6b" },
  msgBody: { minWidth: 0 },
  msgHead: { display: "flex", alignItems: "center", gap: 6, marginBottom: 2 },
  msgName: { fontWeight: 600, fontSize: text.base },
  billName: { color: color.accentText },
  app: { ...sq, fontSize: 11, fontWeight: 600, padding: "1px 5px", borderRadius: 4, backgroundColor: color.accent, color: color.onAccent },
  msgText: { fontSize: text.base, lineHeight: 1.55, color: color.text, overflowWrap: "anywhere" },
  mention: { ...sq, padding: "0 3px", borderRadius: 4, backgroundColor: color.accentSoft, color: color.accentText, fontWeight: 500 },
  p: { margin: "0 0 6px" },
  ol: { margin: "4px 0 8px", paddingLeft: 20, display: "grid", gap: 2 },
  link: { color: color.accentText, textDecoration: "none", ":hover": { textDecoration: "underline" } },
  channelRef: { ...sq, padding: "0 3px", borderRadius: 4, backgroundColor: color.accentSoft, color: color.accentText },
  typing: { display: "flex", alignItems: "center", gap: 8, fontSize: text.sm, color: color.textFaint, paddingLeft: 46 },
  typingMarks: { display: "inline-flex", gap: 3 },
  typingMark: { ...sq, width: 6, height: 6, borderRadius: 2, backgroundColor: color.textDim },
  note: { margin: "6px 0 6px 26px", fontSize: text.sm, lineHeight: 1.5, color: color.textDim, borderLeft: `2px solid ${color.accent}`, paddingLeft: 10 },
  row: { display: "grid", gridTemplateColumns: "18px minmax(0, 1fr)", gap: 8 },
  rail: { position: "relative", display: "flex", justifyContent: "center" },
  railLine: { position: "absolute", top: -6, height: 16, width: 1, backgroundColor: color.lineStrong, transformOrigin: "50% 0" },
  railMark: { ...sq, marginTop: 10, width: 9, height: 9, borderRadius: 3, backgroundColor: color.textFaint, zIndex: 1 },
  mark_started: { backgroundColor: color.text },
  mark_step: { backgroundColor: color.blue },
  mark_tool_call: { backgroundColor: color.accent },
  mark_tool_result: { backgroundColor: color.green },
  mark_reply: { backgroundColor: color.text },
  rowMain: { minWidth: 0, paddingBottom: 6 },
  rowHead: {
    ...sq,
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    width: "100%",
    padding: "5px 8px",
    borderWidth: 0,
    borderRadius: radius.sm,
    backgroundColor: { default: "transparent", ":hover": color.hover },
    textAlign: "left",
    cursor: "pointer",
    fontFamily: font.mono,
    fontSize: text.sm,
    color: color.text,
    transitionProperty: "background-color",
    transitionDuration: motion.fast,
  },
  kind: { fontWeight: 500, flexShrink: 0 },
  kind_started: {},
  kind_step: { color: color.blue },
  kind_tool_call: { color: color.accentText },
  kind_tool_result: { color: color.green },
  kind_reply: {},
  tool: { fontWeight: 600, flexShrink: 0 },
  scope: { color: color.textFaint, flexShrink: 0, display: { default: "inline", "@media (max-width: 1100px)": "none" } },
  summary: { color: color.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 },
  detail: { overflow: "hidden", fontFamily: font.mono, fontSize: 12, lineHeight: 1.55, whiteSpace: "pre-wrap", color: syntax.punctuation, margin: "2px 8px 0", paddingLeft: 10, borderLeft: `1px solid ${color.line}` },
  hash: { fontFamily: font.mono, fontSize: 11, color: color.textDim, padding: "2px 8px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  hashLabel: { color: color.textFaint },
  totals: { display: "flex", flexWrap: "wrap", gap: "4px 16px", padding: "10px 16px", borderTop: `1px solid ${color.line}`, fontSize: text.sm, color: color.textFaint, backgroundColor: color.bg },
  total: { whiteSpace: "nowrap" },
  totalValue: { fontFamily: font.mono, color: color.text, fontVariantNumeric: "tabular-nums" },
  jKey: { color: syntax.property },
  jString: { color: syntax.string },
  jNumber: { color: syntax.number },
  jNull: { color: syntax.comment },
});
