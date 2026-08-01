import {
  BookCopyCondition,
  BookCopyStatus,
  LoanStatus,
  PrismaClient,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const password = 'SmartLib123';

const categories = [
  ['fiction', 'Fiction', 'أدب روائي'],
  ['science', 'Science', 'العلوم'],
  ['technology', 'Technology', 'التقنية'],
  ['history', 'History', 'التاريخ'],
  ['arts', 'Arts', 'الفنون'],
  ['children', 'Children', 'الأطفال'],
  ['business', 'Business', 'الأعمال'],
  ['health', 'Health', 'الصحة'],
  ['languages', 'Languages', 'اللغات'],
  ['reference', 'Reference', 'المراجع'],
] as const;
const authorNames = [
  ['Naguib Mahfouz', 'نجيب محفوظ'],
  ['Taha Hussein', 'طه حسين'],
  ['Radwa Ashour', 'رضوى عاشور'],
  ['Ahdaf Soueif', 'أهداف سويف'],
  ['Ahmed Khaled Towfik', 'أحمد خالد توفيق'],
  ['Isabel Allende', 'إيزابيل الليندي'],
  ['Chinua Achebe', 'تشينوا أتشيبي'],
  ['Ursula Le Guin', 'أورسولا لو غوين'],
  ['Toni Morrison', 'توني موريسون'],
  ['Yuval Noah Harari', 'يوفال نوح هراري'],
  ['Jane Austen', 'جين أوستن'],
  ['George Orwell', 'جورج أورويل'],
  ['Mary Shelley', 'ماري شيلي'],
  ['Hassan Fathy', 'حسن فتحي'],
  ['Salman Rushdie', 'سلمان رشدي'],
  ['Leila Aboulela', 'ليلى أبو العلا'],
  ['Nawal El Saadawi', 'نوال السعداوي'],
  ['Khaled Hosseini', 'خالد حسيني'],
  ['Alaa Al Aswany', 'علاء الأسواني'],
  ['Amin Maalouf', 'أمين معلوف'],
] as const;
const publishers = [
  ['Dar Al Shorouk', 'دار الشروق'],
  ['Bloomsbury', 'بلومزبري'],
  ['Penguin Random House', 'بنجوين راندوم هاوس'],
  ['Dar Al Maaref', 'دار المعارف'],
  ['O’Reilly Media', 'أوريلي ميديا'],
] as const;
const sectionNames = [
  ['FIC', 'Fiction Hall', 'قاعة الأدب', '1'],
  ['SCI', 'Science Wing', 'جناح العلوم', '1'],
  ['TEC', 'Technology Lab', 'مختبر التقنية', '2'],
  ['REF', 'Reference Room', 'غرفة المراجع', '2'],
  ['KID', 'Children Corner', 'ركن الأطفال', 'G'],
] as const;

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(password);
  const people = [
    ['admin@smart-library.test', 'System Administrator', UserRole.ADMIN, UserStatus.ACTIVE],
    ['librarian1@smart-library.test', 'Amina Hassan', UserRole.LIBRARIAN, UserStatus.ACTIVE],
    ['librarian2@smart-library.test', 'Omar Khaled', UserRole.LIBRARIAN, UserStatus.ACTIVE],
    ...Array.from(
      { length: 15 },
      (_, index) =>
        [
          `member${index + 1}@smart-library.test`,
          `Member ${index + 1}`,
          UserRole.MEMBER,
          [
            UserStatus.ACTIVE,
            UserStatus.PENDING_VERIFICATION,
            UserStatus.BLOCKED,
            UserStatus.SUSPENDED,
          ][index % 4]!,
        ] as const,
    ),
  ] as const;
  for (const [email, fullName, role, status] of people) {
    const membershipNumber = `SL-${email
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 12)
      .toUpperCase()}`;
    await prisma.user.upsert({
      where: { email },
      update: { fullName, role, status, passwordHash },
      create: {
        fullName,
        email,
        role,
        status,
        passwordHash,
        membershipNumber,
        qrCodeValue: `member:${membershipNumber}`,
        emailVerifiedAt: status === UserStatus.ACTIVE ? new Date() : null,
      },
    });
  }
  await prisma.systemSetting.upsert({
    where: { key: 'password.minLength' },
    update: {},
    create: {
      key: 'password.minLength',
      value: 8,
      type: 'NUMBER',
      description: 'Minimum account password length',
    },
  });

  const categoryRows = await Promise.all(
    categories.map(async ([slug, nameEn, nameAr]) =>
      prisma.category.upsert({
        where: { slug },
        update: { nameEn, nameAr, isArchived: false, deletedAt: null },
        create: {
          slug,
          nameEn,
          nameAr,
          descriptionEn: `${nameEn} collection`,
          descriptionAr: `مجموعة ${nameAr}`,
        },
      }),
    ),
  );
  const authorRows = await Promise.all(
    authorNames.map(async ([name, nameAr], index) => {
      const existing = await prisma.author.findFirst({ where: { name } });
      return existing
        ? prisma.author.update({
            where: { id: existing.id },
            data: {
              nameAr,
              nationality: index % 2 ? 'Egyptian' : 'International',
              isArchived: false,
              deletedAt: null,
            },
          })
        : prisma.author.create({
            data: {
              name,
              nameAr,
              nationality: index % 2 ? 'Egyptian' : 'International',
              biography: `Biography for ${name}`,
              biographyAr: `نبذة عن ${nameAr}`,
            },
          });
    }),
  );
  const publisherRows = await Promise.all(
    publishers.map(([name, nameAr]) =>
      prisma.publisher.upsert({
        where: { name },
        update: { nameAr, isArchived: false, deletedAt: null },
        create: {
          name,
          nameAr,
          website: 'https://example.test',
          description: `${name} publishing house`,
          descriptionAr: `دار نشر ${nameAr}`,
        },
      }),
    ),
  );
  const sections = await Promise.all(
    sectionNames.map(async ([code, nameEn, nameAr, floor]) =>
      prisma.librarySection.upsert({
        where: { code },
        update: { nameEn, nameAr, floor, isArchived: false, deletedAt: null },
        create: { code, nameEn, nameAr, floor },
      }),
    ),
  );
  const shelves = [] as Array<{ id: string; sectionId: string }>;
  for (const section of sections)
    for (const number of [1, 2, 3])
      shelves.push(
        await prisma.shelf.upsert({
          where: { sectionId_code: { sectionId: section.id, code: `${section.code}-${number}` } },
          update: { isArchived: false, deletedAt: null },
          create: {
            sectionId: section.id,
            code: `${section.code}-${number}`,
            nameEn: `Shelf ${number}`,
            nameAr: `رف ${number}`,
          },
        }),
      );

  for (let index = 0; index < 50; index += 1) {
    const number = index + 1;
    const category = categoryRows[index % categoryRows.length]!;
    const publisher = publisherRows[index % publisherRows.length]!;
    const title = `Library Discovery ${number}`;
    const book = await prisma.book.upsert({
      where: { slug: `library-discovery-${number}` },
      update: {
        title,
        titleAr: `اكتشاف المكتبة ${number}`,
        categoryId: category.id,
        publisherId: publisher.id,
        language: index % 2 ? 'ar' : 'en',
        isFeatured: index < 6,
        isArchived: false,
        deletedAt: null,
      },
      create: {
        title,
        titleAr: `اكتشاف المكتبة ${number}`,
        slug: `library-discovery-${number}`,
        isbn13: `978000000${String(number).padStart(4, '0')}`,
        description: `A bilingual catalog title number ${number}.`,
        descriptionAr: `عنوان ثنائي اللغة رقم ${number}.`,
        categoryId: category.id,
        publisherId: publisher.id,
        language: index % 2 ? 'ar' : 'en',
        publicationYear: 2000 + (index % 25),
        pageCount: 120 + index,
        isFeatured: index < 6,
      },
    });
    for (const author of [
      authorRows[index % authorRows.length]!,
      authorRows[(index + 7) % authorRows.length]!,
    ])
      await prisma.bookAuthor.upsert({
        where: { bookId_authorId: { bookId: book.id, authorId: author.id } },
        update: {},
        create: { bookId: book.id, authorId: author.id },
      });
    const copyCount = index % 5 === 0 ? 1 : 2 + (index % 3);
    for (let copyIndex = 0; copyIndex < copyCount; copyIndex += 1) {
      const shelf = shelves[(index + copyIndex) % shelves.length]!;
      const copyCode = `SL-COPY-${String(number).padStart(3, '0')}-${copyIndex + 1}`;
      const status =
        copyIndex === 0
          ? BookCopyStatus.AVAILABLE
          : [
              BookCopyStatus.BORROWED,
              BookCopyStatus.RESERVED,
              BookCopyStatus.MAINTENANCE,
              BookCopyStatus.AVAILABLE,
            ][copyIndex % 4]!;
      await prisma.bookCopy.upsert({
        where: { copyCode },
        update: {
          sectionId: shelf.sectionId,
          shelfId: shelf.id,
          status,
          condition: copyIndex % 4 === 3 ? BookCopyCondition.FAIR : BookCopyCondition.GOOD,
          isArchived: false,
          deletedAt: null,
        },
        create: {
          bookId: book.id,
          copyCode,
          barcode: `BAR-${copyCode}`,
          qrCodeValue: `copy:${copyCode}`,
          sectionId: shelf.sectionId,
          shelfId: shelf.id,
          status,
          condition: copyIndex % 4 === 3 ? BookCopyCondition.FAIR : BookCopyCondition.GOOD,
        },
      });
    }
    const copies = await prisma.bookCopy.findMany({
      where: { bookId: book.id, isArchived: false },
      select: { status: true },
    });
    await prisma.book.update({
      where: { id: book.id },
      data: {
        totalCopies: copies.length,
        availableCopies: copies.filter((copy) => copy.status === BookCopyStatus.AVAILABLE).length,
      },
    });
  }
  await prisma.loan.deleteMany({ where: { returnNotes: 'Seed Phase 4' } });
  const [member, secondMember, librarian] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'member1@smart-library.test' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'member5@smart-library.test' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'librarian1@smart-library.test' } }),
  ]);
  const loanCopies = await prisma.bookCopy.findMany({
    where: { status: BookCopyStatus.AVAILABLE, isArchived: false },
    take: 4,
    orderBy: { copyCode: 'asc' },
  });
  if (loanCopies.length === 4) {
    const now = new Date();
    const future = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const overdue = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    await prisma.loan.createMany({
      data: [
        {
          memberId: member.id,
          bookCopyId: loanCopies[0]!.id,
          issuedById: librarian.id,
          dueAt: future,
          status: LoanStatus.ACTIVE,
          returnNotes: 'Seed Phase 4',
        },
        {
          memberId: secondMember.id,
          bookCopyId: loanCopies[1]!.id,
          issuedById: librarian.id,
          dueAt: future,
          returnedAt: now,
          returnedById: librarian.id,
          returnCondition: BookCopyCondition.GOOD,
          status: LoanStatus.RETURNED,
          returnNotes: 'Seed Phase 4',
        },
        {
          memberId: secondMember.id,
          bookCopyId: loanCopies[2]!.id,
          issuedById: librarian.id,
          dueAt: overdue,
          status: LoanStatus.OVERDUE,
          returnNotes: 'Seed Phase 4',
        },
        {
          memberId: member.id,
          bookCopyId: loanCopies[3]!.id,
          issuedById: librarian.id,
          dueAt: future,
          renewedCount: 1,
          lastRenewedAt: now,
          status: LoanStatus.ACTIVE,
          returnNotes: 'Seed Phase 4',
        },
      ],
    });
    await prisma.bookCopy.updateMany({
      where: { id: { in: [loanCopies[0]!.id, loanCopies[2]!.id, loanCopies[3]!.id] } },
      data: { status: BookCopyStatus.BORROWED },
    });
    for (const bookId of [...new Set(loanCopies.map((copy) => copy.bookId))]) {
      const copies = await prisma.bookCopy.findMany({
        where: { bookId, isArchived: false },
        select: { status: true },
      });
      await prisma.book.update({
        where: { id: bookId },
        data: {
          totalCopies: copies.length,
          availableCopies: copies.filter((copy) => copy.status === BookCopyStatus.AVAILABLE).length,
        },
      });
    }
  }
}

void main().finally(() => prisma.$disconnect());
