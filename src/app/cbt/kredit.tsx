// ============================================================
// KREDIT SITUS CBT
//
// Satu kalimat, dan hanya satu tempat yang menyimpannya. Ia muncul di setiap
// layar yang dibuka mahasiswa — pintu masuk, layar identitas, layar
// mengerjakan, dan layar selesai — dan karena semuanya memanggil berkas ini,
// tidak mungkin ada satu layar yang tertinggal membawa tulisan lama.
// ============================================================

/** Baris kredit yang dicantumkan pada tiap layar CBT. */
export const KREDIT_CBT = "Computer Based Test (CBT) — SiPaling CBT — Concept Superfal Dev";

export default function KreditCbt({ rapat = false }: { rapat?: boolean }) {
  return <p className={`cbt-kredit${rapat ? " cbt-kredit-rapat" : ""}`}>{KREDIT_CBT}</p>;
}
