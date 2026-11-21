import * as stylex from "@stylexjs/stylex";
import { LayoutGroup, motion as m } from "motion/react";
import { useState } from "react";
import { Segmented } from "../components/ui/Segmented";
import { Switch } from "../components/ui/Switch";
import { color, font, radius, text } from "../styles/tokens.stylex";

type Surface = "ticket" | "forum" | "dm" | "web";

// SurfacePolicy.defaults, word for word.
const bySurface: Record<Surface, string[]> = {
  ticket: ["docs:read", "code:read", "history:read", "account:read", "account:detail", "ticket:handoff", "ticket:triage", "ticket:close", "issues:write"],
  dm: ["docs:read", "code:read", "history:read", "account:read", "account:detail", "ticket:handoff", "issues:write"],
  web: ["docs:read", "code:read", "history:read", "account:read", "account:detail", "ticket:handoff", "issues:write"],
  forum: ["docs:read", "code:read", "ticket:handoff", "issues:write"],
};

const groups: { scope: string; tools: string[]; from: string }[] = [
  { scope: "docs:read", tools: ["search_docs", "read_doc"], from: "DocsPlugin" },
  { scope: "code:read", tools: ["search_code", "read_file", "list_directory", "recent_changes", "search_pull_requests", "read_pull_request", "search_issues"], from: "GitHubPlugin" },
  { scope: "account:read", tools: ["my_account"], from: "Your plugin" },
  { scope: "history:read", tools: ["my_support_history"], from: "Your plugin" },
  { scope: "account:detail", tools: ["bot_runs"], from: "Your plugin" },
  { scope: "ticket:handoff", tools: ["hand_off"], from: "DeskPlugin" },
  { scope: "ticket:triage", tools: ["triage_ticket"], from: "DeskPlugin" },
  { scope: "ticket:close", tools: ["close_ticket"], from: "DeskPlugin" },
  { scope: "issues:write", tools: ["file_issue"], from: "GitHubPlugin" },
];

/** What SurfacePolicy.scopes(for:) grants, and why anything is held back. */
function policy(surface: Surface, linked: boolean, consent: boolean) {
  const reasons = new Map<string, string>();
  for (const g of groups) if (!bySurface[surface].includes(g.scope)) reasons.set(g.scope, surface === "forum" ? "Public post" : "Not on this surface");
  if (!linked) for (const sc of ["account:read", "account:detail", "history:read"]) if (!reasons.has(sc)) reasons.set(sc, "Not linked");
  if (!consent && !reasons.has("account:detail")) reasons.set("account:detail", "No consent");
  if (surface !== "ticket") for (const sc of ["ticket:triage", "ticket:close"]) if (!reasons.has(sc)) reasons.set(sc, "No ticket");
  return reasons;
}

const surfaces: { value: Surface; label: string }[] = [
  { value: "ticket", label: "Ticket" },
  { value: "forum", label: "Forum post" },
  { value: "dm", label: "DM" },
  { value: "web", label: "In-app chat" },
];

export default function Scopes() {
  const [surface, setSurface] = useState<Surface>("ticket");
  const [linked, setLinked] = useState(true);
  const [consent, setConsent] = useState(false);
  const withheld = policy(surface, linked, consent);
  const total = groups.reduce((n, g) => n + g.tools.length, 0);
  const offered = groups.reduce((n, g) => n + (withheld.has(g.scope) ? 0 : g.tools.length), 0);

  return (
    <div {...stylex.props(s.wrap)}>
      <div {...stylex.props(s.controls)}>
        <Segmented label="Where the conversation is" value={surface} onChange={setSurface} options={surfaces} />
        <label {...stylex.props(s.toggle)}>
          <Switch checked={linked} onChange={setLinked} label="Discord linked to an account" />
          Discord linked to an account
        </label>
        <label {...stylex.props(s.toggle)}>
          <Switch checked={consent} onChange={setConsent} label="Support access turned on" />
          Support access turned on
        </label>
        <p {...stylex.props(s.count)}>
          <m.span key={offered} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} {...stylex.props(s.countNum)}>
            {offered}
          </m.span>{" "}
          of {total} tools offered to the model. The rest don't exist as far as it knows, and refuse to run if it asks anyway.
        </p>
      </div>
      <LayoutGroup>
        <div {...stylex.props(s.grid)}>
          {groups.map((g) => {
            const reason = withheld.get(g.scope);
            return (
              <m.div layout key={g.scope} {...stylex.props(s.group, reason ? s.groupOff : null)} transition={{ type: "spring", duration: 0.45, bounce: 0 }}>
                <div {...stylex.props(s.groupHead)}>
                  <span {...stylex.props(s.scope)}>{g.scope}</span>
                  <m.span key={reason ?? "on"} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} {...stylex.props(s.reason, !reason && s.reasonOn)}>
                    {reason ?? g.from}
                  </m.span>
                </div>
                <div {...stylex.props(s.tools)}>
                  {g.tools.map((t, i) => (
                    <m.span
                      key={t}
                      animate={{ opacity: reason ? 0.42 : 1, filter: reason ? "grayscale(1)" : "grayscale(0)" }}
                      transition={{ delay: i * 0.03, duration: 0.25 }}
                      {...stylex.props(s.chip, reason ? s.chipOff : null)}
                    >
                      {t}
                    </m.span>
                  ))}
                </div>
              </m.div>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}

const sq = { cornerShape: "squircle" } as const;

const s = stylex.create({
  wrap: { display: "grid", gridTemplateColumns: { default: "minmax(0, 340px) minmax(0, 1fr)", "@media (max-width: 900px)": "1fr" }, gap: 32, alignItems: "start", fontFamily: font.sans },
  controls: { display: "grid", gap: 16, position: { default: "sticky", "@media (max-width: 900px)": "static" }, top: 96 },
  toggle: { display: "flex", alignItems: "center", gap: 10, fontSize: text.base, color: color.text, cursor: "pointer" },
  count: { margin: 0, fontSize: text.base, lineHeight: 1.55, color: color.textDim },
  countNum: { display: "inline-block", fontFamily: font.mono, fontSize: 28, color: color.text, fontWeight: 500, fontVariantNumeric: "tabular-nums", marginRight: 2 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", borderTop: `1px solid ${color.line}`, borderLeft: `1px solid ${color.line}` },
  group: { padding: 16, minHeight: 112, borderRight: `1px solid ${color.line}`, borderBottom: `1px solid ${color.line}`, backgroundColor: color.bg, transitionProperty: "background-color", transitionDuration: "240ms" },
  groupOff: { backgroundColor: color.surface },
  groupHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 12 },
  scope: { fontFamily: font.mono, fontSize: text.sm, fontWeight: 500, color: color.text },
  reason: { fontSize: text.xs, color: color.redText },
  reasonOn: { color: color.textFaint },
  tools: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { ...sq, fontFamily: font.mono, fontSize: 12, padding: "3px 7px", borderRadius: radius.sm, backgroundColor: color.accentSoft, color: color.accentText },
  chipOff: { backgroundColor: color.hover, color: color.textFaint, textDecoration: "line-through" },
});
