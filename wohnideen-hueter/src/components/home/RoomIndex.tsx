"use client";

import Image from "next/image";
import { asset } from "@/lib/asset";
import Link from "next/link";
import { useState } from "react";
import { categories } from "@/lib/site";
import { Icon } from "@/components/Icon";

/**
 * Wohnwelten als textbasierte Navigation mit wechselnder Bildvorschau (Desktop).
 * Auf kleinen Screens klare vertikale Liste mit eigenem Bild je Raum.
 */
export function RoomIndex() {
  const [active, setActive] = useState(0);
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:gap-16">
      <ul className="border-b border-line">
        {categories.map((c, i) => (
          <li key={c.slug} className="border-t border-line">
            <Link
              href={`/${c.slug}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              className="group flex items-center justify-between gap-4 py-5 sm:py-6"
            >
              <div className="flex items-baseline gap-4 sm:gap-6">
                <span className="font-mono text-[0.8rem] text-ink-mute">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-[clamp(1.9rem,6vw,3.4rem)] font-bold uppercase leading-none tracking-[-0.02em] text-ink transition-colors group-hover:text-clay">
                  {c.title}
                </span>
              </div>
              <Icon
                name="arrow"
                size={1.15}
                className="shrink-0 text-ink-mute transition-transform duration-200 group-hover:translate-x-1 group-hover:text-clay"
              />
            </Link>
            {/* Mobile-Bild je Raum */}
            <Link
              href={`/${c.slug}`}
              className="mb-6 block lg:hidden"
              tabIndex={-1}
              aria-hidden
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-taupe">
                <Image
                  src={asset(`/images/cat-${c.slug}.jpg`)}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover"
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop-Bildvorschau */}
      <div className="hidden lg:block">
        <div className="sticky top-24">
          <div className="relative aspect-[4/5] overflow-hidden bg-taupe">
            <Image
              key={active}
              src={asset(`/images/cat-${categories[active].slug}.jpg`)}
              alt={`${categories[active].title} bei Wohnideen Hueter`}
              fill
              sizes="40vw"
              className="object-cover"
            />
          </div>
          <p className="mt-3 flex items-center justify-between font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-mute">
            <span>
              {String(active + 1).padStart(2, "0")} — {categories[active].title}
            </span>
            <span className="max-w-[16rem] truncate text-right normal-case tracking-normal">
              {categories[active].kicker}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
