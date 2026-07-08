import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserAuthenticationType } from '../types/user-authentication.type';
import { Request } from 'express';

interface AuthenticationRequest extends Request {
  user: UserAuthenticationType;
}

/**
 * @CurrentUser() user -> full user object
 * @CurrentUser('email') -> just email
 * */
export const CurrentUser = createParamDecorator<
  keyof UserAuthenticationType | undefined
>((data: keyof UserAuthenticationType | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticationRequest>();
  const user = request.user;
  return data ? user?.[data] : user;
});
