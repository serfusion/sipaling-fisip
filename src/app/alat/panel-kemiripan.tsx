"use client";

import { useMemo, useState } from "react";
import { Ic, IKON, Kepala, Rinci, SumberAcuan } from "./ikon";
import { PerluProject } from "./panel-naskah";
import {
  MAKS_KATA_PARAFRASE, PARAFRASE_LABEL, TEMUAN_LABEL,
  ujiParafrase,
  type PutusanParafrase,
} from "@/lib/kemiripan";
import type { Project } from "@/lib/project";
import { Bagian, Butir, Catatan, LaporanCetak, TombolCetak } from "./laporan";
import { LebihBanyak, useSebagian } from "./daftar";
import { useAnalisis } from "./use-analisis";

const KELAS_PUTUSAN: Record<PutusanParafrase, string> = {
  salin: "bad", "tukar-sinonim": "bad", "parafrase-lemah": "warn", "parafrase-baik": "ok",
};
const KELAS_BERAT: Record<string, string> = { salah: "bad", sebaiknya: "warn", periksa: "warn" };

export function PanelKemiripan({
  project, ubah,
}: { project: Project | null; ubah: (p: Partial<Project>) => void }) {
  const [sisi, setSisi] = useState<"naskah" | "sumber" | "parafrase">("naskah");

  if (!project) {
    return (
      <>
        <PerluProject pesan="Buat atau pilih project dulu, lalu unggah naskah Anda di Beranda." />
        <SumberAcuan kunci="kemiripan" />
      </>
    );
  }

  return (
    <>
      <section className="al-card">
        <Kepala ikon={IKON.kemiripan} judul="Cek Kemiripan dan Parafrase"
          sub="Bereskan yang bisa Anda bereskan sendiri, sebelum jatah unggah Turnitin terpakai" />
        <p className="al-note">
          <b>Bukan Turnitin, dan angkanya tidak akan sama.</b> Yang diperiksa di sini: sumber yang Anda tempel
          sendiri, kelengkapan sitasi, dan mutu parafrase. Semua berjalan di perangkat ini.
        </p>
        <Rinci judul="Kenapa tidak bisa sama dengan Turnitin?">
          <p>
            Kekuatan Turnitin ada pada korpusnya: jutaan skripsi mahasiswa dan jurnal berlangganan yang tidak dapat
            diakses dari luar. Alat mana pun tanpa korpus itu tidak bisa menghasilkan angka yang sama, dan yang
            menjanjikan sebaliknya sedang menyesatkan Anda.
          </p>
          <p>
            Yang bisa dikerjakan di sini adalah pekerjaan yang memang bisa Anda selesaikan sendiri lebih dulu,
            sebelum jatah unggah Turnitin terpakai.
          </p>
        </Rinci>

        <div className="al-filter">
          <button type="button" className={sisi === "naskah" ? "on" : ""} onClick={() => setSisi("naskah")}>
            1 · Periksa sitasi naskah
          </button>
          <button type="button" className={sisi === "sumber" ? "on" : ""} onClick={() => setSisi("sumber")}>
            2 · Bandingkan dengan sumber
          </button>
          <button type="button" className={sisi === "parafrase" ? "on" : ""} onClick={() => setSisi("parafrase")}>
            3 · Uji satu parafrase
          </button>
        </div>
      </section>

      {sisi === "naskah" && <SisiNaskah project={project} />}
      {sisi === "sumber" && <SisiSumber project={project} ubah={ubah} />}
      {sisi === "parafrase" && <SisiParafrase />}

      <SumberAcuan kunci="kemiripan" />
    </>
  );
}

/* -------------------------------------------------- 1. Pemeriksaan sitasi */

function SisiNaskah({ project }: { project: Project }) {
  const naskah = useMemo(
    () => project.bab.map((b) => `${b.judul}\n${b.isi}`).join("\n\n"),
    [project.bab],
  );
  const muatan = useMemo(
    () => (naskah.trim() ? { naskah, daftarPustaka: project.daftarPustaka } : null),
    [naskah, project.daftarPustaka],
  );
  const { hasil, sibuk } = useAnalisis("sitasi", muatan);
  const temuan = useMemo(() => hasil ?? [], [hasil]);
  const { tampil, sisa, lagi, semua } = useSebagian(temuan);

  if (!naskah.trim()) {
    return (
      <section className="al-card">
        <p className="al-galat">Naskah project ini masih kosong. Buka Beranda dan unggah naskah Anda dulu.</p>
      </section>
    );
  }

  if (sibuk && !hasil) {
    return (
      <section className="al-card">
        <p className="al-note" style={{ margin: 0 }} role="status" aria-live="polite">
          Mencocokkan sitasi dengan daftar pustaka…
        </p>
      </section>
    );
  }

  const perJenis = (j: string) => temuan.filter((t) => t.jenis === j);

  return (
    <section className="al-card">
      <div className="al-stats">
        <div className={`al-stat ${perJenis("kutipan-tanpa-halaman").length ? "bad" : "ok"}`}>
          <b>{perJenis("kutipan-tanpa-halaman").length}</b><span>kutipan tanpa halaman</span>
        </div>
        <div className={`al-stat ${perJenis("sitasi-tanpa-rujukan").length ? "bad" : "ok"}`}>
          <b>{perJenis("sitasi-tanpa-rujukan").length}</b><span>sitasi tanpa entri</span>
        </div>
        <div className={`al-stat ${perJenis("rujukan-tak-disitasi").length ? "warn" : "ok"}`}>
          <b>{perJenis("rujukan-tak-disitasi").length}</b><span>rujukan menganggur</span>
        </div>
      </div>

      {!project.daftarPustaka.trim() && (
        <p className="al-note">
          Daftar pustaka project ini masih kosong, jadi kecocokan sitasi belum dapat diperiksa. Isi lewat menu
          Verifikasi Sitasi, atau tambahkan langsung dari menu Cari Referensi.
        </p>
      )}

      {temuan.length === 0 ? (
        <p className="al-good">
          Tidak ada temuan pada aturan yang diperiksa. Ini bukan jaminan naskah Anda bersih: yang diperiksa di sini
          hanya kelengkapan sitasi dan porsi kutipan, bukan kemiripan dengan karya orang lain.
        </p>
      ) : (
        <>
          <ul className="al-list">
            {tampil.map((t, i) => (
              <li key={`${t.jenis}-${i}`} className={`al-item ${KELAS_BERAT[t.berat] ?? "abu"}`}>
                <div className="al-item-atas"><span className="al-tag">{TEMUAN_LABEL[t.jenis]}</span></div>
                <p className="al-kutip">{t.kutipan}</p>
                <p>{t.pesan}</p>
                {t.saran && <p className="al-fix">{t.saran}</p>}
              </li>
            ))}
          </ul>
          <LebihBanyak sisa={sisa} lagi={lagi} semua={semua} />
        </>
      )}

      <p className="al-tail">Bereskan sitasi dulu sebelum memikirkan angka kemiripan.</p>
      <TombolCetak apa="Laporan memuat tiap sitasi yang pincang beserta cara membetulkannya." />

      <LaporanCetak
        judul="Laporan Pemeriksaan Sitasi"
        project={project}
        angka={[
          { nilai: String(perJenis("kutipan-tanpa-halaman").length), label: "Kutipan tanpa halaman",
            nada: perJenis("kutipan-tanpa-halaman").length > 0 ? "bad" : "ok" },
          { nilai: String(perJenis("sitasi-tanpa-rujukan").length), label: "Sitasi tanpa entri",
            nada: perJenis("sitasi-tanpa-rujukan").length > 0 ? "bad" : "ok" },
          { nilai: String(perJenis("rujukan-tak-disitasi").length), label: "Rujukan menganggur",
            nada: perJenis("rujukan-tak-disitasi").length > 0 ? "warn" : "ok" },
          { nilai: String(perJenis("kutipan-berlebih").length), label: "Porsi kutipan",
            nada: perJenis("kutipan-berlebih").length > 0 ? "warn" : "ok" },
        ]}
      >
        {temuan.length === 0 ? (
          <>
            <Bagian>Hasil</Bagian>
            <Butir nada="ok" kutipan="Tidak ada temuan pada aturan yang diperiksa.">
              <p>
                Yang diperiksa di sini hanya kelengkapan sitasi dan porsi kutipan, bukan kemiripan dengan karya orang
                lain.
              </p>
            </Butir>
          </>
        ) : (
          (["kutipan-tanpa-halaman", "sitasi-tanpa-rujukan", "rujukan-tak-disitasi", "kutipan-berlebih"] as const)
            .map((jn) => {
              const isi = perJenis(jn);
              if (isi.length === 0) return null;
              return (
                <div key={jn}>
                  <Bagian>{TEMUAN_LABEL[jn]} ({isi.length})</Bagian>
                  {isi.map((tm, i) => (
                    <Butir key={`${jn}-${i}`} nada={(KELAS_BERAT[tm.berat] ?? "abu") as "ok" | "warn" | "bad" | "abu"}
                      tanda={TEMUAN_LABEL[tm.jenis]} kutipan={tm.kutipan}>
                      <p>{tm.pesan}</p>
                      {tm.saran && <p className="lap-fix">{tm.saran}</p>}
                    </Butir>
                  ))}
                </div>
              );
            })
        )}

        <Catatan>
          <p>
            <b>Laporan ini bukan hasil pemeriksaan Turnitin dan angkanya tidak sebanding.</b> Yang diperiksa di sini
            adalah kelengkapan sitasi dan porsi kutipan langsung, bukan kemiripan dengan karya orang lain.
          </p>
          <p>
            Sitasi yang pincang adalah temuan yang paling sering dikembalikan penguji, dan paling mudah dibereskan
            sendiri sebelum jatah unggah Turnitin terpakai.
          </p>
        </Catatan>
      </LaporanCetak>
    </section>
  );
}

/* ------------------------------------------------ 2. Pembandingan sumber */

function SisiSumber({
  project, ubah,
}: { project: Project; ubah: (p: Partial<Project>) => void }) {
  const [nama, setNama] = useState("");
  const [teks, setTeks] = useState("");

  const naskah = useMemo(
    () => project.bab.map((b) => `${b.judul}\n${b.isi}`).join("\n\n"),
    [project.bab],
  );
  // Pembandingan menyusun sidik jari delapan kata untuk seluruh naskah dan
  // seluruh sumber, lalu mencocokkannya. Pada skripsi utuh itu pekerjaan
  // beberapa detik, jadi tempatnya di pekerja latar.
  const muatan = useMemo(
    () => (naskah.trim() ? { naskah, sumber: project.sumberBanding } : null),
    [naskah, project.sumberBanding],
  );
  const { hasil, sibuk } = useAnalisis("kemiripan", muatan);

  function tambah() {
    if (!teks.trim()) return;
    ubah({
      sumberBanding: [...project.sumberBanding, { nama: nama.trim() || `Sumber ${project.sumberBanding.length + 1}`, teks }],
    });
    setNama(""); setTeks("");
  }

  return (
    <>
      <section className="al-card">
        <h3 className="al-h4">Sumber pembanding</h3>
        <p className="al-note">
          Tempelkan teks sumber yang Anda pakai. Bagian yang sama persis sepanjang delapan kata atau lebih akan
          ditandai.
        </p>

        {project.sumberBanding.length > 0 && (
          <ul className="al-chaps al-chaps-rapat">
            {project.sumberBanding.map((s, i) => (
              <li key={`${s.nama}-${i}`} className="al-bab-baris">
                <b>{s.nama}</b>
                <span>{s.teks.trim().split(/\s+/).length.toLocaleString("id-ID")} kata</span>
                <button type="button" className="al-proj-hapus" aria-label={`Hapus ${s.nama}`}
                  onClick={() => ubah({ sumberBanding: project.sumberBanding.filter((_, j) => j !== i) })}>
                  <Ic d={IKON.hapus} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <label className="al-field">
          <span>Nama sumber</span>
          <input value={nama} onChange={(e) => setNama(e.target.value)}
            placeholder="Sugiyono (2019), Bab 3" autoComplete="off" />
        </label>
        <label className="al-field">
          <span>Teks sumber</span>
          <textarea value={teks} onChange={(e) => setTeks(e.target.value)} rows={7}
            placeholder="Tempelkan teks aslinya di sini." />
        </label>
        <button type="button" className="al-btn al-btn-lembut" onClick={tambah} disabled={!teks.trim()}>
          <Ic d={IKON.tambah} /> Tambahkan sumber ini
        </button>
      </section>

      {sibuk && !hasil && project.sumberBanding.length > 0 && (
        <section className="al-card">
          <p className="al-note" style={{ margin: 0 }} role="status" aria-live="polite">
            Membandingkan naskah dengan sumber…
          </p>
        </section>
      )}

      {hasil && project.sumberBanding.length > 0 && (
        <section className="al-card">
          <div className="al-stats">
            <div className={`al-stat ${hasil.persenTanpaKutipan > 15 ? "bad" : hasil.persenTanpaKutipan > 5 ? "warn" : "ok"}`}>
              <b>{hasil.persenTanpaKutipan}%</b><span>sama, tanpa tanda kutip</span>
            </div>
            <div className="al-stat"><b>{hasil.persenGabungan}%</b><span>sama, termasuk kutipan</span></div>
            <div className="al-stat"><b>{hasil.persenKutipan}%</b><span>berada dalam tanda kutip</span></div>
            <div className="al-stat"><b>{hasil.jumlahKataNaskah.toLocaleString("id-ID")}</b><span>kata naskah</span></div>
          </div>

          <p className="al-note">
            Perhatikan angka pertama: bagian yang sama dengan sumber <b>tanpa</b> tanda kutip. Itulah yang terbaca
            sebagai salinan.
          </p>

          {hasil.perSumber.map((s) => (
            <div key={s.nama}>
              <h3 className="al-h4">{s.nama} · {s.persen}% naskah Anda cocok</h3>
              {s.rentang.length === 0 ? (
                <p className="al-good">Tidak ada deret delapan kata atau lebih yang sama dengan sumber ini.</p>
              ) : (
                <ul className="al-list">
                  {s.rentang.slice(0, 12).map((r) => (
                    <li key={r.mulaiKata} className={`al-item ${r.dalamKutip ? "warn" : "bad"}`}>
                      <div className="al-item-atas">
                        <span className="al-tag">{r.dalamKutip ? "Di dalam tanda kutip" : "Tanpa tanda kutip"}</span>
                        <span className="al-num">{r.jumlahKata} kata</span>
                      </div>
                      <p className="al-kutip">{r.kutipan}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {hasil.pengulanganInternal.length > 0 && (
            <>
              <h3 className="al-h4">Bagian yang Anda ulang sendiri</h3>
              <p className="al-note">
                Potongan ini muncul dua kali di naskah Anda, biasanya karena satu bab disalin ke bab lain.
              </p>
              <ul className="al-list">
                {hasil.pengulanganInternal.slice(0, 6).map((r) => (
                  <li key={r.mulaiKata} className="al-item warn">
                    <div className="al-item-atas"><span className="al-num">{r.jumlahKata} kata</span></div>
                    <p className="al-kutip">{r.kutipan}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="al-tail">
            Hanya sebatas sumber yang Anda tempel sendiri. Kemiripan dengan karya lain tidak akan terdeteksi.
          </p>
        </section>
      )}
    </>
  );
}

/* ------------------------------------------------------ 3. Uji parafrase */

function hitungKata(t: string) {
  const b = t.trim();
  return b ? b.split(/\s+/).length : 0;
}

function SisiParafrase() {
  const [asli, setAsli] = useState("");
  const [baru, setBaru] = useState("");
  const terlaluPanjang =
    hitungKata(asli) > MAKS_KATA_PARAFRASE || hitungKata(baru) > MAKS_KATA_PARAFRASE;
  const hasil = useMemo(() => ujiParafrase(asli, baru), [asli, baru]);

  return (
    <>
      <section className="al-card">
        <p className="al-note">Tempelkan kalimat asli dari sumber, lalu parafrase Anda sendiri.</p>
        <Rinci judul="Apa bedanya parafrase dan tukar sinonim?">
          <p>
            Mengganti kata dengan sinonim sambil mempertahankan susunan kalimat bukan parafrase. Dalam pedoman
            akademik itu disebut <b>patchwriting</b>, dan tetap terbaca sebagai salinan.
          </p>
        </Rinci>
        <label className="al-field">
          <span>Kalimat asli dari sumber</span>
          <textarea value={asli} onChange={(e) => setAsli(e.target.value)} rows={4}
            placeholder="Literasi digital merupakan kemampuan individu untuk…" />
        </label>
        <label className="al-field">
          <span>Parafrase Anda</span>
          <textarea value={baru} onChange={(e) => setBaru(e.target.value)} rows={4}
            placeholder="Tulis ulang dengan susunan Anda sendiri." />
        </label>
      </section>

      {terlaluPanjang && (
        <section className="al-card">
          <p className="al-galat">
            Uji ini untuk satu kalimat atau satu paragraf pendek, paling banyak {MAKS_KATA_PARAFRASE} kata di tiap
            kotak. Perbandingan kata demi kata pada teks yang lebih panjang membuat peramban berhenti menanggapi.
            Uji parafrase Anda satu kalimat pada satu waktu.
          </p>
        </section>
      )}

      {hasil && (
        <section className="al-card">
          <div className={`al-verdict ${hasil.putusan === "parafrase-baik" ? "wajar" : hasil.putusan === "parafrase-lemah" ? "periksa" : "sangat"}`}>
            <h3>{PARAFRASE_LABEL[hasil.putusan]}</h3>
            <p>{hasil.pesan}</p>
          </div>

          <div className="al-stats">
            <div className={`al-stat ${KELAS_PUTUSAN[hasil.putusan]}`}>
              <b>{hasil.persenKataSama}%</b><span>kata masih sama</span>
            </div>
            <div className={`al-stat ${hasil.runTerpanjang >= 8 ? "bad" : ""}`}>
              <b>{hasil.runTerpanjang}</b><span>kata berurutan sama</span>
            </div>
            <div className="al-stat"><b>{hasil.urutanTerjaga}%</b><span>urutan dipertahankan</span></div>
          </div>

          {hasil.runTerpanjang >= 5 && hasil.kutipanRun && (
            <p className="al-fix">Deret terpanjang yang sama: <b>&ldquo;{hasil.kutipanRun}&rdquo;</b></p>
          )}

          <h3 className="al-h4">Yang bisa Anda lakukan</h3>
          <ul className="al-plain">{hasil.saran.map((s) => <li key={s}>{s}</li>)}</ul>

          <p className="al-tail">Parafrase tetap wajib disitasi. Yang hilang hanya tanda kutipnya.</p>
        </section>
      )}
    </>
  );
}
