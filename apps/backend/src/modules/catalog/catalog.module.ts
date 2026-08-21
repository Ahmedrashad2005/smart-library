import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-logs/audit-log.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';
import { CampusLocationController } from './campus-location.controller';
import { CampusLocationService } from './campus-location.service';
import { FacultyController } from './faculty.controller';
import { FacultyService } from './faculty.service';
@Module({
  imports: [AuditLogModule],
  controllers: [
    CatalogController,
    MasterDataController,
    CampusLocationController,
    FacultyController,
  ],
  providers: [CatalogService, MasterDataService, CampusLocationService, FacultyService],
  exports: [CatalogService],
})
export class CatalogModule {}
