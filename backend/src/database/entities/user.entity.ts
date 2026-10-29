import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Customer } from './customer.entity';
import { Driver } from './driver.entity';
import { Role } from './role.entity';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Role, { nullable: false })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @OneToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer | null;

  @OneToOne(() => Driver, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver | null;

  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 120, nullable: true, unique: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  phone!: string | null;

  @Column({ name: 'password_hash', length: 255, select: false })
  passwordHash!: string;

  @Column({ default: true })
  active!: boolean;

  @Column({ name: 'notifications_enabled_at', type: 'datetime', precision: 6, nullable: true })
  notificationsEnabledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
