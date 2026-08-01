import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import type { PublicLocale, PublicSession } from './public.types';
import { PublicIcon } from './PublicIcon';

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
    categories: 'الأقسام',
    authors: 'المؤلفون',
    publishers: 'دار النشر',
    articles: 'المقالات',
    search: 'ابحث عن كتاب، مؤلف أو موضوع...',
    searchLabel: 'البحث في مكتبة نَوَى',
    allCategories: 'جميع الأقسام',
    menu: 'فتح قائمة التنقل',
    navigation: 'التنقل الرئيسي',
    later: 'يتوفر في مرحلة لاحقة',
    workspace: 'مساحة العمل',
    myLoans: 'إعاراتي',
  },
  en: {
    home: 'Home',
    books: 'Books',
    categories: 'Categories',
    authors: 'Authors',
    publishers: 'Publishers',
    articles: 'Articles',
    search: 'Search for a book, author, or topic...',
    searchLabel: 'Search the NAWA library',
    allCategories: 'All categories',
    menu: 'Open navigation menu',
    navigation: 'Main navigation',
    later: 'Available in a later phase',
    workspace: 'Workspace',
    myLoans: 'My loans',
  },
} as const;

export function MainHeader({ locale, currentPath, session, go }: Props): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const labels = copy[locale];
  const navigate = (to: string) => {
    setMenuOpen(false);
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
  const current = (path: string) =>
    currentPath === path || (path !== '/' && currentPath.startsWith(`${path}/`))
      ? 'page'
      : undefined;
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') setMenuOpen(false);
  };

  return (
    <div className="main-header" onKeyDown={handleKeyDown}>
      <div className="main-header__inner">
        <button className="nawa-brand" onClick={() => navigate('/')} aria-label="NAWA home">
          <img src="/brand/nawa-logo.png" alt="NAWA نَوَى brand logo" />
        </button>

        <button
          className="public-menu-button"
          type="button"
          aria-label={labels.menu}
          aria-expanded={menuOpen}
          aria-controls="public-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <nav
          id="public-navigation"
          className={`public-navigation${menuOpen ? ' is-open' : ''}`}
          aria-label={labels.navigation}
        >
          <button aria-current={current('/')} onClick={() => navigate('/')}>
            {labels.home}
          </button>
          <button aria-current={current('/books')} onClick={() => navigate('/books')}>
            {labels.books}
          </button>
          <button onClick={navigateToCategories}>{labels.categories}</button>
          <span className="public-navigation__future" title={labels.later}>
            {labels.authors}
          </span>
          <span className="public-navigation__future" title={labels.later}>
            {labels.publishers}
          </span>
          <span className="public-navigation__future" title={labels.later}>
            {labels.articles}
          </span>
          {session?.role === 'MEMBER' && (
            <button onClick={() => navigate('/my-loans')}>{labels.myLoans}</button>
          )}
          {session && session.role !== 'MEMBER' && (
            <button
              onClick={() =>
                navigate(session.role === 'ADMIN' ? '/admin/categories' : '/librarian/books')
              }
            >
              {labels.workspace}
            </button>
          )}
        </nav>

        <form className="header-search" role="search" onSubmit={submitSearch}>
          <button type="button" className="header-search__category" onClick={navigateToCategories}>
            <PublicIcon name="categories" />
            <span>{labels.allCategories}</span>
            <span aria-hidden="true">⌄</span>
          </button>
          <label className="sr-only" htmlFor="header-catalog-search">
            {labels.searchLabel}
          </label>
          <input
            id="header-catalog-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={labels.search}
          />
          <button className="header-search__submit" aria-label={labels.searchLabel}>
            <PublicIcon name="search" />
          </button>
        </form>
      </div>
    </div>
  );
}
