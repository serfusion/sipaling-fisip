// UJI BENTUK UNGGAHAN & REVISI — berapa berkas, dan apakah benar menggantikan.
//
// Yang dijaga di sini adalah kesalahan yang sudah terjadi sungguhan:
// penyerahan skripsi ke perpustakaan mengunggah EMPAT PDF saat mengajukan,
// tetapi formulir revisinya hanya meminta SATU .docx. Tiga bagian yang lain
// tidak pernah tergantikan, dan admin memeriksa campuran antara berkas lama
// dan berkas baru tanpa ada yang memberi tahu bahwa itu yang sedang terjadi.
//
// Bagian bentuk unggahan murni perhitungan dan selalu jalan. Bagian yang
// menyentuh basis data hanya jalan bila DATABASE_URL diisi.

import { bentukUnggah, jumlahBerkas, periksaBerkasTunggal, periksaSemuaBerkas } from "./src/lib/bentuk-unggah";
import { BAGIAN_PENYERAHAN, PENYERAHAN_NEED, PENYERAHAN_NEED_LAMA, ABSENSI_NEED } from "./src/lib/bukti-penyerahan";
import { audienceUntukLayanan } from "./src/lib/notify";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

const pdf = (mb = 1) => ({ name: "berkas.pdf", size: mb * 1024 * 1024 });
const docx = (mb = 1) => ({ name: "naskah.docx", size: mb * 1024 * 1024 });

console.log("\n=== BENTUK UNGGAHAN ===\n");

const serah = bentukUnggah("Layanan Perpustakaan", PENYERAHAN_NEED);
sama("penyerahan skripsi memakai bentuk bagian", serah.jenis, "bagian");
sama("jumlahnya empat", jumlahBerkas(serah), 4);
sama("jumlahnya sama dengan daftar bagiannya", jumlahBerkas(serah), BAGIAN_PENYERAHAN.length);

// Nama lama masih dipakai tiket yang sudah tersebar sebelum namanya diganti.
sama("nama kebutuhan yang lama juga empat berkas",
  jumlahBerkas(bentukUnggah("Layanan Perpustakaan", PENYERAHAN_NEED_LAMA)), 4);

// INI INTINYA: revisi harus meminta jumlah yang SAMA dengan pengajuannya.
sama("revisi penyerahan juga empat berkas",
  jumlahBerkas(bentukUnggah("Layanan Perpustakaan", PENYERAHAN_NEED, true)), 4);
benar("bentuk revisi dan bentuk pengajuan sejenis",
  bentukUnggah("Layanan Perpustakaan", PENYERAHAN_NEED, true).jenis ===
    bentukUnggah("Layanan Perpustakaan", PENYERAHAN_NEED).jenis);

const absen = bentukUnggah("Layanan Perpustakaan", ABSENSI_NEED);
sama("absensi tidak memuat berkas", absen.jenis, "tanpa");
sama("jumlahnya nol", jumlahBerkas(absen), 0);

const ta = bentukUnggah("Layanan Tugas Akhir", "Bimbingan Skripsi");
sama("tugas akhir satu berkas", ta.jenis, "tunggal");
sama("wajib docx", ta.jenis === "tunggal" ? ta.ekstensi.join(",") : "", ".docx");
benar("tugas akhir wajib berlampiran", ta.jenis === "tunggal" && ta.wajib);

const pddikti = bentukUnggah("Layanan PDDIKTI", "Perbaikan Data");
sama("PDDIKTI wajib PDF", pddikti.jenis === "tunggal" ? pddikti.ekstensi.join(",") : "", ".pdf");

// Lampiran yang OPSIONAL saat mengajukan menjadi WAJIB saat merevisi: revisi
// tanpa berkas baru tidak mengubah apa pun yang dapat diperiksa admin.
const umum = bentukUnggah("Layanan Umum", "Surat Keterangan");
const umumRevisi = bentukUnggah("Layanan Umum", "Surat Keterangan", true);
benar("lampiran layanan umum opsional saat mengajukan", umum.jenis === "tunggal" && !umum.wajib);
benar("tetapi wajib saat merevisi", umumRevisi.jenis === "tunggal" && umumRevisi.wajib);

console.log("\n=== PEMERIKSAAN BERKAS ===\n");

if (ta.jenis === "tunggal") {
  benar("docx diterima untuk tugas akhir", periksaBerkasTunggal(ta, docx()).ok);
  benar("pdf ditolak untuk tugas akhir", !periksaBerkasTunggal(ta, pdf()).ok);
  benar("kosong ditolak karena wajib", !periksaBerkasTunggal(ta, null).ok);
  benar("melebihi 10 MB ditolak", !periksaBerkasTunggal(ta, docx(11)).ok);
}
if (umum.jenis === "tunggal") {
  benar("kosong diterima ketika opsional", periksaBerkasTunggal(umum, null).ok);
}
if (umumRevisi.jenis === "tunggal") {
  benar("kosong ditolak ketika revisi", !periksaBerkasTunggal(umumRevisi, null).ok);
}

// Empat bagian: kurang satu pun ditolak, dan pesannya menyebut bagian mana.
const lengkap: Record<string, { name: string; size: number }> = {};
for (const b of BAGIAN_PENYERAHAN) lengkap[`bagian_${b.id}`] = pdf();
benar("empat bagian lengkap diterima", periksaSemuaBerkas(serah, (n) => lengkap[n] ?? null).ok);

for (const b of BAGIAN_PENYERAHAN) {
  const kurang = { ...lengkap };
  delete kurang[`bagian_${b.id}`];
  const hasil = periksaSemuaBerkas(serah, (n) => kurang[n] ?? null);
  benar(`kurang bagian "${b.id}" ditolak`, !hasil.ok);
  benar(`pesannya menyebut "${b.label}"`, !hasil.ok && hasil.pesan.includes(b.label), !hasil.ok ? hasil.pesan : "");
}

// Batas ukuran per bagian berbeda: yang full boleh 25 MB, sisanya 10 MB.
const besar: Record<string, { name: string; size: number }> = { ...lengkap, bagian_isi: { name: "isi.pdf", size: 12 * 1024 * 1024 } };
benar("bagian isi 12 MB ditolak", !periksaSemuaBerkas(serah, (n) => besar[n] ?? null).ok);
const fullBesar: Record<string, { name: string; size: number }> = { ...lengkap, bagian_full: { name: "full.pdf", size: 20 * 1024 * 1024 } };
benar("bagian full 20 MB diterima", periksaSemuaBerkas(serah, (n) => fullBesar[n] ?? null).ok);
const fullTerlalu: Record<string, { name: string; size: number }> = { ...lengkap, bagian_full: { name: "full.pdf", size: 30 * 1024 * 1024 } };
benar("bagian full 30 MB ditolak", !periksaSemuaBerkas(serah, (n) => fullTerlalu[n] ?? null).ok);

// Bukan PDF ditolak, sebab keempat bagian memang harus PDF.
const salahJenis: Record<string, { name: string; size: number }> = { ...lengkap, bagian_cover: { name: "cover.docx", size: 1024 } };
benar("bagian berformat docx ditolak", !periksaSemuaBerkas(serah, (n) => salahJenis[n] ?? null).ok);

console.log("\n=== ALAMAT NOTIFIKASI ===\n");

// Notifikasi tanpa alamat yang benar sama saja dengan tidak ada: pengajuan
// perpustakaan yang dialamatkan ke prodi tidak pernah terlihat oleh orang
// yang harus mengerjakannya.
sama("perpustakaan ke admin_perpustakaan", audienceUntukLayanan("Layanan Perpustakaan"), "admin_perpustakaan");
sama("PDDIKTI ke admin_pddikti", audienceUntukLayanan("Layanan PDDIKTI"), "admin_pddikti");
sama("prodi ke admin_prodi", audienceUntukLayanan("Layanan Prodi"), "admin_prodi");
sama("akademik ke admin_akademik", audienceUntukLayanan("Layanan Akademik"), "admin_akademik");
sama("umum ke admin_umum", audienceUntukLayanan("Layanan Umum"), "admin_umum");
sama("laboratorium ke admin_laboratorium", audienceUntukLayanan("Layanan Laboratorium"), "admin_laboratorium");
// Tugas akhir tidak punya unit sendiri; yang memeriksanya dosen tujuan.
sama("tugas akhir jatuh ke admin", audienceUntukLayanan("Layanan Tugas Akhir"), "admin");
sama("layanan tak dikenal jatuh ke admin", audienceUntukLayanan("Layanan Entah Apa"), "admin");
benar("tidak ada layanan yang kehilangan alamat",
  ["Layanan Umum", "Layanan Akademik", "Layanan Prodi", "Layanan PDDIKTI",
   "Layanan Perpustakaan", "Layanan Laboratorium", "Layanan Tugas Akhir"]
    .every((t) => audienceUntukLayanan(t).length > 0));

// Top-level await tidak tersedia pada keluaran CJS, jadi penutupnya dibungkus.
bagianBasisData()
  .then(() => {
    console.log(`\n${lulus} periksa lulus`);
    if (gagal.length > 0) {
      console.error(`\n${gagal.length} GAGAL:`);
      gagal.forEach((g) => console.error("  ✗ " + g));
      process.exit(1);
    }
    console.log("SEMUA UJI LULUS");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nUJI BERHENTI:", error);
    process.exit(1);
  });

// ============================================================
// BAGIAN YANG MENYENTUH BASIS DATA
//
// Hanya jalan bila DATABASE_URL diisi:
//
//   DATABASE_URL=postgres://postgres@127.0.0.1:5433/uji npx tsx uji-revisi.ts
//
// Impornya dilakukan di dalam fungsi, bukan di kepala berkas, supaya
// menjalankan uji ini tanpa Postgres tidak menyeret lapisan basis data sama
// sekali.
// ============================================================
async function bagianBasisData() {
  if (!process.env.DATABASE_URL) {
    console.log("\n=== PENGGANTIAN LAMPIRAN ===\n");
    console.log("DATABASE_URL kosong — bagian ini dilewati.");
    return;
  }

  const { db } = await import("./src/db");
  const { requestAttachments, revisionUploads, serviceRequests } = await import("./src/db/schema");
  const { eq, asc } = await import("drizzle-orm");
  const { gantiLampiranRevisi } = await import("./src/lib/revisi-store");

  console.log("\n=== PENGGANTIAN LAMPIRAN ===\n");

  const tiket = `PSN-UJI-${Date.now().toString(36).toUpperCase()}`;
  const dibuat = await db
    .insert(serviceRequests)
    .values({
      ticket: tiket,
      nim: "2100000001",
      studentName: "Mahasiswa Uji",
      studyProgram: "Ilmu Komunikasi",
      serviceType: "Layanan Perpustakaan",
      serviceNeed: PENYERAHAN_NEED,
      title: "Uji penggantian berkas revisi",
      status: "Revisi",
    })
    .returning({ id: serviceRequests.id });
  const requestId = dibuat[0].id;

  const lampiranAwal = BAGIAN_PENYERAHAN.map((b, i) => ({
    requestId,
    part: b.id,
    label: b.label,
    sortOrder: i,
    fileName: `lama-${b.id}.pdf`,
    fileMime: "application/pdf",
    fileSize: 1024,
    fileStoragePath: `requests/${tiket}/lama-${b.id}.pdf`,
  }));
  await db.insert(requestAttachments).values(lampiranAwal);

  const bacaLampiran = async () =>
    db
      .select()
      .from(requestAttachments)
      .where(eq(requestAttachments.requestId, requestId))
      .orderBy(asc(requestAttachments.sortOrder));

  sama("pengajuan awal punya empat lampiran", (await bacaLampiran()).length, 4);

  const jalurLama = await gantiLampiranRevisi({
    requestId,
    nim: "2100000001",
    revisionNumber: 1,
    note: "Sudah diperbaiki",
    baru: BAGIAN_PENYERAHAN.map((b, i) => ({
      part: b.id,
      label: b.label,
      sortOrder: i,
      fileName: `revisi1-${b.id}.pdf`,
      fileMime: "application/pdf",
      fileSize: 2048,
      fileStoragePath: `revisions/${tiket}/revisi1-${b.id}.pdf`,
    })),
  });

  const sesudah = await bacaLampiran();
  // INI YANG DILAPORKAN RUSAK: sesudah revisi harus tetap EMPAT berkas, dan
  // keempatnya yang baru — bukan delapan yang bercampur dengan yang lama.
  sama("sesudah revisi tetap empat lampiran", sesudah.length, 4);
  benar("semuanya berkas revisi, bukan yang lama",
    sesudah.every((a) => a.fileName.startsWith("revisi1-")),
    sesudah.map((a) => a.fileName).join(", "));
  benar("keempat bagiannya lengkap dan urut",
    sesudah.map((a) => a.part).join(",") === BAGIAN_PENYERAHAN.map((b) => b.id).join(","),
    sesudah.map((a) => a.part).join(","));

  // Jalur berkas lama dikembalikan supaya pemanggilnya dapat menghapusnya.
  sama("empat jalur lama dikembalikan untuk dihapus", jalurLama.length, 4);
  benar("jalurnya memang milik berkas lama", jalurLama.every((p) => p.includes("lama-")));

  // Riwayatnya tidak lenyap: revisi ke-0 menyimpan berkas pengajuan awal.
  const riwayat = await db
    .select()
    .from(revisionUploads)
    .where(eq(revisionUploads.requestId, requestId));
  sama("riwayat berisi delapan baris (4 awal + 4 revisi)", riwayat.length, 8);
  sama("empat di antaranya revisi ke-0", riwayat.filter((r) => r.revisionNumber === 0).length, 4);
  sama("empat lainnya revisi ke-1", riwayat.filter((r) => r.revisionNumber === 1).length, 4);
  benar("bagian mana yang diganti ikut tercatat",
    riwayat.every((r) => BAGIAN_PENYERAHAN.some((b) => b.id === r.part)));

  const tiketSesudah = await db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.id, requestId));
  sama("nomor revisinya naik", tiketSesudah[0].revisionCount, 1);
  // Kembali ke antrean supaya ada yang memeriksanya lagi.
  sama("statusnya kembali Masuk", tiketSesudah[0].status, "Masuk");
  sama("status administratif disetel ulang", tiketSesudah[0].administrativeStatus, "Belum Dicek");
  sama("catatan mahasiswanya tersimpan", tiketSesudah[0].studentNote, "Sudah diperbaiki");

  // Revisi kedua: tidak boleh menambah baris revisi ke-0 untuk kedua kalinya.
  await gantiLampiranRevisi({
    requestId,
    nim: "2100000001",
    revisionNumber: 2,
    note: null,
    baru: BAGIAN_PENYERAHAN.map((b, i) => ({
      part: b.id,
      label: b.label,
      sortOrder: i,
      fileName: `revisi2-${b.id}.pdf`,
      fileMime: "application/pdf",
      fileSize: 4096,
      fileStoragePath: `revisions/${tiket}/revisi2-${b.id}.pdf`,
    })),
  });
  const dua = await bacaLampiran();
  sama("revisi kedua tetap empat lampiran", dua.length, 4);
  benar("isinya berkas revisi kedua", dua.every((a) => a.fileName.startsWith("revisi2-")));
  const riwayat2 = await db
    .select()
    .from(revisionUploads)
    .where(eq(revisionUploads.requestId, requestId));
  sama("revisi ke-0 tetap empat, tidak berlipat", riwayat2.filter((r) => r.revisionNumber === 0).length, 4);
  sama("riwayat menjadi dua belas baris", riwayat2.length, 12);

  await db.delete(serviceRequests).where(eq(serviceRequests.id, requestId));

  // ---------- SIAPA MELIHAT NOTIFIKASI YANG MANA ----------
  console.log("\n=== LONCENG ===\n");

  const { notifications, lecturers } = await import("./src/db/schema");
  const { audienceFilter } = await import("./src/lib/notifikasi-audiens");

  await db.delete(notifications);
  // Notifikasi beralamat dosen menunjuk baris dosen sungguhan, jadi dosennya
  // dibuat dulu — batas kunci asingnya memang bagian dari yang diuji.
  const dosenUji = await db
    .insert(lecturers)
    .values({ name: "Dosen Uji", studyProgram: "Ilmu Komunikasi" })
    .returning({ id: lecturers.id });
  const dosenId = dosenUji[0].id;
  await db.insert(notifications).values([
    { audienceRole: "admin_perpustakaan", kind: "pengajuan-baru", title: "Perpus", body: "x" },
    { audienceRole: "admin_pddikti", kind: "pengajuan-baru", title: "PDDIKTI", body: "x" },
    { audienceRole: "admin_prodi", kind: "pengajuan-baru", title: "Prodi", body: "x" },
    { audienceRole: "admin", kind: "pengajuan-baru", title: "Tugas akhir", body: "x" },
    { lecturerId: dosenId, kind: "pengajuan-baru", title: "Untuk dosen", body: "x" },
  ]);

  const terlihat = async (profil: { role: string; lecturerId: number | null }) => {
    const f = audienceFilter(profil);
    if (!f) return [];
    const baris = await db.select({ title: notifications.title }).from(notifications).where(f);
    return baris.map((b) => b.title).sort();
  };

  // INI YANG DILAPORKAN RUSAK: Super Admin tidak melihat notifikasi sama
  // sekali padahal pengajuan terus masuk, karena filternya cuma admin_prodi.
  const sa = await terlihat({ role: "super_admin", lecturerId: null });
  sama("super admin melihat keempat notifikasi role", sa.length, 4);
  benar("termasuk yang untuk perpustakaan", sa.includes("Perpus"), sa.join(", "));
  benar("termasuk yang untuk PDDIKTI", sa.includes("PDDIKTI"));
  benar("tetapi bukan yang beralamat dosen", !sa.includes("Untuk dosen"));

  sama("admin juga melihat keempatnya", (await terlihat({ role: "admin", lecturerId: null })).length, 4);

  // Admin unit hanya melihat miliknya sendiri — meja orang lain bukan urusannya.
  const perpus = await terlihat({ role: "admin_perpustakaan", lecturerId: null });
  sama("admin perpustakaan melihat satu", perpus.length, 1);
  sama("dan itu miliknya sendiri", perpus[0], "Perpus");

  const prodi = await terlihat({ role: "admin_prodi", lecturerId: null });
  sama("admin prodi melihat satu", prodi.length, 1);
  sama("dan itu miliknya sendiri", prodi[0], "Prodi");

  // Dosen hanya melihat yang beralamat dirinya, bukan notifikasi unit mana pun.
  const dosen = await terlihat({ role: "dosen", lecturerId: dosenId });
  sama("dosen melihat satu", dosen.length, 1);
  sama("dan itu miliknya", dosen[0], "Untuk dosen");
  sama("dosen lain tidak melihat apa-apa", (await terlihat({ role: "dosen", lecturerId: dosenId + 1000 })).length, 0);
  sama("dosen tanpa kartu dosen tidak melihat apa-apa",
    (await terlihat({ role: "dosen", lecturerId: null })).length, 0);

  await db.delete(notifications);
  await db.delete(lecturers).where(eq(lecturers.id, dosenId));
}
