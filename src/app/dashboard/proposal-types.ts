export type ProposalChoice = {
  lecturerId: number;
  lecturerName: string;
  studyProgram: string;
  choiceOrder: number;
  selected: boolean;
  decision: string;
  decisionNote: string | null;
  guidanceCount: number;
};

export type ProposalRow = {
  id: number;
  code: string;
  nim: string;
  studentName: string;
  address: string | null;
  studyProgram: string;
  concentration: string;
  gpa: string;
  finalTaskType: string;
  title: string;
  statement: string;
  contact: string | null;
  paymentFileName: string | null;
  financeVerified: boolean;
  eligibilityVerified: boolean;
  status: string;
  approvedLecturerId: number | null;
  prodiNote: string | null;
  lecturerNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  choices: ProposalChoice[];
};

export type NotificationRow = {
  id: number;
  kind: string;
  severity: string;
  title: string;
  body: string;
  refCode: string | null;
  readAt: string | null;
  createdAt: string;
};

export type DocumentRow = {
  id: number;
  category: string;
  title: string;
  description: string | null;
  driveUrl: string;
  documentDate: string | null;
  addedByName: string;
  addedByRole: string;
  createdAt: string;
  contributors: Array<{ lecturerId: number; lecturerName: string }>;
};

export function formatStamp(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}
