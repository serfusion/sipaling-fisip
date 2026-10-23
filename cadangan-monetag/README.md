# Cadangan Monetag (dinonaktifkan)

Iklan Monetag (In-Page Push zone 12084733, service worker zone 12084647)
dicopot dari situs karena impresi berjalan tetapi pendapatan tetap 0.

Isi folder ini hanya cadangan, TIDAK dipakai oleh build:

- `layout.tsx.txt` — `src/app/layout.tsx` versi dengan tag In-Page Push di `<head>`.
- `next.config.ts.txt` — `next.config.ts` versi dengan CSP iklan (`cspIklan`) dan CSP ketat khusus CBT.
- `sw.js.txt` — service worker Monetag yang dulu ada di `/sw.js` dan `/public/sw.js`.

Cara memasang lagi: salin `layout.tsx.txt` ke `src/app/layout.tsx`,
`next.config.ts.txt` ke `next.config.ts`, dan `sw.js.txt` ke `public/sw.js`.
Atau kembalikan dari git: commit `fc73330` adalah keadaan terakhir sebelum dicopot.
