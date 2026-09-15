import {
  mockAccessGrants,
  mockAccessRequests,
  mockAuditLog,
  mockPatients,
  mockProvider,
  mockRecords,
  mockStaff,
} from './mockData';
import type {
  AccessGrant,
  AccessRequest,
  AuditEvent,
  MedicalRecord,
  PatientLookupResult,
  ProviderOrganization,
  RecordCategory,
  StaffMember,
} from './types';

/**
 * Mock implementation of the locka-api provider client surface described in
 * the LockA documentation. Every function mirrors a documented endpoint
 * shape (method + path in the comment) so swapping in real `fetch` calls
 * against a live backend later is a drop-in replacement.
 */

const LATENCY_MS = 450;

let provider: ProviderOrganization = { ...mockProvider };
const staff: StaffMember[] = [...mockStaff];
const accessRequests: AccessRequest[] = [...mockAccessRequests];
const accessGrants: AccessGrant[] = [...mockAccessGrants];
const records: MedicalRecord[] = [...mockRecords];
const auditLog: AuditEvent[] = [...mockAuditLog];

function delay<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function pushAudit(entry: Omit<AuditEvent, 'id' | 'timestamp'>) {
  auditLog.unshift({ ...entry, id: newId('audit'), timestamp: new Date().toISOString() });
}

// GET /providers/{id}
export async function getProvider(): Promise<ProviderOrganization> {
  return delay({ ...provider });
}

export async function registerProvider(input: {
  name: string;
  orgType: ProviderOrganization['orgType'];
  stellarAddress: string;
}): Promise<ProviderOrganization> {
  provider = {
    ...provider,
    name: input.name,
    orgType: input.orgType,
    stellarAddress: input.stellarAddress,
    verificationStatus: 'pending',
  };
  return delay({ ...provider });
}

export async function listStaff(): Promise<StaffMember[]> {
  return delay([...staff]);
}

export async function addStaffMember(input: { name: string; email: string; role: StaffMember['role'] }): Promise<StaffMember> {
  const member: StaffMember = { id: newId('staff'), addedAt: new Date().toISOString(), ...input };
  staff.push(member);
  provider = { ...provider, staffCount: staff.length };
  return delay(member);
}

// Patient search by QR code, passport ID, or approved contact method
export async function searchPatients(query: string): Promise<PatientLookupResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return delay([]);
  const results = mockPatients.filter(
    (p) => p.passportId.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q),
  );
  return delay(results);
}

// GET /access-requests
export async function listAccessRequests(): Promise<AccessRequest[]> {
  return delay([...accessRequests].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)));
}

// GET /access-requests/{id}
export async function getAccessRequest(id: string): Promise<AccessRequest | undefined> {
  return delay(accessRequests.find((r) => r.id === id));
}

// POST /access-requests
export async function createAccessRequest(input: {
  patientPassportId: string;
  patientDisplayName: string;
  requestedCategories: RecordCategory[];
  durationDays: number;
  purpose: string;
}): Promise<AccessRequest> {
  const request: AccessRequest = {
    id: newId('req'),
    status: 'pending',
    requestedAt: new Date().toISOString(),
    resolvedAt: null,
    expiresAt: null,
    ...input,
  };
  accessRequests.unshift(request);
  pushAudit({
    type: 'access_requested',
    patientPassportId: input.patientPassportId,
    patientDisplayName: input.patientDisplayName,
    actor: 'You',
    detail: `Requested access to ${input.requestedCategories.length} categories for ${input.durationDays} days`,
  });
  return delay(request);
}

// GET /records
export async function listRecords(): Promise<MedicalRecord[]> {
  return delay([...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export async function viewRecord(id: string): Promise<MedicalRecord | undefined> {
  const record = records.find((r) => r.id === id);
  if (record) {
    pushAudit({
      type: 'record_viewed',
      patientPassportId: record.patientPassportId,
      patientDisplayName: record.patientDisplayName,
      actor: 'You',
      detail: `Viewed ${record.title}`,
    });
  }
  return delay(record);
}

// Mocks the "backend encrypts records before storage; hash submitted to commitment registry" flow:
// derive commitmentHash deterministically from the attached file's bytes instead of at random.
async function hashFileBytes(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return '0x' + Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// POST /records
export async function uploadRecord(input: {
  patientPassportId: string;
  patientDisplayName: string;
  category: RecordCategory;
  title: string;
  notes: string;
  file: File;
}): Promise<MedicalRecord> {
  const { file, ...rest } = input;
  const record: MedicalRecord = {
    id: newId('rec'),
    issuerProviderId: provider.providerId,
    issuerName: provider.name,
    createdAt: new Date().toISOString(),
    commitmentHash: await hashFileBytes(file),
    attachment: { fileName: file.name, fileType: file.type, fileSize: file.size },
    ...rest,
  };
  records.unshift(record);
  pushAudit({
    type: 'record_uploaded',
    patientPassportId: input.patientPassportId,
    patientDisplayName: input.patientDisplayName,
    actor: 'You',
    detail: `Uploaded ${input.title}`,
  });
  return delay(record);
}

// GET /access-grants
export async function listAccessGrants(): Promise<AccessGrant[]> {
  return delay([...accessGrants].sort((a, b) => b.grantedAt.localeCompare(a.grantedAt)));
}

// DELETE /access-grants/{id}
export async function revokeAccessGrant(id: string): Promise<void> {
  const grant = accessGrants.find((g) => g.id === id);
  if (grant) {
    grant.status = 'revoked';
    pushAudit({
      type: 'access_revoked',
      patientPassportId: grant.patientPassportId,
      patientDisplayName: grant.patientDisplayName,
      actor: 'You',
      detail: `Revoked access to ${grant.categories.length} categories`,
    });
  }
  return delay(undefined);
}

// GET /audit-log
export async function getAuditLog(): Promise<AuditEvent[]> {
  return delay([...auditLog].sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
}
