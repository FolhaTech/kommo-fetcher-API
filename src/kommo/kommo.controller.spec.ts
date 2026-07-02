// src/kommo/kommo.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { KommoController } from './kommo.controller';
import { KommoService } from './kommo.service';
import { BadRequestException } from '@nestjs/common/exceptions/bad-request.exception';

describe('KommoController', () => {
  let controller: KommoController;
  let service: jest.Mocked<KommoService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KommoController],
      providers: [
        {
          provide: KommoService,
          useValue: {
            getDriveUrl: jest.fn(),
            getContactsByTag: jest.fn(),
            getAllContactsWithFilesPaginated: jest.fn(),
            getContactFiles: jest.fn(),
            downloadFile: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(KommoController);
    service = module.get(KommoService);
  });

  it('getDriveUrl retorna a URL do drive', async () => {
    service.getDriveUrl.mockResolvedValue('https://drive-c.kommo.com/x');
    expect(await controller.getDriveUrl()).toEqual({
      drive_url: 'https://drive-c.kommo.com/x',
    });
  });

  it('getContacts exige tag', async () => {
    await expect(controller.getContacts(undefined, '1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('getContacts repassa tag e page para o service', async () => {
    service.getContactsByTag.mockResolvedValue({});
    await controller.getContacts('curriculo', '2');
    expect(service.getContactsByTag).toHaveBeenCalledWith('curriculo', 2);
  });
});
