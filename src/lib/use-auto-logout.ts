"use client";

import { useEffect } from "react";

// Logout otomatis setelah 30 menit tanpa aktivitas.
// Waktu aktivitas terakhir disimpan di localStorage sehingga tetap berlaku
// walau tab ditutup — kalau dibuka lagi keesokan harinya, sesi langsung
// diakhiri, tidak "masih login" seperti sebelumnya.
const IDLE_LIMIT_MS = 30 * 60 * 1000;
const STORAGE_KEY = "sipaling_last_activity";

/**
 * Nyalakan ulang jam diam ini.
 *
 * WAJIB dipanggil begitu login berhasil. Tanpa itu, penanda dari sesi
 * sebelumnya masih tersimpan di peramban: dashboard baru terbuka, hook di
 * bawah membaca penanda kemarin, menganggap pengguna sudah diam berjam-jam,
 * lalu langsung melempar balik ke halaman login. Pengguna kemudian harus
 * login dua kali — kali kedua berhasil hanya karena forceLogout sudah
 * menghapus penandanya.
 */
export function mulaiJamDiam() {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Penyimpanan diblokir (mode penyamaran). Hook di bawah membaca 0 dan
    // memperlakukannya sebagai sesi yang baru dimulai, jadi tidak apa-apa.
  }
}

async function forceLogout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    window.localStorage.removeItem(STORAGE_KEY);
    window.location.href = "/login?timeout=1";
  }
}

export function useAutoLogout(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const last = Number(window.localStorage.getItem(STORAGE_KEY) || "0");
    // Penanda yang lebih baru daripada sekarang berarti jam perangkat pernah
    // mundur. Dihitung sebagai baru aktif, bukan sebagai diam selamanya.
    if (last && last <= Date.now() && Date.now() - last > IDLE_LIMIT_MS) {
      void forceLogout();
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));

    let lastWrite = Date.now();
    const touch = () => {
      const now = Date.now();
      if (now - lastWrite > 15_000) {
        lastWrite = now;
        window.localStorage.setItem(STORAGE_KEY, String(now));
      }
    };
    const events: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((name) => window.addEventListener(name, touch, { passive: true }));

    const timer = window.setInterval(() => {
      const stored = Number(window.localStorage.getItem(STORAGE_KEY) || "0");
      if (Date.now() - stored > IDLE_LIMIT_MS) {
        window.clearInterval(timer);
        void forceLogout();
      }
    }, 30_000);

    return () => {
      events.forEach((name) => window.removeEventListener(name, touch));
      window.clearInterval(timer);
    };
  }, [active]);
}
