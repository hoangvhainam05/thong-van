import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CustomerAddress } from '../database/entities';
import { CustomerAddressesService } from './customer-addresses.service';

describe('CustomerAddressesService', () => {
  let service: CustomerAddressesService;
  let mockRepo: any;

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity, createdAt: new Date(), updatedAt: new Date() })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      remove: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerAddressesService,
        {
          provide: getRepositoryToken(CustomerAddress),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<CustomerAddressesService>(CustomerAddressesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    it('returns addresses list for customer', async () => {
      mockRepo.find.mockResolvedValue([
        {
          id: 1,
          customerId: 10,
          label: 'Nhà riêng',
          recipientName: 'A',
          phone: '0901234567',
          address: '123 Phố Huế',
          district: 'Hai Bà Trưng',
          lat: '21.01',
          lng: '105.85',
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const res = await service.list(10);
      expect(res).toHaveLength(1);
      expect(res[0].label).toBe('Nhà riêng');
      expect(res[0].is_default).toBe(true);
      expect(res[0].lat).toBe(21.01);
    });
  });

  describe('create', () => {
    it('sets is_default to true if first address', async () => {
      mockRepo.count.mockResolvedValue(0);

      const res = await service.create(10, {
        address: '123 Phố Huế',
        is_default: false,
      });

      expect(res.is_default).toBe(true);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('unsets other defaults if new address is default', async () => {
      mockRepo.count.mockResolvedValue(2);

      const res = await service.create(10, {
        address: '456 Cầu Giấy',
        is_default: true,
      });

      expect(res.is_default).toBe(true);
      expect(mockRepo.update).toHaveBeenCalledWith({ customerId: 10 }, { isDefault: false });
    });
  });

  describe('setDefault', () => {
    it('updates default address', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce({ id: 2, customerId: 10, isDefault: false })
        .mockResolvedValueOnce({ id: 2, customerId: 10, isDefault: true, createdAt: new Date(), updatedAt: new Date() });

      const res = await service.setDefault(10, 2);
      expect(mockRepo.update).toHaveBeenCalledWith({ customerId: 10 }, { isDefault: false });
      expect(mockRepo.update).toHaveBeenCalledWith({ id: 2, customerId: 10 }, { isDefault: true });
      expect(res.is_default).toBe(true);
    });

    it('throws if address not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.setDefault(10, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes and sets new default if was default', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce({ id: 1, customerId: 10, isDefault: true })
        .mockResolvedValueOnce({ id: 2, customerId: 10, isDefault: false });

      const res = await service.delete(10, 1);
      expect(mockRepo.remove).toHaveBeenCalled();
      expect(mockRepo.update).toHaveBeenCalledWith({ id: 2 }, { isDefault: true });
      expect(res.success).toBe(true);
    });
  });
});
