"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import {
  contactAreas,
  preferredDays,
  preferredTimes,
  site,
} from "@/lib/site";
import { Icon } from "./Icon";

/**
 * Kontakt-/Terminanfrageformular.
 *
 * Übermittlung:
 *  - Ist `NEXT_PUBLIC_CONTACT_ENDPOINT` gesetzt, wird die Anfrage per POST an
 *    diese serverseitige Schnittstelle geschickt. Eine Erfolgsmeldung erscheint
 *    NUR bei einer echten 200-Antwort (keine Schein-Übermittlung).
 *  - Ohne Endpoint (z. B. statisches Hosting/Entwicklung) öffnet sich als
 *    ehrlicher Rückfall das E-Mail-Programm mit vorbereiteter Nachricht. Es wird
 *    KEINE „gesendet“-Meldung angezeigt – der Text weist klar darauf hin, dass
 *    die Nachricht erst nach dem Absenden im Mailprogramm bei uns ankommt.
 *
 * Der serverseitige Handler liegt als Vorlage in `docs/contact-endpoint.example.ts`.
 * Keine Secrets im Frontend – nur die öffentliche Endpoint-URL.
 */
const ENDPOINT = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;

const inputCls =
  "w-full rounded-[11px] border-[1.5px] border-line bg-cream px-3.5 py-3 text-ink transition-[border-color,box-shadow] focus:border-clay focus:shadow-[0_0_0_3px_rgba(156,107,78,.15)] focus:outline-none aria-[invalid=true]:border-[#b4552f]";

type Status =
  | { type: "success"; msg: string }
  | { type: "info"; msg: string }
  | { type: "error"; msg: string }
  | null;

export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;

    // Honeypot: von Menschen unsichtbar; ausgefüllt = Bot → still abbrechen.
    if ((form.elements.namedItem("website") as HTMLInputElement)?.value) {
      setStatus({ type: "success", msg: "Danke für Ihre Anfrage." });
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const val = (k: string) => String(data.get(k) ?? "").trim();
    const name = val("name");

    const payload = {
      name,
      email: val("email"),
      telefon: val("telefon"),
      bereich: val("bereich"),
      tag: val("tag"),
      zeit: val("zeit"),
      kontaktart: val("kontaktart"),
      nachricht: val("nachricht"),
    };

    // 1) Echte serverseitige Übermittlung, wenn konfiguriert
    if (ENDPOINT) {
      setBusy(true);
      setStatus(null);
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        setStatus({
          type: "success",
          msg: `Vielen Dank, ${name.split(" ")[0] || "für Ihre Anfrage"}! Ihre Terminanfrage ist bei uns eingegangen. Wir melden uns persönlich, um einen Termin zu bestätigen.`,
        });
      } catch {
        setStatus({
          type: "error",
          msg: `Das hat leider nicht funktioniert. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns direkt: ${site.email} bzw. ${site.phoneDisplay}.`,
        });
      } finally {
        setBusy(false);
      }
      return;
    }

    // 2) Ehrlicher Rückfall ohne Backend: E-Mail-Programm öffnen (keine „gesendet“-Meldung)
    const body = [
      "Terminanfrage über wohnideen-hueter.at",
      "--------------------------------------",
      `Name: ${payload.name}`,
      `E-Mail: ${payload.email}`,
      `Telefon: ${payload.telefon || "—"}`,
      `Bereich: ${payload.bereich || "—"}`,
      `Bevorzugter Tag: ${payload.tag || "—"}`,
      `Bevorzugtes Zeitfenster: ${payload.zeit || "—"}`,
      `Bevorzugter Kontakt: ${payload.kontaktart || "egal"}`,
      "",
      "Nachricht:",
      payload.nachricht,
    ].join("\n");
    const href = `mailto:${site.email}?subject=${encodeURIComponent(
      `Terminanfrage: ${payload.bereich || "Beratung"} – ${name}`,
    )}&body=${encodeURIComponent(body)}`;
    setStatus({
      type: "info",
      msg: `Ihr E-Mail-Programm wurde mit der vorbereiteten Nachricht geöffnet. Bitte senden Sie diese ab – erst dann erreicht uns Ihre Anfrage. Alternativ: ${site.email} oder ${site.phoneDisplay}.`,
    });
    window.location.href = href;
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      aria-describedby="form-hint"
      className="rounded-panel border border-line bg-paper p-[clamp(1.6rem,3.5vw,2.6rem)] shadow-soft"
    >
      {/* Honeypot (visuell & für Screenreader ausgeblendet) */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden" tabIndex={-1}>
        <label htmlFor="website">Bitte nicht ausfüllen</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-[0.9rem] font-semibold">
            Vor- und Nachname <span className="text-clay">*</span>
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
            Gewünschter Bereich
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

      {/* Terminwunsch (Anfrage, keine Echtzeitbuchung) */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="tag" className="mb-1.5 block text-[0.9rem] font-semibold">
            Bevorzugter Tag <span className="font-normal text-ink-mute">(optional)</span>
          </label>
          <select id="tag" name="tag" defaultValue="" className={inputCls}>
            <option value="">Keine Angabe</option>
            {preferredDays.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="zeit" className="mb-1.5 block text-[0.9rem] font-semibold">
            Bevorzugtes Zeitfenster <span className="font-normal text-ink-mute">(optional)</span>
          </label>
          <select id="zeit" name="zeit" defaultValue="" className={inputCls}>
            <option value="">Keine Angabe</option>
            {preferredTimes.map((t) => (
              <option key={t} value={t}>
                {t}
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
          Bevorzugte Kontaktaufnahme
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
          <input type="checkbox" name="datenschutz" required className="mt-0.5 size-5 flex-none accent-clay" />
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
        disabled={busy}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-btn bg-clay px-6 py-4 font-semibold text-white transition-colors hover:bg-clay-dark disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Icon name="mail" /> {busy ? "Wird gesendet …" : "Terminanfrage senden"}
      </button>

      <p id="form-hint" className="mt-4 text-[0.82rem] text-ink-mute">
        Es handelt sich um eine <strong className="text-ink-soft">Terminanfrage</strong> –
        wir melden uns persönlich, um einen Termin zu bestätigen. Es werden keine
        Daten an Dritte weitergegeben und kein Tracking eingesetzt.
      </p>

      {status && (
        <p
          role="status"
          aria-live="polite"
          className={
            "mt-4 rounded-[11px] border px-4 py-3 text-[0.95rem] font-medium " +
            (status.type === "success"
              ? "border-[#c6d9b6] bg-[#e8efe2] text-[#3d5a2c]"
              : status.type === "error"
                ? "border-[#e6c3b6] bg-[#f6e5df] text-[#8a3b28]"
                : "border-line bg-cream text-ink-soft")
          }
        >
          {status.msg}
        </p>
      )}
    </form>
  );
}
