import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CategoryStrip } from './CategoryStrip';
import type { PublicCategory } from './public.types';

const categories: PublicCategory[] = Array.from({ length: 10 }, (_, index) => ({
  id: `category-${index + 1}`,
  nameEn: `Category ${index + 1}`,
  nameAr: `التصنيف ${index + 1}`,
  slug: `category-${index + 1}`,
}));

function configureScrollableElement(element: HTMLElement): ReturnType<typeof vi.fn> {
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: 800 },
    scrollWidth: { configurable: true, value: 1600 },
    scrollLeft: { configurable: true, value: 0, writable: true },
  });
  const scrollBy = vi.fn();
  Object.defineProperty(element, 'scrollBy', { configurable: true, value: scrollBy });
  fireEvent(window, new Event('resize'));
  return scrollBy;
}

describe('CategoryStrip', () => {
  it('keeps the real category controls operable and exposes an accessible LTR scroller', async () => {
    const onSelect = vi.fn();
    render(
      <CategoryStrip
        locale="en"
        categories={categories}
        selectedId=""
        loadingLabel="Loading categories"
        emptyLabel="No categories"
        heading="Browse categories"
        onSelect={onSelect}
      />,
    );
    const scroller = screen.getByRole('group', { name: 'Browse categories' });
    const scrollBy = configureScrollableElement(scroller);
    const previous = screen.getByRole('button', { name: 'Previous categories' });
    const next = screen.getByRole('button', { name: 'Next categories' });

    await waitFor(() => expect(next).toBeEnabled());
    expect(previous).toBeDisabled();
    expect(scroller).toHaveAttribute('tabindex', '0');
    next.focus();
    await userEvent.keyboard('{Enter}');
    expect(next).toHaveFocus();
    expect(scrollBy).toHaveBeenCalledWith({ left: 600, behavior: 'smooth' });

    await userEvent.click(screen.getByRole('button', { name: 'Browse categories: Category 4' }));
    expect(onSelect).toHaveBeenCalledWith('category-4');
  });

  it('uses the correct inline direction and edge states for Arabic RTL navigation', async () => {
    render(
      <CategoryStrip
        locale="ar"
        categories={categories}
        selectedId="category-2"
        loadingLabel="جار التحميل"
        emptyLabel="لا توجد تصنيفات"
        heading="تصفح حسب التصنيف"
        onSelect={vi.fn()}
      />,
    );
    const scroller = screen.getByRole('group', { name: 'تصفح حسب التصنيف' });
    const scrollBy = configureScrollableElement(scroller);
    const previous = screen.getByRole('button', { name: 'التصنيفات السابقة' });
    const next = screen.getByRole('button', { name: 'التصنيفات التالية' });

    await waitFor(() => expect(next).toBeEnabled());
    expect(previous).toBeDisabled();
    expect(screen.getByRole('button', { name: 'تصفح حسب التصنيف: التصنيف 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(next);
    expect(scrollBy).toHaveBeenCalledWith({ left: -600, behavior: 'smooth' });

    Object.defineProperty(scroller, 'scrollLeft', { configurable: true, value: -800 });
    fireEvent.scroll(scroller);
    await waitFor(() => expect(next).toBeDisabled());
    expect(previous).toBeEnabled();
  });

  it('replaces internal Campus inventory wording with a clean public label', () => {
    render(
      <CategoryStrip
        locale="ar"
        categories={[
          {
            id: 'campus-category',
            nameEn: 'Campus inventory — uncategorized',
            nameAr: 'مخزون الكلية — غير مصنف',
            slug: 'campus-uncategorized',
          },
          {
            id: 'campus-cyber',
            nameEn: 'Cyber Security and Communication',
            nameAr: 'الأمن السيبراني والاتصالات',
            slug: 'campus-cyber-security-communication',
          },
          {
            id: 'campus-ai',
            nameEn: 'AI / General Programming / ML-DL / Processing',
            nameAr: 'الذكاء الاصطناعي والبرمجة والتعلم الآلي والمعالجة',
            slug: 'campus-ai-programming-ml-processing',
          },
        ]}
        selectedId=""
        loadingLabel="جار التحميل"
        emptyLabel="لا توجد تصنيفات"
        heading="تصفح حسب التصنيف"
        onSelect={vi.fn()}
      />,
    );

    const campus = screen.getByRole('button', {
      name: 'تصفح حسب التصنيف: كتب مكتبة الكلية',
    });
    expect(campus).toHaveAttribute('title', 'كتب مكتبة الكلية');
    expect(
      screen.getByRole('button', { name: 'تصفح حسب التصنيف: الأمن السيبراني' }),
    ).toHaveAttribute('title', 'الأمن السيبراني');
    expect(
      screen.getByRole('button', { name: 'تصفح حسب التصنيف: الذكاء الاصطناعي والبرمجة' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/مخزون الكلية/)).not.toBeInTheDocument();
    expect(screen.queryByText('الأمن السيبراني والاتصالات')).not.toBeInTheDocument();
  });
});
