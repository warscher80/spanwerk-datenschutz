"use client";

import Image from "next/image";
import { asset } from "@/lib/asset";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectImage } from "@/lib/site";
import { Icon } from "@/components/Icon";

/**
 * Barrierearme Bildergalerie mit optionaler Lightbox.
 * - vollständig per Tastatur bedienbar (Enter/Space öffnet, Esc schließt,
 *   Pfeiltasten blättern)
 * - Fokus wird beim Öffnen in den Dialog und beim Schließen zurück gesetzt
 * - unterstützt Bildunterschriften
 * - keine externe Galerie-Bibliothek
 */
export function ProjectGallery({ images }: { images: ProjectImage[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    const i = open;
    setOpen(null);
    // Fokus auf das auslösende Thumbnail zurücksetzen
    if (i != null) requestAnimationFrame(() => triggerRefs.current[i]?.focus());
  }, [open]);

  const go = useCallback(
    (dir: number) => {
      setOpen((cur) => {
        if (cur == null) return cur;
        return (cur + dir + images.length) % images.length;
      });
    },
    [images.length],
  );

  useEffect(() => {
    if (open == null) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Tab") {
        // Fokus im Dialog halten (einfache Fokusfalle)
        const f = dialogRef.current?.querySelectorAll<HTMLElement>("button");
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
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, go]);

  if (!images.length) return null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
        {images.map((img, i) => (
          <li key={img.src} className={i === 0 ? "col-span-2 sm:col-span-2" : ""}>
            <button
              ref={(el) => {
                triggerRefs.current[i] = el;
              }}
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Bild vergrößern: ${img.alt}`}
              className="group relative block aspect-[3/2] w-full overflow-hidden rounded-panel bg-taupe shadow-soft"
            >
              <Image
                src={asset(img.src)}
                alt={img.alt}
                fill
                sizes="(max-width:640px) 100vw, 33vw"
                className="object-cover transition-transform duration-700 ease-[cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              <span className="absolute bottom-2 right-2 grid size-8 place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Icon name="arrow" size={0.9} />
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open != null && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Bildergalerie, Bild ${open + 1} von ${images.length}`}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink/95 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Galerie schließen"
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <Icon name="close" size={1.4} />
          </button>

          <div className="relative flex w-full max-w-[64rem] flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Vorheriges Bild"
              className="absolute left-0 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:-left-2"
            >
              <span className="rotate-180">
                <Icon name="arrow" size={1.3} />
              </span>
            </button>

            <figure className="mx-14 flex max-h-[80vh] flex-col items-center">
              <div className="relative h-[70vh] w-full max-w-[60rem]">
                <Image
                  src={asset(images[open].src)}
                  alt={images[open].alt}
                  fill
                  sizes="90vw"
                  className="object-contain"
                />
              </div>
              {images[open].caption && (
                <figcaption className="mt-3 text-center text-[0.9rem] text-white/80">
                  {images[open].caption}
                </figcaption>
              )}
            </figure>

            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Nächstes Bild"
              className="absolute right-0 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:-right-2"
            >
              <Icon name="arrow" size={1.3} />
            </button>
          </div>

          <p className="mt-2 text-[0.82rem] text-white/60" aria-hidden>
            {open + 1} / {images.length}
          </p>
        </div>
      )}
    </>
  );
}
