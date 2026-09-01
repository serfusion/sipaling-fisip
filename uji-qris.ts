// UJI QRIS — bagian yang menentukan ke mana uang orang mengalir.
//
// Yang diperiksa di sini bukan "kodenya jalan", melainkan: apakah CRC-nya sama
// persis dengan yang dipakai standar, apakah nominalnya tertanam di tag yang
// benar, dan apakah QRIS yang cacat DITOLAK alih-alih ditebak. Salah satu saja
// meleset, QR-nya baru ketahuan tidak bisa dipindai di depan kasir — atau
// lebih buruk, terpindai dengan nominal yang keliru.

import {
  crc16, uraiTlv, pasangCrc, bacaQris, periksaQris, jadikanDinamis,
  STATIS, DINAMIS, TAG,
} from "./src/lib/qris";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

console.log("\n=== CRC16 ===\n");

// Nilai uji baku CRC-16/CCITT-FALSE. Angka ini bukan karangan: seluruh dunia
// memakai "123456789" -> 0x29B1 untuk memastikan polinomial, nilai awal,
// pembalikan bit, dan XOR penutupnya sudah benar. Kalau baris ini lulus,
// CRC kita memang CRC yang diminta QRIS.
sama("CRC-16/CCITT-FALSE atas \"123456789\"", crc16("123456789"), "29B1");
sama("CRC teks kosong", crc16(""), "FFFF");
sama("CRC selalu empat huruf", crc16("A").length, 4);
sama("CRC memakai huruf kapital", crc16("halo"), crc16("halo").toUpperCase());

console.log("\n=== URAI TLV ===\n");

// QRIS statis contoh, disusun sendiri supaya tidak ada data merchant sungguhan
// di dalam gudang ini. Panjang tiap TLV dihitung, tidak diketik: panjang yang
// salah ketik justru cacat yang paling sering menyelinap pada berkas uji QRIS.
const t = (tag: string, nilai: string) => `${tag}${String(nilai.length).padStart(2, "0")}${nilai}`;
const ISI_STATIS = [
  t("00", "01"),
  t("01", STATIS),
  t("26", t("00", "ID.CO.QRIS.WWW") + t("01", "ID2023263025057") + t("03", "UMI")),
  t("51", t("00", "ID.CO.QRIS.WWW") + t("01", "ID1020036465885") + t("03", "UMI")),
  t("52", "5945"),
  t("53", "360"),
  t("58", "ID"),
  t("59", "Naufal Shop 1"),
  t("60", "Kab. Tangerang"),
  t("61", "15710"),
].join("");
const STATIS_CONTOH = pasangCrc(ISI_STATIS);

const tlv = uraiTlv(STATIS_CONTOH);
benar("QRIS contoh dapat diurai", tlv !== null);
sama("tag pertama Payload Format Indicator", tlv?.[0].tag, "00");
sama("metode awal terbaca statis", tlv?.find((t) => t.tag === TAG.metodeAwal)?.nilai, STATIS);
sama("tag terakhir CRC", tlv?.[tlv.length - 1].tag, TAG.crc);
benar("QRIS contoh sah menurut pemeriksa", periksaQris(STATIS_CONTOH).sah, periksaQris(STATIS_CONTOH).alasan);

// Yang rusak harus DITOLAK, bukan ditebak.
benar("panjang melebihi sisa teks ditolak", uraiTlv("00029") === null);
benar("tag bukan angka ditolak", uraiTlv("XX0201") === null);
benar("teks kosong ditolak", uraiTlv("") === null);
benar("CRC salah ditolak", !periksaQris(STATIS_CONTOH.slice(0, -4) + "0000").sah);
benar("teks terpotong ditolak", !periksaQris(STATIS_CONTOH.slice(0, 20)).sah);
benar("bukan QRIS sama sekali ditolak", !periksaQris("halo dunia").sah);

console.log("\n=== BACA KETERANGAN ===\n");

const baca = bacaQris(STATIS_CONTOH);
sama("nama merchant", baca?.merchant, "Naufal Shop 1");
sama("kota", baca?.kota, "Kab. Tangerang");
sama("kode pos", baca?.kodePos, "15710");
sama("kategori", baca?.kategori, "5945");
sama("mata uang 360 (rupiah)", baca?.mataUang, "360");
sama("negara", baca?.negara, "ID");
sama("terbaca statis", baca?.dinamis, false);
sama("statis tidak punya nominal", baca?.nominal, "");

console.log("\n=== UBAH MENJADI DINAMIS ===\n");

const ubah = jadikanDinamis(STATIS_CONTOH, 25037);
benar("konversi berhasil", ubah.ok, ubah.ok ? "" : ubah.pesan);
if (ubah.ok) {
  const hasil = bacaQris(ubah.qris);
  sama("metode awal berubah menjadi dinamis", hasil?.dinamis, true);
  sama("nominal tertanam persis", hasil?.nominal, "25037");
  benar("CRC dihitung ulang dan sah", periksaQris(ubah.qris).sah, periksaQris(ubah.qris).alasan);
  benar("CRC-nya BERBEDA dari QRIS asal", ubah.qris.slice(-4) !== STATIS_CONTOH.slice(-4));

  // Keterangan merchant tidak boleh ikut berubah. Kalau berubah, uangnya
  // berpindah tujuan — kegagalan paling mahal yang mungkin terjadi di sini.
  sama("merchant tetap", hasil?.merchant, baca?.merchant);
  sama("kota tetap", hasil?.kota, baca?.kota);
  sama("kode pos tetap", hasil?.kodePos, baca?.kodePos);
  benar(
    "seluruh keterangan penerbit tetap utuh",
    ubah.qris.includes(t("00", "ID.CO.QRIS.WWW") + t("01", "ID1020036465885")),
  );

  // Tag wajib menaik. Aplikasi pembayaran tertentu menolak urutan yang kacau.
  const tagUbah = (uraiTlv(ubah.qris) ?? []).map((t) => t.tag).filter((t) => t !== TAG.crc);
  benar("urutan tag tetap menaik", tagUbah.every((t, i) => i === 0 || t >= tagUbah[i - 1]),
    tagUbah.join(","));
  sama("nominal duduk di tag 54", uraiTlv(ubah.qris)?.find((t) => t.tag === "54")?.nilai, "25037");
}

// Nominal yang tidak masuk akal ditolak sebelum QR terbentuk.
for (const [nama, nilai] of [["nol", 0], ["minus", -5], ["pecahan", 1500.5], ["NaN", NaN]] as const) {
  benar(`nominal ${nama} ditolak`, !jadikanDinamis(STATIS_CONTOH, nilai as number).ok);
}
benar("nominal kepanjangan ditolak", !jadikanDinamis(STATIS_CONTOH, 12345678901234).ok);
benar("QRIS asal yang cacat ditolak", !jadikanDinamis("bukan qris", 10000).ok);

console.log("\n=== BIAYA LAYANAN ===\n");

const bTetap = jadikanDinamis(STATIS_CONTOH, 25000, { jenis: "tetap", nilai: 1000 });
benar("biaya tetap berhasil", bTetap.ok, bTetap.ok ? "" : bTetap.pesan);
if (bTetap.ok) {
  const d = uraiTlv(bTetap.qris) ?? [];
  sama("penanda biaya 02 (tetap)", d.find((t) => t.tag === TAG.penandaBiaya)?.nilai, "02");
  sama("nilai biaya tetap", d.find((t) => t.tag === TAG.biayaTetap)?.nilai, "1000");
  benar("CRC tetap sah dengan biaya", periksaQris(bTetap.qris).sah);
}

const bPersen = jadikanDinamis(STATIS_CONTOH, 25000, { jenis: "persen", nilai: 5 });
if (bPersen.ok) {
  const d = uraiTlv(bPersen.qris) ?? [];
  sama("penanda biaya 03 (persen)", d.find((t) => t.tag === TAG.penandaBiaya)?.nilai, "03");
  sama("nilai biaya persen", d.find((t) => t.tag === TAG.biayaPersen)?.nilai, "5");
}
benar("persen di atas 100 ditolak", !jadikanDinamis(STATIS_CONTOH, 25000, { jenis: "persen", nilai: 150 }).ok);
benar("biaya tetap nol ditolak", !jadikanDinamis(STATIS_CONTOH, 25000, { jenis: "tetap", nilai: 0 }).ok);

// Mengubah QRIS yang SUDAH dinamis tidak boleh menumpuk biaya lama.
if (bTetap.ok) {
  const lagi = jadikanDinamis(bTetap.qris, 30000);
  benar("konversi ulang berhasil", lagi.ok);
  if (lagi.ok) {
    const d = uraiTlv(lagi.qris) ?? [];
    sama("nominal tergantikan, bukan bertumpuk", d.filter((t) => t.tag === "54").length, 1);
    sama("nominal baru", d.find((t) => t.tag === "54")?.nilai, "30000");
    benar("biaya lama ikut terbuang", !d.some((t) => t.tag === TAG.biayaTetap));
    benar("CRC tetap sah", periksaQris(lagi.qris).sah);
  }
}

console.log("\n=== NOMINAL BERBEDA, QR BERBEDA ===\n");

// Nominal unik menjadi penanda pesanan, jadi dua nominal berbeda wajib
// menghasilkan rentetan berbeda — termasuk yang cuma beda satu rupiah.
const a = jadikanDinamis(STATIS_CONTOH, 25037);
const b = jadikanDinamis(STATIS_CONTOH, 25038);
benar("beda satu rupiah menghasilkan QRIS berbeda", a.ok && b.ok && a.qris !== b.qris);
benar("keduanya tetap sah", a.ok && b.ok && periksaQris(a.qris).sah && periksaQris(b.qris).sah);
if (a.ok) {
  const ulang = jadikanDinamis(STATIS_CONTOH, 25037);
  benar("nominal sama selalu menghasilkan rentetan sama", ulang.ok && ulang.qris === a.qris);
}

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
