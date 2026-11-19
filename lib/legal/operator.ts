/** Identifikace provozovatele – musí sedět s pravni/*.md (zdroj: ARES 23007966). */
export const OPERATOR = {
  name: "Adam Grigar",
  ico: "23007966",
  address: "Tyršova 843, 357 35 Chodov",
  register: "zapsán v živnostenském rejstříku",
  email: "grigar.adam@gmail.com",
} as const;

/**
 * Verze podmínek, se kterou uživatel souhlasí při registraci.
 * Při změně textu pravni/podminky-uzivani.md zvyš verzi a oznam změnu e-mailem
 * 30 dní předem (čl. 10 podmínek).
 */
export const TERMS_VERSION = "1.0";

export const LEGAL_LINKS = [
  { href: "/podminky", label: "Podmínky užívání" },
  { href: "/ochrana-osobnich-udaju", label: "Ochrana osobních údajů" },
  { href: "/cookies", label: "Cookies" },
  { href: "/zpracovatelska-smlouva", label: "Zpracovatelská smlouva" },
] as const;
