import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { apiRequest, requestMessage } from '../lib/api';
import {
  DeliveryLocationButton,
  HeaderActionButton,
  HeaderDropdownPill,
  HeaderSearch,
  NawaBrandLogo,
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
    books: 'الكتب',
    categories: 'تصفح الأقسام',
    allCategories: 'كل الأقسام',
    menu: 'فتح قائمة نَوَى',
    closeMenu: 'إغلاق قائمة نَوَى',
    navigation: 'التنقل الرئيسي',
    workspace: 'مساحة العمل',
    myLoans: 'إعاراتي',
    campus: 'مكتبة الكلية',
    loadingCategories: 'جارٍ تحميل الأقسام…',
    categoriesError: 'تعذر تحميل الأقسام.',
  },
  en: {
    home: 'Home',
    books: 'Books',
    categories: 'Browse categories',
    allCategories: 'All categories',
    menu: 'Open NAWA menu',
    closeMenu: 'Close NAWA menu',
    navigation: 'Main navigation',
    workspace: 'Workspace',
    myLoans: 'My loans',
    campus: 'Campus Library',
    loadingCategories: 'Loading categories…',
    categoriesError: 'Categories could not be loaded.',
  },
} as const;

export function MainHeader({ locale, currentPath, session, go }: Props): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [categories, setCategories] = useState<PublicCategory[] | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [search, setSearch] = useState('');
  const labels = copy[locale];

  const closeMenus = () => {
    setMenuOpen(false);
    setCategoryOpen(false);
    setLocationOpen(false);
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
    setLocationOpen(false);
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
        <NawaBrandLogo locale={locale} onHome={() => navigate('/')} />

        <button
          className="public-menu-button"
          type="button"
          aria-label={menuOpen ? labels.closeMenu : labels.menu}
          aria-expanded={menuOpen}
          aria-controls="marketplace-mobile-navigation"
          onClick={() => {
            setMenuOpen((open) => !open);
            setCategoryOpen(false);
            setLocationOpen(false);
          }}
        >
          <PublicIcon name="menu" />
        </button>

        <DeliveryLocationButton
          locale={locale}
          selectedLocation={selectedLocation}
          open={locationOpen}
          onToggle={() => {
            setLocationOpen((open) => !open);
            setCategoryOpen(false);
            setMenuOpen(false);
          }}
          onSelect={(location) => {
            setSelectedLocation(location);
            setLocationOpen(false);
          }}
        />

        <HeaderSearch locale={locale} value={search} onChange={setSearch} onSubmit={submitSearch} />

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
