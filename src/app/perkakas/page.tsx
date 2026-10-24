import { redirect } from "next/navigation";
import { DAFTAR_ALAT } from "./daftar-alat";

// /perkakas sendiri tidak punya isi: ia membuka alat pertama. Begitu alatnya
// cukup banyak untuk perlu dipilih dulu, halaman ini tempat ubin pilihannya.
export default function Page() {
  redirect(DAFTAR_ALAT[0].href);
}
