"use client";

// ============================================================
// PANEL CBT DI DASHBOARD — untuk Pengajar, Admin, dan Super Admin
//
// Pembagian wewenangnya kelihatan dari layarnya, bukan hanya dijaga server.
// Yang menentukan bukan PERAN melainkan KEPEMILIKAN:
//
//   Pemilik ujian  — pengajar yang membuatnya — menyusun soal, menyetel jadwal,
//                    mengaktifkan dan menonaktifkan, serta mengoreksi essay.
//   Admin dan Super Admin memantau seluruh ujian dan boleh menghapusnya, tetapi
//                    TIDAK memegang tombol aktivasi ujian milik pengajar lain.
//                    Untuk ujian seleksi mereka membuatnya sendiri — dan ujian
//                    itu milik mereka, jadi tombolnya terbuka di sana.
//
// Admin bagian — umum, akademik, prodi, PDDIKTI, perpustakaan, laboratorium —
// tidak melihat menu ini sama sekali.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ejaWaktu, JENIS_LABEL, KEADAAN_JAWAB_LABEL, keadaanJawab, kunciTerbaca, labelStatusPeserta,
  MEDIA_KOSONG, SEMUA_JENIS, STATUS_LABEL, uraiKunciJamak,
  type JenisSoal, type Media, type Pasangan, type StatusUjian,
} from "@/lib/cbt";
import { imporDariExcel, imporDariWord, type SoalImpor, type Aoa } from "@/lib/impor-soal";
import { sarikanDokumen, type HasilSari } from "@/lib/sari-dokumen";
import { JENIS_AI, MAKS_SOAL } from "@/lib/ai-soal";
import {
  beritaAcaraHtml, laporanPesertaHtml, naskahSoalHtml, posterQrHtml,
  type PesertaCetak, type UjianCetak,
} from "@/lib/cetak-cbt";
import { gambarQr, namaBerkasQr } from "@/lib/qr-ujian";
import {
  HURUF_ZONA, jamIndonesia, pecahWaktuUjian, PILIHAN_JAM, PILIHAN_MENIT, susunWaktuUjian,
} from "@/lib/waktu-indonesia";
import { buatDocxTemplate, buatXlsxTemplate } from "@/lib/template-soal";
import { asalCbt } from "@/lib/situs-cbt";
import {
  KLIEN_LABEL, PERANGKAT_LABEL, SEMUA_PERANGKAT, kunciSistem, rapikanKlien,
  rapikanPerangkatKunci, type PerangkatKunci,
} from "@/lib/kunci-layar";
import {
  INSIDEN_LABEL, MODE_KETERANGAN, MODE_LABEL, SEMUA_MODE, aturanMode, rapikanMode,
  tingkatIntegritas, TINGKAT_LABEL, type JenisInsiden, type ModePengawasan,
} from "@/lib/pengawasan";
import { KREDIT_CBT } from "../cbt/kredit";

type Ujian = {
  id: number; code: string; title: string; courseName: string; className: string | null;
  questionCount: number; durationMinutes: number; passingGrade: number; maxAttempts: number;
  randomQuestions: boolean; randomOptions: boolean; allowBack: boolean; showScore: boolean;
  token: string | null; startAt: string | null; endAt: string | null;
  activatedAt: string | null; activatedBy: string | null;
  description: string | null; instruction: string | null; createdBy: string;
  singleDevice: boolean;
  /** Ujian hanya boleh dikerjakan lewat aplikasi Exam Browser. */
  requireLockdown: boolean;
  lockdownDevice?: string;
  /** Mode pengawasan: "biasa" | "ketat" | "sertifikasi". */
  proctorMode: string;
  /** Saklar kamera pengawas. Hanya berlaku pada mode Sertifikasi/OSCE. */
  cameraOn: boolean;
  status: StatusUjian; jumlahBank: number;
  peserta: { total: number; berjalan: number; selesai: number };
  /** Izin yang dihitung server untuk pemanggil ini, per ujian. */
  milik: boolean; bolehUbah: boolean; bolehHapus: boolean;
  /**
   * Boleh menggeser saklar kamera. Dihitung SERVER dari peran pemanggil, dan
   * sengaja tidak disimpulkan di sini — aturan siapa boleh apa hanya boleh
   * tertulis di satu tempat, dan tempat itu bukan peramban.
   */
  bolehSaklarKamera: boolean;
};

/** Satu jawaban peserta, dibuka pengajar untuk dibaca dan dikoreksi. */
type Rincian = {
  nomor: number; id: number; jenis: JenisSoal; pertanyaan: string;
  pilihan: string[]; bobot: number; kunci: string; pembahasan: string | null;
  jawaban: string; jawabanTeks: string;
  /**
   * Kunci yang sudah dirangkai server menjadi kalimat: "B. Kultivasi;
   * D. Spiral of silence". Sengaja tidak dirakit di sini — jawaban peserta dan
   * kuncinya harus diurutkan dengan cara yang sama dengan yang dipakai ketika
   * nilainya dihitung, dan peta pengacakan pilihannya tidak pernah ikut ke
   * peramban.
   */
  kunciTeks: string;
  benar: boolean | null; poin: number; catatan: string;
};

type Soal = {
  id: number; jenis: JenisSoal; pertanyaan: string; pilihan: string[];
  kunci: string; pasangan: Pasangan[]; media: Media;
  bobot: number; materi: string; tingkat: string; pembahasan: string;
};

type Peserta = {
  id: number; nim: string; nama: string; status: string; terjawab: number;
  nilai: number | null; tertunda: number; sisaDetik: number;
  /** Detik sejak peramban peserta terakhir menyapa. null = belum pernah. */
  diamDetik: number | null;
  keluarFullscreen: number; pindahTab: number; mulai: string; kumpul: string | null;
  /** Skor integritas 0–100. Bukan nilai ujian, dan tidak pernah mengubahnya. */
  integritas?: number;
  /** Terisi bila ujiannya dihentikan aturan pengawasan. */
  dihentikan?: string | null;
  /** Hitungan tiap jenis insiden, hanya pada rincian satu peserta. */
  pengawasan?: Partial<Record<JenisInsiden, number>>;
  /** Perangkat yang dipakai: "peramban" | "android" | "windows". */
  klien?: string;
};

/** Satu baris garis waktu pengawasan. */
type Jejak = {
  jenis: string; jam: string; detail: string;
  /** Alamat cuplikan kamera berumur pendek. null bila tidak ada buktinya. */
  bukti?: string | null;
};

/**
 * Sesudah berapa lama diam seorang peserta dianggap TERPUTUS.
 *
 * Perambannya menyapa tiap sepuluh detik; enam kali lipat dari itu memberi
 * kelonggaran untuk jaringan kampus yang tersendat tanpa membuat papan pantau
 * lambat menyadari layar yang benar-benar mati.
 */
const AMBANG_TERPUTUS = 60;

type Analisis = {
  id: number; pertanyaan: string; dijawab: number; benar: number;
  persen: number; kategori: string; perluDitinjau: boolean;
};

type Statistik = {
  peserta: number; rata: number; tertinggi: number; terendah: number;
  median: number; lulus: number; tidakLulus: number; persenLulus: number;
};

/**
 * Menu "Buat soal dengan AI" DIPADAMKAN.
 *
 * Bukan dihapus: seluruh jalannya masih utuh, dari pembaca dokumen di peramban
 * sampai /api/cbt/ai-soal, dan menyalakannya kembali cukup dengan menyetel
 * tetapan ini menjadi true. Yang dimatikan hanya pintunya di layar pengajar,
 * beserta satu permintaan ke server yang tadinya berjalan pada tiap pemuatan
 * panel hanya untuk menanyakan apakah kuncinya terpasang.
 */
const AI_SOAL_TAMPIL = false;

const SOAL_KOSONG = {
  jenis: "pg" as JenisSoal,
  pertanyaan: "",
  pilihan: ["", "", "", ""],
  kunci: "0",
  pasangan: [] as Pasangan[],
  media: { ...MEDIA_KOSONG } as Media,
  bobot: 1,
  // Materi dan tingkat kesulitan tidak lagi punya isian di layar: keduanya
  // hampir tidak pernah diisi, sementara dua kotak itu memakan tempat pada
  // baris yang sama dengan jenis dan bobot. Nilainya tetap ikut terkirim
  // supaya kolomnya di basis data tidak berubah bentuk, dan soal yang datang
  // dari impor Excel atau Word tetap membawa tingkatnya sendiri.
  materi: "",
  tingkat: "sedang",
  pembahasan: "",
};

/**
 * Isi awal formulir untuk tiap jenis soal.
 *
 * Berganti jenis berarti berganti bentuk isian. Membiarkan sisa isian jenis
 * sebelumnya membuat pengajar menyimpan soal penjodohan yang kuncinya masih
 * menunjuk pilihan ganda — dan itu baru ketahuan saat peserta mengerjakan.
 */
function bentukJenis(jenis: JenisSoal) {
  if (jenis === "benar_salah") return { pilihan: ["Benar", "Salah"], kunci: "0", pasangan: [] as Pasangan[] };
  if (jenis === "pg") return { pilihan: ["", "", "", ""], kunci: "0", pasangan: [] as Pasangan[] };
  if (jenis === "pg_kompleks") return { pilihan: ["", "", "", ""], kunci: "", pasangan: [] as Pasangan[] };
  if (jenis === "penjodohan") {
    return {
      pilihan: ["", "", ""],
      kunci: "",
      pasangan: [{ kiri: "", kanan: 0 }, { kiri: "", kanan: 1 }] as Pasangan[],
    };
  }
  return { pilihan: [] as string[], kunci: "", pasangan: [] as Pasangan[] };
}

/**
 * SETELAN UJIAN, beserta keterangannya masing-masing.
 *
 * Satu daftar, dipakai dua kali: pada formulir "Buat ujian" dan pada panel
 * "Pengaturan ujian" yang dibuka sesudah ujiannya jadi. Dulu daftarnya hanya
 * ada di formulir pembuatan — artinya satu-satunya kesempatan menyetelnya
 * adalah sebelum ujiannya pernah dipakai sama sekali.
 *
 * Tiap baris membawa KETERANGANNYA sendiri. "Satu perangkat hanya untuk satu
 * peserta" terbaca jelas oleh yang membuatnya, tetapi tidak menjelaskan apa
 * yang terjadi pada peserta yang ponselnya sudah dipakai temannya — dan
 * itulah yang perlu diketahui pengawas pada menit-menit ujian berjalan.
 *
 * `bentuk` menandai setelan yang MENGUBAH BENTUK ujian. Hanya keempat itu yang
 * terkunci selagi ujian berlangsung; aturan yang sama dijaga server pada
 * /api/cbt/ujian.
 */
type KunciSetelan =
  | "randomQuestions" | "randomOptions" | "allowBack" | "showScore"
  | "singleDevice" | "requireLockdown";

const SETELAN: Array<{ kunci: KunciSetelan; label: string; jelas: string; bentuk: boolean }> = [
  {
    kunci: "randomQuestions",
    label: "Acak urutan soal",
    jelas: "Tiap peserta menerima urutan soal yang berbeda.",
    bentuk: true,
  },
  {
    kunci: "randomOptions",
    label: "Acak urutan pilihan jawaban",
    jelas: "Huruf A sampai D tidak sama antarpeserta, jadi menyalin jawaban sebelah tidak berguna.",
    bentuk: true,
  },
  {
    kunci: "allowBack",
    label: "Boleh kembali ke soal sebelumnya",
    jelas: "Bila centangnya dilepas, soal yang sudah dilewati tidak dapat dibuka lagi.",
    bentuk: false,
  },
  {
    kunci: "showScore",
    label: "Tampilkan nilai setelah selesai",
    jelas: "Nilai langsung terlihat peserta begitu jawabannya dikumpulkan.",
    bentuk: false,
  },
  {
    kunci: "singleDevice",
    label: "Satu perangkat untuk satu peserta",
    jelas: "Mencegah satu ponsel dipakai bergantian. Lepas centangnya bila ada peserta yang terlanjur terblokir.",
    bentuk: false,
  },
  {
    kunci: "requireLockdown",
    label: "Wajib lewat aplikasi Exam Browser",
    jelas: "Satu-satunya cara benar-benar menolak tangkapan layar. Beri tahu kelas sehari sebelumnya.",
    bentuk: false,
  },
];

/** Kabar yang menempel pada satu tombol. */
type Kabar = { keadaan: "jalan" | "oke" | "gagal"; teks: string };

/**
 * Tombol yang mengatakan sendiri apa yang sedang terjadi padanya.
 *
 * Sebelumnya seluruh tombol panel ini hanya berubah menjadi abu-abu saat
 * ditekan, dan kabar hasilnya muncul sebagai pita tipis di puncak panel —
 * sering jauh di luar layar. Yang menekan tombol menatap tombolnya, jadi di
 * situlah kabarnya ditulis: "Menghapus…" lalu "✓ Terhapus", di tempat yang
 * sama, dengan warna yang ikut berganti.
 */
function Tbl({
  kabar, diam, dasar = "btn btn-primary", mati = false, judul, onClick,
}: {
  kabar?: Kabar;
  diam: string;
  dasar?: string;
  mati?: boolean;
  judul?: string;
  onClick: () => void;
}) {
  const rasa =
    kabar?.keadaan === "oke" ? " btn-oke" : kabar?.keadaan === "gagal" ? " btn-gagal" : "";
  return (
    <button
      type="button"
      className={`${dasar}${rasa} cbt-tbl`}
      disabled={mati || kabar?.keadaan === "jalan"}
      title={judul}
      onClick={onClick}
    >
      <span aria-live="polite">{kabar ? kabar.teks : diam}</span>
    </button>
  );
}

/**
 * Skor integritas satu peserta, dalam satu lencana.
 *
 * Angkanya BUKAN nilai ujian dan tidak pernah mengubahnya. Ia hanya
 * mengurutkan: lembar pengawasan siapa yang perlu dibaca penguji lebih dulu.
 * Karena itu warnanya berhenti di "perlu ditinjau" dan tidak pernah berkata
 * "curang" — yang memutuskan tetap manusia, dengan garis waktu insidennya di
 * depan mata.
 */
function SkorIntegritas({
  skor, dihentikan,
}: {
  skor?: number;
  dihentikan?: string | null;
}) {
  // Ujian lama, dari sebelum pengawasan ada, tidak punya angka ini. Menampilkan
  // "100" untuk mereka adalah kebohongan kecil yang justru berbahaya: ia
  // menyatakan sudah diperiksa dan bersih, padahal tidak pernah diperiksa.
  if (typeof skor !== "number") return <small className="psn-nama">-</small>;
  const tingkat = tingkatIntegritas(skor);
  return (
    <span className="cbt-integritas">
      <b className={`cbt-int-${tingkat}`}>{skor}</b>
      <small>{TINGKAT_LABEL[tingkat]}</small>
      {dihentikan && <small className="cbt-int-putus">dihentikan pengawas</small>}
    </span>
  );
}

/**
 * Garis waktu pengawasan satu peserta.
 *
 * Inilah yang sebenarnya dibaca ketika sebuah hasil digugat, dan angka
 * ringkasan tidak dapat menggantikannya. Tiga kali pindah tab yang terpencar
 * sepanjang sembilan puluh menit adalah notifikasi yang muncul sendiri; tiga
 * kali dalam empat puluh detik tepat sesudah soal essay dibuka adalah hal yang
 * lain sama sekali. Karena itu yang ditampilkan jam persisnya beserta jarak
 * dari kejadian sebelumnya, bukan sekadar daftar.
 */
function GarisWaktu({ jejak, mulai }: { jejak: Jejak[]; mulai: string }) {
  if (jejak.length === 0) {
    return <p className="cbt-catatan">Tidak ada satu pun catatan pengawasan pada peserta ini.</p>;
  }
  const awal = new Date(mulai).getTime();
  return (
    <ol className="cbt-jejak">
      {jejak.map((j, i) => {
        const saat = new Date(j.jam).getTime();
        const menit = Math.max(0, Math.round((saat - awal) / 60_000));
        const sebelumnya = i > 0 ? new Date(jejak[i - 1].jam).getTime() : null;
        // Kejadian yang menyusul kurang dari sepuluh detik sesudah yang
        // sebelumnya ditandai. Berkerumun seperti itu jarang berarti
        // kebetulan, dan itulah pola yang dicari mata penguji.
        const rapat = sebelumnya !== null && saat - sebelumnya < 10_000;
        return (
          <li key={i} className={rapat ? "rapat" : undefined}>
            <span className="cbt-jejak-jam">menit ke-{menit}</span>
            <span className="cbt-jejak-apa">
              {INSIDEN_LABEL[j.jenis as JenisInsiden] ?? j.jenis}
              {j.detail && <i> · {j.detail}</i>}
            </span>
            {rapat && <span className="cbt-jejak-rapat">beruntun</span>}
            {j.bukti && (
              // Cuplikan kamera pada saat kejadian. Inilah satu-satunya hal
              // yang membuat catatan "terdeteksi orang lain" dapat dipercaya
              // maupun dibantah — angka dan kalimat saja tidak dapat diperiksa
              // siapa pun, dan bacaan model tanpa gambarnya hanya tebakan yang
              // ditulis rapi.
              <a className="cbt-jejak-bukti" href={j.bukti} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={j.bukti} alt={`Cuplikan kamera menit ke-${menit}`} loading="lazy" />
                <span>Lihat</span>
              </a>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Saklar kamera pengawas.
 *
 * Satu-satunya setelan di panel ini yang wewenangnya TIDAK ada pada pengajar
 * pemilik ujiannya, dan karena itu ia berdiri terpisah dari deretan setelan
 * yang lain, bukan menyelinap sebagai satu centang di antaranya.
 *
 * Pengajar tetap MELIHAT keadaannya — ia berhak tahu kelasnya direkam atau tidak,
 * dan menyembunyikan barisnya dari orang yang ujiannya sedang diawasi adalah
 * hal yang justru tidak boleh dilakukan. Yang tidak ada padanya hanya
 * kemampuan menggesernya.
 */
function SaklarKamera({
  nyala, mode, boleh, ubah,
}: {
  nyala: boolean;
  mode: ModePengawasan;
  boleh: boolean;
  ubah: (nyala: boolean) => void;
}) {
  // Pada mode selain Sertifikasi, saklarnya memang tidak berpengaruh apa pun.
  // Menampilkannya sebagai saklar yang dapat digeser tetapi tidak melakukan
  // apa-apa adalah kebohongan kecil yang akan memakan waktu seseorang.
  const berlaku = aturanMode(mode).kamera;

  return (
    <div className={`cbt-kamera${berlaku && nyala ? " on" : ""}`}>
      <div className="cbt-kamera-teks">
        <b>Kamera pengawas</b>
        <small>
          {!berlaku
            ? `Tidak berlaku pada mode ${MODE_LABEL[mode]}. Kamera hanya menyala pada mode ${MODE_LABEL.sertifikasi}.`
            : nyala
              ? "Kamera peserta menyala selama ujian. Hanya cuplikan bermasalah yang disimpan."
              : "Kamera dimatikan. Penjagaan lain pada mode ini tetap berjalan seperti biasa."}
        </small>
      </div>
      {boleh ? (
        <label className="cbt-kamera-tbl">
          <input
            type="checkbox"
            checked={berlaku && nyala}
            disabled={!berlaku}
            onChange={(e) => ubah(e.target.checked)}
          />
          <span>{berlaku && nyala ? "Menyala" : "Mati"}</span>
        </label>
      ) : (
        <span className="cbt-kamera-kunci" title="Wewenang Admin dan Super Admin">
          {berlaku && nyala ? "Menyala" : "Mati"} · dikunci
        </span>
      )}
      {!boleh && (
        <p className="cbt-kamera-catatan">
          Saklar ini dipegang Admin dan Super Admin.
        </p>
      )}
    </div>
  );
}

/**
 * Pemilih mode pengawasan.
 *
 * Satu pilihan, bukan sebelas kotak centang, dan itu keputusan yang disengaja.
 * Pengajar tahu ujiannya kuis harian, UAS, atau uji sertifikasi; ia tidak
 * seharusnya diminta memutuskan sendiri apakah alat pengembang perlu diawasi
 * atau berapa kali pindah tab yang pantas mengakhiri ujian orang. Aturan tiap
 * mode ada di src/lib/pengawasan.ts, satu tempat, dipakai server dan peramban.
 *
 * Yang dijanjikan di keterangannya sengaja tidak dilebihkan. Tangkapan layar
 * TIDAK dapat dilarang peramban mana pun, dan mengatakan sebaliknya di layar
 * ini akan membuat pengajar menyetel ujian sertifikasi dengan rasa aman yang
 * tidak ada dasarnya.
 */
function PilihMode({
  nilai, ubah,
}: {
  nilai: ModePengawasan;
  ubah: (mode: ModePengawasan) => void;
}) {
  return (
    <div className="cbt-mode">
      <div className="cbt-mode-kepala">Pengawasan ujian</div>
      <div className="cbt-mode-pilih">
        {SEMUA_MODE.map((m) => (
          <label key={m} className={`cbt-mode-kartu${nilai === m ? " on" : ""}`}>
            <input
              type="radio"
              name="cbt-proctor-mode"
              checked={nilai === m}
              onChange={() => ubah(m)}
            />
            <b>{MODE_LABEL[m]}</b>
            <small>{MODE_KETERANGAN[m]}</small>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Deretan centang setelan, sejajar dan masing-masing membawa keterangannya. */
function DaftarSetelan({
  nilai, kunciBentuk = false, ubah,
}: {
  nilai: Record<KunciSetelan, boolean>;
  /** Ujian sedang berlangsung: yang mengubah bentuknya dikunci, sisanya tidak. */
  kunciBentuk?: boolean;
  ubah: (kunci: KunciSetelan, nyala: boolean) => void;
}) {
  return (
    <div className="cbt-sakelar">
      {SETELAN.map((s) => {
        const mati = kunciBentuk && s.bentuk;
        return (
          <label key={s.kunci} className={`cbt-cek${mati ? " mati" : ""}`}>
            <input
              type="checkbox"
              checked={nilai[s.kunci]}
              disabled={mati}
              onChange={(e) => ubah(s.kunci, e.target.checked)}
            />
            <span>{s.label}</span>
            <small>{mati ? `${s.jelas} Terkunci sampai ujian selesai.` : s.jelas}</small>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Perangkat mana yang wajib memakai Exam Browser.
 *
 * Muncul HANYA ketika saklarnya menyala. Pilihan yang tampil tetapi tidak
 * berarti apa-apa adalah pilihan yang membuat pengajar mengira ujiannya
 * terkunci padahal tidak.
 */
function PilihPerangkat({
  nilai, nyala, ubah,
}: { nilai: PerangkatKunci; nyala: boolean; ubah: (p: PerangkatKunci) => void }) {
  if (!nyala) return null;
  return (
    <div className="cbt-perangkat">
      <span className="cbt-perangkat-kepala">Exam Browser untuk</span>
      <div className="cbt-perangkat-pilih">
        {SEMUA_PERANGKAT.map((p) => (
          <label key={p} className={`cbt-perangkat-kartu${nilai === p ? " on" : ""}`}>
            <input
              type="radio"
              name={`cbt-lockdown-device-${nyala}`}
              checked={nilai === p}
              onChange={() => ubah(p)}
            />
            {PERANGKAT_LABEL[p]}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Salin setelan satu ujian ke bentuk yang dipakai formulir pengaturan. */
function setelanUjian(u: Ujian) {
  return {
    title: u.title,
    courseName: u.courseName,
    className: u.className ?? "",
    instruction: u.instruction ?? "",
    token: u.token ?? "",
    questionCount: u.questionCount,
    durationMinutes: u.durationMinutes,
    passingGrade: u.passingGrade,
    maxAttempts: u.maxAttempts,
    randomQuestions: u.randomQuestions,
    randomOptions: u.randomOptions,
    allowBack: u.allowBack,
    showScore: u.showScore,
    singleDevice: u.singleDevice,
    requireLockdown: u.requireLockdown === true,
    lockdownDevice: rapikanPerangkatKunci(u.lockdownDevice),
    proctorMode: rapikanMode(u.proctorMode),
    cameraOn: u.cameraOn !== false,
  };
}

/**
 * Isian jadwal, terpecah tiga: tanggal, jam, dan menit.
 *
 * Dahulu di sini ada satu <input type="datetime-local">, dan dari situlah
 * "AM/PM" datang: kotak isian itu digambar peramban menurut bahasa sistem
 * operasinya, dan laptop yang bahasanya English (United States) menggambarnya
 * dalam jam dua belas. Tidak ada atribut yang dapat memaksanya menjadi jam 24 —
 * satu-satunya jalan adalah menggambar pemilih jamnya sendiri. Lihat
 * src/lib/waktu-indonesia.ts.
 */
type IsianJam = { tanggal: string; jam: string; menit: string };

const JAM_KOSONG: IsianJam = { tanggal: "", jam: "", menit: "" };

/** Ubah tanggal ISO dari server menjadi isian jadwal dalam jam Indonesia. */
function untukIsian(iso: string | null): IsianJam {
  const pecah = pecahWaktuUjian(iso);
  if (!pecah.tanggal) return { ...JAM_KOSONG };
  return {
    tanggal: pecah.tanggal,
    jam: String(pecah.jam).padStart(2, "0"),
    menit: String(pecah.menit).padStart(2, "0"),
  };
}

/** Isian jadwal menjadi satu saat, atau null bila belum lengkap. */
function dariIsian(isian: IsianJam): Date | null {
  if (!isian.tanggal || isian.jam === "" || isian.menit === "") return null;
  return susunWaktuUjian(isian.tanggal, Number(isian.jam), Number(isian.menit));
}

function jamRapi(iso: string | null) {
  return jamIndonesia(iso);
}

/**
 * Mengapa jadwal ini belum boleh diaktifkan — satu kalimat, atau null bila
 * tidak ada halangan sama sekali.
 *
 * Syaratnya sama persis dengan yang dijaga server di
 * src/app/api/cbt/aktivasi/route.ts, dan itu memang disengaja: yang di sini
 * MEMATIKAN tombolnya lebih dulu, yang di sana menolak permintaannya. Dahulu
 * hanya ada yang kedua, dan akibatnya pengajar menekan tombol biru yang
 * tampak siap lalu membaca penolakan merah — pada jam ketika peserta sudah
 * duduk di ruangan. Tombol yang abu-abu beserta alasannya menjawab lebih awal:
 * yang salah terlihat sebelum ada yang ditekan.
 *
 * Yang di server tidak boleh ikut dilepas. Halaman dapat diubah dari alat
 * pengembang; jadwal ujian tidak boleh bergantung pada tombol yang patuh.
 */
function halanganJadwal(opsi: {
  mulai: Date | null;
  selesai: Date | null;
  durasi: number;
  jumlahBank: number;
  soalDipakai: number;
}): string | null {
  const { mulai, selesai, durasi, jumlahBank, soalDipakai } = opsi;
  if (!mulai || !selesai) return "Tanggal, jam, dan menit — mulai maupun selesai — harus terisi lengkap.";
  if (selesai.getTime() <= mulai.getTime()) return "Jam selesai harus sesudah jam mulai.";

  const menitJendela = Math.round((selesai.getTime() - mulai.getTime()) / 60_000);
  if (menitJendela < durasi) {
    return (
      `Jendela ujian hanya ${menitJendela} menit, sedangkan durasinya ${durasi} menit. ` +
      "Peserta akan terpotong waktunya."
    );
  }
  if (jumlahBank === 0) return "Bank soal masih kosong. Isi soalnya dulu.";
  if (soalDipakai > jumlahBank) {
    return (
      `Ujian menuntut ${soalDipakai} soal, sedangkan banknya baru ${jumlahBank}. ` +
      "Tambah soal, atau turunkan jumlah soal ujiannya."
    );
  }
  return null;
}

/**
 * Pemilih tanggal dan jam 24 jam — pengganti <input type="datetime-local">.
 *
 * Tanggalnya tetap kotak isian tanggal bawaan peramban: ia menggambar kalender,
 * dan kalender tidak pernah menuliskan AM maupun PM. Yang diganti hanya JAMNYA,
 * karena di situlah AM/PM muncul dan tidak ada atribut mana pun yang dapat
 * memaksanya pergi — peramban menggambar jam menurut bahasa sistem operasinya,
 * bukan menurut bahasa halamannya.
 *
 * Dua pemilih, bukan satu kotak "07:30": pemilih tidak dapat salah ketik, dan
 * menitnya tidak dapat berisi "7" yang sebenarnya berarti tujuh menit padahal
 * yang dimaksud tujuh puluh.
 */
function PilihJam({
  label, nilai, ubah,
}: {
  label: string;
  nilai: IsianJam;
  ubah: (isian: IsianJam) => void;
}) {
  // Dibacakan kembali dengan kata, bukan dengan angka.
  //
  // Kotak tanggal bawaan peramban menuliskan urutannya menurut bahasa sistem
  // operasinya juga — "05/12/2026" berarti 5 Desember pada satu laptop dan 12
  // Mei pada laptop sebelahnya, dan tidak ada atribut yang dapat memaksanya
  // sama. Yang dapat dilakukan halaman adalah MENGULANG jawabannya dengan
  // nama bulan yang dieja, sehingga tanggal yang keliru terbaca sebelum
  // ujiannya dijadwalkan, bukan sesudah pesertanya menunggu di hari yang salah.
  const terbaca = dariIsian(nilai);
  return (
    <div className="cbt-jam">
      <span className="cbt-jam-label">{label}</span>
      <div className="cbt-jam-baris">
        <input
          type="date"
          aria-label={`Tanggal ${label.toLowerCase()}`}
          value={nilai.tanggal}
          onChange={(e) => ubah({ ...nilai, tanggal: e.target.value })}
        />
        <select
          aria-label={`Jam ${label.toLowerCase()}`}
          value={nilai.jam}
          onChange={(e) => ubah({ ...nilai, jam: e.target.value })}
        >
          <option value="">--</option>
          {PILIHAN_JAM.map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
        <b className="cbt-jam-titik">.</b>
        <select
          aria-label={`Menit ${label.toLowerCase()}`}
          value={nilai.menit}
          onChange={(e) => ubah({ ...nilai, menit: e.target.value })}
        >
          <option value="">--</option>
          {PILIHAN_MENIT.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="cbt-jam-zona">{HURUF_ZONA}</span>
      </div>
      <small className="cbt-jam-baca">
        {terbaca
          ? jamIndonesia(terbaca, { hari: true, tahun: true, panjang: true })
          : "Tanggal, jam, dan menit belum lengkap."}
      </small>
    </div>
  );
}

export default function CbtPanel({ role }: { role: string }) {
  // Peran hanya menentukan SEBUTAN di layar dan siapa yang melihat seluruh
  // daftar. Izin sesungguhnya datang per ujian dari server — lihat pemilik()
  // di src/app/api/cbt/ujian/route.ts.
  const pemantau = role === "super_admin" || role === "admin";

  const [ujian, setUjian] = useState<Ujian[]>([]);
  const [muat, setMuat] = useState(true);
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState<number | null>(null);
  const [tab, setTab] = useState<"soal" | "pantau">("soal");
  const [buatBaru, setBuatBaru] = useState(false);

  const [draf, setDraf] = useState({
    title: "", courseName: "", className: "",
    questionCount: 20, durationMinutes: 60, passingGrade: 60, maxAttempts: 1,
    token: "", instruction: "",
    randomQuestions: true, randomOptions: true, allowBack: true, showScore: true,
    singleDevice: true, requireLockdown: false,
    lockdownDevice: "semua" as PerangkatKunci,
    proctorMode: "biasa" as ModePengawasan,
  });

  const [soal, setSoal] = useState<Soal[]>([]);
  const [soalBaru, setSoalBaru] = useState({ ...SOAL_KOSONG });
  const [sunting, setSunting] = useState<number | null>(null);

  const [peserta, setPeserta] = useState<Peserta[]>([]);
  const [statistik, setStatistik] = useState<Statistik | null>(null);
  const [analisis, setAnalisis] = useState<Analisis[]>([]);

  // Koreksi essay: satu peserta yang sedang dibuka, beserta rincian jawabannya.
  const [bukaPeserta, setBukaPeserta] = useState<Peserta | null>(null);
  const [rincian, setRincian] = useState<Rincian[]>([]);
  const [jejak, setJejak] = useState<Jejak[]>([]);
  const [draftKoreksi, setDraftKoreksi] = useState<Record<number, { poin: string; catatan: string }>>({});
  const [muatRincian, setMuatRincian] = useState(false);

  // Berita acara: dua keterangan yang hanya diketahui pengawasnya sendiri.
  const [acara, setAcara] = useState({ pengawas: "", ruang: "", catatan: "" });

  // Impor massal: hasil bacaan berkas ditahan dulu untuk dilihat pengajar
  // sebelum benar-benar masuk. Empat puluh soal yang langsung tersimpan tanpa
  // sempat dilihat berarti empat puluh soal yang harus diperiksa satu per satu
  // sesudahnya.
  const [imporSoal, setImporSoal] = useState<SoalImpor[]>([]);
  const [imporTolak, setImporTolak] = useState<Array<{ baris: string; alasan: string }>>([]);
  const [imporNama, setImporNama] = useState("");
  const [tersalin, setTersalin] = useState("");

  const [jadwal, setJadwal] = useState({
    mulai: { ...JAM_KOSONG } as IsianJam,
    selesai: { ...JAM_KOSONG } as IsianJam,
  });

  // Pengaturan ujian yang sedang dibuka. Terlipat sampai diminta, tetapi
  // isinya selalu disiapkan begitu ujiannya dibuka: yang membukanya karena
  // keadaan mendesak tidak boleh menunggu satu perjalanan ke server lagi.
  const [setel, setSetel] = useState({
    title: "", courseName: "", className: "", instruction: "", token: "",
    questionCount: 0, durationMinutes: 60, passingGrade: 60, maxAttempts: 1,
    randomQuestions: true, randomOptions: true, allowBack: true, showScore: true,
    singleDevice: true, requireLockdown: false,
    lockdownDevice: "semua" as PerangkatKunci,
    proctorMode: "biasa" as ModePengawasan, cameraOn: true,
  });
  const [bukaSetel, setBukaSetel] = useState(false);

  /**
   * Dua bagian panjang yang dilipat sampai diminta.
   *
   * Keduanya jarang dipakai tetapi memakan tinggi layar yang sama besarnya
   * dengan bagian yang dipakai setiap hari. Cetak naskah hanya keluar sekali
   * menjelang ujian, dan sebagian besar soal tidak bergambar sama sekali.
   */
  const [lipatCetak, setLipatCetak] = useState(false);

  /**
   * Kode QR ujian sebagai PNG data URL, BESERTA kode ujian yang digambarnya.
   *
   * Kodenya ikut disimpan, dan itu bukan kelengkapan yang berlebihan: tanpa ia,
   * kotak QR sempat memperlihatkan kode ujian SEBELUMNYA selama satu perjalanan
   * penggambaran. Pengajar yang membuka dua ujian beruntun lalu mencetak
   * posternya akan menempel kode kelas yang salah di dinding — dan tidak ada
   * yang menyadarinya sampai peserta mulai masuk ke ujian yang keliru.
   *
   * Kosong berarti belum digambar ATAU gagal digambar, dan kedua keadaan itu
   * sengaja tidak dibedakan di layar. Panel bagikan tetap utuh tanpa QR —
   * tautan dan kodenya ada di sana — jadi menampilkan "gagal memuat penggambar
   * QR" hanya menakuti pengajar yang membuka panel ini lima menit sebelum
   * ujian, tentang sesuatu yang tidak menghalanginya sama sekali.
   */
  const [qrGambar, setQrGambar] = useState({ kode: "", png: "" });
  const [bukaMedia, setBukaMedia] = useState(false);
  /**
   * Apakah pratinjau medianya berhasil dimuat.
   *
   * Disimpan bersama TAUTANNYA, bukan sebagai ya/tidak belaka: satu tautan
   * yang gagal tidak boleh membuat tautan berikutnya ikut dinyatakan gagal.
   * Kekeliruan itulah yang membuat gambar soal berhenti tampil di layar
   * peserta, dan ia berulang dengan mudah bila ditulis sebagai boolean.
   */
  const [mediaDiperiksa, setMediaDiperiksa] = useState({ url: "", hasil: "" });
  const mediaTermuat = mediaDiperiksa.url === soalBaru.media.url ? mediaDiperiksa.hasil : "";
  const setMediaTermuat = (hasil: string) =>
    setMediaDiperiksa({ url: soalBaru.media.url, hasil });

  /**
   * KABAR PADA TOMBOLNYA SENDIRI, satu per tombol.
   *
   * Dulu panel ini hanya punya dua tempat berkabar: pita hijau dan pita merah
   * di puncak halaman. Panelnya panjang — tombol "Hapus soal" yang ditekan di
   * dasar bank soal membuat pita itu muncul jauh di luar layar, jadi yang
   * terlihat hanyalah tombol yang berubah abu-abu sebentar. Orang lalu
   * menekannya dua kali karena mengira tekanan pertamanya tidak masuk.
   *
   * Sekarang tiap tombol membawa kabarnya sendiri, dikunci pada namanya:
   * "Menghapus…" saat berjalan, "✓ Terhapus" saat berhasil, "✕ Gagal" saat
   * tidak. Pita di puncak panel tetap ada untuk keterangan panjangnya.
   *
   * `tolakSoal` berisi daftar yang kurang atau salah, dan ia muncul sebagai
   * jendela yang harus ditutup. Sengaja menghalangi: soal yang ditolak
   * diam-diam adalah soal yang dikira sudah masuk sampai pagi hari ujian.
   */
  const [aksi, setAksi] = useState<Record<string, Kabar>>({});
  const [tolakSoal, setTolakSoal] = useState<{ judul: string; rincian: string[] } | null>(null);
  const jamAksi = useRef<Record<string, number>>({});
  useEffect(() => {
    const jam = jamAksi.current;
    return () => { Object.values(jam).forEach((t) => window.clearTimeout(t)); };
  }, []);

  /**
   * Pasang kabar pada satu tombol, dan padamkan sendiri sesudah `redup` milidetik.
   *
   * Penghitung waktunya disimpan per tombol supaya dua tombol yang ditekan
   * beruntun tidak saling memadamkan kabar masing-masing.
   */
  function kabari(kunci: string, keadaan: Kabar["keadaan"], teks: string, redup = 0) {
    setAksi((kini) => ({ ...kini, [kunci]: { keadaan, teks } }));
    if (jamAksi.current[kunci]) window.clearTimeout(jamAksi.current[kunci]);
    delete jamAksi.current[kunci];
    if (redup > 0) {
      jamAksi.current[kunci] = window.setTimeout(() => {
        delete jamAksi.current[kunci];
        setAksi((kini) => {
          const salin = { ...kini };
          delete salin[kunci];
          return salin;
        });
      }, redup);
    }
  }

  /** Sedang berjalan? Dipakai tombol yang bukan <Tbl>, mis. label unggah berkas. */
  const berjalan = (kunci: string) => aksi[kunci]?.keadaan === "jalan";

  // Escape menutup jendela penolakan. Jendela yang menghalangi tetapi hanya
  // dapat ditutup dengan tetikus adalah jebakan bagi yang mengetik cepat.
  useEffect(() => {
    if (!tolakSoal) return;
    const tekan = (e: KeyboardEvent) => { if (e.key === "Escape") setTolakSoal(null); };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [tolakSoal]);

  // ---------- BUAT SOAL DENGAN AI ----------
  const [aiSiap, setAiSiap] = useState<boolean | null>(null);
  const [aiPenyedia, setAiPenyedia] = useState<string[]>([]);
  const [sari, setSari] = useState<HasilSari | null>(null);
  const [sariNama, setSariNama] = useState("");
  const [aiSibuk, setAiSibuk] = useState(false);
  const [aiKabar, setAiKabar] = useState("");
  const [aiAtur, setAiAtur] = useState({
    jumlah: 10,
    jenis: ["pg"] as JenisSoal[],
    tingkat: "campuran" as "campuran" | "mudah" | "sedang" | "sulit",
    arahan: "",
  });

  // Daftarnya ikut DIKEMBALIKAN, bukan hanya disimpan ke state: yang baru
  // menyimpan pengaturan perlu membaca nilai yang benar-benar tersimpan
  // (server membulatkan dan memotongnya) tanpa menunggu gambar berikutnya.
  const muatUjian = useCallback(async () => {
    try {
      const jawab = await fetch("/api/cbt/ujian", { cache: "no-store" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Daftar ujian tidak terbaca.");
      const daftar = (data.ujian || []) as Ujian[];
      setUjian(daftar);
      setGalat("");
      return daftar;
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Daftar ujian tidak terbaca.");
      return null;
    } finally {
      setMuat(false);
    }
  }, []);

  useEffect(() => {
    const tunda = window.setTimeout(() => void muatUjian(), 0);
    return () => window.clearTimeout(tunda);
  }, [muatUjian]);

  // Ditanyakan sekali di awal: menu AI yang tampil lengkap lalu menjawab
  // "belum ada kunci" sesudah pengajar mengunggah dokumen dan menunggu satu menit
  // adalah cara paling buruk menyampaikan kabar itu.
  useEffect(() => {
    if (!AI_SOAL_TAMPIL) return;
    const tunda = window.setTimeout(() => {
      fetch("/api/cbt/ai-soal", { cache: "no-store" })
        .then((jawab) => jawab.json())
        .then((data) => {
          if (!data.success) return;
          setAiSiap(Boolean(data.siap));
          setAiPenyedia(data.tersedia || []);
        })
        .catch(() => setAiSiap(false));
    }, 0);
    return () => window.clearTimeout(tunda);
  }, []);

  // Monitoring ujian yang sedang berlangsung menyegar sendiri tiap sepuluh
  // detik: pengajar yang harus menekan tombol muat ulang tiap menit tidak sedang
  // memantau apa pun.
  useEffect(() => {
    if (buka === null || tab !== "pantau") return;
    const jam = setInterval(() => void muatHasil(buka), 10_000);
    return () => clearInterval(jam);
  }, [buka, tab]);

  const terbuka = ujian.find((u) => u.id === buka) || null;

  // ---------- KODE QR UJIAN ----------
  //
  // Digambar sekali tiap kali ujian yang dibuka berganti. `hidup` menutup
  // perlombaan yang datang dari sifat asinkronnya: ujian yang ditutup sebelum
  // gambarnya selesai tidak boleh menuliskan hasilnya ke panel yang sudah
  // pindah ke ujian lain.
  const kodeTerbuka = terbuka?.code ?? "";
  useEffect(() => {
    if (!kodeTerbuka) return;
    let hidup = true;
    void gambarQr(alamatUjian(kodeTerbuka)).then((png) => {
      if (hidup) setQrGambar({ kode: kodeTerbuka, png });
    });
    return () => { hidup = false; };
  }, [kodeTerbuka]);

  // Gambar yang dipakai HANYA bila ia memang gambar ujian yang sedang dibuka.
  // Penyaringan di sini, bukan pengosongan lewat effect: yang terakhir menyisakan
  // satu gambar tempat QR ujian sebelumnya masih terpampang.
  const qrUjian = kodeTerbuka && qrGambar.kode === kodeTerbuka ? qrGambar.png : "";

  async function muatSoal(id: number) {
    try {
      const jawab = await fetch(`/api/cbt/soal?ujian=${id}`, { cache: "no-store" });
      const data = await jawab.json();
      if (data.success) setSoal(data.soal || []);
    } catch {
      // Daftar soal kosong lebih baik daripada galat merah yang menutup panel.
    }
  }

  async function muatHasil(id: number) {
    try {
      const jawab = await fetch(`/api/cbt/hasil?ujian=${id}`, { cache: "no-store" });
      const data = await jawab.json();
      if (data.success) {
        setPeserta(data.peserta || []);
        setStatistik(data.statistik || null);
        setAnalisis(data.analisis || []);
      }
    } catch {
      // Diabaikan; angka lama tetap tampil sampai pemuatan berikutnya.
    }
  }

  function bukaUjian(u: Ujian) {
    setBuka(u.id);
    setTab("soal");
    setSunting(null);
    setBukaPeserta(null);
    setRincian([]);
    setSoalBaru({ ...SOAL_KOSONG });
    setJadwal({ mulai: untukIsian(u.startAt), selesai: untukIsian(u.endAt) });
    setSetel(setelanUjian(u));
    setBukaSetel(false);
    setAksi({});
    void muatSoal(u.id);
    void muatHasil(u.id);
  }

  /**
   * Satu perjalanan ke server, dengan kabarnya menempel pada tombol pemanggil.
   *
   * `kunci` adalah nama tombolnya; `label.jalan` yang tertulis selama menunggu
   * dan `label.oke` sesudah berhasil — keduanya menyebut apa yang terjadi,
   * bukan sekadar warna yang berganti. `label.pesan` yang panjang, untuk pita
   * hijau di puncak panel: satu tombol tidak muat memuat kalimat penuh.
   */
  async function kirim(
    kunci: string,
    alamat: string,
    cara: string,
    isi: unknown,
    label: { jalan: string; oke: string; pesan?: string },
  ) {
    kabari(kunci, "jalan", label.jalan);
    setPesan("");
    setGalat("");
    try {
      const jawab = await fetch(alamat, {
        method: cara,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isi),
      });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Belum tersimpan.");
      kabari(kunci, "oke", `✓ ${label.oke}`, 3400);
      setPesan(label.pesan ?? label.oke);
      return data as Record<string, unknown>;
    } catch (alasan: unknown) {
      const sebab = alasan instanceof Error ? alasan.message : "Belum tersimpan.";
      // Sebab lengkapnya tetap di pita merah — tombolnya terlalu sempit untuk
      // satu kalimat — tetapi tombolnya sendiri yang mengatakan ada yang gagal.
      kabari(kunci, "gagal", "✕ Gagal, lihat keterangannya", 6000);
      setGalat(sebab);
      return null;
    }
  }

  async function buatUjian() {
    if (!draf.title.trim() || !draf.courseName.trim()) {
      setGalat("Nama ujian dan mata uji wajib diisi.");
      kabari("buat", "gagal", "✕ Nama ujian dan mata uji wajib diisi", 5000);
      return;
    }
    const hasil = await kirim("buat", "/api/cbt/ujian", "POST", draf, {
      jalan: "Membuat ujian…",
      oke: "Ujian dibuat",
      pesan: "Ujian dibuat. Sekarang isi soalnya.",
    });
    if (!hasil) return;
    setBuatBaru(false);
    setDraf({ ...draf, title: "", className: "", instruction: "", token: "" });
    await muatUjian();
  }

  /**
   * Simpan pengaturan ujian yang sedang dibuka.
   *
   * Inilah yang selama ini tidak ada: setelan hanya dapat ditentukan pada saat
   * ujian dibuat, dan sesudah itu tidak ada satu pun layar yang memanggil
   * PATCH /api/cbt/ujian. Pengawas yang perlu melepas centang "satu perangkat"
   * di tengah ujian — karena satu peserta terlanjur terblokir oleh ponsel
   * temannya — tidak punya jalan sama sekali.
   */
  async function simpanSetelan() {
    if (!terbuka) return;
    if (!setel.title.trim() || !setel.courseName.trim()) {
      setGalat("Nama ujian dan mata uji wajib diisi.");
      kabari("setel", "gagal", "✕ Nama ujian dan mata uji wajib diisi", 5000);
      return;
    }
    if (setelanBerubah.length === 0) {
      kabari("setel", "oke", "✓ Tidak ada yang perlu disimpan", 2600);
      return;
    }
    const hasil = await kirim("setel", "/api/cbt/ujian", "PATCH", { id: terbuka.id, ...setel }, {
      jalan: "Menyimpan pengaturan…",
      oke: "Pengaturan tersimpan",
      pesan: "Pengaturan ujian tersimpan.",
    });
    if (!hasil) return;
    // Diambil ulang dari server, bukan dianggap sama dengan yang dikirim:
    // angka di luar batas dibulatkan di sana, dan formulirnya harus
    // memperlihatkan yang benar-benar berlaku.
    const daftar = await muatUjian();
    const baru = daftar?.find((u) => u.id === terbuka.id);
    if (baru) setSetel(setelanUjian(baru));
  }

  /**
   * Periksa soal di peramban, sebelum apa pun dikirim.
   *
   * Aturannya sengaja SAMA dengan rapikanSoal di server. Yang di server tetap
   * berlaku dan tetap menjadi penentu; yang di sini hanya menjaga agar soal
   * yang sudah pasti ditolak tidak sempat muncul di daftar sebagai soal yang
   * seolah-olah tersimpan.
   *
   * Yang dikembalikan DAFTAR, bukan satu kalimat. Dulu pemeriksaan berhenti
   * pada keluhan pertama, jadi pengajar yang lupa mengisi pilihan sekaligus lupa
   * menandai kuncinya memperbaikinya satu per satu, menekan tombol, dan
   * menemukan keluhan berikutnya. Sekarang semuanya disebut sekali jalan.
   */
  function periksaSoal(isi: typeof SOAL_KOSONG): string[] {
    const keluhan: string[] = [];
    if (isi.pertanyaan.trim().length < 3) keluhan.push("Pertanyaan belum diisi.");
    const terisi = isi.pilihan.filter((p) => p.trim().length > 0);
    const adaKosong = isi.pilihan.length > terisi.length;

    if (isi.jenis === "pg" || isi.jenis === "benar_salah") {
      if (terisi.length < 2) keluhan.push("Pilihan jawaban minimal dua, dan keduanya harus ada isinya.");
      else if (adaKosong) keluhan.push("Ada kotak pilihan yang masih kosong. Isi atau buang kotaknya.");
      const nomor = Number(isi.kunci);
      if (!Number.isInteger(nomor) || nomor < 0 || nomor >= terisi.length) {
        keluhan.push("Kunci jawaban belum ditandai. Tekan lingkaran huruf di sebelah kiri pilihan yang benar.");
      }
    }
    if (isi.jenis === "pg_kompleks") {
      if (terisi.length < 2) keluhan.push("Pilihan jawaban minimal dua, dan keduanya harus ada isinya.");
      else if (adaKosong) keluhan.push("Ada kotak pilihan yang masih kosong. Isi atau buang kotaknya.");
      const kunci = uraiKunciJamak(isi.kunci);
      if (kunci.size === 0) keluhan.push("Belum ada jawaban yang ditandai benar. Tandai semua yang benar.");
      else if (kunci.size >= terisi.length) {
        keluhan.push("Seluruh pilihan ditandai benar. Sisakan minimal satu pengecoh, kalau tidak soalnya tidak mengukur apa pun.");
      }
    }
    if (isi.jenis === "penjodohan") {
      if (terisi.length < 2) keluhan.push("Kolom jawaban penjodohan minimal dua, dan keduanya harus ada isinya.");
      const lengkap = isi.pasangan.filter(
        (p) => p.kiri.trim().length > 0 && Number.isInteger(p.kanan) && p.kanan >= 0 && p.kanan < terisi.length,
      );
      if (lengkap.length < 2) keluhan.push("Penjodohan perlu minimal dua pasangan yang lengkap: kolom kiri terisi dan jawabannya dipilih.");
    }
    if (isi.jenis === "isian" && !isi.kunci.trim()) {
      keluhan.push("Kunci jawaban isian singkat belum diisi.");
    }
    if (isi.media.jenis && !isi.media.url.trim()) {
      keluhan.push("Media sudah dipilih jenisnya, tetapi tautannya masih kosong. Tempel tautannya, unggah berkasnya, atau kembalikan ke Tanpa media.");
    }
    if (!Number.isInteger(isi.bobot) || isi.bobot < 1 || isi.bobot > 100) {
      keluhan.push("Bobot nilai harus berupa angka 1 sampai 100.");
    }
    return keluhan;
  }

  /** Centang atau lepas satu pilihan sebagai kunci pada PG kompleks. */
  function tandaiKunciJamak(nomor: number) {
    const kini = uraiKunciJamak(soalBaru.kunci);
    if (kini.has(nomor)) kini.delete(nomor);
    else kini.add(nomor);
    setSoalBaru({ ...soalBaru, kunci: [...kini].sort((a, b) => a - b).join(",") });
  }

  /** Unggah satu berkas media untuk soal yang sedang disusun. */
  async function unggahMedia(berkas: File) {
    if (!terbuka) return;
    kabari("media", "jalan", "Mengunggah…");
    setGalat("");
    try {
      const badan = new FormData();
      badan.append("ujian", String(terbuka.id));
      badan.append("berkas", berkas);
      const jawab = await fetch("/api/cbt/media", { method: "POST", body: badan });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Media belum dapat diunggah.");
      setSoalBaru((kini) => ({
        ...kini,
        media: { jenis: data.jenis, url: data.url, keterangan: kini.media.keterangan },
      }));
      setPesan("Media terunggah.");
      kabari("media", "oke", "✓ Media terunggah", 3400);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Media belum dapat diunggah.");
      kabari("media", "gagal", "✕ Gagal mengunggah", 6000);
    }
  }

  /**
   * Simpan satu soal.
   *
   * MENAMBAH soal berjalan optimistis: soalnya muncul di daftar seketika,
   * formulirnya langsung kosong, dan pengirimannya berjalan di belakang.
   * Sebelumnya tombol ini menunggu tiga perjalanan ke server berturut-turut —
   * simpan, muat ulang bank soal, muat ulang daftar ujian — dan pengajar yang
   * mengetik dua puluh soal menunggu dua puluh kali.
   *
   * Bila kiriman itu ternyata gagal, soalnya ditarik kembali dari daftar DAN
   * isinya dikembalikan ke formulir. Kegagalan diam-diam yang menelan soal
   * yang sudah diketik jauh lebih buruk daripada menunggu.
   */
  async function simpanSoal() {
    if (!terbuka) return;
    const target = sunting;
    const isi = { ...soalBaru, pilihan: [...soalBaru.pilihan] };

    const keluhan = periksaSoal(isi);
    if (keluhan.length > 0) {
      // Menyebut media yang salah sambil membiarkan bagiannya terlipat berarti
      // menyuruh pengajar mencari sendiri isian yang tidak kelihatan.
      if (keluhan.some((k) => k.startsWith("Media"))) setBukaMedia(true);
      setTolakSoal({
        judul: target ? "Perubahan belum dapat disimpan" : "Soal belum dapat ditambahkan",
        rincian: keluhan,
      });
      return;
    }

    if (target) {
      const hasil = await kirim("soal", "/api/cbt/soal", "PATCH", { id: target, ...isi }, {
        jalan: "Menyimpan perubahan…",
        oke: "Perubahan disimpan",
        pesan: "Perubahan soal tersimpan.",
      });
      if (!hasil) return;
      setSoalBaru({ ...SOAL_KOSONG });
      setSunting(null);
      await muatSoal(terbuka.id);
      return;
    }

    // Id sementara bernilai negatif, supaya tidak mungkin bertabrakan dengan
    // id sungguhan dari basis data dan tombol Ubah/Hapus dapat menolaknya.
    const idSementara = -Date.now();
    setSoal((kini) => [...kini, { id: idSementara, ...isi }]);
    setSoalBaru({ ...SOAL_KOSONG });
    setGalat("");
    setPesan("Soal ditambahkan.");
    kabari("soal", "oke", "✓ Berhasil ditambahkan", 2600);

    try {
      const jawab = await fetch("/api/cbt/soal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ujian: terbuka.id, soal: [isi] }),
      });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Soal belum tersimpan.");
      const asli = (data.soal as Soal[] | undefined)?.[0];
      setSoal((kini) =>
        asli ? kini.map((x) => (x.id === idSementara ? asli : x)) : kini.filter((x) => x.id !== idSementara),
      );
      if (!asli) await muatSoal(terbuka.id);
    } catch (alasan: unknown) {
      // Gagal sesudah tombolnya sempat berkata berhasil. Tanda hijau itu
      // ditarik kembali, soalnya dikeluarkan lagi dari daftar, isinya
      // dikembalikan ke formulir, dan alasannya dikatakan di jendela yang
      // harus ditutup: kegagalan yang lewat begitu saja meninggalkan pengajar
      // dengan bank soal yang ia kira sudah lengkap.
      kabari("soal", "gagal", "✕ Gagal disimpan", 6000);
      setSoal((kini) => kini.filter((x) => x.id !== idSementara));
      setSoalBaru(isi);
      setPesan("");
      setTolakSoal({
        judul: "Soal gagal disimpan ke server",
        rincian: [
          alasan instanceof Error ? alasan.message : "Soal belum tersimpan.",
          "Isian soalnya sudah dikembalikan ke formulir, jadi tidak ada yang perlu diketik ulang. Periksa sambungan internet, lalu tekan tombolnya lagi.",
        ],
      });
    }
  }

  async function hapusSoal(id: number) {
    if (!terbuka || !window.confirm("Hapus soal ini?")) return;
    const kunci = `soal-${id}`;
    // Soal yang masih dalam perjalanan ke server belum punya id sungguhan.
    if (id < 0) {
      setGalat("Soal ini masih dalam proses penyimpanan. Tunggu sebentar.");
      kabari(kunci, "gagal", "Masih disimpan", 4000);
      return;
    }
    kabari(kunci, "jalan", "Menghapus…");
    try {
      const jawab = await fetch(`/api/cbt/soal?id=${id}`, { method: "DELETE" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Soal belum dapat dihapus.");
      setPesan("Soal dihapus.");
      // Kabar "✓ Terhapus" tidak sempat terbaca — barisnya ikut hilang bersama
      // pemuatan ulang — jadi yang dipakai pita hijau di puncak panel.
      kabari(kunci, "oke", "✓ Terhapus", 2000);
      await muatSoal(terbuka.id);
      await muatUjian();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Soal belum dapat dihapus.");
      kabari(kunci, "gagal", "✕ Gagal", 6000);
    }
  }

  async function aktifkan() {
    if (!terbuka) return;
    const mulai = dariIsian(jadwal.mulai);
    const selesai = dariIsian(jadwal.selesai);
    // Tombolnya memang sudah abu-abu ketika ada halangan, jadi baris ini hampir
    // tidak pernah terpakai. "Hampir" tidak cukup: papan ketik dapat menekan
    // tombol yang tersembunyi di balik keadaan yang basi sepersekian detik.
    const halangan = halanganJadwal({
      mulai, selesai,
      durasi: terbuka.durationMinutes,
      jumlahBank: soal.length,
      soalDipakai: terbuka.questionCount,
    });
    if (halangan || !mulai || !selesai) {
      setGalat(halangan ?? "Jadwal belum lengkap.");
      kabari("aktif", "gagal", "✕ Jadwal belum memenuhi syarat", 5000);
      return;
    }
    const perbarui = Boolean(terbuka.activatedAt);
    const hasil = await kirim(
      "aktif",
      "/api/cbt/aktivasi",
      "POST",
      {
        id: terbuka.id,
        aksi: "aktifkan",
        mulai: mulai.toISOString(),
        selesai: selesai.toISOString(),
      },
      perbarui
        ? { jalan: "Memperbarui jadwal…", oke: "Jadwal diperbarui" }
        : {
            jalan: "Mengaktifkan ujian…",
            oke: "Ujian diaktifkan",
            pesan: "Ujian diaktifkan. Ia akan terbuka sendiri pada jam mulainya.",
          },
    );
    if (!hasil) return;

    // Menyimpan jadwal dapat berarti dua hal yang sangat berbeda bagi
    // peserta, dan pengajarnya berhak tahu yang mana. Ujian yang sudah tutup
    // lalu dijadwalkan ulang adalah PELAKSANAAN BARU — jatah percobaan
    // kembali, jadi yang sudah pernah mengerjakan boleh masuk lagi. Menambah
    // waktu di tengah ujian bukan; yang sudah mengumpulkan tetap tidak dapat
    // mengulang. Tanpa kalimat ini pengajarnya hanya membaca "Jadwal diperbarui"
    // dan menebak sendiri.
    if (perbarui) {
      setPesan(
        hasil.pelaksanaanBaru
          ? "Jadwal diperbarui, dan ini dihitung sebagai pelaksanaan baru: " +
            "peserta yang sudah pernah mengerjakan boleh masuk lagi."
          : "Jam ujian diperbarui. Ujian yang sedang berjalan diteruskan. " +
            "peserta yang sudah mengumpulkan tidak dapat mengerjakan ulang.",
      );
    }
    await muatUjian();
  }

  async function batalkanAktivasi() {
    if (!terbuka || !window.confirm("Batalkan aktivasi ujian ini?")) return;
    const hasil = await kirim(
      "batal-aktif",
      "/api/cbt/aktivasi",
      "POST",
      { id: terbuka.id, aksi: "batalkan" },
      { jalan: "Membatalkan…", oke: "Dibatalkan", pesan: "Aktivasi dibatalkan." },
    );
    if (hasil) await muatUjian();
  }

  async function hapusUjian() {
    if (!terbuka) return;
    const setuju = window.confirm(
      `Hapus ujian "${terbuka.title}" beserta seluruh soal dan hasilnya?\n\n` +
        "Tindakan ini tidak dapat dibatalkan.",
    );
    if (!setuju) return;
    kabari("hapus-ujian", "jalan", "Menghapus ujian…");
    try {
      const jawab = await fetch(`/api/cbt/ujian?id=${terbuka.id}`, { method: "DELETE" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Ujian belum dapat dihapus.");
      setBuka(null);
      setPesan("Ujian dihapus.");
      kabari("hapus-ujian", "oke", "✓ Terhapus", 2000);
      await muatUjian();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Ujian belum dapat dihapus.");
      kabari("hapus-ujian", "gagal", "✕ Gagal menghapus", 6000);
    }
  }

  // ---------- KOREKSI ESSAY ----------

  /**
   * Buka lembar jawaban satu peserta.
   *
   * Jalur inilah yang membuat soal essay dapat dinilai sama sekali. Rutenya
   * sudah ada sejak awal, tetapi tidak pernah ada layar yang memanggilnya —
   * artinya essay yang dikerjakan peserta menggantung sebagai "menunggu
   * koreksi" selamanya, dan nilainya tidak pernah lengkap.
   */
  async function bukaLembar(p: Peserta) {
    if (!terbuka) return;
    kabari(`lembar-${p.id}`, "jalan", "Membuka…");
    setBukaPeserta(p);
    setRincian([]);
    setJejak([]);
    setDraftKoreksi({});
    setMuatRincian(true);
    try {
      const jawab = await fetch(`/api/cbt/hasil?ujian=${terbuka.id}&attempt=${p.id}`, { cache: "no-store" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Lembar jawaban tidak terbaca.");
      const isi = (data.rincian || []) as Rincian[];
      setRincian(isi);
      setJejak((data.jejak || []) as Jejak[]);
      // Baris peserta di papan pantau tidak membawa skor integritas maupun
      // rincian insidennya — di sana yang diambil hanya ringkasan. Yang datang
      // bersama lembar ini lebih lengkap, jadi ia yang dipakai.
      if (data.peserta) setBukaPeserta({ ...p, ...(data.peserta as Partial<Peserta>) });
      // Kotak nilainya diisi lebih dulu dengan poin yang sudah ada, supaya
      // pengajar yang hanya membetulkan satu angka tidak perlu mengetik ulang
      // seluruhnya.
      setDraftKoreksi(
        Object.fromEntries(
          isi.filter((r) => r.jenis === "essay").map((r) => [r.id, { poin: String(r.poin ?? 0), catatan: r.catatan || "" }]),
        ),
      );
      kabari(`lembar-${p.id}`, "oke", "✓ Terbuka di bawah", 2600);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Lembar jawaban tidak terbaca.");
      kabari(`lembar-${p.id}`, "gagal", "✕ Gagal dibuka", 6000);
      setBukaPeserta(null);
    } finally {
      setMuatRincian(false);
    }
  }

  async function koreksi(questionId: number, bobot: number) {
    if (!terbuka || !bukaPeserta) return;
    const draf = draftKoreksi[questionId];
    const poin = Number(draf?.poin);
    const kunci = `koreksi-${questionId}`;
    if (!Number.isFinite(poin) || poin < 0 || poin > bobot) {
      setGalat(`Nilai untuk soal ini harus antara 0 dan ${bobot}.`);
      kabari(kunci, "gagal", `✕ Nilai harus 0–${bobot}`, 5000);
      return;
    }
    const hasil = await kirim(
      kunci,
      "/api/cbt/hasil",
      "PATCH",
      { ujian: terbuka.id, attempt: bukaPeserta.id, soal: questionId, poin, catatan: draf?.catatan ?? "" },
      { jalan: "Menyimpan nilai…", oke: "Nilai tersimpan", pesan: "Koreksi tersimpan." },
    );
    if (!hasil) return;
    // Ditandai selesai di layar tanpa memuat ulang seluruh lembar, lalu daftar
    // pesertanya disegarkan supaya nilai barunya ikut terbaca.
    setRincian((kini) =>
      kini.map((r) => (r.id === questionId ? { ...r, benar: poin > 0, poin, catatan: draf?.catatan ?? "" } : r)),
    );
    await muatHasil(terbuka.id);
  }

  // ---------- TEMPLATE & IMPOR MASSAL ----------

  function unduh(isi: Blob, nama: string) {
    const alamat = URL.createObjectURL(isi);
    const tautan = document.createElement("a");
    tautan.href = alamat;
    tautan.download = nama;
    tautan.click();
    URL.revokeObjectURL(alamat);
  }

  /**
   * Dua template, dan hanya dua: .xlsx dan .docx.
   *
   * Keduanya dirakit sendiri di src/lib — bukan lewat SheetJS — karena edisi
   * komunitasnya tidak dapat menulis gaya sel, dan template tanpa warna, tanpa
   * baris kepala yang dibekukan, dan tanpa contoh yang dapat dibedakan adalah
   * template yang salah diisi.
   */
  function unduhTemplateExcel() {
    unduh(buatXlsxTemplate(), "Template-Soal-SiPaling.xlsx");
    setPesan("Template Excel terunduh. Isi lembar \"Soal\", lalu unggah kembali di sini.");
    kabari("tpl-xlsx", "oke", "✓ Template terunduh", 3400);
  }

  function unduhTemplateWord() {
    unduh(buatDocxTemplate(), "Template-Soal-SiPaling.docx");
    setPesan("Template Word terunduh. Tulis soalnya, lalu unggah kembali di sini.");
    kabari("tpl-docx", "oke", "✓ Template terunduh", 3400);
  }

  /**
   * Baca berkas soal yang diunggah pengajar.
   *
   * Seluruhnya diurai DI PERAMBAN, sama seperti pengimpor transkrip: berkas
   * soal memuat kunci jawaban, dan tidak ada alasan ia singgah di server
   * sebelum pengajarnya sendiri melihat hasil bacaannya.
   */
  async function bacaBerkasSoal(berkas: File) {
    setPesan("");
    setGalat("");
    setImporNama(berkas.name);
    try {
      const nama = berkas.name.toLowerCase();
      if (nama.endsWith(".docx")) {
        // Modul yang sama dipakai pengimpor template surat; jenisnya sudah
        // dikenali TypeScript lewat jalur ini, tidak lewat build browser-nya.
        const mammoth = await import("mammoth");
        const hasil = await mammoth.extractRawText({ arrayBuffer: await berkas.arrayBuffer() });
        const bacaan = imporDariWord(hasil.value || "");
        setImporSoal(bacaan.soal);
        setImporTolak(bacaan.tolak);
      } else if (nama.endsWith(".xlsx") || nama.endsWith(".xls") || nama.endsWith(".csv")) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(new Uint8Array(await berkas.arrayBuffer()), { type: "array" });
        const sheet = wb.Sheets["Soal"] ?? wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(sheet as Parameters<typeof XLSX.utils.sheet_to_json>[0], {
          header: 1, defval: "", raw: false,
        }) as Aoa;
        const bacaan = imporDariExcel(aoa);
        setImporSoal(bacaan.soal);
        setImporTolak(bacaan.tolak);
      } else {
        throw new Error("Berkasnya harus .xlsx, .xls, .csv, atau .docx.");
      }
    } catch (alasan: unknown) {
      setImporSoal([]);
      setImporTolak([]);
      setGalat(alasan instanceof Error ? alasan.message : "Berkas tidak dapat dibaca.");
    }
  }

  // ---------- BUAT SOAL DENGAN AI ----------

  /**
   * Sarikan dokumen yang diunggah pengajar — SELURUHNYA di peramban.
   *
   * Yang berangkat ke server nanti hanya teksnya. Bahan ujian adalah bahan
   * yang belum diujikan; ia tidak perlu singgah di tempat lain hanya untuk
   * dijadikan soal.
   */
  async function bacaBahanAi(berkas: File) {
    setAiKabar("");
    setGalat("");
    setSari(null);
    setSariNama(berkas.name);
    setAiSibuk(true);
    try {
      const hasil = await sarikanDokumen(berkas);
      if (hasil.kata < 120) {
        throw new Error(
          `Hanya ${hasil.kata} kata yang terbaca dari berkas ini. ` +
            "Bila ini PDF hasil pindaian, teksnya berupa gambar dan belum dapat dibaca, " +
            "pakai dokumen aslinya.",
        );
      }
      setSari(hasil);
      // Jumlah soal disarankan dari panjang naskahnya, bukan dibiarkan pada
      // angka bawaan yang mungkin jauh melampaui isinya.
      const wajar = Math.max(1, Math.min(Math.floor(hasil.kata / 60), MAKS_SOAL));
      setAiAtur((kini) => ({ ...kini, jumlah: Math.min(kini.jumlah, wajar) || wajar }));
      setAiKabar(
        `${hasil.kata.toLocaleString("id-ID")} kata terbaca` +
          (hasil.bagian > 0 ? ` dari ${hasil.bagian} ${hasil.jenis === "pptx" ? "salindia" : "halaman"}` : "") +
          `. Sekitar ${wajar} soal masih wajar dari naskah sepanjang ini.`,
      );
    } catch (alasan: unknown) {
      setSariNama("");
      setGalat(alasan instanceof Error ? alasan.message : "Dokumen tidak dapat dibaca.");
    } finally {
      setAiSibuk(false);
    }
  }

  async function buatSoalAi() {
    if (!terbuka || !sari) return;
    setAiSibuk(true);
    setGalat("");
    setPesan("");
    try {
      const jawab = await fetch("/api/cbt/ai-soal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ujian: terbuka.id,
          teks: sari.teks,
          jumlah: aiAtur.jumlah,
          jenis: aiAtur.jenis,
          tingkat: aiAtur.tingkat,
          materi: terbuka.courseName,
          arahan: aiAtur.arahan,
        }),
      });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) {
        if (Array.isArray(data.tolak) && data.tolak.length > 0) setImporTolak(data.tolak);
        throw new Error(data.message || "Soal belum dapat dibuat.");
      }
      // Hasilnya masuk ke pratinjau impor yang sudah ada — bukan langsung ke
      // bank soal. Pengajar yang memutuskan, dan ia melihatnya lebih dulu.
      setImporSoal(data.soal || []);
      setImporTolak(data.tolak || []);
      setImporNama(`Dibuat AI dari ${sariNama}`);
      setAiKabar(
        `${(data.soal || []).length} soal dibuat` +
          (data.kurang > 0 ? `, ${data.kurang} kurang dari yang diminta` : "") +
          `. Periksa dulu di bawah, lalu masukkan ke bank soal.`,
      );
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Soal belum dapat dibuat.");
    } finally {
      setAiSibuk(false);
    }
  }

  async function terbitkanImpor() {
    if (!terbuka || imporSoal.length === 0) return;
    const hasil = await kirim(
      "impor",
      "/api/cbt/soal",
      "POST",
      { ujian: terbuka.id, soal: imporSoal },
      {
        jalan: `Memasukkan ${imporSoal.length} soal…`,
        oke: `${imporSoal.length} soal masuk`,
        pesan: `${imporSoal.length} soal masuk ke bank soal.`,
      },
    );
    if (!hasil) return;
    setImporSoal([]);
    setImporTolak([]);
    setImporNama("");
    await muatSoal(terbuka.id);
    await muatUjian();
  }

  // ---------- LEMBAR CETAK ----------

  /**
   * Buka satu berkas cetak pada jendelanya sendiri.
   *
   * Cara yang sama dipakai surat tugas dan laporan antrean di portal ini, jadi
   * pengajarnya sudah mengenalnya: tekan Cetak, lalu pilih "Simpan sebagai PDF".
   */
  function bukaCetak(html: string, kunciTombol: string) {
    const jendela = window.open("", "_blank");
    if (!jendela) {
      setGalat("Popup diblokir peramban. Izinkan popup untuk situs ini, lalu coba lagi.");
      kabari(kunciTombol, "gagal", "✕ Popup diblokir", 6000);
      return;
    }
    jendela.document.write(html);
    jendela.document.close();
    kabari(kunciTombol, "oke", "✓ Dibuka di tab baru", 3400);
  }

  function keteranganUjian(): UjianCetak | null {
    if (!terbuka) return null;
    return {
      judul: terbuka.title,
      mataKuliah: terbuka.courseName,
      kelas: terbuka.className,
      kode: terbuka.code,
      durasi: terbuka.durationMinutes,
      jumlahSoal: terbuka.questionCount || soal.length,
      instruksi: terbuka.instruction,
      mulai: terbuka.startAt,
      selesai: terbuka.endAt,
    };
  }

  function cetakNaskah(denganKunci: boolean) {
    const kunciTombol = denganKunci ? "naskah-kunci" : "naskah";
    const info = keteranganUjian();
    if (!info || soal.length === 0) {
      setGalat("Bank soalnya masih kosong, belum ada yang dapat dicetak.");
      kabari(kunciTombol, "gagal", "✕ Bank soal masih kosong", 5000);
      return;
    }
    if (denganKunci) {
      const setuju = window.confirm(
        "Berkas ini memuat KUNCI JAWABAN dan hanya untuk pengawas.\n\n" +
          "Jangan sampai tercetak bersama naskah peserta. Lanjutkan?",
      );
      if (!setuju) return;
    }
    bukaCetak(naskahSoalHtml(info, soal, { denganKunci }), kunciTombol);
  }

  /**
   * Unduh kode QR sebagai berkas PNG.
   *
   * Yang dituju bukan arsip melainkan tempelan: gambar inilah yang dilempar
   * pengajar ke grup kelas, dimasukkan ke salindia pembuka, dan dikirim ke
   * pengawas ruangan. Karena itu PNG, bukan SVG — SVG lebih tajam tetapi tidak
   * dapat ditempel ke percakapan WhatsApp.
   */
  function unduhQr() {
    if (!terbuka || !qrUjian) return;
    const tautan = document.createElement("a");
    tautan.href = qrUjian;
    tautan.download = namaBerkasQr(terbuka.code);
    document.body.appendChild(tautan);
    tautan.click();
    tautan.remove();
    kabari("qr-unduh", "oke", "✓ QR terunduh", 3000);
  }

  /**
   * Poster satu halaman berisi QR, kode, dan jadwalnya — untuk ditempel di
   * pintu ruang ujian atau diproyeksikan ke papan.
   *
   * Tetap dibuka walaupun QR-nya gagal digambar. Pengajar yang menekan ini
   * tiga menit sebelum ujian membutuhkan kode dan tautannya tercetak besar,
   * dan itu ada di posternya dengan atau tanpa QR.
   */
  function cetakPosterQr() {
    const info = keteranganUjian();
    if (!info) return;
    bukaCetak(posterQrHtml(info, alamatUjian(info.kode), qrUjian), "qr-poster");
  }

  function cetakBeritaAcara(kunciTombol = "acara") {
    const info = keteranganUjian();
    if (!info || !terbuka) return;
    bukaCetak(
      beritaAcaraHtml(info, {
        pengawas: acara.pengawas,
        ruang: acara.ruang,
        catatan: acara.catatan,
        hadir: peserta.length,
        terdaftar: peserta.length,
        selesai: peserta.filter((p) => p.status !== "berjalan").length,
        berjalan: peserta.filter((p) => p.status === "berjalan").length,
        // Seluruh peserta yang skor integritasnya di bawah seratus, bukan
        // hanya yang pindah tab. Berita acara yang menyebut "nol pelanggaran"
        // sementara ada peserta yang menempel jawaban delapan kali adalah
        // dokumen yang menyesatkan, dan ia ditandatangani.
        pelanggaran: peserta.filter((p) => typeof p.integritas === "number" && p.integritas < 100).length,
        passing: terbuka.passingGrade,
        // Nilai dan jam pengumpulan tiap peserta ikut. Keduanya memang sudah
        // ada di papan pantau, tetapi papan pantau tidak dapat ditandatangani
        // dan tidak dapat dilampirkan: yang diserahkan ke akademik adalah
        // berita acaranya, dan berita acara tanpa daftar nilai memaksa
        // pengawas menyalin satu per satu dari layar — pekerjaan yang salah
        // ketik tanpa ada yang tahu.
        peserta: peserta.map((p) => ({
          nim: p.nim, nama: p.nama, status: p.status,
          pindahTab: p.pindahTab, keluarFullscreen: p.keluarFullscreen,
          nilai: p.nilai, mulai: p.mulai, kumpul: p.kumpul, tertunda: p.tertunda,
          integritas: p.integritas, dihentikan: p.dihentikan,
        })),
      }),
      kunciTombol,
    );
  }

  function cetakLaporanPeserta() {
    const info = keteranganUjian();
    if (!info || !bukaPeserta || !terbuka) return;
    const orang: PesertaCetak = {
      nim: bukaPeserta.nim, nama: bukaPeserta.nama, nilai: bukaPeserta.nilai,
      benar: rincian.filter((r) => r.benar === true).length,
      sebagian: rincian.filter((r) => r.benar === false && r.poin > 0).length,
      salah: rincian.filter((r) => r.benar === false && r.poin <= 0).length,
      kosong: rincian.filter((r) => !r.jawabanTeks).length,
      tertunda: bukaPeserta.tertunda,
      mulai: bukaPeserta.mulai, kumpul: bukaPeserta.kumpul,
      pindahTab: bukaPeserta.pindahTab, keluarFullscreen: bukaPeserta.keluarFullscreen,
    };
    bukaCetak(
      laporanPesertaHtml(
        info, orang,
        rincian.map((r) => ({
          nomor: r.nomor, jenis: r.jenis, pertanyaan: r.pertanyaan,
          jawabanTeks: r.jawabanTeks, benar: r.benar, poin: r.poin, bobot: r.bobot,
          catatan: r.catatan,
        })),
        terbuka.passingGrade,
      ),
      "laporan",
    );
  }

  // ---------- BAGIKAN ----------

  /**
   * Tautan yang dibagikan pengajar ke grup kelas.
   *
   * Sejak CBT pindah, tautan ini menunjuk ke SUBDOMAIN CBT, bukan ke domain
   * portal tempat dashboard ini dibuka. Bedanya bukan kosmetik: yang membuka
   * tautan itu peserta, dan yang mereka lihat pertama kali sebaiknya sudah
   * situs ujiannya sendiri — tanpa singgah dulu ke pengalihan.
   *
   * Bila subdomainnya tidak dikenali — pengembangan lokal, pratayang
   * penyebaran — alamatnya kembali memakai asal yang sedang dibuka, sehingga
   * tautannya tetap dapat dicoba di sana.
   */
  function alamatUjian(kode: string) {
    if (typeof window === "undefined") return `/ujian?kode=${kode}`;
    const asal = asalCbt(window.location.host) || window.location.origin;
    return `${asal}/ujian?kode=${kode}`;
  }

  function pesanGrup(u: Ujian) {
    return [
      `*${u.title}*`,
      `${u.courseName}${u.className ? ` · Kelas ${u.className}` : ""}`,
      "",
      `Tautan ujian : ${alamatUjian(u.code)}`,
      `Kode ujian   : ${u.code}`,
      ...(u.token ? [`Kode pengawas: ${u.token}`] : []),
      "",
      `Jumlah soal  : ${u.questionCount || u.jumlahBank}`,
      `Waktu        : ${u.durationMinutes} menit`,
      ...(u.startAt ? [`Dibuka       : ${jamRapi(u.startAt)}`] : []),
      ...(u.endAt ? [`Ditutup      : ${jamRapi(u.endAt)}`] : []),
      "",
      "Tidak perlu membuat akun. Buka tautannya, isi nama dan nomor peserta, lalu mulai.",
      "Lama pengerjaannya tertulis di layar sebelum tombol Mulai Ujian ditekan.",
      "",
      KREDIT_CBT,
    ].join("\n");
  }

  function salin(teks: string, penanda: string) {
    navigator.clipboard
      ?.writeText(teks)
      .then(() => {
        setTersalin(penanda);
        window.setTimeout(() => setTersalin(""), 2200);
      })
      .catch(() => setGalat("Penyalinan gagal. Salin manual dari kotaknya."));
  }

  function unduhNilai() {
    if (!terbuka || peserta.length === 0) return;
    const baris = [
      ["NIM / Nomor Peserta", "Nama", "Nilai", "Benar", "Status", "Mulai", "Kumpul"].join(","),
      ...peserta.map((p) =>
        [
          p.nim,
          `"${p.nama.replace(/"/g, '""')}"`,
          p.nilai ?? "",
          p.terjawab,
          p.status,
          jamRapi(p.mulai),
          jamRapi(p.kumpul),
        ].join(","),
      ),
    ].join("\n");
    // BOM di depan supaya Excel membaca huruf beraksen dengan benar.
    const berkas = new Blob([`﻿${baris}`], { type: "text/csv;charset=utf-8" });
    const alamat = URL.createObjectURL(berkas);
    const tautan = document.createElement("a");
    tautan.href = alamat;
    tautan.download = `nilai-${terbuka.code}.csv`;
    tautan.click();
    URL.revokeObjectURL(alamat);
    kabari("csv", "oke", "✓ CSV terunduh", 3400);
  }

  // ---------- DAFTAR UJIAN ----------
  if (buka === null) {
    return (
      <section>
        <p className="section-eyebrow">{pemantau ? "PENGAJAR & ADMIN" : "PENGAJAR"}</p>
        <h2 className="dsh-title">Ujian Online (CBT)</h2>

        {pesan && <div className="dsh-ok">{pesan}</div>}
        {galat && <div className="dsh-error">{galat}</div>}

        <div className="panel cbt-kepala">
          <div>
            <b>Peserta tidak perlu akun</b>
            <span>
              Cukup kode ujian, nama, dan nomor peserta.
              {pemantau ? " Anda memantau dan boleh menghapus, tetapi aktivasi ada pada pemiliknya." : ""}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setBuatBaru((b) => !b)}>
            {buatBaru ? "Tutup" : "+ Buat ujian"}
          </button>
        </div>

        {buatBaru && (
          <div className="panel cbt-form">
            <div className="cbt-baris">
              <label><span>Nama ujian *</span>
                <input value={draf.title} onChange={(e) => setDraf({ ...draf, title: e.target.value })} placeholder="UTS Komunikasi Politik" />
              </label>
              <label><span>Mata Kuliah / Materi *</span>
                <input value={draf.courseName} onChange={(e) => setDraf({ ...draf, courseName: e.target.value })} placeholder="mis. Matematika, K3, Bahasa Inggris" />
              </label>
              <label><span>Kelas</span>
                <input value={draf.className} onChange={(e) => setDraf({ ...draf, className: e.target.value })} placeholder="A / Reguler" />
              </label>
            </div>

            {/* Dua angka inilah yang ditentukan pengajar, dan blueprint-nya
                menyebutnya khusus: berapa soal, dan berapa lama. */}
            <div className="cbt-baris">
              <label><span>Jumlah soal yang dikerjakan</span>
                <input type="number" min={1} max={500} value={draf.questionCount} onChange={(e) => setDraf({ ...draf, questionCount: Number(e.target.value) })} />
              </label>
              <label><span>Durasi (menit)</span>
                <input type="number" min={1} max={600} value={draf.durationMinutes} onChange={(e) => setDraf({ ...draf, durationMinutes: Number(e.target.value) })} />
              </label>
              <label><span>Nilai minimal lulus</span>
                <input type="number" min={0} max={100} value={draf.passingGrade} onChange={(e) => setDraf({ ...draf, passingGrade: Number(e.target.value) })} />
              </label>
              <label><span>Kode tambahan (opsional)</span>
                <input value={draf.token} onChange={(e) => setDraf({ ...draf, token: e.target.value.toUpperCase() })} placeholder="Dibacakan pengawas" />
              </label>
            </div>

            <label className="cbt-lebar"><span>Instruksi untuk peserta</span>
              <textarea rows={3} value={draf.instruction} onChange={(e) => setDraf({ ...draf, instruction: e.target.value })} placeholder="Kerjakan sendiri. Tidak boleh membuka catatan." />
            </label>

            <DaftarSetelan nilai={draf} ubah={(kunci, nyala) => setDraf({ ...draf, [kunci]: nyala })} />
            <PilihPerangkat
              nilai={draf.lockdownDevice}
              nyala={draf.requireLockdown}
              ubah={(p) => setDraf({ ...draf, lockdownDevice: p })}
            />
            <PilihMode nilai={draf.proctorMode} ubah={(m) => setDraf({ ...draf, proctorMode: m })} />
            <p className="cbt-catatan">
              Seluruh setelan ini masih dapat diubah sesudah ujiannya jadi, lewat
              <b> ⚙ Pengaturan ujian</b> di dalam ujiannya.
            </p>

            <Tbl kabar={aksi.buat} diam="Simpan ujian" onClick={() => void buatUjian()} />
          </div>
        )}

        {muat ? (
          <div className="dempty">Memuat ujian…</div>
        ) : ujian.length === 0 ? (
          <div className="dempty">Belum ada ujian. Tekan &ldquo;Buat ujian&rdquo; untuk memulai.</div>
        ) : (
          <div className="cbt-daftar">
            {ujian.map((u) => (
              <button type="button" key={u.id} className="cbt-kartu" onClick={() => bukaUjian(u)}>
                <div className="cbt-kartu-atas">
                  <span className={`pill cbt-${u.status}`}>{STATUS_LABEL[u.status]}</span>
                  <code>{u.code}</code>
                </div>
                {!u.milik && <span className="cbt-punya-lain">Milik {u.createdBy} · Anda memantau</span>}
                <b>{u.title}</b>
                <span className="cbt-mk">{u.courseName}{u.className ? ` · ${u.className}` : ""}</span>
                <div className="cbt-angka">
                  <span><b>{u.questionCount || u.jumlahBank}</b> soal</span>
                  <span><b>{u.durationMinutes}</b> menit</span>
                  <span><b>{u.peserta.total}</b> peserta</span>
                  {u.peserta.berjalan > 0 && <span className="cbt-hidup"><b>{u.peserta.berjalan}</b> mengerjakan</span>}
                </div>
                {u.startAt && <small className="cbt-jadwal">{jamRapi(u.startAt)} → {jamRapi(u.endAt)}</small>}
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (!terbuka) return <div className="dempty">Ujian tidak ditemukan.</div>;

  // ---------- SATU UJIAN ----------
  // Dua sebab soal tidak boleh diubah, dan keduanya menutup tombol yang sama:
  // ujiannya sedang berlangsung, atau ini bukan ujian Anda.
  const sedangBerlangsung = terbuka.status === "berlangsung";
  const terkunci = sedangBerlangsung || !terbuka.bolehUbah;

  // Jadwal yang sedang diketik, sudah menjadi saat sungguhan — dipakai tiga
  // kali: mematikan tombol aktivasi, menuliskan alasannya, dan membacakan
  // kembali jadwalnya dengan kalimat penuh.
  const mulaiJadwal = dariIsian(jadwal.mulai);
  const selesaiJadwal = dariIsian(jadwal.selesai);
  // Berapa soal yang sudah masuk dibandingkan yang dituntut ujiannya. Bank yang
  // lebih besar daripada jumlah yang dipakai bukan kelebihan yang salah: soalnya
  // diacak dari seluruh bank, jadi bank yang lebih besar berarti dua peserta
  // bersebelahan lebih kecil kemungkinan mendapat lembar yang sama.
  const cukupSoal = soal.length >= terbuka.questionCount && soal.length > 0;
  const persenSoal = terbuka.questionCount > 0
    ? Math.min(100, Math.round((soal.length / terbuka.questionCount) * 100))
    : soal.length > 0 ? 100 : 0;

  const halanganAktivasi = halanganJadwal({
    mulai: mulaiJadwal,
    selesai: selesaiJadwal,
    durasi: terbuka.durationMinutes,
    jumlahBank: soal.length,
    soalDipakai: terbuka.questionCount,
  });

  // Setelan yang isinya berbeda dari yang tersimpan di server. Dipakai dua
  // kali: menyebut jumlahnya pada kepala panel yang terlipat — supaya
  // perubahan yang belum disimpan tidak hilang di balik lipatan — dan menahan
  // pengiriman yang tidak mengubah apa pun.
  const setelanAsli = setelanUjian(terbuka);
  const setelanBerubah = (Object.keys(setelanAsli) as Array<keyof typeof setelanAsli>).filter(
    (k) => setel[k] !== setelanAsli[k],
  );

  return (
    <section>
      <button type="button" className="text-action" onClick={() => { setBuka(null); void muatUjian(); }}>
        ← Semua ujian
      </button>
      <h2 className="dsh-title cbt-judul">{terbuka.title}</h2>
      <p className="cbt-sub">
        {terbuka.courseName}{terbuka.className ? ` · ${terbuka.className}` : ""} ·
        kode ujian <code>{terbuka.code}</code>
      </p>

      {pesan && <div className="dsh-ok">{pesan}</div>}
      {galat && <div className="dsh-error">{galat}</div>}

      {/* ---------- BAGIKAN KE PESERTA ---------- */}
      {soal.length > 0 && (
        <div className="panel cbt-bagi">
          <div className="cbt-bagi-kepala">
            <b>Bagikan ke peserta</b>
            <span>
              Tempel ke grup kelas.
              {!terbuka.activatedAt && " Aktifkan dulu sebelum peserta dapat masuk."}
            </span>
          </div>

          {/* ---------- KODE QR ----------
              Menjawab satu hal yang selalu memakan sepuluh menit pertama
              ujian: peserta yang tidak membuka grup kelas, duduk di ruangan,
              lalu mengetik ulang kode dari papan tulis — dan tertukar "0"
              dengan "O". Yang dipindai bukan kodenya melainkan tautan
              lengkapnya, sehingga halaman ujiannya terbuka dengan kode yang
              sudah terisi.

              Kotaknya hanya muncul bila QR-nya berhasil digambar. Bingkai
              kosong bertuliskan "memuat…" yang menetap karena penggambarnya
              gagal jauh lebih mengganggu daripada tidak ada apa-apa —
              tautan dan kodenya tetap ada persis di sebelahnya. */}
          {qrUjian && (
            <div className="cbt-bagi-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUjian} alt={`Kode QR ujian ${terbuka.code}`} width={148} height={148} />
              <div className="cbt-bagi-qr-teks">
                <b>Pindai untuk masuk</b>
                <span>Tayangkan di papan. Kode ujiannya terisi sendiri.</span>
                <div className="cbt-bagi-qr-tombol">
                  <Tbl kabar={aksi["qr-unduh"]} dasar="btn btn-light" diam="⬇ Unduh QR (PNG)" onClick={unduhQr} />
                  <Tbl kabar={aksi["qr-poster"]} dasar="btn btn-light" diam="🖨 Cetak poster QR" onClick={cetakPosterQr} />
                </div>
              </div>
            </div>
          )}

          <div className="cbt-bagi-baris">
            <div className="cbt-bagi-kotak">
              <small>Tautan ujian</small>
              <code>{alamatUjian(terbuka.code)}</code>
            </div>
            <button type="button" className="btn btn-light btn-mini" onClick={() => salin(alamatUjian(terbuka.code), "tautan")}>
              {tersalin === "tautan" ? "Tersalin ✓" : "Salin tautan"}
            </button>
          </div>

          <div className="cbt-bagi-baris">
            <div className="cbt-bagi-kotak cbt-bagi-kode">
              <small>Kode ujian</small>
              <code>{terbuka.code}</code>
            </div>
            {terbuka.token && (
              <div className="cbt-bagi-kotak cbt-bagi-kode">
                <small>Kode pengawas</small>
                <code>{terbuka.token}</code>
              </div>
            )}
            <button type="button" className="btn btn-light btn-mini" onClick={() => salin(terbuka.code, "kode")}>
              {tersalin === "kode" ? "Tersalin ✓" : "Salin kode"}
            </button>
          </div>

          {/* Satu tombol yang menyalin pesan siap tempel. Menyalin tautan lalu
              mengetik sendiri jam dan jumlah soalnya di grup adalah pekerjaan
              yang paling sering salah ketik. */}
          <button type="button" className="btn btn-primary cbt-bagi-pesan" onClick={() => salin(pesanGrup(terbuka), "pesan")}>
            {tersalin === "pesan" ? "Pesan tersalin ✓" : "📋 Salin pesan siap tempel untuk grup"}
          </button>
          <pre className="cbt-bagi-pratinjau">{pesanGrup(terbuka)}</pre>
        </div>
      )}

      {/* ---------- CETAK NASKAH SOAL (CADANGAN) ----------
          Terlipat sampai diminta. Isinya panjang dan hanya dipakai sekali,
          menjelang ujian; dibiarkan terbuka ia mendorong bank soal jauh ke
          bawah setiap kali panel ini dibuka. */}
      {soal.length > 0 && (
        <div className="panel cbt-cetak">
          <button type="button" className="cbt-lipat" aria-expanded={lipatCetak} onClick={() => setLipatCetak(!lipatCetak)}>
            <b>🖨 Cetak naskah soal</b>
            <span>{lipatCetak ? "▲ Sembunyikan" : "▼ Tampilkan"}</span>
          </button>
          {lipatCetak && (
            <div className="cbt-lipat-isi">
              <p className="cbt-catatan">
                Cadangan untuk listrik padam atau jaringan mati. Pada jendela yang terbuka, tekan
                Cetak lalu pilih <b>Simpan sebagai PDF</b>.
              </p>
              <div className="cbt-impor-tombol">
                <Tbl kabar={aksi.naskah} diam="Naskah untuk peserta" onClick={() => cetakNaskah(false)} />
                <Tbl
                  kabar={aksi["naskah-kunci"]}
                  dasar="btn btn-light"
                  diam="Naskah + kunci (pengawas)"
                  onClick={() => cetakNaskah(true)}
                />
              </div>
              <p className="cbt-catatan">
                Naskah peserta tanpa kunci jawaban, sudah termasuk lembar identitas dan ruang
                menulis. Soal bermedia ditandai.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---------- GERBANG AKTIVASI ---------- */}
      <div className="panel cbt-aktivasi" data-aktif={terbuka.activatedAt ? "1" : undefined}>
        <div className="cbt-aktivasi-kepala">
          <div>
            <b>{terbuka.activatedAt ? "Ujian sudah diaktifkan" : "Belum diaktifkan"}</b>
            <span>
              {terbuka.activatedAt
                ? `Dibuka sendiri ${jamRapi(terbuka.startAt)} sampai ${jamRapi(terbuka.endAt)}. Diaktifkan oleh ${terbuka.activatedBy ?? "-"}.`
                : terbuka.bolehUbah
                  ? "Setel jam mulai dan jam selesai, lalu aktifkan. Pada jam mulainya ujian terbuka sendiri, tidak ada tombol yang perlu ditekan lagi."
                  : `Ujian ini milik ${terbuka.createdBy}. Hanya pengajar pemiliknya yang dapat menjadwalkan dan mengaktifkannya.`}
            </span>
          </div>
          <span className={`pill cbt-${terbuka.status}`}>{STATUS_LABEL[terbuka.status]}</span>
        </div>

        {terbuka.bolehUbah ? (
          <>
            <div className="cbt-jadwal-form">
              <PilihJam
                label="Jam mulai"
                nilai={jadwal.mulai}
                ubah={(mulai) => setJadwal({ ...jadwal, mulai })}
              />
              <PilihJam
                label="Jam selesai"
                nilai={jadwal.selesai}
                ubah={(selesai) => setJadwal({ ...jadwal, selesai })}
              />
            </div>

            {/* Ringkasan jadwalnya, dibacakan kembali dengan kalimat penuh.
                Angka pada tiga pemilih terpisah mudah salah baca — tanggal satu
                hari geser dan menit yang tertinggal pada nilai lama keduanya
                terlihat benar sampai dibaca seperti kalimat. */}
            {mulaiJadwal && selesaiJadwal && selesaiJadwal > mulaiJadwal && (
              <p className="cbt-jadwal-ringkas">
                Jendela ujian{" "}
                <b>{ejaWaktu(Math.round((selesaiJadwal.getTime() - mulaiJadwal.getTime()) / 60_000))}</b>
                {" "}untuk ujian yang dikerjakan {ejaWaktu(terbuka.durationMinutes)}.
              </p>
            )}

            {/* Tombolnya abu-abu selama halangannya ada, dan halangannya ditulis
                persis di sebelahnya. Tombol mati tanpa alasan hanya memindahkan
                kebingungan, tidak menghapusnya. */}
            {halanganAktivasi && (
              <p className="cbt-jadwal-halangan" role="status">⚠ {halanganAktivasi}</p>
            )}

            <div className="cbt-jadwal-aksi">
              <Tbl
                kabar={aksi.aktif}
                diam={terbuka.activatedAt ? "Perbarui jadwal" : "Aktifkan ujian"}
                mati={Boolean(halanganAktivasi)}
                judul={halanganAktivasi ?? undefined}
                onClick={() => void aktifkan()}
              />
              {terbuka.activatedAt && (
                <Tbl
                  kabar={aksi["batal-aktif"]}
                  dasar="btn btn-danger btn-mini"
                  diam="Batalkan"
                  onClick={() => void batalkanAktivasi()}
                />
              )}
            </div>
          </>
        ) : (
          <p className="cbt-catatan">
            Jadwal dan aktivasi dipegang pengajar pemiliknya. Anda memantau peserta dan nilainya di tab sebelah{terbuka.bolehHapus ? ", dan menghapus ujian ini bila memang perlu" : ""}.
            Untuk ujian seleksi, buatlah ujian sendiri: ujian yang Anda buat menjadi milik Anda,
            beserta tombol aktivasinya.
          </p>
        )}

        {terbuka.bolehHapus && (
          <div className="cbt-hapus-ujian">
            <Tbl
              kabar={aksi["hapus-ujian"]}
              dasar="btn btn-danger btn-mini"
              diam="Hapus ujian ini"
              onClick={() => void hapusUjian()}
            />
            <span>Soal dan seluruh hasilnya ikut terhapus. Tidak dapat dibatalkan.</span>
          </div>
        )}
      </div>

      {/* ---------- PENGATURAN UJIAN ----------
          Dulu setelan hanya dapat ditentukan sekali, pada formulir pembuatan,
          dan sesudah itu tidak ada layar mana pun yang dapat mengubahnya. Yang
          paling mahal justru terjadi saat ujian berjalan: satu peserta
          terblokir karena ponselnya sudah dipakai temannya, dan centang "satu
          perangkat" tidak dapat dilepas sampai ujiannya usai — artinya orang
          itu tidak ikut ujian sama sekali. Sekarang panel ini terbuka
          sewaktu-waktu; yang tetap dikunci selama ujian berlangsung hanya
          setelan yang mengubah BENTUK ujiannya. */}
      {terbuka.bolehUbah && (
        <div className="panel cbt-setel">
          <button
            type="button"
            className="cbt-lipat"
            aria-expanded={bukaSetel}
            onClick={() => setBukaSetel(!bukaSetel)}
          >
            <b>⚙ Pengaturan ujian</b>
            <span>
              {setelanBerubah.length > 0 && (
                <i className="cbt-setel-tanda">{setelanBerubah.length} belum disimpan</i>
              )}
              {bukaSetel ? "▲ Sembunyikan" : "▼ Ubah setelan"}
            </span>
          </button>

          {bukaSetel && (
            <div className="cbt-lipat-isi">
              <p className="cbt-catatan">
                Boleh diubah sewaktu-waktu.
                {sedangBerlangsung
                  ? " Sedang berlangsung: jumlah soal, durasi, dan pengacakan dikunci. Sisanya tetap bisa diubah."
                  : " Perubahan berlaku untuk peserta yang masuk sesudah disimpan."}
              </p>

              <div className="cbt-baris">
                <label><span>Nama ujian *</span>
                  <input value={setel.title} onChange={(e) => setSetel({ ...setel, title: e.target.value })} />
                </label>
                <label><span>Mata Kuliah / Materi *</span>
                  <input value={setel.courseName} onChange={(e) => setSetel({ ...setel, courseName: e.target.value })} />
                </label>
                <label><span>Kelas</span>
                  <input value={setel.className} onChange={(e) => setSetel({ ...setel, className: e.target.value })} placeholder="A / Reguler" />
                </label>
              </div>

              <div className="cbt-baris">
                <label className={sedangBerlangsung ? "mati" : ""}>
                  <span>Jumlah soal yang dikerjakan{sedangBerlangsung ? " · terkunci" : ""}</span>
                  <input
                    type="number" min={1} max={500} value={setel.questionCount} disabled={sedangBerlangsung}
                    onChange={(e) => setSetel({ ...setel, questionCount: Number(e.target.value) })}
                  />
                </label>
                <label className={sedangBerlangsung ? "mati" : ""}>
                  <span>Durasi (menit){sedangBerlangsung ? " · terkunci" : ""}</span>
                  <input
                    type="number" min={1} max={600} value={setel.durationMinutes} disabled={sedangBerlangsung}
                    onChange={(e) => setSetel({ ...setel, durationMinutes: Number(e.target.value) })}
                  />
                </label>
                <label><span>Nilai minimal lulus</span>
                  <input
                    type="number" min={0} max={100} value={setel.passingGrade}
                    onChange={(e) => setSetel({ ...setel, passingGrade: Number(e.target.value) })}
                  />
                </label>
                <label><span>Kode pengawas (opsional)</span>
                  <input
                    value={setel.token}
                    onChange={(e) => setSetel({ ...setel, token: e.target.value.toUpperCase() })}
                    placeholder="Dibacakan pengawas"
                  />
                </label>
              </div>

              <label className="cbt-lebar"><span>Instruksi untuk peserta</span>
                <textarea
                  rows={3} value={setel.instruction}
                  onChange={(e) => setSetel({ ...setel, instruction: e.target.value })}
                  placeholder="Kerjakan sendiri. Tidak boleh membuka catatan."
                />
              </label>

              <DaftarSetelan
                nilai={setel}
                kunciBentuk={sedangBerlangsung}
                ubah={(kunci, nyala) => setSetel({ ...setel, [kunci]: nyala })}
              />
              <PilihPerangkat
                nilai={setel.lockdownDevice}
                nyala={setel.requireLockdown}
                ubah={(p) => setSetel({ ...setel, lockdownDevice: p })}
              />
              {/* Sengaja TIDAK ikut terkunci saat ujian berlangsung. Yang paling
                  sering terjadi bukan pengajar yang hendak melonggarkan, melainkan
                  pengajar yang baru sadar kelasnya menyontek dan ingin mengetatkan
                  di tengah jalan — dan menahannya sampai ujian selesai berarti
                  menahannya sampai tidak ada gunanya lagi. */}
              <PilihMode nilai={setel.proctorMode} ubah={(m) => setSetel({ ...setel, proctorMode: m })} />
              <SaklarKamera
                nyala={setel.cameraOn}
                mode={setel.proctorMode}
                boleh={terbuka.bolehSaklarKamera}
                ubah={(nyala) => setSetel({ ...setel, cameraOn: nyala })}
              />

              <div className="cbt-form-aksi">
                <Tbl
                  kabar={aksi.setel}
                  diam={
                    setelanBerubah.length > 0
                      ? `Simpan ${setelanBerubah.length} perubahan`
                      : "Simpan pengaturan"
                  }
                  onClick={() => void simpanSetelan()}
                />
                {setelanBerubah.length > 0 && (
                  <button type="button" className="btn btn-light" onClick={() => setSetel(setelanUjian(terbuka))}>
                    Kembalikan seperti semula
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="cbt-tab">
        <button type="button" className={tab === "soal" ? "on" : ""} onClick={() => setTab("soal")}>
          Bank soal ({soal.length})
        </button>
        <button type="button" className={tab === "pantau" ? "on" : ""} onClick={() => { setTab("pantau"); void muatHasil(terbuka.id); }}>
          Monitoring & nilai ({peserta.length})
        </button>
      </div>

      {tab === "soal" ? (
        <>
          {sedangBerlangsung && (
            <div className="dsh-error">
              Ujian sedang berlangsung. Soal dikunci sampai selesai.
            </div>
          )}
          {!terbuka.bolehUbah && !sedangBerlangsung && (
            <div className="dsh-note">
              Bank soal ini milik <b>{terbuka.createdBy}</b> dan hanya dapat dibaca dari sini.
              Menyunting soal kelas pengajar lain bukan wewenang yang ada pada peran Anda.
            </div>
          )}

          {/* ---------- BUAT SOAL DENGAN AI (DIPADAMKAN) ---------- */}
          {AI_SOAL_TAMPIL && (
          <div className="panel cbt-ai">
            <div className="cbt-impor-kepala">
              <b>✨ Buat soal dengan AI</b>
              <span>
                Unggah bahan ajar (Word, PowerPoint, atau PDF). Soal yang keluar diperiksa dulu
                sebelum masuk bank.
              </span>
            </div>

            {aiSiap === false ? (
              <p className="cbt-catatan">
                Pembuat soal AI belum tersambung ke model mana pun. Pasang <code>ANTHROPIC_API_KEY</code>
                {" "}(Claude) atau <code>GEMINI_API_KEY</code> pada environment Vercel, lalu deploy ulang.
                Menu lain tetap berjalan tanpa itu.
              </p>
            ) : (
              <>
                <div className="cbt-impor-tombol">
                  <label className={`btn btn-primary cbt-unggah ${terkunci || aiSibuk ? "mati" : ""}`}>
                    {aiSibuk && !sari ? "Membaca…" : "⇧ Unggah bahan (.docx / .pptx / .pdf)"}
                    <input
                      type="file"
                      accept=".docx,.pptx,.pdf"
                      disabled={terkunci || aiSibuk}
                      onChange={(e) => {
                        const berkas = e.target.files?.[0];
                        e.target.value = "";
                        if (berkas) void bacaBahanAi(berkas);
                      }}
                    />
                  </label>
                  {sariNama && <span className="cbt-impor-nama">{sariNama}</span>}
                  {aiPenyedia.length > 0 && (
                    <span className="cbt-impor-nama">
                      model: {aiPenyedia.includes("claude") ? "Claude" : "Gemini"}
                    </span>
                  )}
                </div>

                {aiKabar && <p className="cbt-ai-kabar">{aiKabar}</p>}

                {sari && (
                  <>
                    <div className="cbt-baris cbt-ai-atur">
                      <label><span>Jumlah soal</span>
                        <input
                          type="number" min={1} max={MAKS_SOAL} value={aiAtur.jumlah}
                          onChange={(e) => setAiAtur({ ...aiAtur, jumlah: Number(e.target.value) })}
                        />
                      </label>
                      <label><span>Tingkat kesulitan</span>
                        <select
                          value={aiAtur.tingkat}
                          onChange={(e) => setAiAtur({ ...aiAtur, tingkat: e.target.value as typeof aiAtur.tingkat })}
                        >
                          <option value="campuran">Campuran (30% mudah, 50% sedang, 20% sulit)</option>
                          <option value="mudah">Mudah semua</option>
                          <option value="sedang">Sedang semua</option>
                          <option value="sulit">Sulit semua</option>
                        </select>
                      </label>
                    </div>

                    <div className="cbt-ai-jenis">
                      <span className="cbt-opsi-judul">Jenis soal yang dibuat</span>
                      <div className="cbt-sakelar">
                        {JENIS_AI.map((j) => (
                          <label key={j} className="cbt-cek">
                            <input
                              type="checkbox"
                              checked={aiAtur.jenis.includes(j)}
                              onChange={(e) =>
                                setAiAtur({
                                  ...aiAtur,
                                  jenis: e.target.checked
                                    ? [...aiAtur.jenis, j]
                                    // Minimal satu jenis harus tersisa; tanpa itu
                                    // permintaannya kosong dan model menebak sendiri.
                                    : aiAtur.jenis.length > 1
                                      ? aiAtur.jenis.filter((x) => x !== j)
                                      : aiAtur.jenis,
                                })
                              }
                            />
                            <span>{JENIS_LABEL[j]}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <label className="cbt-lebar"><span>Arahan tambahan (opsional)</span>
                      <textarea
                        rows={2} value={aiAtur.arahan}
                        onChange={(e) => setAiAtur({ ...aiAtur, arahan: e.target.value })}
                        placeholder="Mis. fokus pada bab 2 dan 3; hindari soal hafalan tahun."
                      />
                    </label>

                    <div className="cbt-impor-aksi">
                      <button
                        type="button" className="btn btn-primary"
                        disabled={aiSibuk || terkunci}
                        onClick={() => void buatSoalAi()}
                      >
                        {aiSibuk ? "Menyusun soal… (bisa satu menit)" : `✨ Buat ${aiAtur.jumlah} soal`}
                      </button>
                      <button type="button" className="btn btn-light" onClick={() => {
                        setSari(null); setSariNama(""); setAiKabar("");
                      }}>
                        Ganti bahan
                      </button>
                    </div>
                    <p className="cbt-catatan">
                      Periksa kunci jawabannya. Itu yang paling sering keliru pada soal buatan mesin.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
          )}

          {/* ---------- IMPOR MASSAL ---------- */}
          <div className="panel cbt-impor">
            <div className="cbt-impor-kepala">
              <b>Buat soal lewat Excel atau Word</b>
              <span>Unduh template, isi di komputer, unggah sekali untuk seluruh soal.</span>
            </div>

            <div className="cbt-impor-tombol">
              <Tbl kabar={aksi["tpl-xlsx"]} dasar="btn btn-light" diam="⇩ Template Excel (.xlsx)" onClick={() => unduhTemplateExcel()} />
              <Tbl kabar={aksi["tpl-docx"]} dasar="btn btn-light" diam="⇩ Template Word (.docx)" onClick={() => unduhTemplateWord()} />
              <label className={`btn btn-primary cbt-unggah ${terkunci ? "mati" : ""}`}>
                ⇧ Unggah soal
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.docx"
                  disabled={terkunci}
                  onChange={(e) => {
                    const berkas = e.target.files?.[0];
                    e.target.value = "";
                    if (berkas) void bacaBerkasSoal(berkas);
                  }}
                />
              </label>
            </div>

            {(imporSoal.length > 0 || imporTolak.length > 0) && (
              <div className="cbt-impor-hasil">
                <div className="cbt-impor-angka">
                  <span className="cbt-impor-ok"><b>{imporSoal.length}</b> soal terbaca</span>
                  {imporTolak.length > 0 && (
                    <span className="cbt-impor-gagal"><b>{imporTolak.length}</b> baris perlu diperbaiki</span>
                  )}
                  {imporNama && <span className="cbt-impor-nama">{imporNama}</span>}
                </div>

                {imporTolak.length > 0 && (
                  <ul className="cbt-impor-tolak">
                    {imporTolak.slice(0, 8).map((t, i) => (
                      <li key={i}><b>{t.baris}</b>: {t.alasan}</li>
                    ))}
                    {imporTolak.length > 8 && <li>…dan {imporTolak.length - 8} lagi.</li>}
                  </ul>
                )}

                {imporSoal.length > 0 && (
                  <>
                    <ol className="cbt-impor-pratinjau">
                      {imporSoal.slice(0, 5).map((q, i) => (
                        <li key={i}>
                          <span className={`pill cbt-t-${q.tingkat}`}>{JENIS_LABEL[q.jenis]} · {q.bobot} poin</span>
                          <p>{q.pertanyaan.slice(0, 110)}{q.pertanyaan.length > 110 ? "…" : ""}</p>
                          {/* Lewat kunciTerbaca, bukan Number(q.kunci) apa adanya:
                              kunci PG kompleks berbentuk "0,2" sehingga
                              Number()-nya NaN, dan String.fromCharCode(65 + NaN)
                              mencetak aksara kosong — pratinjau impornya dulu
                              berbunyi "Kunci: ." pada setiap soal jawaban jamak
                              dan setiap soal penjodohan. */}
                          {kunciTerbaca(q) !== "" && <small>Kunci: {kunciTerbaca(q)}</small>}
                        </li>
                      ))}
                      {imporSoal.length > 5 && <li className="cbt-impor-sisa">…dan {imporSoal.length - 5} soal lagi.</li>}
                    </ol>
                    <div className="cbt-impor-aksi">
                      <Tbl
                        kabar={aksi.impor}
                        diam={`Masukkan ${imporSoal.length} soal ke bank`}
                        mati={terkunci}
                        onClick={() => void terbitkanImpor()}
                      />
                      <button type="button" className="btn btn-light" onClick={() => { setImporSoal([]); setImporTolak([]); setImporNama(""); }}>
                        Batal
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ---------- BERAPA SOAL YANG SUDAH MASUK ----------
              Angkanya besar, dan itu bukan hiasan. Memasukkan soal adalah
              pekerjaan berulang yang memakan satu jam penuh: mengetik,
              menyimpan, mengetik lagi. Yang selalu ditanyakan pengajar di
              tengahnya satu hal — "sudah berapa?" — dan dahulu jawabannya hanya
              ada pada angka kecil di dalam kurung pada nama tab, jauh di atas
              formulir yang sedang diisi, atau harus dihitung sendiri dari daftar
              di bawahnya.

              Ia berdiri PERSIS DI ATAS formulirnya, sehingga setiap kali satu
              soal tersimpan, angka yang naik itu berada tepat di tempat mata
              sedang menatap. */}
          <div className="panel cbt-hitung" data-cukup={cukupSoal ? "1" : undefined}>
            <div className="cbt-hitung-angka">
              <b>{soal.length}</b>
              <span>soal sudah dimasukkan</span>
            </div>
            <div className="cbt-hitung-rinci">
              <p className="cbt-hitung-target">
                Ujian ini memakai <b>{terbuka.questionCount}</b> soal dari bank.
              </p>
              <p className={`cbt-hitung-kabar ${cukupSoal ? "cukup" : "kurang"}`}>
                {cukupSoal
                  ? soal.length > terbuka.questionCount
                    ? `✓ Cukup, malah berlebih ${soal.length - terbuka.questionCount} soal — yang dipakai diacak dari seluruh bank.`
                    : "✓ Cukup. Bank soalnya pas dengan jumlah yang dipakai ujian."
                  : `Kurang ${terbuka.questionCount - soal.length} soal lagi. Ujian belum dapat diaktifkan sebelum banknya cukup.`}
              </p>
              {/* Batang yang ikut penuh. Angka menjawab "berapa"; batang
                  menjawab "tinggal berapa lagi" tanpa seorang pun mengurangi. */}
              <div
                className="cbt-hitung-batang"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={terbuka.questionCount || soal.length || 1}
                aria-valuenow={Math.min(soal.length, terbuka.questionCount || soal.length)}
                aria-label="Jumlah soal yang sudah dimasukkan"
              >
                <i style={{ width: `${persenSoal}%` }} />
              </div>
            </div>
          </div>

          <div className="panel cbt-form">
            <b className="cbt-form-judul">{sunting ? "Ubah soal" : "Tambah soal satu per satu"}</b>

            <div className="cbt-baris">
              <label><span>Jenis</span>
                <select value={soalBaru.jenis} onChange={(e) => {
                  const jenis = e.target.value as JenisSoal;
                  setSoalBaru((s) => ({ ...s, jenis, ...bentukJenis(jenis) }));
                }}>
                  {SEMUA_JENIS.map((j) => (
                    <option key={j} value={j}>{JENIS_LABEL[j]}</option>
                  ))}
                </select>
              </label>
              <label><span>Bobot nilai</span>
                <input type="number" min={1} max={100} value={soalBaru.bobot} onChange={(e) => setSoalBaru({ ...soalBaru, bobot: Number(e.target.value) })} />
              </label>
            </div>

            <label className="cbt-lebar"><span>Pertanyaan *</span>
              <textarea rows={3} value={soalBaru.pertanyaan} onChange={(e) => setSoalBaru({ ...soalBaru, pertanyaan: e.target.value })} />
            </label>

            {/* ---------- MEDIA: GAMBAR ATAU VIDEO ----------
                Terlipat sampai diminta. Sebagian besar soal tidak bergambar,
                dan bagian ini berdiri persis di antara pertanyaan dan pilihan
                jawaban: dua isian yang justru selalu dipakai. */}
            <div className="cbt-media-edit">
              <button type="button" className="cbt-lipat" aria-expanded={bukaMedia} onClick={() => setBukaMedia(!bukaMedia)}>
                <b>Media soal (opsional)</b>
                <span>
                  {soalBaru.media.jenis && soalBaru.media.url
                    ? bukaMedia ? "▲ Sembunyikan" : "▼ Terpasang, tampilkan"
                    : bukaMedia ? "▲ Sembunyikan" : "▼ Tampilkan"}
                </span>
              </button>
              {bukaMedia && (
              <div className="cbt-media-baris">
                <select
                  value={soalBaru.media.jenis}
                  onChange={(e) =>
                    setSoalBaru({ ...soalBaru, media: { ...soalBaru.media, jenis: e.target.value as Media["jenis"] } })
                  }
                >
                  <option value="">Tanpa media</option>
                  <option value="gambar">Gambar</option>
                  <option value="video">Video</option>
                </select>
                <input
                  value={soalBaru.media.url}
                  onChange={(e) => setSoalBaru({ ...soalBaru, media: { ...soalBaru.media, url: e.target.value } })}
                  placeholder="Tempel tautan gambar / YouTube / Drive, atau unggah berkas →"
                />
                <label
                  className={`btn btn-light btn-mini cbt-unggah ${terkunci || berjalan("media") ? "mati" : ""} ${
                    aksi.media?.keadaan === "oke" ? "btn-oke" : aksi.media?.keadaan === "gagal" ? "btn-gagal" : ""
                  }`}
                >
                  {aksi.media ? aksi.media.teks : "⇧ Unggah"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"
                    disabled={terkunci || berjalan("media")}
                    onChange={(e) => {
                      const berkas = e.target.files?.[0];
                      e.target.value = "";
                      if (berkas) void unggahMedia(berkas);
                    }}
                  />
                </label>
              </div>
              )}
              {bukaMedia && soalBaru.media.jenis && (
                <input
                  className="cbt-media-ket-edit"
                  value={soalBaru.media.keterangan}
                  onChange={(e) => setSoalBaru({ ...soalBaru, media: { ...soalBaru.media, keterangan: e.target.value } })}
                  placeholder="Keterangan gambar/video (opsional)"
                />
              )}
              {/* ---------- PRATINJAU ----------
                  Pengajar melihat SEKARANG apa yang akan dilihat peserta. Tanpa
                  ini, tautan yang salah ketik atau berkas yang tidak dapat
                  dibaca umum baru ketahuan ketika ujian sudah berjalan — dan
                  saat itu tidak ada lagi yang dapat diperbaiki. */}
              {bukaMedia && soalBaru.media.jenis === "gambar" && soalBaru.media.url.trim() !== "" && (
                <div className="cbt-media-pratinjau">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={soalBaru.media.url}
                    alt="Pratinjau media soal"
                    onLoad={() => setMediaTermuat("ya")}
                    onError={() => setMediaTermuat("tidak")}
                  />
                  {mediaTermuat === "tidak" && (
                    <p className="cbt-media-gagal-edit">
                      Gambar ini <b>tidak dapat dimuat</b>. Bila berkasnya baru diunggah, bucket
                      Storage-nya kemungkinan belum publik; bila ini tautan dari luar, periksa
                      penulisannya. Peserta akan melihat kotak kosong.
                    </p>
                  )}
                </div>
              )}
              {bukaMedia && (
                <p className="cbt-catatan">
                  Gambar maks 5 MB, video 50 MB. Video panjang lebih baik ditempel sebagai tautan
                  YouTube atau Drive.
                </p>
              )}
            </div>

            {(soalBaru.jenis === "pg" || soalBaru.jenis === "pg_kompleks" ||
              soalBaru.jenis === "benar_salah" || soalBaru.jenis === "penjodohan") && (
              <div className="cbt-opsi-edit">
                <span className="cbt-opsi-judul">
                  {soalBaru.jenis === "penjodohan"
                    ? "Kolom jawaban (kanan), boleh diberi pengecoh yang tidak berpasangan"
                    : soalBaru.jenis === "pg_kompleks"
                      ? "Pilihan jawaban: tandai SEMUA yang benar, sisakan minimal satu pengecoh"
                      : "Pilihan jawaban: tekan lingkarannya untuk menandai kunci"}
                </span>
                {soalBaru.pilihan.map((p, i) => (
                  <div key={i} className="cbt-opsi-baris">
                    {soalBaru.jenis === "penjodohan" ? (
                      <span className="cbt-kunci cbt-kunci-mati">{String.fromCharCode(65 + i)}</span>
                    ) : (
                      <button
                        type="button"
                        className={`cbt-kunci ${
                          soalBaru.jenis === "pg_kompleks"
                            ? uraiKunciJamak(soalBaru.kunci).has(i) ? "on" : ""
                            : soalBaru.kunci === String(i) ? "on" : ""
                        }`}
                        onClick={() =>
                          soalBaru.jenis === "pg_kompleks"
                            ? tandaiKunciJamak(i)
                            : setSoalBaru({ ...soalBaru, kunci: String(i) })
                        }
                        title="Tandai sebagai kunci jawaban"
                      >
                        {String.fromCharCode(65 + i)}
                      </button>
                    )}
                    <input
                      value={p}
                      onChange={(e) => {
                        const berikut = [...soalBaru.pilihan];
                        berikut[i] = e.target.value;
                        setSoalBaru({ ...soalBaru, pilihan: berikut });
                      }}
                      placeholder={`Pilihan ${String.fromCharCode(65 + i)}`}
                    />
                    {soalBaru.jenis !== "benar_salah" && soalBaru.pilihan.length > 2 && (
                      <button type="button" className="cbt-buang" onClick={() => {
                        const berikut = soalBaru.pilihan.filter((_, n) => n !== i);
                        // Kunci dan pasangan ikut disetel ulang: keduanya
                        // menunjuk pilihan LEWAT NOMOR, dan menghapus satu
                        // pilihan menggeser seluruh nomor di bawahnya.
                        setSoalBaru({
                          ...soalBaru,
                          pilihan: berikut,
                          kunci: soalBaru.jenis === "pg_kompleks" ? "" : "0",
                          pasangan: soalBaru.pasangan.map((x) => ({
                            ...x,
                            kanan: x.kanan >= berikut.length ? 0 : x.kanan,
                          })),
                        });
                      }}>✕</button>
                    )}
                  </div>
                ))}
                {soalBaru.jenis !== "benar_salah" && soalBaru.pilihan.length < 8 && (
                  <button type="button" className="btn btn-light btn-mini" onClick={() => setSoalBaru({ ...soalBaru, pilihan: [...soalBaru.pilihan, ""] })}>
                    + Tambah pilihan
                  </button>
                )}
              </div>
            )}

            {/* ---------- PASANGAN PENJODOHAN ---------- */}
            {soalBaru.jenis === "penjodohan" && (
              <div className="cbt-opsi-edit">
                <span className="cbt-opsi-judul">Pasangan: kolom kiri dan jawaban yang benar</span>
                {soalBaru.pasangan.map((pas, i) => (
                  <div key={i} className="cbt-jodoh-edit">
                    <span className="cbt-jodoh-no">{i + 1}</span>
                    <input
                      value={pas.kiri}
                      onChange={(e) => {
                        const berikut = [...soalBaru.pasangan];
                        berikut[i] = { ...berikut[i], kiri: e.target.value };
                        setSoalBaru({ ...soalBaru, pasangan: berikut });
                      }}
                      placeholder={`Pertanyaan baris ${i + 1}`}
                    />
                    <select
                      value={String(pas.kanan)}
                      onChange={(e) => {
                        const berikut = [...soalBaru.pasangan];
                        berikut[i] = { ...berikut[i], kanan: Number(e.target.value) };
                        setSoalBaru({ ...soalBaru, pasangan: berikut });
                      }}
                    >
                      {soalBaru.pilihan.map((opsi, n) => (
                        <option key={n} value={String(n)}>
                          {String.fromCharCode(65 + n)}. {opsi.slice(0, 40) || "(kosong)"}
                        </option>
                      ))}
                    </select>
                    {soalBaru.pasangan.length > 2 && (
                      <button type="button" className="cbt-buang" onClick={() =>
                        setSoalBaru({ ...soalBaru, pasangan: soalBaru.pasangan.filter((_, n) => n !== i) })
                      }>✕</button>
                    )}
                  </div>
                ))}
                {soalBaru.pasangan.length < 10 && (
                  <button type="button" className="btn btn-light btn-mini" onClick={() =>
                    setSoalBaru({ ...soalBaru, pasangan: [...soalBaru.pasangan, { kiri: "", kanan: 0 }] })
                  }>
                    + Tambah pasangan
                  </button>
                )}
              </div>
            )}

            {soalBaru.jenis === "isian" && (
              <label className="cbt-lebar"><span>Kunci jawaban: pisahkan beberapa kemungkinan dengan |</span>
                <input value={soalBaru.kunci} onChange={(e) => setSoalBaru({ ...soalBaru, kunci: e.target.value })} placeholder="komunikasi massa|mass communication" />
              </label>
            )}

            {soalBaru.jenis === "essay" && (
              <p className="cbt-catatan">Essay dikoreksi pengajar di tab Monitoring &amp; nilai setelah ujian selesai.</p>
            )}

            <div className="cbt-form-aksi">
              <Tbl
                kabar={aksi.soal}
                diam={sunting ? "Simpan perubahan" : "+ Tambah ke bank soal"}
                mati={terkunci}
                onClick={() => void simpanSoal()}
              />
              {sunting && (
                <button type="button" className="btn btn-light" onClick={() => { setSunting(null); setSoalBaru({ ...SOAL_KOSONG }); }}>
                  Batal
                </button>
              )}
            </div>
          </div>

          {soal.length === 0 ? (
            <div className="dempty">Bank soal masih kosong.</div>
          ) : (
            <ol className="cbt-soal-daftar">
              {soal.map((s) => (
                <li key={s.id} className="cbt-soal-item">
                  <div className="cbt-soal-kepala">
                    <span className={`pill cbt-t-${s.tingkat}`}>{JENIS_LABEL[s.jenis]} · {s.bobot} poin</span>
                    <span className="cbt-soal-aksi">
                      <button type="button" disabled={terkunci} onClick={() => {
                        setSunting(s.id);
                        setSoalBaru({
                          ...s,
                          pilihan: s.pilihan.length ? s.pilihan : ["", ""],
                          pasangan: s.pasangan ?? [],
                          media: s.media ?? { ...MEDIA_KOSONG },
                        });
                        // Soal yang sudah bergambar dibuka lipatannya sendiri.
                        // Media yang tersembunyi di balik lipatan tertutup akan
                        // dikira tidak ada, lalu ikut terhapus tanpa disengaja.
                        if (s.media?.jenis && s.media.url) setBukaMedia(true);
                        // Formulirnya ada JAUH DI ATAS daftar ini. Tanpa kabar,
                        // yang menekan Ubah hanya melihat tombolnya berkedip
                        // dan mengira tekanannya tidak masuk.
                        kabari(`ubah-${s.id}`, "oke", "✓ Dibuka di formulir ↑", 2600);
                        setPesan("Soal dibuka pada formulir “Ubah soal” di atas daftar ini.");
                        setGalat("");
                      }}>
                        {aksi[`ubah-${s.id}`] ? aksi[`ubah-${s.id}`].teks : "Ubah"}
                      </button>
                      <button
                        type="button"
                        className={aksi[`soal-${s.id}`]?.keadaan === "gagal" ? "cbt-aksi-gagal" : ""}
                        disabled={terkunci || aksi[`soal-${s.id}`]?.keadaan === "jalan"}
                        onClick={() => void hapusSoal(s.id)}
                      >
                        {aksi[`soal-${s.id}`] ? aksi[`soal-${s.id}`].teks : "Hapus"}
                      </button>
                    </span>
                  </div>
                  <p className="cbt-soal-tanya">{s.pertanyaan}</p>
                  {s.media?.jenis && s.media.url && (
                    <p className="cbt-soal-media">
                      {s.media.jenis === "video" ? "🎬" : "🖼"} {s.media.keterangan || s.media.url}
                    </p>
                  )}
                  {s.pilihan.length > 0 && s.jenis !== "penjodohan" && (
                    <ul className="cbt-soal-opsi">
                      {s.pilihan.map((p, i) => {
                        const kunci = s.jenis === "pg_kompleks"
                          ? uraiKunciJamak(s.kunci).has(i)
                          : s.kunci === String(i);
                        return (
                          <li key={i} className={kunci ? "kunci" : ""}>
                            <b>{String.fromCharCode(65 + i)}.</b> {p}{kunci && <i> ← kunci</i>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {s.jenis === "penjodohan" && (
                    <ul className="cbt-soal-opsi">
                      {(s.pasangan || []).map((pas, i) => (
                        <li key={i} className="kunci">
                          <b>{i + 1}.</b> {pas.kiri} <i>↔ {s.pilihan[pas.kanan] ?? "-"}</i>
                        </li>
                      ))}
                      {s.pilihan.length > (s.pasangan || []).length && (
                        <li>
                          <i>
                            Pengecoh: {s.pilihan
                              .filter((_, n) => !(s.pasangan || []).some((pas) => pas.kanan === n))
                              .join(", ")}
                          </i>
                        </li>
                      )}
                    </ul>
                  )}
                  {s.jenis === "isian" && <p className="cbt-soal-kunci">Kunci: {s.kunci}</p>}
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <>
          {statistik && statistik.peserta > 0 && (
            <div className="psn-angka cbt-statistik">
              <div><b>{statistik.peserta}</b><span>selesai</span></div>
              <div><b>{statistik.rata}</b><span>rata-rata</span></div>
              <div><b>{statistik.tertinggi}</b><span>tertinggi</span></div>
              <div><b>{statistik.terendah}</b><span>terendah</span></div>
              <div><b>{statistik.persenLulus}%</b><span>lulus</span></div>
            </div>
          )}

          <div className="panel psn-panel">
            <div className="psn-kepala">
              <div>
                <b>Peserta</b>
                <span>
                  Menyegar sendiri tiap 10 detik selama tab ini terbuka.
                  {(() => {
                    const putus = peserta.filter(
                      (p) => p.status === "berjalan" && p.diamDetik !== null && p.diamDetik > AMBANG_TERPUTUS,
                    ).length;
                    return putus > 0
                      ? ` ${putus} peserta tampak terputus, layarnya tidak menyapa lebih dari semenit.`
                      : "";
                  })()}
                </span>
              </div>
              <span className="cbt-pantau-aksi">
                <Tbl
                  kabar={aksi.csv}
                  dasar="btn btn-light btn-mini"
                  diam="⇩ Unduh nilai (CSV)"
                  mati={peserta.length === 0}
                  onClick={() => void unduhNilai()}
                />
                <Tbl
                  kabar={aksi["acara-atas"]}
                  dasar="btn btn-light btn-mini"
                  diam="🖨 Berita acara"
                  mati={peserta.length === 0}
                  onClick={() => cetakBeritaAcara("acara-atas")}
                />
              </span>
            </div>

            {peserta.length === 0 ? (
              <div className="dempty">Belum ada yang masuk ke ujian ini.</div>
            ) : (
              <div className="qtable-wrap">
                <table className="qt">
                  <thead>
                    <tr><th>Mahasiswa / Peserta</th><th>Status</th><th>Progres</th><th>Sisa waktu</th><th>Nilai</th><th>Integritas</th><th /></tr>
                  </thead>
                  <tbody>
                    {peserta.map((p) => (
                      <tr key={p.id} className={bukaPeserta?.id === p.id ? "cbt-baris-buka" : ""}>
                        <td>
                          <b>{p.nama}</b><small className="psn-nama">{p.nim}</small>
                          {/* Perangkatnya disebut di bawah nama, bukan sebagai
                              kolom sendiri. Papan ini sudah tujuh kolom dan
                              dibaca sambil berjalan di antara meja; yang
                              dibutuhkan pengawas bukan daftar perangkat semua
                              orang, melainkan penanda pada baris yang
                              menyimpang.

                              Karena itu keduanya hanya muncul ketika memang ada
                              yang perlu dikatakan: gembok bila layarnya
                              benar-benar terkunci sistem, peringatan bila
                              ujiannya mewajibkan aplikasi tetapi peserta ini
                              masuk dari peramban — yang mungkin terjadi pada
                              peserta yang sudah mulai SEBELUM kewajibannya
                              dinyalakan. */}
                          {kunciSistem(rapikanKlien(p.klien)) ? (
                            <small className="cbt-klien-kunci">
                              🔒 {KLIEN_LABEL[rapikanKlien(p.klien)]}
                            </small>
                          ) : terbuka.requireLockdown ? (
                            <small className="cbt-putus">⚠ peramban biasa, layarnya tidak terkunci</small>
                          ) : null}
                        </td>
                        <td>
                          <span className={`pill cbt-p-${p.status}`}>
                            {labelStatusPeserta(p.status)}
                          </span>
                          {p.status === "berjalan" && p.diamDetik !== null && p.diamDetik > AMBANG_TERPUTUS && (
                            <small className="cbt-putus">⚠ terputus {Math.round(p.diamDetik / 60)} menit</small>
                          )}
                        </td>
                        <td>{p.terjawab}/{terbuka.questionCount || soal.length}</td>
                        <td>
                          {p.status === "berjalan" ? (
                            <span className={p.sisaDetik <= 300 ? "cbt-genting" : ""}>{ejaWaktu(p.sisaDetik)}</span>
                          ) : (
                            <small className="psn-nama">-</small>
                          )}
                        </td>
                        <td>
                          {p.nilai === null ? "-" : <b>{p.nilai}</b>}
                          {p.tertunda > 0 && <small className="psn-nama">{p.tertunda} essay menunggu</small>}
                        </td>
                        <td>
                          {/* Satu angka, bukan daftar pelanggaran.
                              Papan ini menampilkan ratusan baris sekaligus, dan
                              pengajar yang mengawas sedang berjalan di antara meja
                              — yang ia butuhkan adalah "baris mana yang perlu
                              saya lihat", bukan rincian yang hanya terbaca
                              sesudah ujiannya selesai. Rinciannya ada di lembar
                              jawaban peserta itu. */}
                          <SkorIntegritas
                            skor={p.integritas}
                            dihentikan={p.dihentikan}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`text-action${aksi[`lembar-${p.id}`]?.keadaan === "gagal" ? " cbt-aksi-gagal" : ""}`}
                            onClick={() => void bukaLembar(p)}
                            disabled={p.status === "berjalan" || aksi[`lembar-${p.id}`]?.keadaan === "jalan"}
                            title={p.status === "berjalan" ? "Menunggu sampai dikumpulkan" : "Buka lembar jawabannya"}
                          >
                            {aksi[`lembar-${p.id}`]
                              ? aksi[`lembar-${p.id}`].teks
                              : p.tertunda > 0 ? `Koreksi ${p.tertunda} essay` : "Lihat jawaban"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ---------- BERITA ACARA ---------- */}
          {peserta.length > 0 && (
            <div className="panel cbt-acara">
              <div className="cbt-impor-kepala">
                <b>Berita acara pelaksanaan</b>
                <span>
                  Kehadiran, pelanggaran, nilai, dan jam pengumpulan tiap peserta diambil
                  dari sistem. Isi tiga kolom di bawah.
                </span>
              </div>
              <div className="cbt-baris">
                <label><span>Nama pengawas</span>
                  <input value={acara.pengawas} onChange={(e) => setAcara({ ...acara, pengawas: e.target.value })} placeholder="Nama lengkap pengawas" />
                </label>
                <label><span>Ruang / moda</span>
                  <input value={acara.ruang} onChange={(e) => setAcara({ ...acara, ruang: e.target.value })} placeholder="Lab Komputer 2, kosongkan bila daring" />
                </label>
              </div>
              <label className="cbt-lebar"><span>Catatan kejadian selama ujian</span>
                <textarea rows={2} value={acara.catatan} onChange={(e) => setAcara({ ...acara, catatan: e.target.value })} placeholder="Mis. listrik padam 5 menit pukul 09.20; dua peserta terlambat masuk." />
              </label>
              <Tbl kabar={aksi.acara} diam="🖨 Buat berita acara" onClick={() => cetakBeritaAcara()} />
            </div>
          )}

          {/* ---------- LEMBAR JAWABAN & KOREKSI ESSAY ---------- */}
          {bukaPeserta && (
            <div className="panel psn-panel cbt-lembar">
              <div className="psn-kepala">
                <div>
                  <b>{bukaPeserta.nama}</b>
                  <span>
                    {bukaPeserta.nim} · {bukaPeserta.nilai === null ? "belum dinilai" : `nilai ${bukaPeserta.nilai}`}
                    {bukaPeserta.tertunda > 0 && ` · ${bukaPeserta.tertunda} essay menunggu koreksi`}
                  </span>
                </div>
                <span className="cbt-pantau-aksi">
                  <Tbl
                    kabar={aksi.laporan}
                    dasar="btn btn-light btn-mini"
                    diam="🖨 Cetak laporan"
                    mati={rincian.length === 0}
                    onClick={() => cetakLaporanPeserta()}
                  />
                  <button type="button" className="btn btn-light btn-mini" onClick={() => { setBukaPeserta(null); setRincian([]); setJejak([]); }}>
                    Tutup
                  </button>
                </span>
              </div>

              {/* ---------- LEMBAR PENGAWASAN ----------
                  Ditaruh DI ATAS lembar jawaban, bukan di bawahnya. Pengajar yang
                  membuka lembar seorang peserta untuk mengoreksi essay akan
                  membaca dari atas dan berhenti begitu koreksinya selesai;
                  catatan pengawasan yang tertinggal di kaki halaman tidak
                  pernah terbaca oleh orang yang paling perlu membacanya. */}
              {!muatRincian && (
                <section className="cbt-jaga-lembar">
                  <div className="cbt-jaga-kepala">
                    <b>Lembar pengawasan</b>
                    <SkorIntegritas skor={bukaPeserta.integritas} dihentikan={bukaPeserta.dihentikan} />
                  </div>
                  {bukaPeserta.dihentikan && (
                    <p className="cbt-jaga-putus">{bukaPeserta.dihentikan}</p>
                  )}
                  <p className="cbt-catatan">
                    Skor ini <b>bukan nilai</b> dan tidak pernah mengubah nilai ujian. Ia hanya
                    menandai lembar mana yang perlu dibaca lebih dulu. Yang memutuskan tetap Anda,
                    dengan garis waktu di bawah ini.
                  </p>
                  <GarisWaktu jejak={jejak} mulai={bukaPeserta.mulai} />
                </section>
              )}

              {muatRincian ? (
                <div className="dempty">Memuat lembar jawaban…</div>
              ) : rincian.length === 0 ? (
                <div className="dempty">Lembar jawabannya kosong.</div>
              ) : (
                <>
                  {/* Diberitahukan HANYA ketika pilihannya memang diacak.
                      Huruf yang tertulis pada lembar ini huruf bank soal —
                      sama dengan naskah cetak — sedangkan peserta melihat
                      urutan yang lain. Tanpa kalimat ini, pengajar yang
                      membandingkan lembar ini dengan layar peserta mengira
                      salah satunya keliru. */}
                  {terbuka.randomOptions && (
                    <p className="cbt-catatan">
                      Huruf pilihan di bawah mengikuti urutan <b>bank soal</b> —
                      sama dengan naskah cetak. Urutan pilihan di layar peserta
                      diacak, dan jawabannya sudah dikembalikan ke urutan bank
                      oleh sistem, dengan cara yang sama seperti ketika nilainya
                      dihitung.
                    </p>
                  )}
                  <ol className="cbt-lembar-daftar">
                    {rincian.map((r) => {
                      const belumDikoreksi = r.jenis === "essay" && r.benar === null;
                      return (
                        <li key={r.id} className={belumDikoreksi ? "cbt-perlu-koreksi" : ""}>
                          <div className="cbt-lembar-kepala">
                            <span className="cbt-lembar-nomor">Soal {r.nomor}</span>
                            <span className={`pill cbt-nilai-${keadaanJawab(r)}`}>
                              {KEADAAN_JAWAB_LABEL[keadaanJawab(r)]}
                            </span>
                            <span className="cbt-lembar-poin">{r.poin} / {r.bobot} poin</span>
                          </div>
                          <p className="cbt-soal-tanya">{r.pertanyaan}</p>

                          <div className="cbt-lembar-jawab">
                            <small>Jawaban peserta</small>
                            <p>{r.jawabanTeks || <i>tidak dijawab</i>}</p>
                          </div>

                          {r.kunciTeks !== "" && (
                            <p className="cbt-soal-kunci">Kunci: {r.kunciTeks}</p>
                          )}

                          {/* Kotak nilai hanya untuk essay, dan hanya bagi pengajar
                              pemiliknya — inilah satu-satunya jalan agar essay
                              yang dikerjakan peserta berhenti menggantung
                              sebagai "menunggu koreksi". */}
                          {r.jenis === "essay" && terbuka.bolehUbah && (
                            <div className="cbt-koreksi">
                              <label>
                                <span>Nilai (0–{r.bobot})</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={r.bobot}
                                  value={draftKoreksi[r.id]?.poin ?? "0"}
                                  onChange={(e) =>
                                    setDraftKoreksi((kini) => ({
                                      ...kini,
                                      [r.id]: { poin: e.target.value, catatan: kini[r.id]?.catatan ?? "" },
                                    }))
                                  }
                                />
                              </label>
                              <label className="cbt-koreksi-catatan">
                                <span>Catatan untuk peserta</span>
                                <input
                                  value={draftKoreksi[r.id]?.catatan ?? ""}
                                  onChange={(e) =>
                                    setDraftKoreksi((kini) => ({
                                      ...kini,
                                      [r.id]: { poin: kini[r.id]?.poin ?? "0", catatan: e.target.value },
                                    }))
                                  }
                                  placeholder="Boleh dikosongkan"
                                />
                              </label>
                              <Tbl
                                kabar={aksi[`koreksi-${r.id}`]}
                                dasar="btn btn-primary btn-mini"
                                diam="Simpan nilai"
                                onClick={() => void koreksi(r.id, r.bobot)}
                              />
                            </div>
                          )}

                          {r.catatan && <p className="cbt-lembar-catatan">Catatan pengajar: {r.catatan}</p>}
                        </li>
                      );
                    })}
                  </ol>
                </>
              )}
            </div>
          )}

          {analisis.some((a) => a.dijawab > 0) && (
            <div className="panel psn-panel">
              <div className="psn-kepala">
                <div>
                  <b>Analisis soal</b>
                  <span>
                    Benar di bawah 30% ditandai perlu ditinjau.
                  </span>
                </div>
              </div>
              <ul className="cbt-analisis">
                {analisis.filter((a) => a.dijawab > 0).map((a) => (
                  <li key={a.id} className={a.perluDitinjau ? "tinjau" : ""}>
                    <div className="cbt-analisis-bar"><span style={{ width: `${a.persen}%` }} /></div>
                    <div className="cbt-analisis-teks">
                      <b>{a.persen}% benar</b>
                      <span>{a.pertanyaan.slice(0, 90)}{a.pertanyaan.length > 90 ? "…" : ""}</span>
                      {a.perluDitinjau && <i>⚠ perlu ditinjau</i>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* ---------- JENDELA PENOLAKAN SOAL ----------
          Muncul menghalangi, dan hanya untuk penolakan. Pita merah di kepala
          panel sudah kalah jauh dari pandangan mata yang sedang menatap tombol
          di dasar formulir sepanjang layar, dan soal yang ditolak tanpa
          disadari baru ketahuan pada pagi hari ujian. */}
      {tolakSoal && (
        <div className="cbt-tirai" role="presentation" onClick={() => setTolakSoal(null)}>
          <div
            className="cbt-pop"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cbt-pop-judul"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cbt-pop-kepala">
              <b id="cbt-pop-judul">⚠ {tolakSoal.judul}</b>
              <button type="button" className="cbt-pop-tutup" onClick={() => setTolakSoal(null)} aria-label="Tutup">✕</button>
            </div>
            <p className="cbt-pop-lead">
              {tolakSoal.rincian.length > 1
                ? `Ada ${tolakSoal.rincian.length} hal yang perlu dibereskan dulu:`
                : "Satu hal yang perlu dibereskan dulu:"}
            </p>
            <ul className="cbt-pop-daftar">
              {tolakSoal.rincian.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <p className="cbt-catatan">
              Isian yang sudah diketik tidak hilang. Tutup jendela ini, perbaiki bagian yang
              disebut, lalu tekan tombolnya lagi.
            </p>
            <button type="button" className="btn btn-primary cbt-pop-oke" onClick={() => setTolakSoal(null)}>
              Mengerti, perbaiki dulu
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
