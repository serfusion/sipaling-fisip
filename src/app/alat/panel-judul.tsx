"use client";

import { useMemo, useState } from "react";
import { Ic, IKON, Kepala, Rinci, SumberAcuan } from "./ikon";
import { PerluProject } from "./panel-naskah";
import {
  DATA_PILIHAN, JENIS_LABEL, TUJUAN_PILIHAN, UNIT_PILIHAN,
  kuantitatif, rancang, slovin,
  type Data, type Masukan, type Prodi, type Tujuan, type Unit,
} from "@/lib/metodologi";
import type { Project } from "@/lib/project";
import type { Tab } from "./panel-beranda";
import { Bagian, Butir, Catatan, LaporanCetak, TombolCetak } from "./laporan";
import { BaganKerangka, ContohGrafik } from "./grafik";
import { susunKerangka } from "@/lib/kerangka";
import { GRAFIK_NAMA, usulkanVisual } from "@/lib/visual";

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

  const atur = (bagian: Partial<Masukan>) => {
    const baru = { ...draf, ...bagian };
    setDraf(baru);
    if (project) ubah({ rancangan: baru });
  };

  const hasil = useMemo(() => rancang(draf), [draf]);
  const visual = useMemo(() => usulkanVisual(hasil.jenis), [hasil.jenis]);
  // Kerangka berpikir hanya bermakna pada rancangan yang menguji hubungan
  // antarvariabel. Rancangan deskriptif dan kualitatif tidak memakainya.
  const kerangka = useMemo(
    () => (draf.tujuan === "pengaruh" || draf.tujuan === "hubungan" ? susunKerangka(draf) : null),
    [draf],
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
      <section className="al-card">
        <Kepala ikon={IKON.judul} judul="Perumus Judul dan Metode"
          sub="Katakan apa yang ingin Anda teliti, lalu lihat metode mana yang benar-benar dapat menjawabnya" />
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

        <h3 className="al-h4">3 · Data apa yang benar-benar bisa Anda kumpulkan?</h3>
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

        <button type="button" className="al-btn" onClick={() => setLihatHasil(true)}>
          <Ic d={IKON.centang} /> Susun rancangan penelitian
        </button>
      </section>

      {lihatHasil && (
        <>
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
              <h3>{JENIS_LABEL[hasil.jenis]}</h3>
              <b>{hambat.length > 0 ? "Rancangan ini belum utuh" : "Pilihan Anda saling menopang"}</b>
              <p>{hasil.paradigma}</p>
            </div>

            <h3 className="al-h4">Usulan judul</h3>
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
        </>
      )}

      <SumberAcuan kunci="judul" />
    </>
  );
}
