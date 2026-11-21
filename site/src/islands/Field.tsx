import { useEffect, useRef } from "react";

/*
 * The hero's background: lanes across the full width, with audit events flowing along them.
 * Calls arc to their results on another lane; every event leaves a short hash behind it.
 */

const KINDS = [
  { color: [85, 70, 245], weight: 5 }, // tool_call
  { color: [23, 163, 74], weight: 5 }, // tool_result
  { color: [59, 91, 240], weight: 3 }, // step
  { color: [17, 18, 20], weight: 1.5 }, // started, reply
  { color: [217, 58, 49], weight: 0.4 }, // denied
] as const;
const HEX = "0123456789abcdef";

interface Packet {
  lane: number;
  x: number;
  speed: number;
  kind: number;
  size: number;
  hash: string;
  link?: { lane: number; x: number; born: number };
}

const pickKind = () => {
  const total = KINDS.reduce((n, k) => n + k.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < KINDS.length; i++) if ((r -= KINDS[i]!.weight) <= 0) return i;
  return 0;
};
const hash = () => Array.from({ length: 6 }, () => HEX[Math.floor(Math.random() * 16)]).join("");

export default function Field() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext("2d")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, lanes = 0, gap = 0, frame = 0, visible = true, last = performance.now();
    let packets: Packet[] = [];

    const laneY = (i: number) => gap * (i + 1);
    const spawn = (x?: number): Packet => {
      const kind = pickKind();
      const lane = Math.floor(Math.random() * lanes);
      const p: Packet = { lane, x: x ?? -20 - Math.random() * w * 0.3, speed: 22 + Math.random() * 46, kind, size: kind === 3 ? 9 : 7, hash: hash() };
      if (kind === 0 && Math.random() < 0.55) p.link = { lane: (lane + 1 + Math.floor(Math.random() * 2)) % lanes, x: 0, born: 0 };
      return p;
    };
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lanes = Math.max(5, Math.round(h / 72));
      gap = h / (lanes + 1);
      const count = Math.round((w * lanes) / 170);
      packets = Array.from({ length: count }, () => spawn(Math.random() * w));
    };

    const squircle = (x: number, y: number, s: number) => {
      ctx.beginPath();
      ctx.roundRect(x - s / 2, y - s / 2, s, s, s * 0.32);
      ctx.fill();
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(17,18,20,0.08)";
      for (let i = 0; i < lanes; i++) {
        ctx.beginPath();
        ctx.moveTo(0, Math.round(laneY(i)) + 0.5);
        ctx.lineTo(w, Math.round(laneY(i)) + 0.5);
        ctx.stroke();
      }

      ctx.font = '10px "Iosevka", ui-monospace, monospace';
      for (const p of packets) {
        if (!reduced) p.x += p.speed * dt;
        const y = laneY(p.lane);
        const [r, g, b] = KINDS[p.kind]!.color;
        const fade = Math.min(1, Math.max(0, p.x / 120), Math.max(0, (w - p.x) / 120));

        // The trail it leaves along its lane.
        const tail = 60 + p.speed * 2.2;
        const trail = ctx.createLinearGradient(p.x - tail, 0, p.x, 0);
        trail.addColorStop(0, `rgba(${r},${g},${b},0)`);
        trail.addColorStop(1, `rgba(${r},${g},${b},${0.5 * fade})`);
        ctx.strokeStyle = trail;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - tail, y);
        ctx.lineTo(p.x, y);
        ctx.stroke();

        // A call arcs to its result on another lane, then lets go.
        if (p.link) {
          if (!p.link.born && p.x > w * 0.15) p.link = { ...p.link, x: p.x, born: now };
          if (p.link.born) {
            const age = (now - p.link.born) / 1600;
            if (age < 1) {
              const y2 = laneY(p.link.lane);
              ctx.strokeStyle = `rgba(${r},${g},${b},${0.55 * (1 - age) * fade})`;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(p.x, y);
              ctx.bezierCurveTo(p.x + 40, y, p.x + 20, y2, p.x + 60, y2);
              ctx.stroke();
              ctx.fillStyle = `rgba(23,163,74,${0.8 * (1 - age) * fade})`;
              squircle(p.x + 60, y2, 6);
            }
          }
        }

        ctx.fillStyle = `rgba(${r},${g},${b},${0.14 * fade})`;
        squircle(p.x, y, p.size * 2.6);
        ctx.fillStyle = `rgba(${r},${g},${b},${0.95 * fade})`;
        squircle(p.x, y, p.size);
        ctx.fillStyle = `rgba(17,18,20,${0.3 * fade})`;
        ctx.fillText(p.hash, p.x - 44, y - 7);
      }
      packets = packets.map((p) => (p.x > w + 40 ? spawn() : p));
      if (!reduced && visible) frame = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting && !document.hidden;
      cancelAnimationFrame(frame);
      last = performance.now();
      if (visible || reduced) frame = requestAnimationFrame(draw);
    });
    io.observe(el);
    const onVisibility = () => {
      visible = !document.hidden;
      cancelAnimationFrame(frame);
      last = performance.now();
      if (visible) frame = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvas} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />;
}
