"use client";

import type { AlurPikir, Kerangka } from "@/lib/kerangka";
import { tanda } from "@/lib/kerangka";
import type { JenisGrafik } from "@/lib/visual";

/* ==========================================================================
   BAGAN KERANGKA BERPIKIR
   Digambar dari variabel yang diisi mahasiswa, sehingga panah dan nomor
   hipotesisnya tidak mungkin berselisih dengan rumusan masalahnya.
   ========================================================================== */

/** Pecah label kotak menjadi beberapa baris; SVG tidak melipat teks sendiri. */
function bagiBaris(teks: string, maks = 22, maksBaris = 3) {
  const kata = teks.split(/\s+/);
  const baris: string[] = [];
  let kini = "";
  for (const k of kata) {
    if ((kini + " " + k).trim().length <= maks) {
      kini = (kini + " " + k).trim();
    } else {
      if (kini) baris.push(kini);
      kini = k;
    }
  }
  if (kini) baris.push(kini);
  if (baris.length > maksBaris) {
    const potong = baris.slice(0, maksBaris);
    potong[maksBaris - 1] = `${potong[maksBaris - 1].slice(0, maks - 1)}…`;
    return potong;
  }
  return baris;
}

function Kotak({
  x, y, w, h, label, kode,
}: { x: number; y: number; w: number; h: number; label: string; kode: string }) {
  const baris = bagiBaris(label.toUpperCase());
  const awal = y + h / 2 - ((baris.length - 1) * 15) / 2 - 7;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="8" className="kb-kotak" />
      {baris.map((b, i) => (
        <text key={b + i} x={x + w / 2} y={awal + i * 15} className="kb-label">{b}</text>
      ))}
      <text x={x + w / 2} y={awal + baris.length * 15 + 3} className="kb-kode">({kode})</text>
    </g>
  );
}

function Panah({ d, label, lx, ly }: { d: string; label: string; lx: number; ly: number }) {
  return (
    <g>
      <path d={d} className="kb-panah" markerEnd="url(#kb-ujung)" />
      <rect x={lx - 15} y={ly - 11} width="30" height="16" rx="4" className="kb-lat" />
      <text x={lx} y={ly + 1} className="kb-h">{label}</text>
    </g>
  );
}

export function BaganKerangka({ kerangka }: { kerangka: Kerangka }) {
  const { kotak, jalur, adaAntara } = kerangka;
  const adaX2 = kotak.some((k) => k.id === "X2");
  const cari = (id: string) => kotak.find((k) => k.id === id);
  const kodeUntuk = (dari: string, ke: string, lewat?: string) =>
    jalur.find((j) => j.dari === dari && j.ke === ke && j.lewat === lewat)?.kode ?? "";

  // Tata letak tetap, tidak bergantung panjang label.
  const KIRI = 14, TENGAH = 352, KANAN = 690, LEBAR = 256;
  const yX1 = adaX2 ? 118 : 150;
  const yX2 = 232;
  const tinggiX = adaX2 ? 86 : 104;

  return (
    <div className="al-bagan">
      <svg viewBox="0 0 960 372" role="img"
        aria-label="Bagan kerangka berpikir yang disusun dari variabel penelitian Anda">
        <defs>
          <marker id="kb-ujung" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="kb-isi" />
          </marker>
        </defs>

        <Kotak x={KIRI} y={yX1} w={LEBAR} h={tinggiX} label={cari("X1")!.label} kode="X1" />
        {adaX2 && <Kotak x={KIRI} y={yX2} w={LEBAR} h={tinggiX} label={cari("X2")!.label} kode="X2" />}
        {adaAntara && <Kotak x={TENGAH} y={130} w={LEBAR} h={110} label={cari("Z")!.label} kode="Z" />}
        <Kotak x={KANAN} y={130} w={LEBAR} h={110} label={cari("Y")!.label} kode="Y" />

        {adaAntara ? (
          <>
            <Panah d={`M${KIRI + LEBAR} ${yX1 + tinggiX / 2} L${TENGAH - 4} 168`}
              label={kodeUntuk("X1", "Z")} lx={310} ly={yX1 + tinggiX / 2 - 14} />
            {adaX2 && (
              <Panah d={`M${KIRI + LEBAR} ${yX2 + tinggiX / 2} L${TENGAH - 4} 208`}
                label={kodeUntuk("X2", "Z")} lx={310} ly={yX2 + tinggiX / 2 + 22} />
            )}
            <Panah d={`M${TENGAH + LEBAR} 185 L${KANAN - 4} 185`}
              label={kodeUntuk("Z", "Y")} lx={648} ly={171} />
            <Panah d={`M${KIRI + LEBAR / 2} ${yX1} L${KIRI + LEBAR / 2} 44 L${KANAN + LEBAR / 2} 44 L${KANAN + LEBAR / 2} 126`}
              label={kodeUntuk("X1", "Y")} lx={480} ly={38} />
            {adaX2 && (
              <Panah d={`M${KIRI + LEBAR / 2} ${yX2 + tinggiX} L${KIRI + LEBAR / 2} 330 L${KANAN + LEBAR / 2} 330 L${KANAN + LEBAR / 2} 244`}
                label={kodeUntuk("X2", "Y")} lx={480} ly={344} />
            )}
          </>
        ) : (
          <>
            <Panah d={`M${KIRI + LEBAR} ${yX1 + tinggiX / 2} L${KANAN - 4} 185`}
              label={kodeUntuk("X1", "Y")} lx={470} ly={yX1 + tinggiX / 2 - 14} />
            {adaX2 && (
              <Panah d={`M${KIRI + LEBAR} ${yX2 + tinggiX / 2} L${KANAN - 4} 205`}
                label={kodeUntuk("X2", "Y")} lx={470} ly={yX2 + tinggiX / 2 + 22} />
            )}
          </>
        )}
      </svg>
    </div>
  );
}

/* ==========================================================================
   CONTOH BENTUK GRAFIK
   Gambar kecil tanpa data sungguhan: gunanya menunjukkan bentuk mana yang
   dimaksud, bukan menyajikan hasil.
   ========================================================================== */

const BATANG = [34, 52, 70, 96, 44];
const GARIS = "M6 44 L24 30 L42 36 L60 18 L78 26 L96 12";
const GARIS2 = "M6 54 L24 46 L42 50 L60 38 L78 44 L96 34";
const SEBAR: Array<[number, number]> = [
  [12, 56], [22, 50], [30, 46], [38, 44], [46, 38], [54, 34], [62, 32], [70, 26], [80, 22], [90, 16],
  [26, 40], [44, 48], [58, 26], [74, 32],
];

function juring(i: number, n: number, r: number) {
  const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
  const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
  const x0 = 51 + r * Math.cos(a0), y0 = 36 + r * Math.sin(a0);
  const x1 = 51 + r * Math.cos(a1), y1 = 36 + r * Math.sin(a1);
  return `M51 36 L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
}

export function ContohGrafik({ jenis }: { jenis: JenisGrafik }) {
  const isi = () => {
    switch (jenis) {
      case "batang":
        return BATANG.map((t, i) => (
          <rect key={i} x={10 + i * 18} y={68 - t * 0.55} width="11" height={t * 0.55} rx="2" className="g-isi" />
        ));
      case "batang-kelompok":
        return BATANG.slice(0, 4).flatMap((t, i) => [
          <rect key={`a${i}`} x={12 + i * 22} y={68 - t * 0.5} width="8" height={t * 0.5} rx="2" className="g-isi" />,
          <rect key={`b${i}`} x={21 + i * 22} y={68 - t * 0.34} width="8" height={t * 0.34} rx="2" className="g-isi2" />,
        ]);
      case "garis":
        return <>
          <path d={GARIS} className="g-garis" />
          <path d={GARIS2} className="g-garis2" />
        </>;
      case "sebar":
        return <>
          <path d="M8 58 L96 16" className="g-garis" />
          {SEBAR.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" className="g-titik" />)}
        </>;
      case "lingkaran":
        return [0, 1, 2, 3].map((i) => <path key={i} d={juring(i, 4, 26)} className={i % 2 ? "g-isi2" : "g-isi"} />);
      case "polar":
        return [0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={juring(i, 6, 12 + ((i * 7) % 18))} className={i % 2 ? "g-isi2" : "g-isi"} />
        ));
      case "kotak":
        return [0, 1, 2].map((i) => (
          <g key={i}>
            <line x1={22 + i * 28} y1={16 + i * 4} x2={22 + i * 28} y2={64 - i * 3} className="g-garis" />
            <rect x={13 + i * 28} y={28 + i * 3} width="18" height="20" rx="2" className="g-isi" />
            <line x1={13 + i * 28} y1={38 + i * 3} x2={31 + i * 28} y2={38 + i * 3} className="g-tepi" />
          </g>
        ));
      case "matriks":
        return [0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => (
          <rect key={`${r}-${c}`} x={16 + c * 18} y={10 + r * 15} width="15" height="12" rx="2"
            className={(r + c) % 3 === 0 ? "g-isi" : (r + c) % 3 === 1 ? "g-isi2" : "g-isi3"} />
        )));
      case "jalur":
        return <>
          <rect x="6" y="24" width="26" height="24" rx="4" className="g-tepi-kotak" />
          <rect x="40" y="24" width="26" height="24" rx="4" className="g-tepi-kotak" />
          <rect x="74" y="24" width="24" height="24" rx="4" className="g-tepi-kotak" />
          <path d="M33 36 L39 36" className="g-garis" />
          <path d="M67 36 L73 36" className="g-garis" />
          <path d="M19 22 L19 10 L86 10 L86 22" className="g-garis2" />
        </>;
      case "tema":
        return <>
          <circle cx="52" cy="36" r="13" className="g-isi" />
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
            const x = 52 + 30 * Math.cos(a), y = 36 + 24 * Math.sin(a);
            return <g key={i}>
              <line x1="52" y1="36" x2={x} y2={y} className="g-tepi" />
              <circle cx={x} cy={y} r="7" className="g-isi2" />
            </g>;
          })}
        </>;
      case "alur":
        return <>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={8 + i * 32} y="26" width="24" height="20" rx="4" className="g-tepi-kotak" />
          ))}
          <path d="M33 36 L39 36" className="g-garis" />
          <path d="M65 36 L71 36" className="g-garis" />
        </>;
      case "tabel":
        return <>
          <rect x="10" y="12" width="84" height="12" rx="2" className="g-isi" />
          {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
            <rect key={`${r}-${c}`} x={10 + c * 28} y={28 + r * 12} width="26" height="9" rx="2" className="g-isi3" />
          )))}
        </>;
    }
  };
  return (
    <svg className="al-contoh" viewBox="0 0 104 72" role="img" aria-label={`Contoh bentuk ${jenis}`}>
      {["batang", "batang-kelompok", "garis", "sebar", "kotak"].includes(jenis) && (
        <>
          <line x1="8" y1="68" x2="98" y2="68" className="g-sumbu" />
          <line x1="8" y1="6" x2="8" y2="68" className="g-sumbu" />
        </>
      )}
      {isi()}
    </svg>
  );
}

/* ==========================================================================
   BAGAN ALUR PIKIR
   Untuk rancangan yang tidak menguji variabel. Bentuknya rantai tahap, bukan
   kotak X dan Y, karena penelitian kualitatif memang tidak punya keduanya.
   ========================================================================== */

export function BaganAlurPikir({ alur }: { alur: AlurPikir }) {
  const TINGGI = 96;
  const JARAK = 22;
  const total = alur.simpul.length * TINGGI + (alur.simpul.length - 1) * JARAK + 16;

  return (
    <div className="al-bagan al-bagan-alur">
      <svg viewBox={`0 0 720 ${total}`} role="img"
        aria-label="Bagan alur pikir penelitian, dari fenomena sampai temuan yang diharapkan">
        <defs>
          <marker id="ap-ujung" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="kb-isi" />
          </marker>
        </defs>
        {alur.simpul.map((s, i) => {
          const y = 8 + i * (TINGGI + JARAK);
          const baris = bagiBaris(s.isi, 58, 2);
          return (
            <g key={s.tahap}>
              <rect x="8" y={y} width="704" height={TINGGI} rx="10" className="kb-kotak" />
              <text x="30" y={y + 30} className="ap-tahap">{s.tahap.toUpperCase()}</text>
              {baris.map((b, j) => (
                <text key={b + j} x="30" y={y + 58 + j * 20} className="ap-isi">{b}</text>
              ))}
              {i < alur.simpul.length - 1 && (
                <path d={`M360 ${y + TINGGI} L360 ${y + TINGGI + JARAK - 4}`}
                  className="kb-panah" markerEnd="url(#ap-ujung)" />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
