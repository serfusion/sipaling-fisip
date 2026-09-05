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
import { ejaWaktu, type JenisSoal } from "@/lib/cbt";

type Ujian = {
  kode: string; judul: string; mataKuliah: string; kelas: string | null;
  deskripsi: string | null; instruksi: string | null;
  durasi: number; jumlahSoal: number; pakaiToken: boolean;
  bisaKembali: boolean; tampilkanNilai: boolean;
  status: string; mulai: string | null; selesai: string | null;
};

type Soal = { id: number; jenis: JenisSoal; pertanyaan: string; pilihan: string[]; bobot: number };

type Hasil = {
  nilai: number; benar: number; salah: number; kosong: number;
  tertunda: number; lulus: boolean; passing: number;
};

const KUNCI_SIMPAN = "sipaling-ujian-sesi";
const JEDA_SIMPAN_MS = 900;

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
  // Soal yang pernah dibuka. Dipakai membedakan "belum dijawab" dari "belum
  // dibuka sama sekali" pada palet nomor — pembedaan yang ada di rujukan
  // rancangannya, dan yang membuat mahasiswa tahu sisa pekerjaannya.
  const [dibuka, setDibuka] = useState<number[]>([]);
  const [bukaNav, setBukaNav] = useState(false);
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
          `${tertinggal} jawaban belum sampai ke server — sepertinya jaringanmu sedang terputus. ` +
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
        body: JSON.stringify({ aksi: "masuk", kode: ujian?.kode, nama, nim, token }),
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

  function keSoal(index: number) {
    setNomor(index);
    const id = soal[index]?.id;
    if (id !== undefined) setDibuka((kini) => (kini.includes(id) ? kini : [...kini, id]));
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
   * Keadaan satu soal pada palet nomor.
   *
   * Urutannya menentukan: soal yang sudah dijawab LALU ditandai tetap terbaca
   * "ditinjau", karena itulah yang ingin dilihat mahasiswa — daftar soal yang
   * sengaja ia sisihkan untuk dilihat lagi sebelum mengumpulkan.
   */
  function keadaanSoal(id: number, index: number): "kini" | "tinjau" | "isi" | "kosong" | "belum" {
    if (index === nomor) return "kini";
    if (ditandai.includes(id)) return "tinjau";
    if (String(jawaban[id] ?? "").trim()) return "isi";
    if (dibuka.includes(id)) return "kosong";
    return "belum";
  }

  const terjawab = soal.filter((s) => String(jawaban[s.id] ?? "").trim()).length;
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
            <div><b>{ujian.jumlahSoal || "—"}</b><span>soal</span></div>
            <div><b>{ujian.durasi}</b><span>menit</span></div>
            <div><b>{ujian.pakaiToken ? "Ya" : "Tidak"}</b><span>pakai kode</span></div>
          </div>

          {ujian.instruksi && <div className="uj-instruksi"><b>Instruksi</b><p>{ujian.instruksi}</p></div>}

          {belumBuka && (
            <div className="uj-kabar uj-kabar-tunggu">
              Ujian ini dibuka <b>{tanggalRapi(ujian.mulai)}</b>. Halaman ini boleh ditutup dulu —
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
                <div><b>{hasil.salah}</b><span>salah</span></div>
                <div><b>{hasil.kosong}</b><span>kosong</span></div>
              </div>
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

  return (
    <div className="uj uj-kerja">
      <div className="uj-layar">
        {/* ---------- KIRI: SOALNYA ---------- */}
        <section className="uj-utama">
          <header className="uj-judul">{ujian?.judul}</header>

          <div className="uj-isi">
            <div className="uj-soal-kepala">
              <h2>{ujian?.mataKuliah} — Soal {nomor + 1}</h2>
              <span className={`uj-simpan uj-simpan-${simpanan}`}>
                {simpanan === "aman" ? "✓ Tersimpan" : simpanan === "menyimpan" ? "Menyimpan…" : "Menyimpan ulang…"}
              </span>
            </div>

            <p className="uj-tanya">{soalKini.pertanyaan}</p>

            {soalKini.jenis === "pg" || soalKini.jenis === "benar_salah" ? (
              <div className="uj-pilihan">
                {soalKini.pilihan.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`uj-opsi ${isi === String(i) ? "on" : ""}`}
                    onClick={() => jawab(soalKini.id, String(i))}
                  >
                    <span className="uj-kotakcek" aria-hidden="true">{isi === String(i) ? "✓" : ""}</span>
                    <span className="uj-opsi-huruf">{String.fromCharCode(65 + i)}.</span>
                    <span className="uj-opsi-teks">{p}</span>
                  </button>
                ))}
              </div>
            ) : soalKini.jenis === "isian" ? (
              <input
                className="uj-input uj-isian"
                value={isi}
                onChange={(e) => jawab(soalKini.id, e.target.value)}
                placeholder="Tulis jawaban singkatmu"
                autoComplete="off"
              />
            ) : (
              <textarea
                className="uj-essay"
                value={isi}
                onChange={(e) => jawab(soalKini.id, e.target.value)}
                placeholder="Tulis jawabanmu di sini"
                rows={10}
              />
            )}

            {isi !== "" && (
              <button type="button" className="uj-hapus" onClick={() => jawab(soalKini.id, "")}>
                Hapus jawaban soal ini
              </button>
            )}

            {galat && <p className="uj-galat" role="alert">{galat}</p>}
          </div>

          {/* Baris tombol menempel di dasar kolom, persis seperti rujukannya:
              tinjau di kiri, jalan mundur-maju di tengah, kumpulkan di kanan
              dan berjarak — supaya tidak tertekan ketika yang dituju "Next". */}
          <div className="uj-aksi">
            <button
              type="button"
              className={`uj-tbl uj-tbl-tinjau ${ditandai.includes(soalKini.id) ? "on" : ""}`}
              onClick={() => void tandai(soalKini.id)}
            >
              {ditandai.includes(soalKini.id) ? "Batal tinjau" : "Tandai untuk ditinjau"}
            </button>
            <button
              type="button"
              className="uj-tbl uj-tbl-biru"
              disabled={nomor === 0 || ujian?.bisaKembali === false}
              onClick={() => keSoal(Math.max(0, nomor - 1))}
            >
              Sebelumnya
            </button>
            <button
              type="button"
              className="uj-tbl uj-tbl-biru"
              disabled={nomor >= soal.length - 1}
              onClick={() => keSoal(Math.min(soal.length - 1, nomor + 1))}
            >
              Berikutnya
            </button>
            <button
              type="button"
              className="uj-tbl uj-tbl-hijau uj-tbl-kumpul"
              disabled={sibuk}
              onClick={() => {
                const kosong = soal.length - terjawab;
                const pesan = kosong > 0
                  ? `Masih ada ${kosong} soal yang belum dijawab. Kumpulkan sekarang?`
                  : "Kumpulkan jawabanmu sekarang?";
                if (window.confirm(pesan)) void kumpulkan(false);
              }}
            >
              {sibuk ? "Mengumpulkan…" : "Kumpulkan Jawaban"}
            </button>
          </div>

          <div className="uj-legenda">
            <span><i className="uj-tit kini" /> Sedang dibuka</span>
            <span><i className="uj-tit belum" /> Belum dibuka</span>
            <span><i className="uj-tit isi" /> Sudah dijawab</span>
            <span><i className="uj-tit kosong" /> Belum dijawab</span>
            <span><i className="uj-tit tinjau" /> Ditandai</span>
          </div>
        </section>

        {/* ---------- KANAN: WAKTU DAN PALET NOMOR ---------- */}
        <aside className="uj-sisi">
          <div className="uj-sisi-judul">Sisa Waktu</div>
          <div className={`uj-jam ${hampirHabis ? "genting" : ""}`} aria-live="polite">
            <div><b>{dua(jam)}</b><small>jam</small></div>
            <div><b>{dua(menit)}</b><small>menit</small></div>
            <div><b>{dua(detik)}</b><small>detik</small></div>
          </div>

          <div className="uj-sisi-judul">{ujian?.mataKuliah}</div>
          <div className="uj-palet">
            {soal.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`uj-nomor ${keadaanSoal(s.id, i)}`}
                onClick={() => keSoal(i)}
                aria-label={`Soal ${i + 1}`}
                aria-current={i === nomor ? "true" : undefined}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <div className="uj-ringkas">
            <b>{terjawab}</b> dari {soal.length} soal sudah dijawab
            {ditandai.length > 0 && <span>{ditandai.length} ditandai untuk ditinjau</span>}
          </div>
        </aside>
      </div>

      {/* Di ponsel palet nomornya disembunyikan dan diganti satu tombol yang
          membuka panelnya — menggulir jauh ke bawah untuk mencari nomor soal
          berarti kehilangan tempat pada soal yang sedang dibaca. */}
      <button type="button" className="uj-tombol-nav" onClick={() => setBukaNav(true)}>
        <b>{terjawab}/{soal.length}</b> terjawab · <span>{ejaWaktu(sisa)}</span> · lihat semua soal
      </button>

      {bukaNav && (
        <div className="uj-tirai" role="dialog" aria-label="Daftar soal">
          <div className="uj-panel">
            <div className="uj-panel-kepala">
              <b>Daftar soal</b>
              <button type="button" className="uj-tutup" onClick={() => setBukaNav(false)} aria-label="Tutup">✕</button>
            </div>
            <p className="uj-panel-info">
              {terjawab} dari {soal.length} soal sudah dijawab
              {soal.length - terjawab > 0 && ` · ${soal.length - terjawab} masih kosong`}
            </p>
            <div className="uj-palet uj-palet-panel">
              {soal.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className={`uj-nomor ${keadaanSoal(s.id, i)}`}
                  onClick={() => { keSoal(i); setBukaNav(false); }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="uj-legenda uj-legenda-panel">
              <span><i className="uj-tit isi" /> Sudah dijawab</span>
              <span><i className="uj-tit kosong" /> Belum dijawab</span>
              <span><i className="uj-tit tinjau" /> Ditandai</span>
            </div>
            <button
              type="button"
              className="uj-tbl uj-tbl-hijau"
              disabled={sibuk}
              onClick={() => {
                const kosong = soal.length - terjawab;
                const pesan = kosong > 0
                  ? `Masih ada ${kosong} soal yang belum dijawab. Kumpulkan sekarang?`
                  : "Kumpulkan jawabanmu sekarang?";
                if (window.confirm(pesan)) void kumpulkan(false);
              }}
            >
              {sibuk ? "Mengumpulkan…" : "Kumpulkan Jawaban"}
            </button>
            <button type="button" className="uj-btn uj-btn-sunyi" onClick={() => setBukaNav(false)}>
              Kembali mengerjakan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
