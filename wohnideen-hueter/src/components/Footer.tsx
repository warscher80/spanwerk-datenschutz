import Link from "next/link";
import { site, categories, legalNav } from "@/lib/site";
import { Icon } from "./Icon";

const companyNav = [
  { href: "/planung-service", label: "Planung & Service" },
  { href: "/projekte", label: "Projekte" },
  { href: "/marken", label: "Marken" },
  { href: "/ueber-uns", label: "Über uns" },
  { href: "/kontakt", label: "Kontakt & Termin" },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink text-[#b8b9bc]">
      <div className="mx-auto grid w-full max-w-[75rem] gap-10 px-5 pt-[clamp(3rem,6vw,5rem)] pb-10 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.3fr]">
        {/* Marke */}
        <div>
          <span
            className="mb-4 grid size-[42px] place-items-center rounded-[11px] bg-clay font-display text-[1.15rem] font-semibold text-white"
            aria-hidden="true"
          >
            WH
          </span>
          <p className="font-display text-[1.5rem] leading-tight text-white">
            {site.claim}
          </p>
          <p className="mt-2 max-w-[34ch] text-sm text-[#8a8c90]">
            Persönliche Einrichtungsplanung im oberen Drautal – von der ersten
            Idee bis zur fertigen Montage.
          </p>
          <a
            href={site.social.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block border-b border-[#33353a] pb-0.5 font-semibold text-white hover:border-gold"
          >
            Facebook
          </a>
        </div>

        {/* Sortiment */}
        <nav aria-label="Sortiment">
          <h2 className="mb-4 text-[0.78rem] font-semibold uppercase tracking-[0.15em] text-[#7e8085]">
            Sortiment
          </h2>
          <ul className="grid gap-2.5">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/${c.slug}`}
                  className="text-[0.95rem] text-[#b8b9bc] hover:text-white"
                >
                  {c.nav}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Unternehmen */}
        <nav aria-label="Unternehmen">
          <h2 className="mb-4 text-[0.78rem] font-semibold uppercase tracking-[0.15em] text-[#7e8085]">
            Unternehmen
          </h2>
          <ul className="grid gap-2.5">
            {companyNav.map((c) => (
              <li key={c.href}>
                <Link
                  href={c.href}
                  className="text-[0.95rem] text-[#b8b9bc] hover:text-white"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Kontakt */}
        <div>
          <h2 className="mb-4 text-[0.78rem] font-semibold uppercase tracking-[0.15em] text-[#7e8085]">
            Kontakt
          </h2>
          <address className="grid gap-3 text-[0.93rem] not-italic leading-relaxed">
            <p>
              <strong className="text-white">{site.legalName}</strong>
              <br />
              {site.address.street}
              <br />
              {site.address.zip} {site.address.city}, {site.address.region}
            </p>
            <p className="grid gap-1.5">
              <a
                href={site.phoneHref}
                className="inline-flex items-center gap-2 text-[#b8b9bc] hover:text-white"
              >
                <Icon name="phone" size={1} className="text-gold" />
                {site.phoneDisplay}
              </a>
              <a
                href={site.emailHref}
                className="inline-flex items-center gap-2 break-all text-[#b8b9bc] hover:text-white"
              >
                <Icon name="mail" size={1} className="text-gold" />
                {site.email}
              </a>
            </p>
            <p className="flex items-center gap-2 text-[0.88rem] text-[#8a8c90]">
              <Icon name="clock" size={1} className="text-gold" />
              {site.hours.note}
            </p>
          </address>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[75rem] flex-wrap items-center justify-between gap-4 border-t border-[#2a2c30] px-5 py-6 text-[0.85rem] text-[#7e8085] sm:px-8">
        <p>
          © {year} {site.legalName} · {site.legal.activity}
        </p>
        <ul className="flex flex-wrap gap-5">
          {legalNav.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="hover:text-white">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
