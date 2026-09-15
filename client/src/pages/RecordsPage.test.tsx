import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecordsPage } from './RecordsPage';
import { ToastProvider } from '../components/Toast';
import { listRecords, uploadRecord, viewRecord } from '../lib/api';
import type { MedicalRecord } from '../lib/types';

vi.mock('../lib/api', () => ({
  listRecords: vi.fn(),
  uploadRecord: vi.fn(),
  viewRecord: vi.fn(),
}));

const mockListRecords = vi.mocked(listRecords);
const mockUploadRecord = vi.mocked(uploadRecord);
const mockViewRecord = vi.mocked(viewRecord);

const existingRecord: MedicalRecord = {
  id: 'rec_existing',
  patientPassportId: 'pp_existing',
  patientDisplayName: 'Existing Patient',
  category: 'lab_result',
  title: 'Existing Blood Panel',
  issuerProviderId: 'prov_test',
  issuerName: 'Test Hospital',
  createdAt: '2026-07-22T11:00:00Z',
  commitmentHash: '0xexistinghash',
  notes: 'Existing notes.',
};

function renderPage() {
  return render(
    <ToastProvider>
      <RecordsPage />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RecordsPage', () => {
  it('covers the upload flow end to end, including the tab switch back to All Records with a generated commitment hash', async () => {
    const uploaded: MedicalRecord = {
      id: 'rec_new',
      patientPassportId: 'pp_new01',
      patientDisplayName: 'New Patient',
      category: 'medical_summary',
      title: 'New Diagnosis Note',
      issuerProviderId: 'prov_test',
      issuerName: 'Test Hospital',
      createdAt: '2026-07-25T11:00:00Z',
      commitmentHash: '0xnewgeneratedhash',
      notes: 'Some notes',
    };
    mockListRecords.mockResolvedValueOnce([]).mockResolvedValueOnce([uploaded]);
    mockUploadRecord.mockResolvedValue(uploaded);
    mockViewRecord.mockResolvedValue(uploaded);

    const { container } = renderPage();
    await screen.findByText('No records available yet.');

    fireEvent.click(screen.getByRole('button', { name: 'Add Record' }));

    fireEvent.change(screen.getByPlaceholderText('pp_…'), { target: { value: 'pp_new01' } });
    fireEvent.change(screen.getByPlaceholderText('Patient display name'), { target: { value: 'New Patient' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Complete Blood Count Panel'), {
      target: { value: 'New Diagnosis Note' },
    });
    fireEvent.change(container.querySelector('textarea') as HTMLTextAreaElement, {
      target: { value: 'Some notes' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Upload & Commit Hash/ }));

    await waitFor(() =>
      expect(mockUploadRecord).toHaveBeenCalledWith({
        patientPassportId: 'pp_new01',
        patientDisplayName: 'New Patient',
        category: 'medical_summary',
        title: 'New Diagnosis Note',
        notes: 'Some notes',
      }),
    );

    expect(await screen.findByText('Record uploaded and hash committed on-chain')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'All Records' })).toHaveClass('active');
    expect(screen.queryByPlaceholderText('pp_…')).not.toBeInTheDocument();

    const newRow = await screen.findByText('New Diagnosis Note');
    expect(newRow).toBeInTheDocument();

    fireEvent.click(newRow);
    expect(await screen.findByText('Commitment Hash')).toBeInTheDocument();
    expect(screen.getByText('0xnewgeneratedhash')).toBeInTheDocument();
  });

  it('opens the detail modal for an existing record, triggers a record_viewed lookup, and closes on Escape', async () => {
    mockListRecords.mockResolvedValue([existingRecord]);
    mockViewRecord.mockResolvedValue(existingRecord);

    renderPage();
    const row = await screen.findByText('Existing Blood Panel');

    fireEvent.click(row);

    await waitFor(() => expect(mockViewRecord).toHaveBeenCalledWith('rec_existing'));
    expect(await screen.findByText('Commitment Hash')).toBeInTheDocument();
    expect(screen.getByText('0xexistinghash')).toBeInTheDocument();
    expect(screen.getByText('Existing notes.')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByText('Commitment Hash')).not.toBeInTheDocument();
    expect(screen.getByText('Existing Blood Panel')).toBeInTheDocument();
  });

  it('keeps submit disabled until both passport ID and title are provided', async () => {
    mockListRecords.mockResolvedValue([]);

    renderPage();
    await screen.findByText('No records available yet.');
    fireEvent.click(screen.getByRole('button', { name: 'Add Record' }));

    const submitButton = screen.getByRole('button', { name: /Upload & Commit Hash/ });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('pp_…'), { target: { value: 'pp_new01' } });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('pp_…'), { target: { value: '   ' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Complete Blood Count Panel'), {
      target: { value: 'A title' },
    });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('pp_…'), { target: { value: 'pp_new01' } });
    expect(submitButton).not.toBeDisabled();
  });
});
