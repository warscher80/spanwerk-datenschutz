"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { site, mainNav, contactNav, legalNav } from "@/lib/site";
import { Icon } from "./Icon";

/** Routen ohne dunkles Hero-Bild – Header hier immer solide (kein Weiß auf Weiß). */
const SOLID_ROUTES = ["/impressum", "/datenschutz", "/barrierefreiheit"];

function Logo({ onDark }: { onDark: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5"
      aria-label={`${site.name} – Startseite`}
    >
      <span
        className={cn(
          "grid size-[42px] place-items-center rounded-[11px] font-display text-[1.15rem] font-semibold transition-colors",
          onDark ? "bg-white/15 text-white" : "bg-clay text-white",
        )}
        aria-hidden="true"
      >
        WH
      </span>
      <span className="flex flex-col leading-tight">
        <span
          className={cn(
            "font-display text-[1.4rem] font-semibold whitespace-nowrap transition-colors",
            onDark ? "text-white" : "text-ink",
          )}
        >
          Wohnideen Hueter
        </span>
        <span
          className={cn(
            "hidden text-[0.68rem] uppercase tracking-[0.08em] transition-colors min-[1400px]:block",
            onDark ? "text-white/80" : "text-ink-mute",
          )}
        >
          Einrichtung mit Persönlichkeit · Irschen
        </span>
      </span>
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  const overHero = !SOLID_ROUTES.includes(pathname);
  const onDark = overHero && !scrolled && !open;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Menü bei Routenwechsel schließen
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Body-Scroll sperren, wenn Menü offen
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow] duration-300",
        onDark
          ? "border-b border-transparent bg-transparent"
          : "border-b border-line bg-cream/90 backdrop-blur-md",
        scrolled && !onDark && "shadow-[0_6px_24px_-18px_rgba(60,44,28,.5)]",
      )}
    >
      <div className="mx-auto flex h-[78px] w-full max-w-[90rem] items-center gap-5 px-5 sm:px-8">
        <div className="mr-auto">
          <Logo onDark={onDark} />
        </div>

        {/* Desktop-Navigation */}
        <nav aria-label="Hauptnavigation" className="hidden nav:block">
          <ul className="flex items-center gap-0.5">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "rounded-full px-2.5 py-2 text-[0.9rem] font-medium whitespace-nowrap transition-colors",
                    onDark
                      ? "text-white/90 hover:bg-white/10 hover:text-white"
                      : "text-ink-soft hover:bg-clay/10 hover:text-ink",
                    isActive(item.href) && (onDark ? "text-white" : "text-clay"),
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={contactNav.href}
            className={cn(
              "hidden rounded-btn px-4 py-2.5 text-[0.9rem] font-semibold transition-colors nav:inline-flex",
              onDark
                ? "bg-white/15 text-white hover:bg-white/25"
                : "bg-clay text-white hover:bg-clay-dark",
            )}
          >
            Beratungstermin
          </Link>

          {/* Mobile-Toggle */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Menü schließen" : "Menü öffnen"}
            className={cn(
              "grid size-11 place-items-center rounded-[11px] transition-colors nav:hidden",
              onDark ? "text-white" : "text-ink",
            )}
          >
            <Icon name={open ? "close" : "menu"} size={1.4} />
          </button>
        </div>
      </div>

      {/* Mobile Off-Canvas */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            className="fixed inset-x-0 top-[78px] bottom-0 z-40 overflow-y-auto bg-cream px-5 pb-10 pt-6 nav:hidden"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <ul className="flex flex-col border-t border-line">
              {[...mainNav, contactNav].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "block border-b border-line py-4 font-display text-[1.55rem] transition-colors",
                      isActive(item.href) ? "text-clay" : "text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-8 grid gap-3">
              <Link
                href="/kontakt"
                className="inline-flex w-full items-center justify-center gap-2 rounded-btn bg-clay px-6 py-4 font-semibold text-white"
              >
                <Icon name="chat" /> Beratungstermin vereinbaren
              </Link>
              <a
                href={site.phoneHref}
                className="inline-flex w-full items-center justify-center gap-2 rounded-btn border-[1.5px] border-line px-6 py-4 font-semibold text-ink"
              >
                <Icon name="phone" /> {site.phoneDisplay}
              </a>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-mute">
              {legalNav.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-clay">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
