import type { SessionProfile } from "@/lib/supabase-server";

// Role yang boleh memverifikasi dan menyeleksi pengajuan judul.
export const PRODI_REVIEW_ROLES = ["super_admin", "admin", "admin_prodi"];

export function canReviewProposals(profile: SessionProfile) {
  return PRODI_REVIEW_ROLES.includes(profile.role);
}

export type ProposalChoiceRow = {
  lecturerId: number;
  lecturerName: string;
  studyProgram: string;
  choiceOrder: number;
  selected: boolean;
  decision: string;
  decisionNote: string | null;
  guidanceCount: number;
};
