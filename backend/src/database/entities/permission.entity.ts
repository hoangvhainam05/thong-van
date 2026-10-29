import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('permission')
export class Permission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 80, unique: true })
  code!: string;

  @Column({ length: 160 })
  name!: string;
}
