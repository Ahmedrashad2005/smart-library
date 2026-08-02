import type { ReactNode } from 'react';
import { PublicIcon, type PublicIconName } from './PublicIcon';

type Props = {
  icon: PublicIconName;
  label: string;
  onClick?: () => void;
  title?: string;
  ariaLabel?: string;
  expanded?: boolean;
  controls?: string;
  suffix?: ReactNode;
};

function contents(icon: PublicIconName, label: string, suffix?: ReactNode): JSX.Element {
  return (
    <>
      <PublicIcon name={icon} />
      <span className="utility-item__label">{label}</span>
      {suffix}
    </>
  );
}

export function UtilityHeaderItem({
  icon,
  label,
  onClick,
  title,
  ariaLabel,
  expanded,
  controls,
  suffix,
}: Props): JSX.Element {
  if (onClick)
    return (
      <button
        type="button"
        className="utility-item"
        title={title}
        aria-label={ariaLabel}
        aria-expanded={expanded}
        aria-controls={controls}
        onClick={onClick}
      >
        {contents(icon, label, suffix)}
      </button>
    );

  return (
    <span className="utility-item utility-item--static" title={title} aria-label={ariaLabel}>
      {contents(icon, label, suffix)}
    </span>
  );
}
