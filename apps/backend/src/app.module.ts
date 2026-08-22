import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { PrismaModule } from './database/prisma.module';
import { AuditLogModule } from './modules/audit-logs/audit-log.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { LoansModule } from './modules/loans/loans.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { AssistantModule } from './modules/assistant/assistant.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditLogModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    LoansModule,
    ReservationsModule,
    RecommendationsModule,
    AssistantModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
