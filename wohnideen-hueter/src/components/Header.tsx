"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { categories, site } from "@/lib/site";

const PRIMARY = [
  { n: "02", label: "Projekte", href: "/projekte" },
  { n: "03", label: "Planung", href: "/planung-service" },
  { n: "04", label: "Studio", href: "/ueber-uns" },
  { n: "05", label: "Kontakt", href: "/kontakt" },
];

/** Routen ohne dunkles Hero – Top-Bar dort von Anfang an solide. */
const SOLID_ROUTES = ["/impressum", "/datenschutz", "/barrierefreiheit"];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const overHero = !SOLID_ROUTES.includes(pathname);
  const onDark = overHero && !scrolled;
  const dark = onDark || open; // Top-Bar dunkel/transparent (Hero oder offenes Menü)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      } else if (e.key === "Tab") {
        const f = panelRef.current?.querySelectorAll<HTMLElement>("a,button");
        if (!f || f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("a,button")?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        dark ? "bg-transparent text-white" : "bg-cream/90 text-ink backdrop-blur-md",
        !dark && "border-b border-line",
      )}
    >
      <div className="mx-auto flex h-[68px] w-full max-w-[100rem] items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="group flex items-baseline gap-2" aria-label={`${site.name} – Startseite`}>
          <span className="font-display text-[1.15rem] font-bold uppercase leading-none tracking-[-0.02em]">
            Wohnideen&nbsp;Hueter
          </span>
          <span className="hidden font-mono text-[0.62rem] uppercase tracking-[0.2em] opacity-60 sm:inline">
            Irschen
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/kontakt"
            className={cn(
              "hidden items-center gap-2 px-4 py-2 font-mono text-[0.72rem] uppercase tracking-[0.14em] transition-colors sm:inline-flex",
              dark ? "text-white hover:text-gold" : "text-ink hover:text-clay",
            )}
          >
            <span className="size-1.5 bg-clay" aria-hidden />
            {site.phoneDisplay}
          </Link>
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="fs-nav"
            className={cn(
              "inline-flex items-center gap-2.5 px-3 py-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.16em] transition-colors",
              dark ? "text-white" : "text-ink",
            )}
          >
            {open ? "Schließen" : "Menü"}
            <span className="relative flex size-4 flex-col justify-center gap-[3px]">
              <span className={cn("h-[2px] w-full bg-current transition-transform", open && "translate-y-[5px] rotate-45")} />
              <span className={cn("h-[2px] w-full bg-current transition-opacity", open && "opacity-0")} />
              <span className={cn("h-[2px] w-full bg-current transition-transform", open && "-translate-y-[5px] -rotate-45")} />
            </span>
          </button>
        </div>
      </div>

      {/* Vollbild-Navigation */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="fs-nav"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Hauptnavigation"
            className="fixed inset-0 z-40 h-[100dvh] overflow-y-auto bg-ink text-white"
            initial={reduce ? { opacity: 0 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <div className="mx-auto w-full max-w-[100rem] px-5 pb-14 pt-[92px] sm:px-8">
              <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
                {/* Primäre Navigation */}
                <nav aria-label="Seiten">
                  <p className="mb-6 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-white/40">
                    Navigation
                  </p>
                  <ul>
                    {PRIMARY.map((item) => (
                      <li key={item.href} className="border-t border-line-dark">
                        <Link
                          href={item.href}
                          className="group flex items-baseline gap-4 py-3.5 sm:py-4"
                        >
                          <span className="font-mono text-[0.8rem] text-white/40">{item.n}</span>
                          <span
                            className={cn(
                              "font-display text-[clamp(2.4rem,9vw,5rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] transition-colors",
                              active(item.href) ? "text-clay" : "text-white group-hover:text-clay",
                            )}
                          >
                            {item.label}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>

                {/* Räume + Kontakt */}
                <div className="flex flex-col justify-between gap-10">
                  <nav aria-label="Räume">
                    <p className="mb-4 flex items-center gap-2 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-white/40">
                      <span className="size-1.5 bg-clay" aria-hidden />
                      01 — Räume
                    </p>
                    <ul className="grid grid-cols-2 gap-x-6">
                      {categories.map((c) => (
                        <li key={c.slug} className="border-t border-line-dark">
                          <Link
                            href={`/${c.slug}`}
                            className={cn(
                              "block py-3 font-display text-[1.35rem] font-medium transition-colors sm:text-[1.6rem]",
                              active(`/${c.slug}`) ? "text-clay" : "text-white hover:text-clay",
                            )}
                          >
                            {c.nav}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </nav>

                  <div className="border-t border-line-dark pt-6 font-mono text-[0.8rem] leading-relaxed text-white/70">
                    <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-white/40">Studio</p>
                    <p className="not-italic">
                      {site.address.street}, {site.address.zip} {site.address.city}
                    </p>
                    <p className="mt-2">
                      <a href={site.phoneHref} className="hover:text-clay">{site.phoneDisplay}</a>
                    </p>
                    <p>
                      <a href={site.emailHref} className="break-all hover:text-clay">{site.email}</a>
                    </p>
                    <p className="mt-2 text-white/45">{site.hours.note}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
