#!/usr/bin/env node
/**
 * Převede právní dokumenty z pravni/*.md (zdroj pravdy) na HTML řetězce
 * v lib/legal/documents.generated.ts. Stránky je pak renderují staticky,
 * bez čtení souborů za běhu. Spouštěj po každé změně textu: npm run legal
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const DOCS = [
  { slug: "podminky", file: "podminky-uzivani.md" },
  { slug: "ochrana-osobnich-udaju", file: "ochrana-osobnich-udaju.md" },
  { slug: "cookies", file: "cookies.md" },
  { slug: "zpracovatelska-smlouva", file: "zpracovatelska-smlouva.md" },
];

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function inline(text) {
  const codes = [];
  let t = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${escape(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  t = escape(t);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const external = /^https?:/.test(href);
    return `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
  });
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, "<em>$1</em>");
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

function splitRow(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

function convert(md) {
  const lines = md.replace(/<!--[\s\S]*?-->/g, "").split("\n");
  const out = [];
  const toc = [];
  let title = "";
  let meta = "";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 1) {
        title = text;
      } else {
        const id = slugify(text);
        if (level === 2) toc.push({ id, text });
        out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      }
      i++;
      continue;
    }

    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i]);
        i++;
      }
      const header = splitRow(rows[0]);
      const body = rows.slice(2).map(splitRow);
      const hasHeader = header.some(Boolean);
      out.push(
        `<div class="legal-table"><table>${
          hasHeader
            ? `<thead><tr>${header.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`
            : ""
        }<tbody>${body
          .map(
            (r) =>
              `<tr>${r
                .map((c, ci) =>
                  !hasHeader && ci === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`
                )
                .join("")}</tr>`
          )
          .join("")}</tbody></table></div>`
      );
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && /^([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^([-*]|\d+\.)\s+/, ""));
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</${tag}>`);
      continue;
    }

    if (line.startsWith(">")) {
      const parts = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        parts.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote><p>${inline(parts.join(" "))}</p></blockquote>`);
      continue;
    }

    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|\||>|[-*]\s|\d+\.\s)/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    const text = para.join(" ");
    if (!meta && /^\*\*Účinné od:\*\*/.test(text)) {
      meta = text;
      continue;
    }
    out.push(`<p>${inline(text)}</p>`);
  }

  const version = /\*\*Verze:\*\*\s*([^\s·]+)/.exec(meta)?.[1] ?? "";
  const effectiveFrom = /\*\*Účinné od:\*\*\s*([^·]+?)\s*·/.exec(meta)?.[1] ?? "";
  return { title, version, effectiveFrom, toc, html: out.join("\n") };
}

const docs = {};
for (const { slug, file } of DOCS) {
  docs[slug] = convert(readFileSync(join(root, "pravni", file), "utf8"));
}

const banner =
  "// Vygenerováno skriptem scripts/build-legal.mjs z pravni/*.md. Neupravuj ručně, spusť: npm run legal\n";
writeFileSync(
  join(root, "lib/legal/documents.generated.ts"),
  `${banner}\nexport const LEGAL_DOCUMENTS = ${JSON.stringify(docs, null, 2)} as const;\n\nexport type LegalSlug = keyof typeof LEGAL_DOCUMENTS;\n`
);
console.log(`Vygenerováno ${Object.keys(docs).length} dokumentů → lib/legal/documents.generated.ts`);
