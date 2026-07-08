import { Role } from '../../auth/types/role.enum';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  roles: Role[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicUser = Omit<User, 'passwordHash'>;
