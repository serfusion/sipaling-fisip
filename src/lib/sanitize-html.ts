// Pembersih HTML berbasis DOM dengan pola ALLOWLIST.
//
// Dipakai untuk isi template surat: HTML-nya berasal dari hasil konversi
// .docx (mammoth) dan dari template tersimpan yang dibuat admin lain.
// Penyaringan berbasis regex mudah ditembus (`<svg/onload=...>`, tag tanpa
// penutup, entitas HTML), sehingga di sisi tampilan kita membangun ulang
// pohon DOM-nya dan hanya mempertahankan tag serta atribut yang memang
// dibutuhkan surat.

const ALLOWED_TAGS = new Set([
  "P", "BR", "HR", "DIV", "SPAN", "STRONG", "B", "EM", "I", "U", "S", "SUB", "SUP",
  "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "CODE",
  "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH",
  "A", "IMG", "FIGURE", "FIGCAPTION",
  // FONT ikut diizinkan karena inilah yang dihasilkan tombol jenis/ukuran
  // huruf pada toolbar (document.execCommand "fontName"/"fontSize"). Tanpa
  // ini, setiap perubahan huruf yang dibuat admin akan hilang begitu
  // dokumennya disimpan lalu dimuat kembali.
  "FONT",
]);

const ALLOWED_ATTRS = new Set([
  "class", "style", "colspan", "rowspan", "width", "height", "align", "alt", "title", "dir",
  // Atribut milik <font> di atas.
  "face", "size", "color",
  // Lapisan hiasan pada pratinjau transkrip (kop, garis bantu, kotak foto)
  // menandai dirinya sendiri sebagai bukan-isi. Tanpa ini, penanda itu ikut
  // hilang setiap kali tata letaknya disimpan lalu dimuat kembali.
  "aria-hidden",
]);

// Tag yang isinya ikut dibuang seluruhnya, bukan sekadar tag-nya dilepas.
const DROP_WITH_CONTENT = new Set([
  "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META",
  "FORM", "INPUT", "BUTTON", "NOSCRIPT", "TEMPLATE", "SVG", "MATH",
]);

// Properti CSS yang dapat memuat pemanggilan eksternal atau ekspresi.
// url(...) hanya diizinkan untuk gambar tertanam (data:image/...).
const CSS_BLOCKLIST = /(expression\s*\(|url\s*\(\s*['"]?\s*(?!data:image\/)|behavior\s*:|@import|-moz-binding)/i;

// Buang seluruh karakter kendali, spasi, dan zero-width. Karakter semacam
// itu kerap disisipkan di tengah kata untuk menyamarkan skema berbahaya,
// misalnya "java" + TAB + "script:". Ditapis per titik-kode, bukan lewat
// kelas karakter, supaya tidak ada karakter tak terlihat di berkas ini.
function stripInvisible(value: string) {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    const invisible =
      code <= 0x20 ||
      code === 0x7f ||
      (code >= 0x200b && code <= 0x200f) ||
      (code >= 0x2028 && code <= 0x202f) ||
      (code >= 0x2060 && code <= 0x2064) ||
      code === 0x3000 ||
      code === 0xfeff;
    if (!invisible) out += ch;
  }
  return out;
}

function safeUrl(value: string, allowDataImage: boolean) {
  // Entitas HTML didekode dulu agar "&#106;avascript:" ikut tertangkap.
  const decoded = value
    .replace(/&#(\d+);?/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);?/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)));
  const normalized = stripInvisible(decoded).toLowerCase();
  if (allowDataImage && normalized.startsWith("data:image/")) return true;
  return /^(https?:|mailto:|tel:|#|\/)/.test(normalized);
}

function cleanStyle(value: string) {
  return CSS_BLOCKLIST.test(value) ? "" : value.slice(0, 500);
}

function scrub(node: Element) {
  for (const child of Array.from(node.children)) {
    if (DROP_WITH_CONTENT.has(child.tagName)) {
      child.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(child.tagName)) {
      // Tag tak dikenal: pertahankan teksnya, buang elemennya.
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }

    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith("on")) {
        child.removeAttribute(attr.name);
        continue;
      }
      if (name === "href" && child.tagName === "A") {
        if (!safeUrl(value, false)) {
          child.removeAttribute(attr.name);
        } else {
          child.setAttribute("rel", "noopener noreferrer");
        }
        continue;
      }
      if (name === "src" && child.tagName === "IMG") {
        if (!safeUrl(value, true)) child.remove();
        continue;
      }
      if (name === "style") {
        const cleaned = cleanStyle(value);
        if (cleaned) child.setAttribute("style", cleaned);
        else child.removeAttribute("style");
        continue;
      }
      if (!ALLOWED_ATTRS.has(name)) {
        child.removeAttribute(attr.name);
      }
    }

    if (child.isConnected) scrub(child);
  }
}

/** Bersihkan HTML template surat. Hanya berjalan di browser (butuh DOM). */
export function sanitizeLetterHtml(html: string) {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  scrub(doc.body);
  return doc.body.innerHTML;
}

/**
 * Lapis pertama, berjalan di SERVER.
 *
 * DOMParser tidak ada di Node, jadi yang bisa dilakukan sebelum HTML masuk
 * basis data hanyalah membuang tag dan atribut berbahaya secara tekstual.
 * Pola ini sengaja tidak bergantung pada tag yang berpasangan rapi:
 * `<script src=...>` tanpa penutup dan `<svg/onload=...>` pun ikut terbuang.
 *
 * Pertahanan yang menentukan tetap `sanitizeLetterHtml` di sisi tampilan,
 * yang membangun ulang pohon DOM dengan allowlist. Dua lapis, karena satu
 * saja berarti seluruh keamanan bergantung pada satu berkas yang benar.
 */
export function bersihkanHtmlServer(html: string, batas: number) {
  return String(html || "")
    .slice(0, batas)
    .replace(/<\s*(script|iframe|object|embed|link|meta|form|svg|math)\b[\s\S]*?(?:<\s*\/\s*\1\s*>|>)/gi, "")
    .replace(/<\s*\/\s*(script|iframe|object|embed|link|meta|form|svg|math)\s*>/gi, "")
    .replace(/[\s/]on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(javascript|vbscript|data)\s*(?::|&#58;)/gi, (match) =>
      // data: tetap boleh khusus gambar tertanam (tanda tangan hasil scan).
      /^data/i.test(match) ? match : "blocked:",
    );
}
