"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ic, IKON, Kepala, Rinci, SumberAcuan } from "./ikon";
import { PerluProject } from "./panel-naskah";
import Tangga, { Lanjutan } from "./tangga";
import {
  DATA_PILIHAN, JENIS_KERJA, JENIS_LABEL, JENIS_UMUM, PENDEKATAN_LABEL, PRODI_METODE,
  KESULITAN, TUJUAN_PILIHAN, UNIT_PILIHAN, kuantitatif, rancang, slovin,
  type Data, type Jenis, type Masukan, type Prodi, type Tujuan, type Unit,
} from "@/lib/metodologi";
import type { Project } from "@/lib/project";
import type { Tab } from "./panel-beranda";
import { Bagian, Butir, Catatan, LaporanCetak, TombolCetak } from "./laporan";
import { BaganAlurPikir, BaganKerangka, ContohGrafik } from "./grafik";
import { susunAlurPikir, susunKerangka } from "@/lib/kerangka";
import { GRAFIK_NAMA, usulkanVisual } from "@/lib/visual";
import {
  MINIMAL_KATA, contohProdi, empatJalur, hitungKataCerita, hitungTahapSiap,
  tafsirkan, tahapCerita,
  type Bacaan, type JalurAlternatif,
} from "@/lib/tafsir-cerita";

const PRODI_PILIHAN: Array<{ id: Prodi; nama: string; ket: string }> = [
  { id: "komunikasi", nama: "Ilmu Komunikasi", ket: "Pengaruh, analisis isi, framing, semiotika" },
  { id: "pemerintahan", nama: "Ilmu Pemerintahan", ket: "Pengaruh, efektivitas, implementasi kebijakan" },
];

const KOSONG: Masukan = {
  variabelX: "", variabelX2: "", variabelZ: "", variabelY: "", objek: "", lokasi: "",
  tujuan: "pengaruh", unit: "individu", data: ["kuesioner"],
  jumlahPopulasi: 0, perkiraanSampel: 0, prodi: "komunikasi",
};

function prodiDari(nama: string): Prodi {
  const n = nama.toLowerCase();
  if (n.includes("komunikasi")) return "komunikasi";
  if (n.includes("pemerintahan")) return "pemerintahan";
  return "lain";
}

export function PanelJudul({
  project, ubah, keAlat,
}: { project: Project | null; ubah: (p: Partial<Project>) => void; keAlat: (t: Tab) => void }) {
  const m: Masukan = project?.rancangan ?? { ...KOSONG, prodi: prodiDari(project?.prodi ?? "") };
  const [draf, setDraf] = useState<Masukan>(m);
  const [lihatHasil, setLihatHasil] = useState(Boolean(project?.rancangan));
  // Penyusunan rancangan berjalan seketika di peramban. Tanpa jeda yang
  // terlihat, tombolnya terasa tidak menghasilkan apa-apa ketika hasilnya
  // sudah terbuka: layarnya sama persis sebelum dan sesudah ditekan.
  const [menyusun, setMenyusun] = useState(false);
  const [bacaan, setBacaan] = useState<Bacaan | null>(null);
  const [jalur, setJalur] = useState<JalurAlternatif[]>([]);
  /** Judul dari kartu yang barusan dipilih, supaya kepala hasilnya sama
   *  dengan judul yang ditekan. Kosong berarti pakai urutan pertama. */
  const [judulPilihan, setJudulPilihan] = useState("");
  /** Cerita yang sedang dipakai, disimpan di sini supaya tambahan dari kotak
   *  lanjutan dapat disambung ke belakangnya, bukan menggantikannya. */
  const [ceritaPakai, setCeritaPakai] = useState("");
  const [lanjut, setLanjut] = useState("");
  /** Prodi yang dipakai membaca cerita. Diambil dari project bila sudah ada,
   *  dan dapat diganti sendiri di kotak cerita. */
  const [prodi, setProdi] = useState<Prodi>(m.prodi === "lain" ? prodiDari(project?.prodi ?? "") : m.prodi);
  const jamRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasilRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => { if (jamRef.current) clearTimeout(jamRef.current); }, []);

  function susun() {
    if (menyusun) return;
    if (jamRef.current) clearTimeout(jamRef.current);
    // Hasil lama disembunyikan dulu, supaya yang muncul sesudahnya benar-benar
    // terbaca sebagai hasil baru.
    setLihatHasil(false);
    setMenyusun(true);
    jamRef.current = setTimeout(() => {
      setMenyusun(false);
      setLihatHasil(true);
      // Digulirkan ke hasilnya setelah React sempat memasangnya.
      requestAnimationFrame(() => hasilRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }, 650);
  }

  /** Baca cerita mahasiswa, isikan ke formulir, lalu langsung susun. */
  function bacakan(cerita: string) {
    const hasilBaca = tafsirkan(cerita, prodi);
    setBacaan(hasilBaca);
    setJalur(empatJalur(hasilBaca));
    setJudulPilihan("");
    const baru = { ...draf, ...hasilBaca.masukan };
    setDraf(baru);
    if (project) ubah({ rancangan: baru });
    susun();
  }

  const atur = (bagian: Partial<Masukan>) => {
    const baru = { ...draf, ...bagian };
    setDraf(baru);
    // Judul pilihan itu milik kartu yang barusan ditekan. Begitu isian di
    // bawahnya diubah sendiri, judul itu belum tentu terbit lagi, jadi
    // pilihannya dilepas dan kepala hasilnya kembali ke judul urutan pertama.
    setJudulPilihan("");
    if (project) ubah({ rancangan: baru });
  };

  const hasil = useMemo(() => rancang(draf), [draf]);
  const judulUtama = hasil.judul.includes(judulPilihan) ? judulPilihan : hasil.judul[0];
  const modelAnjuran = hasil.model.find((k) => k.anjuran) ?? hasil.model[0];
  const visual = useMemo(() => usulkanVisual(hasil.jenis), [hasil.jenis]);
  // Kerangka berpikir hanya bermakna pada rancangan yang menguji hubungan
  // antarvariabel. Rancangan deskriptif dan kualitatif tidak memakainya.
  const kerangka = useMemo(
    () => (draf.tujuan === "pengaruh" || draf.tujuan === "hubungan" ? susunKerangka(draf) : null),
    [draf],
  );
  // Rancangan yang tidak menguji variabel tetap wajib punya kerangka
  // berpikir; bentuknya saja yang berbeda.
  const alur = useMemo(
    () => (draf.tujuan === "pengaruh" || draf.tujuan === "hubungan" ? null : susunAlurPikir(draf, hasil.jenis, hasil.teori)),
    [draf, hasil.jenis, hasil.teori],
  );
  const anjuran = slovin(draf.jumlahPopulasi);
  const kuan = kuantitatif(hasil.jenis);
  const hambat = hasil.peringatan.filter((p) => p.berat === "hambat");
  const periksa = hasil.peringatan.filter((p) => p.berat === "periksa");

  if (!project) {
    return (
      <>
        <PerluProject pesan="Buat atau pilih project dulu, agar rancangan penelitian Anda tersimpan." />
        <SumberAcuan kunci="judul" />
      </>
    );
  }

  const tanya = TUJUAN_PILIHAN.find((t) => t.id === draf.tujuan)?.tanya ?? "";

  return (
    <>
      <KotakCerita
        onBacakan={(teks) => { setCeritaPakai(teks); bacakan(teks); }}
        sibuk={menyusun}
        prodi={prodi}
        onProdi={(p) => {
          setProdi(p);
          setJalur([]);
          setBacaan(null);
          atur({ prodi: p, metode: undefined });
        }}
      />

      {bacaan && <HasilBacaan bacaan={bacaan} />}

      {bacaan && (
        <section className="al-card">
          <Lanjutan
            pertanyaan={bacaan.pertanyaan}
            nilai={lanjut}
            onNilai={setLanjut}
            sibuk={menyusun}
            onKirim={() => {
              const tambahan = lanjut.trim();
              if (!tambahan) return;
              // Disambung ke ceritanya yang lama, bukan menggantikannya:
              // kalimat tambahan biasanya hanya satu keping yang kurang, dan
              // membacanya sendirian menghapus semua yang sudah terbaca.
              const gabungan = `${ceritaPakai.trim()} ${tambahan}`.trim();
              setCeritaPakai(gabungan);
              setLanjut("");
              bacakan(gabungan);
            }}
          />
        </section>
      )}

      <PilihMetode
        prodi={prodi}
        kini={hasil.jenis}
        onPilih={(k) => { atur({ metode: k }); setJudulPilihan(""); susun(); }}
      />

      {jalur.length > 0 && (
        <PilihJudul
          jalur={jalur}
          tujuanKini={draf.tujuan}
          onPilih={(k) => {
            setDraf(k.masukan);
            // Judul yang tertulis di kartu belum tentu judul urutan pertama
            // untuk rancangan itu. Kalau tidak diingat, mahasiswa menekan satu
            // judul lalu mendapati kepala hasilnya berbunyi judul lain.
            setJudulPilihan(k.judul);
            if (project) ubah({ rancangan: k.masukan });
            susun();
          }}
        />
      )}

      <section className="al-card">
        <Kepala ikon={IKON.judul} judul="Perumus Judul dan Metode"
          sub="Sebutkan yang ingin Anda teliti, lalu lihat metode mana yang dapat menjawabnya" />
        <p className="al-note">
          Jawab pertanyaan di bawah, lalu rancangan penelitiannya disusun beserta peringatan bila judul dan metode
          tidak sejalan.
        </p>
        <Rinci>
          <p>
            &ldquo;Pengaruh A terhadap B&rdquo; yang hendak dikerjakan dengan wawancara mendalam tidak akan bisa
            menjawab pertanyaannya sendiri. Ketidakcocokan seperti ini biasanya baru ketahuan setelah berbulan-bulan.
          </p>
        </Rinci>

        <h3 className="al-h4">1 · Apa yang ingin Anda ketahui?</h3>
        <div className="al-tiles">
          {TUJUAN_PILIHAN.map((t) => (
            <button key={t.id} type="button" className={`al-tile ${draf.tujuan === t.id ? "on" : ""}`}
              aria-pressed={draf.tujuan === t.id} onClick={() => atur({ tujuan: t.id as Tujuan })}>
              <b>{t.label}</b><small>{t.tanya}</small>
            </button>
          ))}
        </div>

        <h3 className="al-h4">2 · Yang Anda teliti itu apa?</h3>
        <div className="al-tiles">
          {UNIT_PILIHAN.map((u) => (
            <button key={u.id} type="button" className={`al-tile ${draf.unit === u.id ? "on" : ""}`}
              aria-pressed={draf.unit === u.id} onClick={() => atur({ unit: u.id as Unit })}>
              <b>{u.label}</b><small>{u.ket}</small>
            </button>
          ))}
        </div>

        <h3 className="al-h4">3 · Data apa yang bisa Anda kumpulkan?</h3>
        <p className="al-note">
          Jawab sejujurnya, bukan seidealnya. Jawaban di sini yang menentukan apakah judul Anda dapat dikerjakan.
        </p>
        <div className="al-tiles">
          {DATA_PILIHAN.map((d) => {
            const aktif = draf.data.includes(d.id);
            return (
              <button key={d.id} type="button" className={`al-tile ${aktif ? "on" : ""}`} aria-pressed={aktif}
                onClick={() => atur({
                  data: aktif ? draf.data.filter((x) => x !== d.id) : [...draf.data, d.id as Data],
                })}>
                <b>{d.label}</b><small>{d.ket}</small>
              </button>
            );
          })}
        </div>

        <h3 className="al-h4">4 · Isi bagian judulnya</h3>
        <p className="al-note">{tanya}</p>
        <div className="al-duo-isi">
          <label className="al-field">
            <span>{draf.unit === "teks" ? "Hal yang dicari dalam teks" : "Yang diduga berpengaruh (X)"}</span>
            <input value={draf.variabelX} onChange={(e) => atur({ variabelX: e.target.value })}
              placeholder="literasi digital" autoComplete="off" />
          </label>
          <label className="al-field">
            <span>{draf.unit === "teks" ? "Teks atau medianya" : "Yang terpengaruh (Y)"}</span>
            <input value={draf.variabelY} onChange={(e) => atur({ variabelY: e.target.value })}
              placeholder="kemampuan menyaring informasi" autoComplete="off" />
          </label>
          <label className="al-field">
            <span>Siapa atau apa yang diteliti</span>
            <input value={draf.objek} onChange={(e) => atur({ objek: e.target.value })}
              placeholder="mahasiswa FISIP UMT" autoComplete="off" />
          </label>
          <label className="al-field">
            <span>Lokasi</span>
            <input value={draf.lokasi} onChange={(e) => atur({ lokasi: e.target.value })}
              placeholder="Kota Tangerang" autoComplete="off" />
          </label>
        </div>

        {kuan && (
          <>
            <h3 className="al-h4">Variabel tambahan, bila ada</h3>
            <p className="al-note">
              Kosongkan bila penelitian Anda hanya memakai satu variabel bebas tanpa variabel antara.
            </p>
            <div className="al-duo-isi">
              <label className="al-field">
                <span>Variabel bebas kedua (X2)</span>
                <input value={draf.variabelX2 ?? ""} onChange={(e) => atur({ variabelX2: e.target.value })}
                  placeholder="kompensasi" autoComplete="off" />
              </label>
              <label className="al-field">
                <span>Variabel antara atau mediasi (Z)</span>
                <input value={draf.variabelZ ?? ""} onChange={(e) => atur({ variabelZ: e.target.value })}
                  placeholder="komitmen organisasional" autoComplete="off" />
                <small>Variabel yang dilewati pengaruh X sebelum sampai ke Y.</small>
              </label>
            </div>
          </>
        )}

        {kuan && (
          <>
            <h3 className="al-h4">5 · Berapa besar populasi dan sampel Anda?</h3>
            <div className="al-duo-isi">
              <label className="al-field">
                <span>Jumlah populasi, bila diketahui</span>
                <input type="number" min={0} value={draf.jumlahPopulasi || ""} inputMode="numeric"
                  onChange={(e) => atur({ jumlahPopulasi: Number(e.target.value) || 0 })} placeholder="1200" />
                <small>{anjuran ? `Rumus Slovin menganjurkan ${anjuran} responden pada taraf kesalahan 5%.` : "Kosongkan bila belum tahu."}</small>
              </label>
              <label className="al-field">
                <span>Sampel yang Anda rencanakan</span>
                <input type="number" min={0} value={draf.perkiraanSampel || ""} inputMode="numeric"
                  onChange={(e) => atur({ perkiraanSampel: Number(e.target.value) || 0 })} placeholder="100" />
                {anjuran && <small><button type="button" className="al-link"
                  onClick={() => atur({ perkiraanSampel: anjuran })}>Pakai anjuran Slovin ({anjuran})</button></small>}
              </label>
            </div>
          </>
        )}

        <button type="button" className="al-btn" onClick={susun} disabled={menyusun}>
          {menyusun ? (
            <><span className="al-putar" aria-hidden="true" /> Menyusun rancangan…</>
          ) : (
            <><Ic d={IKON.centang} /> {lihatHasil ? "Susun ulang rancangan penelitian" : "Susun rancangan penelitian"}</>
          )}
        </button>
      </section>

      {menyusun && (
        <section className="al-card" aria-live="polite">
          <div className="al-memuat">
            <span className="al-putar besar" aria-hidden="true" />
            <div>
              <b>Menyusun rancangan penelitian…</b>
              <p>Mencocokkan tujuan, unit analisis, dan data yang Anda pilih dengan kaidah metodologi.</p>
            </div>
          </div>
        </section>
      )}

      {lihatHasil && (
        <div ref={hasilRef}>
          {hambat.length > 0 && (
            <section className="al-card">
              <h3 className="al-h4">Perlu dibereskan sebelum maju ke pembimbing</h3>
              <ul className="al-list">
                {hambat.map((p) => (
                  <li key={p.judul} className="al-item bad">
                    <div className="al-item-atas"><span className="al-tag">Tidak sejalan</span></div>
                    <p className="al-kutip"><b>{p.judul}</b></p>
                    <p>{p.pesan}</p>
                    <p className="al-fix">Jalan keluar: <b>{p.jalanKeluar}</b></p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="al-card">
            <div className={`al-verdict ${hambat.length > 0 ? "periksa" : "wajar"}`}>
              <span className="al-verdict-mata">JUDUL YANG DISARANKAN</span>
              <h3 className="al-verdict-judul">{judulUtama}</h3>
              <p className="al-verdict-metode">
                <span className="al-cap">{JENIS_UMUM[hasil.jenis]}</span>
                {JENIS_KERJA[hasil.jenis]}
                <em>nama resminya di bab metode: {JENIS_LABEL[hasil.jenis].toLowerCase()}</em>
              </p>
              {/* Empat lapis yang paling sering tertukar. "Pengaruh" bukan
                  metode dan "framing" bukan pendekatan; menulis keduanya di
                  baris yang sama di bab tiga adalah sebab naskah dipulangkan. */}
              <div className="al-lapis">
                <div><span>Pendekatan</span><b>{PENDEKATAN_LABEL[hasil.pendekatan]}</b></div>
                <div><span>Metode</span><b>{hasil.metodePola}</b></div>
                <div>
                  <span>Model atau teori</span>
                  <b>{modelAnjuran ? modelAnjuran.nama : "Tidak ada lapis model pada rancangan survei"}</b>
                </div>
                <div><span>Teknik analisis</span><b>{hasil.analisis[0]?.nama ?? "-"}</b></div>
              </div>
              <b>{hambat.length > 0 ? "Rancangan ini belum utuh" : "Pilihan Anda saling menopang"}</b>
              <p>{hasil.paradigma}</p>
            </div>

            <h3 className="al-h4">Pilihan judul</h3>
            <ul className="al-list">
              {hasil.judul.map((j) => (
                <li key={j} className="al-item ok">
                  <p className="al-kutip"><b>{j}</b></p>
                  <div className="al-aksi">
                    <button type="button" className="al-mini"
                      onClick={() => ubah({ nama: j })}>Pakai sebagai nama project</button>
                    <button type="button" className="al-mini"
                      onClick={() => { ubah({ topik: j }); keAlat("referensi"); }}>Cari referensinya</button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="al-tail">
              Ini kerangka, bukan judul jadi. Bawa dua atau tiga pilihan ke dosen pembimbing, jangan satu.
            </p>
          </section>

          <div className="al-duo">
            <section className="al-card">
              <h3 className="al-h4">Rumusan masalah</h3>
              <ol className="al-steps">{hasil.rumusan.map((r) => <li key={r}>{r}</li>)}</ol>
              <h3 className="al-h4">Tujuan penelitian</h3>
              <ol className="al-steps">{hasil.tujuanTulis.map((t) => <li key={t}>{t}</li>)}</ol>
              <h3 className="al-h4">Teori yang lazim dipakai</h3>
              <ul className="al-plain">{hasil.teori.map((t) => <li key={t}>{t}</li>)}</ul>

              {/* Lapis ketiga, dan sebab paling sering revisi pada rancangan
                  yang memakainya: naskah menulis "analisis framing" tanpa
                  pernah menyatakan framing model siapa. Ketiganya sah; yang
                  membedakan berapa banyak tabel yang harus dibuat. */}
              {hasil.model.length > 0 && (
                <>
                  <h3 className="al-h4">Model atau teori di dalam metodenya, pilih satu</h3>
                  <p className="al-note">
                    Sebut satu di bab metode, jangan mencampur tanpa alasan. Tabel temuanmu mengikuti model
                    yang dipilih.
                  </p>
                  <ul className="al-list">
                    {hasil.model.map((k) => (
                      <li key={k.nama} className={`al-item ${k.anjuran ? "ok" : "abu"}`}>
                        <div className="al-item-atas">
                          <span className="al-tag">{k.anjuran ? "Paling ringkas untuk S1" : "Pilihan lain"}</span>
                        </div>
                        <p className="al-kutip"><b>{k.nama}</b></p>
                        <p>{k.catatan}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="al-card">
              <h3 className="al-h4">Populasi</h3>
              <p className="al-note">{hasil.populasi}</p>
              <h3 className="al-h4">Teknik sampling</h3>
              <ul className="al-list">
                {hasil.sampling.map((s) => (
                  <li key={s.nama} className="al-item abu">
                    <p className="al-kutip"><b>{s.nama}</b></p>
                    <p>{s.alasan}</p>
                  </li>
                ))}
              </ul>
              <h3 className="al-h4">Pengumpulan data</h3>
              <ul className="al-plain">{hasil.pengumpulan.map((p) => <li key={p}>{p}</li>)}</ul>
            </section>
          </div>

          {kerangka && (
            <section className="al-card">
              <h3 className="al-h4">Kerangka berpikir</h3>
              <p className="al-note">
                Bagan ini disusun dari variabel yang Anda isi, jadi panah dan nomor hipotesisnya tidak mungkin
                berselisih dengan rumusan masalahnya.
              </p>
              <BaganKerangka kerangka={kerangka} />

              <h3 className="al-h4">Hipotesis</h3>
              <ul className="al-list">
                {kerangka.jalur.map((j) => (
                  <li key={j.kode} className={`al-item ${j.jenis === "tak-langsung" ? "warn" : "ok"}`}>
                    <div className="al-item-atas">
                      <span className="al-tag">{j.kode}</span>
                      <span className="al-num">
                        {j.jenis === "tak-langsung" ? "tidak langsung" : j.jenis === "serentak" ? "serentak" : "langsung"}
                      </span>
                    </div>
                    <p className="al-kutip">{j.bunyi}</p>
                  </li>
                ))}
              </ul>
              <p className="al-tail">
                Uji pengaruh tidak langsung menuntut uji mediasi, misalnya uji Sobel atau bootstrapping, bukan
                sekadar regresi berganda biasa.
              </p>
            </section>
          )}

          {alur && (
            <section className="al-card">
              <h3 className="al-h4">Kerangka berpikir</h3>
              <p className="al-note">{alur.catatan}</p>
              <BaganAlurPikir alur={alur} />
              <p className="al-tail">
                Salin bagan ini ke BAB II. Tiap tahapnya harus terbaca lagi di bab metode; kalau tidak, penguji
                akan menanyakan dari mana fokus penelitian Anda datang.
              </p>
            </section>
          )}

          <section className="al-card">
            <h3 className="al-h4">Visualisasi yang sesuai</h3>
            <p className="al-note">
              Grafik yang keliru dipilih merusak temuan yang sebenarnya benar. Ini bentuk yang cocok untuk rancangan
              Anda, beserta apa yang diletakkan di tiap sumbunya.
            </p>
            <div className="al-visual">
              {visual.map((v) => (
                <div key={v.nama} className={`al-visual-kartu ${v.utama ? "utama" : ""}`}>
                  <ContohGrafik jenis={v.grafik} />
                  <div className="al-visual-teks">
                    <b>{v.nama}</b>
                    {v.utama && <span className="al-badge">Utama</span>}
                    <p>{v.untuk}</p>
                    {v.sumbu && <p className="al-visual-sumbu">{v.sumbu}</p>}
                    {v.hati && <p className="al-visual-hati">{v.hati}</p>}
                  </div>
                </div>
              ))}
            </div>
            <p className="al-tail">
              Bentuk yang tidak tercantum di sini bukan berarti terlarang, tetapi Anda perlu punya alasan untuk
              memakainya, dan penguji biasanya menanyakannya.
            </p>
          </section>

          <section className="al-card">
            <h3 className="al-h4">Teknik analisis data</h3>
            <ul className="al-list">
              {hasil.analisis.map((a) => (
                <li key={a.nama} className="al-item ok">
                  <p className="al-kutip"><b>{a.nama}</b></p>
                  <p>{a.syarat}</p>
                </li>
              ))}
            </ul>

            <h3 className="al-h4">Keabsahan data</h3>
            <ul className="al-plain">{hasil.keabsahan.map((k) => <li key={k}>{k}</li>)}</ul>

            {periksa.length > 0 && (
              <>
                <h3 className="al-h4">Yang perlu Anda perhatikan</h3>
                <ul className="al-list">
                  {periksa.map((p) => (
                    <li key={p.judul} className="al-item warn">
                      <p className="al-kutip"><b>{p.judul}</b></p>
                      <p>{p.pesan}</p>
                      <p className="al-fix">{p.jalanKeluar}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p className="al-tail">
              Disusun dari kaidah metodologi baku, bukan tebakan mesin. Keputusan akhir tetap milik dosen pembimbing.
            </p>
            <TombolCetak apa="Laporan memuat rancangan metode lengkap. Bawa cetakannya ke bimbingan berikutnya." />

            <LaporanCetak
              judul="Rancangan Penelitian"
              project={project}
              angka={[
                { nilai: kuan ? "Kuantitatif" : "Kualitatif", label: "Pendekatan" },
                { nilai: String(hasil.analisis.length), label: "Tahap analisis" },
                { nilai: String(hambat.length), label: "Perlu dibereskan",
                  nada: hambat.length > 0 ? "bad" : "ok" },
                { nilai: String(periksa.length), label: "Perlu diperhatikan",
                  nada: periksa.length > 0 ? "warn" : undefined },
              ]}
            >
              <div className="lap-meta">
                <b>{JENIS_LABEL[hasil.jenis]}</b>
                <span>{hasil.paradigma}</span>
              </div>

              {hambat.length > 0 && (
                <>
                  <Bagian>Perlu dibereskan sebelum maju ke pembimbing</Bagian>
                  {hambat.map((pr) => (
                    <Butir key={pr.judul} nada="bad" tanda="Tidak sejalan" kutipan={pr.judul}>
                      <p>{pr.pesan}</p>
                      <p className="lap-fix">Jalan keluar: {pr.jalanKeluar}</p>
                    </Butir>
                  ))}
                </>
              )}

              <Bagian>Usulan judul</Bagian>
              <ol>{hasil.judul.map((j) => <li key={j}>{j}</li>)}</ol>

              <Bagian>Rumusan masalah</Bagian>
              <ol>{hasil.rumusan.map((r) => <li key={r}>{r}</li>)}</ol>

              <Bagian>Tujuan penelitian</Bagian>
              <ol>{hasil.tujuanTulis.map((t) => <li key={t}>{t}</li>)}</ol>

              <Bagian>Populasi dan sampel</Bagian>
              <p style={{ fontSize: "9pt", lineHeight: 1.55, color: "#3f4a5c" }}>{hasil.populasi}</p>
              {hasil.sampling.map((sm) => (
                <Butir key={sm.nama} nada="abu" kutipan={sm.nama}><p>{sm.alasan}</p></Butir>
              ))}

              <Bagian>Teknik pengumpulan data</Bagian>
              <ul>{hasil.pengumpulan.map((pg) => <li key={pg}>{pg}</li>)}</ul>

              <Bagian>Teknik analisis data</Bagian>
              {hasil.analisis.map((an) => (
                <Butir key={an.nama} nada="ok" kutipan={an.nama}><p>{an.syarat}</p></Butir>
              ))}

              <Bagian>Uji keabsahan data</Bagian>
              <ul>{hasil.keabsahan.map((kb) => <li key={kb}>{kb}</li>)}</ul>

              <Bagian>Teori yang lazim dipakai</Bagian>
              <ul>{hasil.teori.map((th) => <li key={th}>{th}</li>)}</ul>
              <Bagian>Pendekatan, metode, model, dan teknik analisis</Bagian>
              <ul>
                <li>Pendekatan: {PENDEKATAN_LABEL[hasil.pendekatan]}</li>
                <li>Metode: {hasil.metodePola}</li>
                <li>Model atau teori: {hasil.model.map((k) => k.nama).join("; ") || "tidak ada lapis model pada rancangan survei"}</li>
                <li>Teknik analisis: {hasil.analisis.map((a) => a.nama).join("; ")}</li>
              </ul>

              {periksa.length > 0 && (
                <>
                  <Bagian>Yang perlu diperhatikan</Bagian>
                  {periksa.map((pr) => (
                    <Butir key={pr.judul} nada="warn" kutipan={pr.judul}>
                      <p>{pr.pesan}</p>
                      <p className="lap-fix">{pr.jalanKeluar}</p>
                    </Butir>
                  ))}
                </>
              )}

              <Catatan>
                <p>
                  <b>Ini kerangka, bukan rancangan jadi.</b> Seluruh isinya disusun dari kaidah metodologi yang baku
                  berdasarkan pilihan yang Anda tetapkan sendiri, bukan dari tebakan mesin.
                </p>
                <p>
                  Dosen pembimbing Anda yang paling memahami keadaan lapangan dan kekhasan prodi. Bawa dua atau tiga
                  usulan judul ke bimbingan, jangan satu, dan keputusan akhir tetap ada pada beliau.
                </p>
              </Catatan>
            </LaporanCetak>
          </section>
        </div>
      )}

      <SumberAcuan kunci="judul" />
    </>
  );
}


/* ==========================================================================
   KOTAK CERITA
   Pintu masuk bagi yang belum tahu variabel bebas dan variabel terikatnya.
   Yang diminta hanya satu: ceritakan apa adanya. Isian tujuh langkah di
   bawahnya diisikan dari cerita itu, lalu boleh dibetulkan sendiri.
   ========================================================================== */

function KotakCerita({
  onBacakan, sibuk, prodi, onProdi,
}: {
  onBacakan: (cerita: string) => void;
  sibuk: boolean;
  prodi: Prodi;
  onProdi: (p: Prodi) => void;
}) {
  const [cerita, setCerita] = useState("");
  const kata = hitungKataCerita(cerita);
  const cukup = kata >= MINIMAL_KATA;

  // Tangga penyusunan menyala sambil diketik. Rancangannya belum ada di sini,
  // jadi lima tahap terakhirnya memang masih gelap — dan itu dijelaskan
  // sendiri oleh keterangan di bawah deretannya.
  const tahap = useMemo(
    () => (cerita.trim() ? tahapCerita(tafsirkan(cerita, prodi)) : null),
    [cerita, prodi],
  );

  return (
    <section className="al-card al-cerita">
      <Kepala ikon={IKON.judul} judul="Ceritakan skripsi atau jurnal yang kamu pikirkan"
        sub="Tulis apa adanya, sepanjang yang kamu mau. Biar Cakrawala yang menerjemahkannya jadi metode" />
      <p className="al-note">
        Tidak perlu tahu istilah metodologi lebih dulu. Tulis saja apa yang mengganggu pikiranmu, siapa yang mau
        kamu teliti, dan di mana. <b>Ceritanya tidak dikirim ke mana pun</b>, dibaca di perangkat ini saja.
      </p>

      {/* Prodi menentukan daftar rancangan yang ditawarkan, bukan sekadar
          pilihan teori. Karena itu ia ditanyakan sebelum ceritanya dibaca. */}
      <h3 className="al-h4">Kamu dari prodi apa?</h3>
      <p className="al-note">
        Daftar metode kedua prodi memang berbeda, jadi jawaban ini menentukan rancangan mana yang ditawarkan.
      </p>
      <div className="al-tiles">
        {PRODI_PILIHAN.map((p) => (
          <button key={p.id} type="button" className={`al-tile ${prodi === p.id ? "on" : ""}`}
            aria-pressed={prodi === p.id} disabled={sibuk} onClick={() => onProdi(p.id)}>
            <b>{p.nama}</b><small>{p.ket}</small>
          </button>
        ))}
      </div>

      <label className="al-field">
        <span>Ceritamu</span>
        <textarea
          value={cerita}
          onChange={(e) => setCerita(e.target.value)}
          rows={7}
          placeholder={"Aku pengen neliti soal…\n\nCeritakan bebas: apa yang kamu lihat, kenapa menurutmu itu penting, siapa yang mau kamu teliti, dan di mana."}
        />
        <small>
          {kata} kata{cukup ? " · sudah cukup untuk dibaca" : ` · tulis minimal ${MINIMAL_KATA} kata supaya bisa dibaca`}
        </small>
      </label>

      {tahap && <Tangga tahap={tahap} siap={hitungTahapSiap(tahap)} />}

      <h3 className="al-h4">Belum kepikiran? Pakai salah satu contoh ini</h3>
      <p className="al-note">
        Menekannya mengisi kotak cerita di atas. Judul dan metodenya baru muncul sesudah ceritanya dibacakan.
      </p>
      <div className="al-tiles al-tiles-contoh">
        {contohProdi(prodi).map((c) => (
          <button key={c.id} type="button" className={`al-tile al-tile-contoh ${c.jalur}`}
            disabled={sibuk} onClick={() => setCerita(c.cerita)}>
            <b>{c.label}</b>
            <span className="al-jalur">{c.jalur}</span>
          </button>
        ))}
      </div>

      {cerita && (
        <div className="al-linkrow">
          <button type="button" className="al-link" onClick={() => setCerita("")}>Kosongkan</button>
        </div>
      )}

      <button type="button" className="al-btn" disabled={!cukup || sibuk} onClick={() => onBacakan(cerita)}>
        {sibuk ? (
          <><span className="al-putar" aria-hidden="true" /> Membaca ceritamu…</>
        ) : (
          <><Ic d={IKON.centang} /> Bacakan dan susunkan rancangannya</>
        )}
      </button>
    </section>
  );
}

const KELAS_YAKIN: Record<string, string> = { kuat: "ok", sedang: "warn", terka: "abu" };
const LABEL_YAKIN: Record<string, string> = {
  kuat: "tertulis jelas",
  sedang: "disimpulkan",
  terka: "belum disebut, ini dugaan",
};

/** Apa yang terbaca dari cerita, beserta asalnya di kalimat mahasiswa. */
function HasilBacaan({ bacaan }: { bacaan: Bacaan }) {
  return (
    <section className="al-card">
      <h3 className="al-h4">Yang saya tangkap dari ceritamu</h3>
      <div className={`al-verdict ${bacaan.cukup ? "wajar" : "periksa"}`}>
        <b>{bacaan.cukup ? "Ceritanya sudah bisa dijadikan rancangan" : "Ceritanya masih terlalu ringkas"}</b>
        <p>{bacaan.ringkas}</p>
      </div>

      <ul className="al-list al-list-rapat">
        {bacaan.temuan.map((t) => (
          <li key={t.bidang} className={`al-item ${KELAS_YAKIN[t.yakin] ?? "abu"}`}>
            <div className="al-item-atas">
              <span className="al-tag">{t.bidang}</span>
              <span className="al-num">{LABEL_YAKIN[t.yakin]}</span>
            </div>
            <p className="al-kutip"><b>{t.nilai}</b></p>
            {t.bukti && <p className="al-bukti">Dari kalimatmu: &ldquo;{t.bukti}&rdquo;</p>}
          </li>
        ))}
      </ul>

      {bacaan.pertanyaan.length > 0 && (
        <>
          <h3 className="al-h4">Yang belum ketemu di ceritamu</h3>
          <ol className="al-steps">{bacaan.pertanyaan.map((q) => <li key={q}>{q}</li>)}</ol>
        </>
      )}

      <p className="al-tail">
        Semua ini <b>dugaan yang dibaca dari kalimatmu sendiri</b>, bukan karangan mesin. Kalau ada yang meleset,
        betulkan langsung pada isian di bawah, dan rancangannya ikut berubah seketika.
      </p>
    </section>
  );
}

/* ==========================================================================
   EMPAT JUDUL DARI SATU CERITA
   Satu topik hampir selalu bisa diteliti lebih dari satu cara, dan itu yang
   paling sering tidak diketahui mahasiswa yang bingung. Menekan salah satu
   judul mengisikan rancangannya ke formulir di bawah, jadi pilihannya bukan
   sekadar pajangan.
   ========================================================================== */

/** Bintang kesulitan. Bukan penilaian mutu, melainkan berat pengerjaannya:
 *  berapa panjang bacaan teorinya dan berapa banyak tahap analisisnya. */
function Bintang({ nilai }: { nilai: 1 | 2 | 3 }) {
  return (
    <span className="al-bintang" aria-label={`Berat pengerjaan ${nilai} dari 3`}>
      {"\u2605".repeat(nilai)}
      <i>{"\u2605".repeat(3 - nilai)}</i>
    </span>
  );
}

/**
 * Daftar rancangan yang ditawarkan di prodi ini.
 *
 * Ditampilkan terpisah menurut pendekatannya, karena itulah lapis pertama
 * yang harus ditetapkan sebelum apa pun. Mahasiswa yang sudah tahu mau
 * memakai analisis framing tidak perlu memutar lewat cerita: ia menekan
 * namanya, dan seluruh isian di bawahnya menyesuaikan.
 */
function PilihMetode({
  prodi, kini, onPilih,
}: { prodi: Prodi; kini: Jenis; onPilih: (jenis: Jenis) => void }) {
  const daftar = PRODI_METODE[prodi === "pemerintahan" ? "pemerintahan" : "komunikasi"];
  return (
    <section className="al-card">
      <Kepala ikon={IKON.judul} judul="Rancangan yang dipakai di prodimu"
        sub="Bintangnya berat pengerjaan, bukan nilai bagus atau jelek" />
      <p className="al-note">
        Urutannya dari yang paling sering selesai. Menekan salah satunya memakai rancangan itu, dan seluruh
        isian di bawah ikut menyesuaikan. Kalau belum yakin, biarkan saja: rancangannya disimpulkan dari
        ceritamu.
      </p>
      {(["kuantitatif", "kualitatif"] as const).map((sisi) => (
        <div key={sisi}>
          <h3 className="al-h4">{PENDEKATAN_LABEL[sisi]}</h3>
          <div className="al-tiles">
            {daftar[sisi].map((j) => (
              <button key={j} type="button" className={`al-tile ${kini === j ? "on" : ""}`}
                aria-pressed={kini === j} onClick={() => onPilih(j)}>
                <b>{JENIS_UMUM[j]}</b>
                <small>{JENIS_KERJA[j]}</small>
                <Bintang nilai={KESULITAN[j]} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function PilihJudul({
  jalur, tujuanKini, onPilih,
}: {
  jalur: JalurAlternatif[];
  tujuanKini: Masukan["tujuan"];
  onPilih: (k: JalurAlternatif) => void;
}) {
  return (
    <section className="al-card">
      <h3 className="al-h4">Empat judul dari ceritamu</h3>
      <p className="al-note">
        Satu topik bisa diteliti lebih dari satu cara. Yang menentukan metodenya adalah bentuk pertanyaan yang
        Anda pilih, bukan selera. Tekan salah satunya untuk memakai rancangan itu; isian di bawah ikut menyesuaikan.
        Bagian dalam kurung siku adalah isian yang Anda lengkapi sendiri.
      </p>
      <div className="al-judul-baris">
        {jalur.map((k) => (
          <button
            key={k.id}
            type="button"
            className={`al-judul-kartu ${k.jalur} ${k.masukan.tujuan === tujuanKini ? "on" : ""}`}
            aria-pressed={k.masukan.tujuan === tujuanKini}
            onClick={() => onPilih(k)}
          >
            {k.pas && <span className="al-pas">paling sesuai ceritamu</span>}
            <b>{k.judul}</b>
            <span className="al-tile-metode">
              <span className="al-jalur">{k.metode}</span>
              <small>{k.kerja}</small>
              <Bintang nilai={k.kesulitan} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
