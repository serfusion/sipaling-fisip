// ============================================================
// GERBANG OUS — satu tempat untuk seluruh pemeriksaan wewenang
//
// Setiap route OUS memulai dengan memanggil salah satu fungsi di sini. Alasan
// mengumpulkannya bukan kerapian melainkan ini: pemeriksaan wewenang yang
// ditulis ulang di sembilan berkas akan berbeda di salah satunya, dan yang
// berbeda itu tidak akan ketahuan sampai ada yang memanfaatkannya.
//
// TIGA TINGKAT, dan bedanya nyata:
//
//   lihat — boleh membuka panel. Super Admin selalu boleh, sebab saklarnya
//           ada di dalam panel itu.
//   pakai — boleh membuat kampanye, mengirim, menyunting naskah. Menuntut
//           saklar utama menyala, termasuk bagi Super Admin.
//   atur  — boleh menggeser saklar dan mengubah pengaturan. Super Admin saja.
// ============================================================

import { getCurrentProfile, type SessionProfile } from "@/lib/supabase-server";
import { bacaOus } from "@/lib/outreach-store";
import { bolehAturOus, bolehLihatOus, bolehPakaiOus, type OusState } from "@/lib/outreach";

export type Pelaku = { id: string; nama: string; peran: string };

export type Konteks = {
  profil: SessionProfile;
  state: OusState;
  pelaku: Pelaku;
};

export type Gerbang = { ok: true; ctx: Konteks } | { ok: false; jawab: Response };

function tolak(pesan: string, status: number): { ok: false; jawab: Response } {
  return { ok: false, jawab: Response.json({ success: false, message: pesan }, { status }) };
}

export async function gerbangOus(tingkat: "lihat" | "pakai" | "atur"): Promise<Gerbang> {
  const profil = await getCurrentProfile();
  if (!profil) return tolak("Silakan masuk terlebih dahulu.", 401);

  const state = await bacaOus();
  const pelaku: Pelaku = { id: profil.id, nama: profil.fullName, peran: profil.role };

  if (tingkat === "atur") {
    if (!bolehAturOus(profil)) {
      return tolak("Pengaturan Outreach Ultramailer hanya dapat diubah oleh Super Admin.", 403);
    }
    return { ok: true, ctx: { profil, state, pelaku } };
  }

  if (tingkat === "lihat") {
    if (!bolehLihatOus(profil, state)) {
      return tolak("Menu Outreach Ultramailer tidak terbuka untuk akun ini.", 403);
    }
    return { ok: true, ctx: { profil, state, pelaku } };
  }

  if (!bolehPakaiOus(profil, state)) {
    // Dibedakan dengan sengaja. "Saklarnya mati" adalah keadaan sistem yang
    // memang perlu diketahui pemakainya — ia dapat meminta Super Admin
    // menyalakannya. "Tidak terbuka untuk akun ini" adalah soal lain, dan
    // menyamarkan keduanya menjadi satu pesan hanya membuat orang menebak.
    if (!state.enabled) {
      return tolak("Outreach Ultramailer sedang dimatikan Super Admin.", 403);
    }
    return tolak("Menu Outreach Ultramailer tidak terbuka untuk akun ini.", 403);
  }
  return { ok: true, ctx: { profil, state, pelaku } };
}

/**
 * Bolehkah orang ini menyentuh kampanye MILIK ORANG LAIN?
 *
 * Dosen tidak boleh — bukan karena kampanye orang lain rahasia, melainkan
 * karena daftar penerimanya adalah data pribadi ratusan orang yang tidak ada
 * hubungannya dengan pekerjaannya.
 */
export function bolehSentuhKampanye(
  profil: SessionProfile,
  kampanye: { ownerId: string | null },
): boolean {
  if (profil.role === "super_admin" || profil.role === "admin") return true;
  return Boolean(kampanye.ownerId) && kampanye.ownerId === profil.id;
}
