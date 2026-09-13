// ============================================================
// PENYELARAS SUMBER NONTON DRAMA
//
// Membandingkan tabel di src/lib/drama.ts dengan keadaan repositori hulu
// (Sansekai/SekaiDrama) hari ini, lalu melaporkan apa yang berbeda.
//
//   npx tsx cek-sekaidrama.ts          laporan biasa
//   npx tsx cek-sekaidrama.ts --json   untuk dibaca mesin
//
// Kode keluarnya dibuat bercerita, supaya penjadwal dapat memakainya:
//   0  selaras — tidak ada yang perlu dikerjakan
//   2  ada perbedaan — tabelnya perlu disesuaikan
//   1  gagal memeriksa (jaringan, hulu tidak dapat dihubungi)
//
// KENAPA PERLU ADA SAMA SEKALI: API yang dipakai menu Nonton Drama bukan
// milik kita. Ia berubah sendiri, tanpa pemberitahuan, dan dalam riwayat
// hulu ada platform yang hilang, kembali, lalu hilang lagi dalam hitungan
// pekan. Tanpa berkas ini, yang memberi tahu kita bahwa satu platform sudah
// mati adalah keluhan pengguna — dan itu terlambat sekitar tiga hari.
//
// Yang dipakai untuk membaca hulu: `git ls-remote` untuk commit terbarunya,
// dan raw.githubusercontent.com untuk isi berkasnya. Keduanya TIDAK menuntut
// token, sehingga penyelarasan ini tetap berjalan di mana pun ia dijadwalkan.
// ============================================================

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PLATFORM, SUMBER_HULU, type Aksi, type Platform, type Titik } from "@/lib/drama";

const jalankan = promisify(execFile);

const REPO = `https://github.com/${SUMBER_HULU.pemilik}/${SUMBER_HULU.repo}`;
const RAW = `https://raw.githubusercontent.com/${SUMBER_HULU.pemilik}/${SUMBER_HULU.repo}/${SUMBER_HULU.cabang}`;

type Temuan = {
  /** "sama" tidak dilaporkan panjang lebar; yang dibaca orang yang lain. */
  jenis: "commit" | "platform" | "titik" | "berkas";
  parah: "beda" | "hilang" | "catatan";
  pesan: string;
};

const temuan: Temuan[] = [];
function catat(jenis: Temuan["jenis"], parah: Temuan["parah"], pesan: string) {
  temuan.push({ jenis, parah, pesan });
}

// ============================================================
// MEMBACA HULU
// ============================================================

async function commitHulu(): Promise<string> {
  const { stdout } = await jalankan("git", ["ls-remote", `${REPO}.git`, `refs/heads/${SUMBER_HULU.cabang}`]);
  return stdout.trim().split(/\s+/)[0] ?? "";
}

const simpanan = new Map<string, string | null>();

/** Isi sebuah berkas di hulu; null bila berkasnya sudah tidak ada. */
async function berkasHulu(jalur: string): Promise<string | null> {
  if (simpanan.has(jalur)) return simpanan.get(jalur) ?? null;
  const jawab = await fetch(`${RAW}/${jalur}`, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(20_000),
  });
  const isi = jawab.ok ? await jawab.text() : null;
  simpanan.set(jalur, isi);
  return isi;
}

// ============================================================
// MEMBACA DAFTAR PLATFORM DI HULU
// ============================================================

/**
 * Platform yang hidup menurut hulu.
 *
 * Dibaca dari src/hooks/usePlatform.ts, dan baris berkomentar SENGAJA
 * dibuang lebih dulu: di sanalah hulu menonaktifkan platform tanpa
 * menghapusnya, dan entri yang dikomentari justru penanda "sedang mati".
 */
function platformHulu(isi: string): string[] {
  const tanpaKomentar = isi
    .split(/\r?\n/)
    .filter((baris) => !baris.trim().startsWith("//"))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const hasil: string[] = [];
  const pola = /id:\s*"([a-z0-9_-]+)"/g;
  let cocok: RegExpExecArray | null;
  while ((cocok = pola.exec(tanpaKomentar))) hasil.push(cocok[1]);
  return [...new Set(hasil)];
}

// ============================================================
// MEMBACA SATU BERKAS RUTE DI HULU
// ============================================================

type BacaanRute = {
  /** Seluruh jalur API hulu yang disebut berkas itu. */
  jalur: string[];
  /** Seluruh nama parameter yang dikirimkannya. */
  parameter: string[];
};

/**
 * Menarik alamat dan parameter dari sebuah berkas rute hulu.
 *
 * Hulu menulis alamatnya dalam tiga gaya yang berbeda, dan ketiganya harus
 * terbaca:
 *
 *   const UPSTREAM_API = (… ) + "/dramabox";  fetch(`${UPSTREAM_API}/latest`)
 *   const UPSTREAM_API = …;                   fetch(`${UPSTREAM_API}/goodshort/detail`)
 *   fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "…"}/freereels/homepage`)
 *
 * Yang pertama menyimpan nama platformnya di tetapan, bukan di alamatnya —
 * jadi awalan itu perlu disambungkan kembali sebelum dibandingkan.
 */
function bacaRute(isi: string): BacaanRute {
  const awalan = isi.match(/const\s+UPSTREAM_API\s*=[^;]*?\+\s*"([^"]+)"/)?.[1] ?? "";

  const jalur = new Set<string>();
  const polaJalur = /\$\{([^}]*)\}(\/[A-Za-z0-9\-_/]+)/g;
  let cocok: RegExpExecArray | null;
  while ((cocok = polaJalur.exec(isi))) {
    const dari = cocok[1];
    const sisa = cocok[2];
    if (dari.includes("UPSTREAM_API")) jalur.add(`${awalan}${sisa}`);
    else jalur.add(sisa);
  }

  const parameter = new Set<string>();
  const polaSet = /searchParams\.set\(\s*"([^"]+)"/g;
  while ((cocok = polaSet.exec(isi))) parameter.add(cocok[1]);
  const polaKueri = /[?&]([A-Za-z0-9_]+)=/g;
  while ((cocok = polaKueri.exec(isi))) parameter.add(cocok[1]);

  return { jalur: [...jalur], parameter: [...parameter] };
}

// ============================================================
// PEMERIKSAAN
// ============================================================

async function periksaTitik(platform: Platform, aksi: Aksi, titik: Titik) {
  if (!titik.berkas) {
    catat("titik", "catatan", `${platform.id}/${aksi}: belum mencatat berkas hulunya, tidak dapat diperiksa.`);
    return;
  }

  const jalurBerkas = `src/app/api/${titik.berkas}/route.ts`;
  const isi = await berkasHulu(jalurBerkas);
  if (isi === null) {
    catat("berkas", "hilang", `${platform.id}/${aksi}: ${jalurBerkas} sudah tidak ada di hulu.`);
    return;
  }

  const bacaan = bacaRute(isi);

  if (!bacaan.jalur.includes(titik.jalur)) {
    catat(
      "titik",
      "beda",
      `${platform.id}/${aksi}: kita memakai "${titik.jalur}", hulu sekarang memakai ${
        bacaan.jalur.length ? bacaan.jalur.map((satu) => `"${satu}"`).join(", ") : "(tidak terbaca)"
      } — ${jalurBerkas}`,
    );
  }

  const wajib = [titik.kunciCari, titik.kunciId, titik.kunciEpisode, titik.halaman?.kunci].filter(
    (nama): nama is string => Boolean(nama),
  );
  for (const nama of wajib) {
    if (!bacaan.parameter.includes(nama)) {
      catat(
        "titik",
        "beda",
        `${platform.id}/${aksi}: parameter "${nama}" tidak terbaca di hulu; yang ada: ${
          bacaan.parameter.join(", ") || "(tidak ada)"
        } — ${jalurBerkas}`,
      );
    }
  }
}

/** Menjalankan sejumlah pekerjaan dengan beberapa jalur sekaligus. */
async function borongan<T>(daftar: T[], lebar: number, kerja: (isi: T) => Promise<void>) {
  let urutan = 0;
  async function pekerja() {
    while (urutan < daftar.length) {
      const milikku = daftar[urutan++];
      await kerja(milikku);
    }
  }
  await Promise.all(Array.from({ length: Math.min(lebar, daftar.length) }, pekerja));
}

async function utama() {
  const json = process.argv.includes("--json");
  if (!json) {
    console.log(`\n== PENYELARASAN DENGAN ${SUMBER_HULU.pemilik}/${SUMBER_HULU.repo} ==`);
    console.log(`   acuan kita : ${SUMBER_HULU.commit} (dibaca ${SUMBER_HULU.dibacaPada})`);
  }

  // ---------- commit ----------
  let commit = "";
  try {
    commit = await commitHulu();
  } catch (error: unknown) {
    console.error("Tidak dapat membaca commit hulu:", error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const selarasCommit = commit.startsWith(SUMBER_HULU.commit);
  if (!json) console.log(`   hulu kini  : ${commit.slice(0, 7)}${selarasCommit ? " (sama)" : " (BERBEDA)"}`);
  if (!selarasCommit) {
    catat(
      "commit",
      "beda",
      `Hulu sudah bergerak ke ${commit.slice(0, 7)}. Bandingkan: ${REPO}/compare/${SUMBER_HULU.commit}...${commit.slice(0, 7)}`,
    );
  }

  // ---------- daftar platform ----------
  const isiPlatform = await berkasHulu("src/hooks/usePlatform.ts");
  if (isiPlatform === null) {
    catat("berkas", "hilang", "src/hooks/usePlatform.ts sudah tidak ada di hulu — susunan platformnya pindah tempat.");
  } else {
    const diHulu = platformHulu(isiPlatform);
    // Sebagai teks biasa, bukan sebagai IdPlatform: yang dibaca dari hulu
    // memang dapat berisi nama yang belum pernah ada di tabel kita, dan
    // itulah justru salah satu hal yang perlu dilaporkan.
    const diKita: string[] = PLATFORM.filter((item) => item.aktif).map((item) => item.id);
    const semuaKita: string[] = PLATFORM.map((item) => item.id);

    for (const id of diHulu) {
      if (!diKita.includes(id)) {
        const sudahDikenal = semuaKita.includes(id);
        catat(
          "platform",
          "beda",
          sudahDikenal
            ? `${id}: hidup di hulu, tetapi masih dimatikan di tabel kita — nyalakan bila API-nya sudah pulih.`
            : `${id}: platform BARU di hulu, belum ada di tabel kita.`,
        );
      }
    }
    for (const id of diKita) {
      if (!diHulu.includes(id)) {
        catat("platform", "beda", `${id}: sudah dimatikan di hulu, tetapi masih hidup di tabel kita.`);
      }
    }
    if (!json) console.log(`   platform   : ${diHulu.length} hidup di hulu, ${diKita.length} hidup di sini`);
  }

  // ---------- tiap titik ----------
  const pekerjaan: Array<{ platform: Platform; aksi: Aksi; titik: Titik }> = [];
  for (const platform of PLATFORM) {
    for (const [aksi, titik] of Object.entries(platform.titik)) {
      if (titik) pekerjaan.push({ platform, aksi: aksi as Aksi, titik });
    }
  }

  await borongan(pekerjaan, 6, ({ platform, aksi, titik }) => periksaTitik(platform, aksi, titik));

  // ---------- laporan ----------
  if (json) {
    console.log(JSON.stringify({ commit, acuan: SUMBER_HULU.commit, selarasCommit, temuan }, null, 2));
  } else {
    console.log(`   titik      : ${pekerjaan.length} diperiksa\n`);
    if (!temuan.length) {
      console.log("Selaras. Tidak ada yang perlu disesuaikan.\n");
    } else {
      console.log(`${temuan.length} hal perlu dilihat:\n`);
      for (const satu of temuan) console.log(`  [${satu.parah}] ${satu.pesan}`);
      console.log(
        [
          "",
          "Yang biasanya perlu dikerjakan:",
          "  • jalur atau parameter berubah → sunting tabel di src/lib/drama.ts",
          "  • platform baru di hulu        → tambah satu entri di tabel yang sama",
          "  • platform mati di hulu        → setel aktif: false, beserta alasannya",
          "  • sesudah menyesuaikan         → perbarui SUMBER_HULU.commit dan dibacaPada,",
          "                                    lalu jalankan `npx tsx uji-drama.ts`",
          "",
        ].join("\n"),
      );
    }
  }

  process.exit(temuan.length ? 2 : 0);
}

void utama();
