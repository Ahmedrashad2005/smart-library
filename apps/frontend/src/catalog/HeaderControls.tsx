import type { FormEvent, ReactNode } from 'react';
import type { PublicLocale } from './public.types';
import { PublicIcon } from './PublicIcon';

type BrandProps = {
  locale: PublicLocale;
  onHome: () => void;
};

export function NawaBrandLogo({ locale, onHome }: BrandProps): JSX.Element {
  return (
    <button
      type="button"
      className="nawa-brand"
      onClick={onHome}
      aria-label={locale === 'ar' ? 'العودة إلى رئيسية نَوَى' : 'Go to the NAWA home page'}
    >
      <img src="/brand/nawa-logo.png" alt="NAWA نَوَى brand logo" />
    </button>
  );
}

type SearchProps = {
  locale: PublicLocale;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
};

export function HeaderSearch({ locale, value, onChange, onSubmit }: SearchProps): JSX.Element {
  const label = locale === 'ar' ? 'البحث في مكتبة نَوَى' : 'Search the NAWA library';
  const placeholder =
    locale === 'ar'
      ? 'ابحث عن كتاب، تقنية، أداة أو موضوع...'
      : 'Search for a book, technology, tool, or topic...';

  return (
    <form className="header-search" role="search" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="header-catalog-search">
        {label}
      </label>
      <input
        id="header-catalog-search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <button type="submit" className="header-search__submit" aria-label={label}>
        <PublicIcon name="search" />
      </button>
    </form>
  );
}

type DropdownPillProps = {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
};

export function HeaderDropdownPill({
  id,
  label,
  open,
  onToggle,
  children,
  disabled = false,
  disabledReason,
}: DropdownPillProps): JSX.Element {
  return (
    <div className="header-dropdown">
      <button
        type="button"
        className="header-dropdown__trigger"
        aria-haspopup="menu"
        aria-expanded={disabled ? undefined : open}
        aria-controls={disabled ? undefined : id}
        aria-label={disabled && disabledReason ? `${label} — ${disabledReason}` : label}
        title={disabledReason}
        disabled={disabled}
        onClick={onToggle}
      >
        <span>{label}</span>
        <PublicIcon name="chevron" />
      </button>
      {!disabled && open && (
        <div id={id} className="header-dropdown__panel" role="menu" aria-label={label}>
          {children}
        </div>
      )}
    </div>
  );
}

type LocationProps = {
  locale: PublicLocale;
  selectedLocation: string;
  open: boolean;
  onToggle: () => void;
  onSelect: (location: string) => void;
};

const locations = {
  ar: ['القاهرة', 'الجيزة', 'الإسكندرية'],
  en: ['Cairo', 'Giza', 'Alexandria'],
} as const;

export function DeliveryLocationButton({
  locale,
  selectedLocation,
  open,
  onToggle,
  onSelect,
}: LocationProps): JSX.Element {
  const label = selectedLocation
    ? locale === 'ar'
      ? `التوصيل إلى: ${selectedLocation}`
      : `Deliver to: ${selectedLocation}`
    : locale === 'ar'
      ? 'حدد موقعك للتوصيل'
      : 'Choose your delivery location';
  const menuLabel = locale === 'ar' ? 'اختيار موقع التوصيل' : 'Choose delivery location';

  return (
    <div className="delivery-selector">
      <button
        type="button"
        className="delivery-selector__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="delivery-location-menu"
        onClick={onToggle}
      >
        <PublicIcon name="location" />
        <span>{label}</span>
        <PublicIcon name="chevron" />
      </button>
      {open && (
        <div
          id="delivery-location-menu"
          className="header-dropdown__panel delivery-selector__panel"
          role="menu"
          aria-label={menuLabel}
        >
          <p>{menuLabel}</p>
          {locations[locale].map((location) => (
            <button type="button" role="menuitem" key={location} onClick={() => onSelect(location)}>
              <PublicIcon name="location" />
              {location}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function HeaderActionButton({
  locale,
  onClick,
}: {
  locale: PublicLocale;
  onClick: () => void;
}): JSX.Element {
  const label = locale === 'ar' ? 'الوصول السريع إلى إعاراتي' : 'Quick access to my loans';
  return (
    <button
      type="button"
      className="header-primary-action"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <PublicIcon name="book" />
    </button>
  );
}
