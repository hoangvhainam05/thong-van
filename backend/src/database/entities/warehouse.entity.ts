import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('warehouse')
export class Warehouse {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 255 })
  address!: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat!: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng!: string;
}
