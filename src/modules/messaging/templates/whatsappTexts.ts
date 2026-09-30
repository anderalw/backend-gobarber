// Os tipos do date-fns e do idioma ficam no mesmo arquivo: a regra de
// imports duplicados confunde os dois
/* eslint-disable import/no-duplicates */
import { format, isTomorrow, isToday, parseISO } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';

import Appointment from '@modules/appointments/infra/typeorm/entities/Appointment';

// Textos das mensagens de WhatsApp: curtos, com o essencial e um link

const site = (): string => process.env.APP_WEB_URL || '';

const firstName = (name: string): string => name.split(' ')[0];

// "amanhã (quinta, 01/10) às 10:00" / "sexta, 02/10 às 10:00"
function when(date: Date): string {
  const day = format(date, "EEEE, dd/MM 'às' HH:mm", { locale: ptBR }).replace(
    '-feira',
    '',
  );

  if (isToday(date)) return `hoje às ${format(date, 'HH:mm')}`;
  if (isTomorrow(date)) return `amanhã (${day})`;

  return day;
}

function details(appointment: Appointment): string {
  const service = appointment.service?.name || 'atendimento';
  const provider = appointment.provider?.name;

  return `${service}, ${when(appointment.date)}${
    provider ? ` com ${provider}` : ''
  }`;
}

const hello = (appointment: Appointment, shop: string): string =>
  `Olá, ${firstName(
    appointment.client?.name || 'cliente',
  )}! Aqui é da ${shop}.`;

export function reminderText(
  appointment: Appointment,
  shop: string,
  confirmLink: string,
): string {
  return [
    hello(appointment, shop),
    `Lembrete do seu horário: ${details(appointment)}.`,
    `Confirme ou cancele por aqui: ${confirmLink}`,
  ].join('\n\n');
}

export function createdText(appointment: Appointment, shop: string): string {
  return [
    hello(appointment, shop),
    `Seu horário está marcado: ${details(appointment)}.`,
    `Seus agendamentos: ${site()}/meus-agendamentos`,
  ].join('\n\n');
}

export function rescheduledText(
  appointment: Appointment,
  shop: string,
): string {
  return [
    hello(appointment, shop),
    `Seu horário foi remarcado para: ${details(appointment)}.`,
    `Seus agendamentos: ${site()}/meus-agendamentos`,
  ].join('\n\n');
}

export function canceledText(appointment: Appointment, shop: string): string {
  return [
    hello(appointment, shop),
    `Seu horário de ${format(
      appointment.date,
      "dd/MM 'às' HH:mm",
    )} foi cancelado.`,
    `Para marcar outro: ${site()}/agendar`,
  ].join('\n\n');
}

export function seriesCreatedText(
  appointments: Appointment[],
  shop: string,
  interval: string,
): string {
  const [first] = appointments;

  return [
    hello(first, shop),
    `Marcamos ${appointments.length} horários (${interval}) de ${
      first.service?.name || 'atendimento'
    }:`,
    appointments
      .map(item => `• ${format(item.date, "dd/MM 'às' HH:mm")}`)
      .join('\n'),
    `Seus agendamentos: ${site()}/meus-agendamentos`,
  ].join('\n\n');
}

export function seriesCanceledText(
  appointments: Appointment[],
  shop: string,
): string {
  const [first] = appointments;

  return [
    hello(first, shop),
    `Cancelamos ${appointments.length} horários:`,
    appointments
      .map(item => `• ${format(item.date, "dd/MM 'às' HH:mm")}`)
      .join('\n'),
    `Para marcar outros: ${site()}/agendar`,
  ].join('\n\n');
}

export function waitlistText(
  clientName: string,
  freed: Appointment,
  shop: string,
): string {
  return [
    `Olá, ${firstName(clientName)}! Aqui é da ${shop}.`,
    `Abriu um horário ${when(freed.date)}, no dia que você estava esperando.`,
    `Garanta a vaga: ${site()}/agendar`,
  ].join('\n\n');
}

// paidUntil: 'yyyy-MM-dd', exclusivo (último dia pago = véspera)
export function membershipDueText(
  clientName: string,
  planName: string,
  price: string,
  dueDay: string,
  shop: string,
): string {
  return [
    `Olá, ${firstName(clientName)}! Aqui é da ${shop}.`,
    `A mensalidade do seu plano ${planName} (${price}) vence em ${format(
      parseISO(dueDay),
      'dd/MM',
    )}.`,
    'É só pagar na barbearia para continuar com os benefícios do clube.',
  ].join('\n\n');
}

export function membershipOverdueText(
  clientName: string,
  planName: string,
  price: string,
  shop: string,
): string {
  return [
    `Olá, ${firstName(clientName)}! Aqui é da ${shop}.`,
    `A mensalidade do seu plano ${planName} (${price}) está em atraso. Enquanto isso, os serviços são cobrados no preço normal.`,
    'Assim que você pagar na barbearia, os benefícios voltam na hora.',
  ].join('\n\n');
}
