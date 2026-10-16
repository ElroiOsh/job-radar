import type { FeedbackReasonId } from "./reasons.js";

export type FeedbackVerdict = "relevant" | "not_relevant";

export interface FeedbackEntry {
  jobId: string;
  verdict: FeedbackVerdict;
  title: string;
  company: string;
  location: string;
  source: string;
  url: string;
  tokens: string[];
  /** Structured why — e.g. wrong_role, wrong_location */
  reasons: FeedbackReasonId[];
  note?: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  description: string;
  requirements: string;
  salary?: string;
  url: string;
  postedAt?: string;
  matchScore: number;
  matchReasons: string[];
  isNew: boolean;
  userFeedback?: FeedbackVerdict;
  userFeedbackReasons?: FeedbackReasonId[];
}

export interface Profile {
  candidate: {
    name: string;
    email: string;
    location_home: string;
    summary: string;
  };
  experience_highlights: string[];
  target_roles: string[];
  locations: {
    preferred: string[];
    avoid_unless_strong_match: string[];
  };
  search_queries: string[];
  boost_keywords: string[];
  deprioritize_keywords: string[];
  hard_exclude_keywords: string[];
  min_match_score: number;
  max_jobs_in_email: number;
  max_days_old: number;
}

export interface RunResult {
  generatedAt: string;
  jobs: Job[];
  newCount: number;
  totalCount: number;
}
