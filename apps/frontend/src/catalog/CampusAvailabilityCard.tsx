import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { PublicIcon } from './PublicIcon';
import type { PublicLocale } from './public.types';

export type CampusLocation = {
  library: { id: string; code: string; nameEn: string; nameAr: string };
  floor: { id: string; number: number; nameEn: string; nameAr: string };
  room: { id: string; number: string; nameEn: string; nameAr: string };
  shelfLocationCode: string | null;
  sourceCollection: string | null;
};

export type CampusCopy = {
  id: string;
  status: 'AVAILABLE' | 'BORROWED' | 'RESERVED' | 'LOST' | 'DAMAGED' | 'MAINTENANCE';
  condition: 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
  campusLocation: CampusLocation;
};

export type CampusAvailability = {
  hasPhysicalCopies: boolean;
  totalCopies: number;
  availableCopies: number;
  availabilityStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_HELD';
  copies: CampusCopy[];
};

type Props = {
  availability: CampusAvailability;
  locale: PublicLocale;
};

const copy = {
  ar: {
    campus: 'المكتبة الجامعية',
    available: 'متاح للاستعارة',
    unavailable: 'غير متاح حاليًا',
    borrowed: 'مُعار حاليًا',
    maintenance: 'قيد الصيانة',
    damaged: 'غير متاح — نسخة تالفة',
    notHeld: 'هذا الكتاب غير متوفر حاليًا في المكتبة الجامعية.',
    copies: 'النسخ المتاحة',
    location: 'الموقع',
    shelf: 'رقم الكتاب على الرف',
    show: 'عرض المكان',
    details: 'تفاصيل مكان الكتاب',
    collection: 'القسم / المجموعة',
    close: 'إغلاق',
  },
  en: {
    campus: 'University Library',
    available: 'Available to borrow',
    unavailable: 'Currently unavailable',
    borrowed: 'Currently on loan',
    maintenance: 'Under maintenance',
    damaged: 'Unavailable — damaged copy',
    notHeld: 'This book is not currently held by the University Library.',
    copies: 'Available copies',
    location: 'Location',
    shelf: 'Book number on the shelf',
    show: 'View location',
    details: 'Book location details',
    collection: 'Section / source group',
    close: 'Close',
  },
} as const;

function statusText(status: CampusCopy['status'], locale: PublicLocale): string {
  const labels = copy[locale];
  if (status === 'BORROWED') return labels.borrowed;
  if (status === 'MAINTENANCE') return labels.maintenance;
  if (status === 'DAMAGED' || status === 'LOST') return labels.damaged;
  return labels.unavailable;
}

export function CampusAvailabilityCard({ availability, locale }: Props): JSX.Element {
  const [locationOpen, setLocationOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const labels = copy[locale];
  const selectedCopy =
    availability.copies.find((item) => item.status === 'AVAILABLE') ?? availability.copies[0];
  const location = selectedCopy?.campusLocation;
  const localized = (english: string, arabic: string) => (locale === 'ar' ? arabic : english);

  const close = () => {
    setLocationOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };
  useEffect(() => {
    if (!locationOpen) return;
    closeRef.current?.focus();
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [locationOpen]);
  const keepDialogFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      closeRef.current?.focus();
    }
  };

  if (!availability.hasPhysicalCopies || !selectedCopy || !location)
    return (
      <section
        className="campus-availability campus-availability--not-held"
        aria-labelledby="campus-heading"
      >
        <div className="campus-availability__icon" aria-hidden="true">
          <PublicIcon name="book" />
        </div>
        <div>
          <p className="campus-availability__eyebrow">
            {locale === 'ar' ? 'مكتبة جامعة الدلتا' : 'Delta University Library'}
          </p>
          <h2 id="campus-heading">{labels.campus}</h2>
          <p>{labels.notHeld}</p>
        </div>
      </section>
    );

  const isAvailable = availability.availabilityStatus === 'AVAILABLE';
  return (
    <>
      <section className="campus-availability" aria-labelledby="campus-heading">
        <div className="campus-availability__heading">
          <div className="campus-availability__icon" aria-hidden="true">
            <PublicIcon name="book" />
          </div>
          <div>
            <p className="campus-availability__eyebrow">
              {locale === 'ar' ? 'مكتبة جامعة الدلتا' : 'Delta University Library'}
            </p>
            <h2 id="campus-heading">{labels.campus}</h2>
          </div>
          <span className={`campus-status ${isAvailable ? 'is-available' : 'is-unavailable'}`}>
            <span aria-hidden="true">{isAvailable ? '✓' : '!'}</span>
            {isAvailable ? labels.available : statusText(selectedCopy.status, locale)}
          </span>
        </div>
        <dl className="campus-availability__facts">
          <div>
            <dt>{labels.copies}</dt>
            <dd>
              {availability.availableCopies} / {availability.totalCopies}
            </dd>
          </div>
          <div>
            <dt>{labels.location}</dt>
            <dd>
              {localized(location.floor.nameEn, location.floor.nameAr)} —{' '}
              {localized(location.room.nameEn, location.room.nameAr)}
            </dd>
          </div>
          <div>
            <dt>{labels.shelf}</dt>
            <dd dir="ltr">{location.shelfLocationCode ?? '—'}</dd>
          </div>
        </dl>
        <button
          ref={triggerRef}
          type="button"
          className="campus-location-button"
          onClick={() => setLocationOpen(true)}
        >
          <PublicIcon name="location" />
          {labels.show}
        </button>
      </section>

      {locationOpen && (
        <div
          className="campus-dialog-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && close()}
        >
          <section
            className="campus-location-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campus-location-title"
            onKeyDown={keepDialogFocus}
          >
            <div className="campus-location-dialog__heading">
              <div>
                <p className="campus-availability__eyebrow">
                  {locale === 'ar' ? 'مكتبة جامعة الدلتا' : 'Delta University Library'}
                </p>
                <h2 id="campus-location-title">{labels.details}</h2>
              </div>
              <button ref={closeRef} type="button" className="campus-dialog-close" onClick={close}>
                <span aria-hidden="true">×</span>
                <span className="sr-only">{labels.close}</span>
              </button>
            </div>
            <ol className="campus-location-path" aria-label={labels.details}>
              <li>
                <PublicIcon name="book" />
                <span>{labels.campus}</span>
              </li>
              <li>
                <span className="campus-location-path__number">{location.floor.number}</span>
                <span>{localized(location.floor.nameEn, location.floor.nameAr)}</span>
              </li>
              <li>
                <PublicIcon name="location" />
                <span>{localized(location.room.nameEn, location.room.nameAr)}</span>
              </li>
              <li>
                <span className="campus-location-path__number">#</span>
                <span>
                  {labels.shelf}: <b dir="ltr">{location.shelfLocationCode ?? '—'}</b>
                </span>
              </li>
            </ol>
            {location.sourceCollection && (
              <p className="campus-source-collection">
                <span>{labels.collection}</span>
                <b>{location.sourceCollection}</b>
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
