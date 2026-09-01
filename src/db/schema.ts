import {
  boolean,
  customType,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

const binary = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const lecturers = pgTable("lecturers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  studyProgram: varchar("study_program", { length: 120 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const serviceRequests = pgTable("service_requests", {
  id: serial("id").primaryKey(),
  ticket: varchar("ticket", { length: 80 }).notNull().unique(),
  nim: varchar("nim", { length: 32 }).notNull(),
  studentName: varchar("student_name", { length: 160 }).notNull(),
  studyProgram: varchar("study_program", { length: 120 }).notNull(),
  contact: varchar("contact", { length: 160 }),
  serviceType: varchar("service_type", { length: 120 }).notNull(),
  serviceNeed: varchar("service_need", { length: 160 }).notNull(),
  title: text("title").notNull(),
  lecturerId: integer("lecturer_id").references(() => lecturers.id, { onDelete: "set null" }),
  studentNote: text("student_note"),
  // Penyerahan skripsi/jurnal ke perpustakaan memakai folder Google Drive
  // milik perpustakaan; portal hanya menyimpan tautannya. Kolom ini kosong
  // untuk layanan lain. (migrasi v8)
  driveUrl: text("drive_url"),
  fileName: varchar("file_name", { length: 255 }),
  fileMime: varchar("file_mime", { length: 160 }),
  fileSize: integer("file_size"),
  fileStoragePath: text("file_storage_path"),
  // Hanya untuk kompatibilitas berkas lama sebelum migrasi ke Storage.
  fileData: binary("file_data"),
  status: varchar("status", { length: 40 }).notNull().default("Masuk"),
  administrativeStatus: varchar("administrative_status", { length: 80 }).notNull().default("Belum Dicek"),
  lecturerNote: text("lecturer_note"),
  adminNote: text("admin_note"),
  revisionCount: integer("revision_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Lampiran bernama untuk satu pengajuan. Dipakai kebutuhan yang mengunggah
// beberapa berkas sekaligus. Sejak v8 penyerahan skripsi pindah ke Google
// Drive perpustakaan, jadi tabel ini hanya melayani tiket lama yang berkasnya
// sudah terlanjur naik ke penyimpanan portal.
export const requestAttachments = pgTable("request_attachments", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
  // Kode bagian, mis. "cover" | "isi" | "pustaka" | "full".
  part: varchar("part", { length: 40 }).notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileMime: varchar("file_mime", { length: 160 }).notNull(),
  fileSize: integer("file_size").notNull(),
  fileStoragePath: text("file_storage_path").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const revisionUploads = pgTable("revision_uploads", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
  nim: varchar("nim", { length: 32 }).notNull(),
  revisionNumber: integer("revision_number").notNull(),
  note: text("note"),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileMime: varchar("file_mime", { length: 160 }).notNull(),
  fileSize: integer("file_size").notNull(),
  fileStoragePath: text("file_storage_path"),
  // Nullable: berkas baru disimpan di Supabase Storage, bukan PostgreSQL.
  fileData: binary("file_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  active: boolean("active").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdBy: varchar("created_by", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: varchar("id", { length: 64 }).primaryKey(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("dosen"),
  lecturerId: integer("lecturer_id").references(() => lecturers.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const libraryAttendance = pgTable("library_attendance", {
  id: serial("id").primaryKey(),
  nim: varchar("nim", { length: 32 }).notNull(),
  studentName: varchar("student_name", { length: 160 }).notNull(),
  visitDate: timestamp("visit_date", { withTimezone: true }).notNull().defaultNow(),
  visitNumber: integer("visit_number").notNull(),
  note: text("note"),
  requestId: integer("request_id").references(() => serviceRequests.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const generatedDocuments = pgTable("generated_documents", {
  id: serial("id").primaryKey(),
  unitRole: varchar("unit_role", { length: 40 }).notNull(),
  docType: varchar("doc_type", { length: 120 }).notNull(),
  studentName: varchar("student_name", { length: 160 }),
  nim: varchar("nim", { length: 32 }),
  driveUrl: text("drive_url").notNull(),
  createdBy: varchar("created_by", { length: 160 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Pengajuan Judul Tugas Akhir (Skripsi / Jurnal)
// Alur: mahasiswa kirim template -> Admin Prodi verifikasi berkas &
// memilih 1 dari 3 dosen usulan -> dosen menerima/menolak.
// ============================================================
export const titleProposals = pgTable("title_proposals", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 80 }).notNull().unique(),
  nim: varchar("nim", { length: 32 }).notNull(),
  studentName: varchar("student_name", { length: 160 }).notNull(),
  address: text("address").notNull(),
  studyProgram: varchar("study_program", { length: 120 }).notNull(),
  concentration: varchar("concentration", { length: 160 }).notNull(),
  gpa: numeric("gpa", { precision: 3, scale: 2 }).notNull(),
  finalTaskType: varchar("final_task_type", { length: 20 }).notNull(),
  title: text("title").notNull(),
  statement: text("statement").notNull(),
  contact: varchar("contact", { length: 160 }),
  paymentFileName: varchar("payment_file_name", { length: 255 }),
  paymentFileMime: varchar("payment_file_mime", { length: 160 }),
  paymentFileSize: integer("payment_file_size"),
  paymentStoragePath: text("payment_storage_path"),
  financeVerified: boolean("finance_verified").notNull().default(false),
  eligibilityVerified: boolean("eligibility_verified").notNull().default(false),
  status: varchar("status", { length: 60 }).notNull().default("Menunggu Verifikasi Prodi"),
  approvedLecturerId: integer("approved_lecturer_id").references(() => lecturers.id, { onDelete: "set null" }),
  prodiNote: text("prodi_note"),
  lecturerNote: text("lecturer_note"),
  reviewedBy: varchar("reviewed_by", { length: 160 }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Tiga dosen usulan mahasiswa. Prodi menandai satu sebagai `selected`.
export const titleProposalChoices = pgTable("title_proposal_choices", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").notNull().references(() => titleProposals.id, { onDelete: "cascade" }),
  lecturerId: integer("lecturer_id").notNull().references(() => lecturers.id, { onDelete: "cascade" }),
  choiceOrder: integer("choice_order").notNull(),
  selected: boolean("selected").notNull().default(false),
  decision: varchar("decision", { length: 20 }).notNull().default("Menunggu"),
  decisionNote: text("decision_note"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Notifikasi internal. Ditujukan ke satu dosen (lecturer_id) ATAU ke seluruh
// pemegang sebuah role (audience_role, mis. admin_prodi).
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  audienceRole: varchar("audience_role", { length: 40 }),
  lecturerId: integer("lecturer_id").references(() => lecturers.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 40 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull().default("info"),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  refCode: varchar("ref_code", { length: 80 }),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Database dokumen terpusat: surat tugas, sertifikat, publikasi jurnal, dll.
// File fisik tetap di Google Drive; di sini hanya metadata + tautan.
export const documentRecords = pgTable("document_records", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 60 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  driveUrl: text("drive_url").notNull(),
  documentDate: varchar("document_date", { length: 20 }),
  addedByProfileId: varchar("added_by_profile_id", { length: 64 }),
  addedByName: varchar("added_by_name", { length: 160 }).notNull(),
  addedByRole: varchar("added_by_role", { length: 40 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentContributors = pgTable("document_contributors", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documentRecords.id, { onDelete: "cascade" }),
  lecturerId: integer("lecturer_id").notNull().references(() => lecturers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Pesanan akses Cakrawala.
//
// Tiap baris satu percobaan pembelian: paket yang dipilih, nominal unik yang
// ditagihkan, dan — bila sudah lunas — kode akses yang diterbitkan untuknya.
//
// KENAPA TABEL SENDIRI, BUKAN JSON DI app_settings SEPERTI KODENYA:
// Kode akses jumlahnya sedikit dan hanya berubah ketika pemiliknya mengubahnya.
// Pesanan lahir dari orang lain, kapan saja, dan bisa berbarengan. Menyimpan
// keduanya dalam satu baris JSON berarti dua pesanan yang datang bersamaan
// saling menimpa, dan yang hilang adalah uang yang sudah dibayar.
export const cakrawalaOrders = pgTable("cakrawala_orders", {
  id: serial("id").primaryKey(),
  /** Nomor pesanan yang dipegang mahasiswa, mis. "PSN-7HQ4M2". */
  orderCode: varchar("order_code", { length: 20 }).notNull().unique(),
  packageId: varchar("package_id", { length: 20 }).notNull(),
  packageName: varchar("package_name", { length: 40 }).notNull(),
  /** Harga paket sebelum penanda pesanan ditambahkan. */
  basePrice: integer("base_price").notNull(),
  /** Tiga angka di ekor nominal yang menandai pesanan ini. */
  marker: integer("marker").notNull(),
  /** Yang benar-benar ditagihkan: basePrice + marker. */
  amount: integer("amount").notNull(),
  /** Berapa hari akses berlaku setelah kodenya terbit. */
  days: integer("days").notNull(),
  maxDevices: integer("max_devices").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("menunggu"),
  /** Nama dan kontak bersifat opsional; pesanan tetap sah tanpa keduanya. */
  buyerName: varchar("buyer_name", { length: 120 }),
  buyerContact: varchar("buyer_contact", { length: 120 }),
  /** Kode akses yang diterbitkan ketika pesanan ini lunas. */
  accessCode: varchar("access_code", { length: 40 }),
  /** Siapa yang menandai lunas: "panel" atau nama gerbang pembayarannya. */
  paidVia: varchar("paid_via", { length: 40 }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  /** Sesudah ini nominalnya boleh dipakai pesanan lain. */
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
