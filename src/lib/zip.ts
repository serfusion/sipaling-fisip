// PEMBUAT ZIP SEDERHANA — MODE SIMPAN, TANPA PEMAMPATAN
//
// Dipakai dashboard untuk membungkus berkas skripsi menjadi satu arsip yang
// langsung turun ke komputer admin.
//
// KENAPA DITULIS SENDIRI, BUKAN MEMAKAI PUSTAKA:
// Isi arsipnya hampir seluruhnya PDF, yang sudah termampat. Memampatkannya
// lagi hanya menghabiskan waktu dan memori untuk penghematan di bawah satu
// persen. Mode simpan sudah cukup, dan kodenya jadi sependek ini.
//
// KENAPA DI PERAMBAN, BUKAN DI SERVER:
// Fungsi serverless punya batas memori dan waktu jalan. Membungkus arsip
// ratusan MB di sana akan gagal di tengah jalan. Peramban tidak punya batas
// itu, dan hasilnya mendarat langsung di komputer admin, yang memang tujuannya.

const tabelCrc = (() => {
  const tabel = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabel[i] = c >>> 0;
  }
  return tabel;
})();

export function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = tabelCrc[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Blob hanya menerima larik yang berlandas ArrayBuffer, bukan ArrayBufferLike
// yang juga mencakup SharedArrayBuffer. Dinyatakan tegas di sini supaya
// ketidakcocokannya ketahuan di tempat berkasnya dibuat, bukan di sini.
export type Bita = Uint8Array<ArrayBuffer>;

export type IsiZip = { nama: string; data: Bita };

/** Ubah waktu menjadi pasangan tanggal-jam bergaya MS-DOS yang dipakai ZIP. */
function waktuDos(d: Date) {
  const tahun = Math.max(1980, d.getFullYear());
  return {
    waktu: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    tanggal: ((tahun - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function tulis(dv: DataView, pos: number, nilai: number, byte: 2 | 4) {
  if (byte === 2) dv.setUint16(pos, nilai, true);
  else dv.setUint32(pos, nilai, true);
}

/**
 * Bungkus daftar berkas menjadi satu Blob ZIP.
 *
 * Nama berkas dikodekan UTF-8 dan bendera bit 11 dinyalakan, supaya nama
 * berhuruf non-ASCII tidak berubah menjadi karakter aneh ketika arsipnya
 * dibuka di Windows.
 */
export function buatZip(isi: IsiZip[], waktu = new Date()): Blob {
  const { waktu: jam, tanggal } = waktuDos(waktu);
  const potongan: BlobPart[] = [];
  const pusat: Bita[] = [];
  let geser = 0;

  for (const berkas of isi) {
    const nama = new TextEncoder().encode(berkas.nama);
    const crc = crc32(berkas.data);
    const ukuran = berkas.data.length;

    const kepala = new Uint8Array(30 + nama.length);
    const dv = new DataView(kepala.buffer);
    tulis(dv, 0, 0x04034b50, 4); // tanda kepala lokal
    tulis(dv, 4, 20, 2); // versi minimal
    tulis(dv, 6, 0x0800, 2); // bendera: nama berkas UTF-8
    tulis(dv, 8, 0, 2); // metode: simpan
    tulis(dv, 10, jam, 2);
    tulis(dv, 12, tanggal, 2);
    tulis(dv, 14, crc, 4);
    tulis(dv, 18, ukuran, 4); // ukuran termampat
    tulis(dv, 22, ukuran, 4); // ukuran asli
    tulis(dv, 26, nama.length, 2);
    tulis(dv, 28, 0, 2); // panjang bidang tambahan
    kepala.set(nama, 30);

    potongan.push(kepala, berkas.data);

    const pusatSatu = new Uint8Array(46 + nama.length);
    const pv = new DataView(pusatSatu.buffer);
    tulis(pv, 0, 0x02014b50, 4); // tanda direktori pusat
    tulis(pv, 4, 20, 2); // versi pembuat
    tulis(pv, 6, 20, 2); // versi minimal
    tulis(pv, 8, 0x0800, 2);
    tulis(pv, 10, 0, 2);
    tulis(pv, 12, jam, 2);
    tulis(pv, 14, tanggal, 2);
    tulis(pv, 16, crc, 4);
    tulis(pv, 20, ukuran, 4);
    tulis(pv, 24, ukuran, 4);
    tulis(pv, 28, nama.length, 2);
    tulis(pv, 42, geser, 4); // letak kepala lokal
    pusatSatu.set(nama, 46);
    pusat.push(pusatSatu);

    geser += kepala.length + ukuran;
  }

  const awalPusat = geser;
  let panjangPusat = 0;
  for (const p of pusat) {
    potongan.push(p);
    panjangPusat += p.length;
  }

  const akhir = new Uint8Array(22);
  const av = new DataView(akhir.buffer);
  tulis(av, 0, 0x06054b50, 4);
  tulis(av, 8, isi.length, 2);
  tulis(av, 10, isi.length, 2);
  tulis(av, 12, panjangPusat, 4);
  tulis(av, 16, awalPusat, 4);
  potongan.push(akhir);

  return new Blob(potongan, { type: "application/zip" });
}

/** Buang huruf yang tidak boleh ada pada nama berkas maupun map di Windows. */
export function namaAman(teks: string, maks = 80) {
  const bersih = (teks || "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maks);
  return bersih || "tanpa-nama";
}

/** Ukuran berkas dalam satuan yang enak dibaca. */
export function ukuranTerbaca(byte: number) {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(0)} KB`;
  if (byte < 1024 * 1024 * 1024) return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
  return `${(byte / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
