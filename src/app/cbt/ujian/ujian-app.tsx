"use client";

// ============================================================
// HALAMAN UJIAN MAHASISWA — TANPA LOGIN
//
// Empat layar, dan tidak lebih: kode → identitas → mengerjakan → selesai.
// Setiap layar tambahan adalah satu tempat lagi bagi mahasiswa untuk tersesat
// lima menit sebelum ujian dimulai.
//
// Tiga hal yang menentukan rancangannya:
//
//   1. WAKTU DARI SERVER. Angka mundur di layar hanya penunjuk; yang berlaku
//      batas yang disimpan server, dan tiap penyimpanan jawaban mengembalikan
//      sisa waktu yang sebenarnya sehingga jam layar ikut dikoreksi.
//   2. AUTO-SAVE TIDAK BOLEH MENAKUTKAN. Jaringan kampus putus-nyambung.
//      Kegagalan menyimpan ditandai tenang lalu dicoba lagi, bukan
//      dilemparkan sebagai galat merah yang membuat orang berhenti mengerjakan.
//   3. PONSEL DULU. Sebagian besar mahasiswa mengerjakannya dari HP.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { jawabanKosong, uraiJodoh, type JenisSoal, type Media } from "@/lib/cbt";
import MediaSoal from "./media-soal";

type Ujian = {
  kode: string; judul: string; mataKuliah: string; kelas: string | null;
  deskripsi: string | null; instruksi: string | null;
  durasi: number; jumlahSoal: number; pakaiToken: boolean;
  bisaKembali: boolean; tampilkanNilai: boolean;
  status: string; mulai: string | null; selesai: string | null;
};

type Soal = {
  id: number;
  jenis: JenisSoal;
  pertanyaan: string;
  pilihan: string[];
  /** Kolom kiri penjodohan. Kosong untuk jenis lain. */
  kiri: string[];
  media: Media;
  bobot: number;
};

type Hasil = {
  nilai: number; benar: number; salah: number; kosong: number;
  /** Benar sebagian — hanya pada PG kompleks dan penjodohan. */
  sebagian: number;
  tertunda: number; lulus: boolean; passing: number;
};

const KUNCI_SIMPAN = "sipaling-ujian-sesi";
const KUNCI_PERANGKAT = "sipaling-ujian-perangkat";
const JEDA_SIMPAN_MS = 900;

/**
 * Denyut auto-simpan: sepuluh detik sekali, apa pun yang sedang terjadi.
 *
 * Jeda 900 milidetik di atas menyimpan sesudah mengetik BERHENTI SEJENAK, dan
 * itu menutup hampir semua keadaan — kecuali satu yang justru paling mahal:
 * mahasiswa yang mengetik essay tanpa jeda selama sepuluh menit tidak pernah
 * memicunya sekali pun, karena jedanya disetel ulang pada tiap ketukan. Denyut
 * ini yang menutupnya.
 *
 * Ia juga mengambil ulang SISA WAKTU dari server. Jam peramban dapat meleset,
 * dan laptop yang tutup lalu dibuka lagi melanjutkan hitungan mundurnya dari
 * tempat ia tertidur — sedangkan batas waktu yang berlaku ada di server.
 */
const DENYUT_MS = 10_000;

/**
 * Penanda perangkat, dibuat sekali lalu disimpan di peramban ini.
 *
 * BUKAN sidik jari perangkat sungguhan, dan sengaja tidak. Ia dapat dihapus
 * dengan membersihkan data peramban, dan memang boleh — yang hendak dicegah
 * bukan penyerang yang gigih, melainkan hal yang benar-benar terjadi di ruang
 * ujian: satu ponsel dipakai bergantian oleh dua orang yang duduk
 * bersebelahan.
 *
 * Peramban yang menolak menyimpan apa pun (mode penyamaran, kuota penuh)
 * mengembalikan tali kosong, dan server memperlakukannya sebagai "tidak
 * diketahui" — tidak diperiksa, bukan ditolak. Menolak ujian karena
 * penyimpanan perambannya terkunci berarti menghukum orang yang salah.
 */
function penandaPerangkat() {
  try {
    const ada = window.localStorage.getItem(KUNCI_PERANGKAT) || "";
    if (/^[A-Za-z0-9-]{8,64}$/.test(ada)) return ada;
    const baru = (
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
    )
      .replace(/[^A-Za-z0-9-]/g, "")
      .slice(0, 64);
    window.localStorage.setItem(KUNCI_PERANGKAT, baru);
    return baru;
  } catch {
    return "";
  }
}

function tanggalRapi(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}

export default function UjianApp() {
  const [layar, setLayar] = useState<"kode" | "identitas" | "kerja" | "selesai">("kode");
  const [kode, setKode] = useState("");
  const [ujian, setUjian] = useState<Ujian | null>(null);
  const [nama, setNama] = useState("");
  const [nim, setNim] = useState("");
  const [token, setToken] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const [kunciSesi, setKunciSesi] = useState("");
  const [soal, setSoal] = useState<Soal[]>([]);
  const [jawaban, setJawaban] = useState<Record<number, string>>({});
  const [nomor, setNomor] = useState(0);
  const [sisa, setSisa] = useState(0);
  const [simpanan, setSimpanan] = useState<"aman" | "menyimpan" | "tertunda">("aman");
  const [ditandai, setDitandai] = useState<number[]>([]);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [pesanSelesai, setPesanSelesai] = useState("");

  const antreRef = useRef<Map<number, string>>(new Map());
  const jamKirimRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kunciRef = useRef("");

  // Kunci sesi disalin ke ref di dalam effect, bukan saat menggambar.
  // Pemanggil balik jam dan pendengar peristiwa membacanya jauh setelah
  // gambar selesai; tanpa salinan ini mereka memegang nilai yang basi.
  useEffect(() => {
    kunciRef.current = kunciSesi;
  }, [kunciSesi]);

  // ---------- kode dari alamat: tautan yang dibagikan langsung terbuka ----------
  //
  // Dosen menempelkan tautannya ke grup kelas; mahasiswa yang menekannya harus
  // langsung melihat ujiannya, bukan layar kosong dengan kode yang sudah
  // terisi tetapi masih menunggu satu ketukan lagi.
  //
  // Ditunda satu tick: membaca window saat menggambar tidak mungkin di server,
  // dan setState sinkron di badan effect memicu gambar bertingkat.
  useEffect(() => {
    const tunda = window.setTimeout(() => {
      const dariAlamat = new URLSearchParams(window.location.search).get("kode");
      if (!dariAlamat) return;
      const bersih = dariAlamat.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
      setKode(bersih);
      if (!bersih) return;
      setSibuk(true);
      fetch(`/api/cbt/ikut?kode=${encodeURIComponent(bersih)}`, { cache: "no-store" })
        .then((jawab) => jawab.json())
        .then((data) => {
          if (data.success) {
            setUjian(data.ujian);
            setLayar("identitas");
          } else {
            setGalat(data.message || "Ujian tidak ditemukan.");
          }
        })
        .catch(() => setGalat("Ujian belum dapat dibuka. Periksa sambungan internetmu."))
        .finally(() => setSibuk(false));
    }, 0);
    return () => window.clearTimeout(tunda);
  }, []);

  // ---------- pulihkan sesi yang tertunda ----------
  //
  // Ponsel mati, peramban tertutup, jaringan putus. Yang tersimpan di
  // perangkat hanya kunci sesinya; seluruh isinya diambil ulang dari server,
  // sehingga jawaban yang sudah masuk tidak mungkin hilang bersama tab.
  useEffect(() => {
    let hidup = true;
    let tersimpan = "";
    try {
      tersimpan = window.localStorage.getItem(KUNCI_SIMPAN) || "";
    } catch {
      return;
    }
    if (!tersimpan) return;

    fetch("/api/cbt/ikut", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi: "lanjut", kunciSesi: tersimpan }),
    })
      .then((jawab) => jawab.json())
      .then((isi) => {
        if (!hidup || !isi.success || isi.selesai) {
          try { window.localStorage.removeItem(KUNCI_SIMPAN); } catch { /* diabaikan */ }
          return;
        }
        setKunciSesi(tersimpan);
        setUjian(isi.ujian);
        setSoal(isi.soal || []);
        setJawaban(isi.jawaban || {});
        setDitandai(isi.ditandai || []);
        setSisa(isi.sisaDetik || 0);
        setLayar("kerja");
      })
      .catch(() => {
        // Gagal memulihkan bukan alasan menampilkan galat: mahasiswanya
        // mungkin memang sedang membuka halaman ini untuk ujian yang lain.
      });
    return () => { hidup = false; };
  }, []);

  // ---------- jam mundur ----------
  useEffect(() => {
    if (layar !== "kerja") return;
    const jam = setInterval(() => {
      setSisa((kini) => Math.max(0, kini - 1));
    }, 1000);
    return () => clearInterval(jam);
  }, [layar]);


  const kumpulkan = useCallback(async (otomatis: boolean) => {
    if (!kunciRef.current) return;
    setSibuk(true);
    try {
      // Antrean jawaban dikosongkan lebih dulu, supaya yang barusan diketik
      // ikut terkumpul dan bukan tertinggal di dalam jeda pengiriman.
      const antre = Array.from(antreRef.current.entries());
      antreRef.current.clear();
      let tertinggal = 0;
      for (const [id, isi] of antre) {
        try {
          const jawabServer = await fetch("/api/cbt/ikut", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aksi: "jawab", kunciSesi: kunciRef.current, soal: id, jawaban: isi }),
          });
          const data = await jawabServer.json();
          // Lewat batas waktu bukan kegagalan: jawaban itu memang tidak lagi
          // diterima, dan yang sudah tersimpan tetap dihitung.
          if (!data.success && !data.habis) throw new Error("gagal");
        } catch {
          antreRef.current.set(id, isi);
          tertinggal += 1;
        }
      }

      // Jawaban yang belum sampai ke server TIDAK boleh ikut terkumpul diam-
      // diam. Mahasiswa yang menekan "Kumpulkan" sambil melihat palet hijau
      // berhak tahu bahwa sebagian jawabannya masih tertahan di perangkatnya.
      if (tertinggal > 0 && !otomatis) {
        setSimpanan("tertunda");
        setGalat(
          `${tertinggal} jawaban belum sampai ke server, sepertinya jaringanmu sedang terputus. ` +
            "Jangan tutup halaman ini; tunggu sebentar lalu tekan Kumpulkan lagi.",
        );
        setSibuk(false);
        return;
      }

      const jawab = await fetch("/api/cbt/ikut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "selesai", kunciSesi: kunciRef.current }),
      });
      const isi = await jawab.json();
      if (!jawab.ok || !isi.success) throw new Error(isi.message || "Ujian belum dapat dikumpulkan.");
      setHasil(isi.hasil ?? null);
      setPesanSelesai(
        otomatis ? "Waktu habis. Jawabanmu sudah dikumpulkan otomatis." : "Jawabanmu sudah dikumpulkan.",
      );
      try { window.localStorage.removeItem(KUNCI_SIMPAN); } catch { /* diabaikan */ }
      setLayar("selesai");
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Ujian belum dapat dikumpulkan.");
    } finally {
      setSibuk(false);
    }
  }, []);

  // ---------- waktu habis: kumpulkan sendiri ----------
  useEffect(() => {
    if (layar !== "kerja" || sisa > 0) return;
    // Ditunda satu tick: pengumpulan menyetel beberapa keadaan sekaligus, dan
    // menjalankannya sinkron di badan effect memicu gambar bertingkat.
    const tunda = window.setTimeout(() => void kumpulkan(true), 0);
    return () => window.clearTimeout(tunda);
  }, [layar, sisa, kumpulkan]);

  // ---------- catat pindah tab ----------
  useEffect(() => {
    if (layar !== "kerja") return;
    function sembunyi() {
      if (document.visibilityState !== "hidden" || !kunciRef.current) return;
      fetch("/api/cbt/ikut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "langgar", kunciSesi: kunciRef.current, jenis: "tab" }),
      }).catch(() => undefined);
    }
    document.addEventListener("visibilitychange", sembunyi);
    return () => document.removeEventListener("visibilitychange", sembunyi);
  }, [layar]);

  // ---------- peringatan sebelum menutup halaman ----------
  useEffect(() => {
    if (layar !== "kerja") return;
    function cegah(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", cegah);
    return () => window.removeEventListener("beforeunload", cegah);
  }, [layar]);

  async function cekKode() {
    const isi = kode.trim().toUpperCase();
    if (!isi) { setGalat("Kode ujian belum diisi."); return; }
    setSibuk(true); setGalat("");
    try {
      const jawab = await fetch(`/api/cbt/ikut?kode=${encodeURIComponent(isi)}`, { cache: "no-store" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Ujian tidak ditemukan.");
      setUjian(data.ujian);
      setLayar("identitas");
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Ujian tidak ditemukan.");
    } finally {
      setSibuk(false);
    }
  }

  async function mulai() {
    setSibuk(true); setGalat("");
    try {
      const jawab = await fetch("/api/cbt/ikut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "masuk", kode: ujian?.kode, nama, nim, token,
          perangkat: penandaPerangkat(),
        }),
      });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Ujian belum dapat dimulai.");
      setKunciSesi(data.kunciSesi);
      try { window.localStorage.setItem(KUNCI_SIMPAN, data.kunciSesi); } catch { /* diabaikan */ }
      setUjian(data.ujian);
      setSoal(data.soal || []);
      setJawaban(data.jawaban || {});
      setDitandai(data.ditandai || []);
      setSisa(data.sisaDetik || 0);
      setNomor(0);
      setLayar("kerja");
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Ujian belum dapat dimulai.");
    } finally {
      setSibuk(false);
    }
  }

  /**
   * Simpan jawaban dengan jeda pendek.
   *
   * Mengetik essay berarti puluhan perubahan per detik; mengirim semuanya
   * membanjiri server tanpa menambah keamanan apa pun. Yang dikirim keadaan
   * terakhir sesudah mengetiknya berhenti sejenak — dan seluruh antrean ikut
   * dikosongkan saat mengumpulkan, jadi tidak ada yang tertinggal.
   */
  function jawab(id: number, isi: string) {
    setJawaban((kini) => ({ ...kini, [id]: isi }));
    antreRef.current.set(id, isi);
    setSimpanan("menyimpan");
    if (jamKirimRef.current) clearTimeout(jamKirimRef.current);
    jamKirimRef.current = setTimeout(() => { void kirimAntrean(); }, JEDA_SIMPAN_MS);
  }

  /**
   * Centang atau lepas satu pilihan pada PG kompleks.
   *
   * Jawabannya disimpan sebagai daftar nomor dipisah koma, mis. "0,2". Selalu
   * diurutkan supaya "2,0" dan "0,2" tidak terbaca sebagai dua jawaban yang
   * berbeda ketika dibandingkan dengan yang tersimpan.
   */
  function centang(id: number, nomor: number) {
    const kini = String(jawaban[id] ?? "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    const ada = kini.includes(String(nomor));
    const berikut = ada ? kini.filter((n) => n !== String(nomor)) : [...kini, String(nomor)];
    jawab(id, berikut.map(Number).sort((a, b) => a - b).join(","));
  }

  function tercentang(id: number, nomor: number) {
    return String(jawaban[id] ?? "").split(",").map((n) => n.trim()).includes(String(nomor));
  }

  /** Pasangkan satu baris kiri dengan satu pilihan kanan. */
  function jodohkan(id: number, kiri: number, kanan: string) {
    const kini = uraiJodoh(String(jawaban[id] ?? ""));
    if (kanan === "") kini.delete(kiri);
    else kini.set(kiri, Number(kanan));
    jawab(id, JSON.stringify(Object.fromEntries(kini)));
  }

  function pasanganKini(id: number, kiri: number): string {
    const nilai = uraiJodoh(String(jawaban[id] ?? "")).get(kiri);
    return nilai === undefined ? "" : String(nilai);
  }

  async function kirimAntrean() {
    const antre = Array.from(antreRef.current.entries());
    if (antre.length === 0 || !kunciRef.current) { setSimpanan("aman"); return; }
    antreRef.current.clear();
    let gagal = false;
    for (const [id, isi] of antre) {
      try {
        const jawabServer = await fetch("/api/cbt/ikut", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aksi: "jawab", kunciSesi: kunciRef.current, soal: id, jawaban: isi }),
        });
        const data = await jawabServer.json();
        // Sisa waktu SELALU diambil dari server. Jam di peramban dapat meleset
        // — dan dapat sengaja dilesetkan.
        if (typeof data.sisaDetik === "number") setSisa(data.sisaDetik);
        if (!data.success && !data.habis) throw new Error("gagal");
      } catch {
        // Dikembalikan ke antrean lalu dicoba lagi pada perubahan berikutnya.
        antreRef.current.set(id, isi);
        gagal = true;
      }
    }
    setSimpanan(gagal ? "tertunda" : "aman");
  }

  // ---------- denyut: simpan berkala dan luruskan jamnya ----------
  useEffect(() => {
    if (layar !== "kerja") return;
    const denyut = setInterval(() => {
      if (!kunciRef.current) return;
      // Ada yang tertahan di antrean → kirim. Tidak ada → tetap menyapa server
      // sekali, supaya papan pantau dosen tahu layar ini masih hidup dan sisa
      // waktunya ikut diluruskan.
      if (antreRef.current.size > 0) {
        void kirimAntrean();
        return;
      }
      fetch("/api/cbt/ikut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "denyut", kunciSesi: kunciRef.current }),
      })
        .then((jawab) => jawab.json())
        .then((data) => {
          if (typeof data?.sisaDetik === "number") setSisa(data.sisaDetik);
        })
        .catch(() => {
          // Jaringan sedang putus. Tidak ada yang perlu dikabarkan: jawaban
          // yang belum terkirim masih ada di antrean, dan denyut berikutnya
          // akan mencobanya lagi.
        });
    }, DENYUT_MS);
    return () => clearInterval(denyut);
    // Bergantung pada layar saja. kirimAntrean dibuat ulang pada tiap gambar,
    // dan memasukkannya ke daftar membuat denyutnya disetel ulang terus-menerus
    // sehingga tidak pernah benar-benar berdenyut. Isinya aman dipegang dari
    // gambar pertama: yang dibacanya hanya ref dan penyetel keadaan, dan
    // keduanya tidak pernah basi.
  }, [layar]);

  function keSoal(index: number) {
    setNomor(index);
  }

  /**
   * Keluar tanpa mengumpulkan.
   *
   * Ujiannya TIDAK ditutup — attempt-nya tetap berjalan di server beserta sisa
   * waktunya, dan mahasiswa dapat masuk lagi dengan NIM yang sama untuk
   * menemukan lembar yang persis sama. Yang dihapus hanya ingatan peramban ini.
   * Waktunya tetap berjalan, dan itu dikatakan terus terang di kotak
   * konfirmasinya, bukan disembunyikan.
   */
  function keluar() {
    const setuju = window.confirm(
      "Keluar dari halaman ujian?\n\n" +
        "Jawaban yang sudah tersimpan tidak hilang, dan kamu dapat masuk lagi dengan NIM yang " +
        "sama. Tetapi WAKTU UJIAN TERUS BERJALAN selama kamu di luar.",
    );
    if (!setuju) return;
    try { window.localStorage.removeItem(KUNCI_SIMPAN); } catch { /* diabaikan */ }
    setKunciSesi("");
    setSoal([]);
    setJawaban({});
    setDitandai([]);
    setNomor(0);
    setGalat("");
    setLayar("kode");
  }

  /** Konfirmasi sebelum mengumpulkan, dengan jumlah soal yang masih kosong. */
  function mintaKumpul() {
    const kosong = soal.length - terjawab;
    const ragu = ditandai.length;
    const rincian = [
      kosong > 0 ? `${kosong} soal belum dijawab` : null,
      ragu > 0 ? `${ragu} soal ditandai ragu-ragu` : null,
    ].filter(Boolean).join(" dan ");
    const pesan = rincian
      ? `Masih ada ${rincian}. Hentikan ujian dan kumpulkan sekarang?`
      : "Hentikan ujian dan kumpulkan jawabanmu sekarang?";
    if (window.confirm(pesan)) void kumpulkan(false);
  }

  async function tandai(id: number) {
    const sudah = ditandai.includes(id);
    setDitandai((kini) => (sudah ? kini.filter((n) => n !== id) : [...kini, id]));
    try {
      await fetch("/api/cbt/ikut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "tandai", kunciSesi: kunciRef.current, soal: id, tandai: !sudah }),
      });
    } catch {
      // Penanda tinjau pelengkap; keadaannya tersinkron pada pemuatan berikutnya.
    }
  }

  /**
   * Keadaan satu soal pada palet nomor. Tiga warna, persis seperti legendanya.
   *
   * Urutannya menentukan: soal yang sudah dijawab LALU ditandai ragu-ragu tetap
   * terbaca oranye, karena itulah yang ingin dilihat mahasiswa — daftar soal
   * yang sengaja ia sisihkan untuk ditengok lagi sebelum mengumpulkan.
   *
   * Soal yang sedang dibuka tidak mendapat warna keempat; ia diberi bingkai
   * pada CSS-nya. Menambah satu warna lagi membuat legendanya tidak lagi
   * terbaca sekali lihat.
   */
  function keadaanSoal(id: number): "ragu" | "isi" | "kosong" {
    if (ditandai.includes(id)) return "ragu";
    if (sudahDijawab(id)) return "isi";
    return "kosong";
  }

  /**
   * Sudah dijawab?
   *
   * Lewat jawabanKosong, bukan sekadar memeriksa tali kosong: penjodohan yang
   * belum disentuh tetap tersimpan sebagai "{}", dan itu akan terbaca hijau
   * pada palet nomor padahal belum dikerjakan sama sekali.
   */
  function sudahDijawab(id: number) {
    const soalnya = soal.find((s) => s.id === id);
    if (!soalnya) return false;
    return !jawabanKosong(soalnya.jenis, String(jawaban[id] ?? ""));
  }

  const terjawab = soal.filter((s) => !jawabanKosong(s.jenis, String(jawaban[s.id] ?? ""))).length;
  const soalKini = soal[nomor];
  const hampirHabis = sisa > 0 && sisa <= 300;

  // ---------- LAYAR: KODE ----------
  if (layar === "kode") {
    return (
      <div className="uj">
        <div className="uj-kotak">
          <span className="uj-lencana">UJIAN ONLINE</span>
          <h1>Masuk ke ujianmu</h1>
          <p className="uj-lead">
            Tidak perlu membuat akun dan tidak perlu kata sandi. Masukkan kode ujian yang diberikan
            dosenmu.
          </p>
          <label htmlFor="uj-kode">Kode Ujian</label>
          <input
            id="uj-kode"
            className="uj-input uj-input-kode"
            value={kode}
            onChange={(e) => setKode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") void cekKode(); }}
            placeholder="XXXXXX"
            autoComplete="off"
            inputMode="text"
          />
          {galat && <p className="uj-galat" role="alert">{galat}</p>}
          <button type="button" className="uj-btn uj-btn-utama" disabled={sibuk} onClick={() => void cekKode()}>
            {sibuk ? "Memeriksa…" : "Lanjut"}
          </button>
          <p className="uj-kaki">SiPaling FISIP · Sistem Pelayanan Akademik Lingkungan FISIP</p>
        </div>
      </div>
    );
  }

  // ---------- LAYAR: IDENTITAS ----------
  if (layar === "identitas" && ujian) {
    const belumBuka = ujian.status === "terjadwal";
    const sudahTutup = ujian.status === "selesai";
    return (
      <div className="uj">
        <div className="uj-kotak">
          <span className="uj-lencana">{ujian.mataKuliah}</span>
          <h1>{ujian.judul}</h1>
          {ujian.kelas && <p className="uj-kelas">Kelas {ujian.kelas}</p>}

          <div className="uj-fakta">
            <div><b>{ujian.jumlahSoal || "-"}</b><span>soal</span></div>
            <div><b>{ujian.durasi}</b><span>menit</span></div>
            <div><b>{ujian.pakaiToken ? "Ya" : "Tidak"}</b><span>pakai kode</span></div>
          </div>

          {ujian.instruksi && <div className="uj-instruksi"><b>Instruksi</b><p>{ujian.instruksi}</p></div>}

          {belumBuka && (
            <div className="uj-kabar uj-kabar-tunggu">
              Ujian ini dibuka <b>{tanggalRapi(ujian.mulai)}</b>. Halaman ini boleh ditutup dulu,
              buka lagi saat waktunya tiba.
            </div>
          )}
          {sudahTutup && <div className="uj-kabar uj-kabar-tutup">Ujian ini sudah ditutup.</div>}

          {!belumBuka && !sudahTutup && (
            <>
              <label htmlFor="uj-nama">Nama Lengkap</label>
              <input id="uj-nama" className="uj-input" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama sesuai daftar hadir" autoComplete="name" />

              <label htmlFor="uj-nim">NIM</label>
              <input id="uj-nim" className="uj-input" value={nim} onChange={(e) => setNim(e.target.value.replace(/\D/g, ""))} placeholder="Nomor induk mahasiswa" inputMode="numeric" autoComplete="off" />

              {ujian.pakaiToken && (
                <>
                  <label htmlFor="uj-token">Kode dari Pengawas</label>
                  <input id="uj-token" className="uj-input uj-input-kode" value={token} onChange={(e) => setToken(e.target.value.toUpperCase())} placeholder="XXXXXX" autoComplete="off" />
                </>
              )}

              {galat && <p className="uj-galat" role="alert">{galat}</p>}
              <button type="button" className="uj-btn uj-btn-utama uj-btn-mulai" disabled={sibuk} onClick={() => void mulai()}>
                {sibuk ? "Menyiapkan…" : "MULAI UJIAN"}
              </button>
              <p className="uj-catatan">
                Waktu mulai berjalan begitu tombol ini ditekan. Jawabanmu tersimpan otomatis, jadi
                kalau jaringan sempat terputus, pekerjaanmu tidak hilang.
              </p>
            </>
          )}

          <button type="button" className="uj-btn uj-btn-sunyi" onClick={() => { setLayar("kode"); setGalat(""); }}>
            ← Ganti kode ujian
          </button>
        </div>
      </div>
    );
  }

  // ---------- LAYAR: SELESAI ----------
  if (layar === "selesai") {
    return (
      <div className="uj">
        <div className="uj-kotak uj-kotak-selesai">
          <div className="uj-ceklis" aria-hidden="true">✓</div>
          <h1>Selesai</h1>
          <p className="uj-lead">{pesanSelesai}</p>

          {hasil ? (
            <>
              <div className={`uj-nilai ${hasil.lulus ? "lulus" : "belum"}`}>
                <b>{hasil.nilai}</b>
                <span>{hasil.lulus ? "Lulus" : "Belum mencapai batas"} · batas {hasil.passing}</span>
              </div>
              <div className="uj-fakta">
                <div><b>{hasil.benar}</b><span>benar</span></div>
                {hasil.sebagian > 0 && (
                  <div><b>{hasil.sebagian}</b><span>benar sebagian</span></div>
                )}
                <div><b>{hasil.salah}</b><span>salah</span></div>
                <div><b>{hasil.kosong}</b><span>kosong</span></div>
              </div>
              {hasil.sebagian > 0 && (
                <p className="uj-catatan">
                  Soal pilihan jamak dan penjodohan dinilai per bagian, jadi jawaban yang benar
                  sebagian tetap mendapat nilai.
                </p>
              )}
              {hasil.tertunda > 0 && (
                <p className="uj-catatan">
                  {hasil.tertunda} soal essay menunggu koreksi dosen, jadi nilai ini masih bisa naik.
                </p>
              )}
            </>
          ) : (
            <p className="uj-catatan">
              Nilaimu diumumkan dosen setelah seluruh peserta selesai.
            </p>
          )}

          <p className="uj-kaki">Terima kasih. Halaman ini boleh ditutup.</p>
        </div>
      </div>
    );
  }

  // ---------- LAYAR: MENGERJAKAN ----------
  if (!soalKini) {
    return (
      <div className="uj">
        <div className="uj-kotak"><p className="uj-lead">Menyiapkan soal…</p></div>
      </div>
    );
  }

  const isi = jawaban[soalKini.id] ?? "";
  const jam = Math.floor(sisa / 3600);
  const menit = Math.floor((sisa % 3600) / 60);
  const detik = sisa % 60;
  const dua = (n: number) => String(n).padStart(2, "0");
  const raguKini = ditandai.includes(soalKini.id);
  const soalTerakhir = nomor >= soal.length - 1;

  const palet = soal.map((s, i) => (
    <button
      key={s.id}
      type="button"
      className={`ck-nomor ${keadaanSoal(s.id)}`}
      onClick={() => keSoal(i)}
      aria-label={`Soal ${i + 1}`}
      aria-current={i === nomor ? "true" : undefined}
    >
      {i + 1}
    </button>
  ));

  const legenda = (
    <ul className="ck-legenda">
      <li><i className="ck-tit hijau" aria-hidden="true" /> Hijau = Sudah dijawab</li>
      <li><i className="ck-tit oranye" aria-hidden="true" /> Orange = Ragu-ragu</li>
      <li><i className="ck-tit abu" aria-hidden="true" /> Abu-abu = Belum dijawab</li>
    </ul>
  );

  return (
    <div className="uj uj-kerja">
      {/* ---------- BILAH ATAS ---------- */}
      <header className="ck-bar">
        <div>
          <span className="ck-bar-nama">{nama || "Peserta"}</span>
          <span className="ck-bar-nim">{nim}</span>
        </div>
        <div className="ck-bar-tengah">{ujian?.judul}</div>
        <span className={`ck-simpan ck-simpan-${simpanan}`}>
          {simpanan === "aman" ? "✓ Tersimpan" : simpanan === "menyimpan" ? "Menyimpan…" : "Menyimpan ulang…"}
        </span>
        <button type="button" className="ck-logout" onClick={keluar}>Logout</button>
      </header>

      <div className="ck-layar">
        {/* ---------- KARTU SOAL ---------- */}
        <section className="ck-kartu">
          <div className="ck-kartu-kepala">
            <span className="ck-lencana ck-lencana-soal">SOAL NO. {nomor + 1}</span>
            <span
              className={`ck-lencana ck-lencana-waktu ${hampirHabis ? "genting" : ""}`}
              aria-live="polite"
            >
              SISA WAKTU <b>{dua(jam)}:{dua(menit)}:{dua(detik)}</b>
            </span>
          </div>

          <div className="ck-kartu-isi">
            <p className="ck-tanya">{soalKini.pertanyaan}</p>
            <MediaSoal media={soalKini.media} />

            {soalKini.jenis === "pg" || soalKini.jenis === "benar_salah" ? (
              <div className="ck-opsi-daftar" role="radiogroup" aria-label={`Pilihan jawaban soal ${nomor + 1}`}>
                {soalKini.pilihan.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={isi === String(i)}
                    className={`ck-opsi ${isi === String(i) ? "on" : ""}`}
                    onClick={() => jawab(soalKini.id, String(i))}
                  >
                    <span className="ck-bulat" aria-hidden="true"><i /></span>
                    <span className="ck-opsi-huruf">{String.fromCharCode(65 + i)}.</span>
                    <span className="ck-opsi-teks">{p}</span>
                  </button>
                ))}
              </div>
            ) : soalKini.jenis === "pg_kompleks" ? (
              <div className="ck-opsi-daftar" aria-label={`Pilihan jawaban soal ${nomor + 1}`}>
                <p className="ck-petunjuk">Boleh memilih lebih dari satu jawaban.</p>
                {soalKini.pilihan.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    role="checkbox"
                    aria-checked={tercentang(soalKini.id, i)}
                    className={`ck-opsi ${tercentang(soalKini.id, i) ? "on" : ""}`}
                    onClick={() => centang(soalKini.id, i)}
                  >
                    {/* Kotak, bukan lingkaran. Bentuknya sendiri yang harus
                        mengatakan bahwa jawabannya boleh lebih dari satu. */}
                    <span className="ck-kotak" aria-hidden="true">{tercentang(soalKini.id, i) ? "✓" : ""}</span>
                    <span className="ck-opsi-huruf">{String.fromCharCode(65 + i)}.</span>
                    <span className="ck-opsi-teks">{p}</span>
                  </button>
                ))}
              </div>
            ) : soalKini.jenis === "penjodohan" ? (
              <div className="ck-jodoh">
                <p className="ck-petunjuk">Pilih pasangan yang tepat untuk setiap baris.</p>
                {soalKini.kiri.map((kiri, i) => (
                  <div key={i} className="ck-jodoh-baris">
                    <span className="ck-jodoh-nomor">{i + 1}</span>
                    <span className="ck-jodoh-kiri">{kiri}</span>
                    <select
                      className="ck-jodoh-pilih"
                      value={pasanganKini(soalKini.id, i)}
                      onChange={(e) => jodohkan(soalKini.id, i, e.target.value)}
                      aria-label={`Pasangan untuk ${kiri}`}
                    >
                      <option value="">Pilih pasangan</option>
                      {soalKini.pilihan.map((p, n) => (
                        <option key={n} value={String(n)}>{String.fromCharCode(65 + n)}. {p}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : soalKini.jenis === "isian" ? (
              <input
                className="ck-isian"
                value={isi}
                onChange={(e) => jawab(soalKini.id, e.target.value)}
                placeholder="Tulis jawaban singkatmu"
                autoComplete="off"
              />
            ) : (
              <textarea
                className="ck-essay"
                value={isi}
                onChange={(e) => jawab(soalKini.id, e.target.value)}
                placeholder="Tulis jawabanmu di sini"
                rows={10}
              />
            )}

            {!jawabanKosong(soalKini.jenis, isi) && (
              <button type="button" className="ck-hapus" onClick={() => jawab(soalKini.id, "")}>
                Hapus jawaban soal ini
              </button>
            )}

            {galat && <p className="ck-galat" role="alert">{galat}</p>}
          </div>

          <div className="ck-kartu-kaki">
            <button
              type="button"
              className="ck-tbl ck-biru ck-mundur"
              disabled={nomor === 0 || ujian?.bisaKembali === false}
              onClick={() => keSoal(Math.max(0, nomor - 1))}
            >
              ‹ SOAL SEBELUMNYA
            </button>
            <button
              type="button"
              className={`ck-tbl ck-ragu ${raguKini ? "on" : ""}`}
              aria-pressed={raguKini}
              onClick={() => void tandai(soalKini.id)}
            >
              {raguKini ? "✓ RAGU-RAGU" : "RAGU-RAGU"}
            </button>
            {/* Pada soal terakhir tombol ini berhenti menjadi tombol jalan dan
                menjadi tombol akhir. Warnanya ikut berganti merah supaya tangan
                yang sudah hafal letaknya sadar bahwa ketukan berikutnya bukan
                pindah soal lagi, melainkan menutup ujian. */}
            {soalTerakhir ? (
              <button
                type="button"
                className="ck-tbl ck-akhiri ck-maju"
                disabled={sibuk}
                onClick={mintaKumpul}
              >
                {sibuk ? "MENGUMPULKAN…" : "AKHIRI UJIAN"}
              </button>
            ) : (
              <button
                type="button"
                className="ck-tbl ck-biru ck-maju"
                onClick={() => keSoal(Math.min(soal.length - 1, nomor + 1))}
              >
                SOAL SELANJUTNYA ›
              </button>
            )}
          </div>
        </section>

        {/* ---------- PANEL NOMOR SOAL ----------
            Selalu terlihat, di layar lebar maupun di ponsel. Sebelumnya di
            ponsel ia disembunyikan di balik laci yang harus diketuk dulu, dan
            akibatnya satu-satunya penanda soal mana yang sudah dijawab justru
            tidak kelihatan pada layar yang paling banyak dipakai mengerjakan.
            Di ponsel panel ini turun ke bawah kartu soal, mengisi ruang yang
            memang kosong. */}
        <aside className="ck-sisi">
          <div className="ck-panel">
            <div className="ck-panel-kepala">NOMOR SOAL</div>
            <div className="ck-grid">{palet}</div>
            {legenda}
            <p className="ck-ringkas">
              <b>{terjawab}</b> dari <b>{soal.length}</b> soal sudah dijawab
              {ditandai.length > 0 && <> · <b>{ditandai.length}</b> ditandai ragu-ragu</>}
            </p>
          </div>

          {/* Tombol berhenti berdiri di kartunya sendiri, terpisah dan berjarak
              dari tombol jalan — sekali tertekan, ujiannya tidak dapat dibuka
              kembali. */}
          <div className="ck-panel ck-panel-henti">
            <button type="button" className="ck-henti" disabled={sibuk} onClick={mintaKumpul}>
              {sibuk ? "MENGUMPULKAN…" : "HENTIKAN UJIAN"}
            </button>
            <p className="ck-henti-catatan">
              Jawabanmu dikumpulkan dan ujian ditutup. Tidak dapat dibuka lagi.
            </p>
          </div>
        </aside>
      </div>

    </div>
  );
}
