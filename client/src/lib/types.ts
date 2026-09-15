export type ProviderVerificationStatus = 'unregistered' | 'pending' | 'verified' | 'suspended';

export type ProviderOrgType = 'hospital' | 'clinic' | 'laboratory' | 'pharmacy' | 'insurer';

export type StaffRole = 'admin' | 'clinician' | 'front_desk';

export interface ProviderOrganization {
  providerId: string;
  name: string;
  orgType: ProviderOrgType;
  verificationStatus: ProviderVerificationStatus;
  stellarAddress: string | null;
  registeredAt: string;
  staffCount: number;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  addedAt: string;
}

export type RecordCategory =
  | 'medical_summary'
  | 'vaccination'
  | 'prescription'
  | 'lab_result'
  | 'diagnosis'
  | 'referral'
  | 'surgery_report'
  | 'insurance';

export const RECORD_CATEGORY_LABELS: Record<RecordCategory, string> = {
  medical_summary: 'Medical Summary',
  vaccination: 'Vaccination Record',
  prescription: 'Prescription',
  lab_result: 'Lab Result',
  diagnosis: 'Diagnosis',
  referral: 'Referral Summary',
  surgery_report: 'Surgery Report',
  insurance: 'Insurance Record',
};

export type AccessRequestStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'revoked';

export interface AccessRequest {
  id: string;
  patientPassportId: string;
  patientDisplayName: string;
  requestedCategories: RecordCategory[];
  durationDays: number;
  purpose: string;
  status: AccessRequestStatus;
  requestedAt: string;
  resolvedAt: string | null;
  expiresAt: string | null;
}

export interface AccessGrant {
  id: string;
  patientPassportId: string;
  patientDisplayName: string;
  categories: RecordCategory[];
  grantedAt: string;
  expiresAt: string;
  status: 'active' | 'expiring_soon' | 'revoked' | 'expired';
}

export interface RecordAttachment {
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface MedicalRecord {
  id: string;
  patientPassportId: string;
  patientDisplayName: string;
  category: RecordCategory;
  title: string;
  issuerProviderId: string;
  issuerName: string;
  createdAt: string;
  commitmentHash: string;
  notes: string;
  attachment: RecordAttachment | null;
}

export type AuditEventType =
  | 'access_requested'
  | 'access_approved'
  | 'access_denied'
  | 'access_revoked'
  | 'record_viewed'
  | 'record_uploaded';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  patientPassportId: string;
  patientDisplayName: string;
  actor: string;
  timestamp: string;
  detail: string;
}

export interface PatientLookupResult {
  passportId: string;
  displayName: string;
  passportStatus: 'active' | 'inactive';
}
