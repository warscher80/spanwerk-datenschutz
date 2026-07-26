import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Reveal } from "./Reveal";

export function Eyebrow({
  children,
  center = false,
  light = false,
  className,
}: {
  children: ReactNode;
  center?: boolean;
  light?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "eyebrow",
        center && "eyebrow--center",
        light && "eyebrow--light",
        className,
      )}
    >
      {children}
    </span>
  );
}

interface SectionHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  center?: boolean;
  light?: boolean;
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  lead,
  center = false,
  light = false,
  className,
}: SectionHeaderProps) {
  return (
    <Reveal
      className={cn(
        "max-w-[45rem]",
        center && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow && (
        <Eyebrow center={center} light={light}>
          {eyebrow}
        </Eyebrow>
      )}
      <h2
        className={cn(
          "text-h2 mt-4 mb-4",
          light ? "text-white" : "text-ink",
        )}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={cn(
            "text-lead",
            light ? "text-[#e7e7e4]/80" : "text-ink-soft",
          )}
        >
          {lead}
        </p>
      )}
    </Reveal>
  );
}
