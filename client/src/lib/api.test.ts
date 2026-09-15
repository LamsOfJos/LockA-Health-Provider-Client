import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Api from './api';

/**
 * api.ts holds its fixtures in module-level mutable state, so each test
 * resets the module registry and re-imports it fresh to avoid cross-test
 * pollution. Every call goes through an artificial ~450ms `delay()`; fake
 * timers + advanceTimersByTimeAsync flush that deterministically instead of
 * waiting on real time.
 */

let api: typeof Api;

async function flush<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(1000);
  return promise;
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  api = await import('./api');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getProvider', () => {
  it('returns the seeded provider', async () => {
    const provider = await flush(api.getProvider());
    expect(provider.providerId).toBe('prov_8f2a1c4e9b');
    expect(provider.verificationStatus).toBe('verified');
  });
});

describe('registerProvider', () => {
  it('updates org fields and resets verification status to pending', async () => {
    const updated = await flush(
      api.registerProvider({ name: 'New Clinic', orgType: 'clinic', stellarAddress: 'GNEWADDRESS' }),
    );
    expect(updated).toMatchObject({
      name: 'New Clinic',
      orgType: 'clinic',
      stellarAddress: 'GNEWADDRESS',
      verificationStatus: 'pending',
    });

    const fetched = await flush(api.getProvider());
    expect(fetched.name).toBe('New Clinic');
  });
});

describe('listStaff / addStaffMember', () => {
  it('listStaff returns the seeded staff list', async () => {
    const staff = await flush(api.listStaff());
    expect(staff).toHaveLength(4);
    expect(staff.map((s) => s.id)).toContain('staff_1');
  });

  it('addStaffMember appends a member and increments provider.staffCount', async () => {
    const before = await flush(api.listStaff());
    const providerBefore = await flush(api.getProvider());

    const member = await flush(
      api.addStaffMember({ name: 'Jane Doe', email: 'jane@example.com', role: 'clinician' }),
    );
    expect(member).toMatchObject({ name: 'Jane Doe', email: 'jane@example.com', role: 'clinician' });
    expect(member.id).toMatch(/^staff_/);

    const after = await flush(api.listStaff());
    expect(after).toHaveLength(before.length + 1);

    const providerAfter = await flush(api.getProvider());
    expect(providerAfter.staffCount).toBe(providerBefore.staffCount + 1);
  });
});

describe('searchPatients', () => {
  it('matches by display name, case-insensitively', async () => {
    const results = await flush(api.searchPatients('chidinma'));
    expect(results).toHaveLength(1);
    expect(results[0].displayName).toBe('Chidinma Eze');
  });

  it('matches by passport id, case-insensitively', async () => {
    const results = await flush(api.searchPatients('PP_7B2CD415'));
    expect(results).toHaveLength(1);
    expect(results[0].passportId).toBe('pp_7b2cd415');
  });

  it('returns an empty array for a blank query without matching every patient', async () => {
    const results = await flush(api.searchPatients('   '));
    expect(results).toEqual([]);
  });

  it('returns an empty array when nothing matches', async () => {
    const results = await flush(api.searchPatients('no-such-patient'));
    expect(results).toEqual([]);
  });
});

describe('access requests', () => {
  it('listAccessRequests returns requests sorted newest-first', async () => {
    const requests = await flush(api.listAccessRequests());
    const timestamps = requests.map((r) => r.requestedAt);
    expect(timestamps).toEqual([...timestamps].sort().reverse());
  });

  it('getAccessRequest finds a request by id and returns undefined for an unknown id', async () => {
    const found = await flush(api.getAccessRequest('req_1001'));
    expect(found?.patientDisplayName).toBe('Chidinma Eze');

    const missing = await flush(api.getAccessRequest('does-not-exist'));
    expect(missing).toBeUndefined();
  });

  it('createAccessRequest adds a pending request and logs an access_requested audit event', async () => {
    const before = await flush(api.listAccessRequests());

    const created = await flush(
      api.createAccessRequest({
        patientPassportId: 'pp_test',
        patientDisplayName: 'Test Patient',
        requestedCategories: ['lab_result'],
        durationDays: 14,
        purpose: 'Testing',
      }),
    );
    expect(created.status).toBe('pending');
    expect(created.resolvedAt).toBeNull();
    expect(created.expiresAt).toBeNull();

    const after = await flush(api.listAccessRequests());
    expect(after).toHaveLength(before.length + 1);
    expect(after[0].id).toBe(created.id);

    const audit = await flush(api.getAuditLog());
    expect(audit[0]).toMatchObject({
      type: 'access_requested',
      patientDisplayName: 'Test Patient',
    });
  });
});

describe('records', () => {
  it('listRecords returns records sorted newest-first', async () => {
    const records = await flush(api.listRecords());
    const timestamps = records.map((r) => r.createdAt);
    expect(timestamps).toEqual([...timestamps].sort().reverse());
  });

  it('viewRecord returns the record and logs a record_viewed audit event', async () => {
    const viewed = await flush(api.viewRecord('rec_3001'));
    expect(viewed?.title).toBe('Complete Blood Count Panel');

    const audit = await flush(api.getAuditLog());
    expect(audit[0]).toMatchObject({
      type: 'record_viewed',
      patientPassportId: 'pp_3a91ee02',
      detail: 'Viewed Complete Blood Count Panel',
    });
  });

  it('viewRecord on an unknown id returns undefined and logs nothing', async () => {
    const auditBefore = await flush(api.getAuditLog());
    const viewed = await flush(api.viewRecord('does-not-exist'));
    expect(viewed).toBeUndefined();

    const auditAfter = await flush(api.getAuditLog());
    expect(auditAfter).toHaveLength(auditBefore.length);
  });

  // jsdom's File/Blob.arrayBuffer() relies on a real timer captured before fake
  // timers are installed, so it never resolves under vi.useFakeTimers() — these
  // two tests opt back into real timers instead of the flush() helper.
  it('uploadRecord derives a deterministic commitment hash from the file, prepends the record, and logs an audit event', async () => {
    vi.useRealTimers();
    const before = await api.listRecords();

    const file = new File(['test file content'], 'report.pdf', { type: 'application/pdf' });
    const uploaded = await api.uploadRecord({
      patientPassportId: 'pp_test',
      patientDisplayName: 'Test Patient',
      category: 'diagnosis',
      title: 'Test Diagnosis',
      notes: 'Some notes',
      file,
    });
    expect(uploaded.commitmentHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(uploaded.attachment).toEqual({ fileName: 'report.pdf', fileType: 'application/pdf', fileSize: file.size });
    expect(uploaded.issuerProviderId).toBe('prov_8f2a1c4e9b');
    expect(uploaded.issuerName).toBe('St. Aventine General Hospital');

    const after = await api.listRecords();
    expect(after).toHaveLength(before.length + 1);
    expect(after[0].id).toBe(uploaded.id);

    const audit = await api.getAuditLog();
    expect(audit[0]).toMatchObject({ type: 'record_uploaded', detail: 'Uploaded Test Diagnosis' });
  }, 10000);

  it('uploadRecord derives the same commitment hash for identical file bytes, and a different one for different bytes', async () => {
    vi.useRealTimers();
    const uploadedA = await api.uploadRecord({
      patientPassportId: 'pp_test',
      patientDisplayName: 'Test Patient',
      category: 'diagnosis',
      title: 'Diagnosis A',
      notes: '',
      file: new File(['identical bytes'], 'a.pdf', { type: 'application/pdf' }),
    });
    const uploadedB = await api.uploadRecord({
      patientPassportId: 'pp_test',
      patientDisplayName: 'Test Patient',
      category: 'diagnosis',
      title: 'Diagnosis B',
      notes: '',
      file: new File(['identical bytes'], 'b.pdf', { type: 'application/pdf' }),
    });
    const uploadedC = await api.uploadRecord({
      patientPassportId: 'pp_test',
      patientDisplayName: 'Test Patient',
      category: 'diagnosis',
      title: 'Diagnosis C',
      notes: '',
      file: new File(['different bytes'], 'c.pdf', { type: 'application/pdf' }),
    });

    expect(uploadedB.commitmentHash).toBe(uploadedA.commitmentHash);
    expect(uploadedC.commitmentHash).not.toBe(uploadedA.commitmentHash);
  }, 10000);
});

describe('access grants', () => {
  it('listAccessGrants returns grants sorted newest-first', async () => {
    const grants = await flush(api.listAccessGrants());
    const timestamps = grants.map((g) => g.grantedAt);
    expect(timestamps).toEqual([...timestamps].sort().reverse());
  });

  it('revokeAccessGrant flips status to revoked and logs an access_revoked audit event', async () => {
    const grants = await flush(api.listAccessGrants());
    const target = grants.find((g) => g.id === 'grant_2002')!;
    expect(target.status).toBe('active');

    await flush(api.revokeAccessGrant(target.id));

    const after = await flush(api.listAccessGrants());
    const updated = after.find((g) => g.id === target.id);
    expect(updated?.status).toBe('revoked');

    const audit = await flush(api.getAuditLog());
    expect(audit[0]).toMatchObject({
      type: 'access_revoked',
      patientPassportId: target.patientPassportId,
      detail: `Revoked access to ${target.categories.length} categories`,
    });
  });

  it('revokeAccessGrant on an unknown id resolves without throwing and logs nothing', async () => {
    const auditBefore = await flush(api.getAuditLog());

    await expect(flush(api.revokeAccessGrant('does-not-exist'))).resolves.toBeUndefined();

    const auditAfter = await flush(api.getAuditLog());
    expect(auditAfter).toHaveLength(auditBefore.length);
  });
});

describe('getAuditLog', () => {
  it('returns events sorted newest-first', async () => {
    const audit = await flush(api.getAuditLog());
    const timestamps = audit.map((a) => a.timestamp);
    expect(timestamps).toEqual([...timestamps].sort().reverse());
  });
});
