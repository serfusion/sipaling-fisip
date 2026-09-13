"use client";

// ============================================================
// LAYAR NONTON DRAMA
//
// Satu layar untuk sepuluh platform. Yang membedakan tiap platform sudah
// dirapikan jauh sebelum sampai ke sini — tabelnya di src/lib/drama.ts,
// pembacanya di src/lib/drama-baca.ts — sehingga berkas ini tidak pernah
// perlu tahu bahwa PineDrama menyebut judulnya "title" dan DramaBox
// menyebutnya "bookName".
//
// Tiga layar saja: daftar, rincian, dan menonton. Sengaja tidak lebih.
// Proyek asalnya memberi tiap platform halaman beranda, halaman rincian, dan
// halaman menonton sendiri — tiga puluh berkas layar yang isinya hampir sama,
// dan tiap perbaikan kecil harus diulang tiga puluh kali.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { barisDaftar, platformAktif, type Aksi, type Platform } from "@/lib/drama";
import type { Episode, Kartu, Rinci } from "@/lib/drama-baca";
import { Pemutar } from "./pemutar";

type Jawaban = {
  success?: boolean;
  message?: string;
  daftar?: Kartu[];
  daftarEpisode?: Episode[];
  kursor?: string;
  rinci?: Rinci;
  episode?: Episode;
};

type Baris = {
  aksi: Aksi;
  judul: string;
  isi: Kartu[];
  kursor: string;
  sibuk: boolean;
  galat: string;
};

const PLATFORM_TERBUKA = platformAktif();

/** Berapa kartu digambar sekaligus pada satu baris sebelum "lihat semua". */
const SEPOTONG = 12;

async function minta(
  platform: string,
  aksi: Aksi,
  kueri: Record<string, string | number | undefined> = {},
  tanda?: AbortSignal,
): Promise<Jawaban> {
  const alamat = new URL(`/api/drama/${platform}/${aksi}`, window.location.origin);
  for (const [kunci, nilai] of Object.entries(kueri)) {
    if (nilai !== undefined && nilai !== "") alamat.searchParams.set(kunci, String(nilai));
  }

  const jawab = await fetch(alamat.toString(), { cache: "no-store", signal: tanda });
  const isi = (await jawab.json().catch(() => ({}))) as Jawaban;

  if (jawab.status === 403) {
    // Langganannya habis di tengah menonton. Halaman dimuat ulang supaya
    // gerbang di server yang menjelaskan keadaannya, bukan pesan galat kecil
    // di pojok layar yang tidak memberi tahu apa yang harus dilakukan.
    window.location.reload();
    throw new Error("Akses berakhir.");
  }
  if (!jawab.ok || !isi.success) throw new Error(isi.message || "Sumber dramanya tidak menjawab.");
  return isi;
}

export default function DramaApp() {
  const [platform, setPlatform] = useState<Platform>(PLATFORM_TERBUKA[0]);
  const [baris, setBaris] = useState<Baris[]>([]);
  const [kata, setKata] = useState("");
  const [cari, setCari] = useState("");
  const [hasilCari, setHasilCari] = useState<Kartu[] | null>(null);
  const [sibukCari, setSibukCari] = useState(false);
  const [terpilih, setTerpilih] = useState<Kartu | null>(null);

  // ---------- DAFTAR ----------

  useEffect(() => {
    const kendali = new AbortController();
    const rencana = barisDaftar(platform);
    setBaris(rencana.map((item) => ({ ...item, isi: [], kursor: "", sibuk: true, galat: "" })));

    // Seluruh baris diminta bersamaan. Berurutan akan membuat baris ketiga
    // menunggu baris pertama yang kebetulan lambat, padahal keduanya tidak
    // saling bergantung sama sekali.
    for (const item of rencana) {
      minta(platform.id, item.aksi, {}, kendali.signal)
        .then((jawab) => {
          setBaris((sebelum) =>
            sebelum.map((satu) =>
              satu.aksi === item.aksi
                ? { ...satu, isi: jawab.daftar ?? [], kursor: jawab.kursor ?? "", sibuk: false }
                : satu,
            ),
          );
        })
        .catch((alasan: unknown) => {
          if (kendali.signal.aborted) return;
          setBaris((sebelum) =>
            sebelum.map((satu) =>
              satu.aksi === item.aksi
                ? { ...satu, sibuk: false, galat: alasan instanceof Error ? alasan.message : "Gagal dimuat." }
                : satu,
            ),
          );
        });
    }

    return () => kendali.abort();
  }, [platform]);

  const muatLagi = useCallback(
    async (aksi: Aksi) => {
      const sekarang = baris.find((item) => item.aksi === aksi);
      if (!sekarang || sekarang.sibuk) return;

      // Dua cara menandai halaman berikutnya, dan keduanya dipakai hulu:
      // kursor yang dikirim balik apa adanya, atau nomor halaman yang kita
      // hitung sendiri dari berapa kali baris ini sudah bertambah.
      const berikut = sekarang.kursor || String(Math.floor(sekarang.isi.length / 20) + 1);
      setBaris((sebelum) =>
        sebelum.map((item) => (item.aksi === aksi ? { ...item, sibuk: true, galat: "" } : item)),
      );

      try {
        const jawab = await minta(platform.id, aksi, { halaman: berikut });
        setBaris((sebelum) =>
          sebelum.map((item) => {
            if (item.aksi !== aksi) return item;
            const adaSudah = new Set(item.isi.map((kartu) => kartu.id));
            const tambahan = (jawab.daftar ?? []).filter((kartu) => !adaSudah.has(kartu.id));
            return {
              ...item,
              isi: [...item.isi, ...tambahan],
              kursor: jawab.kursor ?? "",
              sibuk: false,
            };
          }),
        );
      } catch (alasan: unknown) {
        setBaris((sebelum) =>
          sebelum.map((item) =>
            item.aksi === aksi
              ? { ...item, sibuk: false, galat: alasan instanceof Error ? alasan.message : "Gagal dimuat." }
              : item,
          ),
        );
      }
    },
    [baris, platform.id],
  );

  // ---------- PENCARIAN ----------

  // Diketik huruf demi huruf, tetapi tidak dicari huruf demi huruf: tiap
  // ketikan yang langsung dikirim berarti sepuluh permintaan untuk satu kata.
  useEffect(() => {
    const isi = kata.trim();
    if (!isi) {
      setHasilCari(null);
      setCari("");
      return;
    }
    const jeda = window.setTimeout(() => setCari(isi), 450);
    return () => window.clearTimeout(jeda);
  }, [kata]);

  useEffect(() => {
    if (!cari) return;
    const kendali = new AbortController();
    setSibukCari(true);
    minta(platform.id, "cari", { cari }, kendali.signal)
      .then((jawab) => setHasilCari(jawab.daftar ?? []))
      .catch(() => {
        if (!kendali.signal.aborted) setHasilCari([]);
      })
      .finally(() => {
        if (!kendali.signal.aborted) setSibukCari(false);
      });
    return () => kendali.abort();
  }, [cari, platform.id]);

  return (
    <div className="dr">
      <header className="dr-atas">
        <div className="dr-atas-in">
          <div className="dr-merek">
            <span className="dr-merek-ic" aria-hidden="true">▶</span>
            <span>
              <b>Nonton Drama</b>
              <small>Bonus pemegang kode Cakrawala</small>
            </span>
          </div>

          <label className="dr-cari">
            <span className="dr-cari-ic" aria-hidden="true">⌕</span>
            <input
              type="search"
              value={kata}
              onChange={(peristiwa) => setKata(peristiwa.target.value)}
              placeholder={`Cari judul di ${platform.nama}…`}
              aria-label="Cari judul drama"
            />
            {kata && (
              <button type="button" className="dr-cari-hapus" onClick={() => setKata("")} aria-label="Hapus pencarian">
                ×
              </button>
            )}
          </label>
        </div>

        <nav className="dr-platform" aria-label="Pilih sumber">
          {PLATFORM_TERBUKA.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`dr-plat ${item.id === platform.id ? "on" : ""}`}
              aria-current={item.id === platform.id ? "true" : undefined}
              onClick={() => {
                setPlatform(item);
                setTerpilih(null);
              }}
              title={item.catatan}
            >
              <span className="dr-plat-ic" style={{ background: item.warna }}>{item.inisial}</span>
              {item.nama}
            </button>
          ))}
        </nav>
      </header>

      <main className="dr-isi">
        {platform.catatan && (
          <p className="dr-catatan" role="note">{platform.catatan}</p>
        )}

        {hasilCari !== null ? (
          <HasilCari
            kata={cari}
            isi={hasilCari}
            sibuk={sibukCari}
            buka={setTerpilih}
            tutup={() => setKata("")}
          />
        ) : (
          baris.map((item) => (
            <BarisKartu key={item.aksi} baris={item} buka={setTerpilih} lagi={() => void muatLagi(item.aksi)} />
          ))
        )}
      </main>

      {terpilih && (
        // Kunci berisi platform dan judulnya, jadi memilih judul lain
        // memasang layar yang benar-benar baru. Itu lebih murah daripada
        // menyetel ulang setengah lusin keadaan dengan tangan — dan tidak
        // pernah menyisakan episode judul sebelumnya yang masih menempel.
        <LayarJudul
          key={`${platform.id}:${terpilih.id}`}
          platform={platform}
          kartu={terpilih}
          tutup={() => setTerpilih(null)}
        />
      )}

      <footer className="dr-kaki">
        <strong>SiPaling FISIP</strong>
        <span>
          Daftar judul dan videonya berasal dari API terbuka proyek{" "}
          <a href="https://github.com/Sansekai/SekaiDrama" target="_blank" rel="noreferrer noopener">SekaiDrama</a>.
          Situs ini tidak menyimpan satu pun berkas video.
        </span>
      </footer>
    </div>
  );
}

// ============================================================
// BARIS KARTU
// ============================================================

function BarisKartu({ baris, buka, lagi }: { baris: Baris; buka: (kartu: Kartu) => void; lagi: () => void }) {
  const [semua, setSemua] = useState(false);
  const tampil = semua ? baris.isi : baris.isi.slice(0, SEPOTONG);

  if (!baris.sibuk && !baris.isi.length && baris.galat) {
    return (
      <section className="dr-baris">
        <h2>{baris.judul}</h2>
        <p className="dr-galat" role="alert">{baris.galat}</p>
      </section>
    );
  }

  return (
    <section className="dr-baris">
      <div className="dr-baris-kepala">
        <h2>{baris.judul}</h2>
        {baris.isi.length > SEPOTONG && (
          <button type="button" className="dr-link" onClick={() => setSemua((nilai) => !nilai)}>
            {semua ? "Ringkas" : `Lihat semua (${baris.isi.length})`}
          </button>
        )}
      </div>

      <div className="dr-grid">
        {tampil.map((kartu) => (
          <KartuJudul key={kartu.id} kartu={kartu} buka={buka} />
        ))}
        {baris.sibuk && !baris.isi.length &&
          Array.from({ length: 6 }, (_, nomor) => <span key={nomor} className="dr-kartu dr-rangka" />)}
      </div>

      {semua && (
        <div className="dr-baris-kaki">
          <button type="button" className="dr-mini" onClick={lagi} disabled={baris.sibuk}>
            {baris.sibuk ? "Memuat…" : "Muat lebih banyak"}
          </button>
          {baris.galat && <span className="dr-galat-kecil">{baris.galat}</span>}
        </div>
      )}
    </section>
  );
}

function KartuJudul({ kartu, buka }: { kartu: Kartu; buka: (kartu: Kartu) => void }) {
  return (
    <button type="button" className="dr-kartu" onClick={() => buka(kartu)}>
      <span className="dr-kartu-gambar">
        {kartu.sampul ? (
          // eslint-disable-next-line @next/next/no-img-element -- sampul berasal dari CDN pihak ketiga yang berubah-ubah; next/image menuntut daftar host tetap
          <img src={kartu.sampul} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="dr-kartu-kosong" aria-hidden="true">▶</span>
        )}
        {kartu.episode > 0 && <span className="dr-kartu-eps">{kartu.episode} eps</span>}
      </span>
      <span className="dr-kartu-judul">{kartu.judul}</span>
    </button>
  );
}

function HasilCari({
  kata, isi, sibuk, buka, tutup,
}: {
  kata: string;
  isi: Kartu[];
  sibuk: boolean;
  buka: (kartu: Kartu) => void;
  tutup: () => void;
}) {
  return (
    <section className="dr-baris">
      <div className="dr-baris-kepala">
        <h2>Hasil pencarian “{kata}”</h2>
        <button type="button" className="dr-link" onClick={tutup}>Kembali ke daftar</button>
      </div>

      {sibuk && !isi.length ? (
        <div className="dr-grid">
          {Array.from({ length: 6 }, (_, nomor) => <span key={nomor} className="dr-kartu dr-rangka" />)}
        </div>
      ) : isi.length ? (
        <div className="dr-grid">
          {isi.map((kartu) => <KartuJudul key={kartu.id} kartu={kartu} buka={buka} />)}
        </div>
      ) : (
        <p className="dr-kosong">Tidak ada judul yang cocok di platform ini. Coba platform lain di atas.</p>
      )}
    </section>
  );
}

// ============================================================
// LAYAR SATU JUDUL
// ============================================================

function LayarJudul({ platform, kartu, tutup }: { platform: Platform; kartu: Kartu; tutup: () => void }) {
  const [rinci, setRinci] = useState<Rinci | null>(null);
  const [galat, setGalat] = useState("");
  const [nomor, setNomor] = useState(0);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [sibukEpisode, setSibukEpisode] = useState(false);
  const [galatEpisode, setGalatEpisode] = useState("");

  /** Episode yang sudah terlanjur diambil sekaligus, untuk platform "semua". */
  const borongan = useRef<Episode[] | null>(null);

  useEffect(() => {
    const kendali = new AbortController();

    minta(platform.id, "rinci", { id: kartu.id }, kendali.signal)
      .then((jawab) => {
        if (!jawab.rinci) throw new Error("Rincian judul ini tidak terbaca.");
        // Yang dikirim hulu kerap lebih miskin daripada kartunya sendiri —
        // tanpa sampul, tanpa jumlah episode. Yang sudah diketahui dari kartu
        // dipakai sebagai cadangan, supaya layarnya tidak mundur.
        setRinci({
          ...jawab.rinci,
          judul: jawab.rinci.judul || kartu.judul,
          sampul: jawab.rinci.sampul || kartu.sampul,
          ringkasan: jawab.rinci.ringkasan || kartu.ringkasan,
          episode: Math.max(jawab.rinci.episode, kartu.episode),
          label: jawab.rinci.label.length ? jawab.rinci.label : kartu.label,
        });
      })
      .catch((alasan: unknown) => {
        if (!kendali.signal.aborted) {
          setGalat(alasan instanceof Error ? alasan.message : "Rincian judul ini gagal dimuat.");
        }
      });

    return () => kendali.abort();
  }, [platform.id, kartu]);

  const jumlah = rinci ? Math.max(rinci.episode, rinci.daftar.length) : kartu.episode;

  const putar = useCallback(
    async (pilihan: number) => {
      if (!rinci) return;
      setNomor(pilihan);
      setEpisode(null);
      setGalatEpisode("");

      // Episode yang tautannya sudah ikut di jawaban rinci tidak perlu
      // diminta lagi. Itu bukan penghematan kecil: di FreeReels seluruh
      // episodenya memang datang sekaligus di sana.
      const dariRinci = rinci.daftar.find((item) => item.nomor === pilihan);
      if (dariRinci?.aliran.length) {
        setEpisode(dariRinci);
        return;
      }

      setSibukEpisode(true);
      try {
        if (platform.caraEpisode === "semua") {
          if (!borongan.current) {
            const jawab = await minta(platform.id, "episode", { id: rinci.id || kartu.id });
            // Diambil sekali, lalu diingat: satu judul DramaBox dapat berisi
            // delapan puluh episode, dan memintanya ulang tiap kali pengunjung
            // menekan nomor berikutnya adalah delapan puluh permintaan untuk
            // satu jawaban yang sama.
            borongan.current = jawab.daftarEpisode ?? (jawab.episode ? [jawab.episode] : []);
          }
          const ketemu =
            borongan.current.find((item) => item.nomor === pilihan) ?? borongan.current[pilihan - 1] ?? null;
          if (!ketemu) throw new Error("Episode ini tidak ada di sumbernya.");
          setEpisode(ketemu);
        } else if (platform.caraEpisode === "id-episode") {
          const acuan = rinci.daftar.find((item) => item.nomor === pilihan);
          if (!acuan?.id) throw new Error("Episode ini belum punya penanda di sumbernya.");
          const jawab = await minta(platform.id, "episode", { id: acuan.id });
          setEpisode(jawab.episode ?? { ...acuan, aliran: [] });
        } else if (platform.caraEpisode === "dalam-rinci") {
          throw new Error("Episode ini tidak menyertakan tautan video.");
        } else {
          const jawab = await minta(platform.id, "episode", { id: rinci.id || kartu.id, episode: pilihan });
          setEpisode(jawab.episode ?? null);
        }
      } catch (alasan: unknown) {
        setGalatEpisode(alasan instanceof Error ? alasan.message : "Episode ini gagal dimuat.");
      } finally {
        setSibukEpisode(false);
      }
    },
    [platform, rinci, kartu.id],
  );

  const daftarNomor = useMemo(() => {
    if (jumlah > 0) return Array.from({ length: Math.min(jumlah, 400) }, (_, urutan) => urutan + 1);
    return rinci?.daftar.map((item) => item.nomor) ?? [];
  }, [jumlah, rinci]);

  return (
    <div className="dr-layar" role="dialog" aria-modal="true" aria-label={kartu.judul}>
      <div className="dr-layar-in">
        <button type="button" className="dr-tutup" onClick={tutup} aria-label="Tutup">×</button>

        {nomor > 0 && (
          <div className="dr-tonton">
            <div className="dr-tonton-kepala">
              <b>{rinci?.judul || kartu.judul}</b>
              <span>Episode {nomor}</span>
            </div>

            {sibukEpisode && <p className="dr-kosong">Menyiapkan episode…</p>}
            {galatEpisode && <p className="dr-galat" role="alert">{galatEpisode}</p>}
            {episode && !sibukEpisode && (
              <Pemutar
                aliran={episode.aliran}
                platform={platform.id}
                wadahTersandi={platform.wadahTersandi}
                onSelesai={() => {
                  if (nomor < jumlah) void putar(nomor + 1);
                }}
              />
            )}

            <div className="dr-tonton-aksi">
              <button type="button" className="dr-mini" disabled={nomor <= 1} onClick={() => void putar(nomor - 1)}>
                ← Sebelumnya
              </button>
              <button
                type="button"
                className="dr-mini"
                disabled={jumlah > 0 && nomor >= jumlah}
                onClick={() => void putar(nomor + 1)}
              >
                Berikutnya →
              </button>
            </div>
          </div>
        )}

        <div className="dr-judul">
          <span className="dr-judul-gambar">
            {(rinci?.sampul || kartu.sampul) ? (
              // eslint-disable-next-line @next/next/no-img-element -- lihat alasan di KartuJudul
              <img src={rinci?.sampul || kartu.sampul} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="dr-kartu-kosong" aria-hidden="true">▶</span>
            )}
          </span>
          <div className="dr-judul-teks">
            <h2>{rinci?.judul || kartu.judul}</h2>
            <p className="dr-judul-tanda">
              <span className="dr-plat-ic dr-plat-ic-kecil" style={{ background: platform.warna }}>
                {platform.inisial}
              </span>
              {platform.nama}
              {jumlah > 0 && <> · {jumlah} episode</>}
            </p>
            {(rinci?.label.length ?? 0) > 0 && (
              <p className="dr-label">{rinci!.label.map((satu) => <span key={satu}>{satu}</span>)}</p>
            )}
            <p className="dr-ringkas">{rinci?.ringkasan || kartu.ringkasan || "Tidak ada ringkasan dari sumbernya."}</p>
          </div>
        </div>

        {galat && <p className="dr-galat" role="alert">{galat}</p>}

        {!rinci && !galat && <p className="dr-kosong">Memuat rincian…</p>}

        {rinci && (
          <div className="dr-eps">
            <h3>Pilih episode</h3>
            {daftarNomor.length ? (
              <div className="dr-eps-grid">
                {daftarNomor.map((satu) => (
                  <button
                    key={satu}
                    type="button"
                    className={`dr-eps-btn ${satu === nomor ? "on" : ""}`}
                    onClick={() => void putar(satu)}
                  >
                    {satu}
                  </button>
                ))}
              </div>
            ) : (
              <p className="dr-kosong">Sumbernya tidak menyebutkan daftar episode judul ini.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
