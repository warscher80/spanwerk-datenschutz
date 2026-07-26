"use client";

import { useState } from "react";
import { Icon } from "./Icon";

interface MapConsentProps {
  src: string;
  title: string;
}

/**
 * DSGVO-konforme Zwei-Klick-Karte: Die Verbindung zu OpenStreetMap wird erst
 * nach ausdrücklicher Zustimmung aufgebaut (keine IP-Übertragung vorher).
 */
export function MapConsent({ src, title }: MapConsentProps) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <iframe
        title={title}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-[340px] w-full rounded-panel border-0 [filter:grayscale(.15)_contrast(.98)]"
      />
    );
  }

  return (
    <div className="grid min-h-[340px] place-items-center rounded-panel border-[1.5px] border-dashed border-line bg-sand p-6 text-center">
      <div className="grid max-w-[360px] justify-items-center gap-4">
        <p className="flex items-start gap-2 text-[0.92rem] text-ink-soft">
          <Icon name="pin" className="mt-0.5 text-clay" />
          Die Karte wird erst geladen, wenn Sie zustimmen. Dabei wird eine
          Verbindung zu OpenStreetMap aufgebaut.
        </p>
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="inline-flex items-center gap-2 rounded-btn border-[1.5px] border-line px-6 py-3 font-semibold text-ink transition-colors hover:border-clay hover:text-clay"
        >
          Karte laden
        </button>
      </div>
    </div>
  );
}
