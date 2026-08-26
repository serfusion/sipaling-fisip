// KERANGKA BERPIKIR DAN HIPOTESIS
//
// Bagan kerangka berpikir adalah salah satu bagian yang paling sering
// disuruh ulang oleh pembimbing, biasanya karena panah dan nomor hipotesisnya
// tidak sejalan dengan rumusan masalah. Di sini keduanya disusun dari
// variabel yang sama, sehingga tidak mungkin berselisih.
//
// Penomoran mengikuti urutan yang lazim pada skripsi Indonesia: pengaruh
// langsung tiap variabel bebas lebih dulu, lalu variabel antara, lalu
// pengaruh tidak langsung, dan terakhir pengaruh serentak.

import type { Masukan } from "./metodologi";

export type Jalur = {
  kode: string;
  dari: string;
  ke: string;
  lewat?: string;
  bunyi: string;
  jenis: "langsung" | "tak-langsung" | "serentak";
};

export type Kotak = { id: string; label: string; peran: "bebas" | "antara" | "terikat" };

export type Kerangka = {
  kotak: Kotak[];
  jalur: Jalur[];
  adaAntara: boolean;
  /** Rumusan masalah yang selaras dengan tiap jalur. */
  rumusan: string[];
};

function bersih(t: string | undefined, bawaan: string) {
  const b = (t ?? "").trim();
  return b || bawaan;
}

/**
 * Susun bagan kerangka berpikir beserta hipotesisnya.
 *
 * Bentuknya mengikuti jumlah variabel yang diisi mahasiswa, bukan satu
 * cetakan tetap: satu X tanpa variabel antara menghasilkan bagan sederhana,
 * dua X dengan variabel antara menghasilkan bagan mediasi lengkap.
 */
export function susunKerangka(m: Masukan): Kerangka {
  const X1 = bersih(m.variabelX, "Variabel Bebas");
  const X2 = (m.variabelX2 ?? "").trim();
  const Z = (m.variabelZ ?? "").trim();
  const Y = bersih(m.variabelY, "Variabel Terikat");

  const kotak: Kotak[] = [{ id: "X1", label: X1, peran: "bebas" }];
  if (X2) kotak.push({ id: "X2", label: X2, peran: "bebas" });
  if (Z) kotak.push({ id: "Z", label: Z, peran: "antara" });
  kotak.push({ id: "Y", label: Y, peran: "terikat" });

  const bebas = X2 ? [{ id: "X1", nama: X1 }, { id: "X2", nama: X2 }] : [{ id: "X1", nama: X1 }];
  const jalur: Jalur[] = [];
  let n = 0;
  const kode = () => `H${(n += 1)}`;

  // 1. Pengaruh langsung tiap variabel bebas terhadap variabel terikat.
  for (const b of bebas) {
    jalur.push({
      kode: kode(), dari: b.id, ke: "Y", jenis: "langsung",
      bunyi: `${b.nama} berpengaruh terhadap ${Y}.`,
    });
  }

  if (Z) {
    // 2. Pengaruh tiap variabel bebas terhadap variabel antara.
    for (const b of bebas) {
      jalur.push({
        kode: kode(), dari: b.id, ke: "Z", jenis: "langsung",
        bunyi: `${b.nama} berpengaruh terhadap ${Z}.`,
      });
    }
    // 3. Pengaruh variabel antara terhadap variabel terikat.
    jalur.push({
      kode: kode(), dari: "Z", ke: "Y", jenis: "langsung",
      bunyi: `${Z} berpengaruh terhadap ${Y}.`,
    });
    // 4. Pengaruh tidak langsung lewat variabel antara.
    for (const b of bebas) {
      jalur.push({
        kode: kode(), dari: b.id, ke: "Y", lewat: "Z", jenis: "tak-langsung",
        bunyi: `${b.nama} berpengaruh terhadap ${Y} melalui ${Z}.`,
      });
    }
  }

  // 5. Pengaruh serentak, hanya bila variabel bebasnya lebih dari satu.
  if (X2) {
    jalur.push({
      kode: kode(), dari: "X1+X2", ke: "Y", jenis: "serentak",
      bunyi: `${X1} dan ${X2} secara serentak berpengaruh terhadap ${Y}.`,
    });
  }

  const rumusan = jalur.map((j) =>
    j.jenis === "serentak"
      ? `Apakah ${X1} dan ${X2} secara serentak berpengaruh terhadap ${Y}?`
      : j.lewat
        ? `Apakah ${namaKotak(kotak, j.dari)} berpengaruh terhadap ${Y} melalui ${Z}?`
        : `Apakah ${namaKotak(kotak, j.dari)} berpengaruh terhadap ${namaKotak(kotak, j.ke)}?`,
  );

  return { kotak, jalur, adaAntara: Boolean(Z), rumusan };
}

export function namaKotak(kotak: Kotak[], id: string) {
  return kotak.find((k) => k.id === id)?.label ?? id;
}

/** Penanda variabel seperti yang lazim ditulis pada bagan skripsi. */
export function tanda(id: string) {
  return { X1: "X1", X2: "X2", Z: "Z", Y: "Y" }[id] ?? id;
}
