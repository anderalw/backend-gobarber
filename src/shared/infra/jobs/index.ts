/* eslint-disable no-console */
import { container } from 'tsyringe';

import SendConfirmationRequestsService from '@modules/appointments/services/SendConfirmationRequestsService';
import CardChargeService from '@modules/payments/services/CardChargeService';
import WhatsAppService from '@modules/messaging/services/WhatsAppService';
import MembershipRemindersService from '@modules/messaging/services/MembershipRemindersService';

// De quanto em quanto tempo a tarefa procura agendamentos da véspera
const CONFIRMATION_INTERVAL = 10 * 60 * 1000;
// Espera o servidor terminar de subir antes da primeira rodada
const FIRST_RUN_DELAY = 20 * 1000;

async function sendConfirmationRequests(): Promise<void> {
  try {
    const sent = await container
      .resolve(SendConfirmationRequestsService)
      .execute();

    if (sent > 0) {
      console.log(`Pedidos de confirmação enviados: ${sent}`);
    }
  } catch (err) {
    console.error('Falha ao enviar os pedidos de confirmação:', err);
  }
}

// Cobranças na maquininha ainda aguardando: confere com a operadora, para
// registrar o pagamento mesmo se ninguém estiver com a tela aberta
const CARD_CHARGES_INTERVAL = 30 * 1000;

async function refreshCardCharges(): Promise<void> {
  try {
    await container.resolve(CardChargeService).refreshPending();
  } catch (err) {
    console.error('Falha ao conferir as cobranças na maquininha:', err);
  }
}

// WhatsApp: vence as mensagens que perderam o sentido, tenta de novo as
// falhas do envio automático e avisa os vencimentos do clube
const WHATSAPP_INTERVAL = 5 * 60 * 1000;
const MEMBERSHIP_REMINDERS_INTERVAL = 60 * 60 * 1000;

async function maintainWhatsApp(): Promise<void> {
  try {
    await container.resolve(WhatsAppService).maintain();
  } catch (err) {
    console.error('Falha na manutenção das mensagens de WhatsApp:', err);
  }
}

async function remindMemberships(): Promise<void> {
  try {
    const queued = await container
      .resolve(MembershipRemindersService)
      .execute();

    if (queued > 0) {
      console.log(`Avisos de mensalidade do clube: ${queued}`);
    }
  } catch (err) {
    console.error('Falha ao avisar os vencimentos do clube:', err);
  }
}

// Tarefas periódicas do servidor
export default function startJobs(): void {
  setTimeout(sendConfirmationRequests, FIRST_RUN_DELAY);
  setInterval(sendConfirmationRequests, CONFIRMATION_INTERVAL);
  setInterval(refreshCardCharges, CARD_CHARGES_INTERVAL);
  setInterval(maintainWhatsApp, WHATSAPP_INTERVAL);
  setTimeout(remindMemberships, FIRST_RUN_DELAY);
  setInterval(remindMemberships, MEMBERSHIP_REMINDERS_INTERVAL);
}
