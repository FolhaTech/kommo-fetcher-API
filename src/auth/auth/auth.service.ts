import { Injectable } from '@nestjs/common';
import { UserService } from '../../users/services/user.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from '../dto/register.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { Role } from '../types/role.enum';
import { JwtPayload } from '../types/jwt-payload.type';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const roles = dto.roles?.length ? dto.roles : [Role.USER];
    const user = await this.userService.create(
      dto.email,
      dto.name,
      dto.password,
      roles,
    );
    return this.buildResponse(user.id, user.email, user.name, user.roles);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user || !user.active) {
      throw new Error('Invalid credentials');
    }

    const valid = await this.userService.verifyPassword(
      dto.password,
      user.passwordHash,
    );

    if (!valid) {
      throw new Error('Invalid credentials');
    }
    return this.buildResponse(user.id, user.email, user.name, user.roles);
  }

  private buildResponse(
    id: string,
    email: string,
    name: string,
    roles: Role[],
  ): AuthResponseDto {
    const payload: JwtPayload = { sub: id, email, roles };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: { id, email, name, roles },
    };
  }
}
