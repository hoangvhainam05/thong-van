import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
@Entity('user_notification_read')
export class UserNotificationRead {
  @PrimaryColumn({ name: 'user_id', type: 'int' }) userId!: number;
  @PrimaryColumn({ name: 'history_id', type: 'int' }) historyId!: number;
  @CreateDateColumn({ name: 'read_at', type: 'datetime' }) readAt!: Date;
}
