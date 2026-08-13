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

  it('renders the two marketplace rows, approved logo, utilities, and real actions', () => {
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
    expect(screen.getByRole('navigation', { name: 'NAWA utility navigation' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sign in or create an account' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Favorites')).toBeInTheDocument();
    expect(screen.getByText('Branches')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quick access to my loans' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Brands/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Brands')).not.toBeInTheDocument();
  });

  it('renders the approved Arabic-first utility copy and RTL account treatment', () => {
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

    expect(screen.getByRole('button', { name: 'قارئ المكتبة' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'خدمات نَوَى' })).toBeInTheDocument();
    expect(screen.getAllByText('حدد موقعك للتوصيل')).toHaveLength(2);
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
    expect(screen.getByRole('button', { name: 'فتح قائمة نَوَى' })).toBeInTheDocument();
  });

  it('opens and closes the keyboard-accessible mobile navigation', async () => {
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
    const menu = screen.getByRole('button', { name: 'Open NAWA menu' });
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' });

    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(navigation).toHaveClass('is-open');
    await user.keyboard('{Escape}');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(navigation).not.toHaveClass('is-open');

    await user.click(menu);
    await user.click(within(navigation).getByRole('button', { name: 'Campus Library' }));
    expect(go).toHaveBeenCalledWith('/campus');
  });

  it('submits the real marketplace search to the catalog route', async () => {
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
    await user.keyboard('{Enter}');
    expect(go).toHaveBeenCalledWith('/books?q=Arabic%20history');
  });

  it('loads real catalog categories and routes a selected category into the existing filter', async () => {
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

    const trigger = screen.getByRole('button', { name: 'Browse categories', expanded: false });
    await user.click(trigger);
    const menu = await screen.findByRole('menu', { name: 'Browse categories' });
    expect(mockedApi).toHaveBeenCalledWith('/categories');
    await user.click(within(menu).getByRole('menuitem', { name: 'History' }));

    expect(go).toHaveBeenCalledWith('/books?categoryId=history');
  });

  it('exposes Campus Library as a first-class category-menu destination', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Browse categories', expanded: false }));
    const menu = await screen.findByRole('menu', { name: 'Browse categories' });
    await user.click(within(menu).getByRole('menuitem', { name: 'Campus Library' }));

    expect(go).toHaveBeenCalledWith('/campus');
  });

  it('offers only real routes in the NAWA services dropdown', async () => {
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

    const services = screen.getByRole('button', { name: 'NAWA services' });
    expect(services).toHaveAttribute('aria-expanded', 'false');
    await user.click(services);
    const menu = screen.getByRole('menu', { name: 'NAWA services menu' });
    await user.click(within(menu).getByRole('menuitem', { name: 'Borrowing' }));
    expect(go).toHaveBeenCalledWith('/my-loans');
  });

  it('operates the lightweight delivery selector without a backend change', async () => {
    const user = userEvent.setup();
    render(
      <PublicHeader
        locale="en"
        currentPath="/"
        session={null}
        go={vi.fn()}
        onLanguageChange={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Choose your delivery location' }));
    const locations = screen.getByRole('menu', { name: 'Choose delivery location' });
    await user.click(within(locations).getByRole('menuitem', { name: 'Cairo' }));
    expect(screen.getByRole('button', { name: 'Deliver to: Cairo' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('keeps account and sign-out behavior connected to the existing session actions', async () => {
    const go = vi.fn();
    const signOut = vi.fn();
    const user = userEvent.setup();
    render(
      <PublicHeader
        locale="en"
        currentPath="/"
        session={{ role: 'ADMIN', fullName: 'Nawa Admin' }}
        go={go}
        onLanguageChange={vi.fn()}
        onSignOut={signOut}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Nawa Admin' }));
    const accountMenu = screen.getByRole('menu', { name: 'Account menu' });
    await user.click(within(accountMenu).getByRole('menuitem', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(go).not.toHaveBeenCalled();
  });
});
