"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

function BrandLogoSmall() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ width: 52, height: 52 }}>
      <defs>
        <linearGradient id="capLogin" x1="8" y1="14" x2="56" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE08A" />
          <stop offset="1" stopColor="#F2C94C" />
        </linearGradient>
      </defs>
      <path d="M32 14L8 24l24 10 24-10-24-10z" fill="url(#capLogin)" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 28v9c0 3.6 7.2 7 16 7s16-3.4 16-7v-9" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".95" />
      <path d="M56 24v12" stroke="#F2C94C" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="56" cy="38" r="2.6" fill="#F2C94C" stroke="#FFFFFF" strokeWidth="1.2" />
      <path d="M24 50h16" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity=".85" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { profile?: { role?: string } | null; configured?: boolean }) => {
        setConfigured(Boolean(payload.configured));
        if (payload.profile) {
          router.replace("/dashboard");
        }
      })
      .catch(() => setConfigured(false));
  }, [router]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase belum dikonfigurasi di lingkungan ini.");
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(signInError.message);

      const me = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include",
      }).then((r) => r.json());
      if (!me.profile) {
        await supabase.auth.signOut();
        throw new Error("Akun Anda belum terdaftar di daftar profil SiPaling FISIP.");
      }
      setInfo(`Selamat datang, ${me.profile.fullName}. Mengalihkan ke dashboard...`);
      router.replace("/dashboard");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Login gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="login-card">
        <div className="brand-mark"><BrandLogoSmall /></div>
        <h1>SiPaling FISIP</h1>
        <p className="login-subtitle">Masuk sebagai Super Admin, Admin, Admin Unit, atau Dosen</p>
        {configured === false && (
          <div className="login-info">
            <strong>Supabase belum terhubung lengkap.</strong> Tambahkan URL, publishable/anon key, dan secret/service-role key Supabase pada environment hosting (mis. Vercel), lalu deploy ulang.
          </div>
        )}
        {configured && (
          <form className="login-form" onSubmit={submitLogin}>
            <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@kampus.ac.id" autoComplete="email" /></label>
            <label>Password<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" /></label>
            {error && <div className="login-error">{error}</div>}
            {info && <div className="login-info">{info}</div>}
            <button type="submit" className="button button-primary" disabled={loading} style={{ width: "100%" }}>{loading ? "Memeriksa..." : "Masuk"}<span>→</span></button>
          </form>
        )}
        <p className="login-link">Kembali ke <Link href="/">portal mahasiswa</Link></p>
      </div>
    </div>
  );
}
