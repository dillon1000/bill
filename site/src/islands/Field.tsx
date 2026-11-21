import { useEffect, useRef } from "react";

/*
 * The hero's background: deep iris, with soft bands of light drifting across and fast streaks of light
 * shooting through them. A few streaks carry an audit hash at their head.
 */

const HEX = "0123456789abcdef";
const hash = () => Array.from({ length: 8 }, () => HEX[Math.floor(Math.random() * 16)]).join("");

interface Streak {
  y: number;
  x: number;
  length: number;
  speed: number;
  bright: number;
  tint: [number, number, number];
  /** Most streaks are out of focus; a few are sharp. */
  sharp: boolean;
  hash?: string;
}
interface Band {
  y: number;
  x: number;
  rx: number;
  ry: number;
  speed: number;
  alpha: number;
  tint: [number, number, number];
}

const TINTS: [number, number, number][] = [
  [255, 255, 255],
  [236, 232, 255],
  [214, 205, 255],
  [255, 240, 252],
];

export default function Field() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext("2d")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, frame = 0, visible = true, last = performance.now();
    let streaks: Streak[] = [];
    let bands: Band[] = [];

    const tint = () => TINTS[Math.floor(Math.random() * TINTS.length)]!;
    const streak = (x?: number): Streak => {
      const length = 160 + Math.random() * Math.min(900, w * 0.6);
      const sharp = Math.random() < 0.18;
      return {
        y: Math.random() * h,
        x: x ?? -Math.random() * w * 0.5,
        length,
        speed: sharp ? 380 + Math.random() * 420 : 90 + Math.random() * 300,
        bright: 0.3 + Math.random() * 0.7,
        tint: tint(),
        sharp,
        hash: sharp && Math.random() < 0.5 ? hash() : undefined,
      };
    };
    const band = (x?: number): Band => ({
      y: h * (0.1 + Math.random() * 0.8),
      x: x ?? -w * 0.6,
      rx: w * (0.35 + Math.random() * 0.45),
      ry: 30 + Math.random() * 90,
      speed: 8 + Math.random() * 26,
      alpha: 0.12 + Math.random() * 0.22,
      tint: tint(),
    });

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      streaks = Array.from({ length: Math.round((w * h) / 20000) }, () => streak(Math.random() * w * 1.3));
      bands = Array.from({ length: 7 }, () => band(Math.random() * w));
    };

    const draw = (now: number) => {
      const dt = reduced ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#7468ff");
      sky.addColorStop(0.45, "#5a49f6");
      sky.addColorStop(1, "#3f28d9");
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Light adds up where it overlaps, as it would.
      ctx.globalCompositeOperation = "lighter";
      for (const b of bands) {
        b.x += b.speed * dt;
        if (b.x - b.rx > w) Object.assign(b, band());
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.scale(b.rx / b.ry, 1);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.ry);
        const [r, gg, bb] = b.tint;
        g.addColorStop(0, `rgba(${r},${gg},${bb},${b.alpha})`);
        g.addColorStop(1, `rgba(${r},${gg},${bb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, b.ry, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.font = '11px "Iosevka", ui-monospace, monospace';
      for (const s of streaks) {
        s.x += s.speed * dt;
        if (s.x - s.length > w) Object.assign(s, streak());
        const [r, g, b] = s.tint;
        const grad = ctx.createLinearGradient(s.x - s.length, 0, s.x, 0);
        grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
        if (s.sharp) {
          grad.addColorStop(0.75, `rgba(${r},${g},${b},${0.5 * s.bright})`);
          grad.addColorStop(1, `rgba(${r},${g},${b},${s.bright})`);
        } else {
          grad.addColorStop(0.55, `rgba(${r},${g},${b},${s.bright})`);
          grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        }
        ctx.strokeStyle = grad;
        ctx.lineCap = "round";
        // Three passes, wide and faint to thin and bright, read as motion blur.
        const passes = s.sharp
          ? ([
              [12, 0.06],
              [4, 0.16],
              [1.2, 0.75],
            ] as const)
          : ([
              [34, 0.04],
              [16, 0.07],
              [6, 0.1],
            ] as const);
        for (const [width, alpha] of passes) {
          ctx.globalAlpha = alpha;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(s.x - s.length, s.y);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        if (s.hash) {
          ctx.fillStyle = `rgba(255,255,255,${0.45 * s.bright})`;
          ctx.fillText(s.hash, s.x + 8, s.y + 4);
        }
      }
      ctx.globalCompositeOperation = "source-over";
      if (!reduced && visible) frame = requestAnimationFrame(draw);
    };

    resize();
    const restart = () => {
      cancelAnimationFrame(frame);
      last = performance.now();
      frame = requestAnimationFrame(draw);
    };
    const ro = new ResizeObserver(() => {
      resize();
      restart();
    });
    ro.observe(el);
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting && !document.hidden;
      if (visible || reduced) restart();
    });
    io.observe(el);
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) restart();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvas} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", background: "#5a49f6" }} />;
}
