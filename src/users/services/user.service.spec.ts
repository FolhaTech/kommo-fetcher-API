import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { SupabaseService } from '../../db/supabase.service';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              from: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              insert: jest.fn().mockReturnThis(),
              maybeSingle: jest
                .fn()
                .mockResolvedValue({ data: null, error: null }),
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
