import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.decorators';
import type { UserRole } from '@prisma/client';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }
  override canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    return super.canActivate(context) as boolean | Promise<boolean>;
  }
  override handleRequest<TUser>(error: unknown, user: TUser | false): TUser {
    if (error || !user) throw error instanceof Error ? error : new UnauthorizedException();
    return user;
  }
}

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const authorization = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string } }>().headers.authorization;
    return authorization ? (super.canActivate(context) as boolean | Promise<boolean>) : true;
  }
  override handleRequest<TUser>(error: unknown, user: TUser | false): TUser | undefined {
    if (error || !user) throw error instanceof Error ? error : new UnauthorizedException();
    return user;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles) return true;
    const user = context.switchToHttp().getRequest().user as { role?: UserRole } | undefined;
    if (!user?.role) throw new UnauthorizedException();
    if (!roles.includes(user.role)) throw new ForbiddenException('Insufficient role permissions');
    return true;
  }
}
