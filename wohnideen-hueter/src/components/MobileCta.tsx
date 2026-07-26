import Link from "next/link";
import { Icon } from "./Icon";

/** Schwebender Kontakt-Button auf kleinen Screens (immer erreichbar). */
export function MobileCta() {
  return (
    <Link
      href="/kontakt"
      aria-label="Beratungstermin vereinbaren"
      className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-btn bg-clay px-5 py-3.5 font-semibold text-white shadow-[0_14px_30px_-10px_rgba(124,74,48,.7)] transition-colors hover:bg-clay-dark nav:hidden"
    >
      <Icon name="chat" /> <span>Beratungstermin</span>
    </Link>
  );
}
