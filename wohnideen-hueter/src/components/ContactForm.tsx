"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { site, contactAreas } from "@/lib/site";
import { Icon } from "./Icon";

const inputCls =
  "w-full rounded-[11px] border-[1.5px] border-line bg-cream px-3.5 py-3 text-ink transition-[border-color,box-shadow] focus:border-clay focus:shadow-[0_0_0_3px_rgba(156,107,78,.15)] focus:outline-none";

/**
 * Kontaktformular ohne Backend/Tracking: validiert clientseitig und öffnet eine
 * vorbereitete E-Mail an das Büro (DSGVO-freundlich, keine Drittdienste).
 * TODO (Betreiber): Bei Bedarf ein datenschutzkonformes Formular-Endpoint
 * anbinden (z. B. eigener Mailservice).
 */
export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<{ type: "ok"; msg: string } | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const data = new FormData(form);
    const val = (k: string) => String(data.get(k) ?? "").trim();
    const name = val("name");
    const bereich = val("bereich");

    const body = [
      "Anfrage über wohnideen-hueter.at",
      "--------------------------------",
      `Name: ${name}`,
      `E-Mail: ${val("email")}`,
      `Telefon: ${val("telefon") || "—"}`,
      `Bereich: ${bereich || "—"}`,
      `Bevorzugter Kontakt: ${val("kontaktart") || "egal"}`,
      "",
      "Nachricht:",
      val("nachricht"),
    ].join("\n");

    const subject = `Beratungsanfrage: ${bereich || "Einrichtung"} – ${name}`;
    const href = `mailto:${site.email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;

    setStatus({
      type: "ok",
      msg: `Danke, ${
        name.split(" ")[0] || "für Ihre Anfrage"
      }! Ihr E-Mail-Programm öffnet sich mit der vorbereiteten Nachricht. Sollte sich nichts öffnen, erreichen Sie uns direkt unter ${
        site.email
      } oder telefonisch.`,
    });
    window.location.href = href;
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="rounded-panel border border-line bg-paper p-[clamp(1.6rem,3.5vw,2.6rem)] shadow-soft"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-[0.9rem] font-semibold">
            Name <span className="text-clay">*</span>
          </label>
          <input id="name" name="name" type="text" autoComplete="name" required className={inputCls} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-[0.9rem] font-semibold">
            E-Mail <span className="text-clay">*</span>
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputCls} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="telefon" className="mb-1.5 block text-[0.9rem] font-semibold">
            Telefon <span className="font-normal text-ink-mute">(optional)</span>
          </label>
          <input id="telefon" name="telefon" type="tel" autoComplete="tel" className={inputCls} />
        </div>
        <div>
          <label htmlFor="bereich" className="mb-1.5 block text-[0.9rem] font-semibold">
            Einrichtungsbereich
          </label>
          <select id="bereich" name="bereich" defaultValue="" className={inputCls}>
            <option value="">Bitte wählen …</option>
            {contactAreas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="nachricht" className="mb-1.5 block text-[0.9rem] font-semibold">
          Ihre Nachricht <span className="text-clay">*</span>
        </label>
        <textarea
          id="nachricht"
          name="nachricht"
          required
          rows={5}
          placeholder="Erzählen Sie uns kurz von Ihrem Vorhaben …"
          className={`${inputCls} min-h-[140px] resize-y`}
        />
      </div>

      <fieldset className="mt-5">
        <legend className="mb-2 block text-[0.9rem] font-semibold">
          Bevorzugte Kontaktart
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {["Telefon", "E-Mail", "Egal"].map((opt, i) => (
            <label key={opt} className="inline-flex items-center gap-2 text-[0.92rem] font-medium">
              <input
                type="radio"
                name="kontaktart"
                value={opt}
                defaultChecked={i === 0}
                className="size-[18px] accent-clay"
              />
              {opt}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5">
        <label className="flex items-start gap-3 text-[0.9rem] text-ink-soft">
          <input
            type="checkbox"
            name="datenschutz"
            required
            className="mt-0.5 size-5 flex-none accent-clay"
          />
          <span>
            Ich habe die{" "}
            <Link href="/datenschutz" className="text-clay underline">
              Datenschutzerklärung
            </Link>{" "}
            gelesen und bin einverstanden, dass meine Angaben zur Bearbeitung
            meiner Anfrage verwendet werden. <span className="text-clay">*</span>
          </span>
        </label>
      </div>

      <button
        type="submit"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-btn bg-clay px-6 py-4 font-semibold text-white transition-colors hover:bg-clay-dark"
      >
        <Icon name="mail" /> Anfrage senden
      </button>

      <p className="mt-4 text-[0.82rem] text-ink-mute">
        Ihre Anfrage wird über Ihr E-Mail-Programm an {site.email} übermittelt.
        Es werden keine Daten an Dritte weitergegeben und kein Tracking
        eingesetzt.
      </p>

      {status && (
        <p
          role="status"
          className="mt-4 rounded-[11px] border border-[#c6d9b6] bg-[#e8efe2] px-4 py-3 text-[0.95rem] font-medium text-[#3d5a2c]"
        >
          {status.msg}
        </p>
      )}
    </form>
  );
}
