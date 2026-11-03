"use client";

// ============================================================
// PENGUMPULAN TUGAS — situs CBT (cbt.<domain>/tugas)
//
// Tiga layar, tanpa akun:
//
//   1. Kode tugas      dari pengajar, dibacakan di kelas atau lewat grup
//   2. Identitas & PDF nama, nomor peserta, dan berkas PDF tugasnya
//   3. Tanda terima    kode SIPALING-TUGAS-XXXXXXXX untuk melacak nilai
//
// PDF-NYA TIDAK DIUNGGAH. Peramban peserta membaca PDF itu sendiri,
// menyusunnya menjadi teks Markdown (src/lib/pdf-markdown.ts), menghitung
// sidik SHA-256-nya, lalu hanya teks dan sidik itu yang dikirim. Peserta
// melihat sendiri teks yang akan dikirim sebelum menekan Kumpulkan.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import KreditCbt, { KREDIT_CBT } from "../kredit";
import { pdfKeMarkdown } from "@/lib/pdf-markdown";
import { rapikanKodeResi, sidikBerkas } from "@/lib/tugas-kode";

type InfoTugas = {
  kode: string; mataKuliah: string; nomor: string; judul: string; pengajar: string; kelas: string;
  tenggat: string | null; terbuka: boolean; alasanTutup: string; terbit: boolean;
};

type Bacaan =
  | { status: "kosong" }
  | { status: "membaca"; kemajuan: string }
  | { status: "siap" | "kurang"; markdown: string; halaman: number; kata: number; sidik: string; catatan: string[] }
  | { status: "galat"; pesan: string };

type TandaTerima = {
  kode: string; diganti?: boolean; tugas: InfoTugas;
  kiriman: { nama: string; nim: string; berkas: string; halaman: number; kata: number; sidik: string; waktu: string };
};

const MAKS_PDF = 60 * 1024 * 1024;
const MIN_KATA = 20;

const waktuWib = (iso: string) =>
  `${new Date(iso).toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB`;

const ukuran = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const judulTugas = (t: InfoTugas) => [t.nomor && `Tugas ${t.nomor}`, t.judul].filter(Boolean).join(": ") || "Tugas";

export default function KumpulTugas({ awalan = "/cbt" }: { awalan?: string }) {
  const [tahap, setTahap] = useState<"kode" | "isi" | "selesai">("kode");
  const [kode, setKode] = useState("");
  const [info, setInfo] = useState<InfoTugas | null>(null);
  const [nama, setNama] = useState("");
  const [nim, setNim] = useState("");
  const [berkas, setBerkas] = useState<File | null>(null);
  const [bacaan, setBacaan] = useState<Bacaan>({ status: "kosong" });
  const [kodeLama, setKodeLama] = useState("");
  const [gantiKiriman, setGantiKiriman] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [terima, setTerima] = useState<TandaTerima | null>(null);
  const [disalin, setDisalin] = useState(false);

  const bukaTugas = useCallback(async (isi: string) => {
    const k = isi.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!k) { setGalat("Kode tugas belum diisi."); return; }
    setSibuk(true); setGalat("");
    try {
      const jawab = await fetch(`/api/cbt/kumpul?kode=${encodeURIComponent(k)}`, { cache: "no-store" });
      const d = await jawab.json();
      if (!jawab.ok || !d.success) throw new Error(d.message || "Kode tugas tidak ditemukan.");
      setInfo(d.tugas);
      setKode(k);
      setTahap("isi");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Kode tugas tidak ditemukan.");
    } finally {
      setSibuk(false);
    }
  }, []);

  // Tautan dari pengajar membawa kodenya (…/tugas?kode=K7M2QX).
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("kode");
    if (!k) return;
    const jam = setTimeout(() => { setKode(k.toUpperCase()); void bukaTugas(k); }, 0);
    return () => clearTimeout(jam);
  }, [bukaTugas]);

  async function pilihBerkas(f: File | undefined) {
    setGalat("");
    if (!f) return;
    setBerkas(f);
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
      setBacaan({ status: "galat", pesan: "Tugas dikumpulkan dalam bentuk PDF (.pdf). Simpan atau ekspor dokumen Anda sebagai PDF lebih dulu." });
      return;
    }
    if (f.size > MAKS_PDF) {
      setBacaan({ status: "galat", pesan: "PDF ini lebih dari 60 MB. Kompres gambarnya atau pisahkan lampirannya." });
      return;
    }
    setBacaan({ status: "membaca", kemajuan: "membuka berkas…" });
    try {
      const data = new Uint8Array(await f.arrayBuffer());
      const [h, sidik] = await Promise.all([
        pdfKeMarkdown(data, { lapor: (sudah, total) => setBacaan({ status: "membaca", kemajuan: `halaman ${sudah} dari ${total}` }) }),
        sidikBerkas(data),
      ]);
      setBacaan({ status: h.kata >= MIN_KATA ? "siap" : "kurang", markdown: h.markdown, halaman: h.halaman, kata: h.kata, sidik, catatan: h.catatan });
    } catch (e) {
      setBacaan({ status: "galat", pesan: e instanceof Error ? e.message : "PDF ini tidak dapat dibaca." });
    }
  }

  async function kumpulkan() {
    if (!info || !berkas || bacaan.status !== "siap") return;
    setSibuk(true); setGalat("");
    try {
      const jawab = await fetch("/api/cbt/kumpul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode, nim, nama,
          berkas: { nama: berkas.name, ukuran: berkas.size, sidik: bacaan.sidik, halaman: bacaan.halaman },
          markdown: bacaan.markdown,
          kodeLama: gantiKiriman ? kodeLama : "",
        }),
      });
      const d = await jawab.json().catch(() => ({ success: false, message: `Server menjawab ${jawab.status}.` }));
      if (jawab.status === 409 && d.sudahAda) {
        setGantiKiriman(true);
        throw new Error(d.message);
      }
      if (!jawab.ok || !d.success) throw new Error(d.message || "Tugas belum dapat dikumpulkan.");
      setTerima(d);
      setTahap("selesai");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Tugas belum dapat dikumpulkan.");
    } finally {
      setSibuk(false);
    }
  }

  function unduhTandaTerima() {
    if (!terima) return;
    const t = terima.tugas;
    const k = terima.kiriman;
    const papan = `${window.location.origin}${awalan}/papan`;
    const baris = (label: string, nilai: string) => `${label.padEnd(20)} : ${nilai}`;
    const isi = [
      "TANDA TERIMA PENGUMPULAN TUGAS",
      "SiPaling CBT · Disusun menggunakan Software SPF",
      "",
      baris("Kode kiriman", terima.kode),
      baris("Nama", k.nama),
      baris("NIM / No. Peserta", k.nim),
      baris("Mata Kuliah / Materi", t.mataKuliah || "-"),
      baris("Tugas", judulTugas(t)),
      baris("Pengajar", t.pengajar || "-"),
      baris("Berkas", `${k.berkas} (${k.halaman} halaman, ${k.kata} kata)`),
      baris("SHA-256", k.sidik),
      baris("Dikumpulkan", waktuWib(k.waktu)),
      "",
      "Simpan kode ini. Kode inilah satu-satunya kunci untuk membuka keterangan nilai",
      `Anda di Papan Nilai: ${papan}`,
      "",
      "SHA-256 di atas adalah sidik PDF yang Anda kumpulkan. Bila nilai dipersoalkan,",
      "sidik PDF yang Anda pegang dapat dicocokkan dengan sidik ini.",
      "",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([isi], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `TANDA_TERIMA_${terima.kode}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function ulang() {
    setTahap("kode"); setInfo(null); setBerkas(null); setBacaan({ status: "kosong" }); setTerima(null);
    setKodeLama(""); setGantiKiriman(false); setGalat(""); setDisalin(false);
  }

  const lengkap = nama.trim().length >= 3 && nim.replace(/\D/g, "").length >= 5 && bacaan.status === "siap" &&
    (!gantiKiriman || Boolean(rapikanKodeResi(kodeLama)));

  return (
    <div className="cbtd">
      {/* ---------- KIRI: JENAMA ---------- */}
      <aside className="cbtd-kiri">
        <div className="cbtd-lambang" aria-hidden="true">📤</div>
        <h1>Kumpulkan Tugas</h1>
        <p className="cbtd-sub">Kumpulkan tugas dalam bentuk PDF dan terima kode untuk melacak nilai Anda.</p>
        <ul className="cbtd-nilai">
          <li>Cukup kode tugas dari pengajar, nama, nomor peserta, dan PDF tugas Anda.</li>
          <li>PDF dibaca menjadi teks di perangkat Anda sendiri. Berkasnya tidak disimpan di server.</li>
          <li>Anda langsung menerima kode SIPALING-TUGAS. Simpan baik-baik: kode itu kunci keterangan nilai Anda.</li>
          <li>Nilai diumumkan di Papan Nilai setelah diterbitkan pengajar.</li>
        </ul>
        <p className="cbtd-kaki-kiri"><a href={`${awalan}/papan`}>Buka Papan Nilai</a> · <a href={awalan || "/"}>Ujian (CBT)</a></p>
        <p className="cbtd-kredit-kiri">{KREDIT_CBT}</p>
      </aside>

      {/* ---------- KANAN ---------- */}
      <main className="cbtd-kanan">
        <div className="cbtd-kotak kt">
          {tahap === "kode" && (
            <>
              <h2>Kode Tugas</h2>
              <p className="cbtd-lead">Masukkan kode pengumpulan dari pengajar Anda.</p>
              <label htmlFor="kt-kode">Kode tugas</label>
              <input
                id="kt-kode" className="cbtd-input cbtd-input-kode" value={kode} autoFocus autoComplete="off" placeholder="XXXXXX"
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") void bukaTugas(kode); }}
              />
              {galat && <p className="cbtd-galat" role="alert">{galat}</p>}
              <button type="button" className="cbtd-btn" disabled={sibuk} onClick={() => void bukaTugas(kode)}>
                {sibuk ? "Memeriksa…" : "Lanjut"}
              </button>
              <p className="cbtd-bantu">
                Sudah mengumpulkan? Cek status dan nilai dengan kode SIPALING-TUGAS Anda di <a href={`${awalan}/papan`}>Papan Nilai</a>.
              </p>
            </>
          )}

          {tahap === "isi" && info && (
            <>
              <div className="kt-tugas">
                <small>{info.mataKuliah || "Tugas"}{info.kelas ? ` · Kelas ${info.kelas}` : ""}</small>
                <b>{judulTugas(info)}</b>
                {info.pengajar && <span>{info.pengajar}</span>}
                {info.tenggat && <span className={info.terbuka ? "" : "tutup"}>Batas: {waktuWib(info.tenggat)}</span>}
                <button type="button" className="kt-ganti" onClick={ulang}>Ganti kode</button>
              </div>

              {!info.terbuka ? (
                <p className="cbtd-galat" role="alert">{info.alasanTutup} Hubungi pengajar bila Anda belum mengumpulkan.</p>
              ) : (
                <>
                  <label htmlFor="kt-nama">Nama lengkap</label>
                  <input id="kt-nama" className="cbtd-input" value={nama} autoComplete="name" onChange={(e) => setNama(e.target.value)} placeholder="Sesuai daftar kelas" />
                  <label htmlFor="kt-nim" className="kt-jarak">NIM / Nomor Peserta</label>
                  <input id="kt-nim" className="cbtd-input" value={nim} inputMode="numeric" autoComplete="off" onChange={(e) => setNim(e.target.value.replace(/\D/g, ""))} placeholder="Nomor induk / nomor peserta" />

                  <label className="kt-jarak">Berkas tugas (PDF)</label>
                  <label className={`kt-pilih ${bacaan.status}`}>
                    <input type="file" accept="application/pdf,.pdf" onChange={(e) => { void pilihBerkas(e.target.files?.[0]); e.target.value = ""; }} />
                    <span>{berkas ? berkas.name : "Pilih PDF tugas…"}</span>
                    <small>{berkas ? ukuran(berkas.size) : "Paling besar 60 MB"}</small>
                  </label>

                  {bacaan.status === "membaca" && <p className="kt-baca">Membaca PDF menjadi teks: {bacaan.kemajuan}</p>}
                  {bacaan.status === "galat" && <p className="cbtd-galat" role="alert">{bacaan.pesan}</p>}
                  {(bacaan.status === "siap" || bacaan.status === "kurang") && (
                    <div className={`kt-hasil ${bacaan.status}`}>
                      <b>{bacaan.status === "siap" ? "✓ PDF terbaca" : "✕ PDF hampir tanpa teks"}</b>
                      <span>{bacaan.halaman} halaman · {bacaan.kata.toLocaleString("id-ID")} kata</span>
                      {bacaan.status === "kurang" && (
                        <span>PDF ini kemungkinan hasil pindaian atau foto, sehingga isinya tidak dapat dibaca sebagai teks. Ekspor ulang dari Word/Google Docs sebagai PDF.</span>
                      )}
                      {bacaan.status === "siap" && bacaan.catatan.map((c) => <span key={c}>{c}</span>)}
                      {bacaan.status === "siap" && (
                        <details>
                          <summary>Lihat teks yang akan dikirim (.md)</summary>
                          <pre>{bacaan.markdown.length > 6000 ? `${bacaan.markdown.slice(0, 6000)}\n\n… (${(bacaan.markdown.length - 6000).toLocaleString("id-ID")} huruf lagi)` : bacaan.markdown}</pre>
                        </details>
                      )}
                    </div>
                  )}

                  <label className="kt-centang">
                    <input type="checkbox" checked={gantiKiriman} onChange={(e) => setGantiKiriman(e.target.checked)} />
                    <span>Saya pernah mengumpulkan tugas ini dan ingin menggantinya</span>
                  </label>
                  {gantiKiriman && (
                    <>
                      <label htmlFor="kt-lama">Kode SIPALING-TUGAS kiriman sebelumnya</label>
                      <input id="kt-lama" className="cbtd-input" value={kodeLama} autoComplete="off" placeholder="SIPALING-TUGAS-XXXXXXXX"
                        onChange={(e) => setKodeLama(e.target.value.toUpperCase())} />
                      <p className="cbtd-bantu">Kodenya tetap sama; isi kiriman diganti dan dinilai ulang.</p>
                    </>
                  )}

                  {galat && <p className="cbtd-galat" role="alert">{galat}</p>}
                  <button type="button" className="cbtd-btn" disabled={sibuk || !lengkap} onClick={() => void kumpulkan()}>
                    {sibuk ? "Mengumpulkan…" : "Kumpulkan tugas"}
                  </button>
                  <p className="cbtd-bantu">
                    Yang dikirim hanya teks di atas dan sidik (SHA-256) PDF Anda, bukan berkas PDF-nya. Simpan PDF asli
                    Anda: sidiknya dapat dicocokkan bila nilai dipersoalkan.
                  </p>
                </>
              )}
            </>
          )}

          {tahap === "selesai" && terima && (
            <>
              <div className="kt-sukses" aria-hidden="true">✓</div>
              <h2>{terima.diganti ? "Kiriman diganti" : "Tugas terkumpul"}</h2>
              <p className="cbtd-lead">{judulTugas(terima.tugas)}{terima.tugas.mataKuliah ? ` · ${terima.tugas.mataKuliah}` : ""}</p>
              <div className="kt-resi">
                <small>Kode kiriman Anda</small>
                <b>{terima.kode}</b>
                <button type="button" className="kt-salin" onClick={() => { void navigator.clipboard?.writeText(terima.kode); setDisalin(true); }}>
                  {disalin ? "✓ Disalin" : "Salin kode"}
                </button>
              </div>
              <p className="kt-penting">
                <b>Simpan kode ini.</b> Kode inilah satu-satunya kunci untuk membuka keterangan nilai Anda di Papan Nilai,
                ibarat kata sandi. Jangan bagikan kepada orang lain.
              </p>
              <dl className="kt-rinci">
                <dt>Nama</dt><dd>{terima.kiriman.nama}</dd>
                <dt>NIM / No. Peserta</dt><dd>{terima.kiriman.nim}</dd>
                <dt>Berkas</dt><dd>{terima.kiriman.berkas} · {terima.kiriman.halaman} halaman · {terima.kiriman.kata.toLocaleString("id-ID")} kata</dd>
                <dt>Waktu</dt><dd>{waktuWib(terima.kiriman.waktu)}</dd>
                <dt>SHA-256</dt><dd><code>{terima.kiriman.sidik}</code></dd>
              </dl>
              <button type="button" className="cbtd-btn" onClick={unduhTandaTerima}>⇩ Unduh tanda terima (.txt)</button>
              <a className="cbtd-btn cbtd-btn-tautan kt-kedua" href={`${awalan}/papan`}>Buka Papan Nilai</a>
              <button type="button" className="kt-ganti kt-lagi" onClick={ulang}>Kumpulkan tugas lain</button>
            </>
          )}

          <KreditCbt />
        </div>
      </main>
    </div>
  );
}
