import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { AssistantClient } from './assistant.client';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [CatalogModule, RecommendationsModule],
  controllers: [AssistantController],
  providers: [AssistantService, AssistantClient],
  exports: [AssistantService, AssistantClient],
})
export class AssistantModule {}
