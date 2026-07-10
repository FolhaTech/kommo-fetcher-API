import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../../config/env.config';
import { JwtPayload } from '../types/jwt-payload.type';
import { UserAuthenticationType } from '../types/user-authentication.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService<EnvConfig, true>) {
    const secret = configService.get('jwt.secret', { infer: true });
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async validate(payload: JwtPayload): Promise<UserAuthenticationType> {
    if (!payload.sub || !payload.email) {
      throw new Error('Invalid JWT payload');
    }
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
    };
  }
}
