import { Injectable } from '@nestjs/common';
import { PublicUser, User } from '../types/user.type';
import { Role } from '../../auth/types/role.enum';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UserService {
  private readonly users: User[] = [];

  async create(
    email: string,
    name: string,
    password: string,
    roles: Role[] = [Role.USER],
  ): Promise<PublicUser> {
    const exists = this.users.find((user) => user.email === email);
    if (exists) {
      throw new Error('User already exists');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const now = new Date();
    const user: User = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash,
      roles,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    this.users.push(user);
    return this.toPublic(user);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.users.find((user) => user.email === email);
  }

  async findById(id: string): Promise<PublicUser | undefined> {
    const user = this.users.find((user) => user.id === id);
    if (!user) {
      throw new Error('User not found');
    }
    return this.toPublic(user);
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  private toPublic(user: User): PublicUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
