import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('audit_event')
export class AuditEvent {
  @PrimaryGeneratedColumn({type:'bigint',unsigned:true}) id!: string;
  @Column({name:'user_id',type:'int',nullable:true}) userId!: number | null;
  @Column({name:'actor_name',length:120}) actorName!: string;
  @Column({name:'actor_role',length:32}) actorRole!: string;
  @Column({length:10}) method!: string;
  @Column({length:255}) path!: string;
  @Column({type:'json',nullable:true}) details!: Record<string,unknown> | null;
  @CreateDateColumn({name:'created_at',type:'datetime',precision:6}) createdAt!: Date;
}
