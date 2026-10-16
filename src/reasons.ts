export const REJECT_REASONS = [
  { id: "wrong_role", label: "Wrong role / title" },
  { id: "wrong_location", label: "Wrong location" },
  { id: "too_junior", label: "Too junior / not senior enough" },
  { id: "classic_npi_design", label: "Classic design / NPI only" },
  { id: "wrong_industry", label: "Wrong industry / company fit" },
  { id: "other", label: "Other" },
] as const;

export const ACCEPT_REASONS = [
  { id: "good_role", label: "Right role track" },
  { id: "good_location", label: "Good location" },
  { id: "management_scope", label: "Management / leadership" },
  { id: "smart_mfg", label: "Smart Mfg / systems / automation" },
  { id: "other", label: "Other" },
] as const;

export type RejectReasonId = (typeof REJECT_REASONS)[number]["id"];
export type AcceptReasonId = (typeof ACCEPT_REASONS)[number]["id"];
export type FeedbackReasonId = RejectReasonId | AcceptReasonId;

export function reasonLabel(id: string): string {
  const all = [...REJECT_REASONS, ...ACCEPT_REASONS];
  return all.find((r) => r.id === id)?.label ?? id;
}

export function isRejectReason(id: string): id is RejectReasonId {
  return REJECT_REASONS.some((r) => r.id === id);
}
