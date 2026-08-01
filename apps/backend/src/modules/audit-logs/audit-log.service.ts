import { Injectable } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}
  write(
    action: string,
    entityType: string,
    entityId: string | null,
    actor: Pick<User, 'id'> | null,
    request?: { ip?: string; headers?: { 'user-agent'?: string } },
    values?: { oldValues?: Prisma.InputJsonValue; newValues?: Prisma.InputJsonValue },
  ): Promise<unknown> {
    return this.prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        actorId: actor?.id,
        ipAddress: request?.ip,
        userAgent: request?.headers?.['user-agent'],
        oldValues: values?.oldValues,
        newValues: values?.newValues,
      },
    });
  }
}
