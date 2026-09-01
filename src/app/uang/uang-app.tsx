"use client";

// ============================================================
// CATATAN UANG - layar
//
// Satu kotak tulis, dan semua yang lain mengikuti. Yang diketik dibaca oleh
// pengurai yang SAMA dengan yang dipakai server (src/lib/uang/urai-pesan.ts),
// jadi pratinjau di bawah kotak tulis bukan tebakan terpisah: ia hasil yang
// benar-benar akan tersimpan.
// ============================================================

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { KATEGORI, kategoriDari } from "@/lib/uang/kategori";
import { bulanWib, uraiBanyak } from "@/lib/uang/urai-pesan";
import { geserBulan, labelBulan, labelHari, rupiah, rupiahRingkas } from "@/lib/uang/format";

const KUNCI_SIMPAN = "sipaling_uang_kode";

// ============================================================
// SIMPANAN KODE BUKU
//
// Kode buku tinggal di perangkat, bukan di server, jadi ia sumber data di
// luar React dan dibaca lewat useSyncExternalStore. Cara ini juga yang
// membuat dua tab pada satu peramban ikut berpindah buku bersama-sama.
//
// Nilai "?" berarti "belum tahu": itulah yang dilihat server dan render
// pertama peramban, supaya tidak ada kedipan halaman perkenalan bagi orang
// yang sebenarnya sudah punya buku.
// ============================================================

const BELUM_TAHU = "?";
const pendengarKode = new Set<() => void>();

// Cadangan untuk peramban yang menolak localStorage (mode penyamaran, atau
// setelan yang mematikan penyimpanan situs). Bukunya tetap dapat dipakai,
// hanya saja kodenya perlu dimasukkan lagi setelah halaman ditutup.
let kodeSesi: string | null = null;

function langgananKode(dengar: () => void) {
  pendengarKode.add(dengar);
  window.addEventListener("storage", dengar);
  return () => {
    pendengarKode.delete(dengar);
    window.removeEventListener("storage", dengar);
  };
}

function bacaKode() {
  if (kodeSesi) return kodeSesi;
  try {
    return localStorage.getItem(KUNCI_SIMPAN) || "";
  } catch {
    return "";
  }
}

const bacaKodeServer = () => BELUM_TAHU;

function tulisKode(nilai: string | null) {
  kodeSesi = nilai;
  try {
    if (nilai) localStorage.setItem(KUNCI_SIMPAN, nilai);
    else localStorage.removeItem(KUNCI_SIMPAN);
  } catch {
    // Tidak apa-apa: kodenya tetap berlaku selama halaman ini terbuka.
  }
  for (const dengar of pendengarKode) dengar();
}

type BarisApi = {
  id: number;
  arah: "masuk" | "keluar";
  nominal: number;
  catatan: string;
  kategori: string;
  tanggal: string;
  sumber: string;
};

type RingkasKategoriApi = {
  kategori: string;
  nama: string;
  warna: string;
  ikon: string;
  jumlah: number;
  nilai: number;
};

type DataApi = {
  buku: { kode: string; nama: string };
  bulan: string;
  hariIni: string;
  baris: BarisApi[];
  ringkasan: {
    masuk: number;
    keluar: number;
    sisa: number;
    jumlahBaris: number;
    perKategori: { masuk: RingkasKategoriApi[]; keluar: RingkasKategoriApi[] };
  };
  tren: { bulan: string; masuk: number; keluar: number }[];
};

// ============================================================
// ANTREAN LURING
//
// Orang mencatat uang justru di tempat sinyalnya paling buruk: di dalam
// pasar, di parkiran, di antrean kasir. Catatan yang gagal terkirim TIDAK
// boleh hilang dan tidak boleh membuat pemiliknya mengetik ulang; ia
// disimpan di perangkat dan dikirim sendiri begitu jaringannya kembali.
// ============================================================

const KUNCI_ANTREAN = "sipaling_uang_antrean";
const pendengarAntrean = new Set<() => void>();
let antreanSesi = "[]";

type Antre = { id: string; pesan: string; waktu: number };

function langgananAntrean(dengar: () => void) {
  pendengarAntrean.add(dengar);
  window.addEventListener("storage", dengar);
  return () => {
    pendengarAntrean.delete(dengar);
    window.removeEventListener("storage", dengar);
  };
}

function bacaAntreanMentah() {
  try {
    return localStorage.getItem(KUNCI_ANTREAN) || "[]";
  } catch {
    return antreanSesi;
  }
}

const bacaAntreanServer = () => "[]";

function tulisAntrean(daftar: Antre[]) {
  const teks = JSON.stringify(daftar.slice(-200));
  antreanSesi = teks;
  try {
    localStorage.setItem(KUNCI_ANTREAN, teks);
  } catch {
    // Antreannya tetap hidup selama halaman ini terbuka.
  }
  for (const dengar of pendengarAntrean) dengar();
}

function uraiAntrean(teks: string): Antre[] {
  try {
    const isi = JSON.parse(teks);
    if (!Array.isArray(isi)) return [];
    return isi.filter((a) => a && typeof a.pesan === "string");
  } catch {
    return [];
  }
}

type HasilKirim = {
  ok: boolean;
  /** Gagal karena jaringan, bukan karena ditolak server. */
  luring?: boolean;
  isi?: {
    tersimpan?: { arah: string; nominal: number; catatan: string; namaKategori: string; tanggal: string; pesan?: string[] }[];
    gagal?: { baris: string; alasan: string }[];
  };
  galat?: string;
};

/** Mengirim satu pesan. Tidak menyentuh state, jadi aman dipanggil dari mana pun. */
async function kirimPesan(kode: string, pesan: string): Promise<HasilKirim> {
  try {
    const jawab = await fetch("/api/uang/catat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kode, pesan }),
    });
    const isi = await jawab.json().catch(() => null);
    if (!jawab.ok) return { ok: false, galat: isi?.message || "Catatan gagal disimpan." };
    return { ok: true, isi };
  } catch {
    return {
      ok: false,
      luring: true,
      galat: "Belum ada sinyal. Catatannya diantre dan dikirim sendiri begitu tersambung.",
    };
  }
}

/**
 * Meminta buku milik langganan Cakrawala.
 *
 * Dipakai panel di dalam Cakrawala supaya pelanggannya tidak perlu mengurus
 * kode buku sama sekali: ia membuka menunya, bukunya sudah ada.
 */
async function ambilBukuCakrawala(): Promise<{ kode?: string; galat?: string }> {
  try {
    const jawab = await fetch("/api/uang/buku/cakrawala", { method: "POST" });
    const isi = await jawab.json().catch(() => null);
    if (jawab.ok && isi?.success && isi?.buku?.kode) return { kode: String(isi.buku.kode) };
    return { galat: isi?.message || "Buku belum dapat disiapkan." };
  } catch {
    return { galat: "Tidak dapat menghubungi server." };
  }
}

/** Peristiwa pemasangan aplikasi, yang belum ada di pustaka tipe peramban. */
type PeristiwaPasang = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

// Nomor bot diisi lewat environment saat build. Kosong berarti tombolnya
// diganti keterangan cara memasangnya, bukan tombol yang tidak menuju ke mana
// pun.
const NOMOR_WA = (process.env.NEXT_PUBLIC_UANG_WA || "").replace(/\D/g, "");
const BOT_TELEGRAM = (process.env.NEXT_PUBLIC_UANG_TELEGRAM || "").replace(/^@/, "").trim();

type HasilMuat = { data?: DataApi; galat?: string; kosongkan?: boolean };

/**
 * Mengambil isi satu bulan. Tidak menyentuh state sama sekali, jadi ia aman
 * dipanggil dari mana pun, termasuk dari dalam effect.
 */
async function ambilCatatan(kode: string, bulan: string): Promise<HasilMuat> {
  try {
    const jawab = await fetch(
      `/api/uang/catatan?kode=${encodeURIComponent(kode)}&bulan=${bulan}`,
      { cache: "no-store" },
    );
    const isi = await jawab.json();
    if (!jawab.ok || !isi?.success) {
      return {
        galat: isi?.message || "Catatan gagal dibaca.",
        // Kode yang ditolak berarti isinya memang bukan milik siapa pun di
        // layar ini; angka bulan lalu tidak boleh tertinggal di sana.
        kosongkan: jawab.status === 401 || jawab.status === 404,
      };
    }
    return { data: isi as DataApi };
  } catch {
    return { galat: "Tidak dapat menghubungi server. Periksa sambungan internet." };
  }
}

/**
 * Pembungkus terluar layar ini.
 *
 * Di halaman /uang ia <main>, karena memang seluruh isi halamannya. Di dalam
 * Cakrawala ia <div>: halaman itu sudah punya <main> sendiri, dan dua <main>
 * bersarang membuat pembaca layar kehilangan penanda isi utama.
 */
function Bingkai({
  dalam,
  kelas,
  children,
}: {
  dalam: boolean;
  kelas: string;
  children: React.ReactNode;
}) {
  if (dalam) return <div className={kelas}>{children}</div>;
  return <main className={kelas}>{children}</main>;
}

const CONTOH = [
  "+honor guru 100k",
  "-beli nasi uduk 10k",
  "kemarin -20k grab ke kampus",
  "-350rb listrik",
];

export default function UangApp({ dalam = false }: { dalam?: boolean }) {
  const kode = useSyncExternalStore(langgananKode, bacaKode, bacaKodeServer);
  const antreanTeks = useSyncExternalStore(langgananAntrean, bacaAntreanMentah, bacaAntreanServer);
  const antrean = useMemo(() => uraiAntrean(antreanTeks), [antreanTeks]);
  const [bulan, setBulan] = useState(() => bulanWib());
  const [data, setData] = useState<DataApi | null>(null);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState<string[]>([]);
  const [galatSiap, setGalatSiap] = useState("");
  const [pasang, setPasang] = useState<PeristiwaPasang | null>(null);

  // Sedang memuat bila yang ada di layar bukan bulan yang diminta. Ia
  // turunan, bukan state tersendiri: satu state yang lupa dimatikan berarti
  // tulisan "memuat" yang menggantung selamanya.
  const memuat = !galat && data?.bulan !== bulan;

  // Pengambilan data dipisah dari penerapannya (lihat ambilCatatan di bawah):
  // yang dipanggil effect hanya pengambilnya, dan state baru disentuh di
  // dalam callback setelah jawabannya datang.
  const terapkan = useCallback((hasil: HasilMuat) => {
    if (hasil.data) {
      setGalat("");
      setData(hasil.data);
      return;
    }
    setGalat(hasil.galat || "Catatan gagal dibaca.");
    if (hasil.kosongkan) setData(null);
  }, []);

  const muat = useCallback(
    async (kodeAktif: string, bulanAktif: string) => {
      terapkan(await ambilCatatan(kodeAktif, bulanAktif));
    },
    [terapkan],
  );

  useEffect(() => {
    if (!kode || kode === BELUM_TAHU) return;
    // Jawaban yang datang setelah bulannya diganti diabaikan, supaya menekan
    // panah bulan berkali-kali tidak pernah berakhir pada bulan yang salah.
    let hidup = true;
    void ambilCatatan(kode, bulan).then((hasil) => {
      if (hidup) terapkan(hasil);
    });
    return () => {
      hidup = false;
    };
  }, [kode, bulan, terapkan]);

  // Pelanggan Cakrawala tidak pernah melihat gerbang kode: bukunya diminta
  // sendiri begitu panelnya dibuka. Bila gagal (mis. kunci Cakrawala sedang
  // dimatikan sehingga tidak ada yang menandai siapa pengunjungnya), layarnya
  // jatuh kembali ke gerbang biasa beserta alasannya.
  const perluSiapkan = dalam && kode === "";
  useEffect(() => {
    if (!perluSiapkan) return;
    let hidup = true;
    void ambilBukuCakrawala().then((hasil) => {
      if (!hidup) return;
      if (hasil.kode) tulisKode(hasil.kode);
      else setGalatSiap(hasil.galat || "Buku belum dapat disiapkan.");
    });
    return () => {
      hidup = false;
    };
  }, [perluSiapkan]);

  /**
   * Mengirim ulang catatan yang tertahan di antrean.
   *
   * Yang ditolak server (kalimatnya memang tidak terbaca) dibuang, bukan
   * diulang selamanya. Yang gagal karena jaringan tetap di antrean.
   */
  const kirimAntrean = useCallback(async () => {
    if (!kode || kode === BELUM_TAHU) return;
    const daftar = uraiAntrean(bacaAntreanMentah());
    if (daftar.length === 0) return;

    const sisa: Antre[] = [];
    let berhasil = 0;
    for (const satu of daftar) {
      const hasil = await kirimPesan(kode, satu.pesan);
      if (hasil.ok) berhasil += 1;
      else if (hasil.luring) sisa.push(satu);
    }
    tulisAntrean(sisa);
    if (berhasil > 0) terapkan(await ambilCatatan(kode, bulan));
  }, [kode, bulan, terapkan]);

  // Menyegarkan sendiri. Inilah yang membuat catatan yang dikirim lewat
  // WhatsApp muncul di layar ini tanpa disuruh: halaman yang sedang terbuka
  // menanyakan bulannya lagi tiap dua puluh lima detik, dan hanya ketika ia
  // memang sedang dilihat orang.
  useEffect(() => {
    if (!kode || kode === BELUM_TAHU) return;

    const saatOnline = () => {
      void kirimAntrean();
    };
    window.addEventListener("online", saatOnline);

    const jam = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void ambilCatatan(kode, bulan).then(terapkan);
      void kirimAntrean();
    }, 25_000);

    return () => {
      window.removeEventListener("online", saatOnline);
      window.clearInterval(jam);
    };
  }, [kode, bulan, terapkan, kirimAntrean]);

  // Tawaran pemasangan aplikasi. Peramban memunculkannya sekali, dan bila
  // tidak ditangkap di sini tawarannya hilang begitu saja.
  useEffect(() => {
    const tangkap = (peristiwa: Event) => {
      peristiwa.preventDefault();
      setPasang(peristiwa as PeristiwaPasang);
    };
    window.addEventListener("beforeinstallprompt", tangkap);
    return () => window.removeEventListener("beforeinstallprompt", tangkap);
  }, []);

  // Pekerja latar hanya dipasang pada halaman /uang. Di dalam Cakrawala,
  // halamannya bukan milik alat ini dan tidak boleh ikut disimpan.
  useEffect(() => {
    if (dalam || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const daftarkan = () => {
      navigator.serviceWorker.register("/uang-sw.js").catch(() => {
        // Peramban yang menolak pekerja latar (mode penyamaran, setelan
        // perusahaan) tetap dapat memakai halamannya seperti biasa.
      });
    };
    if (document.readyState === "complete") daftarkan();
    else window.addEventListener("load", daftarkan, { once: true });
    return () => window.removeEventListener("load", daftarkan);
  }, [dalam]);

  const simpanKode = useCallback((baru: string) => {
    tulisKode(baru);
    setBulan(bulanWib());
  }, []);

  const keluar = useCallback(() => {
    tulisKode(null);
    setData(null);
    setKabar([]);
  }, []);

  async function kirim(pesan: string) {
    if (!kode) return { ok: false };
    setGalat("");

    const hasil = await kirimPesan(kode, pesan);

    if (!hasil.ok) {
      if (!hasil.luring) {
        setGalat(hasil.galat || "Catatan gagal disimpan.");
        return { ok: false };
      }
      // Jaringannya yang tidak ada, bukan catatannya yang salah. Ia dipegang
      // di perangkat dan kotak tulisnya dikosongkan: menahannya di layar
      // hanya membuat orang mengetik ulang hal yang sudah aman tersimpan.
      const nomor = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      tulisAntrean([...uraiAntrean(bacaAntreanMentah()), { id: nomor, pesan, waktu: Date.now() }]);
      setKabar([hasil.galat || "Catatannya diantre."]);
      return { ok: true };
    }

    const isi = hasil.isi ?? {};
    const tersimpan = isi.tersimpan ?? [];
    const laporan: string[] = [];
    for (const baris of tersimpan) {
      laporan.push(
        `${baris.arah === "masuk" ? "Masuk" : "Keluar"} ${rupiah(baris.nominal)} - ${baris.catatan} (${baris.namaKategori})`,
      );
      for (const tambahan of baris.pesan ?? []) laporan.push(tambahan);
    }
    for (const gagal of isi.gagal ?? []) {
      laporan.push(`Belum tercatat: ${gagal.baris ? `"${gagal.baris}" - ` : ""}${gagal.alasan}`);
    }
    setKabar(laporan);

    if (tersimpan.length > 0) {
      // Bulan catatan bisa berbeda dengan bulan yang sedang dilihat, mis.
      // ketika menulis "27/8" pada awal September. Layar dipindahkan ke
      // bulan itu supaya catatannya benar-benar terlihat, bukan hilang.
      const bulanBaru = String(tersimpan[0].tanggal || "").slice(0, 7);
      if (bulanBaru && bulanBaru !== bulan) setBulan(bulanBaru);
      else await muat(kode, bulan);
    }
    return { ok: tersimpan.length > 0 };
  }

  async function hapus(id: number) {
    if (!kode) return;
    if (!confirm("Hapus catatan ini?")) return;
    try {
      const jawab = await fetch(`/api/uang/catatan?kode=${encodeURIComponent(kode)}&id=${id}`, {
        method: "DELETE",
      });
      const isi = await jawab.json();
      if (!jawab.ok || !isi?.success) {
        setGalat(isi?.message || "Catatan gagal dihapus.");
        return;
      }
      await muat(kode, bulan);
    } catch {
      setGalat("Tidak dapat menghubungi server.");
    }
  }

  const kelas = dalam ? "ug-wrap ug-dalam" : "ug-wrap";

  if (kode === BELUM_TAHU || (perluSiapkan && !galatSiap)) {
    return (
      <Bingkai dalam={dalam} kelas={kelas}>
        <p className="ug-tunggu">Menyiapkan catatan...</p>
      </Bingkai>
    );
  }

  if (!kode) return <Gerbang onMasuk={simpanKode} dalam={dalam} catatan={galatSiap} />;

  return (
    <Bingkai dalam={dalam} kelas={kelas}>
      {pasang ? <TawaranPasang peristiwa={pasang} onTutup={() => setPasang(null)} /> : null}

      <Kepala
        nama={data?.buku.nama ?? "Buku kas"}
        bulan={bulan}
        onBulan={setBulan}
        // Di dalam Cakrawala bukunya melekat pada langganan, bukan pada
        // perangkat. Tombol keluar di sana hanya akan membuang kode lalu
        // memintanya kembali sedetik kemudian.
        onKeluar={dalam ? null : keluar}
        memuat={memuat}
      />

      {galat ? <p className="ug-galat">{galat}</p> : null}

      <Angka ringkasan={data?.ringkasan} />

      {data?.tren?.length ? (
        <Tren titik={data.tren} aktif={bulan} onPilih={setBulan} />
      ) : null}

      <Tulis onKirim={kirim} kabar={kabar} onTutupKabar={() => setKabar([])} />

      {antrean.length > 0 ? (
        <div className="ug-luring">
          <b>{antrean.length} catatan menunggu sinyal.</b>
          <span>Semuanya tersimpan di perangkat ini dan dikirim sendiri begitu tersambung.</span>
          <button type="button" onClick={() => void kirimAntrean()}>
            Coba kirim sekarang
          </button>
        </div>
      ) : null}

      <Rincian ringkasan={data?.ringkasan} />

      <Daftar
        baris={data?.baris ?? []}
        hariIni={data?.hariIni ?? ""}
        bulan={bulan}
        memuat={memuat}
        onHapus={hapus}
      />

      <Sambungan
        kode={kode}
        nama={data?.buku.nama ?? ""}
        baris={data?.baris ?? []}
        bulan={bulan}
        pasang={pasang}
        onPasang={() => setPasang(null)}
      />
    </Bingkai>
  );
}

// ============================================================
// GERBANG: buat buku baru, atau buka yang sudah ada
// ============================================================

function Gerbang({
  onMasuk,
  dalam = false,
  catatan = "",
}: {
  onMasuk: (kode: string) => void;
  dalam?: boolean;
  /** Alasan buku langganan tidak dapat disiapkan sendiri, bila ada. */
  catatan?: string;
}) {
  const [mode, setMode] = useState<"baru" | "buka">("baru");
  const [nama, setNama] = useState("");
  const [kode, setKode] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [kodeBaru, setKodeBaru] = useState("");

  async function buat() {
    setSibuk(true);
    setGalat("");
    try {
      const jawab = await fetch("/api/uang/buku", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nama }),
      });
      const isi = await jawab.json();
      if (!jawab.ok || !isi?.success) {
        setGalat(isi?.message || "Buku gagal dibuat.");
        return;
      }
      setKodeBaru(isi.buku.kode);
    } catch {
      setGalat("Tidak dapat menghubungi server.");
    } finally {
      setSibuk(false);
    }
  }

  async function buka() {
    setSibuk(true);
    setGalat("");
    try {
      const jawab = await fetch(`/api/uang/buku?kode=${encodeURIComponent(kode)}`);
      const isi = await jawab.json();
      if (!jawab.ok || !isi?.success) {
        setGalat(isi?.message || "Buku tidak ditemukan.");
        return;
      }
      onMasuk(isi.buku.kode);
    } catch {
      setGalat("Tidak dapat menghubungi server.");
    } finally {
      setSibuk(false);
    }
  }

  const kelas = dalam ? "ug-wrap ug-dalam ug-gerbang" : "ug-wrap ug-gerbang";

  if (kodeBaru) {
    return (
      <Bingkai dalam={dalam} kelas={kelas}>
        <div className="ug-kartu ug-jadi">
          <h1>Bukunya siap</h1>
          <p>Simpan kode ini. Ia satu-satunya kunci buku Anda, dan tidak dapat dipulihkan.</p>
          <button
            type="button"
            className="ug-kode"
            onClick={() => navigator.clipboard?.writeText(kodeBaru)}
            title="Salin kode"
          >
            <b>{kodeBaru}</b>
            <span>ketuk untuk menyalin</span>
          </button>
          <p className="ug-halus">
            Pakai kode yang sama di ponsel lain, atau kirim <code>/daftar {kodeBaru}</code> ke bot
            Telegram supaya catatan bisa dikirim lewat chat.
          </p>
          <button type="button" className="ug-utama" onClick={() => onMasuk(kodeBaru)}>
            Mulai mencatat
          </button>
        </div>
      </Bingkai>
    );
  }

  return (
    <Bingkai dalam={dalam} kelas={kelas}>
      <header className="ug-hero">
        <span className="ug-lencana">Catatan Uang</span>
        <h1>Tulis satu pesan, uangnya tercatat sendiri</h1>
        <p>
          Tidak ada formulir, tidak ada daftar pilihan. Ketik seperti mengirim pesan ke teman:
          nominal, arah, dan kategorinya dibaca sendiri dari kalimatnya.
        </p>
        <ul className="ug-contoh">
          {CONTOH.map((c) => (
            <li key={c}>
              <code>{c}</code>
            </li>
          ))}
        </ul>
      </header>

      <div className="ug-kartu">
        <div className="ug-tab">
          <button
            type="button"
            className={mode === "baru" ? "aktif" : ""}
            onClick={() => setMode("baru")}
          >
            Buku baru
          </button>
          <button
            type="button"
            className={mode === "buka" ? "aktif" : ""}
            onClick={() => setMode("buka")}
          >
            Sudah punya kode
          </button>
        </div>

        {mode === "baru" ? (
          <>
            <label className="ug-label" htmlFor="ug-nama">
              Nama buku
            </label>
            <input
              id="ug-nama"
              className="ug-isian"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Uang bulanan saya"
              maxLength={60}
            />
            <button type="button" className="ug-utama" onClick={buat} disabled={sibuk}>
              {sibuk ? "Membuat..." : "Buat buku"}
            </button>
            <p className="ug-halus">
              Tanpa akun dan tanpa kata sandi. Yang memegang kodenya, dialah pemilik bukunya, jadi
              simpan kodenya baik-baik.
            </p>
          </>
        ) : (
          <>
            <label className="ug-label" htmlFor="ug-kode">
              Kode buku
            </label>
            <input
              id="ug-kode"
              className="ug-isian ug-isian-kode"
              value={kode}
              onChange={(e) => setKode(e.target.value.toUpperCase())}
              placeholder="UNG-XXXX-XXXX-XXXX"
              maxLength={24}
              autoComplete="off"
            />
            <button type="button" className="ug-utama" onClick={buka} disabled={sibuk}>
              {sibuk ? "Membuka..." : "Buka buku"}
            </button>
          </>
        )}

        {galat ? <p className="ug-galat">{galat}</p> : null}
        {!galat && catatan ? <p className="ug-halus">{catatan}</p> : null}
      </div>

      {dalam ? null : (
        <p className="ug-balik">
          <Link href="/">Kembali ke beranda portal</Link>
        </p>
      )}
    </Bingkai>
  );
}

// ============================================================
// TAWARAN PEMASANGAN APLIKASI
// ============================================================

function TawaranPasang({
  peristiwa,
  onTutup,
}: {
  peristiwa: PeristiwaPasang;
  onTutup: () => void;
}) {
  return (
    <div className="ug-pasang">
      <b>Pasang sebagai aplikasi</b>
      <span>
        Ada ikonnya sendiri di layar utama, terbuka tanpa peramban, dan tetap bisa mencatat
        walaupun sinyalnya hilang.
      </span>
      <button
        type="button"
        onClick={async () => {
          try {
            await peristiwa.prompt();
            await peristiwa.userChoice;
          } catch {
            // Tawaran yang sudah kedaluwarsa: tidak ada yang perlu dikabarkan.
          }
          // Peramban hanya memberi satu tawaran; sesudah dipakai ia dibuang
          // apa pun jawabannya.
          onTutup();
        }}
      >
        Pasang
      </button>
      <button type="button" className="ug-pasang-tutup" onClick={onTutup}>
        Nanti
      </button>
    </div>
  );
}

// ============================================================
// KEPALA
// ============================================================

function Kepala({
  nama,
  bulan,
  onBulan,
  onKeluar,
  memuat,
}: {
  nama: string;
  bulan: string;
  onBulan: (b: string) => void;
  /** null berarti buku ini tidak dapat ditinggalkan dari layar ini. */
  onKeluar: (() => void) | null;
  memuat: boolean;
}) {
  const bulanIni = bulanWib();
  return (
    <header className="ug-kepala">
      <div>
        <span className="ug-lencana">Catatan Uang</span>
        <h1>{nama}</h1>
      </div>
      <div className="ug-navbulan">
        <button type="button" onClick={() => onBulan(geserBulan(bulan, -1))} aria-label="Bulan sebelumnya">
          ‹
        </button>
        <b>{labelBulan(bulan)}</b>
        <button
          type="button"
          onClick={() => onBulan(geserBulan(bulan, 1))}
          aria-label="Bulan berikutnya"
          disabled={bulan >= bulanIni}
        >
          ›
        </button>
      </div>
      <div className="ug-kepala-alat">
        {memuat ? <span className="ug-memuat">memuat...</span> : null}
        {onKeluar ? (
          <button type="button" className="ug-halus-tombol" onClick={onKeluar}>
            Keluar
          </button>
        ) : null}
      </div>
    </header>
  );
}

// ============================================================
// TIGA ANGKA BESAR
// ============================================================

function Angka({ ringkasan }: { ringkasan: DataApi["ringkasan"] | undefined }) {
  const masuk = ringkasan?.masuk ?? 0;
  const keluar = ringkasan?.keluar ?? 0;
  const sisa = ringkasan?.sisa ?? 0;
  return (
    <section className="ug-angka">
      <div className="ug-angka-masuk">
        <span>Pemasukan</span>
        <b>{rupiah(masuk)}</b>
      </div>
      <div className="ug-angka-keluar">
        <span>Pengeluaran</span>
        <b>{rupiah(keluar)}</b>
      </div>
      <div className={sisa < 0 ? "ug-angka-minus" : "ug-angka-sisa"}>
        <span>Sisa</span>
        <b>{rupiah(sisa)}</b>
      </div>
    </section>
  );
}

// ============================================================
// TREN ENAM BULAN
// ============================================================

function Tren({
  titik,
  aktif,
  onPilih,
}: {
  titik: DataApi["tren"];
  aktif: string;
  onPilih: (b: string) => void;
}) {
  const puncak = Math.max(1, ...titik.map((t) => Math.max(t.masuk, t.keluar)));
  return (
    <section className="ug-tren">
      <div className="ug-judul-kecil">
        <b>Enam bulan terakhir</b>
        <span>hijau masuk, merah keluar</span>
      </div>
      <div className="ug-tren-isi">
        {titik.map((t) => (
          <button
            type="button"
            key={t.bulan}
            className={t.bulan === aktif ? "ug-tren-bulan aktif" : "ug-tren-bulan"}
            onClick={() => onPilih(t.bulan)}
            title={`${labelBulan(t.bulan)}: masuk ${rupiah(t.masuk)}, keluar ${rupiah(t.keluar)}`}
          >
            <span className="ug-tren-batang">
              <i style={{ height: `${(t.masuk / puncak) * 100}%` }} className="ug-batang-masuk" />
              <i style={{ height: `${(t.keluar / puncak) * 100}%` }} className="ug-batang-keluar" />
            </span>
            <em>{labelBulan(t.bulan).split(" ")[0].slice(0, 3)}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// KOTAK TULIS
// ============================================================

function Tulis({
  onKirim,
  kabar,
  onTutupKabar,
}: {
  onKirim: (pesan: string) => Promise<{ ok: boolean }>;
  kabar: string[];
  onTutupKabar: () => void;
}) {
  const [teks, setTeks] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const kotak = useRef<HTMLTextAreaElement>(null);

  // Pratinjau memakai pengurai yang sama dengan server, jadi yang terlihat
  // di sini persis yang akan tersimpan.
  const pratinjau = useMemo(() => (teks.trim() ? uraiBanyak(teks) : []), [teks]);

  async function kirim() {
    const isi = teks.trim();
    if (!isi || sibuk) return;
    setSibuk(true);
    const hasil = await onKirim(isi);
    setSibuk(false);
    if (hasil.ok) {
      setTeks("");
      kotak.current?.focus();
    }
  }

  function pilihKategori(id: string) {
    // Kategori yang dipilih ditulis sebagai tanda pagar di dalam pesannya,
    // bukan disimpan terpisah: apa yang terlihat di kotak tulis selalu sama
    // dengan apa yang dikirim.
    const bersih = teks.replace(/(?:^|\s)#[\p{L}\d][\p{L}\d_-]*/gu, "").trimEnd();
    setTeks(`${bersih} #${id}`);
    kotak.current?.focus();
  }

  const satu = pratinjau.length === 1 ? pratinjau[0].hasil : null;

  return (
    <section className="ug-tulis">
      <textarea
        ref={kotak}
        className="ug-kotak"
        value={teks}
        onChange={(e) => setTeks(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void kirim();
          }
        }}
        rows={2}
        placeholder="-beli nasi uduk 10k"
        aria-label="Tulis catatan uang"
      />

      <div className="ug-tulis-kaki">
        <span className="ug-halus">Enter mengirim, Shift+Enter ganti baris</span>
        <button type="button" className="ug-utama ug-kecil" onClick={kirim} disabled={sibuk || !teks.trim()}>
          {sibuk ? "Menyimpan..." : "Catat"}
        </button>
      </div>

      {pratinjau.length > 0 ? (
        <div className="ug-pratinjau">
          {pratinjau.map(({ baris, hasil }, urutan) => (
            <div key={`${baris}-${urutan}`} className="ug-pratinjau-baris">
              {hasil.ok ? (
                <>
                  <span className={hasil.hasil.arah === "masuk" ? "ug-tanda-masuk" : "ug-tanda-keluar"}>
                    {hasil.hasil.arah === "masuk" ? "masuk" : "keluar"}
                  </span>
                  <b>{rupiah(hasil.hasil.nominal)}</b>
                  <span className="ug-pratinjau-catatan">{hasil.hasil.catatan}</span>
                  <span className="ug-cip" style={{ borderColor: kategoriDari(hasil.hasil.kategori).warna }}>
                    {kategoriDari(hasil.hasil.kategori).ikon} {kategoriDari(hasil.hasil.kategori).nama}
                  </span>
                  <span className="ug-halus">{hasil.hasil.tanggal}</span>
                </>
              ) : (
                <span className="ug-pratinjau-gagal">{hasil.alasan}</span>
              )}
            </div>
          ))}

          {satu?.ok ? (
            <div className="ug-pilih-kategori">
              <span className="ug-halus">Bukan kategori itu?</span>
              {KATEGORI.filter((k) => k.arah === satu.hasil.arah || k.arah === "dua").map((k) => (
                <button
                  type="button"
                  key={k.id}
                  className={k.id === satu.hasil.kategori ? "ug-cip-pilih aktif" : "ug-cip-pilih"}
                  onClick={() => pilihKategori(k.id)}
                >
                  {k.ikon} {k.nama}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="ug-saran">
          {CONTOH.map((c) => (
            <button type="button" key={c} onClick={() => setTeks(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      {kabar.length > 0 ? (
        <div className="ug-kabar">
          <button type="button" className="ug-tutup" onClick={onTutupKabar} aria-label="Tutup kabar">
            ×
          </button>
          {kabar.map((k, urutan) => (
            <p key={`${k}-${urutan}`}>{k}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

// ============================================================
// RINCIAN PER KATEGORI
// ============================================================

function Rincian({ ringkasan }: { ringkasan: DataApi["ringkasan"] | undefined }) {
  const keluar = ringkasan?.perKategori.keluar ?? [];
  const masuk = ringkasan?.perKategori.masuk ?? [];
  if (keluar.length === 0 && masuk.length === 0) return null;

  const total = (daftar: RingkasKategoriApi[]) =>
    Math.max(1, daftar.reduce((jumlah, k) => jumlah + k.nilai, 0));

  const kolom = (judul: string, daftar: RingkasKategoriApi[]) => {
    if (daftar.length === 0) return null;
    const seluruh = total(daftar);
    return (
      <div className="ug-rincian-kolom">
        <div className="ug-judul-kecil">
          <b>{judul}</b>
        </div>
        {daftar.map((k) => (
          <div className="ug-rincian-baris" key={k.kategori}>
            <span className="ug-rincian-nama">
              {k.ikon} {k.nama}
              <em>{k.jumlah}x</em>
            </span>
            <span className="ug-rincian-batang">
              <i style={{ width: `${(k.nilai / seluruh) * 100}%`, background: k.warna }} />
            </span>
            <b>{rupiahRingkas(k.nilai)}</b>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="ug-rincian">
      {kolom("Ke mana perginya", keluar)}
      {kolom("Dari mana datangnya", masuk)}
    </section>
  );
}

// ============================================================
// DAFTAR CATATAN
// ============================================================

function Daftar({
  baris,
  hariIni,
  bulan,
  memuat,
  onHapus,
}: {
  baris: BarisApi[];
  hariIni: string;
  bulan: string;
  memuat: boolean;
  onHapus: (id: number) => void;
}) {
  const perHari = useMemo(() => {
    const peta = new Map<string, BarisApi[]>();
    for (const isi of baris) {
      const daftar = peta.get(isi.tanggal) ?? [];
      daftar.push(isi);
      peta.set(isi.tanggal, daftar);
    }
    return [...peta.entries()];
  }, [baris]);

  if (baris.length === 0) {
    return (
      <section className="ug-daftar ug-kosong">
        {memuat ? "Memuat catatan..." : `Belum ada catatan pada ${labelBulan(bulan)}.`}
      </section>
    );
  }

  return (
    <section className="ug-daftar">
      {perHari.map(([tanggal, isi]) => {
        const masukHari = isi.filter((b) => b.arah === "masuk").reduce((j, b) => j + b.nominal, 0);
        const keluarHari = isi.filter((b) => b.arah === "keluar").reduce((j, b) => j + b.nominal, 0);
        return (
          <div className="ug-hari" key={tanggal}>
            <div className="ug-hari-kepala">
              <b>{labelHari(tanggal, hariIni)}</b>
              <span>
                {masukHari > 0 ? `+${rupiahRingkas(masukHari)}` : ""}
                {masukHari > 0 && keluarHari > 0 ? " · " : ""}
                {keluarHari > 0 ? `-${rupiahRingkas(keluarHari)}` : ""}
              </span>
            </div>
            {isi.map((b) => {
              const kategori = kategoriDari(b.kategori);
              return (
                <div className="ug-baris" key={b.id}>
                  <span className="ug-baris-ikon" style={{ background: `${kategori.warna}1a` }}>
                    {kategori.ikon}
                  </span>
                  <span className="ug-baris-teks">
                    <b>{b.catatan}</b>
                    <em>
                      {kategori.nama}
                      {b.sumber !== "web" ? ` · ${b.sumber}` : ""}
                    </em>
                  </span>
                  <b className={b.arah === "masuk" ? "ug-nilai-masuk" : "ug-nilai-keluar"}>
                    {b.arah === "masuk" ? "+" : "-"}
                    {rupiah(b.nominal)}
                  </b>
                  <button
                    type="button"
                    className="ug-hapus"
                    onClick={() => onHapus(b.id)}
                    aria-label={`Hapus ${b.catatan}`}
                    title="Hapus"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

// ============================================================
// SAMBUNGAN: kode buku, Telegram, dan unduhan
// ============================================================

function Sambungan({
  kode,
  nama,
  baris,
  bulan,
  pasang,
  onPasang,
}: {
  kode: string;
  nama: string;
  baris: BarisApi[];
  bulan: string;
  pasang: PeristiwaPasang | null;
  onPasang: () => void;
}) {
  const [buka, setBuka] = useState(false);
  const [terlihat, setTerlihat] = useState(false);

  function unduh() {
    const judul = ["tanggal", "arah", "nominal", "kategori", "catatan", "sumber"];
    const isi = baris.map((b) =>
      [b.tanggal, b.arah, String(b.nominal), kategoriDari(b.kategori).nama, b.catatan, b.sumber]
        .map((sel) => `"${String(sel).replace(/"/g, '""')}"`)
        .join(","),
    );
    // Tanda BOM di depan supaya Excel membuka huruf beraksennya dengan benar.
    const berkas = new Blob([`\uFEFF${[judul.join(","), ...isi].join("\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const alamat = URL.createObjectURL(berkas);
    const tautan = document.createElement("a");
    tautan.href = alamat;
    tautan.download = `catatan-uang-${bulan}.csv`;
    tautan.click();
    URL.revokeObjectURL(alamat);
  }

  return (
    <section className="ug-sambung">
      <button type="button" className="ug-sambung-kepala" onClick={() => setBuka(!buka)}>
        <b>Kode buku, Telegram, dan unduhan</b>
        <span>{buka ? "tutup" : "buka"}</span>
      </button>

      {buka ? (
        <div className="ug-sambung-isi">
          <div>
            <b>Kode buku {nama ? `"${nama}"` : ""}</b>
            <p className="ug-halus">
              Pakai kode ini untuk membuka buku yang sama di perangkat lain. Siapa pun yang
              memegangnya dapat membaca dan menulis catatan Anda, jadi jangan dibagikan.
            </p>
            <div className="ug-kode-baris">
              <code>{terlihat ? kode : "UNG-••••-••••-••••"}</code>
              <button type="button" onClick={() => setTerlihat(!terlihat)}>
                {terlihat ? "Sembunyikan" : "Lihat"}
              </button>
              <button type="button" onClick={() => navigator.clipboard?.writeText(kode)}>
                Salin
              </button>
            </div>
          </div>

          <div>
            <b>Catat lewat WhatsApp</b>
            <p className="ug-halus">
              Sekali sambung, sesudah itu cukup kirim pesan biasa ke nomor botnya. Catatannya masuk
              ke buku ini walaupun halaman ini tidak pernah dibuka lagi.
            </p>
            {NOMOR_WA ? (
              <a
                className="ug-wa"
                href={`https://wa.me/${NOMOR_WA}?text=${encodeURIComponent(`daftar ${kode}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                Sambungkan WhatsApp sekarang
              </a>
            ) : (
              <p className="ug-halus">
                Nomor botnya belum dipasang di portal ini. Setelah dipasang, tombol sambung muncul di
                sini. Sementara itu, kirim <code>daftar {terlihat ? kode : "KODE-BUKU-ANDA"}</code> ke
                nomor botnya secara manual.
              </p>
            )}
          </div>

          <div>
            <b>Catat lewat Telegram</b>
            <p className="ug-halus">
              Kirim <code>/daftar {terlihat ? kode : "KODE-BUKU-ANDA"}</code> sekali saja ke bot
              catatan portal. Sesudah itu setiap pesan yang Anda kirim ke bot langsung masuk ke buku
              ini.
            </p>
            {BOT_TELEGRAM ? (
              <a
                className="ug-halus-tombol"
                href={`https://t.me/${BOT_TELEGRAM}?text=${encodeURIComponent(`/daftar ${kode}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                Buka bot Telegram
              </a>
            ) : null}
          </div>

          {pasang ? (
            <div>
              <b>Pasang sebagai aplikasi</b>
              <p className="ug-halus">
                Ikon sendiri di layar utama, terbuka tanpa peramban, dan tetap dapat mencatat ketika
                sinyalnya hilang.
              </p>
              <button
                type="button"
                className="ug-halus-tombol"
                onClick={async () => {
                  try {
                    await pasang.prompt();
                    await pasang.userChoice;
                  } catch {
                    // Tawaran yang sudah kedaluwarsa.
                  }
                  onPasang();
                }}
              >
                Pasang aplikasi
              </button>
            </div>
          ) : null}

          <div>
            <b>Unduh catatan</b>
            <p className="ug-halus">
              Berkas CSV berisi catatan {labelBulan(bulan)}, siap dibuka di Excel atau Google Sheets.
            </p>
            <button type="button" className="ug-halus-tombol" onClick={unduh} disabled={baris.length === 0}>
              Unduh {labelBulan(bulan)} ({baris.length} baris)
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
