import * as stylex from "@stylexjs/stylex";
import { ArrowCounterClockwiseIcon, TrashIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion as m } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { GENESIS, canonical, chain, sha256 } from "../lib/chain";
import { color, font, radius, text } from "../styles/tokens.stylex";

interface Fields {
  kind: string;
  tool: string | null;
  field: string;
  value: string;
}
interface Event extends Fields {
  id: number;
  previousHash: string;
  hash: string;
}

const seed: Fields[] = [
  { kind: "started", tool: null, field: "model", value: "openai/gpt-6-luna" },
  { kind: "tool_call", tool: "recent_errors", field: "device", value: "Pixel 8" },
  { kind: "tool_result", tool: "recent_errors", field: "code", value: "401 token_expired" },
  { kind: "tool_call", tool: "close_ticket", field: "confirmation", value: "it's syncing, thanks" },
  { kind: "reply", tool: null, field: "closed", value: "true" },
];

const hashOf = (f: Fields, previousHash: string) => sha256(canonical({ kind: f.kind, tool: f.tool, data: { [f.field]: f.value }, previousHash }));

type Verdict = "ok" | "data" | "link";

export default function Chain() {
  const [events, setEvents] = useState<Event[]>([]);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);

  const reset = async () => {
    const links = await chain(seed.map((f) => ({ kind: f.kind, tool: f.tool, data: { [f.field]: f.value } })));
    setEvents(seed.map((f, i) => ({ ...f, id: i, previousHash: links[i]!.previous, hash: links[i]!.hash })));
  };
  useEffect(() => {
    void reset();
  }, []);

  // AuditLog.verify: each event must hash true, and carry the hash of the one before it.
  useEffect(() => {
    let live = true;
    Promise.all(
      events.map(async (e, i) => {
        if (e.previousHash !== (i === 0 ? GENESIS : events[i - 1]!.hash)) return "link" as const;
        return (await hashOf(e, e.previousHash)) === e.hash ? ("ok" as const) : ("data" as const);
      }),
    ).then((v) => live && setVerdicts(v));
    return () => {
      live = false;
    };
  }, [events]);

  const edit = (id: number, value: string) => setEvents((list) => list.map((e) => (e.id === id ? { ...e, value } : e)));
  const rehash = async (id: number) => {
    const e = events.find((x) => x.id === id)!;
    const hash = await hashOf(e, e.previousHash);
    setEvents((list) => list.map((x) => (x.id === id ? { ...x, hash } : x)));
  };
  const remove = (id: number) => setEvents((list) => list.filter((e) => e.id !== id));

  const broken = verdicts.findIndex((v) => v !== "ok");
  const tampered = events.length !== seed.length || events.some((e) => e.value !== seed[e.id]!.value);

  return (
    <div {...stylex.props(s.wrap)}>
      <div {...stylex.props(s.status, broken >= 0 ? s.statusBad : s.statusOk)} aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <m.span key={broken} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            {broken < 0
              ? `AuditLog.verify: true. ${events.length} events, each carrying the hash of the one before.`
              : verdicts[broken] === "data"
                ? `AuditLog.verify: false. Event ${broken + 1}'s data no longer matches its hash.`
                : `AuditLog.verify: false. Event ${broken + 1} doesn't carry the hash of the event before it.`}
          </m.span>
        </AnimatePresence>
        {tampered || broken >= 0 ? (
          <Button size="sm" variant="ghost" icon={<ArrowCounterClockwiseIcon size={14} />} onClick={() => void reset()}>
            Reset
          </Button>
        ) : null}
      </div>
      <m.ol layout {...stylex.props(s.list)}>
        <AnimatePresence initial={false}>
          {events.map((e, i) => {
            const verdict = verdicts[i] ?? "ok";
            return (
              <m.li
                layout
                key={e.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1, x: verdict === "ok" ? 0 : [0, -4, 4, -2, 0] }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ type: "spring", duration: 0.5, bounce: 0 }}
                {...stylex.props(s.card, verdict !== "ok" && s.cardBad)}
              >
                {i > 0 && <span aria-hidden {...stylex.props(s.link, verdict === "link" && s.linkBad)} />}
                <div {...stylex.props(s.head)}>
                  <span {...stylex.props(s.index)}>{i + 1}</span>
                  <span {...stylex.props(s.kind)}>{e.kind}</span>
                  {e.tool && <span {...stylex.props(s.tool)}>{e.tool}</span>}
                </div>
                <label {...stylex.props(s.fieldLabel)}>
                  {e.field}
                  <input value={e.value} onChange={(ev) => edit(e.id, ev.target.value)} spellCheck={false} {...stylex.props(s.input)} />
                </label>
                <dl {...stylex.props(s.hashes)}>
                  <dt {...stylex.props(s.dt)}>previousHash</dt>
                  <dd {...stylex.props(s.dd, verdict === "link" && s.ddBad)}>{e.previousHash.slice(0, 12)}…</dd>
                  <dt {...stylex.props(s.dt)}>hash</dt>
                  <dd {...stylex.props(s.dd, verdict === "data" && s.ddBad)}>{e.hash.slice(0, 12)}…</dd>
                </dl>
                <div {...stylex.props(s.actions)}>
                  {verdict === "data" ? (
                    <Button size="sm" variant="secondary" onClick={() => void rehash(e.id)}>
                      Forge its hash
                    </Button>
                  ) : (
                    <span {...stylex.props(s.verdict, verdict === "ok" ? s.verdictOk : s.verdictBad)}>{verdict === "ok" ? "Verified" : "Chain broken"}</span>
                  )}
                  <button type="button" aria-label={`Delete event ${i + 1}`} onClick={() => remove(e.id)} {...stylex.props(s.delete)}>
                    <TrashIcon size={14} />
                  </button>
                </div>
              </m.li>
            );
          })}
        </AnimatePresence>
      </m.ol>
    </div>
  );
}

const sq = { cornerShape: "squircle" } as const;

const s = stylex.create({
  wrap: { display: "grid", gap: 16, fontFamily: font.sans, color: color.text },
  status: { ...sq, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44, padding: "8px 8px 8px 14px", borderRadius: radius.lg, fontFamily: font.mono, fontSize: text.sm, transitionProperty: "background-color, color", transitionDuration: "240ms" },
  // Opaque, so the status reads on any section background.
  statusOk: { backgroundColor: "#e5f6eb", color: "#0f6b31" },
  statusBad: { backgroundColor: "#fdebea", color: color.redText },
  list: { listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: { default: "repeat(5, minmax(0, 1fr))", "@media (max-width: 1000px)": "1fr" }, gap: { default: 20, "@media (max-width: 1000px)": 14 } },
  card: { ...sq, position: "relative", display: "grid", gap: 12, alignContent: "start", padding: 14, borderRadius: radius.lg, backgroundColor: color.bg, boxShadow: `0 0 0 1px ${color.line}`, transitionProperty: "box-shadow", transitionDuration: "200ms" },
  cardBad: { boxShadow: `0 0 0 1px ${color.redLine}, 0 0 0 4px ${color.redSoft}` },
  link: {
    position: "absolute",
    backgroundColor: color.lineStrong,
    left: { default: -21, "@media (max-width: 1000px)": 24 },
    top: { default: 30, "@media (max-width: 1000px)": -15 },
    width: { default: 22, "@media (max-width: 1000px)": 2 },
    height: { default: 2, "@media (max-width: 1000px)": 16 },
    transitionProperty: "background-color",
    transitionDuration: "200ms",
  },
  linkBad: { backgroundColor: color.red },
  head: { display: "flex", alignItems: "baseline", gap: 8, fontFamily: font.mono, fontSize: text.sm, flexWrap: "wrap" },
  index: { color: color.textFaint },
  kind: { fontWeight: 500 },
  tool: { color: color.accentText },
  fieldLabel: { display: "grid", gap: 4, fontFamily: font.mono, fontSize: text.xs, color: color.textFaint },
  input: {
    ...sq,
    width: "100%",
    boxSizing: "border-box",
    padding: "6px 8px",
    borderRadius: radius.sm,
    borderWidth: 0,
    boxShadow: { default: `inset 0 0 0 1px ${color.lineStrong}`, ":focus": `inset 0 0 0 1px ${color.accent}, 0 0 0 3px ${color.accentSoft}` },
    outline: "none",
    backgroundColor: color.surface,
    fontFamily: font.mono,
    fontSize: text.sm,
    color: color.text,
  },
  hashes: { margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 8px", fontFamily: font.mono, fontSize: 11 },
  dt: { color: color.textFaint },
  dd: { margin: 0, color: color.textDim, overflow: "hidden", textOverflow: "ellipsis", transitionProperty: "color", transitionDuration: "200ms" },
  ddBad: { color: color.redText, fontWeight: 600 },
  actions: { display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 28 },
  verdict: { fontSize: text.xs, fontWeight: 500 },
  verdictOk: { color: color.green },
  verdictBad: { color: color.redText },
  delete: { ...sq, display: "grid", placeItems: "center", width: 28, height: 28, borderWidth: 0, borderRadius: radius.sm, backgroundColor: { default: "transparent", ":hover": color.redSoft }, color: { default: color.textFaint, ":hover": color.redText }, cursor: "pointer" },
});
