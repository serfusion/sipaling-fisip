package id.sipaling.cbt.lockdown

// ============================================================
// APLIKASI UJIAN TERKUNCI — ANDROID
//
// Seluruh alasan aplikasi ini ada muat dalam satu baris, dan baris itu ada di
// bawah pada kunciLayar():
//
//     window.setFlags(FLAG_SECURE, FLAG_SECURE)
//
// Sesudah baris itu berjalan, Android SENDIRI yang menolak tangkapan layar dan
// perekaman layar atas jendela ini. Yang muncul di layar peserta adalah
// pemberitahuan sistemnya sendiri — "Tidak dapat mengambil tangkapan layar
// karena kebijakan keamanan" — bukan peringatan yang dikarang halaman web.
// Yang ditolak bukan hanya tombol tangkapan layar, melainkan juga perekam
// layar bawaan, pantulan ke perangkat lain, dan pratinjau aplikasi pada layar
// "aplikasi terakhir".
//
// Halaman ujiannya sendiri tetap halaman web yang sama persis dengan yang
// dibuka dari peramban. Aplikasi ini tidak menyalin satu pun logika ujian —
// tidak ada soal, tidak ada penilaian, tidak ada jam mundur di sini. Yang ia
// tambahkan hanya lingkungan tempat halaman itu dijalankan.
//
// APA YANG TIDAK DAPAT DILAKUKANNYA, dan harus dikatakan terus terang:
//
//   - Ponsel kedua yang diarahkan ke layar. Tidak ada, dan tidak akan pernah
//     ada, perangkat lunak yang menghalanginya.
//   - Perangkat yang sudah di-root, tempat pemiliknya dapat mematikan apa pun.
//   - iOS. Apple tidak menyediakan padanan FLAG_SECURE bagi aplikasi biasa.
// ============================================================

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback

class MainActivity : ComponentActivity() {

    private lateinit var web: WebView

    override fun onCreate(simpanan: Bundle?) {
        super.onCreate(simpanan)

        // DIPANGGIL PALING AWAL, sebelum satu piksel pun digambar.
        //
        // FLAG_SECURE hanya berlaku atas isi yang digambar SESUDAH ia dipasang.
        // Dipasang belakangan — sesudah WebView berisi soal, misalnya — ada
        // jendela waktu selebar beberapa gambar tempat layarnya masih dapat
        // ditangkap, dan jendela itu persis yang akan ditemukan orang yang
        // mencarinya.
        kunciLayar()

        web = WebView(this).apply {
            layoutParams = android.view.ViewGroup.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
            )
        }
        setContentView(web)

        siapkanWeb()
        sembunyikanBilahSistem()
        pasangTombolKembali()
        web.loadUrl(BuildConfig.ALAMAT_UJIAN)
    }

    // ------------------------------------------------------------
    // KUNCI LAYAR
    // ------------------------------------------------------------

    /**
     * Tolak tangkapan layar dan perekaman layar atas jendela ini.
     *
     * Satu panggilan, dan sistem operasinya yang menegakkan. Tidak ada yang
     * perlu diperiksa berulang, tidak ada pendengar peristiwa, tidak ada
     * tebakan — inilah bedanya dengan segala yang dapat dikerjakan halaman web.
     */
    private fun kunciLayar() {
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE,
        )
    }

    /**
     * Sematkan layar (screen pinning) supaya berpindah aplikasi tidak semudah
     * satu usapan.
     *
     * Pada perangkat biasa Android meminta persetujuan peserta lebih dulu, dan
     * peserta dapat melepasnya dengan menahan dua tombol — itu memang batasnya
     * di luar perangkat yang dikelola lembaga. Pada perangkat milik lembaga
     * yang aplikasinya dipasang sebagai device owner, penyematannya berlaku
     * tanpa dapat dilepas.
     *
     * Kegagalannya TIDAK menghentikan ujian. Sebagian perangkat mematikan
     * penyematan lewat kebijakan pabrikannya, dan menolak menjalankan ujian
     * karena itu berarti menghukum peserta atas merek ponselnya.
     */
    private fun sematkanLayar() {
        try {
            startLockTask()
        } catch (_: Exception) {
            Toast.makeText(this, R.string.sematan_gagal, Toast.LENGTH_LONG).show()
        }
    }

    private fun sembunyikanBilahSistem() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
        // Layar tidak boleh tidur di tengah ujian sembilan puluh menit yang
        // sebagian besarnya dihabiskan membaca, bukan mengetuk.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    // ------------------------------------------------------------
    // WEBVIEW
    // ------------------------------------------------------------

    @SuppressLint("SetJavaScriptEnabled")
    private fun siapkanWeb() {
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            // Halaman ujian menyimpan kunci sesinya di localStorage supaya
            // aplikasi yang tertutup di tengah ujian dapat kembali ke lembar
            // yang sama. Tanpa dua baris di atas, setiap kali aplikasi dibuka
            // ulang pesertanya kehilangan ujiannya.
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            // PENANDA APLIKASI. Inilah yang membuat halaman ujian tahu bahwa
            // layarnya benar-benar terkunci, dan inilah yang dibaca server pada
            // gerbang ujian yang mewajibkan aplikasi.
            //
            // Disisipkan ke User-Agent, bukan hanya ke objek JavaScript, karena
            // User-Agent ikut pada SETIAP permintaan — termasuk yang pertama,
            // sebelum satu baris skrip pun berjalan.
            userAgentString = "$userAgentString $PENANDA"
        }

        web.webViewClient = object : WebViewClient() {
            /**
             * Daftar putih alamat.
             *
             * Semua yang di luar tuan rumah situs ujian ditolak — termasuk
             * tautan yang tidak sengaja tertekan di dalam soal. Tanpa ini,
             * aplikasi yang seharusnya mengunci ujian berubah menjadi peramban
             * biasa tanpa bilah alamat: lebih buruk daripada peramban, karena
             * pesertanya tidak dapat melihat ia sedang berada di mana.
             */
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?,
            ): Boolean {
                val tuan = request?.url?.host ?: return true
                return !tuan.equals(tuanRumahUjian(), ignoreCase = true)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Jembatan ke halaman. Isinya sengaja hanya keterangan —
                // tidak ada satu pun fungsi yang dapat menjalankan sesuatu di
                // sisi Android. Halaman web tidak boleh dapat memanggil
                // kemampuan aslinya sesuka hati; kalau boleh, satu skrip yang
                // disuntikkan ke halaman itu memegang aplikasi ini seluruhnya.
                view?.evaluateJavascript(JEMBATAN, null)
            }
        }
    }

    private fun tuanRumahUjian(): String =
        android.net.Uri.parse(BuildConfig.ALAMAT_UJIAN).host ?: ""

    /**
     * Tombol Kembali menyusuri riwayat halaman, bukan menutup ujian.
     *
     * Satu ketukan tidak sengaja pada tombol Kembali di tengah ujian
     * sembilan puluh menit adalah kehilangan yang tidak dapat dibatalkan bila
     * ia menutup aplikasinya. Di halaman pertama ia sengaja TIDAK melakukan
     * apa-apa: keluar dari ujian dilakukan lewat tombol di dalam halaman
     * ujiannya, tempat peserta melihat peringatan bahwa waktunya terus
     * berjalan.
     */
    private fun pasangTombolKembali() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack()
            }
        })
    }

    override fun onResume() {
        super.onResume()
        // Dipasang ulang tiap kali aplikasi kembali ke depan. Sebagian
        // peluncur dan sebagian mode hemat daya mengembalikan jendela tanpa
        // bendera yang sama, dan ujian yang berjalan tanpa FLAG_SECURE tidak
        // memberi tahu siapa pun bahwa penjagaannya sudah lepas.
        kunciLayar()
        sembunyikanBilahSistem()
        sematkanLayar()
    }

    companion object {
        /**
         * Penanda pada User-Agent, dibaca src/lib/kunci-layar.ts pada situs CBT.
         *
         * Bentuknya HARUS tetap: "SiPalingCBT/<versi> (android; kunci-layar)".
         * Mengubah susunannya berarti situsnya berhenti mengenali aplikasi ini,
         * dan ujian yang mewajibkan aplikasi akan menolak seluruh pesertanya.
         */
        private const val PENANDA = "SiPalingCBT/1.0.0 (android; kunci-layar)"

        private val JEMBATAN = """
            window.SipalingLockdown = {
              jenis: 'android',
              versi: '1.0.0',
              kunciLayar: true,
              kunci: ''
            };
        """.trimIndent()
    }
}
