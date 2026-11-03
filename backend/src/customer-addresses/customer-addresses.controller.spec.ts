import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { CustomerAddressesController } from './customer-addresses.controller';
import { CustomerAddressesService } from './customer-addresses.service';

describe('CustomerAddressesController', () => {
  let controller: CustomerAddressesController;
  let service: any;
  let dataSource: any;

  beforeEach(async () => {
    service = {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({ id: 1 }),
      setDefault: jest.fn().mockResolvedValue({ id: 1, is_default: true }),
      delete: jest.fn().mockResolvedValue({ success: true }),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerAddressesController],
      providers: [
        { provide: CustomerAddressesService, useValue: service },
        { provide: DataSource, useValue: dataSource },
        { provide: AuthService, useValue: {} },
      ],
    }).compile();

    controller = module.get<CustomerAddressesController>(CustomerAddressesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('calls list with user customerId', async () => {
    const req: any = { user: { id: 1, customerId: 5 } };
    await controller.list(req);
    expect(service.list).toHaveBeenCalledWith(5);
  });

  it('calls create with customerId and dto', async () => {
    const req: any = { user: { id: 1, customerId: 5 } };
    const dto = { address: '123 Phố Huế' };
    await controller.create(req, dto);
    expect(service.create).toHaveBeenCalledWith(5, dto);
  });

  it('calls setDefault with customerId and id', async () => {
    const req: any = { user: { id: 1, customerId: 5 } };
    await controller.setDefault(req, 2);
    expect(service.setDefault).toHaveBeenCalledWith(5, 2);
  });

  it('calls delete with customerId and id', async () => {
    const req: any = { user: { id: 1, customerId: 5 } };
    await controller.delete(req, 2);
    expect(service.delete).toHaveBeenCalledWith(5, 2);
  });
});
