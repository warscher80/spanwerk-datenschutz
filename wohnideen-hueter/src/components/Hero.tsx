import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow } from "./SectionHeader";
import { Reveal } from "./Reveal";

interface PageHeroProps {
  image: string;
  alt: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  /** Breadcrumb-Zusatz nach „Startseite ·“ (Text oder verschachtelte Links) */
  crumb?: ReactNode;
}

/** Sekundär-Hero für Unterseiten. */
export function PageHero({ image, alt, eyebrow, title, lead, crumb }: PageHeroProps) {
  return (
    <section className="relative flex min-h-[clamp(340px,46vh,520px)] items-end overflow-hidden pt-[78px] text-white">
      <div className="absolute inset-0 -z-10">
        <Image
          src={image}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg,rgba(30,22,16,.45),rgba(30,22,16,.72))",
          }}
        />
      </div>
      <div className="mx-auto w-full max-w-[75rem] px-5 py-[clamp(2rem,5vw,3.6rem)] sm:px-8 lg:px-10">
        {crumb && (
          <Reveal>
            <p className="text-[0.85rem] text-white/80">
              <Link href="/" className="hover:text-white hover:underline">
                Startseite
              </Link>{" "}
              · {crumb}
            </p>
          </Reveal>
        )}
        {eyebrow && (
          <Reveal delay={0.06}>
            <Eyebrow light className="mt-2">
              {eyebrow}
            </Eyebrow>
          </Reveal>
        )}
        <Reveal delay={0.08}>
          <h1 className="text-h1 mt-3 mb-3 text-white">{title}</h1>
        </Reveal>
        {lead && (
          <Reveal delay={0.16}>
            <p className="text-lead max-w-[40rem] text-white/90">{lead}</p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
