import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/auth.guards';
import { RecommendationQueryDto } from './recommendation.dto';
import { RecommendationsService } from './recommendations.service';

@ApiTags('Recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Get('me')
  @Roles(UserRole.MEMBER)
  @ApiOperation({
    summary:
      'Get safe personalized or deterministic catalog recommendations for the current member',
  })
  @ApiResponse({
    status: 200,
    description: 'Authoritative book data with ranking reasons and mode.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Member accounts only.' })
  mine(
    @CurrentUser() user: { id: string; preferredLanguage?: string },
    @Query() query: RecommendationQueryDto,
  ) {
    return this.recommendations.mine(user, query.limit, query.locale);
  }
}
