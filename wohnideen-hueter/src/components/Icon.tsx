import type { SVGProps } from "react";

export type IconName =
  | "chat"
  | "ruler"
  | "truck"
  | "heart"
  | "phone"
  | "mail"
  | "pin"
  | "clock"
  | "arrow"
  | "check"
  | "menu"
  | "close";

const PATHS: Record<IconName, string> = {
  chat: "M4 5h16v11H8l-4 4z",
  ruler: "M3 8l13-5 5 13-13 5z M8 8l1 2 M11 7l1 2 M14 6l1 2",
  truck: "M2 7h11v9H2z M13 10h4l3 3v3h-7z",
  heart:
    "M12 20s-7-4.6-9.2-8.4C1.1 8.3 2.8 5 6 5c2 0 3.2 1.2 4 2.3C10.8 6.2 12 5 14 5c3.2 0 4.9 3.3 3.2 6.6C19 15.4 12 20 12 20z",
  phone:
    "M5 3h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A17 17 0 013 5a2 2 0 012-2z",
  mail: "M3 6h18v12H3z M3 7l9 6 9-6",
  pin: "M12 22s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12z M12 10a2.4 2.4 0 100-.01",
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18z M12 7v5l3 2",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  check: "M20 6L9 17l-5-5",
  menu: "M4 7h16 M4 12h16 M4 17h16",
  close: "M6 6l12 12 M18 6L6 18",
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  /** Größe in em relativ zur Schrift; Standard 1.1em */
  size?: number;
}

export function Icon({ name, size = 1.1, className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={`${size}em`}
      height={`${size}em`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{ flex: "none" }}
      {...rest}
    >
      {PATHS[name].split(" M").map((seg, i) => (
        <path key={i} d={(i === 0 ? seg : "M" + seg).trim()} />
      ))}
    </svg>
  );
}
