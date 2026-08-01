import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicHeader } from './PublicHeader';
import type { PublicLocale } from './public.types';

function LanguageHarness(): JSX.Element {
  const [locale, setLocale] = useState<PublicLocale>('en');
  const changeLanguage = () => {
    const next = locale === 'en' ? 'ar' : 'en';
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    setLocale(next);
  };
  return (
    <PublicHeader
      locale={locale}
      currentPath="/books"
      session={null}
      go={vi.fn()}
      onLanguageChange={changeLanguage}
      onSignOut={vi.fn()}
    />
  );
}

describe('PublicHeader', () => {
  beforeEach(() => {
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('renders the public header and active catalog navigation in LTR', () => {
    render(
      <PublicHeader
        locale="en"
        currentPath="/books"
        session={null}
        go={vi.fn()}
        onLanguageChange={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    expect(screen.getByRole('img', { name: 'NAWA نَوَى brand logo' })).toHaveAttribute(
      'src',
      '/brand/nawa-logo.png',
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Books' })).toHaveAttribute('aria-current', 'page');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });

  it('renders localized public navigation in RTL', () => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    render(
      <PublicHeader
        locale="ar"
        currentPath="/books"
        session={{ role: 'MEMBER', fullName: 'قارئ المكتبة' }}
        go={vi.fn()}
        onLanguageChange={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'التنقل الرئيسي' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'الكتب' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'إعاراتي' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('switches the document language and visible navigation copy', async () => {
    const user = userEvent.setup();
    render(<LanguageHarness />);

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('button', { name: 'الكتب' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'العربية' })).toBeInTheDocument();
  });

  it('opens and closes the keyboard-accessible mobile menu', async () => {
    const user = userEvent.setup();
    render(
      <PublicHeader
        locale="en"
        currentPath="/books"
        session={null}
        go={vi.fn()}
        onLanguageChange={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );
    const menu = screen.getByRole('button', { name: 'Open navigation menu' });
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' });

    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(navigation).toHaveClass('is-open');
    await user.keyboard('{Escape}');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(navigation).not.toHaveClass('is-open');
  });

  it('submits the real header search to the catalog route', async () => {
    const go = vi.fn();
    const user = userEvent.setup();
    render(
      <PublicHeader
        locale="en"
        currentPath="/"
        session={null}
        go={go}
        onLanguageChange={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    await user.type(
      screen.getByRole('textbox', { name: 'Search the NAWA library' }),
      'Arabic history',
    );
    await user.click(screen.getByRole('button', { name: 'Search the NAWA library' }));
    expect(go).toHaveBeenCalledWith('/books?q=Arabic%20history');
  });
});
