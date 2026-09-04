import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-logs/audit-log.module';
import { LoansController } from './loans.controller';
import { LoanPolicyService } from './loan-policy.service';
import { LoansService } from './loans.service';
@Module({
  imports: [AuditLogModule],
  controllers: [LoansController],
  providers: [LoansService, LoanPolicyService],
  exports: [LoansService, LoanPolicyService],
})
export class LoansModule {}
