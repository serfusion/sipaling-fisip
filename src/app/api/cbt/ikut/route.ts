// ============================================================
// CBT — JALUR PESERTA (TANPA LOGIN)
//
// Ini satu-satunya jalur yang terbuka untuk umum, dan karena itu ia yang
// paling ketat aturannya:
//
//   1. KUNCI JAWABAN TIDAK PERNAH IKUT KELUAR sebelum ujiannya selesai. Yang
//      dikirim hanya pertanyaan dan pilihan yang sudah diacak.
//   2. WAKTU DIHITUNG DI SERVER. Jam di peramban peserta dapat diputar
//      mundur; kalau batasnya dihitung di sana, ujian enam puluh menit dapat
//      dikerjakan semalaman.
//   3. IDENTITASNYA MELEKAT PADA ATTEMPT, bukan pada akun. Sesudah masuk,
//      yang dipegang perambannya adalah kunci sesi acak — bukan nomor peserta, yang
//      dapat ditebak siapa pun yang tahu pola nomor induk kampus.
//
// GET  ?kode=XXXX      lihat ujian, sebelum masuk
// POST aksi=masuk      buat attempt, kembalikan soalnya
// POST aksi=lanjut     ambil kembali attempt yang tertunda
// POST aksi=jawab      auto-save satu jawaban
// POST aksi=selesai    kumpulkan dan nilai
// POST aksi=langgar    catat keluar fullscreen / pindah tab
// ============================================================
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { cbtAnswers, cbtAttempts, cbtExams, cbtIncidents } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { blockedByMaintenance } from "@/lib/maintenance-gate";
import {
  attemptHidup, attemptPelaksanaanIni, batasWaktu, benihBaru, bolehMasuk, hitungNilai,
  kunciNama, nilaiJawaban, periksaGanda, periksaMasuk, rapikanPerangkat, sisaDetik,
  statusUjian, susunPaket, type Soal,
} from "@/lib/cbt";
import { attemptDariKunci, bacaLembar, soalUjian, ujianDariKode, type Attempt, type Ujian } from "@/lib/cbt-store";
import {
  aturanMode, berat, harusDipaksa, jumlahBerat, kameraMenyala, pesanPeringatan,
  rapikanInsiden, rapikanMode,
  skorIntegritas, type HitunganInsiden, type JenisInsiden,
} from "@/lib/pengawasan";
import {
  bacaKlien, bolehMasukKlien, periksaKunciKlien, rapikanKlien, rapikanPerangkatKunci,
} from "@/lib/kunci-layar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Berapa angka minimal sebuah nomor peserta. Menahan salah ketik, bukan
 * memvalidasi.
 *
 * Medannya tetap bernama `nim` di kabel dan di basis data. Nama itu peninggalan
 * dan sengaja tidak diganti: mengubahnya adalah migrasi skema beserta perubahan
 * yang memutus API, tanpa satu pun keuntungan yang terlihat pengguna.
 */
const NOMOR_MIN = 6;

function kunciSesiBaru() {
  return randomBytes(24).toString("hex");
}

/** Keterangan ujian yang aman dilihat siapa pun — tanpa soal, tanpa kunci. */
function ringkasUjian(u: Ujian, sekarang: Date) {
  const status = statusUjian({ aktif: Boolean(u.activatedAt), mulai: u.startAt, selesai: u.endAt }, sekarang);
  return {
    kode: u.code,
    judul: u.title,
    mataKuliah: u.courseName,
    kelas: u.className,
    deskripsi: u.description,
    instruksi: u.instruction,
    durasi: u.durationMinutes,
    jumlahSoal: u.questionCount,
    pakaiToken: Boolean(u.token),
    bisaKembali: u.allowBack,
    tampilkanNilai: u.showScore,
    status,
    mulai: u.startAt ? u.startAt.toISOString() : null,
    selesai: u.endAt ? u.endAt.toISOString() : null,
    // Modenya saja yang dikirim, bukan daftar aturannya. Aturan tiap mode ada
    // di satu tempat (src/lib/pengawasan.ts) dan dibaca oleh kedua sisi, jadi
    // mengubah keketatan satu mode tidak menuntut peramban yang sedang terbuka
    // ikut diperbarui — dan tidak mungkin kedua sisi berbeda pendapat.
    pengawasan: rapikanMode(u.proctorMode),
    // Kecuali kamera. Ia punya saklarnya sendiri yang dipegang Admin, jadi
    // modenya saja tidak cukup untuk menjawab "menyala atau tidak".
    kamera: kameraMenyala(rapikanMode(u.proctorMode), u.cameraOn),
    // Ujian ini menuntut aplikasi Exam Browser.
    //
    // Dikirim sejak layar identitas, SEBELUM tombol Mulai ditekan, dan itu
    // penting: peserta yang baru mengetahuinya sesudah menekan Mulai sudah
    // duduk di ruang ujian dengan waktu berjalan, dan yang tersisa baginya
    // hanya memasang aplikasi di tengah ujian. Diberi tahu di layar identitas,
    // ia masih sempat mengunduhnya.
    wajibAplikasi: u.requireLockdown === true,
    perangkatAplikasi: rapikanPerangkatKunci(u.lockdownDevice),
  };
}

/**
 * Jenis perangkat yang dipakai peserta, sebagaimana dapat dilihat server.
 *
 * User-Agent didahulukan, dan pengakuan halaman hanya dipakai bila di sana
 * tidak ada penanda apa pun. Urutan itu penting karena aplikasi ujian
 * menyisipkan penandanya ke User-Agent seluruh permintaan — termasuk yang
 * dikirim sebelum satu baris JavaScript pun berjalan — sedangkan pengakuan
 * halaman hanya ada pada permintaan yang membawanya.
 *
 * PENGAKUAN INI BUKAN BUKTI, dan tidak pernah diperlakukan sebagai bukti.
 * Siapa pun dapat mengirim User-Agent apa pun dari alat baris perintah. Yang
 * menjaga gerbangnya bukan pembacaan ini melainkan kunci bersama yang dibawa
 * aplikasinya (CBT_KUNCI_APLIKASI), dan batas kekuatannya tertulis apa adanya
 * pada periksaKunciKlien di src/lib/kunci-layar.ts.
 */
function klienPermintaan(request: Request, diakui: unknown) {
  const dariUa = bacaKlien({ ua: request.headers.get("user-agent") });
  return dariUa === "peramban" ? rapikanKlien(diakui) : dariUa;
}

/**
 * Kunci bersama yang dipegang server, dari environment.
 *
 * Kosong berarti belum disetel, dan gerbangnya lalu bersandar pada pengenalan
 * perangkat saja — lemah, tetapi ada. Kampus yang belum menyiapkan
 * environment-nya mendapat penjagaan yang tidak sempurna, bukan ujian yang
 * menolak seluruh pesertanya pada pagi hari pelaksanaan.
 */
function kunciAplikasiServer() {
  return (process.env.CBT_KUNCI_APLIKASI || "").trim();
}

export async function GET(request: Request) {
  const batas = rateLimit({ request, name: "cbt-lihat", limit: 120, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const kode = String(new URL(request.url).searchParams.get("kode") || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12);
    if (!kode) return Response.json({ success: false, message: "Kode ujian belum diisi." }, { status: 400 });

    const ujian = await ujianDariKode(kode);
    // Ujian yang belum diaktifkan dijawab sama seperti ujian yang tidak ada.
    // Membedakan keduanya memberi tahu orang luar bahwa ada ujian di balik
    // kode itu, dan kode ujian memang dibagikan lewat grup kelas.
    if (!ujian || !ujian.activatedAt) {
      return Response.json({ success: false, message: "Ujian tidak ditemukan atau belum dibuka." }, { status: 404 });
    }
    return Response.json({ success: true, ujian: ringkasUjian(ujian, new Date()) });
  } catch (error: unknown) {
    console.error("lihat ujian cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Ujian belum dapat dibuka.") },
      { status: 500 },
    );
  }
}

/** Soal untuk layar peserta: pertanyaan dan pilihan saja. */
function lembarUntukLayar(bank: Soal[], lembar: Array<{ id: number; peta: number[] }>) {
  const peta = new Map(bank.map((s) => [s.id, s]));
  return lembar
    .map((item) => {
      const soal = peta.get(item.id);
      if (!soal) return null;
      return {
        id: soal.id,
        jenis: soal.jenis,
        pertanyaan: soal.pertanyaan,
        // Urutan pilihan mengikuti peta yang tersimpan pada attempt, supaya
        // memuat ulang halaman tidak mengubah letak jawaban yang sudah dipilih.
        pilihan: item.peta.length ? item.peta.map((i) => soal.pilihan[i] ?? "") : soal.pilihan,
        // Kolom kiri penjodohan. Hanya teksnya — pasangannya tertinggal di
        // server, tempat satu-satunya yang boleh mengetahui kuncinya.
        kiri: soal.jenis === "penjodohan" ? soal.pasangan.map((p) => p.kiri) : [],
        media: soal.media,
        bobot: soal.bobot,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
}

/**
 * Kolom penghitung untuk tiap jenis insiden.
 *
 * Dipisahkan dari mesin aturannya dengan sengaja: src/lib/pengawasan.ts tidak
 * boleh tahu apa-apa tentang basis data, supaya ia dapat diuji tanpa satu pun
 * sambungan. Yang ada di sini hanya pemetaan namanya.
 */
type KolomHitung =
  | "switchedTab" | "leftFullscreen" | "blurCount" | "copyAttempts" | "pasteAttempts"
  | "screenshotAttempts" | "rightClicks" | "devtoolsOpens" | "secondScreens"
  | "cameraOff" | "cameraCovered" | "cameraFrozen" | "faceMissing" | "otherPerson";

const KOLOM_INSIDEN: Record<JenisInsiden, KolomHitung> = {
  tab: "switchedTab",
  fullscreen: "leftFullscreen",
  blur: "blurCount",
  salin: "copyAttempts",
  tempel: "pasteAttempts",
  tangkap: "screenshotAttempts",
  klik_kanan: "rightClicks",
  devtools: "devtoolsOpens",
  layar_kedua: "secondScreens",
  kamera_mati: "cameraOff",
  kamera_tertutup: "cameraCovered",
  kamera_beku: "cameraFrozen",
  wajah_hilang: "faceMissing",
  orang_lain: "otherPerson",
};

/** Catatan pelanggaran yang sudah tersimpan pada satu attempt. */
function hitunganInsiden(a: Attempt): HitunganInsiden {
  return {
    tab: a.switchedTab,
    fullscreen: a.leftFullscreen,
    blur: a.blurCount,
    salin: a.copyAttempts,
    tempel: a.pasteAttempts,
    tangkap: a.screenshotAttempts,
    klik_kanan: a.rightClicks,
    devtools: a.devtoolsOpens,
    layar_kedua: a.secondScreens,
    kamera_mati: a.cameraOff,
    kamera_tertutup: a.cameraCovered,
    kamera_beku: a.cameraFrozen,
    wajah_hilang: a.faceMissing,
    orang_lain: a.otherPerson,
  };
}

/**
 * Nilai dan tutup satu attempt.
 *
 * Dipakai dua jalur: peserta yang menekan "kumpulkan", dan pengumpulan
 * PAKSA oleh aturan pengawasan. Keduanya harus melewati jalan yang sama persis
 * — attempt yang ditutup paksa tanpa dinilai akan muncul di rekap dengan nilai
 * nol, dan yang terlihat bukan "dihentikan pengawas" melainkan "menjawab semua
 * soal dengan salah".
 */
async function nilaiDanTutup(
  attempt: Attempt,
  ujian: Ujian,
  sekarang: Date,
  sebabPaksa: string | null,
) {
  const bank = await soalUjian(attempt.examId);
  const lembar = bacaLembar(attempt.paper);
  const dipakai = lembar
    .map((l) => bank.find((s) => s.id === l.id))
    .filter((s): s is Soal => Boolean(s));
  const petaPilihan = Object.fromEntries(lembar.map((l) => [l.id, l.peta]));

  const tersimpan = await db.select().from(cbtAnswers).where(eq(cbtAnswers.attemptId, attempt.id));
  const jawaban = Object.fromEntries(tersimpan.map((j) => [j.questionId, j.answer]));

  const ringkas = hitungNilai(dipakai, jawaban, petaPilihan, ujian.passingGrade);

  // Tiap jawaban ikut dinilai satu per satu, supaya pengajar dapat melihat mana
  // yang benar dan mana yang salah tanpa menghitung ulang.
  for (const soal of dipakai) {
    const isi = String(jawaban[soal.id] ?? "");
    const hasil = nilaiJawaban(soal, isi, petaPilihan[soal.id]);
    await db
      .insert(cbtAnswers)
      .values({
        attemptId: attempt.id, questionId: soal.id, answer: isi,
        isCorrect: hasil.benar, points: hasil.poin, updatedAt: sekarang,
      })
      .onConflictDoUpdate({
        target: [cbtAnswers.attemptId, cbtAnswers.questionId],
        set: { isCorrect: hasil.benar, points: hasil.poin, updatedAt: sekarang },
      });
  }

  const lewatWaktu = sekarang.getTime() > attempt.deadlineAt.getTime();
  await db
    .update(cbtAttempts)
    .set({
      status: lewatWaktu ? "waktu_habis" : "selesai",
      submittedAt: sekarang,
      score: Math.round(ringkas.nilai),
      correct: ringkas.benar,
      wrong: ringkas.salah,
      partial: ringkas.sebagian,
      blank: ringkas.kosong,
      pending: ringkas.tertunda,
      forcedReason: sebabPaksa,
      lastSeenAt: sekarang,
    })
    .where(eq(cbtAttempts.id, attempt.id));

  return ringkas;
}

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "cbt-ikut", limit: 600, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  const tutup = await blockedByMaintenance();
  if (tutup) return tutup;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const aksi = String(body.aksi || "");

    // ---------- MASUK ----------
    if (aksi === "masuk") {
      const kode = String(body.kode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
      const ujian = await ujianDariKode(kode);
      if (!ujian || !ujian.activatedAt) {
        return Response.json({ success: false, message: "Ujian tidak ditemukan atau belum dibuka." }, { status: 404 });
      }

      const sekarang = new Date();
      const status = statusUjian({ aktif: true, mulai: ujian.startAt, selesai: ujian.endAt }, sekarang);
      if (!bolehMasuk({ aktif: true, mulai: ujian.startAt, selesai: ujian.endAt }, sekarang)) {
        const pesan =
          status === "terjadwal"
            ? `Ujian belum dibuka. Mulai ${ujian.startAt?.toLocaleString("id-ID") ?? "-"}.`
            : "Ujian ini sudah ditutup.";
        return Response.json({ success: false, message: pesan, status }, { status: 409 });
      }

      const identitas = periksaMasuk(body, { token: ujian.token, nimMin: NOMOR_MIN });
      if (!identitas.ok) return Response.json({ success: false, message: identitas.pesan }, { status: 400 });

      // ---------- GERBANG APLIKASI TERKUNCI ----------
      //
      // Diperiksa SEBELUM attempt dibuat dan sebelum satu soal pun disusun.
      // Peserta yang ditolak di sini tidak boleh meninggalkan baris percobaan
      // yang menghabiskan jatahnya — ia belum mengerjakan apa pun, dan yang
      // perlu ia lakukan hanya membuka ujian yang sama dari aplikasinya.
      //
      // Ditempatkan sesudah pemeriksaan identitas dengan sengaja: nama yang
      // salah ketik dan kode pengawas yang keliru jauh lebih sering terjadi,
      // dan menyebut keduanya lebih dulu menghemat satu perjalanan bolak-balik
      // bagi peserta yang memang sudah memakai aplikasinya.
      const klien = klienPermintaan(request, body.klien);
      const izinKlien = bolehMasukKlien(
        ujian.requireLockdown === true,
        klien,
        periksaKunciKlien(kunciAplikasiServer(), body.kunciAplikasi),
        rapikanPerangkatKunci(ujian.lockdownDevice),
      );
      if (!izinKlien.ok) {
        return Response.json(
          { success: false, message: izinKlien.pesan, butuhAplikasi: true },
          { status: 403 },
        );
      }

      // Attempt yang masih berjalan dikembalikan apa adanya. Peserta yang
      // ponselnya mati lalu masuk lagi harus menemukan lembar yang SAMA,
      // dengan sisa waktu yang terus berjalan — bukan ujian baru yang kosong.
      const seluruhnya = await db
        .select()
        .from(cbtAttempts)
        .where(and(eq(cbtAttempts.examId, ujian.id), eq(cbtAttempts.nim, identitas.nim)));

      // JATAH PERCOBAAN BERLAKU PER PELAKSANAAN, bukan seumur hidup ujian.
      //
      // Ketika pengajar membuka kembali ujian yang sudah tutup — ujian susulan,
      // ujian ulang, atau jadwal yang digeser karena listrik padam — yang ia
      // mulai adalah pelaksanaan yang BARU. Percobaan dari pelaksanaan
      // sebelumnya tidak boleh ikut menghabiskan jatahnya; kalau ikut, ujian
      // yang sudah dijadwalkan ulang tetap menolak seluruh peserta yang
      // pernah masuk, dan pengajar tidak punya jalan lain selain menghapus hasil
      // lamanya.
      //
      // Batasnya JAM AKTIVASI, bukan jam mulai. Jam mulai tidak cukup: untuk
      // membuka ujian saat itu juga, pengajar justru menyetel jam mulai mundur ke
      // pagi hari, sehingga percobaan lama hari itu tetap berada di dalam
      // jendelanya dan pesertanya tetap tertolak. Jam aktivasi hanya maju
      // ketika ujiannya memang dibuka kembali — lihat pelaksanaanBaru di
      // src/app/api/cbt/aktivasi/route.ts.
      const sudah = attemptPelaksanaanIni(seluruhnya, ujian);

      // Lembar yang masih hidup dicari dari SELURUH riwayat, bukan dari
      // saringan di atas. Peserta yang sedang mengerjakan ketika pengajarnya
      // menambah waktu harus menemukan lembarnya kembali beserta sisa
      // waktunya; disaring lebih dulu, ia justru mendapat lembar baru yang
      // kosong dan jawaban yang sudah diketiknya seolah hilang.
      const berjalan = attemptHidup(seluruhnya, sekarang);
      if (berjalan) {
        const bank = await soalUjian(ujian.id);
        const lembar = bacaLembar(berjalan.paper);
        const jawaban = await db.select().from(cbtAnswers).where(eq(cbtAnswers.attemptId, berjalan.id));
        return Response.json({
          success: true,
          lanjut: true,
          kunciSesi: berjalan.sessionKey,
          ujian: ringkasUjian(ujian, sekarang),
          soal: lembarUntukLayar(bank, lembar),
          jawaban: Object.fromEntries(jawaban.map((j) => [j.questionId, j.answer])),
          ditandai: jawaban.filter((j) => j.marked).map((j) => j.questionId),
          sisaDetik: sisaDetik(berjalan.deadlineAt, sekarang),
        });
      }

      // ---------- SATU ORANG, SATU KALI ----------
      // Diperiksa SESUDAH jalur "lanjutkan yang masih berjalan" di atas,
      // supaya peserta yang kembali ke ujiannya sendiri tidak pernah
      // tertahan oleh pemeriksaan yang ditujukan kepada orang lain.
      if (sudah.length >= ujian.maxAttempts) {
        return Response.json(
          {
            success: false,
            message:
              ujian.maxAttempts === 1
                ? "Nomor peserta ini sudah mengerjakan ujian tersebut. Satu kali percobaan saja."
                : `Nomor peserta ini sudah memakai ${sudah.length} dari ${ujian.maxAttempts} percobaan.`,
          },
          { status: 409 },
        );
      }

      // Nama dan perangkat diperiksa terhadap SELURUH peserta ujian ini, bukan
      // hanya terhadap nomor yang sama. Kolomnya sengaja sedikit: daftar peserta
      // dapat berisi ratusan baris, dan lembar soal masing-masing tidak ada
      // gunanya di sini.
      const nameKey = kunciNama(identitas.nama);
      const deviceId = rapikanPerangkatKunci(body.perangkat);
      const semua = await db
        .select({
          nim: cbtAttempts.nim,
          nameKey: cbtAttempts.nameKey,
          deviceId: cbtAttempts.deviceId,
          status: cbtAttempts.status,
          startedAt: cbtAttempts.startedAt,
        })
        .from(cbtAttempts)
        .where(eq(cbtAttempts.examId, ujian.id));

      // Disaring ke pelaksanaan yang sedang berlaku, dengan alasan yang sama
      // seperti jatah percobaan di atas: satu komputer laboratorium yang
      // dipakai kemarin tidak boleh memblokir orang lain pada pelaksanaan hari
      // ini, dan nama yang sudah terdaftar pada ujian yang sudah lewat bukan
      // pendaftaran ganda.
      const sesiIni = attemptPelaksanaanIni(semua, ujian);
      const ganda = periksaGanda({ nim: identitas.nim, nameKey, deviceId }, sesiIni, {
        satuPerangkat: ujian.singleDevice,
      });
      if (!ganda.ok) {
        return Response.json({ success: false, message: ganda.pesan }, { status: 409 });
      }

      const bank = await soalUjian(ujian.id);
      if (bank.length === 0) {
        return Response.json({ success: false, message: "Ujian ini belum berisi soal." }, { status: 409 });
      }

      const benih = benihBaru();
      const paket = susunPaket(
        bank,
        {
          acakSoal: ujian.randomQuestions,
          acakPilihan: ujian.randomOptions,
          jumlahSoal: ujian.questionCount,
        },
        benih,
      );
      const lembar = paket.map((s) => ({ id: s.id, peta: s.petaPilihan }));
      const deadline = batasWaktu(sekarang, ujian.durationMinutes, ujian.endAt);
      const kunciSesi = kunciSesiBaru();

      try {
        await db.insert(cbtAttempts).values({
          examId: ujian.id,
          nim: identitas.nim,
          name: identitas.nama,
          nameKey,
          deviceId,
          // Nomor percobaan dihitung dari SELURUH riwayat, bukan dari jendela
          // ini saja. Indeks unik (ujian, nim, nomor) menolak nomor yang
          // terpakai, dan memulai lagi dari 1 pada pelaksanaan berikutnya akan
          // menabrak baris lama — persis pada saat peserta menekan Mulai.
          attemptNo: seluruhnya.reduce((n, a) => Math.max(n, a.attemptNo), 0) + 1,
          sessionKey: kunciSesi,
          seed: benih,
          paper: JSON.stringify(lembar),
          startedAt: sekarang,
          deadlineAt: deadline,
          lastSeenAt: sekarang,
          clientType: klien,
        });
      } catch {
        // Indeks unik (ujian, nim, percobaan) menolak dua permintaan yang
        // datang bersamaan. Yang kalah membaca attempt yang barusan menang.
        const ulang = await db
          .select()
          .from(cbtAttempts)
          .where(and(eq(cbtAttempts.examId, ujian.id), eq(cbtAttempts.nim, identitas.nim)));
        const hidup = attemptHidup(ulang, sekarang);
        if (!hidup) {
          return Response.json({ success: false, message: "Ujian belum dapat dimulai. Coba lagi." }, { status: 500 });
        }
        return Response.json({
          success: true,
          lanjut: true,
          kunciSesi: hidup.sessionKey,
          ujian: ringkasUjian(ujian, sekarang),
          soal: lembarUntukLayar(bank, bacaLembar(hidup.paper)),
          jawaban: {},
          sisaDetik: sisaDetik(hidup.deadlineAt, sekarang),
        });
      }

      return Response.json({
        success: true,
        lanjut: false,
        kunciSesi,
        ujian: ringkasUjian(ujian, sekarang),
        soal: paket.map((s) => ({
          id: s.id, jenis: s.jenis, pertanyaan: s.pertanyaan, pilihan: s.pilihan,
          kiri: s.kiri, media: s.media, bobot: s.bobot,
        })),
        jawaban: {},
        sisaDetik: sisaDetik(deadline, sekarang),
      });
    }

    // ---------- SEMUA AKSI DI BAWAH MENUNTUT KUNCI SESI ----------
    const kunciSesi = String(body.kunciSesi || "");
    const attempt = await attemptDariKunci(kunciSesi);
    if (!attempt) {
      return Response.json({ success: false, message: "Sesi ujian tidak dikenali." }, { status: 401 });
    }
    const sekarang = new Date();

    // ---------- LANJUT ----------
    if (aksi === "lanjut") {
      const ujianRow = await db.select().from(cbtExams).where(eq(cbtExams.id, attempt.examId)).limit(1);
      const ujian = ujianRow[0];
      if (!ujian) return Response.json({ success: false, message: "Ujian tidak ditemukan." }, { status: 404 });

      // Gerbang yang sama seperti pada "masuk", dan ia HARUS ada juga di sini.
      // Tanpanya, jalan memutarnya terbuka lebar: mulai ujian dari aplikasi
      // terkunci, salin kunci sesinya, lalu lanjutkan dari peramban biasa yang
      // tidak menolak tangkapan layar apa pun.
      const klienLanjut = klienPermintaan(request, body.klien);
      // Kunci aplikasinya TIDAK diperiksa lagi di sini, dan itu keputusan
      // sadar. Kunci sampai ke halaman lewat objek yang disuntikkan aplikasi
      // sesudah dokumennya dimuat, sedangkan pemulihan sesi berjalan pada
      // gambar pertama — kadang beberapa ratus milidetik lebih dulu. Memeriksa
      // keduanya di sini berarti sesekali menolak peserta yang memang sedang
      // memakai aplikasinya, tepat ketika ia baru saja kehilangan halaman
      // ujiannya. Yang tetap diperiksa adalah perangkatnya, dan itu terbaca
      // dari User-Agent yang selalu ada sejak permintaan pertama.
      const izinLanjut = bolehMasukKlien(
        ujian.requireLockdown === true, klienLanjut, true,
        rapikanPerangkatKunci(ujian.lockdownDevice),
      );
      if (!izinLanjut.ok) {
        return Response.json(
          { success: false, message: izinLanjut.pesan, butuhAplikasi: true },
          { status: 403 },
        );
      }

      const bank = await soalUjian(attempt.examId);
      const jawaban = await db.select().from(cbtAnswers).where(eq(cbtAnswers.attemptId, attempt.id));
      void db
        .update(cbtAttempts)
        // Perangkatnya ikut diperbarui, bukan hanya jam sapaannya. Peserta yang
        // berpindah dari peramban ke aplikasi di tengah ujian — atau
        // sebaliknya — harus terbaca apa adanya pada lembar pengawasan, karena
        // itulah yang ditanyakan bila hasilnya digugat.
        .set({ lastSeenAt: sekarang, clientType: klienLanjut })
        .where(eq(cbtAttempts.id, attempt.id))
        .catch(() => undefined);
      return Response.json({
        success: true,
        selesai: attempt.status !== "berjalan",
        ujian: ringkasUjian(ujian, sekarang),
        soal: lembarUntukLayar(bank, bacaLembar(attempt.paper)),
        jawaban: Object.fromEntries(jawaban.map((j) => [j.questionId, j.answer])),
        ditandai: jawaban.filter((j) => j.marked).map((j) => j.questionId),
        sisaDetik: sisaDetik(attempt.deadlineAt, sekarang),
      });
    }

    if (attempt.status !== "berjalan") {
      return Response.json({ success: false, message: "Ujian ini sudah dikumpulkan." }, { status: 409 });
    }

    // ---------- DENYUT ----------
    // Peramban peserta menyapa tiap sepuluh detik. Dua gunanya, dan
    // dua-duanya penting: papan pantau pengajar dapat membedakan "sedang
    // mengerjakan" dari "layarnya mati sejak sepuluh menit lalu", dan sisa
    // waktu yang berlaku — yang dihitung SERVER — dikembalikan untuk
    // meluruskan jam di perambannya.
    if (aksi === "denyut") {
      await db.update(cbtAttempts).set({ lastSeenAt: sekarang }).where(eq(cbtAttempts.id, attempt.id));
      return Response.json({ success: true, sisaDetik: sisaDetik(attempt.deadlineAt, sekarang) });
    }

    // ---------- CATAT PELANGGARAN ----------
    //
    // Yang dikerjakan di sini tiga hal, dan urutannya bukan kebetulan:
    // BUKTINYA ditulis lebih dulu, baru ringkasannya diperbarui, baru
    // akibatnya dijalankan. Kalau salah satu langkah berikutnya gagal, yang
    // tersisa tetap catatan kejadiannya — dan itu bagian yang tidak boleh
    // hilang.
    if (aksi === "langgar") {
      const jenis = rapikanInsiden(body.jenis);
      if (!jenis) {
        return Response.json({ success: false, message: "Jenis pelanggaran tidak dikenali." }, { status: 400 });
      }

      const ujianRow = await db.select().from(cbtExams).where(eq(cbtExams.id, attempt.examId)).limit(1);
      const ujian = ujianRow[0];
      if (!ujian) return Response.json({ success: false, message: "Ujian tidak ditemukan." }, { status: 404 });
      const mode = rapikanMode(ujian.proctorMode);

      // Keterangan dari peramban dipotong pendek dan dibersihkan. Ia masuk ke
      // basis data dan dibaca kembali di layar pengajar, jadi ia diperlakukan
      // sebagai kiriman orang luar — karena memang begitulah asalnya.
      const detail = String(body.detail ?? "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200) || null;

      await db.insert(cbtIncidents).values({
        attemptId: attempt.id,
        kind: jenis,
        // Jam SERVER. Jam yang dikirim peramban tidak dipercaya di sini
        // dengan alasan yang sama seperti batas waktu ujian: ia dapat diputar.
        at: sekarang,
        detail,
      });

      // Penghitungnya ditambah oleh BASIS DATA, bukan dihitung di sini lalu
      // ditulis balik. Dua pelanggaran yang tercatat dalam detik yang sama —
      // dan itu justru yang terjadi saat peserta panik menekan apa saja — akan
      // membaca angka lama yang sama pula, lalu yang satu menimpa yang lain.
      //
      // Angka yang KEMBALI dari perintah itu yang dipakai menghitung skor,
      // bukan angka yang terbaca di awal permintaan. Selisihnya kecil dan
      // jarang, tetapi skor yang dihitung dari angka basi adalah angka yang
      // salah pada laporan yang justru dibaca ketika hasil ujian digugat.
      const kolom = KOLOM_INSIDEN[jenis];
      const sesudah = await db
        .update(cbtAttempts)
        .set({
          [kolom]: sql`${cbtAttempts[kolom]} + 1`,
          lastSeenAt: sekarang,
        })
        .where(eq(cbtAttempts.id, attempt.id))
        .returning();

      const hitungan = sesudah[0] ? hitunganInsiden(sesudah[0]) : hitunganInsiden(attempt);
      const skor = skorIntegritas(hitungan);
      await db
        .update(cbtAttempts)
        .set({ integrityScore: skor })
        .where(eq(cbtAttempts.id, attempt.id));

      // ---------- PENGUMPULAN PAKSA ----------
      // Ambangnya milik modenya — tiga pada Sertifikasi, lima pada Ketat,
      // tidak pernah pada Biasa — dan yang menghitung mundur hanya pelanggaran
      // yang memang disengaja; blur dan klik kanan tidak pernah ikut.
      //
      // Keputusannya dibuat DI SINI, di server, dan itu bukan kebetulan. Kalau
      // halaman yang memutuskannya, peserta yang mematikan JavaScript-nya
      // mendapat ujian yang tidak pernah berakhir sendiri — dan yang tercatat
      // di server tetap "bersih".
      if (harusDipaksa(mode, hitungan)) {
        const sebab = `Dihentikan pengawasan: ${jenis} melampaui batas pelanggaran mode ${mode}.`;
        await nilaiDanTutup(attempt, ujian, sekarang, sebab);
        return Response.json({
          success: true,
          skor,
          dipaksa: true,
          pesan: pesanPeringatan(mode, jenis, hitungan),
        });
      }

      // `keras` menentukan bentuk teguran di layar: pelanggaran yang ikut
      // menghitung mundur mendapat kotak yang menutup soal dan harus diakui
      // pesertanya, yang ringan cukup pita yang menghilang sendiri.
      //
      // `nomor` adalah pelanggaran berat KE BERAPA, bukan sisa jatahnya.
      // Batas pengumpulan paksa sengaja tidak pernah ikut dikirim: apa pun
      // yang sampai ke peramban dapat dibaca peserta di alat pengembang, dan
      // peserta yang tahu batasnya akan membelanjakannya sampai satu ketukan
      // sebelum habis.
      const keras = berat(jenis) && aturanMode(mode).batasPaksa > 0;
      return Response.json({
        success: true,
        skor,
        dipaksa: false,
        keras,
        nomor: keras ? jumlahBerat(hitungan) : 0,
        pesan: pesanPeringatan(mode, jenis, hitungan),
      });
    }

    // ---------- TANDAI UNTUK DITINJAU ----------
    if (aksi === "tandai") {
      const questionId = Number(body.soal);
      const lembar = bacaLembar(attempt.paper);
      if (!lembar.some((l) => l.id === questionId)) {
        return Response.json({ success: false, message: "Soal ini bukan bagian dari lembar Anda." }, { status: 400 });
      }
      const tandai = body.tandai !== false;
      await db
        .insert(cbtAnswers)
        .values({ attemptId: attempt.id, questionId, answer: "", marked: tandai, updatedAt: sekarang })
        .onConflictDoUpdate({
          target: [cbtAnswers.attemptId, cbtAnswers.questionId],
          // HANYA kolom penanda yang disentuh. Menulis ulang answer di sini
          // akan menghapus jawaban yang sudah diketik peserta hanya karena
          // ia menandai soalnya untuk ditinjau.
          set: { marked: tandai, updatedAt: sekarang },
        });
      return Response.json({ success: true, ditandai: tandai });
    }

    // ---------- AUTO-SAVE ----------
    if (aksi === "jawab") {
      // Lewat batas waktu, jawaban baru TIDAK diterima lagi — tetapi yang
      // sudah tersimpan tetap dihitung. Menolak dengan galat membuat peserta
      // menyangka seluruh pekerjaannya hilang.
      if (sekarang.getTime() > attempt.deadlineAt.getTime()) {
        return Response.json({ success: false, habis: true, message: "Waktu ujian sudah habis." }, { status: 409 });
      }

      const questionId = Number(body.soal);
      const lembar = bacaLembar(attempt.paper);
      if (!lembar.some((l) => l.id === questionId)) {
        return Response.json({ success: false, message: "Soal ini bukan bagian dari lembar Anda." }, { status: 400 });
      }
      const jawaban = String(body.jawaban ?? "").slice(0, 8000);

      await db
        .insert(cbtAnswers)
        .values({ attemptId: attempt.id, questionId, answer: jawaban, updatedAt: sekarang })
        .onConflictDoUpdate({
          target: [cbtAnswers.attemptId, cbtAnswers.questionId],
          set: { answer: jawaban, updatedAt: sekarang },
        });
      await db.update(cbtAttempts).set({ lastSeenAt: sekarang }).where(eq(cbtAttempts.id, attempt.id));

      return Response.json({ success: true, sisaDetik: sisaDetik(attempt.deadlineAt, sekarang) });
    }

    // ---------- KUMPULKAN ----------
    if (aksi === "selesai") {
      const ujianRow = await db.select().from(cbtExams).where(eq(cbtExams.id, attempt.examId)).limit(1);
      const ujian = ujianRow[0];
      if (!ujian) return Response.json({ success: false, message: "Ujian tidak ditemukan." }, { status: 404 });

      const ringkas = await nilaiDanTutup(attempt, ujian, sekarang, null);

      return Response.json({
        success: true,
        // Nilai hanya ditampilkan bila pengajarnya mengizinkan. Sebagian ujian
        // memang diumumkan belakangan, dan itu keputusan pengajarnya.
        tampilkanNilai: ujian.showScore,
        hasil: ujian.showScore
          ? {
              nilai: ringkas.nilai, benar: ringkas.benar, salah: ringkas.salah,
              // Ikut dikirim sejak ada PG kompleks dan penjodohan. Tanpa
              // angka ini, peserta yang benar sebagian pada dua soal
              // membaca "1 benar, 0 salah" dari empat soal — dan dua soal
              // sisanya seolah lenyap.
              sebagian: ringkas.sebagian,
              kosong: ringkas.kosong, tertunda: ringkas.tertunda,
              lulus: ringkas.lulus, passing: ujian.passingGrade,
            }
          : null,
      });
    }

    return Response.json({ success: false, message: "Aksi tidak dikenali." }, { status: 400 });
  } catch (error: unknown) {
    console.error("jalur ujian cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Ujian belum dapat diproses.") },
      { status: 500 },
    );
  }
}
