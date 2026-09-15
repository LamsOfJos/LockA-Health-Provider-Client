import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AccessManagement } from './AccessManagement';
import { ToastProvider } from '../components/Toast';
import { listAccessGrants, listAccessRequests, revokeAccessGrant } from '../lib/api';
import type { AccessGrant, AccessRequest } from '../lib/types';

vi.mock('../lib/api', () => ({
  listAccessGrants: vi.fn(),
  listAccessRequests: vi.fn(),
  revokeAccessGrant: vi.fn(),
}));

const mockListAccessGrants = vi.mocked(listAccessGrants);
const mockListAccessRequests = vi.mocked(listAccessRequests);
const mockRevokeAccessGrant = vi.mocked(revokeAccessGrant);

const activeGrant: AccessGrant = {
  id: 'grant_active',
  patientPassportId: 'pp_active',
  patientDisplayName: 'Active Patient',
  categories: ['lab_result'],
  grantedAt: '2026-06-15T09:00:00Z',
  expiresAt: '2026-12-01T09:00:00Z',
  status: 'active',
};

const expiringGrant: AccessGrant = {
  id: 'grant_expiring',
  patientPassportId: 'pp_expiring',
  patientDisplayName: 'Expiring Patient',
  categories: ['vaccination'],
  grantedAt: '2026-06-15T09:00:00Z',
  expiresAt: '2026-09-20T09:00:00Z',
  status: 'expiring_soon',
};

const expiredGrant: AccessGrant = {
  id: 'grant_expired',
  patientPassportId: 'pp_expired',
  patientDisplayName: 'Expired Patient',
  categories: ['surgery_report'],
  grantedAt: '2026-05-01T09:00:00Z',
  expiresAt: '2026-06-01T09:00:00Z',
  status: 'expired',
};

const revokedGrant: AccessGrant = {
  id: 'grant_revoked',
  patientPassportId: 'pp_revoked',
  patientDisplayName: 'Revoked Patient',
  categories: ['diagnosis'],
  grantedAt: '2026-04-01T09:00:00Z',
  expiresAt: '2026-05-01T09:00:00Z',
  status: 'revoked',
};

const sampleRequest: AccessRequest = {
  id: 'req_sample',
  patientPassportId: 'pp_requester',
  patientDisplayName: 'Requesting Patient',
  requestedCategories: ['prescription'],
  durationDays: 14,
  purpose: 'Test purpose',
  status: 'pending',
  requestedAt: '2026-07-01T09:00:00Z',
  resolvedAt: null,
  expiresAt: null,
};

function renderPage() {
  return render(
    <ToastProvider>
      <AccessManagement />
    </ToastProvider>,
  );
}

function getCard(name: string) {
  return screen.getByText(name).closest('.glass') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccessManagement', () => {
  it('revokes an active grant end to end, showing a loading state on the button and an info toast', async () => {
    let resolveRevoke!: () => void;
    mockRevokeAccessGrant.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRevoke = () => resolve(undefined);
        }),
    );
    mockListAccessGrants.mockResolvedValueOnce([activeGrant]).mockResolvedValueOnce([
      { ...activeGrant, status: 'revoked' },
    ]);
    mockListAccessRequests.mockResolvedValue([]);

    renderPage();
    await screen.findByText('Active Patient');

    const revokeButton = screen.getByRole('button', { name: 'Revoke' });
    fireEvent.click(revokeButton);

    expect(revokeButton).toBeDisabled();
    expect(revokeButton.querySelector('.spinner')).toBeInTheDocument();
    expect(mockRevokeAccessGrant).toHaveBeenCalledWith('grant_active');

    await act(async () => {
      resolveRevoke();
    });

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument());
    expect(within(getCard('Active Patient')).getByText('revoked')).toBeInTheDocument();
    expect(await screen.findByText('Access to Active Patient revoked')).toBeInTheDocument();
  });

  it('switches between the Active Grants and My Access Requests tabs', async () => {
    mockListAccessGrants.mockResolvedValue([activeGrant]);
    mockListAccessRequests.mockResolvedValue([sampleRequest]);

    renderPage();
    await screen.findByText('Active Patient');

    expect(screen.getByRole('button', { name: 'Active Grants' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'My Access Requests' })).not.toHaveClass('active');
    expect(screen.queryByText('Requesting Patient')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'My Access Requests' }));

    expect(screen.getByRole('button', { name: 'My Access Requests' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Active Grants' })).not.toHaveClass('active');
    expect(screen.getByText('Requesting Patient')).toBeInTheDocument();
    expect(screen.queryByText('Active Patient')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Active Grants' }));

    expect(screen.getByText('Active Patient')).toBeInTheDocument();
    expect(screen.queryByText('Requesting Patient')).not.toBeInTheDocument();
  });

  it('only shows the Revoke button for active/expiring_soon grants, never for expired or revoked ones', async () => {
    mockListAccessGrants.mockResolvedValue([activeGrant, expiringGrant, expiredGrant, revokedGrant]);
    mockListAccessRequests.mockResolvedValue([]);

    renderPage();
    await screen.findByText('Active Patient');

    expect(within(getCard('Active Patient')).getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
    expect(within(getCard('Expiring Patient')).getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
    expect(within(getCard('Expired Patient')).queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    expect(within(getCard('Revoked Patient')).queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
  });
});
