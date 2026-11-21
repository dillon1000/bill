import { useEffect, useRef } from "react";

/*
 * A section background: a sky, with soft bands of light drifting across and fast streaks of light
 * shooting through them. A few streaks carry an audit hash at their head.
 */

type RGB = [number, number, number];
interface Palette {
  sky: [string, string, string];
  tints: RGB[];
  /** "lighter" adds light on dark skies; on a pale sky the streaks are drawn as colour instead. */
  blend: GlobalCompositeOperation;
  strength: number;
  density: number;
  hashColor: string;
  /** Backing-store scale. Soft backgrounds look the same at half resolution and cost a quarter as much to paint. */
  resolution: number;
}

const palettes = {
  iris: {
    sky: ["#7468ff", "#5a49f6", "#3f28d9"],
    tints: [[255, 255, 255], [236, 232, 255], [214, 205, 255], [255, 240, 252]],
    blend: "lighter",
    strength: 1,
    density: 20000,
    resolution: 0.5,
    hashColor: "255,255,255",
  },
  night: {
    sky: ["#17123a", "#120e2c", "#0b0820"],
    tints: [[122, 107, 255], [180, 170, 255], [255, 255, 255], [96, 70, 240]],
    blend: "lighter",
    strength: 0.7,
    density: 26000,
    resolution: 0.5,
    hashColor: "190,182,255",
  },
  mist: {
    sky: ["#f7f6ff", "#f1eeff", "#ebe7ff"],
    tints: [[85, 70, 245], [120, 104, 255], [160, 148, 255], [255, 255, 255]],
    blend: "source-over",
    strength: 0.42,
    density: 30000,
    resolution: 0.5,
    hashColor: "85,70,245",
  },
} satisfies Record<string, Palette>;

export type FieldTone = keyof typeof palettes;

const HEX = "0123456789abcdef";
const hash = () => Array.from({ length: 8 }, () => HEX[Math.floor(Math.random() * 16)]).join("");

interface Streak {
  y: number;
  x: number;
  length: number;
  speed: number;
  bright: number;
  tint: RGB;
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
  tint: RGB;
}

export default function Field({ tone = "iris" }: { tone?: FieldTone }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const palette: Palette = palettes[tone];

  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext("2d")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, frame = 0, visible = true, last = performance.now();
    let streaks: Streak[] = [];
    let bands: Band[] = [];

    const tint = () => palette.tints[Math.floor(Math.random() * palette.tints.length)]!;
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
      alpha: (0.12 + Math.random() * 0.22) * palette.strength,
      tint: tint(),
    });

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2) * palette.resolution;
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      streaks = Array.from({ length: Math.round((w * h) / palette.density) }, () => streak(Math.random() * w * 1.3));
      bands = Array.from({ length: palette.resolution < 1 ? 4 : 7 }, () => band(Math.random() * w));
    };

    const draw = (now: number) => {
      const dt = reduced ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, palette.sky[0]);
      sky.addColorStop(0.45, palette.sky[1]);
      sky.addColorStop(1, palette.sky[2]);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Light adds up where it overlaps, as it would.
      ctx.globalCompositeOperation = palette.blend;
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
          : palette.resolution < 1
            ? ([
                [24, 0.06],
                [8, 0.12],
              ] as const)
            : ([
                [34, 0.04],
                [16, 0.07],
                [6, 0.1],
              ] as const);
        for (const [width, alpha] of passes) {
          ctx.globalAlpha = alpha * palette.strength;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(s.x - s.length, s.y);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        if (s.hash) {
          ctx.fillStyle = `rgba(${palette.hashColor},${0.45 * s.bright * Math.max(palette.strength, 0.6)})`;
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

  return <canvas ref={canvas} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", background: palette.sky[1] }} />;
}
