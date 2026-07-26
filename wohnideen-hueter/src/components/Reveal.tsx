"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const EASE = [0.22, 0.61, 0.36, 1] as const;

type RevealTag = "div" | "section" | "li" | "article" | "span" | "figure";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Verzögerung in Sekunden (für gestaffelte Gruppen). */
  delay?: number;
  /** Vertikaler Versatz beim Einblenden. */
  y?: number;
  as?: RevealTag;
}

/**
 * Sanftes Fade-up beim Scrollen in den Viewport (einmalig).
 *
 * Wichtig: `initial` ist auf Server und Client identisch (kein Hydration-
 * Mismatch). Bei prefers-reduced-motion wird ohne Bewegung sofort eingeblendet.
 * Ohne JS bleibt der Inhalt sichtbar (CSS-Fallback `.no-js [data-reveal]`).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 26,
  as = "div",
}: RevealProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];

  return (
    <MotionTag
      data-reveal
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: 0.7, ease: EASE, delay }
      }
    >
      {children}
    </MotionTag>
  );
}
