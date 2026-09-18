// Uji perbaikan v45 pada Penyerahan Skripsi/Jurnal:
//
//   1. angka dan kalimat kemajuan unggahan (src/lib/kemajuan.ts);
//   2. aturan "boleh dicoba lagi" beserta pengulangan kirimannya
//      (src/lib/kirim-ulang.ts);
//   3. jalur yang dipakai server untuk mengenali kiriman ulang
//      (src/lib/unggah-klaim.ts).
//
// Seluruhnya berjalan tanpa Supabase, tanpa basis data, dan tanpa jaringan:
// fetch-nya diganti tiruan supaya urutan percobaan dapat diperiksa persis.
process.env.UNGGAH_SECRET = process.env.UNGGAH_SECRET || "rahasia-untuk-uji-saja";

import {
  ejaBita,
  kalimatKemajuan,
  keadaanBerkas,
  kemajuanAwal,
  persenBita,
  persenTampil,
  type Kemajuan,
} from "./src/lib/kemajuan";
import { bolehCobaLagi, kirimFormulir, pesanJaringan } from "./src/lib/kirim-ulang";
import { jalurDiklaim, type BagianDiklaim } from "./src/lib/unggah-klaim";

let gagal = 0;
const ok = (n: string, s: boolean, i = "") => {
  console.log(`${s ? "  ✓" : "  ✗"} ${n}${i ? ` — ${i}` : ""}`);
  if (!s) gagal++;
};

const MB = 1024 * 1024;

/** Keadaan kemajuan yang dapat diubah sebagian, supaya ujinya terbaca. */
function kemajuan(ubah: Partial<Kemajuan>): Kemajuan {
  return { ...kemajuanAwal(4, 55 * MB), ...ubah };
}

// ------------------------------------------------------------
console.log("\n=== PERSENTASE BITA ===\n");

ok("nol bita adalah 0%", persenBita(0, 100) === 0);
ok("setengah adalah 50%", persenBita(50, 100) === 50);
ok("dibulatkan ke bawah", persenBita(999, 1000) === 99, String(persenBita(999, 1000)));
ok("penuh adalah 100%", persenBita(100, 100) === 100);
ok("lebih dari penuh tetap 100%", persenBita(120, 100) === 100);
ok("total nol tidak menghasilkan NaN", persenBita(10, 0) === 0);
ok("angka tidak wajar tidak menghasilkan NaN", persenBita(Number.NaN, 100) === 0);
ok("bita minus tidak menghasilkan angka minus", persenBita(-5, 100) === 0);

ok(
  "tahap menyimpan berhenti di 99% supaya tidak berbohong",
  persenTampil(kemajuan({ tahap: "simpan", bita: 55 * MB })) === 99,
);
ok(
  "tahap unggah memakai bita sebenarnya",
  persenTampil(kemajuan({ tahap: "unggah", bita: 11 * MB, bitaTotal: 44 * MB })) === 25,
);

// ------------------------------------------------------------
console.log("\n=== EJAAN UKURAN ===\n");

ok("berkas kecil dieja dalam KB", ejaBita(250 * 1024) === "250 KB", ejaBita(250 * 1024));
ok("berkas besar dieja dalam MB dengan koma", ejaBita(13.5 * MB) === "13,5 MB", ejaBita(13.5 * MB));
ok("nol tidak dieja sebagai 0,0 MB", ejaBita(0) === "0 KB", ejaBita(0));

// ------------------------------------------------------------
console.log("\n=== KALIMAT KEMAJUAN ===\n");

ok(
  "tahap izin menyebut berkas keberapa",
  kalimatKemajuan(kemajuan({ tahap: "izin", indeks: 1 })) === "Menyiapkan berkas 2 dari 4…",
  kalimatKemajuan(kemajuan({ tahap: "izin", indeks: 1 })),
);

const saatUnggah = kalimatKemajuan(
  kemajuan({ tahap: "unggah", indeks: 1, nama: "skripsi.pdf", bita: 22 * MB, bitaTotal: 44 * MB }),
);
ok("tahap unggah menyebut nama berkasnya", saatUnggah.includes("skripsi.pdf"), saatUnggah);
ok("tahap unggah menyebut persentasenya", saatUnggah.includes("(50%)"), saatUnggah);
ok("tahap unggah menyebut berkas keberapa", saatUnggah.includes("berkas 2 dari 4"), saatUnggah);

ok(
  "tahap simpan memakai kalimat yang dikenal mahasiswa",
  kalimatKemajuan(kemajuan({ tahap: "simpan" })) === "Semua berkas terunggah. Menyimpan pengajuan…",
  kalimatKemajuan(kemajuan({ tahap: "simpan" })),
);
ok(
  "revisi menyebut dirinya revisi",
  kalimatKemajuan(kemajuan({ tahap: "simpan" }), "revisi").includes("Menyimpan revisi…"),
);
ok(
  "percobaan kedua disebutkan supaya menunggu tidak terasa mati",
  kalimatKemajuan(kemajuan({ tahap: "simpan", percobaan: 2, maksPercobaan: 3 })).includes(
    "percobaan 2 dari 3",
  ),
);
ok(
  "pengajuan tanpa berkas tidak menyebut berkas apa pun",
  kalimatKemajuan(kemajuan({ tahap: "simpan", total: 0, bitaTotal: 0 })) === "Mengirim pengajuan…",
  kalimatKemajuan(kemajuan({ tahap: "simpan", total: 0, bitaTotal: 0 })),
);
ok(
  "pengajuan tanpa berkas tidak menyebut berkas pada tahap mana pun",
  kalimatKemajuan(kemajuan({ tahap: "izin", total: 0, bitaTotal: 0 })) === "Mengirim pengajuan…" &&
    kalimatKemajuan(kemajuan({ tahap: "unggah", total: 0, bitaTotal: 0 })) === "Mengirim pengajuan…",
  kalimatKemajuan(kemajuan({ tahap: "izin", total: 0, bitaTotal: 0 })),
);
ok(
  "pengajuan tanpa berkas tetap menyebut percobaan keberapa",
  kalimatKemajuan(kemajuan({ tahap: "simpan", total: 0, bitaTotal: 0, percobaan: 3, maksPercobaan: 3 })).includes(
    "percobaan 3 dari 3",
  ),
);
ok(
  "nomor berkas tidak pernah melewati totalnya",
  kalimatKemajuan(kemajuan({ tahap: "izin", indeks: 9 })).includes("berkas 4 dari 4"),
);

// ------------------------------------------------------------
console.log("\n=== KEADAAN TIAP BARIS BERKAS ===\n");

const sedangKetiga = kemajuan({ tahap: "unggah", indeks: 2 });
ok("berkas yang sudah lewat ditandai selesai", keadaanBerkas(sedangKetiga, 0) === "selesai");
ok("berkas yang sedang naik ditandai jalan", keadaanBerkas(sedangKetiga, 2) === "jalan");
ok("berkas berikutnya ditandai menunggu", keadaanBerkas(sedangKetiga, 3) === "tunggu");
ok(
  "saat menyimpan, seluruh berkas ditandai selesai",
  [0, 1, 2, 3].every((i) => keadaanBerkas(kemajuan({ tahap: "simpan" }), i) === "selesai"),
);

// ------------------------------------------------------------
console.log("\n=== BOLEH DICOBA LAGI? ===\n");

ok("504 tanpa pesan portal boleh diulang", bolehCobaLagi(504, false));
ok("502 tanpa pesan portal boleh diulang", bolehCobaLagi(502, false));
ok("500 tanpa pesan portal boleh diulang", bolehCobaLagi(500, false));
ok("sambungan putus (status 0) boleh diulang", bolehCobaLagi(0, false));
ok("408 boleh diulang", bolehCobaLagi(408, false));
ok("400 TIDAK diulang", !bolehCobaLagi(400, false));
ok("413 TIDAK diulang", !bolehCobaLagi(413, false));
ok("429 TIDAK diulang", !bolehCobaLagi(429, false));
ok("503 dengan pesan portal (maintenance) TIDAK diulang", !bolehCobaLagi(503, true));
ok("504 dengan pesan portal TIDAK diulang", !bolehCobaLagi(504, true));

ok(
  "waktu habis dijelaskan sebagai waktu habis",
  pesanJaringan(Object.assign(new Error("x"), { name: "TimeoutError" })).includes("batas waktu"),
);
ok(
  "kegagalan lain dijelaskan sebagai sambungan terputus",
  pesanJaringan(new TypeError("fetch failed")).includes("terputus"),
);

// ------------------------------------------------------------
console.log("\n=== PENGULANGAN KIRIMAN ===\n");

type Panggilan = { status: number; muatan: unknown };
const aslinyaFetch = globalThis.fetch;

/** fetch tiruan: memulangkan jawaban yang sudah disiapkan, satu per panggilan. */
function pasangFetch(urutan: Panggilan[]) {
  let dipanggil = 0;
  globalThis.fetch = (async () => {
    const jawaban = urutan[Math.min(dipanggil, urutan.length - 1)];
    dipanggil += 1;
    return {
      ok: jawaban.status >= 200 && jawaban.status < 300,
      status: jawaban.status,
      json: async () => jawaban.muatan,
    } as Response;
  }) as typeof fetch;
  return () => dipanggil;
}

// Jeda antar percobaan tidak diuji di sini (ujinya akan ikut menunggu);
// yang diuji berapa kali dan dengan hasil apa.
async function jalankanUji() {
  {
    const hitung = pasangFetch([
      { status: 504, muatan: null },
      { status: 201, muatan: { success: true, ticket: "SIPALING-PERPUS-2021-12345" } },
    ]);
    const hasil = await kirimFormulir<{ ticket: string }>("/api/requests", new FormData(), {
      maks: 3,
    });
    ok("504 lalu berhasil: tiketnya sampai juga", hasil.ticket === "SIPALING-PERPUS-2021-12345");
    ok("504 lalu berhasil: tepat dua panggilan", hitung() === 2, String(hitung()));
  }

  {
    const hitung = pasangFetch([{ status: 400, muatan: { success: false, message: "NIM harus angka." } }]);
    let pesan = "";
    try {
      await kirimFormulir("/api/requests", new FormData(), { maks: 3 });
    } catch (galat: unknown) {
      pesan = galat instanceof Error ? galat.message : String(galat);
    }
    ok("penolakan portal dipulangkan apa adanya", pesan === "NIM harus angka.", pesan);
    ok("penolakan portal TIDAK diulang", hitung() === 1, String(hitung()));
  }

  {
    const hitung = pasangFetch([{ status: 504, muatan: null }]);
    let pesan = "";
    try {
      await kirimFormulir("/api/requests", new FormData(), { maks: 2 });
    } catch (galat: unknown) {
      pesan = galat instanceof Error ? galat.message : String(galat);
    }
    ok("gagal terus: berhenti tepat pada batas percobaan", hitung() === 2, String(hitung()));
    ok("gagal terus: kode 504 tetap disebut", pesan.includes("504"), pesan);
    ok(
      "gagal terus: mahasiswa diberi tahu berkasnya tidak hilang",
      pesan.includes("masih tersimpan"),
      pesan,
    );
  }

  {
    // Kiriman ulang yang mendarat pada pengajuan yang SUDAH tersimpan: server
    // memulangkan tiket yang sama beserta success:true, dan itu bukan galat.
    const hitung = pasangFetch([
      { status: 200, muatan: { success: true, ticket: "SIPALING-PERPUS-2021-99999", ulangan: true } },
    ]);
    const hasil = await kirimFormulir<{ ticket: string }>("/api/requests", new FormData(), {});
    ok("jawaban kiriman ulang diterima sebagai berhasil", hasil.ticket === "SIPALING-PERPUS-2021-99999");
    ok("jawaban kiriman ulang tidak diulang lagi", hitung() === 1, String(hitung()));
  }

  {
    // Jawaban 200 yang badannya bukan JSON portal (halaman galat perantara)
    // boleh diulang: portal tidak pernah bicara.
    const hitung = pasangFetch([
      { status: 200, muatan: null },
      { status: 201, muatan: { success: true, ticket: "SIPALING-PERPUS-2021-11111" } },
    ]);
    const hasil = await kirimFormulir<{ ticket: string }>("/api/requests", new FormData(), { maks: 2 });
    ok("jawaban 200 tanpa JSON portal diulang", hitung() === 2, String(hitung()));
    ok("dan percobaan kedua tetap membawa tiket", hasil.ticket.endsWith("11111"));
  }

  globalThis.fetch = aslinyaFetch;
}

// ------------------------------------------------------------
console.log("\n=== JALUR PENGENAL KIRIMAN ULANG ===\n");

const bagian = (id: string, transit: string | null): BagianDiklaim => ({
  id,
  label: id,
  urut: 0,
  nama: `${id}.pdf`,
  ukuran: 1024,
  berkas: null,
  transit,
});

const campuran = [
  bagian("cover", "requests/transit/2026-09-18/aaa-cover-cover.pdf"),
  bagian("isi", null),
  bagian("pustaka", "requests/transit/2026-09-18/bbb-pustaka-pustaka.pdf"),
  bagian("full", ""),
];

ok("hanya jalur penyimpanan yang dipakai sebagai pengenal", jalurDiklaim(campuran).length === 2);
ok(
  "urutannya mengikuti urutan bagian",
  jalurDiklaim(campuran)[0].includes("cover") && jalurDiklaim(campuran)[1].includes("pustaka"),
);
ok("kiriman jalur cadangan tidak punya pengenal apa pun", jalurDiklaim([bagian("cover", null)]).length === 0);

// ------------------------------------------------------------
jalankanUji()
  .then(() => {
    console.log(`\n${gagal === 0 ? "SEMUA LULUS" : `${gagal} GAGAL`}\n`);
    process.exit(gagal === 0 ? 0 : 1);
  })
  .catch((galat) => {
    console.error(galat);
    process.exit(1);
  });
