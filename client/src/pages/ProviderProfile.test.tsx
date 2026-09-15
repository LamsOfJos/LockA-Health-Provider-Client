import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProviderProfile } from './ProviderProfile';
import { ToastProvider } from '../components/Toast';
import { addStaffMember, getProvider, listStaff } from '../lib/api';
import type { ProviderOrganization, StaffMember } from '../lib/types';

vi.mock('../lib/api', () => ({
  getProvider: vi.fn(),
  listStaff: vi.fn(),
  addStaffMember: vi.fn(),
}));

const mockGetProvider = vi.mocked(getProvider);
const mockListStaff = vi.mocked(listStaff);
const mockAddStaffMember = vi.mocked(addStaffMember);

const baseProvider: ProviderOrganization = {
  providerId: 'prov_test01',
  name: 'Test General Hospital',
  orgType: 'hospital',
  verificationStatus: 'verified',
  stellarAddress: 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37',
  registeredAt: '2025-11-03T09:12:00Z',
  staffCount: 2,
};

const adminMember: StaffMember = {
  id: 'staff_1',
  name: 'Dr. Amina Okoye',
  email: 'a.okoye@aventinegeneral.org',
  role: 'admin',
  addedAt: '2025-11-03T09:12:00Z',
};

const clinicianMember: StaffMember = {
  id: 'staff_2',
  name: 'Dr. Kwame Mensah',
  email: 'k.mensah@aventinegeneral.org',
  role: 'clinician',
  addedAt: '2025-11-10T14:30:00Z',
};

const newMember: StaffMember = {
  id: 'staff_3',
  name: 'New Nurse',
  email: 'new.nurse@aventinegeneral.org',
  role: 'front_desk',
  addedAt: '2026-01-15T08:45:00Z',
};

function renderPage() {
  return render(
    <ToastProvider>
      <ProviderProfile />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProviderProfile', () => {
  it('renders organization info correctly', async () => {
    mockGetProvider.mockResolvedValue(baseProvider);
    mockListStaff.mockResolvedValue([adminMember, clinicianMember]);

    renderPage();

    expect(await screen.findByText('Test General Hospital')).toBeInTheDocument();
    expect(screen.getByText('Hospital')).toBeInTheDocument();
    expect(screen.getByText('prov_test01')).toBeInTheDocument();
    expect(screen.getByText(baseProvider.stellarAddress!)).toBeInTheDocument();
    expect(screen.getByText('verified')).toBeInTheDocument();
  });

  it('renders each staff member with the right role badge', async () => {
    mockGetProvider.mockResolvedValue(baseProvider);
    mockListStaff.mockResolvedValue([adminMember, clinicianMember]);

    renderPage();
    await screen.findByText('Dr. Amina Okoye');

    const adminRow = screen.getByText('Dr. Amina Okoye').closest('.flex') as HTMLElement;
    expect(adminRow).toHaveTextContent('a.okoye@aventinegeneral.org');
    expect(adminRow.querySelector('.badge')).toHaveTextContent('Admin');

    const clinicianRow = screen.getByText('Dr. Kwame Mensah').closest('.flex') as HTMLElement;
    expect(clinicianRow).toHaveTextContent('k.mensah@aventinegeneral.org');
    expect(clinicianRow).toHaveTextContent('Clinician');
  });

  it('adds a staff member end to end, updates the list and staffCount, and resets the form', async () => {
    mockGetProvider.mockResolvedValueOnce(baseProvider).mockResolvedValueOnce({ ...baseProvider, staffCount: 3 });
    mockListStaff
      .mockResolvedValueOnce([adminMember, clinicianMember])
      .mockResolvedValueOnce([adminMember, clinicianMember, newMember]);
    mockAddStaffMember.mockResolvedValue(newMember);

    renderPage();
    await screen.findByText('Dr. Amina Okoye');

    expect(screen.getByText('2 members')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Full name'), { target: { value: 'New Nurse' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new.nurse@aventinegeneral.org' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'front_desk' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add Staff' }));

    await waitFor(() =>
      expect(mockAddStaffMember).toHaveBeenCalledWith({
        name: 'New Nurse',
        email: 'new.nurse@aventinegeneral.org',
        role: 'front_desk',
      }),
    );

    expect(await screen.findByText('New Nurse')).toBeInTheDocument();
    expect(await screen.findByText('3 members')).toBeInTheDocument();
    expect(await screen.findByText('Staff member added')).toBeInTheDocument();

    expect(screen.getByPlaceholderText('Full name')).toHaveValue('');
    expect(screen.getByPlaceholderText('Email')).toHaveValue('');
    expect(screen.getByRole('combobox')).toHaveValue('clinician');
  });

  it('keeps Add Staff disabled until both name and email are provided', async () => {
    mockGetProvider.mockResolvedValue(baseProvider);
    mockListStaff.mockResolvedValue([adminMember, clinicianMember]);

    renderPage();
    await screen.findByText('Dr. Amina Okoye');

    const submitButton = screen.getByRole('button', { name: 'Add Staff' });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Full name'), { target: { value: 'New Nurse' } });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: '   ' } });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new.nurse@aventinegeneral.org' } });
    expect(submitButton).not.toBeDisabled();

    expect(mockAddStaffMember).not.toHaveBeenCalled();
  });
});
