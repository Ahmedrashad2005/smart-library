import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookCopyCondition,
  BookCopyStatus,
  LoanStatus,
  Prisma,
  UserRole,
  UserStatus,
  type User,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { LoanPolicyService } from './loan-policy.service';
import { BorrowLoanDto, LoanQueryDto, ReturnLoanDto } from './loan.dto';

const loanInclude = {
  member: {
    select: {
      id: true,
      fullName: true,
      email: true,
      membershipNumber: true,
      status: true,
      emailVerifiedAt: true,
      deletedAt: true,
    },
  },
  bookCopy: {
    include: {
      book: {
        select: {
          id: true,
          title: true,
          titleAr: true,
          slug: true,
          coverImageUrl: true,
          authors: {
            select: { author: { select: { id: true, name: true, nameAr: true } } },
          },
        },
      },
      section: true,
      shelf: true,
    },
  },
  issuedBy: { select: { id: true, fullName: true } },
  returnedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.LoanInclude;
type LoanRecord = Prisma.LoanGetPayload<{ include: typeof loanInclude }>;

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: LoanPolicyService,
  ) {}
  private effectiveStatus(loan: {
    returnedAt: Date | null;
    dueAt: Date;
    status: LoanStatus;
  }): LoanStatus {
    if (loan.returnedAt) return LoanStatus.RETURNED;
    return loan.dueAt < new Date() ? LoanStatus.OVERDUE : LoanStatus.ACTIVE;
  }
  private async retry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const isSerializationFailure =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (['P2034', '40001'].includes(error.code) ||
            (error.code === 'P2010' && String(error.meta?.code) === '40001'));
        if (!isSerializationFailure || attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
      }
    }
    throw new BadRequestException('Unable to complete loan transaction');
  }
  async borrow(dto: BorrowLoanDto, actor: Pick<User, 'id'>) {
    const copyIdentifier = dto.bookCopyId
      ? { id: dto.bookCopyId }
      : dto.copyCode
        ? { copyCode: dto.copyCode }
        : dto.barcode
          ? { barcode: dto.barcode }
          : dto.qrCodeValue
            ? { qrCodeValue: dto.qrCodeValue }
            : null;
    if (!copyIdentifier) throw new BadRequestException('A book copy identifier is required');
    return this.retry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const member = await tx.user.findUnique({ where: { id: dto.memberId } });
          if (
            !member ||
            member.role !== UserRole.MEMBER ||
            member.status !== UserStatus.ACTIVE ||
            !member.emailVerifiedAt ||
            member.deletedAt
          )
            throw new BadRequestException('Member is not eligible to borrow');
          const copy = await tx.bookCopy.findFirst({
            where: copyIdentifier,
            include: { book: true },
          });
          if (
            !copy ||
            copy.isArchived ||
            copy.deletedAt ||
            copy.book.isArchived ||
            copy.book.deletedAt
          )
            throw new BadRequestException('Book copy is not available');
          await tx.$queryRaw`SELECT "id" FROM "BookCopy" WHERE "id" = CAST(${copy.id} AS uuid) FOR UPDATE`;
          const locked = await tx.bookCopy.findUniqueOrThrow({
            where: { id: copy.id },
            include: { book: true },
          });
          if (locked.status !== BookCopyStatus.AVAILABLE)
            throw new ConflictException('Book copy is not available');
          const active = await tx.loan.findMany({
            where: { memberId: member.id, returnedAt: null },
            select: { bookCopyId: true, dueAt: true },
          });
          if (active.some((loan) => loan.dueAt < new Date()))
            throw new BadRequestException('Member has an overdue loan');
          if (active.length >= this.policy.maxActiveLoans)
            throw new BadRequestException('Member has reached the active loan limit');
          if (active.some((loan) => loan.bookCopyId === locked.id))
            throw new BadRequestException('Member already has this copy on loan');
          await tx.bookCopy.update({
            where: { id: locked.id },
            data: { status: BookCopyStatus.BORROWED },
          });
          await this.sync(locked.bookId, tx);
          const loan = await tx.loan.create({
            data: {
              memberId: member.id,
              bookCopyId: locked.id,
              issuedById: actor.id,
              dueAt: this.policy.dueDate(),
            },
            include: loanInclude,
          });
          await tx.auditLog.create({
            data: {
              action: 'LOAN_CREATED',
              entityType: 'loan',
              entityId: loan.id,
              actorId: actor.id,
              targetUserId: member.id,
              newValues: {
                memberId: member.id,
                bookCopyId: locked.id,
                previousCopyStatus: BookCopyStatus.AVAILABLE,
                newCopyStatus: BookCopyStatus.BORROWED,
                dueAt: loan.dueAt.toISOString(),
              },
            },
          });
          return this.present(loan);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }
  async returnLoan(id: string, dto: ReturnLoanDto, actor: Pick<User, 'id'>) {
    return this.retry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const loan = await tx.loan.findUnique({ where: { id }, include: loanInclude });
          if (!loan) throw new NotFoundException('Loan not found');
          if (loan.returnedAt) throw new ConflictException('Loan was already returned');
          await tx.$queryRaw`SELECT "id" FROM "BookCopy" WHERE "id" = CAST(${loan.bookCopyId} AS uuid) FOR UPDATE`;
          const copy = await tx.bookCopy.findUnique({ where: { id: loan.bookCopyId } });
          if (!copy) throw new NotFoundException('Book copy not found');
          const nextStatus =
            dto.returnCondition === BookCopyCondition.DAMAGED
              ? BookCopyStatus.DAMAGED
              : BookCopyStatus.AVAILABLE;
          await tx.bookCopy.update({
            where: { id: copy.id },
            data: { condition: dto.returnCondition, status: nextStatus },
          });
          await this.sync(copy.bookId, tx);
          const returned = await tx.loan.update({
            where: { id },
            data: {
              returnedAt: new Date(),
              status: LoanStatus.RETURNED,
              returnedById: actor.id,
              returnCondition: dto.returnCondition,
              returnNotes: dto.returnNotes,
            },
            include: loanInclude,
          });
          await tx.auditLog.create({
            data: {
              action: 'LOAN_RETURNED',
              entityType: 'loan',
              entityId: id,
              actorId: actor.id,
              targetUserId: loan.memberId,
              oldValues: { previousCopyStatus: copy.status },
              newValues: { newCopyStatus: nextStatus, returnCondition: dto.returnCondition },
            },
          });
          return this.present(returned);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }
  async renew(id: string, actor: Pick<User, 'id' | 'role'>) {
    return this.retry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const loan = await tx.loan.findUnique({ where: { id }, include: loanInclude });
          if (!loan || loan.returnedAt || this.effectiveStatus(loan) !== LoanStatus.ACTIVE)
            throw new BadRequestException('Loan is not eligible for renewal');
          if (actor.role === UserRole.MEMBER && loan.memberId !== actor.id)
            throw new ForbiddenException('Members can renew only their own loans');
          const member = await tx.user.findUniqueOrThrow({ where: { id: loan.memberId } });
          if (member.status !== UserStatus.ACTIVE || !member.emailVerifiedAt)
            throw new BadRequestException('Member is not eligible for renewal');
          if (loan.renewedCount >= this.policy.maxRenewals)
            throw new BadRequestException('Maximum renewals reached');
          const dueAt = this.policy.dueDate(loan.dueAt);
          const renewed = await tx.loan.update({
            where: { id },
            data: { dueAt, renewedCount: { increment: 1 }, lastRenewedAt: new Date() },
            include: loanInclude,
          });
          await tx.auditLog.create({
            data: {
              action: 'LOAN_RENEWED',
              entityType: 'loan',
              entityId: id,
              actorId: actor.id,
              targetUserId: loan.memberId,
              oldValues: { dueAt: loan.dueAt.toISOString() },
              newValues: { dueAt: renewed.dueAt.toISOString(), renewedCount: renewed.renewedCount },
            },
          });
          return this.present(renewed, actor.role !== UserRole.MEMBER);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }
  async list(query: LoanQueryDto, memberId?: string) {
    const page = Math.max(1, Number(query.page ?? 1));
    const take = Math.min(50, Math.max(1, Number(query.limit ?? 12)));
    const filters: Prisma.LoanWhereInput[] = [];
    if (query.borrowedFrom || query.borrowedTo)
      filters.push({
        borrowedAt: {
          ...(query.borrowedFrom ? { gte: new Date(query.borrowedFrom) } : {}),
          ...(query.borrowedTo ? { lte: new Date(query.borrowedTo) } : {}),
        },
      });
    if (query.dueFrom || query.dueTo)
      filters.push({
        dueAt: {
          ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
          ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
        },
      });
    if (query.status === LoanStatus.RETURNED) filters.push({ returnedAt: { not: null } });
    else if (query.status === LoanStatus.ACTIVE)
      filters.push({ returnedAt: null, dueAt: { gte: new Date() } });
    else if (query.status === LoanStatus.OVERDUE)
      filters.push({ returnedAt: null, dueAt: { lt: new Date() } });
    const searchFilters: Prisma.LoanWhereInput[] = query.q
      ? [
          ...(!memberId
            ? [
                { member: { fullName: { contains: query.q, mode: 'insensitive' as const } } },
                { member: { email: { contains: query.q, mode: 'insensitive' as const } } },
                { bookCopy: { barcode: { contains: query.q, mode: 'insensitive' as const } } },
              ]
            : []),
          { bookCopy: { copyCode: { contains: query.q, mode: 'insensitive' } } },
          { bookCopy: { book: { title: { contains: query.q, mode: 'insensitive' } } } },
          { bookCopy: { book: { titleAr: { contains: query.q, mode: 'insensitive' } } } },
          {
            bookCopy: {
              book: {
                authors: {
                  some: {
                    author: {
                      OR: [
                        { name: { contains: query.q, mode: 'insensitive' } },
                        { nameAr: { contains: query.q, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              },
            },
          },
        ]
      : [];
    const where: Prisma.LoanWhereInput = {
      ...(memberId ? { memberId } : {}),
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.bookId ? { bookCopy: { bookId: query.bookId } } : {}),
      ...(query.copyId ? { bookCopyId: query.copyId } : {}),
      ...(searchFilters.length ? { OR: searchFilters } : {}),
      ...(filters.length ? { AND: filters } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.loan.findMany({
        where,
        include: loanInclude,
        orderBy: { borrowedAt: 'desc' },
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.loan.count({ where }),
    ]);
    return {
      items: items.map((loan) => this.present(loan, !memberId)),
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }
  async detail(id: string, actor: Pick<User, 'id' | 'role'>) {
    const loan = await this.prisma.loan.findUnique({ where: { id }, include: loanInclude });
    if (!loan) throw new NotFoundException('Loan not found');
    if (actor.role === UserRole.MEMBER && loan.memberId !== actor.id)
      throw new ForbiddenException('Members can view only their own loans');
    return this.present(loan, actor.role !== UserRole.MEMBER);
  }
  private async sync(bookId: string, tx: Prisma.TransactionClient) {
    const copies = await tx.bookCopy.findMany({
      where: { bookId, isArchived: false },
      select: { status: true },
    });
    await tx.book.update({
      where: { id: bookId },
      data: {
        totalCopies: copies.length,
        availableCopies: copies.filter((copy) => copy.status === BookCopyStatus.AVAILABLE).length,
      },
    });
  }
  private present(loan: LoanRecord, includeStaff = true) {
    const { issuedBy, returnedBy, member, ...safeLoan } = loan;
    const status = this.effectiveStatus(loan);
    const renewalReason =
      status === LoanStatus.RETURNED
        ? 'RETURNED'
        : status === LoanStatus.OVERDUE
          ? 'OVERDUE'
          : member.status !== UserStatus.ACTIVE || !member.emailVerifiedAt || member.deletedAt
            ? 'MEMBER_INELIGIBLE'
            : loan.renewedCount >= this.policy.maxRenewals
              ? 'LIMIT_REACHED'
              : null;
    return {
      ...safeLoan,
      status,
      member: {
        id: member.id,
        fullName: member.fullName,
        email: member.email,
        membershipNumber: member.membershipNumber,
      },
      renewalEligibility: {
        canRenew: renewalReason === null,
        reason: renewalReason,
        used: loan.renewedCount,
        maximum: this.policy.maxRenewals,
        remaining: Math.max(0, this.policy.maxRenewals - loan.renewedCount),
      },
      ...(includeStaff ? { issuedBy, returnedBy } : {}),
      bookCopy: {
        ...loan.bookCopy,
        book: {
          ...loan.bookCopy.book,
          authors: loan.bookCopy.book.authors.map(({ author }) => ({
            id: author.id,
            name: author.name,
            arabicName: author.nameAr,
          })),
        },
      },
    };
  }
}
