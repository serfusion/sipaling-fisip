import { db } from "@/db";
import { documentContributors, documentRecords, lecturers } from "@/db/schema";
import { desc, eq, inArray, ilike, and, sql } from "drizzle-orm";
import { DOCUMENT_CATEGORIES } from "@/lib/academic";
import { getCurrentProfile, type SessionProfile } from "@/lib/supabase-server";
import { pushNotification } from "@/lib/notify";
import { explainServerError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = [
  "super_admin",
  "admin",
  "admin_umum",
  "admin_akademik",
  "admin_prodi",
  "admin_pddikti",
  "admin_perpustakaan",
  "admin_laboratorium",
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  admin_umum: "Admin Umum",
  admin_akademik: "Admin Akademik",
  admin_prodi: "Admin Prodi",
  admin_pddikti: "Admin PDDIKTI",
  admin_perpustakaan: "Admin Perpustakaan",
  admin_laboratorium: "Admin Laboratorium",
  dosen: "Dosen",
};

function canAddDocument(profile: SessionProfile) {
  return ADMIN_ROLES.includes(profile.role);
}

// Hanya tautan Google Drive/Docs yang diterima. Ini juga mencegah tautan
// berskema berbahaya (javascript:, data:) masuk ke database lalu dirender
// sebagai href di panel admin.
function isDriveUrl(value: string) {
  return /^https:\/\/(drive|docs)\.google\.com\/[^\s]*$/i.test(value);
}

export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return Response.json({ success: false, message: "Silakan login terlebih dahulu." }, { status: 401 });
    }
    const params = new URL(request.url).searchParams;
    const category = params.get("category")?.trim() || "";
    const query = params.get("q")?.trim() || "";
    // Dosen tanpa tautan ke data dosen belum bisa dipetakan ke kontributor.
    if (profile.role === "dosen" && profile.lecturerId === null) {
      return Response.json({ success: true, documents: [] });
    }

    // Dosen hanya melihat dokumen yang mencantumkan dirinya sebagai kontributor.
    const contributorScope =
      profile.role === "dosen"
        ? sql`exists (
            select 1 from ${documentContributors}
            where ${documentContributors.documentId} = ${documentRecords.id}
              and ${documentContributors.lecturerId} = ${profile.lecturerId as number}
          )`
        : undefined;

    const rows = await db
      .select()
      .from(documentRecords)
      .where(
        and(
          contributorScope,
          category && (DOCUMENT_CATEGORIES as readonly string[]).includes(category)
            ? eq(documentRecords.category, category)
            : undefined,
          query ? ilike(documentRecords.title, `%${query}%`) : undefined,
        ),
      )
      .orderBy(desc(documentRecords.createdAt))
      .limit(300);

    if (!rows.length) return Response.json({ success: true, documents: [] });

    const contributorRows = await db
      .select({
        documentId: documentContributors.documentId,
        lecturerId: documentContributors.lecturerId,
        lecturerName: lecturers.name,
      })
      .from(documentContributors)
      .innerJoin(lecturers, eq(documentContributors.lecturerId, lecturers.id))
      .where(inArray(documentContributors.documentId, rows.map((row) => row.id)));

    const grouped = new Map<number, Array<{ lecturerId: number; lecturerName: string }>>();
    for (const row of contributorRows) {
      const list = grouped.get(row.documentId) || [];
      list.push({ lecturerId: row.lecturerId, lecturerName: row.lecturerName });
      grouped.set(row.documentId, list);
    }

    return Response.json({
      success: true,
      documents: rows.map((row) => ({ ...row, contributors: grouped.get(row.id) || [] })),
    });
  } catch (error: unknown) {
    console.error("list documents", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Database dokumen belum dapat dimuat.") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || !canAddDocument(profile)) {
      return Response.json({ success: false, message: "Hanya admin yang dapat menambahkan data ke database." }, { status: 403 });
    }
    const body = (await request.json()) as {
      category?: string;
      title?: string;
      description?: string;
      driveUrl?: string;
      documentDate?: string;
      lecturerIds?: number[];
    };

    const category = body.category?.trim() || "";
    const title = body.title?.trim() || "";
    const driveUrl = body.driveUrl?.trim() || "";
    const documentDate = body.documentDate?.trim() || "";

    if (!(DOCUMENT_CATEGORIES as readonly string[]).includes(category)) {
      return Response.json({ success: false, message: "Jenis dokumen belum dipilih." }, { status: 400 });
    }
    if (title.length < 4 || title.length > 400) {
      return Response.json({ success: false, message: "Judul dokumen wajib diisi (4 sampai 400 karakter)." }, { status: 400 });
    }
    if (!isDriveUrl(driveUrl) || driveUrl.length > 800) {
      return Response.json(
        { success: false, message: "Tautan harus berupa link Google Drive/Docs yang valid (diawali https://drive.google.com/ atau https://docs.google.com/)." },
        { status: 400 },
      );
    }
    if (documentDate && !/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) {
      return Response.json({ success: false, message: "Tanggal dokumen tidak valid." }, { status: 400 });
    }

    const lecturerIds = Array.isArray(body.lecturerIds)
      ? Array.from(new Set(body.lecturerIds.filter((id): id is number => Number.isInteger(id) && id > 0))).slice(0, 30)
      : [];

    let validLecturers: Array<{ id: number; name: string }> = [];
    if (lecturerIds.length) {
      validLecturers = await db
        .select({ id: lecturers.id, name: lecturers.name })
        .from(lecturers)
        .where(inArray(lecturers.id, lecturerIds));
      if (validLecturers.length !== lecturerIds.length) {
        return Response.json({ success: false, message: "Salah satu dosen kontributor tidak ditemukan." }, { status: 400 });
      }
    }

    const inserted = await db
      .insert(documentRecords)
      .values({
        category,
        title,
        description: body.description?.trim().slice(0, 2000) || null,
        driveUrl,
        documentDate: documentDate || null,
        addedByProfileId: profile.id,
        addedByName: profile.fullName,
        addedByRole: profile.role,
      })
      .returning();

    const record = inserted[0];
    if (!record) throw new Error("Dokumen gagal disimpan.");

    if (validLecturers.length) {
      await db.insert(documentContributors).values(
        validLecturers.map((lecturer) => ({ documentId: record.id, lecturerId: lecturer.id })),
      );
      const addedBy = ROLE_LABEL[profile.role] || "Admin";
      await Promise.all(
        validLecturers.map((lecturer) =>
          pushNotification({
            lecturerId: lecturer.id,
            kind: "contributor_added",
            severity: "info",
            title: "Anda ditambahkan sebagai kontributor",
            body: `${addedBy} (${profile.fullName}) menambahkan Anda sebagai kontributor pada ${category}: "${title}".`,
          }),
        ),
      );
    }

    return Response.json(
      {
        success: true,
        document: {
          ...record,
          contributors: validLecturers.map((lecturer) => ({ lecturerId: lecturer.id, lecturerName: lecturer.name })),
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("create document", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Dokumen belum tersimpan ke database.") },
      { status: 500 },
    );
  }
}
