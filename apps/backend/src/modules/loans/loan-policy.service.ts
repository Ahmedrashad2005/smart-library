import { Injectable } from '@nestjs/common';

@Injectable()
export class LoanPolicyService {
  readonly maxActiveLoans = 5;
  readonly loanPeriodDays = 14;
  readonly maxRenewals = 2;
  dueDate(from = new Date()): Date {
    return new Date(from.getTime() + this.loanPeriodDays * 24 * 60 * 60 * 1000);
  }
}
