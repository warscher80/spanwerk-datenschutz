import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "dark" | "ghost" | "light";

const base =
  "group/btn inline-flex items-center justify-center gap-2.5 rounded-btn font-semibold text-[0.95rem] leading-none tracking-[0.01em] px-7 py-[1.05rem] " +
  "transition-[background-color,color,border-color] duration-200 ease-[cubic-bezier(.22,.61,.36,1)] focus-visible:outline-2";

const variants: Record<Variant, string> = {
  primary: "bg-clay text-white hover:bg-clay-dark",
  dark: "bg-ink text-white hover:bg-clay",
  ghost: "border border-ink text-ink hover:bg-ink hover:text-white",
  light: "border border-white/40 text-white hover:bg-white hover:text-ink",
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
