import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
} from './auth.dto';
import { CurrentUser, Public } from '../../common/auth.decorators';
import { JwtAuthGuard } from '../../common/auth.guards';
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  private cookie(response: Response, value: string): void {
    response.cookie(process.env.COOKIE_NAME ?? 'smart_library_refresh', value, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ?? 'lax',
      path: '/api/v1/auth',
    });
  }
  @Public() @Post('register') register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.auth.register(dto, request);
  }
  @Public() @HttpCode(200) @Post('login') async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(dto, request);
    this.cookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }
  @Public() @HttpCode(204) @Post('logout') async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(
      request.cookies?.[process.env.COOKIE_NAME ?? 'smart_library_refresh'] as string | undefined,
    );
    response.clearCookie(process.env.COOKIE_NAME ?? 'smart_library_refresh', {
      path: '/api/v1/auth',
    });
  }
  @Public() @HttpCode(200) @Post('refresh') async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.refresh(
      request.cookies?.[process.env.COOKIE_NAME ?? 'smart_library_refresh'] as string | undefined,
      request,
    );
    this.cookie(response, result.refreshToken);
    return { accessToken: result.accessToken };
  }
  @Public() @Post('verify-email') verify(@Body() dto: TokenDto) {
    return this.auth.verify(dto.token);
  }
  @Public() @Post('resend-verification') async resend(@Body() dto: ForgotPasswordDto) {
    await this.auth.resend(dto.email);
    return { accepted: true };
  }
  @Public() @Post('forgot-password') async forgot(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgot(dto.email);
    return { accepted: true };
  }
  @Public() @Post('reset-password') async reset(@Body() dto: ResetPasswordDto) {
    await this.auth.reset(dto.token, dto.password);
    return { accepted: true };
  }
  @UseGuards(JwtAuthGuard) @Post('change-password') async change(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: { id: string },
  ) {
    if (dto.newPassword !== dto.newPasswordConfirmation)
      throw new Error('Password confirmation does not match');
    await this.auth.change(user.id, dto.currentPassword, dto.newPassword);
    return { accepted: true };
  }
  @ApiBearerAuth() @ApiCookieAuth() @UseGuards(JwtAuthGuard) @Get('me') me(
    @CurrentUser() user: unknown,
  ) {
    return user;
  }
}
