// ============================================================
// PEKERJA LATAR CATATAN UANG
//
// Gunanya satu: aplikasi tetap terbuka ketika sinyal hilang. Orang mencatat
// uang justru di tempat sinyalnya paling buruk, yaitu di dalam pasar, di
// parkiran, dan di antrean kasir.
//
// Yang TIDAK dikerjakan berkas ini sama pentingnya: jawaban /api tidak pernah
// disimpan. Angka uang yang basi lebih berbahaya daripada halaman yang tidak
// terbuka, karena yang basi tidak terlihat basi.
//
// Cakupannya seluruh situs karena berkasnya berada di akar, TETAPI permintaan
// di luar /uang dilewatkan begitu saja ke jaringan. Halaman portal lain tidak
// boleh ikut berubah perilakunya oleh berkas ini.
// ============================================================

const SIMPANAN = "uang-v1";

const RANGKA = [
  "/uang",
  "/manifest-uang.webmanifest",
  "/images/uang/ikon-192.png",
  "/images/uang/ikon-512.png",
];

self.addEventListener("install", (peristiwa) => {
  peristiwa.waitUntil(
    (async () => {
      const simpanan = await caches.open(SIMPANAN);
      // Satu berkas yang gagal diambil tidak boleh menggagalkan pemasangan.
      await Promise.all(RANGKA.map((alamat) => simpanan.add(alamat).catch(() => {})));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (peristiwa) => {
  peristiwa.waitUntil(
    (async () => {
      const nama = await caches.keys();
      await Promise.all(nama.filter((n) => n !== SIMPANAN).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

function milikUang(alamat) {
  return alamat.pathname === "/uang" || alamat.pathname.startsWith("/images/uang/");
}

self.addEventListener("fetch", (peristiwa) => {
  const permintaan = peristiwa.request;
  if (permintaan.method !== "GET") return;

  let alamat;
  try {
    alamat = new URL(permintaan.url);
  } catch {
    return;
  }
  if (alamat.origin !== self.location.origin) return;

  // Jawaban API tidak pernah disimpan, dan tidak pernah dijawab dari
  // simpanan. Kalau jaringannya mati, layarnya memang harus tahu.
  if (alamat.pathname.startsWith("/api/")) return;

  const halamanUang =
    permintaan.mode === "navigate" && (alamat.pathname === "/uang" || alamat.pathname === "/uang/");

  if (halamanUang) {
    // Jaringan lebih dulu: versi terbaru selalu menang selama ada sinyal.
    peristiwa.respondWith(
      (async () => {
        try {
          const jawab = await fetch(permintaan);
          const simpanan = await caches.open(SIMPANAN);
          simpanan.put("/uang", jawab.clone());
          return jawab;
        } catch {
          const tersimpan = await caches.match("/uang");
          if (tersimpan) return tersimpan;
          return new Response(
            "<!doctype html><meta charset=utf-8><title>Catatan Uang</title>" +
              "<body style=\"font-family:system-ui;padding:40px;text-align:center\">" +
              "<h1>Belum ada sinyal</h1><p>Buka lagi setelah tersambung.</p>",
            { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
      })(),
    );
    return;
  }

  // Berkas statis milik halaman ini dan bundel Next yang namanya sudah
  // bersidik: simpanan lebih dulu, jaringan menyusul di belakang.
  const statisNext = alamat.pathname.startsWith("/_next/static/");
  if (!statisNext && !milikUang(alamat)) return;

  peristiwa.respondWith(
    (async () => {
      const tersimpan = await caches.match(permintaan);
      if (tersimpan) return tersimpan;
      const jawab = await fetch(permintaan);
      if (jawab.ok) {
        const simpanan = await caches.open(SIMPANAN);
        simpanan.put(permintaan, jawab.clone());
      }
      return jawab;
    })(),
  );
});
