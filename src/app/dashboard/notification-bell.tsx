"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatStamp, type NotificationRow } from "./proposal-types";

const POLL_MS = 60_000;

// Lonceng notifikasi di topbar. Menampilkan notifikasi untuk role admin
// yang sedang login atau untuk dosen yang bersangkutan.
export default function NotificationBell({ onOpenRef }: { onOpenRef?: (refCode: string) => void }) {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const payload = (await response.json()) as { success?: boolean; notifications?: NotificationRow[]; unread?: number };
      if (payload.success) {
        setRows(payload.notifications || []);
        setUnread(payload.unread || 0);
      }
    } catch {
      // Notifikasi bersifat pelengkap — kegagalan memuat tidak ditampilkan
      // sebagai error agar tidak mengganggu pekerjaan utama di dashboard.
    }
  }, []);

  useEffect(() => {
    // Ditunda satu tick agar setState tidak berjalan sinkron di dalam effect.
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  /**
   * Tandai SATU notifikasi sudah dibaca.
   *
   * Sebelumnya menekan satu pesan hanya membuka panelnya dan menutup lonceng;
   * status bacanya tidak pernah ikut berubah, sehingga angka merahnya tetap
   * sama walaupun pesannya jelas-jelas sudah dibuka. Satu-satunya cara
   * mengosongkannya adalah "Tandai semua dibaca", yang bukan itu maksudnya.
   *
   * Tampilan diperbarui lebih dulu, baru servernya menyusul: menekan pesan
   * biasanya langsung disusul berpindah panel, dan angka yang baru berubah
   * setelah jaringan menjawab terbaca seperti tidak menanggapi apa-apa. Bila
   * permintaannya gagal, pemuatan berikutnya mengembalikan keadaan yang benar.
   */
  async function markOneRead(id: number) {
    // Status bacanya dibaca dari state saat ini, BUKAN dari dalam pengubah
    // setRows. Pengubah itu dijalankan React belakangan, jadi nilai apa pun
    // yang ditulisnya ke variabel luar masih belum berubah ketika baris
    // sesudahnya berjalan — dan pemeriksaannya selalu meleset.
    const pesan = rows.find((row) => row.id === id);
    if (!pesan || pesan.readAt) return;

    setRows((kini) =>
      kini.map((row) => (row.id === id ? { ...row, readAt: new Date().toISOString() } : row)),
    );
    setUnread((jumlah) => Math.max(0, jumlah - 1));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {
      // Diabaikan: status bacanya tersinkron pada pemuatan berikutnya.
    }
  }

  async function markAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      await load();
    } catch {
      // diabaikan — status baca akan tersinkron pada pemuatan berikutnya
    }
  }

  const urgentUnread = rows.some((row) => !row.readAt && row.severity === "urgent");

  return (
    <div className="nbell" ref={boxRef}>
      <button
        type="button"
        className={`nbell-btn ${urgentUnread ? "urgent" : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`}
        aria-expanded={open}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && <span className="nbell-count">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div className="nbell-pop">
          <div className="nbell-head">
            <b>Notifikasi</b>
            {unread > 0 && (
              <button type="button" className="linklike" onClick={() => void markAllRead()}>
                Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="nbell-list">
            {rows.length === 0 ? (
              <div className="dempty">Belum ada notifikasi.</div>
            ) : (
              rows.map((row) => (
                <button
                  type="button"
                  key={row.id}
                  className={`nbell-item ${row.readAt ? "" : "unread"} ${row.severity === "urgent" ? "urgent" : ""}`}
                  onClick={() => {
                    void markOneRead(row.id);
                    if (row.refCode && onOpenRef) onOpenRef(row.refCode);
                    setOpen(false);
                  }}
                >
                  <b>{row.title}</b>
                  <p>{row.body}</p>
                  <small>{formatStamp(row.createdAt)}{row.refCode ? ` · ${row.refCode}` : ""}</small>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
