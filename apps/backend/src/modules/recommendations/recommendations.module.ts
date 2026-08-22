import { Module } from '@nestjs/common';
import { RecommendationClient } from './recommendation.client';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  controllers: [RecommendationsController],
  providers: [RecommendationsService, RecommendationClient],
  exports: [RecommendationsService, RecommendationClient],
})
export class RecommendationsModule {}
