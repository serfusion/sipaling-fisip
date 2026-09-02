"use client";

// ============================================================
// BELI AKSES CAKRAWALA
//
// Tiga langkah, dan tidak ada satu pun yang menuntut menghubungi siapa-siapa:
// pilih paket → pindai QR → kodenya muncul sendiri di layar ini.
//
// Halaman ini MENANYAKAN status pesanannya berulang kali, bukan menunggu
// diberi tahu. Mahasiswa yang sudah membayar tidak boleh diminta menekan
// tombol "saya sudah bayar" — tombol seperti itu hanya memindahkan pekerjaan
// kembali kepadanya, dan tetap tidak membuktikan apa pun.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { PAKET, rupiah, sisaWaktu, type PaketId } from "@/lib/paket-cakrawala";
import { rapikanWa } from "@/lib/nomor-wa";
import { KONTAK } from "@/lib/kontak";

type Pesanan = {
  orderCode: string;
  namaPaket: string;
  nominal: number;
  hari: number;
  expiresAt: string;
  menit: number;
  svg: string;
};

/** Setiap berapa lama status pesanan ditanyakan ulang. */
const JEDA_TANYA_MS = 4000;
const KUNCI_SIMPAN = "cakrawala-pesanan";

export default function BeliAkses({ onAkses }: { onAkses: (kode: string, whatsapp: string) => void }) {
  const [pilih, setPilih] = useState<PaketId | null>(null);
  const [nama, setNama] = useState("");
  const [kontak, setKontak] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [pesanan, setPesanan] = useState<Pesanan | null>(null);
  const [status, setStatus] = useState<"menunggu" | "lunas" | "kedaluwarsa" | "batal">("menunggu");
  const [kode, setKode] = useState("");
  // Penghitung detik. Sisa waktunya DIHITUNG saat menggambar, bukan disimpan:
  // dua sumber kebenaran untuk satu angka yang sama hanya menambah peluang
  // keduanya berbeda.
  const [tik, setTik] = useState(0);
  const [tersalin, setTersalin] = useState("");
  // Pembelinya menyatakan sudah membayar. Bukan bukti — lihat komentar di
  // /api/cakrawala-klaim — tetapi mengubah yang ditampilkan dan menahan
  // pesanannya supaya nominal uniknya tidak didaur ulang.
  const [klaim, setKlaim] = useState(false);
  const [klaimSibuk, setKlaimSibuk] = useState(false);
  const jamRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Nomor pesanan disimpan di perangkat. Mahasiswa yang tertutup halamannya
  // di tengah pembayaran — dan itu sering terjadi ketika ia berpindah ke
  // aplikasi DANA — kembali ke keadaan yang sama, bukan ke halaman kosong
  // tanpa jejak pesanan yang sudah ia bayar.
  useEffect(() => {
    let simpan = "";
    try {
      simpan = window.localStorage.getItem(KUNCI_SIMPAN) || "";
    } catch {
      return;
    }
    if (!simpan) return;
    void (async () => {
      try {
        const balas = await fetch(`/api/cakrawala-pesan?pesanan=${encodeURIComponent(simpan)}`, {
          cache: "no-store",
        });
        const data = await balas.json();
        if (!data.success) throw new Error("hilang");
        if (data.pesanan.status === "lunas" && data.pesanan.kode) {
          setKode(data.pesanan.kode);
          setStatus("lunas");
        }
      } catch {
        try {
          window.localStorage.removeItem(KUNCI_SIMPAN);
        } catch {
          // Penyimpanan diblokir. Tidak apa-apa: yang hilang cuma kenyamanan.
        }
      }
    })();
  }, []);

  const tanyakan = useCallback(async (nomor: string) => {
    try {
      const balas = await fetch(`/api/cakrawala-pesan?pesanan=${encodeURIComponent(nomor)}`, {
        cache: "no-store",
      });
      const data = await balas.json();
      if (!data.success) return;
      setStatus(data.pesanan.status);
      // Klaim yang sudah tercatat di server ikut dibaca, supaya halaman yang
      // dibuka ulang di perangkat lain tidak menyodorkan tombolnya lagi.
      if (data.pesanan.diklaim) setKlaim(true);
      if (data.pesanan.status === "lunas" && data.pesanan.kode) {
        setKode(data.pesanan.kode);
      }
    } catch {
      // Sekali gagal bukan alasan berhenti bertanya; jaringan ponsel memang
      // putus-nyambung, dan pesanannya tetap ada di server.
    }
  }, []);

  // Satu jam untuk dua hal sekaligus: menggerakkan hitung mundur tiap detik,
  // dan bertanya ke server tiap beberapa detik. Berhenti sendiri begitu lunas
  // atau lewat. Seluruh setState berada di dalam panggilan balik jam, bukan di
  // badan effect — setState sinkron di badan effect memicu gambar bertingkat.
  useEffect(() => {
    if (!pesanan || status !== "menunggu") return;
    const sampai = new Date(pesanan.expiresAt);
    let hitung = 0;
    const jam = setInterval(() => {
      hitung += 1;
      setTik(hitung);
      if (sampai.getTime() <= Date.now()) {
        setStatus("kedaluwarsa");
        return;
      }
      if (hitung % Math.round(JEDA_TANYA_MS / 1000) === 0) void tanyakan(pesanan.orderCode);
    }, 1000);
    jamRef.current = jam;
    return () => clearInterval(jam);
  }, [pesanan, status, tanyakan]);

  // tik hanya penggerak; angkanya sendiri dibaca dari jam sungguhan.
  const sisa = pesanan ? sisaWaktu(new Date(pesanan.expiresAt)) : "";
  // Sudah lama menunggu padahal uangnya mungkin sudah masuk? Sesudah dua
  // menit, nomor pesanannya ditawarkan beserta cara menghubungi pengelola.
  // Diam saja selama sisa waktunya berjalan adalah cara tercepat membuat
  // orang yang sudah membayar merasa uangnya hilang.
  const lama = tik >= 120;
  // Berapa lama sudah menunggu sejak klaim. Jam pengulangnya disetel ulang
  // ketika pesanannya berubah — dan perubahan terakhirnya memang klaim itu —
  // jadi tik menghitung dari sana. Angka yang bergerak memberi tahu bahwa
  // halamannya masih bekerja; layar yang diam terbaca seperti rusak.
  const menitTunggu = Math.floor(tik / 60);

  useEffect(() => {
    if (status === "lunas" && kode) onAkses(kode, kontak);
  }, [status, kode, kontak, onAkses]);

  async function pesan() {
    if (!pilih || sibuk) return;
    // Nomor WhatsApp diminta DI SINI, sebelum uangnya berpindah, bukan sesudah
    // kodenya terbit. Nomor itulah yang menyimpan langganannya; meminta
    // belakangan berarti ada jeda ketika seseorang sudah membayar tetapi
    // belum punya tempat untuk menyimpan apa yang ia beli.
    if (!rapikanWa(kontak)) {
      setGalat("Nomor WhatsApp belum benar. Tulis seperti 0812xxxxxxxx — nomor inilah yang menyimpan langgananmu.");
      return;
    }
    setSibuk(true);
    setGalat("");
    try {
      const balas = await fetch("/api/cakrawala-pesan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paket: pilih, nama, kontak }),
      });
      const data = await balas.json();
      if (!balas.ok || !data.success) throw new Error(data.message || "Pesanan belum dapat dibuat.");
      setPesanan(data.pesanan);
      setStatus("menunggu");
      try {
        window.localStorage.setItem(KUNCI_SIMPAN, data.pesanan.orderCode);
      } catch {
        // Diabaikan; pesanannya tetap hidup di server.
      }
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Pesanan belum dapat dibuat.");
    } finally {
      setSibuk(false);
    }
  }

  async function klaimBayar() {
    if (!pesanan || klaimSibuk) return;
    setKlaimSibuk(true);
    setGalat("");
    try {
      const balas = await fetch("/api/cakrawala-klaim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pesanan: pesanan.orderCode }),
      });
      const data = await balas.json();
      if (!balas.ok || !data.success) throw new Error(data.message || "Klaim belum dapat dikirim.");

      // Pemberitahuan dari ponsel pemilik ternyata sudah tercatat: kodenya
      // terbit saat itu juga, tanpa siapa pun menandai apa pun.
      if (data.keadaan === "lunas" && data.kode) {
        setKode(data.kode);
        setStatus("lunas");
        return;
      }
      setKlaim(true);
      // Server menghidupkan kembali pesanan yang sudah kedaluwarsa, jadi
      // layarnya ikut kembali ke keadaan menunggu — kalau tidak, orang yang
      // menekan tombol ini dari layar "waktunya habis" tetap melihat layar
      // itu juga dan menyangka tombolnya tidak berfungsi.
      setStatus("menunggu");
      if (data.expiresAt) setPesanan({ ...pesanan, expiresAt: data.expiresAt });
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Klaim belum dapat dikirim.");
    } finally {
      setKlaimSibuk(false);
    }
  }

  function salin(teks: string, penanda: string) {
    navigator.clipboard
      ?.writeText(teks)
      .then(() => {
        setTersalin(penanda);
        window.setTimeout(() => setTersalin(""), 2200);
      })
      .catch(() => setTersalin(""));
  }

  function ulangi() {
    setPesanan(null);
    setStatus("menunggu");
    setKode("");
    setGalat("");
    setKlaim(false);
    try {
      window.localStorage.removeItem(KUNCI_SIMPAN);
    } catch {
      // Diabaikan.
    }
  }

  // ---- Kode sudah keluar --------------------------------------------------
  if (status === "lunas" && kode) {
    return (
      <section id="beli" className="beli beli-jadi" aria-label="Kode akses Anda">
        <p className="cw-eyebrow">PEMBAYARAN DITERIMA</p>
        <h2>Ini kode akses Anda</h2>
        <button type="button" className="beli-kode" onClick={() => salin(kode, "kode")}>
          <b>{kode}</b>
          <span>{tersalin === "kode" ? "Tersalin ✓" : "Ketuk untuk menyalin"}</span>
        </button>
        <p className="beli-jadi-sub">
          Masukkan kode ini pada kotak <b>Kode Akses</b> di bawah bersama nomor WhatsApp Anda, lalu
          Cakrawala terbuka. Simpan kodenya — dengan nomor yang sama, ia dapat dipakai lagi kapan
          pun Anda berganti HP atau membuka di laptop.
        </p>
      </section>
    );
  }

  // ---- Menunggu pembayaran ------------------------------------------------
  if (pesanan && status === "menunggu") {
    return (
      <section id="beli" className="beli beli-bayar" aria-label="Selesaikan pembayaran">
        <p className="cw-eyebrow">TINGGAL BAYAR</p>
        <h2>Pindai QR ini dari aplikasi apa pun</h2>

        <div className="beli-qr" dangerouslySetInnerHTML={{ __html: pesanan.svg }} />

        <div className="beli-nominal">
          <small>Bayar tepat sejumlah</small>
          <button type="button" onClick={() => salin(String(pesanan.nominal), "nominal")}>
            <b>{rupiah(pesanan.nominal)}</b>
            <span>{tersalin === "nominal" ? "Tersalin ✓" : "salin"}</span>
          </button>
          <p>
            Angka di belakangnya sengaja unik — itulah yang menandai pesanan Anda, jadi kodenya bisa
            keluar sendiri tanpa Anda perlu mengirim bukti apa pun.
          </p>
        </div>

        {klaim ? (
          <div className="beli-tunggu beli-diperiksa">
            <span className="beli-putar" aria-hidden="true" />
            <div>
              <b>
                Pembayaranmu sedang diperiksa
                {menitTunggu > 0 && ` · ${menitTunggu} menit`}
              </b>
              <small>
                Pesananmu sudah ditahan supaya nominalnya tidak dipakai orang lain, dan pengelola
                sudah dikabari langsung ke ponselnya. Begitu pembayarannya dipastikan, kode akses
                muncul sendiri di halaman ini — boleh ditinggal, halamannya tetap memeriksa.
              </small>
            </div>
          </div>
        ) : (
          <div className="beli-tunggu">
            <span className="beli-putar" aria-hidden="true" />
            <div>
              <b>Menunggu pembayaran… {sisa}</b>
              <small>
                Halaman ini memeriksa sendiri. Begitu pembayarannya masuk, kode akses langsung
                muncul di sini — jangan ditutup dulu.
              </small>
            </div>
          </div>
        )}

        {!klaim && (
          <button
            type="button"
            className="cw-btn beli-klaim"
            disabled={klaimSibuk}
            onClick={() => void klaimBayar()}
          >
            {klaimSibuk ? "Memeriksa…" : "Saya sudah membayar"}
          </button>
        )}

        {(lama || klaim) && (
          <p className="beli-lambat">
            <b>Pembayaranmu tidak hilang.</b> Nomor pesanan <code>{pesanan.orderCode}</code> dan
            nominal <b>{rupiah(pesanan.nominal)}</b> tersimpan di server. Kalau lebih dari beberapa
            menit kodenya belum keluar juga, kirim dua angka itu ke {KONTAK}.
          </p>
        )}

        <div className="beli-kaki">
          <span>Nomor pesanan <code>{pesanan.orderCode}</code></span>
          <button type="button" className="cw-btn" onClick={ulangi}>Batal, pilih paket lain</button>
        </div>
      </section>
    );
  }

  // ---- QR sudah lewat waktunya -------------------------------------------
  if (pesanan && status !== "menunggu") {
    return (
      <section id="beli" className="beli beli-lewat" aria-label="Waktu pembayaran habis">
        <p className="cw-eyebrow">WAKTUNYA HABIS</p>
        <h2>QR pembayarannya sudah kedaluwarsa</h2>
        <p>
          QR hanya berlaku {pesanan.menit} menit supaya nominalnya bisa dipakai pembeli lain. Kalau
          Anda <b>sudah terlanjur membayar</b>, jangan buat pesanan baru — tekan tombol di bawah.
          Pesanan <code>{pesanan.orderCode}</code> dihidupkan kembali dan pembayaran Anda tetap
          tercatat.
        </p>
        {galat && <p className="cw-galat" role="alert">{galat}</p>}
        <div className="beli-lewat-aksi">
          {/* Tombolnya didahulukan atas "buat pesanan baru". Orang yang sudah
              membayar dan disodori tombol memesan lagi akan menekannya, dan
              uang yang pertama menjadi pekerjaan penelusuran yang tidak perlu. */}
          <button
            type="button"
            className="cw-btn cw-btn-utama"
            disabled={klaimSibuk}
            onClick={() => void klaimBayar()}
          >
            {klaimSibuk ? "Memeriksa…" : "Saya sudah membayar"}
          </button>
          <button type="button" className="cw-btn" onClick={ulangi}>Belum, buat pesanan baru</button>
        </div>
      </section>
    );
  }

  // ---- Pilih paket --------------------------------------------------------
  return (
    <section id="beli" className="beli" aria-label="Beli akses Cakrawala">
      <div className="beli-kepala">
        <p className="cw-eyebrow">BELUM PUNYA KODE AKSES?</p>
        <h2>Pilih paketnya, bayar, kodenya keluar sendiri</h2>
        <p className="beli-sub">
          Tanpa mendaftar, tanpa menunggu dibalas. Bayar lewat QRIS dari aplikasi apa pun, dan kode
          aksesnya muncul di layar ini juga.
        </p>
      </div>

      <div className="beli-paket">
        {PAKET.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`beli-kartu ${pilih === p.id ? "on" : ""} ${p.utama ? "utama" : ""}`}
            aria-pressed={pilih === p.id}
            onClick={() => setPilih(p.id)}
          >
            {p.utama && <span className="beli-tanda">paling banyak dipilih</span>}
            <b className="beli-nama">{p.nama}</b>
            <span className="beli-harga">{rupiah(p.harga)}</span>
            <span className="beli-hari">{p.hari} hari</span>
            <small className="beli-jelas">{p.jelas}</small>
            <small className="beli-untuk">{p.untuk}</small>
          </button>
        ))}
      </div>

      <div className="beli-isian">
        <label>
          <span>Nama (boleh dikosongkan)</span>
          <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Buat catatan pesanan Anda" />
        </label>
        <label>
          <span>Nomor WhatsApp</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={kontak}
            onChange={(e) => setKontak(e.target.value)}
            placeholder="0812xxxxxxxx"
          />
          <small className="beli-bantu">
            Langgananmu disimpan di nomor ini. Ganti HP atau buka di laptop tetap bisa masuk, dan
            perpanjangan nanti cukup lewat WhatsApp.
          </small>
        </label>
      </div>

      {galat && <p className="cw-galat" role="alert">{galat}</p>}

      <button type="button" className="cw-btn cw-btn-utama beli-lanjut" disabled={!pilih || sibuk} onClick={() => void pesan()}>
        {sibuk ? "Menyiapkan QR…" : pilih ? `Bayar ${rupiah(PAKET.find((p) => p.id === pilih)?.harga ?? 0)}` : "Pilih paket dulu"}
      </button>

      <p className="beli-aman">
        Pembayaran lewat QRIS langsung ke rekening pengelola. Cakrawala tidak menyimpan data kartu
        maupun akun pembayaran Anda.
      </p>
    </section>
  );
}
