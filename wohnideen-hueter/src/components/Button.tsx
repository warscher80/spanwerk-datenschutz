import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "dark" | "ghost" | "light";

const base =
  "inline-flex items-center justify-center gap-2 rounded-btn font-semibold text-[0.98rem] leading-none px-6 py-[0.95rem] " +
  "transition-[transform,background-color,color,box-shadow,border-color] duration-200 ease-[cubic-bezier(.22,.61,.36,1)] " +
  "hover:-translate-y-0.5 focus-visible:outline-2";

const variants: Record<Variant, string> = {
  primary:
    "bg-clay text-white shadow-[0_10px_24px_-12px_rgba(124,74,48,.8)] hover:bg-clay-dark",
  dark: "bg-ink text-white hover:bg-black",
  ghost: "border-[1.5px] border-line text-ink hover:border-clay hover:text-clay",
  light:
    "border-[1.5px] border-white/50 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25",
};

interface ButtonProps {
  href: string;
  children: ReactNode;
  variant?: Variant;
  icon?: IconName;
  iconRight?: IconName;
  className?: string;
  block?: boolean;
  "aria-label"?: string;
}

export function Button({
  href,
  children,
  variant = "primary",
  icon,
  iconRight,
  className,
  block = false,
  ...rest
}: ButtonProps) {
  const classes = cn(base, variants[variant], block && "w-full", className);
  const inner = (
    <>
      {icon && <Icon name={icon} size={1.05} />}
      <span>{children}</span>
      {iconRight && <Icon name={iconRight} size={1.05} />}
    </>
  );

  // Externe Links / tel:/mailto: als <a>, interne Routen via next/link.
  const isInternal = href.startsWith("/") && !href.startsWith("//");
  if (isInternal) {
    return (
      <Link href={href} className={classes} {...rest}>
        {inner}
      </Link>
    );
  }
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className={classes}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...rest}
    >
      {inner}
    </a>
  );
}

/** Textlink mit Pfeil. */
export function TextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const isInternal = href.startsWith("/");
  const cls = cn(
    "group inline-flex items-center gap-1.5 font-semibold text-clay border-b-[1.5px] border-transparent hover:border-clay transition-colors",
    className,
  );
  const inner = (
    <>
      <span>{children}</span>
      <Icon
        name="arrow"
        size={1}
        className="transition-transform duration-200 group-hover:translate-x-1"
      />
    </>
  );
  return isInternal ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <a href={href} className={cls}>
      {inner}
    </a>
  );
}
