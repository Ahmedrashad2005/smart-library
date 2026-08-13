import { useState } from 'react';

type Props = {
  url?: string | null;
  title: string;
  author?: string;
  coverLabel: string;
  noCoverLabel: string;
  variantKey: string;
  loading?: 'eager' | 'lazy';
};

function coverVariant(key: string): number {
  return (
    Array.from(key).reduce((total, character) => total + (character.codePointAt(0) ?? 0), 0) % 4
  );
}

function coverTitle(title: string): string {
  const characters = Array.from(title.trim());
  return characters.length > 36 ? `${characters.slice(0, 35).join('')}…` : title;
}

/**
 * Shared public-catalog cover media. Real cover images remain the source of truth;
 * missing or broken images receive a deterministic, book-shaped NAWA fallback.
 */
export function BookCoverMedia({
  url,
  title,
  author = '',
  coverLabel,
  noCoverLabel,
  variantKey,
  loading = 'lazy',
}: Props): JSX.Element {
  const [failed, setFailed] = useState(false);
  const variant = coverVariant(variantKey);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={coverLabel}
        loading={loading}
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`book-cover-fallback shelf-no-cover shelf-no-cover--${variant + 1}`}
      role="img"
      aria-label={noCoverLabel}
    >
      <span className="fallback-cover__brand" aria-hidden="true">
        <i />
        <b>نَوَى</b>
      </span>
      <strong dir="auto" aria-hidden="true">
        {coverTitle(title)}
      </strong>
      {author && (
        <small dir="auto" aria-hidden="true">
          {author}
        </small>
      )}
      <span className="fallback-cover__lines" aria-hidden="true" />
    </span>
  );
}
