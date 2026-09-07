"use client";

// ============================================================
// HALAMAN DEPAN SITUS CBT
//
// Dua pintu, dan pengunjung memilih lebih dulu siapa dirinya — persis seperti
// rujukan rancangan yang diberikan pemilik portal.
//
// Tidak ada nama lembaga di halaman ini, dan itu disengaja: CBT berdiri
// sebagai produk yang sama untuk siapa pun yang memasangnya. Nama pemakainya
// muncul dari isi ujiannya sendiri — mata uji, kelas, dan kop cetak yang
// dapat diatur — bukan dari tulisan yang tertanam di dalam kodenya.
//
//   Peserta     : cukup kode ujian. Nama dan nomornya diisi pada layar berikutnya,
//                 sesudah ujiannya ketemu — supaya yang salah kode tidak
//                 terlanjur mengetik identitasnya untuk ujian yang tidak ada.
//   Pengajar/Admin: masuk lewat akun portal yang sudah ada.
//
// TIDAK ADA PENDAFTARAN PESERTA dan tidak ada PIN. Itu keputusan pemilik
// portalnya, dan bukan kekurangan: satu kode yang dibacakan di depan kelas
// jauh lebih tahan daripada tiga puluh PIN yang harus dibagikan lebih dulu.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adalahHostCbt } from "@/lib/situs-cbt";
import KreditCbt, { KREDIT_CBT } from "./kredit";

/**
 * @param portal Asal portal induk tempat akun pengajar dan admin berada, dipakai
 *   HANYA untuk tautan masuk mereka. Kosong berarti halaman ini memang sedang
 *   dibuka di portal itu sendiri, dan alamat relatif sudah benar.
 */
export default function MasukCbt({ portal = "" }: { portal?: string }) {
  const router = useRouter();
  const [pintu, setPintu] = useState<"peserta" | "pengajar">("peserta");
  const [kode, setKode] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function lanjut() {
    const isi = kode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!isi) { setGalat("Kode ujian belum diisi."); return; }
    setSibuk(true); setGalat("");
    try {
      // Kodenya diperiksa DI SINI, sebelum berpindah halaman. Peserta yang
      // salah ketik satu huruf lebih baik tahu sekarang daripada sesudah
      // mengisi nama dan nomor peserta pada layar berikutnya.
      const jawab = await fetch(`/api/cbt/ikut?kode=${encodeURIComponent(isi)}`, { cache: "no-store" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Ujian tidak ditemukan.");
      // Di subdomain, layar ujian beralamat /ujian; di domain portal ia masih
      // /cbt/ujian. Yang dipilih di sini alamat yang memang berlaku pada tuan
      // rumah yang sedang dibuka, supaya perpindahannya satu langkah saja —
      // tanpa singgah di pengalihan, yang pada jaringan kampus yang tersendat
      // terasa seperti tombol yang tidak menjawab.
      const jalur = adalahHostCbt(window.location.host) ? "/ujian" : "/cbt/ujian";
      router.push(`${jalur}?kode=${encodeURIComponent(isi)}`);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Ujian tidak ditemukan.");
      setSibuk(false);
    }
  }

  return (
    <div className="cbtd">
      {/* ---------- KIRI: JENAMA ---------- */}
      <aside className="cbtd-kiri">
        <div className="cbtd-lambang" aria-hidden="true">📝</div>
        <h1>SiPaling CBT</h1>
        <p className="cbtd-sub">
          Ujian Berbasis Komputer. Pilihan ganda, penjodohan, isian, dan esai
        </p>
        <ul className="cbtd-nilai">
          <li>Tidak perlu membuat akun. Cukup kode ujian, nama, dan nomor peserta.</li>
          <li>Jawaban tersimpan otomatis tiap sepuluh detik.</li>
          <li>Waktu dihitung di server, jadi aman walau jaringan tersendat.</li>
          <li>Nyaman dikerjakan dari ponsel maupun komputer.</li>
        </ul>
        <p className="cbtd-kredit-kiri">{KREDIT_CBT}</p>
      </aside>

      {/* ---------- KANAN: PINTU MASUK ---------- */}
      <main className="cbtd-kanan">
        <div className="cbtd-kotak">
          <h2>Masuk</h2>
          <p className="cbtd-lead">Pilih dahulu Anda masuk sebagai siapa.</p>

          <div className="cbtd-tab" role="tablist">
            <button
              type="button" role="tab" aria-selected={pintu === "peserta"}
              className={pintu === "peserta" ? "on" : ""}
              onClick={() => { setPintu("peserta"); setGalat(""); }}
            >
              Mahasiswa / Peserta
            </button>
            <button
              type="button" role="tab" aria-selected={pintu === "pengajar"}
              className={pintu === "pengajar" ? "on" : ""}
              onClick={() => { setPintu("pengajar"); setGalat(""); }}
            >
              Dosen / Pengajar
            </button>
          </div>

          {pintu === "peserta" ? (
            <>
              <label htmlFor="cbtd-kode">Kode Ujian</label>
              <input
                id="cbtd-kode"
                className="cbtd-input cbtd-input-kode"
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") void lanjut(); }}
                placeholder="XXXXXX"
                autoComplete="off"
                autoFocus
              />
              <p className="cbtd-bantu">
                Kode diberikan pengajar Anda, biasanya lewat grup kelas. Nama dan nomor peserta diisi pada
                langkah berikutnya.
              </p>
              {galat && <p className="cbtd-galat" role="alert">{galat}</p>}
              <button type="button" className="cbtd-btn" disabled={sibuk} onClick={() => void lanjut()}>
                {sibuk ? "Memeriksa…" : "Lanjut"}
              </button>
            </>
          ) : (
            <>
              <p className="cbtd-bantu">
                Pengajar dan admin memakai akun portal yang sama. Menu CBT ada
                di dalam dashboard, pada bagian Ujian Online.
              </p>
              <a href={`${portal}/login`} className="cbtd-btn cbtd-btn-tautan">
                Masuk ke dashboard
              </a>
              <p className="cbtd-bantu">
                Belum punya akun? Hubungi Super Admin portal.
              </p>
            </>
          )}

          <p className="cbtd-versi">Sistem Ujian Berbasis Komputer</p>
          <KreditCbt />
        </div>
      </main>
    </div>
  );
}
