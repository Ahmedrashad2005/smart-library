import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../lib/api';
import { PublicHeader } from './PublicHeader';
import type { PublicCategory, PublicLocale } from './public.types';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
  requestMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

const mockedApi = vi.mocked(apiRequest);
const categories: PublicCategory[] = [
  { id: 'history', nameEn: 'History', nameAr: 'التاريخ', slug: 'history' },
  { id: 'science', nameEn: 'Science', nameAr: 'العلوم', slug: 'science' },
];

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
    mockedApi.mockReset();
    mockedApi.mockResolvedValue(categories);
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('makes Delta University Library the primary identity without commercial utilities', () => {
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

    expect(screen.getByRole('img', { name: 'Delta University logo' })).toHaveAttribute(
      'src',
      '/branding/delta-university/delta-university-logo.png',
    );
    expect(screen.getByText('Delta University Library')).toBeInTheDocument();
    expect(screen.getByText('Delta University for Science and Technology')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Delta University Library links' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Main navigation' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Student account sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quick access to my loans' })).toBeInTheDocument();
    expect(
      screen.queryByText(/Favorites|Branches|Delivery|NAWA services/i),
    ).not.toBeInTheDocument();
  });

  it('renders the Arabic institutional identity and student navigation deliberately in RTL', () => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    render(
      <PublicHeader
        locale="ar"
        currentPath="/faculties"
        session={{ role: 'MEMBER', fullName: 'قارئ المكتبة' }}
        go={vi.fn()}
        onLanguageChange={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    expect(screen.getByText('مكتبة جامعة الدلتا')).toBeInTheDocument();
    expect(screen.getByText('جامعة الدلتا للعلوم والتكنولوجيا')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'قارئ المكتبة' })).toBeInTheDocument();
    expect(screen.getAllByText('كليات جامعة الدلتا')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('switches the real document between English LTR and Arabic RTL', async () => {
    const user = userEvent.setup();
    render(<LanguageHarness />);

    await user.click(screen.getByRole('button', { name: 'العربية' }));

    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'فتح قائمة مكتبة جامعة الدلتا' }),
    ).toBeInTheDocument();
  });

  it('opens and closes the keyboard-accessible mobile navigation and routes to faculties', async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    render(
      <PublicHeader
        locale="en"
        currentPath="/books"
        session={null}
        go={go}
        onLanguageChange={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );
    const menu = screen.getByRole('button', { name: 'Open Delta University Library menu' });
    const navigation = screen.getAllByRole('navigation', { name: 'Main navigation' })[1]!;

    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(navigation).toHaveClass('is-open');
    await user.keyboard('{Escape}');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(navigation).not.toHaveClass('is-open');

    await user.click(menu);
    await user.click(within(navigation).getByRole('button', { name: 'Faculties' }));
    expect(go).toHaveBeenCalledWith('/faculties');
  });

  it('submits the real library search to the existing catalog route', async () => {
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
      screen.getByRole('textbox', { name: 'Search Delta University Library' }),
      'Arabic history',
    );
    await user.keyboard('{Enter}');
    expect(go).toHaveBeenCalledWith('/books?q=Arabic%20history');
  });

  it('loads real catalog categories and routes a selected subject into the existing filter', async () => {
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

    const trigger = screen.getByRole('button', { name: 'Subjects & categories', expanded: false });
    await user.click(trigger);
    const menu = await screen.findByRole('menu', { name: 'Subjects & categories' });
    expect(mockedApi).toHaveBeenCalledWith('/categories');
    await user.click(within(menu).getByRole('menuitem', { name: 'History' }));
    expect(go).toHaveBeenCalledWith('/books?categoryId=history');
  });

  it('keeps the existing University Library destination available from the subject menu', async () => {
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

    await user.click(
      screen.getByRole('button', { name: 'Subjects & categories', expanded: false }),
    );
    const menu = await screen.findByRole('menu', { name: 'Subjects & categories' });
    await user.click(within(menu).getByRole('menuitem', { name: 'University Library' }));
    expect(go).toHaveBeenCalledWith('/campus');
  });

  it('keeps account and sign-out behavior connected to the existing session actions', async () => {
    const go = vi.fn();
    const signOut = vi.fn();
    const user = userEvent.setup();
    render(
      <PublicHeader
        locale="en"
        currentPath="/"
        session={{ role: 'ADMIN', fullName: 'Library Admin' }}
        go={go}
        onLanguageChange={vi.fn()}
        onSignOut={signOut}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Library Admin' }));
    const accountMenu = screen.getByRole('menu', { name: 'Student account menu' });
    await user.click(within(accountMenu).getByRole('menuitem', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(go).not.toHaveBeenCalled();
  });

  it('keeps My Loans and My Reservations available to the authenticated member', async () => {
    const go = vi.fn();
    const user = userEvent.setup();
    render(
      <PublicHeader
        locale="en"
        currentPath="/my-reservations"
        session={{ role: 'MEMBER', fullName: 'Delta Member' }}
        go={go}
        onLanguageChange={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delta Member' }));
    const accountMenu = screen.getByRole('menu', { name: 'Student account menu' });
    await user.click(within(accountMenu).getByRole('menuitem', { name: 'My reservations' }));
    expect(go).toHaveBeenCalledWith('/my-reservations');

    await user.click(screen.getByRole('button', { name: 'Open Delta University Library menu' }));
    const navigation = screen.getAllByRole('navigation', { name: 'Main navigation' })[1]!;
    expect(within(navigation).getByRole('button', { name: 'My loans' })).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: 'My Reservations' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('does not expose staff workspace controls to anonymous or member navigation', () => {
    const { rerender } = render(
      <PublicHeader
        locale="en"
        currentPath="/"
        session={null}
        go={vi.fn()}
        onLanguageChange={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Workspace' })).not.toBeInTheDocument();

    rerender(
      <PublicHeader
        locale="en"
        currentPath="/"
        session={{ role: 'MEMBER', fullName: 'Delta Member' }}
        go={vi.fn()}
        onLanguageChange={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Workspace' })).not.toBeInTheDocument();
  });
});
