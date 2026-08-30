"use client";

import { useEffect, useRef, useState } from "react";
import { Ic, IKON, Kepala, Rinci } from "./ikon";
import { ACCEPT_NASKAH, JENIS_LABEL_BERKAS, MAKS_MB, bacaTeks, ejaUkuran } from "@/lib/berkas";
import { Dibatalkan, bacaNaskah } from "@/lib/pekerja-klien";
import {
  JENIS_LABEL,
  buatCadangan,
  projectBaru,
  pulihkanCadangan,
  waktuRelatif,
  type JenisProject,
  type Project,
  type RingkasProject,
} from "@/lib/project";

export type Tab =
  | "beranda" | "judul" | "referensi" | "struktur" | "inggris"
  | "kemiripan" | "sitasi" | "radar" | "bahasa";

const JENIS: JenisProject[] = ["skripsi", "jurnal", "makalah"];

const PRODI = [
  "Ilmu Komunikasi",
  "Ilmu Pemerintahan",
];

type Props = {
  daftar: RingkasProject[];
  aktif: Project | null;
  siap: boolean;
  pilih: (id: string | null) => Promise<void>;
  buat: (p: Project) => Promise<void>;
  hapus: (id: string) => Promise<void>;
  gantiNaskah: (teks: string) => void;
  muatDaftar: () => Promise<void>;
  keAlat: (t: Tab) => void;
};

export function PanelBeranda(props: Props) {
  const { daftar, aktif, siap, pilih, buat, hapus, gantiNaskah, muatDaftar, keAlat } = props;
  const [buka, setBuka] = useState(false);

  if (!siap) {
    return (
      <section className="al-card">
        <p className="al-note" style={{ margin: 0 }}>Membuka penyimpanan di perangkat ini…</p>
      </section>
    );
  }

  return (
    <>
      <section className="al-card">
        <Kepala
          ikon={IKON.beranda}
          judul={aktif ? aktif.nama : "Mulai dari sebuah project"}
          sub={
            aktif
              ? `${JENIS_LABEL[aktif.jenis]}${aktif.prodi ? ` · ${aktif.prodi}` : ""} · ${aktif.bab.length} bab · ${aktif.bab
                  .reduce((n, b) => n + b.jumlahKata, 0)
                  .toLocaleString("id-ID")} kata`
              : "Naskah diunggah sekali, lalu dipakai oleh semua alat di sebelah kiri"
          }
        />
        <p className="al-note">
          Naskah, daftar pustaka, dan jurnal tujuan tersimpan dalam satu project, lalu dipakai semua alat.{" "}
          <b>Semuanya di perangkat ini saja</b>, tidak dikirim ke server mana pun.
        </p>

        {daftar.length > 0 && (
          <>
            <h3 className="al-h4">Project Anda</h3>
            <ul className="al-projs">
              {daftar.map((p) => (
                <li key={p.id} className={`al-proj ${aktif?.id === p.id ? "on" : ""}`}>
                  <button type="button" className="al-proj-buka" onClick={() => void pilih(p.id)}>
                    <span className="al-proj-ic"><Ic d={IKON.dokumen} /></span>
                    <span>
                      <span className="al-proj-nama">{p.nama}</span>
                      <span className="al-proj-meta">
                        {JENIS_LABEL[p.jenis]} · {p.jumlahBab} bab · {p.jumlahKata.toLocaleString("id-ID")} kata ·
                        diubah {waktuRelatif(p.diubah)}
                      </span>
                    </span>
                  </button>
                  <TombolHapus nama={p.nama} onHapus={() => void hapus(p.id)} />
                </li>
              ))}
            </ul>
          </>
        )}

        {buka ? (
          <FormProject
            onBatal={() => setBuka(false)}
            onBuat={async (p) => { await buat(p); setBuka(false); }}
          />
        ) : (
          <button type="button" className="al-btn al-btn-lembut" onClick={() => setBuka(true)}>
            <Ic d={IKON.tambah} />
            {daftar.length > 0 ? "Buat project lain" : "Buat project pertama"}
          </button>
        )}
      </section>

      {aktif && <KotakNaskah key={aktif.id} project={aktif} gantiNaskah={gantiNaskah} />}
      {aktif && <Langkah project={aktif} keAlat={keAlat} />}

      <KartuCadangan adaProject={daftar.length > 0} muatDaftar={muatDaftar} />
    </>
  );
}

/* ---------------------------------------------------------------- Form baru */

function FormProject({
  onBuat, onBatal,
}: { onBuat: (p: Project) => Promise<void>; onBatal: () => void }) {
  const [nama, setNama] = useState("");
  const [jenis, setJenis] = useState<JenisProject>("skripsi");
  const [prodi, setProdi] = useState(PRODI[0]);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  async function kirim(event: React.FormEvent) {
    event.preventDefault();
    if (!nama.trim()) { setGalat("Beri nama project supaya mudah dikenali nanti."); return; }
    setSibuk(true); setGalat("");
    try {
      await onBuat(projectBaru(nama, jenis, prodi));
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Project tidak dapat disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <form onSubmit={kirim} className="al-form-baru">
      <label className="al-field">
        <span>Nama project</span>
        <input value={nama} onChange={(e) => setNama(e.target.value)} autoFocus
          placeholder="Skripsi literasi algoritmik" autoComplete="off" />
        <small>Hanya untuk Anda sendiri. Boleh judul sementara.</small>
      </label>

      <h3 className="al-h4">Jenis naskah</h3>
      <div className="al-tiles">
        {JENIS.map((j) => (
          <button key={j} type="button" className={`al-tile ${jenis === j ? "on" : ""}`}
            aria-pressed={jenis === j} onClick={() => setJenis(j)}>
            <b>{JENIS_LABEL[j]}</b>
            <small>
              {j === "skripsi" ? "BAB I sampai V" : j === "jurnal" ? "Sudah berbentuk artikel" : "Tugas atau makalah"}
            </small>
          </button>
        ))}
      </div>

      <label className="al-field" style={{ marginTop: 16 }}>
        <span>Program studi</span>
        <select value={prodi} onChange={(e) => setProdi(e.target.value)}>
          {PRODI.map((p) => <option key={p} value={p}>{p}</option>)}
          <option value="">Tidak disebutkan</option>
        </select>
      </label>

      {galat && <p className="al-galat" role="alert">{galat}</p>}

      <div className="al-aksi">
        <button type="submit" className="al-btn" disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Buat project"}
        </button>
        <button type="button" className="al-mini" onClick={onBatal}>Batal</button>
      </div>
    </form>
  );
}

function TombolHapus({ nama, onHapus }: { nama: string; onHapus: () => void }) {
  const [pasti, setPasti] = useState(false);

  // Konfirmasi dua langkah, bukan window.confirm: naskah skripsi tidak boleh
  // hilang karena satu ketukan yang tidak sengaja di layar sentuh.
  if (pasti) {
    return (
      <span className="al-proj-pasti">
        <span>Hapus {nama}?</span>
        <button type="button" className="al-mini bahaya" onClick={onHapus}>Ya, hapus</button>
        <button type="button" className="al-mini" onClick={() => setPasti(false)}>Batal</button>
      </span>
    );
  }
  return (
    <button type="button" className="al-proj-hapus" aria-label={`Hapus project ${nama}`}
      onClick={() => setPasti(true)}>
      <Ic d={IKON.hapus} />
    </button>
  );
}

/* ------------------------------------------------------------------ Naskah */

function KotakNaskah({
  project, gantiNaskah,
}: { project: Project; gantiNaskah: (teks: string) => void }) {
  const awal = project.bab.map((b) => `${b.judul}\n${b.isi}`).join("\n\n");
  const [teks, setTeks] = useState(awal);
  const [status, setStatus] = useState<"diam" | "menyimpan" | "tersimpan">("diam");
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");
  const [muat, setMuat] = useState<{ nama: string; nilai: number; pesan: string } | null>(null);
  const berkas = useRef<HTMLInputElement | null>(null);
  const tunda = useRef<number | null>(null);
  const pertama = useRef(true);
  const kendali = useRef<AbortController | null>(null);

  // Penguraian bab tidak dijalankan tiap ketikan: pada naskah dua puluh ribu
  // kata itu terasa tersendat. Ditunda sampai mengetik berhenti sejenak.
  useEffect(() => {
    if (pertama.current) { pertama.current = false; return; }
    setStatus("menyimpan");
    if (tunda.current) window.clearTimeout(tunda.current);
    tunda.current = window.setTimeout(() => {
      gantiNaskah(teks);
      setStatus("tersimpan");
    }, 800);
    return () => { if (tunda.current) window.clearTimeout(tunda.current); };
  }, [teks, gantiNaskah]);

  // Pembacaan yang masih berjalan saat pengguna berpindah project atau menutup
  // halaman dihentikan, supaya pekerja latar tidak menguraikan berkas yang
  // hasilnya tidak akan dipakai siapa pun.
  useEffect(() => () => kendali.current?.abort(), []);

  async function muatBerkas(event: React.ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    event.target.value = "";
    if (!f) return;

    kendali.current?.abort();
    const punyaKini = new AbortController();
    kendali.current = punyaKini;

    setGalat("");
    setKabar("");
    setMuat({ nama: f.name, nilai: 0.02, pesan: "Memuat berkas…" });

    try {
      const hasil = await bacaNaskah(f, {
        sinyal: punyaKini.signal,
        lapor: (nilai, pesan) => setMuat({ nama: f.name, nilai, pesan }),
      });

      if (punyaKini.signal.aborted) return;
      if (!hasil.ok) { setGalat(hasil.pesan); return; }

      setTeks(hasil.teks);

      const kabarBaru = [
        `${JENIS_LABEL_BERKAS[hasil.jenis]} “${f.name}” (${ejaUkuran(f.size)}) berhasil dibaca.`,
        hasil.catatan,
        hasil.dipangkas
          ? "Naskahnya melewati batas panjang, jadi hanya bagian awalnya yang dimuat. Sisanya dapat Anda tempel sendiri."
          : null,
        "Periksa sebentar hasilnya di kotak naskah: tabel dan gambar tidak ikut terbawa.",
      ]
        .filter(Boolean)
        .join(" ");
      setKabar(kabarBaru);
    } catch (alasan: unknown) {
      if (alasan instanceof Dibatalkan) return;
      setGalat(alasan instanceof Error ? alasan.message : "Berkas tidak dapat dibaca.");
    } finally {
      if (kendali.current === punyaKini) {
        kendali.current = null;
        setMuat(null);
      }
    }
  }

  function batalkanMuat() {
    kendali.current?.abort();
    kendali.current = null;
    setMuat(null);
    setKabar("");
    setGalat("Pembacaan berkas dibatalkan.");
  }

  // Dihitung dari bab, bukan dari teks mentah: judul bab bukan isi naskah, dan
  // dua angka berbeda pada satu layar hanya membuat mahasiswa ragu.
  const kataBab = project.bab.reduce((n, x) => n + x.jumlahKata, 0);

  return (
    <section className="al-card">
      <Kepala ikon={IKON.dokumen} judul="Naskah project ini"
        sub="Unggah berkas Word atau PDF-nya sekali, lalu seluruh alat memakainya" />

      <label className="al-field">
        <span>
          Naskah Indonesia
          <em className={`al-simpan ${status}`}>
            {status === "menyimpan" ? "menyimpan…" : status === "tersimpan" ? "tersimpan di perangkat" : ""}
          </em>
        </span>
        <textarea
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          rows={12}
          spellCheck={false}
          placeholder={"BAB I PENDAHULUAN\n1.1 Latar Belakang\nPerkembangan teknologi informasi…"}
        />
        <small>
          {kataBab.toLocaleString("id-ID")} kata · {project.bab.length}{" "}
          bab dikenali. Tiap judul bab harus berada pada barisnya sendiri, misalnya &ldquo;1.1 Latar Belakang&rdquo;.
        </small>
      </label>

      <div className="al-aksi">
        <button type="button" className="al-mini" onClick={() => berkas.current?.click()} disabled={muat !== null}>
          <Ic d={IKON.unggah} /> Muat dari Word, PDF, atau teks
        </button>
        {teks && !muat && (
          <button type="button" className="al-mini" onClick={() => { setTeks(""); setKabar(""); setGalat(""); }}>
            Kosongkan
          </button>
        )}
        <input ref={berkas} type="file" accept={ACCEPT_NASKAH} hidden onChange={muatBerkas} />
      </div>

      {muat && (
        <div className="al-muat" role="status" aria-live="polite">
          <div className="al-muat-atas">
            <b>{muat.nama}</b>
            <button type="button" className="al-link" onClick={batalkanMuat}>Batalkan</button>
          </div>
          <div className="al-muat-bilah">
            <span style={{ width: `${Math.round(Math.min(1, Math.max(0.02, muat.nilai)) * 100)}%` }} />
          </div>
          <small>{muat.pesan}</small>
        </div>
      )}

      {kabar && <p className="al-good" style={{ marginTop: 14 }}>{kabar}</p>}
      {galat && <p className="al-galat" role="alert">{galat}</p>}

      <p className="al-tail">
        Word (.docx) sampai {MAKS_MB.docx} MB, PDF sampai {MAKS_MB.pdf} MB, teks polos sampai {MAKS_MB.teks} MB.
        Berkasnya dibuka di perangkat Anda sendiri — tidak diunggah ke server mana pun. PDF hasil pindaian atau
        foto tidak bisa dibaca karena tidak punya lapisan teks; untuk itu unggah berkas Word aslinya. Word versi
        lama (.doc) perlu disimpan ulang sebagai .docx lebih dulu.
      </p>

      {project.bab.length > 0 && (
        <>
          <h3 className="al-h4">Bab yang dikenali</h3>
          <ul className="al-chaps al-chaps-rapat">
            {project.bab.map((b) => (
              <li key={b.id} className="al-bab-baris">
                <b>{b.judul}</b>
                <span>{b.jumlahKata.toLocaleString("id-ID")} kata</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* --------------------------------------------------------- Langkah lanjutan */

function Langkah({ project, keAlat }: { project: Project; keAlat: (t: Tab) => void }) {
  const kata = project.bab.reduce((n, b) => n + b.jumlahKata, 0);
  const rujukan = project.daftarPustaka.split(/\n\s*\n|\n/).filter((b) => b.trim().length > 20).length;

  const langkah: Array<{ tab: Tab; ikon: string; judul: string; ket: string; siap: boolean }> = [
    {
      tab: "judul", ikon: IKON.judul, judul: "Judul dan Metode",
      ket: project.rancangan ? "Rancangan tersimpan" : "Mulai dari sini bila judul belum pasti",
      siap: Boolean(project.rancangan),
    },
    {
      tab: "referensi", ikon: IKON.referensi, judul: "Cari Referensi",
      ket: project.topik ? "Topik tersimpan" : "Cari jurnal ilmiah yang sahih",
      siap: Boolean(project.topik),
    },
    {
      tab: "kemiripan", ikon: IKON.kemiripan, judul: "Cek Kemiripan",
      ket: project.sumberBanding.length > 0
        ? `${project.sumberBanding.length} sumber pembanding`
        : kata > 0 ? "Periksa sitasi dan parafrase" : "Menunggu naskah",
      siap: kata > 0,
    },
    {
      tab: "struktur", ikon: IKON.struktur, judul: "Struktur Naskah",
      ket: project.bab.length > 0 ? `${project.bab.length} bab siap dipetakan ke IMRaD` : "Menunggu naskah",
      siap: project.bab.length > 0,
    },
    {
      tab: "inggris", ikon: IKON.inggris, judul: "Naskah Inggris",
      ket: kata > 0 ? "Cari padanan rumusan baku Anda" : "Menunggu naskah",
      siap: kata > 0,
    },
    {
      tab: "sitasi", ikon: IKON.sitasi, judul: "Verifikasi Sitasi",
      ket: rujukan > 0 ? `${rujukan} rujukan tersimpan` : "Belum ada daftar pustaka",
      siap: rujukan > 0,
    },
    {
      tab: "radar", ikon: IKON.radar, judul: "Radar Jurnal",
      ket: project.issnTujuan ? `ISSN ${project.issnTujuan}` : "Belum ada jurnal tujuan",
      siap: Boolean(project.issnTujuan),
    },
    {
      tab: "bahasa", ikon: IKON.bahasa, judul: "Periksa Bahasa",
      ket: kata > 0 ? "Periksa ragam ilmiah naskah ini" : "Menunggu naskah",
      siap: kata > 0,
    },
  ];

  return (
    <section className="al-card">
      <h3 className="al-h4">Lanjutkan ke</h3>
      <div className="al-langkah">
        {langkah.map((l) => (
          <button key={l.tab} type="button" className={`al-tile al-tile-langkah ${l.siap ? "siap" : ""}`}
            onClick={() => keAlat(l.tab)}>
            <span className="al-langkah-ic"><Ic d={l.ikon} /></span>
            <b>{l.judul}</b>
            <small>{l.ket}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Cadangan */

function KartuCadangan({
  adaProject, muatDaftar,
}: { adaProject: boolean; muatDaftar: () => Promise<void> }) {
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const berkas = useRef<HTMLInputElement | null>(null);

  async function unduh() {
    setGalat(""); setPesan("");
    try {
      const cadangan = await buatCadangan();
      const blob = new Blob([JSON.stringify(cadangan, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cakrawala-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setPesan(`${cadangan.projects.length} project diunduh sebagai berkas cadangan.`);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Cadangan tidak dapat dibuat.");
    }
  }

  async function pulihkan(event: React.ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    event.target.value = "";
    if (!f) return;
    setGalat(""); setPesan("");
    const dibaca = await bacaTeks(f);
    if (!dibaca.ok) { setGalat(dibaca.pesan); return; }
    if (dibaca.dipangkas) { setGalat("Berkas cadangan terlalu besar untuk dibaca utuh."); return; }
    try {
      const jumlah = await pulihkanCadangan(dibaca.teks);
      await muatDaftar();
      setPesan(`${jumlah} project dipulihkan. Project yang sudah ada tidak ditimpa.`);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Cadangan tidak dapat dipulihkan.");
    }
  }

  return (
    <section className="al-card">
      <Kepala ikon={IKON.unduh} judul="Cadangan"
        sub="Simpan salinan project Anda sebelum peramban membersihkan penyimpanannya" />
      <p className="al-note">
        <b>Unduh cadangan secara berkala</b>, terutama menjelang sidang. Berkasnya dapat dipulihkan di perangkat
        mana pun.
      </p>
      <Rinci judul="Kenapa perlu dicadangkan?">
        <p>
          Penyimpanan peramban bukan brankas. Safari membuang data situs yang tidak dibuka selama tujuh hari, dan
          membersihkan riwayat peramban dapat menghapusnya kapan saja.
        </p>
      </Rinci>
      <div className="al-aksi">
        <button type="button" className="al-mini" onClick={() => void unduh()} disabled={!adaProject}>
          <Ic d={IKON.unduh} /> Unduh cadangan
        </button>
        <button type="button" className="al-mini" onClick={() => berkas.current?.click()}>
          <Ic d={IKON.unggah} /> Pulihkan dari berkas
        </button>
        <input ref={berkas} type="file" accept=".json,application/json" hidden onChange={pulihkan} />
      </div>
      {pesan && <p className="al-good" style={{ marginTop: 14 }}>{pesan}</p>}
      {galat && <p className="al-galat" role="alert">{galat}</p>}
    </section>
  );
}
