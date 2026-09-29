export default interface ICreateNotificationDTO {
  content: string;
  recipient_id: string;
  // Data do agendamento: ao clicar, a agenda abre nesse dia
  date?: Date;
}
