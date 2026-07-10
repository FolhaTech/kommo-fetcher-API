import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../types/role.enum';
import { ROLES_KEY } from '../decorators/role.decorator';
import { UserAuthenticationType } from '../types/user-authentication.type';
import { Request } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as UserAuthenticationType;
    if (!user) {
      throw new ForbiddenException('UserEntities not found');
    }
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
