import type { Timestamp } from "firebase/firestore";

export type InternshipStatus =
  | "applied"
  | "online_assessment"
  | "interview"
  | "offer"
  | "rejected";

export interface Internship {
  id: string;
  company: string;
  role: string;
  status: InternshipStatus;
  notes?: string;
  createdAt?: Timestamp | null;
}
