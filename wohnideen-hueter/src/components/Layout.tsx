import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Zentrierter Inhaltscontainer mit konsistenten Seitenabständen. */
export function Container({
  children,
  className,
  narrow = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
  as?: ElementType;
}) {
  return (
    <Tag
      className={cn(
        "mx-auto w-full px-5 sm:px-8 lg:px-10",
        narrow ? "max-w-[52rem]" : "max-w-[75rem]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

type Tone = "cream" | "sand" | "ink" | "paper";
const toneClass: Record<Tone, string> = {
  cream: "bg-cream text-ink",
  sand: "bg-sand text-ink",
  paper: "bg-paper text-ink",
  ink: "bg-ink text-[#e7e7e4]",
};

/** Abschnitt mit konsistentem vertikalem Rhythmus. */
export function Section({
  children,
  className,
  tone = "cream",
  id,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
  id?: string;
  as?: ElementType;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "py-[clamp(3.5rem,8vw,7rem)]",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
