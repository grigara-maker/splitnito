/**
 * Paleta e-mailů = hex převod z oklch proměnných v `globals.css`.
 * E-mailoví klienti oklch ani CSS proměnné neumí, proto pevné hodnoty.
 */
export const emailTheme = {
  pageBg: "#eaf4f6",
  brand: "#0b4f5a",
  brandDark: "#07333b",
  brandSoft: "#e2f1f3",
  card: "#ffffff",
  text: "#16323a",
  muted: "#5f7a80",
  border: "#d5e5e8",
  divider: "#eaf1f2",
  success: "#0e7c66",
  successSoft: "#e6f4f0",
  warning: "#8a5a12",
  warningSoft: "#fdf3e2",
  danger: "#b3401f",
  fontSans:
    "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontHeading: "Georgia, 'Times New Roman', serif",
  fontMono: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
} as const;
