import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const activeBookCount = {
  books: {
    where: { book: { isArchived: false, deletedAt: null } },
  },
} as const;

@Injectable()
export class FacultyService {
  constructor(private readonly prisma: PrismaService) {}

  private present(faculty: {
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string | null;
    displayOrder: number;
    _count: { books: number };
  }) {
    return {
      id: faculty.id,
      slug: faculty.slug,
      nameAr: faculty.nameAr,
      nameEn: faculty.nameEn,
      displayOrder: faculty.displayOrder,
      bookCount: faculty._count.books,
    };
  }

  async list() {
    const faculties = await this.prisma.faculty.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { nameAr: 'asc' }],
      include: { _count: { select: activeBookCount } },
    });
    return faculties.map((faculty) => this.present(faculty));
  }

  async detail(slug: string) {
    const faculty = await this.prisma.faculty.findFirst({
      where: { slug, isActive: true },
      include: { _count: { select: activeBookCount } },
    });
    if (!faculty) throw new NotFoundException('Faculty not found');
    return this.present(faculty);
  }
}
