import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PatientSearch } from './PatientSearch';
import { ToastProvider } from '../components/Toast';
import { searchPatients, createAccessRequest } from '../lib/api';
import type { AccessRequest, PatientLookupResult } from '../lib/types';

vi.mock('../lib/api', () => ({
  searchPatients: vi.fn(),
  createAccessRequest: vi.fn(),
}));

const mockSearchPatients = vi.mocked(searchPatients);
const mockCreateAccessRequest = vi.mocked(createAccessRequest);

const activePatient: PatientLookupResult = {
  passportId: 'pp_test01',
  displayName: 'Test Patient',
  passportStatus: 'active',
};

const inactivePatient: PatientLookupResult = {
  passportId: 'pp_test02',
  displayName: 'Inactive Patient',
  passportStatus: 'inactive',
};

function fakeAccessRequest(overrides: Partial<AccessRequest> = {}): AccessRequest {
  return {
    id: 'req_test',
    patientPassportId: activePatient.passportId,
    patientDisplayName: activePatient.displayName,
    requestedCategories: ['lab_result'],
    durationDays: 30,
    purpose: 'Follow-up',
    status: 'pending',
    requestedAt: '2026-07-24T10:15:00Z',
    resolvedAt: null,
    expiresAt: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <ToastProvider>
      <PatientSearch />
    </ToastProvider>,
  );
}

async function runSearch(query: string) {
  fireEvent.change(screen.getByPlaceholderText('Passport ID, name, or contact method…'), {
    target: { value: query },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PatientSearch', () => {
  it('covers the happy path from search input to a success toast, and closes the modal', async () => {
    mockSearchPatients.mockResolvedValue([activePatient]);
    mockCreateAccessRequest.mockResolvedValue(fakeAccessRequest());

    renderPage();

    await runSearch('test patient');
    expect(await screen.findByText('Test Patient')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Request Access' }));
    expect(screen.getByText('Request Access — Test Patient')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lab Result' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '14' } });
    fireEvent.change(screen.getByPlaceholderText('Describe why access is needed…'), {
      target: { value: 'Follow-up consultation' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send Access Request' }));

    await waitFor(() =>
      expect(mockCreateAccessRequest).toHaveBeenCalledWith({
        patientPassportId: activePatient.passportId,
        patientDisplayName: activePatient.displayName,
        requestedCategories: ['lab_result'],
        durationDays: 14,
        purpose: 'Follow-up consultation',
      }),
    );

    expect(await screen.findByText('Access request sent to Test Patient')).toBeInTheDocument();
    expect(screen.queryByText('Request Access — Test Patient')).not.toBeInTheDocument();
  });

  it('shows the empty-results state when nothing matches', async () => {
    mockSearchPatients.mockResolvedValue([]);

    renderPage();
    await runSearch('no-such-patient');

    expect(await screen.findByText('No patients matched “no-such-patient”.')).toBeInTheDocument();
  });

  it('disables the Request Access button for a patient with an inactive passport', async () => {
    mockSearchPatients.mockResolvedValue([inactivePatient]);

    renderPage();
    await runSearch('inactive');

    expect(await screen.findByText('Inactive Patient')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request Access' })).toBeDisabled();
  });

  it('keeps submit disabled until at least one category and a non-empty purpose are provided', async () => {
    mockSearchPatients.mockResolvedValue([activePatient]);

    renderPage();
    await runSearch('test patient');
    await screen.findByText('Test Patient');
    fireEvent.click(screen.getByRole('button', { name: 'Request Access' }));

    const submitButton = screen.getByRole('button', { name: 'Send Access Request' });
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Lab Result' }));
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Describe why access is needed…'), {
      target: { value: '   ' },
    });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Describe why access is needed…'), {
      target: { value: 'Follow-up consultation' },
    });
    expect(submitButton).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Lab Result' }));
    expect(submitButton).toBeDisabled();
  });
});
