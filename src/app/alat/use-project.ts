"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ambilProject,
  daftarProject,
  hapusProject as hapusDariDb,
  mintaPenyimpananTetap,
  simpanProject,
  uraiBab,
  type Project,
  type RingkasProject,
} from "@/lib/project";

const KUNCI_TERAKHIR = "cakrawala:project-terakhir";

/**
 * Pengelola project untuk seluruh halaman Cakrawala.
 *
 * Project aktif disimpan di IndexedDB dan diingat antar kunjungan lewat
 * localStorage. Penyimpanan dapat gagal atau kosong pada mode penyamaran,
 * jadi setiap pembacaan dibungkus dan halaman tetap berjalan tanpa project.
 */
export function useProject() {
  const [daftar, setDaftar] = useState<RingkasProject[]>([]);
  const [aktif, setAktif] = useState<Project | null>(null);
  const [siap, setSiap] = useState(false);
  const [galat, setGalat] = useState("");
  const simpanTunda = useRef<number | null>(null);

  const muatDaftar = useCallback(async () => {
    try {
      setDaftar(await daftarProject());
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Penyimpanan lokal tidak dapat dibaca.");
    }
  }, []);

  // Pemuatan awal ditunda satu tick supaya setState tidak berjalan sinkron
  // di dalam effect.
  useEffect(() => {
    const jam = window.setTimeout(() => {
      void (async () => {
        await mintaPenyimpananTetap();
        await muatDaftar();
        try {
          const terakhir = window.localStorage.getItem(KUNCI_TERAKHIR);
          if (terakhir) {
            const p = await ambilProject(terakhir);
            if (p) setAktif(p);
          }
        } catch {
          // localStorage dapat dilarang; bukan alasan menghentikan halaman.
        }
        setSiap(true);
      })();
    }, 0);
    return () => window.clearTimeout(jam);
  }, [muatDaftar]);

  const pilih = useCallback(async (id: string | null) => {
    if (!id) {
      setAktif(null);
      try { window.localStorage.removeItem(KUNCI_TERAKHIR); } catch { /* diabaikan */ }
      return;
    }
    const p = await ambilProject(id);
    setAktif(p);
    try { window.localStorage.setItem(KUNCI_TERAKHIR, id); } catch { /* diabaikan */ }
  }, []);

  /** Simpan perubahan project aktif, ditunda agar tiap ketikan tidak menulis. */
  const ubah = useCallback(
    (perubahan: Partial<Project>) => {
      setAktif((kini) => {
        if (!kini) return kini;
        const baru = { ...kini, ...perubahan };
        if (simpanTunda.current) window.clearTimeout(simpanTunda.current);
        simpanTunda.current = window.setTimeout(() => {
          void (async () => {
            try {
              await simpanProject(baru);
              await muatDaftar();
            } catch (alasan: unknown) {
              setGalat(alasan instanceof Error ? alasan.message : "Perubahan tidak dapat disimpan.");
            }
          })();
        }, 600);
        return baru;
      });
    },
    [muatDaftar],
  );

  const buat = useCallback(
    async (project: Project) => {
      await simpanProject(project);
      await muatDaftar();
      setAktif(project);
      try { window.localStorage.setItem(KUNCI_TERAKHIR, project.id); } catch { /* diabaikan */ }
    },
    [muatDaftar],
  );

  const hapus = useCallback(
    async (id: string) => {
      await hapusDariDb(id);
      await muatDaftar();
      setAktif((kini) => (kini?.id === id ? null : kini));
    },
    [muatDaftar],
  );

  /** Ganti seluruh isi naskah dan urai ulang babnya. */
  const gantiNaskah = useCallback(
    (teks: string) => {
      ubah({ bab: uraiBab(teks) });
    },
    [ubah],
  );

  const jumlahKata = useMemo(
    () => (aktif ? aktif.bab.reduce((n, b) => n + b.jumlahKata, 0) : 0),
    [aktif],
  );

  return { daftar, aktif, siap, galat, pilih, ubah, buat, hapus, gantiNaskah, jumlahKata, muatDaftar };
}
