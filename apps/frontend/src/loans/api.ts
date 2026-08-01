import { apiRequest } from '../lib/api';

export type LoanStatus = 'ACTIVE' | 'OVERDUE' | 'RETURNED';
export type CopyCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
export type Loan = {
  id: string;
  status: LoanStatus;
  borrowedAt: string;
  dueAt: string;
  returnedAt?: string | null;
  renewedCount: number;
  lastRenewedAt?: string | null;
  returnCondition?: CopyCondition | null;
  returnNotes?: string | null;
  member: { id: string; fullName: string; email: string; membershipNumber?: string };
  bookCopy: {
    id: string;
    copyCode: string;
    barcode?: string | null;
    status: string;
    condition: CopyCondition;
    isArchived?: boolean;
    book: {
      id: string;
      title: string;
      titleAr?: string | null;
      slug?: string;
      coverImageUrl?: string | null;
      authors: Array<{ id: string; name: string; arabicName?: string | null }>;
    };
    section?: { code: string; nameEn: string } | null;
    shelf?: { code: string; nameEn: string } | null;
  };
  issuedBy?: { id: string; fullName: string } | null;
  returnedBy?: { id: string; fullName: string } | null;
};
export type LoanResults = {
  items: Loan[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
export type MemberEligibility = {
  id: string;
  fullName: string;
  email: string;
  membershipNumber: string;
  status: string;
  emailVerifiedAt?: string | null;
  activeLoanCount: number;
  overdueLoanCount: number;
  remainingLoanCapacity: number;
  eligible: boolean;
};
export type CopyEligibility = {
  id: string;
  copyCode: string;
  barcode?: string | null;
  qrCodeValue?: string;
  status: string;
  condition: CopyCondition;
  isArchived: boolean;
  book: { id: string; title: string; titleAr?: string | null; isArchived?: boolean };
  section?: { code: string; nameEn: string };
  shelf?: { code: string; nameEn: string };
};
export type LoanFilters = Partial<
  Record<
    | 'q'
    | 'status'
    | 'memberId'
    | 'bookId'
    | 'copyId'
    | 'borrowedFrom'
    | 'borrowedTo'
    | 'dueFrom'
    | 'dueTo',
    string
  >
> & { page?: number; limit?: number };
export type BorrowRequest = {
  memberId: string;
  bookCopyId?: string;
  copyCode?: string;
  barcode?: string;
  qrCodeValue?: string;
};
export type ReturnRequest = { returnCondition: CopyCondition; returnNotes?: string };

const query = (filters: LoanFilters) => {
  const values = new URLSearchParams();
  Object.entries(filters).forEach(
    ([key, value]) => value !== undefined && value !== '' && values.set(key, String(value)),
  );
  return values.toString();
};
export const listLoans = (filters: LoanFilters, token: string) =>
  apiRequest<LoanResults>(`/loans?${query(filters)}`, {}, token);
export const listMyLoans = (filters: LoanFilters, token: string) =>
  apiRequest<LoanResults>(`/loans/me?${query(filters)}`, {}, token);
export const loanDetail = (id: string, token: string) =>
  apiRequest<Loan>(`/loans/${id}`, {}, token);
export const borrowCopy = (payload: BorrowRequest, token: string) =>
  apiRequest<Loan>('/loans/borrow', { method: 'POST', body: JSON.stringify(payload) }, token);
export const returnLoan = (id: string, payload: ReturnRequest, token: string) =>
  apiRequest<Loan>(`/loans/${id}/return`, { method: 'POST', body: JSON.stringify(payload) }, token);
export const renewLoan = (id: string, token: string) =>
  apiRequest<Loan>(`/loans/${id}/renew`, { method: 'POST' }, token);
export const lookupMembers = (q: string, token: string) =>
  apiRequest<MemberEligibility[]>(`/users/members?q=${encodeURIComponent(q)}`, {}, token);
export const lookupCopies = (q: string, token: string) =>
  apiRequest<{ items: CopyEligibility[] }>(
    `/book-copies?q=${encodeURIComponent(q)}&archiveState=all&limit=10`,
    {},
    token,
  );
