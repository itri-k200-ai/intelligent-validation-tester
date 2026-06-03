"use client";
import { type ReactNode } from "react";

import { cn } from "@/lib/cn";

export type HudOctagonState = "default" | "current" | "done" | "disabled";
export type HudOctagonKind =
  | "radar"
  | "sensor"
  | "tower"
  | "neural"
  | "building"
  | "satellite";

interface Props {
  kind: HudOctagonKind;
  state?: HudOctagonState;
  label?: string;
  className?: string;
}

/**
 * Octagonal HUD frame with sci-fi line illustration inside.
 * War_Room_mockup Page 13 — LABS illustration set.
 *
 * State drives the frame colour + glow via globals.css:
 *   default  — dim teal outline
 *   current  — bright mint outline + glow (focus)
 *   done     — solid teal outline
 *   disabled — faded white
 *
 * Wall-mode scaling lives in globals.css under `.hud-octagon`.
 */
export function HudOctagon({ kind, state = "default", label, className }: Props) {
  return (
    <div
      className={cn("hud-octagon inline-flex flex-col items-center gap-2", className)}
      data-state={state}
    >
      <svg
        className="hud-octagon-svg"
        viewBox="0 0 120 120"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        <polygon className="hud-octagon-frame" points={OCTAGON_POINTS} />
        <g className="hud-octagon-art">{HUD_ART[kind]}</g>
      </svg>
      {label && <span className="hud-octagon-label">{label}</span>}
    </div>
  );
}

// Regular octagon, flat top — two horizontal + two vertical sides.
// 8 vertices at 22.5°, 67.5°, 112.5°, ...
const OCTAGON_POINTS = (() => {
  const cx = 60;
  const cy = 60;
  const r = 56;
  const points: string[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i + Math.PI / 8;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(" ");
})();

const HUD_ART: Record<HudOctagonKind, ReactNode> = {
  radar: (
    <>
      <circle cx="60" cy="60" r="14" strokeWidth="2" />
      <circle cx="60" cy="60" r="24" strokeWidth="2" />
      <circle cx="60" cy="60" r="34" strokeWidth="2" />
      <line x1="60" y1="60" x2="86" y2="34" strokeWidth="2.5" />
      <line x1="60" y1="60" x2="60" y2="26" strokeWidth="1" opacity="0.5" />
      <line x1="60" y1="60" x2="94" y2="60" strokeWidth="1" opacity="0.5" />
    </>
  ),
  sensor: (
    <>
      <path d="M30 60 Q60 36 90 60 Q60 84 30 60 Z" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="9" strokeWidth="2" />
      <circle cx="60" cy="60" r="3" fill="currentColor" stroke="none" />
      <path d="M28 30 L31 36 L37 36" strokeWidth="1.5" />
      <path d="M82 36 L85 30 L92 36" strokeWidth="1.5" />
    </>
  ),
  tower: (
    <>
      <line x1="60" y1="36" x2="60" y2="92" strokeWidth="2.5" />
      <path d="M44 92 L60 38 L76 92" strokeWidth="1.5" />
      <path d="M44 60 Q60 54 76 60" strokeWidth="1.5" />
      <path d="M48 70 Q60 66 72 70" strokeWidth="1.5" />
      <circle cx="60" cy="34" r="3" fill="currentColor" stroke="none" />
      <path d="M30 30 Q44 16 60 26 Q76 16 90 30" strokeWidth="1.5" opacity="0.7" />
    </>
  ),
  neural: (
    <>
      <circle cx="45" cy="45" r="4" fill="currentColor" stroke="none" />
      <circle cx="75" cy="45" r="4" fill="currentColor" stroke="none" />
      <circle cx="45" cy="75" r="4" fill="currentColor" stroke="none" />
      <circle cx="75" cy="75" r="4" fill="currentColor" stroke="none" />
      <circle cx="60" cy="60" r="6" fill="currentColor" stroke="none" />
      <line x1="45" y1="45" x2="60" y2="60" strokeWidth="1.5" />
      <line x1="75" y1="45" x2="60" y2="60" strokeWidth="1.5" />
      <line x1="45" y1="75" x2="60" y2="60" strokeWidth="1.5" />
      <line x1="75" y1="75" x2="60" y2="60" strokeWidth="1.5" />
      <line x1="45" y1="45" x2="75" y2="45" strokeWidth="1" opacity="0.45" />
      <line x1="45" y1="75" x2="75" y2="75" strokeWidth="1" opacity="0.45" />
    </>
  ),
  building: (
    <>
      <rect x="34" y="58" width="24" height="34" strokeWidth="2" />
      <rect x="58" y="44" width="30" height="48" strokeWidth="2" />
      <line x1="40" y1="66" x2="50" y2="66" strokeWidth="1.5" />
      <line x1="40" y1="76" x2="50" y2="76" strokeWidth="1.5" />
      <line x1="40" y1="86" x2="50" y2="86" strokeWidth="1.5" />
      <line x1="64" y1="54" x2="72" y2="54" strokeWidth="1.5" />
      <line x1="64" y1="66" x2="72" y2="66" strokeWidth="1.5" />
      <line x1="64" y1="78" x2="72" y2="78" strokeWidth="1.5" />
      <line x1="76" y1="54" x2="84" y2="54" strokeWidth="1.5" />
      <line x1="76" y1="66" x2="84" y2="66" strokeWidth="1.5" />
      <line x1="76" y1="78" x2="84" y2="78" strokeWidth="1.5" />
      <line x1="78" y1="44" x2="78" y2="38" strokeWidth="1.5" />
      <line x1="74" y1="38" x2="82" y2="38" strokeWidth="1.5" />
    </>
  ),
  satellite: (
    <>
      <circle cx="60" cy="60" r="18" strokeWidth="2" />
      <ellipse
        cx="60"
        cy="60"
        rx="34"
        ry="11"
        strokeWidth="1.5"
        transform="rotate(-25 60 60)"
      />
      <ellipse
        cx="60"
        cy="60"
        rx="34"
        ry="11"
        strokeWidth="1.5"
        transform="rotate(25 60 60)"
      />
      <circle cx="86" cy="42" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="34" cy="78" r="2" fill="currentColor" stroke="none" />
    </>
  ),
};
