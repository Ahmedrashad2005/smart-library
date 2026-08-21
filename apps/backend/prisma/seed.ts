import {
  BookCopyCondition,
  BookCopyStatus,
  LoanStatus,
  PrismaClient,
  UserRole,
  UserStatus,
  type Book,
} from '@prisma/client';
import * as argon2 from 'argon2';
import {
  campusInventoryRecords,
  campusSourceCollections,
  type CampusSourceCollection,
} from './campus-inventory';

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

const deltaUniversityFaculties = [
  ['medicine', 'كلية الطب البشري'],
  ['oral-and-dental-medicine', 'كلية طب الفم والأسنان'],
  ['veterinary-medicine', 'كلية الطب البيطري'],
  ['physical-therapy', 'كلية العلاج الطبيعي'],
  ['pharmacy', 'كلية الصيدلة'],
  ['health-sciences-technology', 'كلية تكنولوجيا العلوم الصحية'],
  ['nursing', 'كلية التمريض'],
  ['energy-and-petroleum-engineering', 'كلية هندسة الطاقة والبترول'],
  ['engineering', 'كلية الهندسة'],
  ['artificial-intelligence', 'كلية الذكاء الاصطناعي'],
  ['law', 'كلية الحقوق'],
  ['management', 'كلية الإدارة'],
  ['arts', 'كلية الآداب'],
] as const;

const campusCategoryDefinitions = [
  {
    sourceCollection: null,
    slug: 'campus-uncategorized',
    nameEn: 'Campus inventory — uncategorized',
    nameAr: 'مخزون الكلية — غير مصنف',
  },
  {
    sourceCollection: campusSourceCollections.cyber,
    slug: 'campus-cyber-security-communication',
    nameEn: campusSourceCollections.cyber,
    nameAr: 'الأمن السيبراني والاتصالات',
  },
  {
    sourceCollection: campusSourceCollections.bio,
    slug: 'campus-bio-informatics',
    nameEn: campusSourceCollections.bio,
    nameAr: 'المعلوماتية الحيوية',
  },
  {
    sourceCollection: campusSourceCollections.ai,
    slug: 'campus-ai-programming-ml-processing',
    nameEn: campusSourceCollections.ai,
    nameAr: 'الذكاء الاصطناعي والبرمجة والتعلم الآلي والمعالجة',
  },
] as const;

function sourceSlug(rowNumber: number, title: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `campus-source-${String(rowNumber).padStart(2, '0')}-${normalized}`;
}

async function seedCampusInventory(): Promise<{
  sourceRows: number;
  newBooks: number;
  reusedBooks: number;
  newCopies: number;
  missingPublicationInfo: number;
  missingYear: number;
  explicitSourceGroups: number;
  ddcRecords: number;
}> {
  if (campusInventoryRecords.length !== 23)
    throw new Error(
      `Campus inventory must contain 23 source rows, found ${campusInventoryRecords.length}`,
    );

  const library = await prisma.library.upsert({
    where: { code: 'NAWA-COLLEGE-LIBRARY' },
    update: {
      nameEn: 'College Library',
      nameAr: 'مكتبة الكلية',
      building: null,
      isActive: true,
    },
    create: {
      code: 'NAWA-COLLEGE-LIBRARY',
      nameEn: 'College Library',
      nameAr: 'مكتبة الكلية',
    },
  });
  const floor = await prisma.libraryFloor.upsert({
    where: { libraryId_floorNumber: { libraryId: library.id, floorNumber: 3 } },
    update: {
      nameEn: 'Third Floor',
      nameAr: 'الدور الثالث',
      sortOrder: 3,
      isActive: true,
    },
    create: {
      libraryId: library.id,
      floorNumber: 3,
      nameEn: 'Third Floor',
      nameAr: 'الدور الثالث',
      sortOrder: 3,
    },
  });
  const room = await prisma.libraryRoom.upsert({
    where: { floorId_roomNumber: { floorId: floor.id, roomNumber: '315' } },
    update: { nameEn: 'Room 315', nameAr: 'غرفة 315', isActive: true },
    create: {
      floorId: floor.id,
      roomNumber: '315',
      nameEn: 'Room 315',
      nameAr: 'غرفة 315',
    },
  });

  const categoriesByCollection = new Map<CampusSourceCollection, { id: string }>();
  const locationsByCollection = new Map<
    CampusSourceCollection,
    { sectionId: string; shelfId: string }
  >();
  for (const [index, definition] of campusCategoryDefinitions.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: definition.slug },
      update: {
        nameEn: definition.nameEn,
        nameAr: definition.nameAr,
        isArchived: false,
        deletedAt: null,
      },
      create: {
        slug: definition.slug,
        nameEn: definition.nameEn,
        nameAr: definition.nameAr,
      },
    });
    categoriesByCollection.set(definition.sourceCollection, category);

    const sectionCode = `NAWA-CAMPUS-${String(index + 1).padStart(2, '0')}`;
    const section = await prisma.librarySection.upsert({
      where: { code: sectionCode },
      update: {
        roomId: room.id,
        nameEn: definition.nameEn,
        nameAr: definition.nameAr,
        floor: '3',
        room: '315',
        isArchived: false,
        deletedAt: null,
      },
      create: {
        roomId: room.id,
        code: sectionCode,
        nameEn: definition.nameEn,
        nameAr: definition.nameAr,
        floor: '3',
        room: '315',
      },
    });
    const shelf = await prisma.shelf.upsert({
      where: { sectionId_code: { sectionId: section.id, code: `${sectionCode}-HOLDING` } },
      update: {
        nameEn: 'Campus inventory holding',
        nameAr: 'حيازة مخزون الكلية',
        isArchived: false,
        deletedAt: null,
      },
      create: {
        sectionId: section.id,
        code: `${sectionCode}-HOLDING`,
        nameEn: 'Campus inventory holding',
        nameAr: 'حيازة مخزون الكلية',
        descriptionEn: 'Organizational anchor only; the source shelf code is stored on each copy.',
        descriptionAr: 'رابط تنظيمي فقط؛ يُحفظ رمز الرف الأصلي على كل نسخة.',
      },
    });
    locationsByCollection.set(definition.sourceCollection, {
      sectionId: section.id,
      shelfId: shelf.id,
    });
  }

  let newBooks = 0;
  let reusedBooks = 0;
  let newCopies = 0;
  for (const record of campusInventoryRecords) {
    const sourceInventoryReference = `NAWA-CAMPUS-PDF-${String(record.rowNumber).padStart(3, '0')}`;
    let author = await prisma.author.findFirst({
      where: { name: { equals: record.author, mode: 'insensitive' } },
    });
    author = author
      ? await prisma.author.update({
          where: { id: author.id },
          data: { isArchived: false, deletedAt: null },
        })
      : await prisma.author.create({ data: { name: record.author } });

    const existingCopy = await prisma.bookCopy.findUnique({
      where: { sourceInventoryReference },
      include: { book: true },
    });
    let book: Book | null = existingCopy?.book ?? null;
    if (!book)
      book = await prisma.book.findFirst({
        where: {
          title: { equals: record.title, mode: 'insensitive' },
          publicationYear: record.publicationYear,
          authors: { some: { authorId: author.id } },
        },
      });

    if (book) {
      reusedBooks += 1;
      book = await prisma.book.update({
        where: { id: book.id },
        data: {
          title: record.title,
          publicationYear: record.publicationYear,
          sourcePublicationInfo: record.publicationInfo,
          ddc: record.ddc,
          isArchived: false,
          deletedAt: null,
        },
      });
    } else {
      const category = categoriesByCollection.get(record.sourceCollection)!;
      book = await prisma.book.create({
        data: {
          title: record.title,
          slug: sourceSlug(record.rowNumber, record.title),
          publicationYear: record.publicationYear,
          sourcePublicationInfo: record.publicationInfo,
          ddc: record.ddc,
          language: 'en',
          categoryId: category.id,
        },
      });
      newBooks += 1;
    }
    await prisma.bookAuthor.upsert({
      where: { bookId_authorId: { bookId: book.id, authorId: author.id } },
      update: {},
      create: { bookId: book.id, authorId: author.id },
    });

    const location = locationsByCollection.get(record.sourceCollection)!;
    const copyCode = `NAWA-CAMPUS-${String(record.rowNumber).padStart(3, '0')}`;
    if (existingCopy) {
      await prisma.bookCopy.update({
        where: { id: existingCopy.id },
        data: {
          bookId: book.id,
          homeLibraryRoomId: room.id,
          sectionId: location.sectionId,
          shelfId: location.shelfId,
          shelfLocationCode: record.shelfLocationCode,
          sourceCollection: record.sourceCollection,
          isArchived: false,
          deletedAt: null,
        },
      });
    } else {
      await prisma.bookCopy.create({
        data: {
          bookId: book.id,
          homeLibraryRoomId: room.id,
          copyCode,
          qrCodeValue: `copy:${copyCode}`,
          sectionId: location.sectionId,
          shelfId: location.shelfId,
          shelfLocationCode: record.shelfLocationCode,
          sourceInventoryReference,
          sourceCollection: record.sourceCollection,
          status: BookCopyStatus.AVAILABLE,
          condition: BookCopyCondition.GOOD,
        },
      });
      newCopies += 1;
    }
    const activeCopies = await prisma.bookCopy.findMany({
      where: { bookId: book.id, isArchived: false },
      select: { status: true },
    });
    await prisma.book.update({
      where: { id: book.id },
      data: {
        totalCopies: activeCopies.length,
        availableCopies: activeCopies.filter((copy) => copy.status === BookCopyStatus.AVAILABLE)
          .length,
      },
    });
  }

  return {
    sourceRows: campusInventoryRecords.length,
    newBooks,
    reusedBooks,
    newCopies,
    missingPublicationInfo: campusInventoryRecords.filter((record) => !record.publicationInfo)
      .length,
    missingYear: campusInventoryRecords.filter((record) => !record.publicationYear).length,
    explicitSourceGroups: new Set(
      campusInventoryRecords.flatMap((record) =>
        record.sourceCollection ? [record.sourceCollection] : [],
      ),
    ).size,
    ddcRecords: campusInventoryRecords.filter((record) => record.ddc).length,
  };
}

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

  await Promise.all(
    deltaUniversityFaculties.map(([slug, nameAr], index) =>
      prisma.faculty.upsert({
        where: { slug },
        update: { nameAr, displayOrder: index + 1, isActive: true },
        create: { slug, nameAr, displayOrder: index + 1 },
      }),
    ),
  );
  await prisma.systemSetting.upsert({
    where: { key: 'reservation.pickupWindowHours' },
    update: {
      description: 'Hours an active Campus reservation remains available for pickup',
      type: 'NUMBER',
    },
    create: {
      key: 'reservation.pickupWindowHours',
      value: 24,
      type: 'NUMBER',
      description: 'Hours an active Campus reservation remains available for pickup',
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
              BookCopyStatus.AVAILABLE,
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
  const campusStats = await seedCampusInventory();
  console.info('NAWA Campus seed:', campusStats);
}

void main().finally(() => prisma.$disconnect());
