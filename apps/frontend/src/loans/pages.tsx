import { useCallback, useEffect, useState } from 'react';
import { requestMessage } from '../lib/api';
import {
  borrowCopy,
  listLoans,
  listMyLoans,
  loanDetail,
  lookupCopies,
  lookupMembers,
  renewLoan,
  returnLoan,
  type CopyCondition,
  type CopyEligibility,
  type Loan,
  type LoanResults,
  type LoanStatus,
  type MemberEligibility,
} from './api';
import { dueDays, loanCanRenew, remainingRenewals } from './access';

type Props = {
  path: string;
  token: string;
  staff: boolean;
  go: (to: string) => void;
  notify: (message: string) => void;
};
const conditions: CopyCondition[] = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];
const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
        dateStyle: 'medium',
      }).format(new Date(value))
    : '—';
const title = (loan: Loan) =>
  document.documentElement.dir === 'rtl'
    ? loan.bookCopy.book.titleAr || loan.bookCopy.book.title
    : loan.bookCopy.book.title;
const authorNames = (loan: Loan) =>
  loan.bookCopy.book.authors
    .map((author) =>
      document.documentElement.dir === 'rtl' ? author.arabicName || author.name : author.name,
    )
    .join(', ');
const BookCover = ({ loan, large = false }: { loan: Loan; large?: boolean }) =>
  loan.bookCopy.book.coverImageUrl ? (
    <img
      className={`cover loan-cover ${large ? 'large' : 'mini'}`}
      src={loan.bookCopy.book.coverImageUrl}
      alt={`Cover of ${title(loan)}`}
    />
  ) : (
    <div
      className={`cover ${large ? 'large' : 'mini'}`}
      role="img"
      aria-label={`No cover available for ${title(loan)}`}
    >
      {title(loan).slice(0, 1)}
    </div>
  );
const status = (loan: Loan) => (
  <span className={`badge loan-${loan.status.toLowerCase()}`}>{loan.status}</span>
);

export function LoanRoute(props: Props): JSX.Element {
  if (props.path === '/librarian/loans/borrow') return <BorrowPage {...props} />;
  if (props.path === '/librarian/returns') return <ReturnsPage {...props} />;
  if (props.path.startsWith('/librarian/loans/'))
    return <LoanDetails {...props} id={props.path.split('/').at(-1)!} />;
  if (props.path.startsWith('/my-loans/'))
    return <LoanDetails {...props} id={props.path.split('/').at(-1)!} />;
  return <LoanList {...props} mine={!props.staff} />;
}

export function LoanList({
  token,
  staff,
  go,
  notify,
  mine,
}: Props & { mine: boolean }): JSX.Element {
  const [result, setResult] = useState<LoanResults | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<LoanStatus | ''>('');
  const load = useCallback(
    async (page = 1) => {
      setError('');
      try {
        setResult(
          await (mine ? listMyLoans : listLoans)({ q, status: filter, page, limit: 10 }, token),
        );
      } catch (e) {
        setError(requestMessage(e));
      }
    },
    [filter, mine, q, token],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const renew = async (loan: Loan) => {
    try {
      const before = loan.dueAt;
      const updated = await renewLoan(loan.id, token);
      notify(`Renewed: ${date(before)} → ${date(updated.dueAt)}`);
      await load(result?.page);
    } catch (e) {
      setError(requestMessage(e));
    }
  };
  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{mine ? 'My circulation' : 'Circulation'}</p>
          <h1>{mine ? 'My loans' : 'Loans'}</h1>
          <p>
            {mine
              ? 'Your borrowing history and renewal eligibility.'
              : 'Search, renew, and return physical copies.'}
          </p>
        </div>
        {staff && (
          <button className="button primary" onClick={() => go('/librarian/loans/borrow')}>
            Borrow a copy
          </button>
        )}
      </div>
      <div className="filter-row">
        <form
          className="management-search"
          onSubmit={(e) => {
            e.preventDefault();
            void load(1);
          }}
        >
          <input
            aria-label="Search loans"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Member, title, copy code, barcode"
          />
          <button className="button quiet">Search</button>
        </form>
        <label className="archive-filter">
          Status
          <select
            aria-label="Loan status"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as LoanStatus | '');
            }}
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="OVERDUE">Overdue</option>
            <option value="RETURNED">Returned</option>
          </select>
        </label>
      </div>
      {!result && !error ? (
        <State title="Loading loans…" />
      ) : error ? (
        <State title={error} retry={() => void load()} />
      ) : !result?.items.length ? (
        <State title="No loans match these filters." />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Book / copy</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Renewals</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((loan) => (
                  <tr key={loan.id}>
                    <td>
                      {mine ? (
                        'Your loan'
                      ) : (
                        <>
                          <strong>{loan.member.fullName}</strong>
                          <br />
                          <span className="muted">{loan.member.email}</span>
                        </>
                      )}
                    </td>
                    <td>
                      <div className="loan-book-summary">
                        <BookCover loan={loan} />
                        <span>
                          <strong>{title(loan)}</strong>
                          <br />
                          <span className="muted">{authorNames(loan) || 'Unknown author'}</span>
                          <br />
                          <span className="muted">{loan.bookCopy.copyCode}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span>Borrowed {date(loan.borrowedAt)}</span>
                      <br />
                      <span>Due {date(loan.dueAt)}</span>
                      {loan.returnedAt && (
                        <>
                          <br />
                          <span>Returned {date(loan.returnedAt)}</span>
                        </>
                      )}
                    </td>
                    <td>{status(loan)}</td>
                    <td>{loan.renewedCount}/2</td>
                    <td className="row-actions">
                      <button
                        className="button quiet"
                        onClick={() => go(`${mine ? '/my-loans' : '/librarian/loans'}/${loan.id}`)}
                      >
                        Details
                      </button>
                      {loanCanRenew(loan) && (
                        <button className="button quiet" onClick={() => void renew(loan)}>
                          Renew
                        </button>
                      )}
                      {staff && loan.status !== 'RETURNED' && (
                        <button
                          className="button primary"
                          onClick={() => go(`/librarian/returns?loan=${loan.id}`)}
                        >
                          Return
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager result={result} change={(page) => void load(page)} />
        </>
      )}
    </section>
  );
}

export function BorrowPage({ token, go, notify }: Props): JSX.Element {
  const [memberQuery, setMemberQuery] = useState('');
  const [members, setMembers] = useState<MemberEligibility[]>([]);
  const [member, setMember] = useState<MemberEligibility | null>(null);
  const [copyValue, setCopyValue] = useState('');
  const [copies, setCopies] = useState<CopyEligibility[]>([]);
  const [copy, setCopy] = useState<CopyEligibility | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Loan | null>(null);
  const findMembers = async () => {
    try {
      setMembers(await lookupMembers(memberQuery, token));
    } catch (e) {
      setError(requestMessage(e));
    }
  };
  const findCopies = async () => {
    try {
      setCopies((await lookupCopies(copyValue, token)).items);
    } catch (e) {
      setError(requestMessage(e));
    }
  };
  const eligibleCopy =
    copy && copy.status === 'AVAILABLE' && !copy.isArchived && !copy.book.isArchived;
  const submit = async () => {
    if (!member?.eligible || !copy || !eligibleCopy || saving) return;
    setSaving(true);
    setError('');
    try {
      const loan = await borrowCopy({ memberId: member.id, bookCopyId: copy.id }, token);
      setCreated(loan);
      notify('Loan created successfully.');
    } catch (e) {
      setError(requestMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Staff workflow</p>
          <h1>Borrow a copy</h1>
          <p>Policy: maximum 5 active loans, 14-day period, and 2 renewals.</p>
        </div>
        <button className="button quiet" onClick={() => go('/librarian/loans')}>
          Back to loans
        </button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="circulation-grid">
        <div className="panel">
          <h2>1. Choose member</h2>
          <form
            className="management-search"
            onSubmit={(e) => {
              e.preventDefault();
              void findMembers();
            }}
          >
            <input
              aria-label="Find member"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Name or email"
            />
            <button className="button quiet">Search</button>
          </form>
          {members.map((item) => (
            <button
              className={`select-card ${member?.id === item.id ? 'selected' : ''}`}
              key={item.id}
              onClick={() => setMember(item)}
            >
              <strong>{item.fullName}</strong>
              <span>{item.email}</span>
              <span>
                {item.status}; verified: {item.emailVerifiedAt ? 'yes' : 'no'}
              </span>
              <span>
                {item.activeLoanCount} active · {item.overdueLoanCount} overdue ·{' '}
                {item.remainingLoanCapacity} remaining
              </span>
              <span className={item.eligible ? 'ok' : 'field-error'}>
                {item.eligible ? 'Eligible' : 'Not eligible'}
              </span>
            </button>
          ))}
        </div>
        <div className="panel">
          <h2>2. Choose copy</h2>
          <form
            className="management-search"
            onSubmit={(e) => {
              e.preventDefault();
              void findCopies();
            }}
          >
            <input
              aria-label="Copy code, barcode, or QR value"
              value={copyValue}
              onChange={(e) => setCopyValue(e.target.value)}
              placeholder="Copy code, barcode, or QR value"
            />
            <button className="button quiet">Find copy</button>
          </form>
          <ScanButton
            onValue={(value) => {
              setCopyValue(value);
              void lookupCopies(value, token)
                .then((r) => setCopies(r.items))
                .catch((e: unknown) => setError(requestMessage(e)));
            }}
            onError={setError}
          />
          {copies.map((item) => (
            <button
              className={`select-card ${copy?.id === item.id ? 'selected' : ''}`}
              key={item.id}
              onClick={() => setCopy(item)}
            >
              <strong>{item.book.title}</strong>
              <span>
                {item.copyCode} · {item.barcode || 'No barcode'}
              </span>
              <span>
                {item.status} · {item.condition}
              </span>
              <span>
                {item.section?.code || '—'} / {item.shelf?.code || '—'}
              </span>
              <span
                className={
                  item.status === 'AVAILABLE' && !item.isArchived && !item.book.isArchived
                    ? 'ok'
                    : 'field-error'
                }
              >
                {item.status === 'AVAILABLE' && !item.isArchived && !item.book.isArchived
                  ? 'Borrowable'
                  : 'Not available to borrow'}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="panel confirmation">
        <h2>3. Confirm</h2>
        <p>{member ? `${member.fullName} (${member.email})` : 'Choose a member.'}</p>
        <p>{copy ? `${copy.book.title} — ${copy.copyCode}` : 'Choose a copy.'}</p>
        <p>Due date will be calculated by the server after 14 days. Staff cannot override it.</p>
        <button
          className="button primary"
          disabled={!member?.eligible || !eligibleCopy || saving}
          onClick={() => void submit()}
        >
          {saving ? 'Borrowing…' : 'Confirm borrow'}
        </button>
        {created && <p className="notice">Created loan due {date(created.dueAt)}.</p>}
      </div>
    </section>
  );
}

export function ReturnsPage({ token, go, notify }: Props): JSX.Element {
  const [q, setQ] = useState('');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selected, setSelected] = useState<Loan | null>(null);
  const [condition, setCondition] = useState<CopyCondition | ''>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<Loan | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('loan');
    if (id)
      void loanDetail(id, token)
        .then(setSelected)
        .catch((e: unknown) => setError(requestMessage(e)));
  }, [token]);
  const find = async () => {
    try {
      const data = await listLoans({ q, page: 1, limit: 10 }, token);
      setLoans(data.items.filter((loan) => loan.status !== 'RETURNED'));
    } catch (e) {
      setError(requestMessage(e));
    }
  };
  const submit = async () => {
    if (!selected || !condition || saving) return;
    setSaving(true);
    try {
      const returned = await returnLoan(
        selected.id,
        { returnCondition: condition, returnNotes: notes || undefined },
        token,
      );
      setSelected(returned);
      setResult(returned);
      setConfirming(false);
      notify(`Returned. Copy is ${returned.bookCopy.status}.`);
    } catch (e) {
      setError(requestMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Staff workflow</p>
          <h1>Return a copy</h1>
          <p>Damaged copies remain unavailable. No fine is calculated here.</p>
        </div>
        <button className="button quiet" onClick={() => go('/librarian/loans')}>
          Loans
        </button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <form
        className="management-search"
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
      >
        <input
          aria-label="Find loan to return"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Member, title, copy code, or barcode"
        />
        <button className="button quiet">Find loan</button>
      </form>
      <ScanButton
        onValue={(value) => {
          setQ(value);
          void listLoans({ q: value, limit: 10 }, token)
            .then((r) => setLoans(r.items.filter((loan) => loan.status !== 'RETURNED')))
            .catch((e: unknown) => setError(requestMessage(e)));
        }}
        onError={setError}
      />
      <div className="circulation-grid">
        {loans.map((loan) => (
          <button className="select-card" key={loan.id} onClick={() => setSelected(loan)}>
            <strong>{title(loan)}</strong>
            <span>
              {loan.member.fullName} · {loan.bookCopy.copyCode}
            </span>
            <span>
              Due {date(loan.dueAt)} · {loan.status}
            </span>
          </button>
        ))}
      </div>
      {selected && (
        <div className="panel return-panel">
          <h2>
            {title(selected)} — {selected.bookCopy.copyCode}
          </h2>
          <p>
            {selected.member.fullName}; borrowed {date(selected.borrowedAt)}, due{' '}
            {date(selected.dueAt)}.{' '}
            {selected.status === 'OVERDUE'
              ? `${Math.abs(dueDays(selected.dueAt))} days overdue.`
              : ''}
          </p>
          <label className="field">
            Return condition
            <select
              aria-label="Return condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value as CopyCondition)}
              required
            >
              <option value="">Choose condition</option>
              {conditions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Return notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button
            className="button primary"
            disabled={!condition || saving || selected.status === 'RETURNED'}
            onClick={() => setConfirming(true)}
          >
            Review return
          </button>
        </div>
      )}
      {confirming && selected && condition && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="return-confirmation-title"
          >
            <h2 id="return-confirmation-title">Confirm book return</h2>
            <p>
              {selected.member.fullName} · {title(selected)} · {selected.bookCopy.copyCode}
            </p>
            <p>
              Return condition: <strong>{condition}</strong>
            </p>
            {notes && <p>Notes: {notes}</p>}
            {condition === 'DAMAGED' && (
              <p className="field-error" role="alert">
                A damaged or maintenance copy will not become available for circulation.
              </p>
            )}
            <div className="form-actions">
              <button
                className="button quiet"
                disabled={saving}
                onClick={() => setConfirming(false)}
              >
                Cancel return
              </button>
              <button className="button primary" disabled={saving} onClick={() => void submit()}>
                {saving ? 'Returning…' : 'Confirm return'}
              </button>
            </div>
          </div>
        </div>
      )}
      {result && (
        <div className="panel return-result" role="status" aria-label="Return result">
          <h2>Loan returned successfully</h2>
          <p>
            {result.member.fullName} · {title(result)} · {result.bookCopy.copyCode}
          </p>
          <dl>
            <div>
              <dt>Returned</dt>
              <dd>{date(result.returnedAt)}</dd>
            </div>
            <div>
              <dt>Return condition</dt>
              <dd>{result.returnCondition || '—'}</dd>
            </div>
            <div>
              <dt>Final copy status</dt>
              <dd>{result.bookCopy.status}</dd>
            </div>
          </dl>
          <p className={result.bookCopy.status === 'AVAILABLE' ? 'notice' : 'field-error'}>
            {result.bookCopy.status === 'AVAILABLE'
              ? 'Available for circulation'
              : 'Unavailable for circulation'}
          </p>
        </div>
      )}
    </section>
  );
}

export function LoanDetails({ id, token, staff, go, notify }: Props & { id: string }): JSX.Element {
  const [loan, setLoan] = useState<Loan | null>(null);
  const [error, setError] = useState('');
  const [renewing, setRenewing] = useState(false);
  const [renewalResult, setRenewalResult] = useState<{ previous: string; current: string } | null>(
    null,
  );
  const load = useCallback(
    () =>
      loanDetail(id, token)
        .then(setLoan)
        .catch((e: unknown) => setError(requestMessage(e))),
    [id, token],
  );
  useEffect(() => {
    void load();
  }, [load]);
  if (!loan && !error)
    return (
      <section className="page">
        <State title="Loading loan…" />
      </section>
    );
  if (error)
    return (
      <section className="page">
        <State title={error} retry={() => void load()} />
      </section>
    );
  if (!loan)
    return (
      <section className="page">
        <State title="Loan not found." />
      </section>
    );
  const renew = async () => {
    if (renewing) return;
    setRenewing(true);
    try {
      const old = loan.dueAt;
      const renewed = await renewLoan(loan.id, token);
      setLoan(renewed);
      setRenewalResult({ previous: old, current: renewed.dueAt });
      notify(`Renewed: ${date(old)} → ${date(renewed.dueAt)}`);
    } catch (e) {
      setError(requestMessage(e));
    } finally {
      setRenewing(false);
    }
  };
  return (
    <section className="page detail">
      <button className="text-button" onClick={() => go(staff ? '/librarian/loans' : '/my-loans')}>
        ← Back
      </button>
      <div className="detail-grid">
        <BookCover loan={loan} large />
        <div>
          <p className="eyebrow">{status(loan)}</p>
          <h1>{title(loan)}</h1>
          <p>{authorNames(loan) || 'Unknown author'}</p>
          <p>
            {loan.bookCopy.copyCode}
            {loan.bookCopy.barcode ? ` · ${loan.bookCopy.barcode}` : ''}
          </p>
          <dl>
            <div>
              <dt>Borrowed / due / returned</dt>
              <dd>
                {date(loan.borrowedAt)} · {date(loan.dueAt)} · {date(loan.returnedAt)}
              </dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>
                {loan.bookCopy.section?.nameEn || '—'} / {loan.bookCopy.shelf?.nameEn || '—'}
              </dd>
            </div>
            <div>
              <dt>Renewals</dt>
              <dd>
                {loan.renewedCount}/2; {remainingRenewals(loan)} remaining
              </dd>
            </div>
            {staff && (
              <div>
                <dt>Staff</dt>
                <dd>
                  Issued by {loan.issuedBy?.fullName || '—'}; returned by{' '}
                  {loan.returnedBy?.fullName || '—'}
                </dd>
              </div>
            )}
            {loan.lastRenewedAt && (
              <div>
                <dt>Last renewed</dt>
                <dd>{date(loan.lastRenewedAt)}</dd>
              </div>
            )}
            {staff && (
              <div>
                <dt>Member</dt>
                <dd>
                  {loan.member.fullName} · {loan.member.email}
                </dd>
              </div>
            )}
            {loan.returnCondition && (
              <div>
                <dt>Return</dt>
                <dd>
                  {loan.returnCondition}; {loan.returnNotes || 'No notes'}
                </dd>
              </div>
            )}
          </dl>
          {loanCanRenew(loan) ? (
            <button className="button primary" disabled={renewing} onClick={() => void renew()}>
              {renewing ? 'Renewing…' : 'Renew loan'}
            </button>
          ) : (
            <p className="notice">
              Renewal unavailable:{' '}
              {loan.status === 'OVERDUE'
                ? 'loan is overdue'
                : loan.status === 'RETURNED'
                  ? 'loan is returned'
                  : 'renewal limit reached'}
              .
            </p>
          )}
          {renewalResult && (
            <p className="notice" role="status">
              Renewal completed: {date(renewalResult.previous)} → {date(renewalResult.current)}.
            </p>
          )}
          {staff && loan.status !== 'RETURNED' && (
            <button
              className="button quiet"
              onClick={() => go(`/librarian/returns?loan=${loan.id}`)}
            >
              Process return
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function ScanButton({
  onValue,
  onError,
}: {
  onValue: (value: string) => void;
  onError: (message: string) => void;
}): JSX.Element {
  const scan = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onError('Camera scanning is not supported here. Use manual entry.');
      return;
    }
    try {
      const BarcodeDetector = (
        window as unknown as {
          BarcodeDetector?: new (options: { formats: string[] }) => {
            detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
          };
        }
      ).BarcodeDetector;
      if (!BarcodeDetector) {
        onError('Barcode scanning is not supported here. Use manual entry.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const result = await new BarcodeDetector({
        formats: ['qr_code', 'code_128', 'ean_13'],
      }).detect(video);
      stream.getTracks().forEach((track) => track.stop());
      const value = result.at(0)?.rawValue?.trim();
      if (value) onValue(value);
      else onError('No valid QR or barcode was detected. Use manual entry.');
    } catch {
      onError('Camera permission was denied. Use manual entry.');
    }
  };
  return (
    <button className="button quiet" type="button" onClick={() => void scan()}>
      Scan QR / barcode
    </button>
  );
}
function State({ title, retry }: { title: string; retry?: () => void }): JSX.Element {
  return (
    <div className="state">
      <h2>{title}</h2>
      {retry && (
        <button className="button quiet" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
function Pager({
  result,
  change,
}: {
  result: LoanResults;
  change: (page: number) => void;
}): JSX.Element {
  return (
    <div className="pagination">
      <button
        className="button quiet"
        disabled={result.page <= 1}
        onClick={() => change(result.page - 1)}
      >
        Previous
      </button>
      <span>
        Page {result.page} of {result.totalPages || 1}
      </span>
      <button
        className="button quiet"
        disabled={result.page >= result.totalPages}
        onClick={() => change(result.page + 1)}
      >
        Next
      </button>
    </div>
  );
}
