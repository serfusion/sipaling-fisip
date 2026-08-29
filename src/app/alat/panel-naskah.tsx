"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ic, IKON, Kepala, Rinci, SumberAcuan } from "./ikon";
import {
  BAGIAN_LABEL,
  BERAT_INGGRIS_LABEL,
  PORSI_TARGET,
  periksaInggris,
  petakanNaskah,
  type BagianJurnal,
  type BagianSkripsi,
  type BeratInggris,
} from "@/lib/manuscript";
import { cariFrasa, kelompokkan } from "@/lib/frasa-akademik";
import { alihBahasa, apaKeIeee, BAGIAN_EN_LABEL, type HasilAlih } from "@/lib/alih-bahasa";
import type { Project } from "@/lib/project";

const KELAS_ING: Record<BeratInggris, string> = { ganti: "bad", rapikan: "warn", pertimbangkan: "abu" };

/* ==========================================================================
   STRUKTUR NASKAH
   Dipisahkan dari Naskah Inggris karena memang pekerjaan yang berbeda:
   yang ini menata ulang urutan bab, yang itu mengalihbahasakan isinya.
   ========================================================================== */

const PANJANG = [
  { nilai: 5000, nama: "5.000 kata", ket: "Artikel pendek" },
  { nilai: 7000, nama: "7.000 kata", ket: "Umum di ilmu sosial" },
  { nilai: 9000, nama: "9.000 kata", ket: "Artikel panjang" },
];

function targetTerpilih(bagian: BagianSkripsi[], dipilih: Set<number>, total: number) {
  const aktif = bagian
    .map((b, i) => ({ b, i }))
    .filter(({ b, i }) => dipilih.has(i) && b.bagian !== "dibuang");

  const porsiPakai = new Set<BagianJurnal>(aktif.map(({ b }) => b.bagian));
  const jumlahPorsi = [...porsiPakai].reduce(
    (n, p) => n + (PORSI_TARGET[p as Exclude<BagianJurnal, "dibuang">] ?? 0), 0);

  const kataPerTujuan = new Map<BagianJurnal, number>();
  for (const { b } of aktif) kataPerTujuan.set(b.bagian, (kataPerTujuan.get(b.bagian) ?? 0) + b.jumlahKata);

  const hasil = new Map<number, number>();
  for (const { b, i } of aktif) {
    const porsi = (PORSI_TARGET[b.bagian as Exclude<BagianJurnal, "dibuang">] ?? 0) / (jumlahPorsi || 1);
    const anggaran = total * porsi;
    const kataTujuan = kataPerTujuan.get(b.bagian) ?? 0;
    hasil.set(i, Math.round(kataTujuan > 0 ? (b.jumlahKata / kataTujuan) * anggaran : anggaran));
  }
  return hasil;
}

export function PanelStruktur({ project }: { project: Project | null }) {
  const [target, setTarget] = useState(7000);
  const [batal, setBatal] = useState<Set<number>>(new Set());

  // Naskah diambil dari project, bukan dari kotak tempel. Inilah gunanya
  // project: satu kali unggah, dipakai semua alat.
  const naskah = useMemo(
    () => (project ? project.bab.map((b) => `${b.judul}\n${b.isi}`).join("\n") : ""),
    [project],
  );

  const peta = useMemo(() => (naskah.trim() ? petakanNaskah(naskah, target) : null), [naskah, target]);

  const dipilih = useMemo(() => {
    if (!peta) return new Set<number>();
    const s = new Set<number>();
    peta.bagian.forEach((b, i) => { if (b.bagian !== "dibuang" && !batal.has(i)) s.add(i); });
    return s;
  }, [peta, batal]);

  const targetPeta = useMemo(
    () => (peta ? targetTerpilih(peta.bagian, dipilih, target) : new Map<number, number>()),
    [peta, dipilih, target],
  );

  if (!project) {
    return (
      <>
        <PerluProject pesan="Buat atau pilih project dulu, lalu unggah naskah skripsi Anda." />
        <SumberAcuan kunci="struktur" />
      </>
    );
  }

  if (!peta || peta.bagian.length === 0) {
    return (
      <>
      <section className="al-card">
        <Kepala ikon={IKON.struktur} judul="Struktur Naskah"
          sub="Petakan bab skripsi ke bagian artikel jurnal, lengkap dengan target jumlah kata" />
        <p className="al-galat">
          Belum ada bab yang dikenali pada project ini. Buka Beranda, tempelkan naskah skripsi Anda, dan pastikan tiap
          judul bab berada pada barisnya sendiri.
        </p>
      </section>
      <SumberAcuan kunci="struktur" />
      </>
    );
  }

  const kataTerpilih = peta.bagian.reduce((n, b, i) => n + (dipilih.has(i) ? b.jumlahKata : 0), 0);
  const kataTarget = [...targetPeta.values()].reduce((n, v) => n + v, 0);
  const dapatDipilih = peta.bagian.filter((b) => b.bagian !== "dibuang").length;

  return (
    <>
      <section className="al-card">
        <Kepala ikon={IKON.struktur} judul="Struktur Naskah"
          sub="Pilih bab → petakan ke bagian jurnal → lihat berapa yang harus dipangkas" />
        <Rinci judul="Kenapa BAB I sampai V harus diubah?">
          <p>
            BAB I sampai V bukan IMRaD. Pendahuluan skripsi memuat latar belakang, rumusan, tujuan, manfaat, dan
            sistematika. Introduction jurnal menuntut tiga gerakan: tegakkan bidang, tunjukkan celah, isi celah.
          </p>
        </Rinci>
      </section>

      <div className="al-duo">
        <section className="al-card">
          <div className="al-pickhead">
            <h3>Pilih Bab</h3>
            <span>{dipilih.size} dari {dapatDipilih} bab dibawa</span>
            <span className="al-acts">
              <button type="button" className="al-mini" onClick={() => setBatal(new Set())}>Semua</button>
              <button type="button" className="al-mini"
                onClick={() => setBatal(new Set(peta.bagian.map((_, i) => i)))}>Kosongkan</button>
            </span>
          </div>

          <ul className="al-chaps">
            {peta.bagian.map((b, i) => {
              const buang = b.bagian === "dibuang";
              const on = dipilih.has(i);
              const tgt = targetPeta.get(i) ?? 0;
              const rasio = b.jumlahKata > 0 ? Math.min(100, (tgt / b.jumlahKata) * 100) : 0;
              return (
                <li key={`${b.judul}-${i}`}>
                  <button type="button" className={`al-chap ${on ? "on" : ""} ${buang ? "mati" : ""}`}
                    aria-pressed={on} disabled={buang}
                    onClick={() => setBatal((k) => {
                      const n = new Set(k);
                      if (n.has(i)) n.delete(i); else n.add(i);
                      return n;
                    })}>
                    <span className="al-box"><Ic d={IKON.centang} /></span>
                    <span>
                      <span className="al-chap-atas">
                        <b>{b.judul}</b>
                        <span className={`al-badge ${buang ? "buang" : ""}`}>{BAGIAN_LABEL[b.bagian]}</span>
                      </span>
                      <span className="al-chap-kata">
                        {b.jumlahKata.toLocaleString("id-ID")} kata
                        {!buang && on && <> → <b>{tgt.toLocaleString("id-ID")} kata</b></>}
                        {buang && " → tidak dibawa"}
                      </span>
                      {!buang && on && <span className="al-bar"><i style={{ width: `${rasio}%` }} /></span>}
                      <span className="al-chap-catatan">{b.catatan}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <div>
          <section className="al-card">
            <h3 className="al-h4">Target panjang artikel</h3>
            <div className="al-tiles al-tiles-1">
              {PANJANG.map((p) => (
                <button key={p.nilai} type="button" className={`al-tile ${target === p.nilai ? "on" : ""}`}
                  aria-pressed={target === p.nilai} onClick={() => setTarget(p.nilai)}>
                  <b>{p.nama}</b><small>{p.ket}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="al-card">
            <h3 className="al-h4">Ringkasan pemampatan</h3>
            <div className="al-stats al-stats-1">
              <div className="al-stat"><b>{kataTerpilih.toLocaleString("id-ID")}</b><span>kata terpilih</span></div>
              <div className="al-stat ok"><b>{kataTarget.toLocaleString("id-ID")}</b><span>kata target</span></div>
              {kataTarget < kataTerpilih ? (
                <div className="al-stat warn">
                  <b>{Math.round((1 - kataTarget / kataTerpilih) * 100)}%</b>
                  <span>harus dipangkas</span>
                </div>
              ) : (
                /* Naskah lebih pendek daripada target. "0% harus dipangkas"
                   secara teknis benar tetapi tidak memberi tahu apa pun. */
                <div className="al-stat">
                  <b>{(kataTarget - kataTerpilih).toLocaleString("id-ID")}</b>
                  <span>kata masih kurang</span>
                </div>
              )}
            </div>
            {peta.takTerpetakan.length > 0 && (
              <>
                <h3 className="al-h4">Belum dapat dipetakan</h3>
                <ul className="al-plain">{peta.takTerpetakan.map((j) => <li key={j}>{j}</li>)}</ul>
                <p className="al-tail">
                  Judul ini tidak cocok dengan pola mana pun. Anda yang paling tahu isinya.
                </p>
              </>
            )}
          </section>
        </div>
      </div>

      <SumberAcuan kunci="struktur" />
    </>
  );
}

/* ==========================================================================
   NASKAH INGGRIS
   Kini benar-benar soal alih bahasa: rumusan baku Indonesia yang dikenali
   beserta padanan yang dipakai jurnal, lalu pemeriksaan ragam pada hasilnya.
   ========================================================================== */

type Sisi = "indonesia" | "alih" | "inggris";

export function PanelInggris({
  project, ubah,
}: { project: Project | null; ubah: (p: Partial<Project>) => void }) {
  const [sisi, setSisi] = useState<Sisi>("indonesia");

  const indonesia = useMemo(
    () => (project ? project.bab.map((b) => `${b.judul}\n${b.isi}`).join("\n\n") : ""),
    [project],
  );
  const frasa = useMemo(() => (indonesia.trim() ? kelompokkan(cariFrasa(indonesia)) : []), [indonesia]);
  const inggris = project?.naskahInggris ?? "";
  const cek = useMemo(() => (inggris.trim() ? periksaInggris(inggris) : null), [inggris]);

  if (!project) {
    return (
      <>
        <PerluProject pesan="Buat atau pilih project dulu, lalu unggah naskah Indonesia Anda." />
        <SumberAcuan kunci="inggris" />
      </>
    );
  }

  const jumlahFrasa = frasa.reduce((n, k) => n + k.isi.length, 0);

  return (
    <>
      <section className="al-card">
        <Kepala ikon={IKON.inggris} judul="Naskah Inggris"
          sub="Rumusan baku skripsi Anda → padanan yang dipakai jurnal → periksa ragam hasilnya" />
        <Rinci judul="Contohnya seperti apa?">
          <p>
            &ldquo;Penelitian ini bertujuan untuk menganalisis&rdquo; sering diterjemahkan harfiah menjadi{" "}
            <i>&ldquo;This research have a purpose to analyze&rdquo;</i>, padahal jurnal menulisnya{" "}
            <b>&ldquo;This study examines&rdquo;</b>.
          </p>
          <p>Padanan yang ditawarkan hanya usulan. Anda yang menyusun kalimatnya.</p>
        </Rinci>

        <div className="al-filter">
          <button type="button" className={sisi === "indonesia" ? "on" : ""} onClick={() => setSisi("indonesia")}>
            1 · Padanan dari naskah Indonesia {jumlahFrasa > 0 && `(${jumlahFrasa})`}
          </button>
          <button type="button" className={sisi === "alih" ? "on" : ""} onClick={() => setSisi("alih")}>
            2 · Alihbahasakan naskah
          </button>
          <button type="button" className={sisi === "inggris" ? "on" : ""} onClick={() => setSisi("inggris")}>
            3 · Periksa naskah Inggris {cek && cek.temuan.length > 0 && `(${cek.temuan.length})`}
          </button>
        </div>
      </section>

      {sisi === "alih" ? (
        <PanelAlihBahasa project={project} ubah={ubah} keSisi={setSisi} />
      ) : sisi === "indonesia" ? (
        <section className="al-card">
          {indonesia.trim() === "" ? (
            <p className="al-galat">
              Naskah Indonesia project ini masih kosong. Buka Beranda dan tempelkan naskah skripsi Anda dulu.
            </p>
          ) : jumlahFrasa === 0 ? (
            <p className="al-good">
              Tidak ada rumusan baku yang dikenali pada naskah ini. Bank frasa hanya memuat rumusan yang paling sering
              muncul pada skripsi Indonesia, jadi ketiadaannya bukan berarti naskah Anda bermasalah.
            </p>
          ) : (
            <>
              <p className="al-note">
                {jumlahFrasa} rumusan dikenali, dikelompokkan mengikuti urutan penulisan artikel.
              </p>
              {frasa.map((k) => (
                <div key={k.bidang}>
                  <h3 className="al-h4">{k.label}</h3>
                  <ul className="al-list">
                    {k.isi.map((t) => (
                      <li key={t.sumber} className="al-item ok">
                        <div className="al-item-atas">
                          <span className="al-tag">Ditemukan di naskah Anda</span>
                        </div>
                        <p className="al-kutip">&ldquo;{t.kutipan}&rdquo;</p>
                        <p className="al-padanan">
                          {t.padanan.map((p, i) => (
                            <span key={p} className={`al-pad ${i === 0 ? "utama" : ""}`}>{p}</span>
                          ))}
                        </p>
                        {t.catatan && <p className="al-catatan-frasa">{t.catatan}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="al-tail">Padanan pertama yang paling lazim. Ini bukan penerjemah otomatis.</p>
            </>
          )}
        </section>
      ) : (
        <>
          <section className="al-card">
            <label className="al-field">
              <span>Naskah Inggris Anda</span>
              <textarea
                value={project.naskahInggris}
                onChange={(e) => ubah({ naskahInggris: e.target.value })}
                rows={10}
                placeholder="Tulis atau tempelkan naskah Inggris Anda di sini. Tersimpan otomatis di project."
              />
              <small>Tersimpan di perangkat ini, di dalam project. Tidak dikirim ke mana pun.</small>
            </label>
          </section>

          {cek && (
            <section className="al-card">
              <div className="al-stats">
                <div className="al-stat"><b>{cek.jumlahKata.toLocaleString("id-ID")}</b><span>kata</span></div>
                <div className="al-stat"><b>{cek.rataKataPerKalimat}</b><span>kata/kalimat</span></div>
                <div className="al-stat"><b>{cek.kalimatPasifPersen}%</b><span>kalimat pasif</span></div>
                <div className={`al-stat ${cek.temuan.length > 0 ? "warn" : "ok"}`}>
                  <b>{cek.temuan.length}</b><span>temuan</span>
                </div>
              </div>

              {cek.temuan.length === 0 ? (
                <p className="al-good">
                  Tidak ada pola yang biasa ditandai peninjau. Ini bukan jaminan bebas kesalahan.
                </p>
              ) : (
                <ul className="al-list">
                  {cek.temuan.map((t, i) => (
                    <li key={`${t.posisi}-${i}`} className={`al-item ${KELAS_ING[t.berat]}`}>
                      <div className="al-item-atas">
                        <span className="al-tag">{BERAT_INGGRIS_LABEL[t.berat]}</span>
                        <code>{t.kutipan}</code>
                      </div>
                      <p>{t.pesan}</p>
                      {t.saran && <p className="al-fix">Coba: <b>{t.saran}</b></p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <SumberAcuan kunci="inggris" />
    </>
  );
}

/* ==========================================================================
   ALIH BAHASA NASKAH INDONESIA KE INGGRIS
   Bukan penerjemah otomatis: yang disusun adalah draf naskah bergaya jurnal
   beserta daftar kata yang belum punya padanan, supaya penulisnya tahu persis
   mana yang masih harus dikerjakan sendiri.
   ========================================================================== */

function PanelAlihBahasa({
  project, ubah, keSisi,
}: {
  project: Project;
  ubah: (p: Partial<Project>) => void;
  keSisi: (s: Sisi) => void;
}) {
  const [memuat, setMemuat] = useState(false);
  const [hasil, setHasil] = useState<HasilAlih | null>(null);
  const [tersalin, setTersalin] = useState("");
  const [ieee, setIeee] = useState<ReturnType<typeof apaKeIeee> | null>(null);
  const jamRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (jamRef.current) clearTimeout(jamRef.current); }, []);

  const naskah = useMemo(
    () => project.bab.map((b) => `${b.judul}\n${b.isi}`).join("\n\n"),
    [project],
  );

  function kerjakan() {
    if (memuat) return;
    setMemuat(true);
    setHasil(null);
    setTersalin("");
    // Alih bahasa berjalan di utas yang sama dengan antarmuka. Jeda sesaat
    // memberi peramban kesempatan menggambar keadaan "sedang bekerja" lebih
    // dulu, sehingga tombolnya tidak terasa mati pada naskah panjang.
    jamRef.current = setTimeout(() => {
      setHasil(alihBahasa(naskah));
      setMemuat(false);
    }, 60);
  }

  async function salin(teks: string, tanda: string) {
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(tanda);
      setTimeout(() => setTersalin(""), 2000);
    } catch {
      setTersalin("gagal");
    }
  }

  if (naskah.trim() === "") {
    return (
      <section className="al-card">
        <p className="al-galat">
          Naskah Indonesia project ini masih kosong. Buka Beranda, tempelkan naskah skripsi Anda, lalu kembali ke sini.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="al-card">
        <h3 className="al-h4">Alihbahasakan naskah Indonesia Anda</h3>
        <p className="al-note">
          Naskah diolah di peramban Anda sendiri: tidak dikirim ke mana pun, tanpa mesin penerjemah daring.
          Hasilnya <b>draf</b> yang mengikuti pedoman artikel: judul bagian IMRaD bernomor Romawi, kala yang
          menyesuaikan bagian, dan rumusan baku yang lazim di jurnal.
        </p>
        <Rinci judul="Sejauh mana ini bisa diandalkan?">
          <p>
            Alat ini mengenali rumusan baku skripsi beserta padanan jurnalnya, membalik urutan kata sifat, memasang
            kata sandang, dan menyesuaikan kala tiap bagian. Yang tidak dapat dilakukannya: menebak istilah khas
            bidang Anda. Kata yang tidak ada padanannya ditandai «begini» dan dihitung, bukan dikarang.
          </p>
          <p>
            Karena itu bacalah hasilnya sebagai naskah yang sudah 80 persen jalan, bukan naskah siap kirim.
            Peninjau internasional menilai isi dan ragam bahasa sekaligus.
          </p>
        </Rinci>

        <button type="button" className="al-btn" onClick={kerjakan} disabled={memuat}>
          {memuat ? (
            <><span className="al-putar" aria-hidden="true" /> Mengalihbahasakan…</>
          ) : (
            <><Ic d={IKON.inggris} /> {hasil ? "Alihbahasakan ulang" : "Alihbahasakan ke Inggris"}</>
          )}
        </button>
      </section>

      {memuat && (
        <section className="al-card" aria-live="polite">
          <div className="al-memuat">
            <span className="al-putar besar" aria-hidden="true" />
            <div>
              <b>Mengalihbahasakan naskah…</b>
              <p>Mengenali judul bab, mencocokkan rumusan baku, lalu menyusun kalimatnya menurut kala tiap bagian.</p>
            </div>
          </div>
        </section>
      )}

      {hasil && (
        <>
          <section className="al-card">
            <div className="al-stats">
              <div className="al-stat"><b>{hasil.jumlahKata.toLocaleString("id-ID")}</b><span>kata sumber</span></div>
              <div className={`al-stat ${hasil.cakupan >= 90 ? "ok" : "warn"}`}>
                <b>{hasil.cakupan}%</b><span>kata terpadankan</span>
              </div>
              <div className="al-stat"><b>{hasil.bagianAda.length}</b><span>bagian dikenali</span></div>
              <div className={`al-stat ${hasil.belum.length > 0 ? "warn" : "ok"}`}>
                <b>{hasil.belum.length}</b><span>istilah tertinggal</span>
              </div>
            </div>

            <div className="al-aksi">
              <button type="button" className="al-mini" onClick={() => salin(hasil.teks, "draf")}>
                {tersalin === "draf" ? "Tersalin" : "Salin draf"}
              </button>
              <button type="button" className="al-mini"
                onClick={() => { ubah({ naskahInggris: hasil.teks }); keSisi("inggris"); }}>
                Simpan ke Naskah Inggris lalu periksa ragamnya
              </button>
            </div>
            <p className="al-tail">
              Menyimpan ke Naskah Inggris menimpa isi kotak naskah Inggris pada project ini.
            </p>
          </section>

          <section className="al-card">
            <h3 className="al-h4">Yang diterapkan mengikuti pedoman</h3>
            <ul className="al-list">
              {hasil.catatan.map((c) => (
                <li key={c.judul} className="al-item abu">
                  <div className="al-item-atas"><span className="al-tag">{c.judul}</span></div>
                  <p>{c.pesan}</p>
                </li>
              ))}
            </ul>
          </section>

          {hasil.belum.length > 0 && (
            <section className="al-card">
              <h3 className="al-h4">Istilah yang belum ada padanannya</h3>
              <p className="al-note">
                Ditandai «begini» di dalam draf. Tentukan padanannya sendiri, lalu pakai konsisten di seluruh
                naskah. Istilah yang berganti-ganti terbaca sebagai naskah yang tidak dirawat.
              </p>
              <p className="al-padanan">
                {hasil.belum.slice(0, 40).map((b) => (
                  <span key={b.kata} className="al-pad">{b.kata}{b.jumlah > 1 && ` ×${b.jumlah}`}</span>
                ))}
              </p>
            </section>
          )}

          <section className="al-card">
            <h3 className="al-h4">Draf naskah Inggris</h3>
            <pre className="al-draf">{hasil.teks}</pre>
          </section>

          <section className="al-card">
            <h3 className="al-h4">Bandingkan kalimat per kalimat</h3>
            <p className="al-note">
              Kolom kiri naskah Anda, kolom kanan drafnya. Bagian tiap baris disebut supaya terlihat kala mana yang
              dipakai dan mengapa.
            </p>
            <ul className="al-list">
              {hasil.baris.map((b, i) => (
                <li key={`${b.sumber.slice(0, 24)}-${i}`}
                  className={`al-item ${b.jenis === "paragraf" ? (b.belum.length > 0 ? "warn" : "ok") : "abu"}`}>
                  <div className="al-item-atas">
                    <span className="al-tag">{BAGIAN_EN_LABEL[b.bagian]}</span>
                    {b.jenis !== "paragraf" && <code>judul</code>}
                  </div>
                  <div className="al-alih">
                    <p className="al-alih-id">
                      {b.sumber || <em>Disisipkan agar susunan IMRaD tetap utuh</em>}
                    </p>
                    <p className="al-alih-en">{b.hasil}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section className="al-card">
        <h3 className="al-h4">Daftar pustaka: APA menjadi IEEE</h3>
        <p className="al-note">
          Prosiding dan jurnal teknik menomori rujukan dalam kurung siku sesuai urutan penyebutan pertama, sedangkan
          skripsi ilmu sosial hampir selalu APA. Daftar pustaka project ini diubah susunannya, bukan isinya.
        </p>
        {project.daftarPustaka.trim() === "" ? (
          <p className="al-galat">
            Daftar pustaka project ini masih kosong. Isi lewat Beranda atau tambahkan dari alat Cari Referensi.
          </p>
        ) : (
          <>
            <button type="button" className="al-btn al-btn-lembut"
              onClick={() => setIeee(apaKeIeee(project.daftarPustaka))}>
              <Ic d={IKON.dokumen} /> Ubah ke gaya IEEE
            </button>
            {ieee && (
              <>
                <div className="al-aksi">
                  <button type="button" className="al-mini"
                    onClick={() => salin(ieee.map((e) => e.hasil).join("\n"), "ieee")}>
                    {tersalin === "ieee" ? "Tersalin" : "Salin daftar IEEE"}
                  </button>
                </div>
                <ul className="al-list">
                  {ieee.map((e) => (
                    <li key={e.nomor} className={`al-item ${e.utuh ? "ok" : "warn"}`}>
                      <div className="al-item-atas">
                        <span className="al-tag">{e.utuh ? `Rujukan ${e.nomor}` : `Rujukan ${e.nomor} · belum utuh`}</span>
                      </div>
                      <p className="al-kutip">{e.hasil}</p>
                      {!e.utuh && (
                        <p className="al-fix">
                          Pola entri ini tidak terbaca, jadi dikeluarkan apa adanya. Lengkapi nama, tahun dalam
                          kurung, judul, dan sumbernya.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}

export function PerluProject({ pesan }: { pesan: string }) {
  return (
    <section className="al-card">
      <div className="al-kosong">
        <span className="al-head-ic"><Ic d={IKON.dokumen} /></span>
        <h3>Alat ini bekerja pada project</h3>
        <p>{pesan}</p>
      </div>
    </section>
  );
}
