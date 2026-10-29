import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
@Entity('maintenance_record')
export class MaintenanceRecord {
  @PrimaryGeneratedColumn() id!: number;
  @Column({name:'order_item_id',type:'int'}) orderItemId!: number;
  @Column({name:'cycle_no',type:'int'}) cycleNo!: number;
  @Column({name:'due_date',type:'date'}) dueDate!: string;
  @Column({name:'completed_date',type:'date'}) completedDate!: string;
  @Column({name:'recorded_by',type:'int',nullable:true}) recordedBy!: number | null;
  @CreateDateColumn({name:'created_at',type:'datetime',precision:6}) createdAt!: Date;
}
@Entity('maintenance_reminder_read')
export class MaintenanceReminderRead {
  @PrimaryColumn({name:'user_id',type:'int'}) userId!: number;
  @PrimaryColumn({name:'order_item_id',type:'int'}) orderItemId!: number;
  @PrimaryColumn({name:'cycle_no',type:'int'}) cycleNo!: number;
  @CreateDateColumn({name:'read_at',type:'datetime',precision:6}) readAt!: Date;
}
