import Link from "next/link";
import { site } from "@/lib/site";
import { Icon } from "./Icon";

/**
 * Dezente mobile Kontaktleiste mit genau zwei Aktionen: Anrufen & Termin
 * anfragen. Nur auf kleinen Screens sichtbar (Desktop nutzt Header-CTA).
 */
export function MobileCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-line bg-cream/95 px-3 py-2.5 backdrop-blur-md nav:hidden">
      <a
        href={site.phoneHref}
        className="flex flex-1 items-center justify-center gap-2 rounded-btn border-[1.5px] border-line bg-paper px-4 py-3 text-[0.95rem] font-semibold text-ink"
        aria-label={`Anrufen: ${site.phoneDisplay}`}
      >
        <Icon name="phone" /> Anrufen
      </a>
      <Link
        href="/kontakt"
        className="flex flex-[1.3] items-center justify-center gap-2 rounded-btn bg-clay px-4 py-3 text-[0.95rem] font-semibold text-white"
      >
        <Icon name="chat" /> Termin anfragen
      </Link>
    </div>
  );
}
