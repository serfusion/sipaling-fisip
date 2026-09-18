# Cara Pasang Headroom (pemampat konteks untuk Claude Code)

Headroom (https://github.com/headroomlabs-ai/headroom) adalah alat sumber
terbuka yang **memampatkan isi konteks** sebelum dikirim ke model: keluaran
perkakas, log, potongan berkas, riwayat percakapan. Klaim penulisnya: ~20%
token lebih sedikit untuk agen pemrogram, 60–95% untuk JSON.

## Yang perlu diluruskan lebih dulu

Headroom **bukan** plugin yang bisa "dipasang ke akun Claude". Tidak ada
tempat di akun untuk memasangnya. Ia dipasang di **mesin tempat Claude Code
berjalan**, dan didaftarkan sebagai **MCP server** lewat berkas konfigurasi
di dalam repo ini.

Itulah yang dilakukan berkas `.mcp.json` di akar repo: setiap kali Claude
Code dibuka di folder ini, ia menawarkan menyalakan MCP server bernama
`headroom`, dengan tiga perkakas — `headroom_compress`, `headroom_retrieve`,
`headroom_stats`.

## Syarat di mesin

Hanya satu: **`uv` / `uvx`** terpasang, dan Python 3.10+.

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh   # macOS / Linux
```

Tidak perlu `pip install headroom-ai` secara terpisah. Perintah di
`.mcp.json` memakai `uvx --from "headroom-ai[mcp]"`, yang mengunduh dan
menjalankan Headroom di lingkungan terpisah — jadi ia tidak mengotori
Python sistem dan tidak bertabrakan dengan dependensi proyek ini. Unduhan
pertama makan waktu ~1 menit; sesudahnya masuk cache `uv` dan cepat.

## Menyalakan

1. Pastikan `uvx` ada: `command -v uvx`
2. Buka Claude Code di folder repo ini.
3. Claude Code akan bertanya apakah MCP server `headroom` dari `.mcp.json`
   boleh dipakai — jawab ya. (Persetujuan ini per-proyek, tersimpan di
   mesin masing-masing; berkas `.mcp.json` sendiri tidak memberi izin apa
   pun secara diam-diam.)
4. Periksa dengan `/mcp` — `headroom` harus berstatus tersambung.

Kalau klien MCP tidak mewarisi `PATH` shell dan `uvx` tidak ketemu, ganti
`"command": "uvx"` menjadi jalur mutlaknya (`command -v uvx`).

## Telemetri

Secara bawaan Headroom mengirim telemetri anonim. Di `.mcp.json` kami
matikan lewat dua variabel lingkungan yang didukungnya:
`HEADROOM_BEACON=off` dan `DO_NOT_TRACK=1`.

## Pertimbangan sebelum dipakai serius

Repo ini memuat kode yang menyentuh data mahasiswa, kunci Supabase, dan
naskah ujian CBT. Memasang pemampat konteks berarti isi yang dibaca agen
**melewati perangkat lunak pihak ketiga** dulu. Dalam mode MCP di atas,
Headroom berjalan **lokal** di mesin yang sama (stdio, bukan layanan awan),
jadi isinya tidak keluar mesin — tapi kalau nanti ada yang menyalakan mode
*proxy* atau adapter yang mengarah ke penyedia lain, tinjau ulang dulu.

## Mencopot

Hapus berkas `.mcp.json`, atau hapus entri `headroom` di dalamnya. Cache
alatnya dibuang dengan `uv cache clean`.
