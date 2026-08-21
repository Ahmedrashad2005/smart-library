import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth.decorators';
import { FacultyService } from './faculty.service';

@ApiTags('Delta University faculties')
@Controller('faculties')
export class FacultyController {
  constructor(private readonly faculties: FacultyService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List confirmed Delta University faculties for library discovery' })
  @ApiOkResponse({
    description: 'Ordered active faculties with safe presentation fields and real book counts.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'slug', 'nameAr', 'displayOrder', 'bookCount'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          slug: { type: 'string', example: 'artificial-intelligence' },
          nameAr: { type: 'string', example: 'كلية الذكاء الاصطناعي' },
          nameEn: { type: 'string', nullable: true, example: null },
          displayOrder: { type: 'integer', example: 10 },
          bookCount: { type: 'integer', example: 0 },
        },
      },
    },
  })
  list() {
    return this.faculties.list();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Read one active faculty by its stable technical slug' })
  @ApiOkResponse({ description: 'One safe active faculty presentation.' })
  @ApiNotFoundResponse({ description: 'The faculty slug is unknown or not active.' })
  detail(@Param('slug') slug: string) {
    return this.faculties.detail(slug);
  }
}
