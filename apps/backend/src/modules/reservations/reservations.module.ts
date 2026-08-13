import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ReservationPolicyService } from './reservation-policy.service';
import { ReservationExpirationScheduler } from './reservation-expiration.scheduler';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [CatalogModule],
  controllers: [ReservationsController],
  providers: [ReservationPolicyService, ReservationsService, ReservationExpirationScheduler],
  exports: [ReservationPolicyService, ReservationsService],
})
export class ReservationsModule {}
