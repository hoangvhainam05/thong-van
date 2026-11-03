import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { CustomerAddress } from './customer-address.entity';
import { Order } from './order.entity';

@Entity('customer')
export class Customer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 20, unique: true })
  phone!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @OneToMany(() => Order, (order) => order.customer)
  orders!: Order[];

  @OneToMany(() => CustomerAddress, (addr) => addr.customer)
  addresses!: CustomerAddress[];
}
