import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { apiRequest, requestMessage } from '../lib/api';
import {
  DeltaUniversityBrand,
  HeaderActionButton,
  HeaderDropdownPill,
  HeaderSearch,
} from './HeaderControls';
import { PublicIcon } from './PublicIcon';
import {
  publicCategoryName,
  type PublicCategory,
  type PublicLocale,
  type PublicSession,
} from './public.types';

type Props = {
  locale: PublicLocale;
  currentPath: string;
  session: PublicSession | null;
  go: (to: string) => void;
};

const copy = {
  ar: {
    home: 'الرئيسية',
    books: 'فهرس الكتب',
    faculties: 'الكليات',
    categories: 'التخصصات والموضوعات',
    allCategories: 'كل الأقسام',
    menu: 'فتح قائمة مكتبة جامعة الدلتا',
    closeMenu: 'إغلاق قائمة مكتبة جامعة الدلتا',
    navigation: 'التنقل الرئيسي',
    workspace: 'مساحة العمل',
    myLoans: 'إعاراتي',
    myReservations: 'حجوزاتي',
    campus: 'المكتبة الجامعية',
    loadingCategories: 'جارٍ تحميل الأقسام…',
    categoriesError: 'تعذر تحميل الأقسام.',
  },
  en: {
    home: 'Home',
    books: 'Book catalog',
    faculties: 'Faculties',
    categories: 'Subjects & categories',
    allCategories: 'All categories',
    menu: 'Open Delta University Library menu',
    closeMenu: 'Close Delta University Library menu',
    navigation: 'Main navigation',
    workspace: 'Workspace',
    myLoans: 'My loans',
    myReservations: 'My Reservations',
    campus: 'University Library',
    loadingCategories: 'Loading categories…',
    categoriesError: 'Categories could not be loaded.',
  },
} as const;

export function MainHeader({ locale, currentPath, session, go }: Props): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categories, setCategories] = useState<PublicCategory[] | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [search, setSearch] = useState('');
  const labels = copy[locale];

  const closeMenus = () => {
    setMenuOpen(false);
    setCategoryOpen(false);
  };
  const navigate = (to: string) => {
    closeMenus();
    go(to);
  };
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/books?q=${encodeURIComponent(query)}` : '/books');
  };
  const navigateToCategories = () => {
    navigate('/books#categories');
    window.setTimeout(() => document.getElementById('categories')?.scrollIntoView?.(), 0);
  };
  const selectCategory = (categoryId: string) => {
    navigate(`/books?categoryId=${encodeURIComponent(categoryId)}`);
  };
  const toggleCategories = () => {
    const opening = !categoryOpen;
    setCategoryOpen(opening);
    setMenuOpen(false);
    if (!opening || categories !== null || categoryLoading) return;
    setCategoryLoading(true);
    setCategoryError('');
    void apiRequest<PublicCategory[]>('/categories')
      .then(setCategories)
      .catch((reason: unknown) => setCategoryError(requestMessage(reason)))
      .finally(() => setCategoryLoading(false));
  };
  const current = (path: string) =>
    currentPath === path || (path !== '/' && currentPath.startsWith(`${path}/`))
      ? 'page'
      : undefined;
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') closeMenus();
  };

  return (
    <div className="main-header" onKeyDown={handleKeyDown}>
      <div className="main-header__inner">
        <DeltaUniversityBrand locale={locale} onHome={() => navigate('/')} />

        <button
          className="public-menu-button"
          type="button"
          aria-label={menuOpen ? labels.closeMenu : labels.menu}
          aria-expanded={menuOpen}
          aria-controls="marketplace-mobile-navigation"
          onClick={() => {
            setMenuOpen((open) => !open);
            setCategoryOpen(false);
          }}
        >
          <PublicIcon name="menu" />
        </button>

        <button
          type="button"
          className="header-campus-pill"
          aria-current={current('/campus')}
          onClick={() => navigate('/campus')}
        >
          <PublicIcon name="location" />
          <span>{labels.campus}</span>
          <PublicIcon name="chevron" />
        </button>

        <HeaderSearch locale={locale} value={search} onChange={setSearch} onSubmit={submitSearch} />

        <nav className="delta-primary-nav" aria-label={labels.navigation}>
          <button aria-current={current('/books')} onClick={() => navigate('/books')}>
            <PublicIcon name="book" />
            {labels.books}
          </button>
          <button aria-current={current('/faculties')} onClick={() => navigate('/faculties')}>
            <PublicIcon name="categories" />
            {labels.faculties}
          </button>
        </nav>

        <div className="header-dropdown--categories">
          <HeaderDropdownPill
            id="header-categories-menu"
            label={labels.categories}
            open={categoryOpen}
            onToggle={toggleCategories}
          >
            <button type="button" role="menuitem" onClick={navigateToCategories}>
              <PublicIcon name="categories" />
              {labels.allCategories}
            </button>
            <button
              type="button"
              role="menuitem"
              className="header-campus-entry"
              onClick={() => navigate('/campus')}
            >
              <PublicIcon name="book" />
              {labels.campus}
            </button>
            {categoryLoading && (
              <p role="status" className="header-dropdown__status">
                {labels.loadingCategories}
              </p>
            )}
            {categoryError && (
              <p role="alert" className="header-dropdown__status is-error">
                {labels.categoriesError}
              </p>
            )}
            {categories?.map((category) => (
              <button
                type="button"
                role="menuitem"
                key={category.id}
                onClick={() => selectCategory(category.id)}
              >
                <PublicIcon name="book" />
                {publicCategoryName(category, locale)}
              </button>
            ))}
          </HeaderDropdownPill>
        </div>

        <HeaderActionButton locale={locale} onClick={() => navigate('/my-loans')} />

        <nav
          id="marketplace-mobile-navigation"
          className={`marketplace-mobile-nav${menuOpen ? ' is-open' : ''}`}
          aria-label={labels.navigation}
        >
          <button aria-current={current('/')} onClick={() => navigate('/')}>
            <PublicIcon name="offer" />
            {labels.home}
          </button>
          <button aria-current={current('/books')} onClick={() => navigate('/books')}>
            <PublicIcon name="book" />
            {labels.books}
          </button>
          <button aria-current={current('/faculties')} onClick={() => navigate('/faculties')}>
            <PublicIcon name="categories" />
            {labels.faculties}
          </button>
          <button aria-current={current('/campus')} onClick={() => navigate('/campus')}>
            <PublicIcon name="book" />
            {labels.campus}
          </button>
          <button onClick={navigateToCategories}>
            <PublicIcon name="categories" />
            {labels.categories}
          </button>
          <button onClick={() => navigate('/my-loans')}>
            <PublicIcon name="history" />
            {labels.myLoans}
          </button>
          {session?.role === 'MEMBER' && (
            <button
              aria-current={current('/my-reservations')}
              onClick={() => navigate('/my-reservations')}
            >
              <PublicIcon name="book" />
              {labels.myReservations}
            </button>
          )}
          {session && session.role !== 'MEMBER' && (
            <button
              onClick={() =>
                navigate(session.role === 'ADMIN' ? '/admin/categories' : '/librarian/books')
              }
            >
              <PublicIcon name="account" />
              {labels.workspace}
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
