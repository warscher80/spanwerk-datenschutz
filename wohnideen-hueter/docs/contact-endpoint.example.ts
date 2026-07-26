/**
 * =============================================================================
 *  BEISPIEL: Serverseitige Kontakt-Schnittstelle  (NICHT Teil des statischen Builds)
 * =============================================================================
 *
 *  Diese Datei ist eine einsatzbereite Vorlage für einen echten E-Mail-Versand.
 *  Sie liegt bewusst unter `docs/`, damit sie den statischen Export
 *  (`output: "export"`) nicht bricht. Zum Aktivieren:
 *
 *  1. Auf einem Node-fähigen Host deployen (nicht auf reinem Static-Hosting):
 *     - Datei nach `src/app/api/kontakt/route.ts` verschieben
 *     - in `next.config.ts` `output: "export"` entfernen (Server-/Hybrid-Betrieb)
 *  2. `npm i nodemailer` und `npm i -D @types/nodemailer`
 *  3. Umgebungsvariablen setzen (NIE im Frontend, keine Secrets committen):
 *
 *       SMTP_HOST=...
 *       SMTP_PORT=587
 *       SMTP_USER=...
 *       SMTP_PASS=...                 # nur serverseitig!
 *       CONTACT_TO=office@wohnideen-hueter.at
 *       CONTACT_FROM="Website <noreply@wohnideen-hueter.at>"
 *
 *  4. Im Frontend die öffentliche URL setzen (nur die URL, kein Secret):
 *
 *       NEXT_PUBLIC_CONTACT_ENDPOINT=/api/kontakt
 *
 *  Alternativ statt eigenem SMTP ein datenschutzkonformer Formular-/Mailservice
 *  mit EU-Serverstandort und Auftragsverarbeitungsvertrag.
 *
 *  Der Handler validiert serverseitig, prüft den Honeypot und antwortet nur bei
 *  erfolgreichem Versand mit HTTP 200 – das Frontend zeigt nur dann Erfolg.
 * =============================================================================
 */

// import { NextRequest, NextResponse } from "next/server";
// import nodemailer from "nodemailer";

// export const runtime = "nodejs";

// interface ContactPayload {
//   name?: string;
//   email?: string;
//   telefon?: string;
//   bereich?: string;
//   tag?: string;
//   zeit?: string;
//   kontaktart?: string;
//   nachricht?: string;
//   website?: string; // Honeypot
// }

// function isEmail(v: string) {
//   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
// }

// export async function POST(req: NextRequest) {
//   let body: ContactPayload;
//   try {
//     body = await req.json();
//   } catch {
//     return NextResponse.json({ error: "invalid_json" }, { status: 400 });
//   }

//   // Honeypot: still mit 200 quittieren, aber nichts senden.
//   if (body.website) return NextResponse.json({ ok: true });

//   const name = (body.name ?? "").trim();
//   const email = (body.email ?? "").trim();
//   const nachricht = (body.nachricht ?? "").trim();
//   if (!name || !isEmail(email) || !nachricht) {
//     return NextResponse.json({ error: "validation" }, { status: 422 });
//   }

//   const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST,
//     port: Number(process.env.SMTP_PORT ?? 587),
//     secure: Number(process.env.SMTP_PORT) === 465,
//     auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
//   });

//   const text = [
//     "Neue Terminanfrage über wohnideen-hueter.at",
//     "-------------------------------------------",
//     `Name: ${name}`,
//     `E-Mail: ${email}`,
//     `Telefon: ${body.telefon || "—"}`,
//     `Bereich: ${body.bereich || "—"}`,
//     `Bevorzugter Tag: ${body.tag || "—"}`,
//     `Bevorzugtes Zeitfenster: ${body.zeit || "—"}`,
//     `Bevorzugter Kontakt: ${body.kontaktart || "egal"}`,
//     "",
//     "Nachricht:",
//     nachricht,
//   ].join("\n");

//   try {
//     await transporter.sendMail({
//       to: process.env.CONTACT_TO,
//       from: process.env.CONTACT_FROM,
//       replyTo: email,
//       subject: `Terminanfrage: ${body.bereich || "Beratung"} – ${name}`,
//       text,
//     });
//   } catch {
//     return NextResponse.json({ error: "send_failed" }, { status: 502 });
//   }

//   return NextResponse.json({ ok: true });
// }

export {};
