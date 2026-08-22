import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Public } from '../../common/auth.decorators';
import { OptionalJwtAuthGuard } from '../../common/auth.guards';
import { AssistantMessageDto } from './assistant.dto';
import { AssistantService } from './assistant.service';

@ApiTags('AI Assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @Post('message')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Send a read-only message to the Delta University Library AI Assistant',
    description:
      'Gemini classifies a fixed allow-list of catalog, Book details, university information, academic, and member intents when server-side AI is configured. NestJS keeps all library facts authoritative. Public catalog and academic help work for guests; JWT identity exclusively controls member recommendations, loans, and reservations. Bounded structured Book context supports follow-ups without permanent chat storage.',
  })
  @ApiBody({ type: AssistantMessageDto })
  @ApiResponse({
    status: 200,
    description:
      'Structured, safe response. Academic explanations expose title, summary, 3–5 keyPoints, and optional example/useCase. Real catalog-book explanations expose overview, topics, inferred level, optional whyUseful/caveat, the authoritative Book projection, and executable suggestions.',
    schema: {
      example: {
        type: 'ACADEMIC_EXPLANATION',
        message: 'القائمة المرتبطة بنية بيانات تتكون من عقد مترابطة.',
        title: 'Linked List — القائمة المرتبطة',
        summary: 'القائمة المرتبطة بنية بيانات تتكون من عقد مترابطة.',
        keyPoints: [
          'كل عنصر يسمى العقدة (Node).',
          'تخزن العقدة البيانات.',
          'يشير المؤشر (Pointer) إلى العقدة التالية.',
        ],
        example: '10 → 20 → 30 → NULL',
        useCase: 'تفيد عند تكرار الإضافة والحذف.',
        suggestions: [
          {
            action: 'SEARCH_BOOKS',
            label: 'ابحث عن كتب عن الموضوع',
            query: 'ابحث عن كتب عن Data Structures',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Message, locale, or bounded history is invalid.' })
  message(
    @Body() dto: AssistantMessageDto,
    @CurrentUser() user?: { id: string; role: UserRole; preferredLanguage?: string },
  ) {
    return this.assistant.message(dto, user);
  }
}
