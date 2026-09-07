// ============================================================
// APLIKASI UJIAN TERKUNCI — WINDOWS
//
// Seluruh alasan aplikasi ini ada muat dalam satu panggilan Win32, dan
// panggilan itu ada di bawah pada kunci_layar():
//
//     SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)
//
// Sesudah panggilan itu berhasil, Windows SENDIRI yang mengeluarkan jendela
// ini dari setiap tangkapan layar dan setiap perekaman. Yang tertangkap Print
// Screen, Snipping Tool, Win+Shift+S, perekam Xbox Game Bar, OBS, Zoom share,
// dan Teams share bukan soal ujian melainkan BIDANG HITAM — bukan karena ada
// yang menutupinya, melainkan karena penyusun tampilan Windows tidak
// memasukkan jendela ini ke dalam salinan yang dibuatnya.
//
// Ini penolakan yang sungguh-sungguh, dan ia satu tingkat lebih kuat daripada
// apa pun yang dapat dikerjakan halaman web. Halaman web hanya dapat menutup
// soalnya lalu berharap sempat; di sini tidak ada yang perlu sempat.
//
// SYARAT DAN BATASNYA — dan keduanya harus dikatakan terus terang:
//
//   - WDA_EXCLUDEFROMCAPTURE menuntut Windows 10 versi 2004 (build 19041) ke
//     atas. Di bawah itu panggilannya gagal, dan aplikasi ini TIDAK
//     berpura-pura berhasil: ia jatuh ke WDA_MONITOR, yang juga menghitamkan
//     tangkapan layar tetapi ikut menghitamkan sebagian pantulan layar yang
//     sah. Bila keduanya gagal, ujiannya tetap berjalan dan halamannya
//     mengabarkan apa adanya.
//   - Ponsel yang diarahkan ke monitor tetap merekam apa pun. Tidak ada, dan
//     tidak akan pernah ada, perangkat lunak yang menghalanginya.
//   - Mesin virtual dan perangkat keras penangkap gambar (HDMI capture card)
//     berada di luar jangkauan panggilan ini.
//
// Halaman ujiannya sendiri tetap halaman web yang sama persis dengan yang
// dibuka dari peramban. Tidak ada satu pun logika ujian yang disalin ke sini:
// tidak ada soal, tidak ada penilaian, tidak ada jam mundur. Yang ditambahkan
// aplikasi ini hanya lingkungan tempat halaman itu dijalankan.
// ============================================================

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};

/// Alamat situs ujian, ditanam saat membangun.
///
/// Bukan diketik peserta. Aplikasi ujian yang meminta alamat lebih dulu adalah
/// aplikasi yang dapat diarahkan ke tempat lain oleh orang yang memakainya —
/// termasuk ke salinan halaman ujian yang penjagaannya sudah dilepas.
///
/// Ganti lewat environment saat membangun:
///     ALAMAT_UJIAN=https://cbt.kampus.ac.id/ujian cargo tauri build
const ALAMAT_UJIAN: &str = match option_env!("ALAMAT_UJIAN") {
    Some(alamat) => alamat,
    None => "https://cbt.contoh.ac.id/ujian",
};

/// Penanda pada User-Agent, dibaca src/lib/kunci-layar.ts pada situs CBT.
///
/// Bentuknya HARUS tetap: "SiPalingCBT/<versi> (windows; kunci-layar)".
/// Mengubah susunannya berarti situsnya berhenti mengenali aplikasi ini, dan
/// ujian yang mewajibkan aplikasi akan menolak seluruh pesertanya.
const PENANDA: &str = "SiPalingCBT/1.0.0 (windows; kunci-layar)";

/// Skrip yang dijalankan SEBELUM satu baris pun skrip halaman berjalan.
///
/// Dua hal sekaligus, dan keduanya harus ada sejak awal dokumen: jembatan
/// keterangan yang dibaca halaman ujian, dan penutupan menu klik kanan beserta
/// pintasan alat pengembang. Dipasang belakangan, keduanya kalah cepat oleh
/// halaman yang sudah berjalan.
const JEMBATAN: &str = r#"
window.SipalingLockdown = {
  jenis: 'windows',
  versi: '1.0.0',
  kunciLayar: true,
  kunci: ''
};
window.addEventListener('contextmenu', function (e) { e.preventDefault(); }, true);
window.addEventListener('keydown', function (e) {
  var k = (e.key || '').toLowerCase();
  var alat = k === 'f12'
    || (e.ctrlKey && e.shiftKey && (k === 'i' || k === 'j' || k === 'c'))
    || (e.ctrlKey && (k === 'u' || k === 'p' || k === 's'));
  if (alat) { e.preventDefault(); e.stopPropagation(); }
}, true);
"#;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let jendela = WebviewWindowBuilder::new(
                app,
                "ujian",
                WebviewUrl::External(ALAMAT_UJIAN.parse().expect("ALAMAT_UJIAN bukan URL yang sah")),
            )
            .title("Ujian Terkunci")
            .fullscreen(true)
            .always_on_top(true)
            .decorations(false)
            .resizable(false)
            // Peramban bawaan Windows menyusun User-Agent-nya sendiri;
            // penanda ini ditambahkan di ujungnya supaya ikut pada SETIAP
            // permintaan — termasuk yang pertama, sebelum satu baris skrip
            // pun berjalan, dan termasuk yang dikirim ulang sesudah halaman
            // dimuat kembali.
            .user_agent(&format!("Mozilla/5.0 (Windows NT 10.0; Win64; x64) {PENANDA}"))
            .initialization_script(JEMBATAN)
            .build()?;

            // Dipanggil SESUDAH jendelanya ada — panggilan Win32-nya
            // membutuhkan HWND yang sungguh-sungguh — tetapi SEBELUM
            // halamannya sempat menggambar soal.
            #[cfg(target_os = "windows")]
            kunci_layar(&jendela);

            let _ = jendela.set_focus();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("aplikasi ujian gagal dijalankan");
}

/// Keluarkan jendela ujian dari setiap tangkapan layar dan setiap perekaman.
///
/// Dua tingkat, dan yang kedua adalah kejujuran, bukan kelengkapan:
///
///   WDA_EXCLUDEFROMCAPTURE (0x11) — Windows 10 2004 ke atas. Jendelanya tetap
///     terlihat orang yang duduk di depannya, tetapi tidak ada pada salinan
///     mana pun. Inilah yang dituju.
///   WDA_MONITOR (0x01) — cadangan untuk Windows yang lebih tua. Ia juga
///     menghitamkan tangkapan layar, tetapi lebih kasar: sebagian pantulan
///     layar yang sah ikut hitam.
///
/// Kegagalan keduanya TIDAK menghentikan ujian, dan tidak pula disembunyikan.
/// Menolak menjalankan ujian karena versi Windows di ruang laboratorium sudah
/// tua berarti menghukum peserta atas komputer yang bukan miliknya; yang benar
/// adalah tetap berjalan sambil mengatakan apa adanya di layar pengawas.
#[cfg(target_os = "windows")]
fn kunci_layar(jendela: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_MONITOR,
    };

    let Ok(pegangan) = jendela.hwnd() else {
        eprintln!("kunci layar: jendela belum punya HWND");
        return;
    };
    let hwnd = HWND(pegangan.0 as *mut core::ffi::c_void);

    unsafe {
        if SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE).is_ok() {
            return;
        }
        if SetWindowDisplayAffinity(hwnd, WDA_MONITOR).is_ok() {
            eprintln!("kunci layar: memakai WDA_MONITOR — Windows ini lebih tua dari versi 2004");
            return;
        }
    }
    eprintln!("kunci layar: TIDAK aktif di perangkat ini");
}
