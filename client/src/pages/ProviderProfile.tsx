import { useEffect, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { Spinner } from '../components/Spinner';
import { Badge, statusToBadgeTone } from '../components/Badge';
import { addStaffMember, getProvider, listStaff } from '../lib/api';
import { useToast } from '../components/Toast';
import { formatDateOnly } from '../lib/format';
import type { ProviderOrganization, StaffMember } from '../lib/types';

const ORG_TYPE_LABELS: Record<ProviderOrganization['orgType'], string> = {
  hospital: 'Hospital',
  clinic: 'Clinic',
  laboratory: 'Laboratory',
  pharmacy: 'Pharmacy',
  insurer: 'Insurance Company',
};

const STAFF_ROLE_LABELS: Record<StaffMember['role'], string> = {
  admin: 'Admin',
  clinician: 'Clinician',
  front_desk: 'Front Desk',
};

export function ProviderProfile() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<ProviderOrganization | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);

  async function reload() {
    setLoading(true);
    const [prov, staffList] = await Promise.all([getProvider(), listStaff()]);
    setProvider(prov);
    setStaff(staffList);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  if (loading || !provider) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Provider Profile</h1>
        <p className="text-slate-400 text-sm">Organization details, verification status, and staff account management.</p>
      </div>

      <GlassCard className="p-5 mb-6">
        <div className="section-header">Organization</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <Info label="Name" value={provider.name} />
          <Info label="Type" value={ORG_TYPE_LABELS[provider.orgType]} />
          <Info label="Provider ID" value={provider.providerId} mono />
          <Info label="Stellar Address" value={provider.stellarAddress ?? '—'} mono />
          <Info label="Registered" value={formatDateOnly(provider.registeredAt)} />
          <div>
            <div className="text-xs text-slate-500 mb-1">Verification Status</div>
            <Badge tone={statusToBadgeTone(provider.verificationStatus)}>{provider.verificationStatus}</Badge>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="section-header !mb-0 !border-0 !pb-0">Staff Accounts</div>
          <span className="text-xs text-slate-500">
            {provider.staffCount} member{provider.staffCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className="space-y-3 mb-5">
          {staff.map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm text-white font-medium">{member.name}</div>
                <div className="text-xs text-slate-500">{member.email}</div>
              </div>
              <Badge tone="cyan">{STAFF_ROLE_LABELS[member.role]}</Badge>
            </div>
          ))}
        </div>
        <AddStaffForm
          onAdded={() => {
            toast('success', 'Staff member added');
            reload();
          }}
        />
      </GlassCard>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-slate-200 ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</div>
    </div>
  );
}

function AddStaffForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffMember['role']>('clinician');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    await addStaffMember({ name: name.trim(), email: email.trim(), role });
    setSubmitting(false);
    setName('');
    setEmail('');
    setRole('clinician');
    onAdded();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 border-t border-blue-900/20 pt-4">
      <input className="input-field" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input-field" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <select className="input-field sm:max-w-[10rem]" value={role} onChange={(e) => setRole(e.target.value as StaffMember['role'])}>
        <option value="admin">Admin</option>
        <option value="clinician">Clinician</option>
        <option value="front_desk">Front Desk</option>
      </select>
      <button
        type="submit"
        disabled={submitting || !name.trim() || !email.trim()}
        className="btn-secondary rounded-lg px-4 py-2 whitespace-nowrap flex items-center justify-center gap-2"
      >
        {submitting && <Spinner size={12} />}
        Add Staff
      </button>
    </form>
  );
}
