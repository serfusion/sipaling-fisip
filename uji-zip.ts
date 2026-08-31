import { buatZip, crc32, namaAman, ukuranTerbaca } from "./src/lib/zip";

let gagal = 0;
const ok = (n: string, s: boolean, i = "") => { console.log(`${s ? "  ✓" : "  ✗"} ${n}${i ? ` — ${i}` : ""}`); if (!s) gagal++; };
const enc = (t: string) => new TextEncoder().encode(t);

console.log("\n=== CRC32 ===\n");
// Nilai baku yang tercantum pada spesifikasi.
ok("crc32(\"\") = 0", crc32(new Uint8Array()) === 0);
ok("crc32(\"123456789\") = 0xCBF43926", crc32(enc("123456789")) === 0xcbf43926,
   "0x" + crc32(enc("123456789")).toString(16).toUpperCase());
ok("crc32(\"a\") = 0xE8B7BE43", crc32(enc("a")) === 0xe8b7be43);

console.log("\n=== BENTUK ARSIP ===\n");
async function jalan() {
  const isi = [
    { nama: "2021001 Rina Kartika/1-cover.pdf", data: enc("%PDF-1.7 cover") },
    { nama: "2021001 Rina Kartika/4-full.pdf", data: enc("%PDF-1.7 full skripsi") },
    { nama: "daftar.csv", data: enc("nim,nama\n2021001,Rina Kartika\n") },
  ];
  const blob = buatZip(isi, new Date("2026-08-25T10:30:00"));
  const buf = new Uint8Array(await blob.arrayBuffer());
  ok("jenis blob zip", blob.type === "application/zip");
  ok("diawali tanda kepala lokal PK\\x03\\x04",
     buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04);
  const ekor = buf.slice(-22);
  ok("diakhiri tanda akhir direktori PK\\x05\\x06",
     ekor[0] === 0x50 && ekor[1] === 0x4b && ekor[2] === 0x05 && ekor[3] === 0x06);
  const dv = new DataView(buf.buffer, buf.length - 22, 22);
  ok("jumlah entri tercatat tiga", dv.getUint16(10, true) === 3, String(dv.getUint16(10, true)));
  const awalPusat = dv.getUint32(16, true);
  ok("letak direktori pusat masuk akal", awalPusat > 0 && awalPusat < buf.length);
  ok("tanda direktori pusat ada di letaknya",
     buf[awalPusat] === 0x50 && buf[awalPusat + 1] === 0x4b && buf[awalPusat + 2] === 0x01);
  ok("bendera UTF-8 dinyalakan", new DataView(buf.buffer, 6, 2).getUint16(0, true) === 0x0800);
  ok("metode simpan, bukan deflate", new DataView(buf.buffer, 8, 2).getUint16(0, true) === 0);
  const isiSeluruh = new TextDecoder().decode(buf);
  ok("nama berkas tersimpan apa adanya", isiSeluruh.includes("2021001 Rina Kartika/1-cover.pdf"));
  ok("isi berkas tersimpan apa adanya", isiSeluruh.includes("%PDF-1.7 full skripsi"));

  ok("arsip kosong tidak meledak", (await buatZip([]).arrayBuffer()).byteLength === 22);

  console.log("\n=== NAMA AMAN ===\n");
  ok("huruf terlarang Windows dibuang", namaAman('Rina/Kartika:Sari*?"<>|') === "Rina Kartika Sari");
  ok("nama kosong diberi bawaan", namaAman("") === "tanpa-nama");
  ok("spasi berlebih dirapikan", namaAman("  Budi   Santoso  ") === "Budi Santoso");
  ok("dipotong sesuai batas", namaAman("a".repeat(200), 20).length === 20);
  ok("ukuran terbaca", ukuranTerbaca(1536) === "2 KB" && ukuranTerbaca(5 * 1024 * 1024) === "5.0 MB",
     `${ukuranTerbaca(1536)} / ${ukuranTerbaca(5 * 1024 * 1024)}`);

  console.log(gagal ? `\n${gagal} UJI GAGAL\n` : "\nSEMUA UJI LULUS\n");
  process.exit(gagal ? 1 : 0);
}
void jalan();
