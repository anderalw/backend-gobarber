import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

// Cliente fixo: horários marcados de uma vez, a cada interval_weeks semanas.
// Os agendamentos da série são comuns (podem ser remarcados ou cancelados
// um a um); a série só os agrupa
@Entity('appointment_series')
class AppointmentSeries {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  client_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  provider_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  service_id: string | null;

  @Column({ type: 'int' })
  interval_weeks: number;

  // Barbeiro que marcou a série
  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}

export default AppointmentSeries;
