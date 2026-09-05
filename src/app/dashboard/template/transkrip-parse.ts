// Pembaca Excel transkrip akademik FISIP — dipisah agar dapat diuji mandiri.
// Mendukung format bilingual KUI: tiap mata kuliah 2 baris
// (baris 1 = nama Indonesia + angka, baris 2 = nama Inggris saja),
// dua blok kolom bernomor atas-ke-bawah, serta mata kuliah tanpa nilai huruf
// (mis. Skripsi/Seminar) yang SKS-nya tetap dihitung dalam total & IPK.

export type CourseRow = { kode: string; nama: string; en: string; hm: string; k: number };
export type Aoa = Array<Array<string | number | null>>;
type ColumnGroup = { no: number; kode: number; nama: number; k: number; hm: number; am: number };

export const AM: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, E: 0 };
export const HMS = Object.keys(AM);

const cellText = (value: string | number | null | undefined) => String(value ?? "").trim();

/**
 * Apakah teks ini layak dianggap nama mata kuliah versi Inggris?
 *
 * Minimal empat huruf dan memuat satu rangkaian tiga huruf. Sel legenda di
 * bawah tabel ("K", "HM", "AM", "MK") dan pecahan angka karena itu tidak
 * pernah lolos.
 */
function namaLayak(teks: string) {
  return teks.length >= 4 && /[A-Za-z]{3}/.test(teks);
}

function findGroups(aoa: Aoa): { head: number; groups: ColumnGroup[] } | null {
  for (let i = 0; i < Math.min(aoa.length, 40); i++) {
    const row = (aoa[i] || []).map((cell) => cellText(cell).toLowerCase());
    const groups: ColumnGroup[] = [];
    row.forEach((cell, index) => {
      if (cell !== "no") return;
      const segment = row.slice(index, index + 12);
      const at = (re: RegExp) => {
        const j = segment.findIndex((value) => re.test(value));
        return j < 0 ? -1 : index + j;
      };
      const group: ColumnGroup = {
        no: index,
        kode: at(/^kode/),
        nama: at(/mata kuliah|nama mk/),
        k: at(/^(k|sks|kredit)$/),
        hm: at(/^(hm)$|^huruf/),
        am: at(/^(am)$|^angka/),
      };
      if (group.nama >= 0 && (group.k >= 0 || group.hm >= 0)) groups.push(group);
    });
    if (groups.length) return { head: i, groups };
  }
  return null;
}

const BIO_LABELS: Array<[RegExp, string]> = [
  [/nama\s*mahasiswa/i, "nama"],
  [/nomor\s*induk/i, "nim"],
  [/tempat.*lahir/i, "ttl"],
  [/program\s*studi/i, "prodi"],
  [/tanggal\s*yudisium/i, "yudisium"],
  [/terakreditasi|^status\b/i, "akred"],
  [/nomor\s*ija[sz]ah/i, "noijazah"],
  [/konse?n?trasi/i, "konsentrasi"],
  [/judul\s*skripsi/i, "judul"],
];

export function extractBio(aoa: Aoa): Record<string, string> {
  const bio: Record<string, string> = {};
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] || [];
    for (let c = 0; c < row.length; c++) {
      const text = cellText(row[c]);
      if (!text) continue;
      const labelPart = text.split(":")[0];
      for (const [re, key] of BIO_LABELS) {
        if (bio[key] !== undefined || !re.test(labelPart)) continue;
        if (key === "prodi" && /nomor\s*pokok/i.test(labelPart)) continue;
        let value = text.includes(":") ? text.slice(text.indexOf(":") + 1).trim() : "";
        if (!value) {
          for (let cc = c + 1; cc < Math.min(row.length, c + 9); cc++) {
            let candidate = cellText(row[cc]);
            if (!candidate || candidate === ":") continue;
            if (candidate.indexOf(":") > 0) break;
            if (candidate.startsWith(":")) candidate = candidate.slice(1).trim();
            if (candidate) { value = candidate; break; }
          }
        }
        if (key === "akred") {
          const nextRow = aoa[r + 1] || [];
          const extra = nextRow.map((cell) => cellText(cell)).find((cell) => /^nomor/i.test(cell));
          if (extra) value = (value ? `${value} ` : "") + extra;
        }
        if (key === "judul" && !value) {
          const parts: string[] = [];
          let stop = false;
          for (let rr = r + 1; rr <= r + 4 && rr < aoa.length && !stop; rr++) {
            const nextRow = aoa[rr] || [];
            for (let cc = Math.max(0, c - 2); cc < Math.min(nextRow.length, c + 8); cc++) {
              const candidate = cellText(nextRow[cc]);
              if (!candidate) continue;
              if (/keterangan|predikat|indeks|total|tanggal|dekan|nbm|jumlah/i.test(candidate)) { stop = true; break; }
              parts.push(candidate);
            }
          }
          value = parts.join(" ");
        }
        if (value) bio[key] = value;
      }
    }
  }
  return bio;
}

export function parseSheetRows(aoa: Aoa): CourseRow[] {
  const found = findGroups(aoa);
  if (!found) throw new Error("Header kolom (NO / KODE MK / NAMA MATA KULIAH / K / HM) tidak ditemukan di sheet ini.");
  const rows: Array<CourseRow & { no: number; group: number }> = [];
  found.groups.forEach((group, groupIndex) => {
    let lastPushed: (CourseRow & { no: number; group: number }) | null = null;
    for (let i = found.head + 1; i < aoa.length; i++) {
      const row = aoa[i] || [];
      const nama = cellText(row[group.nama]);
      if (!nama) continue;
      // Daftar mata kuliahnya BERHENTI di sini, tidak sekadar melewati satu
      // baris. Di bawah tabel ada blok "Keterangan" yang memuat sel berisi
      // "K", "HM", "AM", "MK" pada kolom yang sama dengan nama mata kuliah;
      // dilewati satu per satu, sel-sel itu tetap terbaca sebagai nama
      // Inggris milik mata kuliah terakhir — dan "Etika Pemerintahan" pun
      // tercetak di transkrip resmi dengan terjemahan "K".
      if (/jumlah|total kredit|judul|keterangan|predikat|indeks prestasi|yudisium/i.test(nama)) break;
      if (/^total\b/i.test(nama)) break;

      const kreditText = group.k >= 0 ? cellText(row[group.k]).replace(",", ".") : "";
      const kredit = Number(kreditText) || 0;
      let hm = group.hm >= 0 ? cellText(row[group.hm]).toUpperCase() : "";
      if (!(hm in AM) && group.am >= 0) {
        const am = Number(cellText(row[group.am]).replace(",", "."));
        if (Number.isFinite(am)) {
          let best = "";
          let diff = 99;
          for (const letter of HMS) {
            const delta = Math.abs(AM[letter] - am);
            if (delta < diff) { diff = delta; best = letter; }
          }
          if (diff < 0.6) hm = best;
        }
      }
      if (!(hm in AM)) hm = ""; // tanpa nilai huruf (mis. Skripsi), tetap sah

      if (kredit > 12) continue; // baris subtotal/JUMLAH yang nyasar, bukan mata kuliah

      if (!kredit) {
        // Baris tanpa SKS = kemungkinan besar baris nama INGGRIS milik
        // mata kuliah tepat di atasnya (format bilingual KUI).
        // Nama Inggris yang sah selalu berupa kata, bukan singkatan satu-dua
        // huruf. Batas ini menahan sel legenda ("K", "HM", "AM", "MK") dan
        // angka yang nyasar ke kolom nama.
        if (lastPushed && !lastPushed.en && nama !== lastPushed.nama && namaLayak(nama)) {
          lastPushed.en = nama;
        }
        continue;
      }

      const noValue = Number(cellText(row[group.no]));
      const item = {
        no: Number.isFinite(noValue) && noValue > 0 ? noValue : 9000 + rows.length,
        group: groupIndex,
        kode: group.kode >= 0 ? cellText(row[group.kode]) : "",
        nama,
        en: "",
        hm,
        k: kredit,
      };
      rows.push(item);
      lastPushed = item;
    }
  });
  if (!rows.length) throw new Error("Tidak ada baris nilai terbaca di sheet ini.");
  // urut: nomor asli bila ada; bila tidak, urutan blok kiri dulu lalu kanan
  rows.sort((a, b) => (a.no - b.no) || (a.group - b.group));
  return rows.map(({ no: _no, group: _group, ...rest }) => rest);
}

export function computeTotals(rows: CourseRow[]) {
  const sks = rows.reduce((sum, row) => sum + row.k, 0);
  const mutu = rows.reduce((sum, row) => sum + row.k * (AM[row.hm] ?? 0), 0);
  return { sks, mutu, ipk: sks ? mutu / sks : 0 };
}
