// ============================================================
// TIGA SITUS, SATU PENYEBARAN
//
// Penyebaran ini melayani tiga alamat yang berbeda:
//
//   portal : www.sipalingfisip.web.id  → layanan akademik, dashboard, login
//   CBT    : cbt.sipalingfisip.web.id  → pintu masuk ujian dan layar ujian
//   drama  : sipalingfisip.online      → Nonton Drama, bonus pemegang kode
//
// Aturan tiap situs tinggal di berkasnya sendiri — situs-cbt.ts dan
// situs-drama.ts — dan berkas ini hanya menyusun urutan bertanyanya. Ia
// sengaja tipis: yang menentukan ke mana sebuah permintaan mendarat adalah
// dua berkas itu, dan keduanya berisi fungsi murni yang dapat diuji tanpa
// menyalakan server.
//
// URUTANNYA PENTING, dan hanya satu urutan yang benar. Drama ditanya lebih
// dulu karena ia dikenali dari NAMA DOMAIN yang utuh, sedangkan CBT dikenali
// dari awalan subdomain dan aturan portalnya berlaku untuk apa pun yang
// tersisa. Bertanya pada yang paling khusus lebih dulu membuat penambahan
// situs keempat kelak tidak perlu menyentuh aturan yang sudah ada.
// ============================================================

import { rencanaRute, type RencanaRute } from "@/lib/situs-cbt";
import { rencanaDrama } from "@/lib/situs-drama";

export type { RencanaRute };

/** Ke mana permintaan ini seharusnya mendarat? */
export function rencanaSitus(
  hostMentah: string | null | undefined,
  pathname: string,
): RencanaRute {
  return rencanaDrama(hostMentah, pathname) ?? rencanaRute(hostMentah, pathname);
}
