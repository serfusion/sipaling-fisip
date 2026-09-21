-- ============================================================
-- SiPaling FISIP - UPDATE DATABASE v48
-- Hapus dosen ganda, dan tutup pintu yang melahirkannya
--
-- Jalankan SELURUH isi file ini di Supabase, SQL Editor, Run.
-- Aman dijalankan berulang kali.
-- ============================================================
--
-- ------------------------------------------------------------
-- DUA NAMA YANG DILAPORKAN TAMPIL DUA KALI
-- ------------------------------------------------------------
--
--   Umar Farisal S.I.Kom, M.Si
--   Dr. Abdul Basit, ST, M.Ikom
--
-- Keduanya muncul dua kali pada daftar "Dosen Tujuan" di formulir mahasiswa,
-- dan akibatnya bukan sekadar daftar yang jelek dibaca: dua mahasiswa yang
-- memilih orang yang SAMA tercatat pada dua baris dosen yang berbeda, sehingga
-- hitungan "(8 Mhs Bimbingan)" yang dipakai Prodi menimbang beban tiap dosen
-- terbelah dua dan tidak pernah lagi menjawab pertanyaan yang ditanyakannya.
--
-- ------------------------------------------------------------
-- DARI MANA GANDANYA DATANG
-- ------------------------------------------------------------
--
-- Tabel lecturers sudah punya penjaga: UNIQUE (name, study_program), dan
-- sipaling_buat_dosen memakainya lewat ON CONFLICT. Tetapi penjaga itu
-- membandingkan nama PERSIS, huruf demi huruf, dan gelar akademik di
-- Indonesia hampir tidak pernah ditulis dua kali dengan cara yang sama:
--
--   'Umar Farisal S.I.Kom, M.Si'     vs  'Umar Farisal, S.I.Kom., M.Si.'
--   'Dr. Abdul Basit, ST, M.Ikom'    vs  'Dr. Abdul Basit, S.T., M.I.Kom'
--
-- Bagi Postgres keempatnya empat orang yang berbeda. Satu titik, satu koma,
-- atau satu spasi sudah cukup melewati ON CONFLICT, dan baris kedua lahir
-- tanpa satu pesan galat pun.
--
-- ------------------------------------------------------------
-- APA YANG DIKERJAKAN BERKAS INI
-- ------------------------------------------------------------
--
--   1. MENGGABUNGKAN, bukan menghapus begitu saja. Satu baris dipilih sebagai
--      yang disimpan, lalu SELURUH rujukan ke baris kembarannya dipindahkan ke
--      sana: pengajuan judul, pilihan dosen, dokumen, notifikasi, ujian CBT,
--      layanan mahasiswa, dan akun login. Baru sesudah tidak ada lagi yang
--      menunjuk kepadanya, kembarannya dihapus.
--
--      Menghapus lebih dulu berarti kehilangan data: lecturer_id pada
--      pengajuan judul dan layanan mahasiswa berpasangan ON DELETE SET NULL,
--      jadi pengajuan yang sudah disetujui dosen akan kehilangan nama dosen
--      yang menyetujuinya; pilihan dosen dan kontributor dokumen
--      berpasangan ON DELETE CASCADE, jadi barisnya lenyap sama sekali.
--
--   2. MENUTUP PINTUNYA. sipaling_buat_dosen sekarang mencocokkan nama yang
--      DINORMALKAN — tanpa titik, koma, dan spasi — sehingga
--      'Dr. Abdul Basit, ST, M.Ikom' dan 'Dr. Abdul Basit, S.T., M.I.Kom'
--      dikenali sebagai orang yang sama dan memakai baris yang sudah ada.
--
--      Penjaganya sendiri ditambahkan sebagai indeks unik atas nama yang
--      dinormalkan, supaya yang lolos dari fungsi pun tetap tertahan basis
--      data. Indeks itu dibuat SESUDAH penggabungan, karena ia tidak akan
--      pernah jadi selama gandanya masih ada.
--
-- YANG TIDAK DIKERJAKAN: menyentuh dosen yang namanya memang mirip tetapi
-- bukan orang yang sama. Penggabungannya dijalankan per pola nama yang
-- disebut satu per satu di BLOK 3, bukan disapu rata ke seluruh tabel.
-- ============================================================


-- ============================================================
-- BLOK 1 - NAMA YANG DINORMALKAN
-- ============================================================
--
-- Titik, koma, dan spasi dibuang; sisanya dihuruf-kecilkan. Yang tersisa
-- adalah nama beserta gelarnya dalam satu untai yang tidak lagi bergantung
-- pada cara siapa pun mengetik gelar:
--
--   'Umar Farisal S.I.Kom, M.Si'   -> 'umarfarisalsikommsi'
--   'Umar Farisal, S.I.Kom., M.Si.'-> 'umarfarisalsikommsi'
--
-- IMMUTABLE, karena ia dipakai sebagai indeks — Postgres menolak indeks atas
-- fungsi yang jawabannya boleh berubah. Dan ia memang tidak berubah: keluaran
-- fungsi ini hanya bergantung pada masukannya.
--
-- Perhatikan bahwa gelar TIDAK dibuang, hanya tanda bacanya. Membuang gelar
-- akan menyatukan dua orang berbeda yang kebetulan senama, dan kekeliruan itu
-- jauh lebih mahal daripada satu baris ganda yang tersisa.
create or replace function public.sipaling_nama_dosen_normal(p_nama text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(coalesce(p_nama, '')), '[^a-z0-9]', '', 'g');
$$;


-- ============================================================
-- BLOK 2 - FUNGSI PENGGABUNG
-- ============================================================
--
-- Diberi satu pola nama (mis. '%Abdul Basit%') dan satu program studi, ia
-- menyatukan seluruh baris dosen yang cocok menjadi SATU baris.
--
-- YANG DISIMPAN dipilih dengan urutan yang tidak sembarangan:
--
--   1. yang punya akun login (profiles.lecturer_id menunjuk kepadanya).
--      Memindahkan akun login jauh lebih berisiko daripada memindahkan
--      pengajuan: akun itu yang dipakai dosennya membuka ujian CBT miliknya
--      sendiri, dan kepemilikan ujian ikut diperiksa lewat createdById.
--   2. yang paling banyak dirujuk data lain. Makin sedikit yang dipindahkan,
--      makin sedikit yang dapat keliru.
--   3. yang id-nya paling kecil — yang paling dahulu ada.
--
-- Mengembalikan kalimat yang dapat dibaca langsung di SQL Editor, bukan diam.
-- Penggabungan yang tidak menemukan apa-apa harus mengatakannya, karena nama
-- yang salah ketik pada pemanggilnya akan terlihat seperti pekerjaan yang
-- berhasil.
create or replace function public.sipaling_gabung_dosen(
  p_pola text,
  p_prodi text,
  p_nama_benar text default null
) returns text
language plpgsql
as $$
declare
  v_simpan integer;
  v_buang integer[];
  v_jumlah integer;
begin
  -- Dipilih dari seluruh baris yang cocok, aktif maupun tidak. Baris yang
  -- sudah dinonaktifkan tetap dirujuk pengajuan lama, dan rujukan itulah yang
  -- harus ikut pindah.
  select array_agg(id order by id) into v_buang
  from public.lecturers
  where name ilike p_pola and study_program = p_prodi;

  v_jumlah := coalesce(array_length(v_buang, 1), 0);
  if v_jumlah = 0 then
    return format('LEWAT: tidak ada dosen yang cocok dengan %L pada %L.', p_pola, p_prodi);
  end if;
  if v_jumlah = 1 then
    -- Bukan galat. Berkas ini aman diulang, dan pada jalan kedua memang sudah
    -- tinggal satu.
    if p_nama_benar is not null then
      update public.lecturers set name = p_nama_benar, active = true where id = v_buang[1];
      return format('OK: %L sudah tunggal (id %s), namanya dirapikan.', p_nama_benar, v_buang[1]);
    end if;
    return format('OK: %L sudah tunggal (id %s).', p_pola, v_buang[1]);
  end if;

  select l.id into v_simpan
  from public.lecturers l
  where l.id = any(v_buang)
  order by
    (exists (select 1 from public.profiles p where p.lecturer_id = l.id)) desc,
    (
      (select count(*) from public.cbt_exams          x where x.lecturer_id = l.id) +
      (select count(*) from public.title_proposals    t where t.approved_lecturer_id = l.id) +
      (select count(*) from public.title_proposal_choices c where c.lecturer_id = l.id) +
      (select count(*) from public.service_requests   s where s.lecturer_id = l.id) +
      (select count(*) from public.document_contributors d where d.lecturer_id = l.id)
    ) desc,
    l.id asc
  limit 1;

  v_buang := array_remove(v_buang, v_simpan);

  -- ---------- RUJUKAN YANG PUNYA PENJAGA KEUNIKAN ----------
  -- Dua baris kembar dapat sama-sama menjadi pilihan pada SATU pengajuan yang
  -- sama — mahasiswa yang melihat nama yang sama dua kali di daftar memang
  -- kadang memilih keduanya. Memindahkan begitu saja akan menabrak
  -- title_proposal_choices_unique (proposal_id, lecturer_id), jadi yang
  -- kembar dibuang lebih dulu, dan yang dibuang adalah yang TIDAK terpilih.
  delete from public.title_proposal_choices c
  where c.lecturer_id = any(v_buang)
    and exists (
      select 1 from public.title_proposal_choices lain
      where lain.proposal_id = c.proposal_id and lain.lecturer_id = v_simpan
    )
    and c.selected = false;

  -- Yang tersisa sesudah itu adalah pilihan yang TERPILIH pada pengajuan yang
  -- sudah menunjuk baris simpanan juga. Baris simpanannya yang dibuang, supaya
  -- keputusan dosen yang sudah tercatat tidak ikut hilang.
  delete from public.title_proposal_choices c
  where c.lecturer_id = v_simpan
    and exists (
      select 1 from public.title_proposal_choices lain
      where lain.proposal_id = c.proposal_id and lain.lecturer_id = any(v_buang)
    );

  update public.title_proposal_choices set lecturer_id = v_simpan where lecturer_id = any(v_buang);

  -- Hal yang sama untuk kontributor dokumen: document_contributors_unique
  -- (document_id, lecturer_id). Di sini tidak ada keputusan yang dapat hilang,
  -- jadi yang kembar cukup dibuang.
  delete from public.document_contributors d
  where d.lecturer_id = any(v_buang)
    and exists (
      select 1 from public.document_contributors lain
      where lain.document_id = d.document_id and lain.lecturer_id = v_simpan
    );
  update public.document_contributors set lecturer_id = v_simpan where lecturer_id = any(v_buang);

  -- ---------- RUJUKAN BIASA ----------
  update public.title_proposals set approved_lecturer_id = v_simpan
    where approved_lecturer_id = any(v_buang);
  update public.service_requests  set lecturer_id = v_simpan where lecturer_id = any(v_buang);
  update public.notifications     set lecturer_id = v_simpan where lecturer_id = any(v_buang);
  update public.cbt_exams         set lecturer_id = v_simpan where lecturer_id = any(v_buang);

  -- Akun login. Dosen yang akunnya menunjuk baris kembaran dipindahkan ke
  -- baris simpanan, sehingga ujian CBT dan pengajuan yang masuk kepadanya
  -- terlihat dari satu akun yang sama — bukan terbelah dua seperti sebelumnya.
  update public.profiles set lecturer_id = v_simpan, updated_at = now()
    where lecturer_id = any(v_buang);

  delete from public.lecturers where id = any(v_buang);

  if p_nama_benar is not null then
    update public.lecturers set name = p_nama_benar, active = true where id = v_simpan;
  else
    update public.lecturers set active = true where id = v_simpan;
  end if;

  return format(
    'OK: %s baris digabungkan menjadi id %s (%s).',
    v_jumlah, v_simpan,
    coalesce(p_nama_benar, (select name from public.lecturers where id = v_simpan))
  );
end;
$$;


-- ============================================================
-- BLOK 3 - LIHAT DULU, BARU GABUNGKAN
-- ============================================================

-- 3a) Siapa saja yang akan digabungkan. Jalankan bagian ini LEBIH DULU dan
--     baca hasilnya: kalau ada nama yang bukan orang yang dimaksud, jangan
--     lanjutkan ke 3b — ganti polanya lebih dulu supaya lebih sempit.
select id, name, study_program, active,
       public.sipaling_nama_dosen_normal(name) as nama_normal,
       (select count(*) from public.title_proposals t
         where t.approved_lecturer_id = l.id) as bimbingan,
       (select count(*) from public.cbt_exams x where x.lecturer_id = l.id) as ujian_cbt,
       exists (select 1 from public.profiles p where p.lecturer_id = l.id) as punya_akun
from public.lecturers l
where name ilike '%Umar Farisal%'
   or name ilike '%Abdul Basit%'
order by name, id;

-- 3b) Gabungkan. Nama yang ditulis di argumen ketiga adalah ejaan yang
--     DIPAKAI sesudah ini — satu-satunya yang akan tampil di daftar dosen.
select public.sipaling_gabung_dosen(
  '%Umar Farisal%', 'Ilmu Komunikasi', 'Umar Farisal, S.I.Kom., M.Si.'
) as hasil_umar_farisal;

select public.sipaling_gabung_dosen(
  '%Abdul Basit%', 'Ilmu Komunikasi', 'Dr. Abdul Basit, S.T., M.I.Kom.'
) as hasil_abdul_basit;

-- CATATAN bila salah satu nama di atas menjawab "LEWAT: tidak ada dosen yang
-- cocok": berarti barisnya terdaftar pada program studi yang lain. Jalankan
-- ulang baris yang bersangkutan dengan 'Ilmu Pemerintahan'. Kalau ternyata
-- orangnya memang terdaftar di KEDUA prodi, keduanya bukan baris ganda
-- melainkan dua penugasan; yang benar adalah menonaktifkan yang tidak dipakai:
--
--   update public.lecturers set active = false
--   where name ilike '%Abdul Basit%' and study_program = 'Ilmu Pemerintahan';


-- ============================================================
-- BLOK 4 - PINTUNYA DITUTUP
-- ============================================================

-- 4a) Penjaga di basis data. Sesudah ini, 'Dr. Abdul Basit, ST, M.Ikom' dan
--     'Dr. Abdul Basit, S.T., M.I.Kom.' tidak dapat sama-sama ada pada satu
--     program studi — yang kedua ditolak, bukan diterima diam-diam.
--
--     Dibuat SESUDAH BLOK 3, karena indeks ini tidak akan pernah jadi selama
--     gandanya masih ada. Kalau baris ini gagal, berarti masih ada nama ganda
--     lain di tabel; pakai kueri 4b untuk menemukannya.
create unique index if not exists lecturers_nama_normal_unik
  on public.lecturers (public.sipaling_nama_dosen_normal(name), study_program);

-- 4b) Bila 4a gagal: inilah daftar nama yang masih ganda.
--     Jalankan sipaling_gabung_dosen untuk masing-masing, lalu ulangi 4a.
select public.sipaling_nama_dosen_normal(name) as nama_normal,
       study_program,
       count(*) as jumlah,
       string_agg(name || ' (id ' || id || ')', ' | ' order by id) as baris
from public.lecturers
group by 1, 2
having count(*) > 1
order by 3 desc;

-- 4c) Fungsi pembuat akun dosen ikut memakai nama yang dinormalkan.
--
--     Yang berubah hanya cara MENEMUKAN baris yang sudah ada. Sebelumnya
--     ON CONFLICT (name, study_program) — yang hanya menangkap ejaan yang
--     sama persis — sekarang pencarian atas nama yang dinormalkan lebih dulu,
--     dan insert hanya dijalankan bila benar-benar belum ada.
--
--     Akibatnya bagi admin: mengetik ulang nama dosen yang sudah ada dengan
--     tanda baca yang berbeda TIDAK lagi melahirkan baris kedua, melainkan
--     menyambung ke baris yang sudah ada — persis seperti yang selama ini
--     dikiranya terjadi.
create or replace function public.sipaling_buat_dosen(
  p_email text,
  p_password text,
  p_full_name text,
  p_study_program text
) returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_lecturer_id integer;
begin
  if p_study_program not in ('Ilmu Komunikasi', 'Ilmu Pemerintahan') then
    return 'GAGAL: Program Studi harus persis ''Ilmu Komunikasi'' atau ''Ilmu Pemerintahan''.';
  end if;

  select id into v_lecturer_id
  from public.lecturers
  where study_program = p_study_program
    and public.sipaling_nama_dosen_normal(name)
      = public.sipaling_nama_dosen_normal(p_full_name)
  order by id
  limit 1;

  if v_lecturer_id is null then
    insert into public.lecturers (name, study_program, active)
    values (p_full_name, p_study_program, true)
    returning id into v_lecturer_id;
  else
    -- Barisnya sudah ada. Yang dinyalakan kembali hanya keaktifannya; NAMANYA
    -- TIDAK ditimpa. Ejaan yang sudah dipakai pada surat tugas dan transkrip
    -- yang terlanjur terbit tidak boleh berubah hanya karena satu akun baru
    -- dibuat dengan tanda baca yang lain.
    update public.lecturers set active = true where id = v_lecturer_id;
  end if;

  return public.sipaling_buat_akun(p_email, p_password, p_full_name, 'dosen', v_lecturer_id)
         || ' (Dosen Tujuan: ' || p_full_name || ' — ' || p_study_program || ')';
end;
$$;


-- ============================================================
-- BLOK 5 - VERIFIKASI
-- ============================================================

-- Daftar yang MASIH tampil untuk mahasiswa. Dua nama yang dilaporkan harus
-- muncul tepat satu kali masing-masing.
select id, name, study_program,
       (select count(*) from public.title_proposals t
         where t.approved_lecturer_id = l.id
           and t.status = 'Disetujui Dosen') as bimbingan
from public.lecturers l
where active = true
order by name;

-- Dan tidak ada lagi satu pun nama ganda. Kueri ini harus mengembalikan
-- NOL BARIS.
select public.sipaling_nama_dosen_normal(name) as nama_normal, study_program, count(*)
from public.lecturers
group by 1, 2
having count(*) > 1;
