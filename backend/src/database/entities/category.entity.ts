import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('product_category')
export class Category {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  id!: string;

  @Column({ type: 'varchar', length: 60 })
  name!: string;
}
