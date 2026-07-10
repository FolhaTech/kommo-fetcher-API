import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../db/supabase.service';
import { User } from '../types/user.type';
import { PublicUser } from '../types/user.type';
import { Role } from '../../auth/types/role.enum';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UserService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(
    email: string,
    name: string,
    password: string,
    roles: Role[] = [Role.USER],
  ): Promise<PublicUser> {
    const { data: existing } = await this.supabase.client
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      throw new Error('User already exists');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const { data: user, error } = await this.supabase.client
      .from('users')
      .insert({
        name,
        email,
        password_hash: passwordHash,
        roles,
        active: true,
      })
      .select('*')
      .single();

    if (error) throw error;
    return this.toPublic(this.mapRow(user));
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const { data: user } = await this.supabase.client
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    return user ? this.mapRow(user) : undefined;
  }

  async findById(id: string): Promise<PublicUser | undefined> {
    const { data: user } = await this.supabase.client
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!user) {
      throw new Error('User not found');
    }
    return this.toPublic(this.mapRow(user));
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  private mapRow(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      name: row.name as string,
      email: row.email as string,
      passwordHash: row.password_hash as string,
      roles: row.roles as Role[],
      active: row.active as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private toPublic(user: User): PublicUser {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
