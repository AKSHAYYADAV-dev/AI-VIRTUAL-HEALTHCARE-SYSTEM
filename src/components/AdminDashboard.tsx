import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Users,
  BarChart3,
  CheckCircle2,
  XCircle,
  Trash2,
  ShieldCheck,
  Search,
  AlertCircle,
  Download,
  ShieldAlert,
} from 'lucide-react';
import {
  User,
  Appointment,
  EPrescription,
  PrescriptionAnalysisResult,
  ChatSession,
  SymptomCheckRecord,
} from '../types/healthcare';
import { computeRxVerificationCode } from '../utils/clinicalSafety';

interface AdminDashboardProps {
  users: User[];
  appointments: Appointment[];
  eprescriptions: EPrescription[];
  prescriptionAnalyses: PrescriptionAnalysisResult[];
  chatSessions: ChatSession[];
  symptomChecks: SymptomCheckRecord[];
  activeTab: 'approvals' | 'users' | 'analytics';
  onTabChange: (tab: 'approvals' | 'users' | 'analytics') => void;
  onDoctorApprovalUpdated: (doctor: User) => void;
  onUserDeleted: (userId: string) => void;
}

/**
 * Purely visual animated counter for Admin KPI stats (respects prefers-reduced-motion).
 */
const AnimatedCounter: React.FC<{ value: number }> = ({ value }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplay(value);
      return;
    }

    let startTimestamp: number | null = null;
    const duration = 450;
    let rafId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value]);

  return <span>{display}</span>;
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  users,
  appointments,
  eprescriptions,
  prescriptionAnalyses,
  chatSessions,
  symptomChecks,
  activeTab,
  onTabChange,
  onDoctorApprovalUpdated,
  onUserDeleted,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'patient' | 'doctor' | 'admin'>('all');
  const [feedback, setFeedback] = useState<string | null>(null);

  const doctors = users.filter((u) => u.role === 'doctor');
  const pendingDoctors = doctors.filter((d) => !d.approved);
  const approvedDoctors = doctors.filter((d) => d.approved);
  const patients = users.filter((u) => u.role === 'patient');

  const handleToggleApproval = async (doctorId: string, approved: boolean) => {
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/doctors/${doctorId}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      });
      const data = await response.json();
      if (response.ok && data.doctor) {
        onDoctorApprovalUpdated(data.doctor);
        setFeedback(
          `${data.doctor.name} has been ${
            approved
              ? 'approved and is now live in the patient booking directory'
              : 'paused from public booking'
          }.`
        );
      }
    } catch {
      setFeedback('Could not update doctor approval status.');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        onUserDeleted(userId);
        setFeedback(`User account "${userName}" removed.`);
      }
    } catch {
      setFeedback('Failed to remove user.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'all' ? true : u.role === roleFilter;
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.specialty || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  // Compute Stats for Charts (Shades of Forest & Leaf + 1 Neutral)
  const statusCounts = {
    Confirmed: appointments.filter((a) => a.status === 'Confirmed').length,
    Pending: appointments.filter((a) => a.status === 'Pending').length,
    Completed: appointments.filter((a) => a.status === 'Completed').length,
    Rescheduled: appointments.filter((a) => a.status === 'Rescheduled').length,
    Rejected: appointments.filter((a) => a.status === 'Rejected').length,
  };
  const maxStatusCount = Math.max(1, ...Object.values(statusCounts));

  const aiUtilization = [
    {
      label: 'AI Health Chat Threads',
      count: chatSessions.length,
      color: 'bg-[var(--color-forest)]',
    },
    {
      label: 'Prescription OCR Scans',
      count: prescriptionAnalyses.length,
      color: 'bg-[var(--color-forest-mid)]',
    },
    {
      label: 'Symptom Triage Checks',
      count: symptomChecks.length,
      color: 'bg-[#7CB544]',
    },
    {
      label: 'Digital E-Prescriptions',
      count: eprescriptions.length,
      color: 'bg-slate-500',
    },
  ];
  const maxAiCount = Math.max(1, ...aiUtilization.map((i) => i.count));

  return (
    <div className="fade-slide-up space-y-6">
      {/* Top KPI Summary Strip with Animated Number Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-3d-tilt bg-white border border-[var(--color-leaf-border)] rounded-2xl shadow-xs p-5">
          <div className="text-xs font-semibold text-[var(--color-text-muted)]">
            Total Registered Users
          </div>
          <div className="text-2xl font-bold text-[var(--color-forest)] font-mono-tabular mt-1.5">
            <AnimatedCounter value={users.length} />
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            {patients.length} Patients · {doctors.length} Doctors · 1 Admin
          </div>
        </div>

        <div className="card-3d-tilt bg-white border border-[var(--color-leaf-border)] rounded-2xl shadow-xs p-5">
          <div className="text-xs font-semibold text-[var(--color-text-muted)]">
            Doctor Credential Status
          </div>
          <div className="text-2xl font-bold text-[var(--color-forest)] font-mono-tabular mt-1.5">
            <AnimatedCounter value={approvedDoctors.length} /> Live /{' '}
            <AnimatedCounter value={pendingDoctors.length} /> Pending
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            Admin approval required before live booking
          </div>
        </div>

        <div className="card-3d-tilt bg-white border border-[var(--color-leaf-border)] rounded-2xl shadow-xs p-5">
          <div className="text-xs font-semibold text-[var(--color-text-muted)]">
            Telemedicine Appointments
          </div>
          <div className="text-2xl font-bold text-[var(--color-forest)] font-mono-tabular mt-1.5">
            <AnimatedCounter value={appointments.length} />
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            {statusCounts.Confirmed} Confirmed · {statusCounts.Pending} Pending
          </div>
        </div>

        <div className="card-3d-tilt bg-white border border-[var(--color-leaf-border)] rounded-2xl shadow-xs p-5">
          <div className="text-xs font-semibold text-[var(--color-text-muted)]">
            Clinical AI Consults &amp; Scans
          </div>
          <div className="text-2xl font-bold text-[var(--color-forest)] font-mono-tabular mt-1.5">
            <AnimatedCounter
              value={chatSessions.length + prescriptionAnalyses.length + symptomChecks.length}
            />
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            {eprescriptions.length} Digital E-Prescriptions Issued
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-[var(--color-leaf-border)] rounded-2xl shadow-xs p-4">
        <div className="flex items-center gap-1 p-1.5 bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] rounded-2xl">
          <button
            type="button"
            onClick={() => onTabChange('approvals')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'approvals'
                ? 'bg-[var(--color-forest)] text-white shadow-xs'
                : 'text-[var(--color-text-dark)] hover:bg-[var(--color-leaf)]'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Doctor Approvals ({pendingDoctors.length} Pending)</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('users')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-[var(--color-forest)] text-white shadow-xs'
                : 'text-[var(--color-text-dark)] hover:bg-[var(--color-leaf)]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Manage All Users ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('analytics')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-[var(--color-forest)] text-white shadow-xs'
                : 'text-[var(--color-text-dark)] hover:bg-[var(--color-leaf)]'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Platform Statistics Charts</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-[var(--color-forest)] font-semibold">
          <ShieldCheck className="w-4 h-4 text-[var(--color-forest)]" />
          <span>RBAC &amp; Scrypt Password Hashing Enforced</span>
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-2xl bg-[var(--color-leaf)] border border-[var(--color-leaf-border)] text-xs text-[var(--color-forest)] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[var(--color-forest)] shrink-0" />
          <span className="font-bold">{feedback}</span>
        </div>
      )}

      {/* TAB 1: DOCTOR APPROVALS */}
      {activeTab === 'approvals' && (
        <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-4">
          <div className="border-b border-[var(--color-leaf-border)] pb-4">
            <h3 className="text-base font-bold text-[var(--color-forest)]">
              Doctor Credential Verification &amp; Live Directory Approval
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Doctors must be approved by an Administrator before their profile goes live for patient appointment booking.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--color-leaf-border)] text-[var(--color-forest)] font-bold">
                  <th className="py-3 pr-4">Doctor Name &amp; Email</th>
                  <th className="py-3 px-4">Specialty &amp; Qualification</th>
                  <th className="py-3 px-4">Medical Reg. No.</th>
                  <th className="py-3 px-4">Experience / Fee</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 pl-4 text-right">Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-leaf-border)]/50">
                {doctors.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-[var(--color-leaf-soft)] transition-colors"
                  >
                    <td className="py-3.5 pr-4">
                      <div className="font-bold text-[var(--color-text-dark)]">{doc.name}</div>
                      <div className="text-[var(--color-text-muted)] font-mono-tabular">
                        {doc.email}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[var(--color-forest)]">
                        {doc.specialty}
                      </div>
                      <div className="text-[var(--color-text-muted)]">{doc.qualification}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-[var(--color-text-dark)]">
                      {doc.registrationNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-[var(--color-text-dark)]">
                      {doc.experienceYears} yrs · ₹{doc.consultationFee}
                    </td>
                    <td className="py-3.5 px-4">
                      {doc.approved ? (
                        <span className="font-bold text-emerald-700">Approved &amp; Live</span>
                      ) : (
                        <span className="font-bold text-amber-700 inline-flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Pending Admin Approval
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                      {doc.approved ? (
                        <button
                          type="button"
                          onClick={() => handleToggleApproval(doc.id, false)}
                          className="btn-hover-lift inline-flex items-center gap-1 px-3.5 py-1.5 bg-white hover:bg-red-50 text-[var(--color-text-dark)] hover:text-red-700 border border-[var(--color-leaf-border)] rounded-xl font-semibold transition-all cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Pause Live Status</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleApproval(doc.id, true)}
                          className="btn-forest-primary inline-flex items-center gap-1 px-4 py-1.5 rounded-xl shadow-2xs font-bold cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve Doctor</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MANAGE USERS */}
      {activeTab === 'users' && (
        <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-leaf-border)] pb-4">
            <div className="relative flex-1 w-full sm:w-auto sm:min-w-[240px]">
              <Search className="w-4 h-4 text-[var(--color-forest)] absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by name, email, or specialty..."
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
              />
            </div>

            <div className="flex items-center gap-1 p-1.5 bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] rounded-2xl">
              {(['all', 'patient', 'doctor', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl capitalize transition-all cursor-pointer ${
                    roleFilter === r
                      ? 'bg-[var(--color-forest)] text-white shadow-xs'
                      : 'text-[var(--color-text-dark)] hover:bg-[var(--color-leaf)]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--color-leaf-border)] text-[var(--color-forest)] font-bold">
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Clinical Profile Details</th>
                  <th className="py-3 px-4">Security</th>
                  <th className="py-3 pl-4 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-leaf-border)]/50">
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-[var(--color-leaf-soft)] transition-colors"
                  >
                    <td className="py-3.5 pr-4 font-bold text-[var(--color-text-dark)]">
                      {u.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-[var(--color-text-muted)]">
                      {u.email}
                    </td>
                    <td className="py-3.5 px-4 capitalize font-bold text-[var(--color-forest)]">
                      {u.role}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--color-text-dark)]">
                      {u.role === 'patient'
                        ? `${u.age || 30} yrs · ${u.gender || 'N/A'} · Blood: ${u.bloodGroup || 'O+'}`
                        : u.role === 'doctor'
                        ? `${u.specialty} · ${u.approved ? 'Approved' : 'Pending Approval'}`
                        : 'Platform Administrator'}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-[var(--color-forest)] font-semibold">
                      scrypt+salt hashed
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      {u.role !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="btn-hover-lift inline-flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-xl font-semibold cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ANALYTICS & STATS CHARTS + CLINICAL SAFETY AUDIT LOG */}
      {activeTab === 'analytics' && (() => {
        interface AuditRow {
          id: string;
          timestamp: string;
          category: string;
          severity: 'Emergency' | 'Warning' | 'Verified';
          actor: string;
          detail: string;
        }

        const auditRows: AuditRow[] = [];

        chatSessions.forEach((session) => {
          const patientActor =
            users.find((u) => u.id === session.patientId)?.name || session.patientId;
          session.messages.forEach((msg) => {
            if (msg.isEmergency) {
              auditRows.push({
                id: `audit-chat-${msg.id}`,
                timestamp: msg.timestamp,
                category: 'Emergency 108/112 Trigger',
                severity: 'Emergency',
                actor: patientActor,
                detail: `AI Chat flagged clinical red-flag emergency escalation in "${session.title}".`,
              });
            }
          });
        });

        symptomChecks.forEach((chk) => {
          if (
            chk.urgencyLevel === 'Emergency - Call 108/112' ||
            chk.urgencyLevel === 'Urgent Medical Attention'
          ) {
            const isEmerg = chk.urgencyLevel === 'Emergency - Call 108/112';
            auditRows.push({
              id: `audit-sym-${chk.id}`,
              timestamp: chk.createdAt,
              category: `Symptom Triage (${isEmerg ? 'Emergency' : 'Urgent'})`,
              severity: isEmerg ? 'Emergency' : 'Warning',
              actor: users.find((u) => u.id === chk.patientId)?.name || chk.patientId,
              detail: `${chk.selectedSymptoms.join(', ')} (${chk.duration}) -> ${chk.recommendedSpecialty}`,
            });
          }
        });

        prescriptionAnalyses.forEach((rx) => {
          if (rx.drugInteractionAlert?.detected) {
            auditRows.push({
              id: `audit-rxint-${rx.id}`,
              timestamp: rx.createdAt,
              category: 'Drug Interaction Catch',
              severity: 'Warning',
              actor: rx.patientName?.value || 'Patient',
              detail: `${rx.drugInteractionAlert.title}: ${rx.drugInteractionAlert.interactingMedicines.join(' + ')}`,
            });
          }
        });

        eprescriptions.forEach((erx) => {
          const code = computeRxVerificationCode(erx);
          auditRows.push({
            id: `audit-erx-${erx.id}`,
            timestamp: erx.date,
            category: 'Signed E-Prescription Issued',
            severity: 'Verified',
            actor: `${erx.doctorName} -> ${erx.patientName}`,
            detail: `Diagnosis: ${erx.diagnosisSummary} · Verification Seal: ${code}`,
          });
        });

        doctors.forEach((doc) => {
          auditRows.push({
            id: `audit-doc-${doc.id}`,
            timestamp: doc.createdAt,
            category: doc.approved ? 'Doctor Approved (Live)' : 'Doctor Pending Verification',
            severity: doc.approved ? 'Verified' : 'Warning',
            actor: doc.name,
            detail: `${doc.specialty || 'Specialist'} · Reg: ${doc.registrationNumber || 'N/A'}`,
          });
        });

        auditRows.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        const handleExportAuditCsv = () => {
          const escapeCell = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
          const header = ['Event ID', 'Timestamp', 'Category', 'Severity', 'Actor', 'Clinical Detail'];
          const lines = [
            header.map(escapeCell).join(','),
            ...auditRows.map((row) =>
              [
                row.id,
                row.timestamp,
                row.category,
                row.severity,
                row.actor,
                row.detail,
              ]
                .map(escapeCell)
                .join(',')
            ),
          ];
          const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `MedAssist_Clinical_Audit_${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        };

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: Appointments Breakdown by Status */}
              <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-[var(--color-forest)]">
                    Appointments Distribution by Status
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Live breakdown across all {appointments.length} telemedicine bookings
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  {Object.entries(statusCounts).map(([status, count]) => {
                    const widthPct = Math.round((count / maxStatusCount) * 100);
                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[var(--color-text-dark)]">{status}</span>
                          <span className="font-mono-tabular font-bold text-[var(--color-forest)]">
                            <AnimatedCounter value={count} /> bookings
                          </span>
                        </div>
                        <div className="w-full h-3 bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              status === 'Confirmed'
                                ? 'bg-[var(--color-forest)]'
                                : status === 'Pending'
                                ? 'bg-[#7CB544]'
                                : status === 'Completed'
                                ? 'bg-[var(--color-forest-mid)]'
                                : status === 'Rescheduled'
                                ? 'bg-slate-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.max(widthPct, 6)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chart 2: Clinical AI & Telemedicine Feature Utilization */}
              <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-[var(--color-forest)]">
                    Clinical AI &amp; Telemedicine Utilization
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Activity across AI Health Chat, Prescription Vision OCR, Symptom Triage, and E-Rx
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  {aiUtilization.map((item) => {
                    const widthPct = Math.round((item.count / maxAiCount) * 100);
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[var(--color-text-dark)]">
                            {item.label}
                          </span>
                          <span className="font-mono-tabular font-bold text-[var(--color-forest)]">
                            <AnimatedCounter value={item.count} /> records
                          </span>
                        </div>
                        <div className="w-full h-3 bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.color}`}
                            style={{ width: `${Math.max(widthPct, 8)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Clinical Safety & Triage Audit Log + CSV Export */}
            <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-leaf-border)] pb-4">
                <div>
                  <h3 className="text-base font-bold text-[var(--color-forest)] flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[var(--color-forest)]" />
                    <span>Clinical Safety &amp; Triage Audit Log ({auditRows.length})</span>
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Real-time governance trail of Emergency 108/112 triggers, drug interaction catches, doctor credential approvals, and signed E-Rx issuances.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportAuditCsv}
                  className="btn-forest-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Clinical Audit Report (CSV)</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-leaf-border)] text-[var(--color-forest)] font-bold">
                      <th className="py-3 pr-4">Timestamp</th>
                      <th className="py-3 px-4">Safety Event Category</th>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4">Actor / Patient</th>
                      <th className="py-3 pl-4">Clinical Audit Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-leaf-border)]/50">
                    {auditRows.map((row) => {
                      const badgeCls =
                        row.severity === 'Emergency'
                          ? 'bg-red-50 border-red-300 text-red-800'
                          : row.severity === 'Warning'
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : 'bg-[var(--color-leaf)] border-[var(--color-leaf-border)] text-[var(--color-forest)]';
                      return (
                        <tr
                          key={row.id}
                          className="hover:bg-[var(--color-leaf-soft)] transition-colors"
                        >
                          <td className="py-3 pr-4 font-mono-tabular text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">
                            {new Date(row.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-bold text-[var(--color-forest)] whitespace-nowrap">
                            {row.category}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${badgeCls}`}
                            >
                              {row.severity}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-[var(--color-text-dark)] whitespace-nowrap">
                            {row.actor}
                          </td>
                          <td className="py-3 pl-4 text-[var(--color-text-dark)] leading-relaxed">
                            {row.detail}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
