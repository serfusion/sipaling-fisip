"use client";

// ============================================================
// LAYAR NONTON DRAMA
//
// Satu layar untuk sepuluh platform. Yang membedakan tiap platform sudah
// dirapikan jauh sebelum sampai ke sini — tabelnya di src/lib/drama.ts,
// pembacanya di src/lib/drama-baca.ts — sehingga berkas ini tidak pernah
// perlu tahu bahwa PineDrama menyebut judulnya "title" dan DramaBox
// menyebutnya "bookName".
//
// Tiga layar saja: daftar, rincian, dan menonton. Sengaja tidak lebih.
// Proyek asalnya memberi tiap platform halaman beranda, halaman rincian, dan
// halaman menonton sendiri — tiga puluh berkas layar yang isinya hampir sama,
// dan tiap perbaikan kecil harus diulang tiga puluh kali.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  barisDaftar,
  gulirBerikut,
  penomoran,
  platformAktif,
  type Aksi,
  type Gulir,
  type Platform,
} from "@/lib/drama";
import type { Episode, Kartu, Rinci } from "@/lib/drama-baca";
import { Pemutar } from "./pemutar";

type Jawaban = {
  success?: boolean;
  message?: string;
  daftar?: Kartu[];
  daftarEpisode?: Episode[];
  kursor?: string;
  habis?: boolean;
  rinci?: Rinci;
  episode?: Episode;
  /**
   * Benar bila isinya datang dari simpanan karena hulu sedang tidak menjawab.
   *
   * Dipulangkan sebagai jawaban yang berhasil, bukan sebagai galat, dan itu
   * disengaja: isinya memang dapat digambar. Yang perlu diketahui pengunjung
   * hanya bahwa daftarnya mungkin tertinggal beberapa judul — dan itu
   * disampaikan sebagai catatan kecil, bukan sebagai layar galat.
   */
  basi?: boolean;
  /** Usia isi simpanan itu dalam detik. */
  usia?: number;
};

/** "sekitar 5 menit lalu" dari usia dalam detik. */
function usiaTerbaca(detik: number | undefined): string {
  if (!detik || detik < 60) return "barusan";
  const menit = Math.round(detik / 60);
  if (menit < 60) return `sekitar ${menit} menit lalu`;
  const jam = Math.round(menit / 60);
  return `sekitar ${jam} jam lalu`;
}

type Baris = {
  aksi: Aksi;
  judul: string;
  isi: Kartu[];
  /** Penanda potongan berikutnya dari hulu; kosong berarti dihitung sendiri. */
  kursor: string;
  /** Berapa potong yang sudah diminta, termasuk yang pertama. */
  potong: number;
  /** Benar bila sudah tidak ada potongan lagi — dari hulu atau karena batas. */
  habis: boolean;
  sibuk: boolean;
  galat: string;
  /** Isinya datang dari simpanan karena hulu sedang tidak menjawab. */
  basi: boolean;
  /** Usia isi simpanan itu dalam detik. */
  usia: number;
  /**
   * Benar bila platform ini memang melayani potongan kedua untuk baris ini.
   *
   * Dibedakan dari `habis`, dan perlu dibedakan: "Baru Masuk" DramaBox sekali
   * ambil habis, jadi ia tidak pernah punya potongan kedua sejak awal — dan
   * menawarkan tombol "Muat lebih banyak" untuknya berarti memasang tombol
   * yang tidak mengerjakan apa pun saat ditekan.
   */
  bisaTambah: boolean;
  /**
   * Benar untuk baris yang menarik sendiri potongan berikutnya saat digulir.
   *
   * HANYA SATU baris yang boleh begitu, dan itu baris terakhir. Dua baris
   * yang sama-sama menarik sendiri berarti baris pertama tumbuh tanpa henti
   * dan baris kedua tidak pernah tercapai — pengunjung menggulir selamanya di
   * dalam satu baris.
   */
  gulirSendiri: boolean;
};

const PLATFORM_TERBUKA = platformAktif();

/** Berapa kartu digambar sekaligus pada baris yang tidak bergulir sendiri. */
const SEPOTONG = 16;

async function minta(
  platform: string,
  aksi: Aksi,
  kueri: Record<string, string | number | undefined> = {},
  tanda?: AbortSignal,
): Promise<Jawaban> {
  const alamat = new URL(`/api/drama/${platform}/${aksi}`, window.location.origin);
  for (const [kunci, nilai] of Object.entries(kueri)) {
    if (nilai !== undefined && nilai !== "") alamat.searchParams.set(kunci, String(nilai));
  }

  const jawab = await fetch(alamat.toString(), { cache: "no-store", signal: tanda });
  const isi = (await jawab.json().catch(() => ({}))) as Jawaban;

  if (jawab.status === 403) {
    // Langganannya habis di tengah menonton. Halaman dimuat ulang supaya
    // gerbang di server yang menjelaskan keadaannya, bukan pesan galat kecil
    // di pojok layar yang tidak memberi tahu apa yang harus dilakukan.
    window.location.reload();
    throw new Error("Akses berakhir.");
  }
  if (!jawab.ok || !isi.success) throw new Error(isi.message || "Sumber dramanya tidak menjawab.");
  return isi;
}

/** Baris-baris kosong sebuah platform, sebelum satu pun jawaban datang. */
function rencanaAwal(platform: Platform): Baris[] {
  const rencana = barisDaftar(platform);
  // Baris yang menarik sendiri saat digulir hanya yang TERAKHIR, dan hanya
  // bila platformnya memang melayani potongan berikutnya. Pada seluruh
  // platform yang hidup, baris terakhir itu "Buat Kamu" — sama seperti di
  // hulu, yang menaruh satu-satunya bagian bergulir di dasar halaman.
  const terakhir = rencana.length - 1;

  return rencana.map((item, nomor) => {
    const bisaTambah = Boolean(penomoran(platform, item.aksi));
    return {
      ...item,
      isi: [],
      kursor: "",
      potong: 0,
      habis: false,
      sibuk: true,
      galat: "",
      basi: false,
      usia: 0,
      bisaTambah,
      gulirSendiri: nomor === terakhir && bisaTambah,
    };
  });
}

/** Apa yang diketahui tentang sebuah potongan yang baru saja pulang. */
function sesudahPotongan(sebelum: Kartu[], jawab: Jawaban): { isi: Kartu[]; habis: boolean } {
  const adaSudah = new Set(sebelum.map((kartu) => kartu.id));
  const tambahan = (jawab.daftar ?? []).filter((kartu) => !adaSudah.has(kartu.id));
  return {
    isi: [...sebelum, ...tambahan],
    // Potongan yang tidak menambah satu judul pun berarti hulu sudah
    // mengulang isi yang sama. Tanpa pemeriksaan ini, gulir tak berhingga
    // benar-benar tak berhingga: pemicunya tetap terlihat, potongannya terus
    // diminta, dan layarnya tidak pernah bertambah.
    habis: Boolean(jawab.habis) || tambahan.length === 0,
  };
}

// ============================================================
// DAFTAR SEBUAH PLATFORM
//
// Dipasang dengan kunci berisi nama platformnya, sehingga berpindah platform
// MEMASANG DAFTAR YANG BENAR-BENAR BARU. Itu bukan penghematan baris: daftar
// yang disetel ulang dengan tangan selalu menyisakan satu keadaan yang
// terlupa — dan yang terlupa di sini adalah penanda halaman platform
// sebelumnya, yang dipakai meminta potongan platform berikutnya.
// ============================================================

function DaftarBaris({ platform, buka }: { platform: Platform; buka: (kartu: Kartu) => void }) {
  const [baris, setBaris] = useState<Baris[]>(() => rencanaAwal(platform));

  /**
   * Cermin keadaan terkini, untuk dibaca pemicu gulir.
   *
   * Pemicunya dapat menyala dua kali sebelum gambar berikutnya sempat dibuat.
   * Yang membaca keadaan dari `baris` akan mengira barisnya belum sibuk pada
   * nyala kedua, lalu meminta potongan yang sama dua kali — dan potongan
   * kembar itu tersaring di layar, tetapi tetap terkirim ke hulu.
   */
  const cermin = useRef(baris);
  useEffect(() => {
    cermin.current = baris;
  }, [baris]);

  /**
   * Potongan PERTAMA sebuah baris — saat menu dibuka, dan saat pengunjung
   * menekan "Coba lagi" sesudah baris itu gagal.
   *
   * Dipisahkan justru untuk yang kedua. Sebelum ini, baris yang gagal pada
   * pemuatan pertama adalah jalan buntu: tidak ada satu pun tombol yang dapat
   * ditekan, dan satu-satunya jalan keluarnya memuat ulang seluruh halaman.
   * Padahal kegagalan yang paling sering terjadi di sini justru yang paling
   * sebentar umurnya — sedetik kemudian hulu sudah menjawab lagi.
   */
  const jalankanPertama = useCallback(
    (aksi: Aksi, tanda?: AbortSignal) => {
      minta(platform.id, aksi, {}, tanda)
        .then((jawab) => {
          setBaris((sebelum) =>
            sebelum.map((satu) => {
              if (satu.aksi !== aksi) return satu;
              const sesudah = sesudahPotongan([], jawab);
              return {
                ...satu,
                ...sesudah,
                kursor: jawab.kursor ?? "",
                potong: 1,
                sibuk: false,
                galat: "",
                basi: Boolean(jawab.basi),
                usia: jawab.usia ?? 0,
              };
            }),
          );
        })
        .catch((alasan: unknown) => {
          if (tanda?.aborted) return;
          setBaris((sebelum) =>
            sebelum.map((satu) =>
              satu.aksi === aksi
                ? { ...satu, sibuk: false, galat: alasan instanceof Error ? alasan.message : "Gagal dimuat." }
                : satu,
            ),
          );
        });
    },
    [platform],
  );

  useEffect(() => {
    const kendali = new AbortController();

    // Seluruh baris diminta bersamaan. Berurutan akan membuat baris ketiga
    // menunggu baris pertama yang kebetulan lambat, padahal keduanya tidak
    // saling bergantung sama sekali.
    //
    // Yang dipanggil di sini `jalankanPertama`, bukan `muatPertama`: baris
    // yang baru dipasang SUDAH bersih dan sudah bertanda sibuk (lihat
    // rencanaAwal), jadi menyetelnya ulang di dalam effect hanya menambah satu
    // penggambaran yang tidak mengubah apa pun.
    for (const item of barisDaftar(platform)) jalankanPertama(item.aksi, kendali.signal);

    return () => kendali.abort();
  }, [platform, jalankanPertama]);

  /** Potongan pertama atas permintaan pengunjung: bersihkan dulu, lalu minta. */
  const muatPertama = useCallback(
    (aksi: Aksi) => {
      cermin.current = cermin.current.map((item) =>
        item.aksi === aksi ? { ...item, sibuk: true, galat: "" } : item,
      );
      setBaris((sebelum) =>
        sebelum.map((item) => (item.aksi === aksi ? { ...item, sibuk: true, galat: "" } : item)),
      );
      jalankanPertama(aksi);
    },
    [jalankanPertama],
  );

  const muatLagi = useCallback(
    (aksi: Aksi) => {
      const cara = penomoran(platform, aksi);
      if (!cara) return;

      const sekarang = cermin.current.find((item) => item.aksi === aksi);
      if (!sekarang || sekarang.sibuk || sekarang.habis) return;

      const berikut = gulirBerikut(cara, sekarang);
      if (!berikut) {
        setBaris((sebelum) => sebelum.map((item) => (item.aksi === aksi ? { ...item, habis: true } : item)));
        return;
      }

      // Cerminnya ditandai sibuk sekarang juga, bukan menunggu gambar
      // berikutnya. Itulah yang menahan nyala kedua pemicu.
      cermin.current = cermin.current.map((item) => (item.aksi === aksi ? { ...item, sibuk: true } : item));
      setBaris((sebelum) =>
        sebelum.map((item) => (item.aksi === aksi ? { ...item, sibuk: true, galat: "" } : item)),
      );

      minta(platform.id, aksi, { halaman: berikut })
        .then((jawab) => {
          setBaris((sebelum) =>
            sebelum.map((item) => {
              if (item.aksi !== aksi) return item;
              const sesudah = sesudahPotongan(item.isi, jawab);
              return {
                ...item,
                ...sesudah,
                kursor: jawab.kursor ?? "",
                potong: item.potong + 1,
                sibuk: false,
                basi: item.basi || Boolean(jawab.basi),
                usia: jawab.basi ? (jawab.usia ?? 0) : item.usia,
              };
            }),
          );
        })
        .catch((alasan: unknown) => {
          setBaris((sebelum) =>
            sebelum.map((item) =>
              item.aksi === aksi
                ? { ...item, sibuk: false, galat: alasan instanceof Error ? alasan.message : "Gagal dimuat." }
                : item,
            ),
          );
        });
    },
    [platform],
  );

  return (
    <>
      {baris.map((item) => (
        <BarisKartu key={item.aksi} baris={item} buka={buka} lagi={muatLagi} ulang={muatPertama} />
      ))}
    </>
  );
}

// ============================================================
// HASIL PENCARIAN
//
// Kuncinya berisi platform DAN kata yang dicari, jadi kata baru berarti
// layar hasil yang baru — tanpa satu pun sisa halaman pencarian sebelumnya.
// ============================================================

function HasilCari({
  platform, kata, buka, tutup,
}: {
  platform: Platform;
  kata: string;
  buka: (kartu: Kartu) => void;
  tutup: () => void;
}) {
  const [isi, setIsi] = useState<Kartu[] | null>(null);
  const [sibuk, setSibuk] = useState(true);
  const [galat, setGalat] = useState("");
  const [halaman, setHalaman] = useState<Gulir>({ kursor: "", potong: 0, habis: true });

  const cermin = useRef({ sibuk, halaman, isi });
  useEffect(() => {
    cermin.current = { sibuk, halaman, isi };
  }, [sibuk, halaman, isi]);

  const jalankanCari = useCallback(
    (tanda?: AbortSignal) => {
      minta(platform.id, "cari", { cari: kata }, tanda)
        .then((jawab) => {
          const sesudah = sesudahPotongan([], jawab);
          setIsi(sesudah.isi);
          setHalaman({
            kursor: jawab.kursor ?? "",
            potong: 1,
            // Pencarian yang memang tidak berhalaman selesai pada potongan
            // pertamanya. Menyatakannya begitu sekarang juga membuat pemicunya
            // tidak pernah digambar — dan pemicu yang digambar untuk daftar yang
            // tidak dapat bertambah adalah pemicu yang menyala tanpa hasil.
            habis: sesudah.habis || !penomoran(platform, "cari"),
          });
        })
        .catch((alasan: unknown) => {
          if (tanda?.aborted) return;
          // Kegagalan TIDAK LAGI dipulangkan sebagai daftar kosong. Sebelum
          // ini, pencarian yang gagal karena hulu sedang mati terbaca di layar
          // sebagai "tidak ada judul yang cocok" — kalimat yang salah, dan
          // salah dengan cara yang paling menyesatkan: pengunjung menyimpulkan
          // judul yang dicarinya tidak ada, lalu berhenti mencari.
          setGalat(alasan instanceof Error ? alasan.message : "Pencarian gagal dimuat.");
        })
        .finally(() => {
          if (!tanda?.aborted) setSibuk(false);
        });
    },
    [platform, kata],
  );

  useEffect(() => {
    const kendali = new AbortController();
    // Layar hasil dipasang dengan kunci berisi kata yang dicari, jadi yang
    // baru terpasang selalu sudah bersih: tidak ada yang perlu disetel ulang
    // sebelum permintaannya dikirim.
    jalankanCari(kendali.signal);
    return () => kendali.abort();
  }, [jalankanCari]);

  /** Pencarian ulang atas permintaan pengunjung. */
  const cariUlang = useCallback(() => {
    setSibuk(true);
    setGalat("");
    jalankanCari();
  }, [jalankanCari]);

  /**
   * Potongan berikutnya dari hasil pencarian.
   *
   * Tidak semua platform melayaninya — ReelShort dan DramaNova saja — dan
   * itulah sebabnya pemicunya dipasang menurut tabel, bukan selalu. Pencarian
   * yang tidak berhalaman tetap menampilkan hasilnya utuh; yang tidak ada
   * cukup tidak digambar.
   */
  const lagi = useCallback(() => {
    const cara = penomoran(platform, "cari");
    const kini = cermin.current;
    if (!cara || kini.sibuk || kini.halaman.habis) return;

    const berikut = gulirBerikut(cara, kini.halaman);
    if (!berikut) {
      setHalaman((sebelum) => ({ ...sebelum, habis: true }));
      return;
    }

    cermin.current = { ...kini, sibuk: true };
    setSibuk(true);

    minta(platform.id, "cari", { cari: kata, halaman: berikut })
      .then((jawab) => {
        const sesudah = sesudahPotongan(kini.isi ?? [], jawab);
        setIsi(sesudah.isi);
        setHalaman((lalu) => ({ kursor: jawab.kursor ?? "", potong: lalu.potong + 1, habis: sesudah.habis }));
      })
      .catch(() => setHalaman((sebelum) => ({ ...sebelum, habis: true })))
      .finally(() => setSibuk(false));
  }, [platform, kata]);

  return (
    <section className="dr-baris">
      <div className="dr-baris-kepala">
        <h2>Hasil pencarian “{kata}”</h2>
        <button type="button" className="dr-link" onClick={tutup}>Kembali ke daftar</button>
      </div>

      {galat && !sibuk ? (
        <>
          <p className="dr-galat" role="alert">{galat}</p>
          <div className="dr-tambah">
            <button type="button" className="dr-mini" onClick={cariUlang}>Coba lagi</button>
          </div>
        </>
      ) : isi === null || (sibuk && !isi?.length) ? (
        <div className="dr-grid">
          {Array.from({ length: 6 }, (_, nomor) => <span key={nomor} className="dr-kartu dr-rangka" />)}
        </div>
      ) : isi.length ? (
        <>
          <div className="dr-grid">
            {isi.map((kartu) => <KartuJudul key={kartu.id} kartu={kartu} buka={buka} />)}
          </div>
          {/* Hasil pencarian yang sudah habis tidak perlu diumumkan: yang
              dicari pengunjung satu judul, bukan panjang daftarnya. Yang
              digambar hanya pemicunya, dan hanya bila memang masih ada. */}
          {!halaman.habis && (
            <KakiDaftar sibuk={sibuk} habis={false} galat="" adaIsi gulirSendiri lagi={lagi} />
          )}
        </>
      ) : (
        <p className="dr-kosong">Tidak ada judul yang cocok di platform ini. Coba platform lain di atas.</p>
      )}
    </section>
  );
}

export default function DramaApp() {
  const [platform, setPlatform] = useState<Platform>(PLATFORM_TERBUKA[0]);
  const [kata, setKata] = useState("");
  const [cari, setCari] = useState("");
  const [terpilih, setTerpilih] = useState<Kartu | null>(null);

  // Diketik huruf demi huruf, tetapi tidak dicari huruf demi huruf: tiap
  // ketikan yang langsung dikirim berarti sepuluh permintaan untuk satu kata.
  useEffect(() => {
    const isi = kata.trim();
    if (!isi) return;
    const jeda = window.setTimeout(() => setCari(isi), 450);
    return () => window.clearTimeout(jeda);
  }, [kata]);

  /**
   * Satu pintu untuk setiap perubahan isi kotak cari.
   *
   * Pengosongannya dikerjakan di sini, seketika, bukan ditunggu jeda 450
   * milidetik: menghapus kata pencarian adalah permintaan untuk kembali ke
   * daftar, dan permintaan itu tidak perlu menunggu apa pun.
   */
  const ketik = useCallback((nilai: string) => {
    setKata(nilai);
    if (!nilai.trim()) setCari("");
  }, []);

  return (
    <div className="dr">
      <header className="dr-atas">
        <div className="dr-atas-in">
          <div className="dr-merek">
            <span className="dr-merek-ic" aria-hidden="true">▶</span>
            <span>
              <b>Nonton Drama</b>
              <small>Bonus pemegang kode Cakrawala</small>
            </span>
          </div>

          <label className="dr-cari">
            <span className="dr-cari-ic" aria-hidden="true">⌕</span>
            <input
              type="search"
              value={kata}
              onChange={(peristiwa) => ketik(peristiwa.target.value)}
              placeholder={`Cari judul di ${platform.nama}…`}
              aria-label="Cari judul drama"
            />
            {kata && (
              <button type="button" className="dr-cari-hapus" onClick={() => ketik("")} aria-label="Hapus pencarian">
                ×
              </button>
            )}
          </label>
        </div>

        <nav className="dr-platform" aria-label="Pilih sumber">
          {PLATFORM_TERBUKA.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`dr-plat ${item.id === platform.id ? "on" : ""}`}
              aria-current={item.id === platform.id ? "true" : undefined}
              onClick={() => {
                setPlatform(item);
                setTerpilih(null);
                ketik("");
              }}
              title={item.catatan}
            >
              <span className="dr-plat-ic" style={{ background: item.warna }}>{item.inisial}</span>
              {item.nama}
            </button>
          ))}
        </nav>
      </header>

      <main className="dr-isi">
        {platform.catatan && (
          <p className="dr-catatan" role="note">{platform.catatan}</p>
        )}

        {cari ? (
          <HasilCari
            key={`${platform.id}:${cari}`}
            platform={platform}
            kata={cari}
            buka={setTerpilih}
            tutup={() => ketik("")}
          />
        ) : (
          <DaftarBaris key={platform.id} platform={platform} buka={setTerpilih} />
        )}
      </main>

      {terpilih && (
        // Kunci berisi platform dan judulnya, jadi memilih judul lain
        // memasang layar yang benar-benar baru. Itu lebih murah daripada
        // menyetel ulang setengah lusin keadaan dengan tangan — dan tidak
        // pernah menyisakan episode judul sebelumnya yang masih menempel.
        <LayarJudul
          key={`${platform.id}:${terpilih.id}`}
          platform={platform}
          kartu={terpilih}
          tutup={() => setTerpilih(null)}
        />
      )}

      <footer className="dr-kaki">
        <strong>SiPaling FISIP</strong>
        <span>
          Daftar judul dan videonya berasal dari API terbuka proyek{" "}
          <a href="https://github.com/Sansekai/SekaiDrama" target="_blank" rel="noreferrer noopener">SekaiDrama</a>.
          Situs ini tidak menyimpan satu pun berkas video.
        </span>
      </footer>
    </div>
  );
}

// ============================================================
// BARIS KARTU
// ============================================================

/**
 * Pemicu gulir tak berhingga.
 *
 * Sepetak kosong di bawah daftarnya. Begitu petak itu masuk layar,
 * potongan berikutnya diminta — jadi yang menentukan bukan tombol yang harus
 * ditekan, melainkan seberapa jauh pengunjung sudah menggulir.
 *
 * `rootMargin` memajukan garis pemicunya setinggi setengah layar ke bawah,
 * sehingga potongan berikutnya sudah dalam perjalanan sebelum dasar daftarnya
 * benar-benar terlihat. Tanpa itu, tiap potongan berarti satu jeda kosong
 * yang dilihat pengunjung — dan jeda itulah yang membuat gulir tak berhingga
 * terasa lebih lambat daripada tombol.
 */
function PemicuGulir({ aktif, onDekat }: { aktif: boolean; onDekat: () => void }) {
  const petak = useRef<HTMLDivElement | null>(null);

  // Disimpan di ref supaya pengamatnya tidak dibongkar-pasang tiap kali
  // fungsinya dibuat ulang — dan pembongkaran itulah yang pada sebagian
  // peramban memicu satu permintaan tambahan tiap gambar.
  const simpan = useRef(onDekat);
  // Disegarkan sesudah tiap gambar, bukan saat menggambar: menulis ref di
  // tengah penggambaran adalah tulisan yang dapat terjadi dua kali untuk satu
  // gambar. Effect ini ditulis DI ATAS effect pengamatnya, jadi ia sudah
  // berjalan sebelum pengamatnya mungkin menyala.
  useEffect(() => {
    simpan.current = onDekat;
  });

  useEffect(() => {
    const sasaran = petak.current;
    if (!sasaran || !aktif) return;

    // Peramban yang belum mengenal IntersectionObserver tetap kebagian isi
    // potongan pertama; yang hilang hanya penambahan otomatisnya, dan tombol
    // di bawahnya tetap ada untuk itu.
    if (typeof IntersectionObserver === "undefined") return;

    const pengamat = new IntersectionObserver(
      (masuk) => {
        if (masuk.some((satu) => satu.isIntersecting)) simpan.current();
      },
      { rootMargin: "0px 0px 50% 0px", threshold: 0 },
    );
    pengamat.observe(sasaran);
    return () => pengamat.disconnect();
  }, [aktif]);

  return <div ref={petak} className="dr-pemicu" aria-hidden="true" />;
}

/**
 * Kaki sebuah daftar yang dapat bertambah: pemicu, tanda memuat, dan akhirnya.
 *
 * Ketiganya satu tempat karena ketiganya menjawab satu pertanyaan pengunjung —
 * "masih ada lagi tidak?" — dan jawaban yang terpencar membuat daftar yang
 * sudah habis tampak seperti daftar yang sedang macet.
 */
function KakiDaftar({
  sibuk, habis, galat, adaIsi, gulirSendiri, lagi,
}: {
  sibuk: boolean;
  habis: boolean;
  galat: string;
  adaIsi: boolean;
  gulirSendiri: boolean;
  lagi: () => void;
}) {
  if (!adaIsi) return null;

  if (sibuk) {
    return (
      <div className="dr-tambah">
        <span className="dr-tambah-putar" aria-hidden="true" />
        <p className="dr-tambah-teks" role="status">Memuat lebih banyak…</p>
      </div>
    );
  }

  if (galat) {
    return (
      <div className="dr-tambah">
        <p className="dr-galat-kecil">{galat}</p>
        <button type="button" className="dr-mini" onClick={lagi}>Coba lagi</button>
      </div>
    );
  }

  if (habis) {
    return (
      <div className="dr-tambah dr-tambah-habis">
        <p className="dr-tambah-teks">Semua data telah dimuat</p>
      </div>
    );
  }

  return (
    <>
      <PemicuGulir aktif={gulirSendiri} onDekat={lagi} />
      <div className="dr-tambah">
        {/* Tombolnya tetap ada di belakang pemicu, dan bukan sebagai hiasan:
            ia yang melayani peramban tanpa IntersectionObserver, dan ia pula
            yang dipakai pembaca layar — yang tidak pernah "menggulir sampai
            dasar" sebagaimana pemicunya mengandaikan. */}
        <button type="button" className="dr-mini" onClick={lagi}>Muat lebih banyak</button>
      </div>
    </>
  );
}

function BarisKartu({
  baris, buka, lagi, ulang,
}: {
  baris: Baris;
  buka: (kartu: Kartu) => void;
  lagi: (aksi: Aksi) => void;
  ulang: (aksi: Aksi) => void;
}) {
  const [semua, setSemua] = useState(false);
  const muatBaris = useCallback(() => lagi(baris.aksi), [lagi, baris.aksi]);
  const muatUlang = useCallback(() => ulang(baris.aksi), [ulang, baris.aksi]);

  // Baris yang menarik sendiri tidak pernah diringkas: meringkasnya berarti
  // memindahkan dasar daftarnya ke atas layar, dan pemicunya akan langsung
  // meminta potongan berikutnya untuk isi yang barusan disembunyikan.
  const utuh = baris.gulirSendiri || semua;
  const tampil = utuh ? baris.isi : baris.isi.slice(0, SEPOTONG);

  if (!baris.sibuk && !baris.isi.length && baris.galat) {
    return (
      <section className="dr-baris">
        <h2>{baris.judul}</h2>
        <p className="dr-galat" role="alert">{baris.galat}</p>
        {/* Tombolnya bukan hiasan: kegagalan yang paling sering terjadi di
            sini adalah kegagalan yang paling sebentar umurnya, dan tanpa
            tombol ini satu-satunya jalan keluarnya memuat ulang halaman. */}
        <div className="dr-tambah">
          <button type="button" className="dr-mini" onClick={muatUlang}>Coba lagi</button>
        </div>
      </section>
    );
  }

  return (
    <section className="dr-baris">
      <div className="dr-baris-kepala">
        <h2>{baris.judul}</h2>
        {!baris.gulirSendiri && baris.isi.length > SEPOTONG && (
          <button type="button" className="dr-link" onClick={() => setSemua((nilai) => !nilai)}>
            {semua ? "Ringkas" : `Lihat semua (${baris.isi.length})`}
          </button>
        )}
      </div>

      {/* Isi dari simpanan diberi tahu, bukan disembunyikan. Daftar yang
          tertinggal beberapa judul tetap berguna; yang tidak berguna adalah
          pengunjung yang mengira daftarnya mutakhir padahal tidak. */}
      {baris.basi && (
        <p className="dr-catatan" role="status">
          Sumber dramanya sedang tidak menjawab. Yang ditampilkan simpanan terakhir,
          diambil {usiaTerbaca(baris.usia)}.{" "}
          <button type="button" className="dr-link" onClick={muatUlang}>Muat ulang</button>
        </p>
      )}

      <div className="dr-grid">
        {tampil.map((kartu) => (
          <KartuJudul key={kartu.id} kartu={kartu} buka={buka} />
        ))}
        {baris.sibuk && !baris.isi.length &&
          Array.from({ length: 6 }, (_, nomor) => <span key={nomor} className="dr-kartu dr-rangka" />)}
      </div>

      {utuh && (
        <KakiDaftar
          sibuk={baris.sibuk}
          habis={baris.habis || !baris.bisaTambah}
          galat={baris.galat}
          adaIsi={baris.isi.length > 0}
          gulirSendiri={baris.gulirSendiri}
          lagi={muatBaris}
        />
      )}
    </section>
  );
}

function KartuJudul({ kartu, buka }: { kartu: Kartu; buka: (kartu: Kartu) => void }) {
  return (
    <button type="button" className="dr-kartu" onClick={() => buka(kartu)}>
      <span className="dr-kartu-gambar">
        {kartu.sampul ? (
          // eslint-disable-next-line @next/next/no-img-element -- sampul berasal dari CDN pihak ketiga yang berubah-ubah; next/image menuntut daftar host tetap
          <img src={kartu.sampul} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="dr-kartu-kosong" aria-hidden="true">▶</span>
        )}
        {kartu.episode > 0 && <span className="dr-kartu-eps">{kartu.episode} eps</span>}
      </span>
      <span className="dr-kartu-judul">{kartu.judul}</span>
    </button>
  );
}

// ============================================================
// LAYAR SATU JUDUL
// ============================================================

function LayarJudul({ platform, kartu, tutup }: { platform: Platform; kartu: Kartu; tutup: () => void }) {
  const [rinci, setRinci] = useState<Rinci | null>(null);
  const [galat, setGalat] = useState("");
  const [nomor, setNomor] = useState(0);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [sibukEpisode, setSibukEpisode] = useState(false);
  const [galatEpisode, setGalatEpisode] = useState("");

  /** Episode yang sudah terlanjur diambil sekaligus, untuk platform "semua". */
  const borongan = useRef<Episode[] | null>(null);

  const jalankanRinci = useCallback(
    (tanda?: AbortSignal) => {
    minta(platform.id, "rinci", { id: kartu.id }, tanda)
      .then((jawab) => {
        if (!jawab.rinci) throw new Error("Rincian judul ini tidak terbaca.");
        // Yang dikirim hulu kerap lebih miskin daripada kartunya sendiri —
        // tanpa sampul, tanpa jumlah episode. Yang sudah diketahui dari kartu
        // dipakai sebagai cadangan, supaya layarnya tidak mundur.
        setRinci({
          ...jawab.rinci,
          judul: jawab.rinci.judul || kartu.judul,
          sampul: jawab.rinci.sampul || kartu.sampul,
          ringkasan: jawab.rinci.ringkasan || kartu.ringkasan,
          episode: Math.max(jawab.rinci.episode, kartu.episode),
          label: jawab.rinci.label.length ? jawab.rinci.label : kartu.label,
        });
      })
      .catch((alasan: unknown) => {
        if (!tanda?.aborted) {
          setGalat(alasan instanceof Error ? alasan.message : "Rincian judul ini gagal dimuat.");
        }
      });
    },
    [platform.id, kartu],
  );

  useEffect(() => {
    const kendali = new AbortController();
    // Layar judul dipasang dengan kunci berisi platform dan id judulnya, jadi
    // yang baru terpasang selalu sudah bersih — tidak ada galat lama yang
    // perlu dihapus sebelum permintaannya dikirim.
    jalankanRinci(kendali.signal);
    return () => kendali.abort();
  }, [jalankanRinci]);

  /** Memuat ulang rincian atas permintaan pengunjung. */
  const muatRinci = useCallback(() => {
    setGalat("");
    jalankanRinci();
  }, [jalankanRinci]);

  const jumlah = rinci ? Math.max(rinci.episode, rinci.daftar.length) : kartu.episode;

  const putar = useCallback(
    async (pilihan: number) => {
      if (!rinci) return;
      setNomor(pilihan);
      setEpisode(null);
      setGalatEpisode("");

      // Episode yang tautannya sudah ikut di jawaban rinci tidak perlu
      // diminta lagi. Itu bukan penghematan kecil: di FreeReels seluruh
      // episodenya memang datang sekaligus di sana.
      const dariRinci = rinci.daftar.find((item) => item.nomor === pilihan);
      if (dariRinci?.aliran.length) {
        setEpisode(dariRinci);
        return;
      }

      setSibukEpisode(true);
      try {
        if (platform.caraEpisode === "semua") {
          if (!borongan.current) {
            const jawab = await minta(platform.id, "episode", { id: rinci.id || kartu.id });
            // Diambil sekali, lalu diingat: satu judul DramaBox dapat berisi
            // delapan puluh episode, dan memintanya ulang tiap kali pengunjung
            // menekan nomor berikutnya adalah delapan puluh permintaan untuk
            // satu jawaban yang sama.
            borongan.current = jawab.daftarEpisode ?? (jawab.episode ? [jawab.episode] : []);
          }
          const ketemu =
            borongan.current.find((item) => item.nomor === pilihan) ?? borongan.current[pilihan - 1] ?? null;
          if (!ketemu) throw new Error("Episode ini tidak ada di sumbernya.");
          setEpisode(ketemu);
        } else if (platform.caraEpisode === "id-episode") {
          const acuan = rinci.daftar.find((item) => item.nomor === pilihan);
          if (!acuan?.id) throw new Error("Episode ini belum punya penanda di sumbernya.");
          const jawab = await minta(platform.id, "episode", { id: acuan.id });
          setEpisode(jawab.episode ?? { ...acuan, aliran: [] });
        } else if (platform.caraEpisode === "dalam-rinci") {
          throw new Error("Episode ini tidak menyertakan tautan video.");
        } else {
          const jawab = await minta(platform.id, "episode", { id: rinci.id || kartu.id, episode: pilihan });
          setEpisode(jawab.episode ?? null);
        }
      } catch (alasan: unknown) {
        setGalatEpisode(alasan instanceof Error ? alasan.message : "Episode ini gagal dimuat.");
      } finally {
        setSibukEpisode(false);
      }
    },
    [platform, rinci, kartu.id],
  );

  const daftarNomor = useMemo(() => {
    if (jumlah > 0) return Array.from({ length: Math.min(jumlah, 400) }, (_, urutan) => urutan + 1);
    return rinci?.daftar.map((item) => item.nomor) ?? [];
  }, [jumlah, rinci]);

  return (
    <div className="dr-layar" role="dialog" aria-modal="true" aria-label={kartu.judul}>
      <div className="dr-layar-in">
        <button type="button" className="dr-tutup" onClick={tutup} aria-label="Tutup">×</button>

        {nomor > 0 && (
          <div className="dr-tonton">
            <div className="dr-tonton-kepala">
              <b>{rinci?.judul || kartu.judul}</b>
              <span>Episode {nomor}</span>
            </div>

            {sibukEpisode && <p className="dr-kosong">Menyiapkan episode…</p>}
            {galatEpisode && !sibukEpisode && (
              <>
                <p className="dr-galat" role="alert">{galatEpisode}</p>
                <div className="dr-tambah">
                  {/* Episode yang gagal disiapkan hampir selalu gagal karena
                      hulu tersendat sesaat. Sebelum ini, satu-satunya jalan
                      mencobanya lagi adalah menekan nomor episode LAIN lalu
                      kembali — dan itu tidak pernah terpikir oleh siapa pun. */}
                  <button type="button" className="dr-mini" onClick={() => void putar(nomor)}>
                    Coba lagi
                  </button>
                </div>
              </>
            )}
            {episode && !sibukEpisode && (
              <Pemutar
                aliran={episode.aliran}
                platform={platform.id}
                onSelesai={() => {
                  if (nomor < jumlah) void putar(nomor + 1);
                }}
              />
            )}

            <div className="dr-tonton-aksi">
              <button type="button" className="dr-mini" disabled={nomor <= 1} onClick={() => void putar(nomor - 1)}>
                ← Sebelumnya
              </button>
              <button
                type="button"
                className="dr-mini"
                disabled={jumlah > 0 && nomor >= jumlah}
                onClick={() => void putar(nomor + 1)}
              >
                Berikutnya →
              </button>
            </div>
          </div>
        )}

        <div className="dr-judul">
          <span className="dr-judul-gambar">
            {(rinci?.sampul || kartu.sampul) ? (
              // eslint-disable-next-line @next/next/no-img-element -- lihat alasan di KartuJudul
              <img src={rinci?.sampul || kartu.sampul} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="dr-kartu-kosong" aria-hidden="true">▶</span>
            )}
          </span>
          <div className="dr-judul-teks">
            <h2>{rinci?.judul || kartu.judul}</h2>
            <p className="dr-judul-tanda">
              <span className="dr-plat-ic dr-plat-ic-kecil" style={{ background: platform.warna }}>
                {platform.inisial}
              </span>
              {platform.nama}
              {jumlah > 0 && <> · {jumlah} episode</>}
            </p>
            {(rinci?.label.length ?? 0) > 0 && (
              <p className="dr-label">{rinci!.label.map((satu) => <span key={satu}>{satu}</span>)}</p>
            )}
            <p className="dr-ringkas">{rinci?.ringkasan || kartu.ringkasan || "Tidak ada ringkasan dari sumbernya."}</p>
          </div>
        </div>

        {galat && (
          <>
            <p className="dr-galat" role="alert">{galat}</p>
            <div className="dr-tambah">
              <button type="button" className="dr-mini" onClick={muatRinci}>Coba lagi</button>
            </div>
          </>
        )}

        {!rinci && !galat && <p className="dr-kosong">Memuat rincian…</p>}

        {rinci && (
          <div className="dr-eps">
            <h3>Pilih episode</h3>
            {daftarNomor.length ? (
              <div className="dr-eps-grid">
                {daftarNomor.map((satu) => (
                  <button
                    key={satu}
                    type="button"
                    className={`dr-eps-btn ${satu === nomor ? "on" : ""}`}
                    onClick={() => void putar(satu)}
                  >
                    {satu}
                  </button>
                ))}
              </div>
            ) : (
              <p className="dr-kosong">Sumbernya tidak menyebutkan daftar episode judul ini.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
