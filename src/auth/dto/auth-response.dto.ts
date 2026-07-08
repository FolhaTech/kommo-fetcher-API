export class AuthResponseDto {
  accessToken!: string;
  user!: {
    id: string;
    name: string;
    email: string;
    roles: string[];
  };
}
