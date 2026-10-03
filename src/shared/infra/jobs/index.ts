/* eslint-disable no-console */
import { container } from 'tsyringe';

import forEachTenant from '@shared/tenancy/forEachTenant';
import SendConfirmationRequestsService from '@modules/appointments/services/SendConfirmationRequestsService';
import CardChargeService from '@modules/payments/services/CardChargeService';
import WhatsAppService from '@modules/messaging/services/WhatsAppService';
import MembershipRemindersService from '@modules/messaging/services/MembershipRemindersService';

// Cada tarefa roda em todas as barbearias ativas, uma de cada vez

// De quanto em quanto tempo a tarefa procura agendamentos da véspera
const CONFIRMATION_INTERVAL = 10 * 60 * 1000;
// Espera o servidor terminar de subir antes da primeira rodada
const FIRST_RUN_DELAY = 20 * 1000;

// Uma rodada por vez: se a anterior ainda não acabou, pula esta
function job(label: string, task: (slug: string) => Promise<unknown>) {
  let running = false;

  return async (): Promise<void> => {
    if (running) return;
    running = true;

    try {
      await forEachTenant(label, tenant => task(tenant.slug));
    } catch (err) {
      console.error(`${label}:`, err);
    } finally {
      running = false;
    }
  };
}

const sendConfirmationRequests = job(
  'Falha ao enviar os pedidos de confirmação',
  async slug => {
    const sent = await container
      .resolve(SendConfirmationRequestsService)
      .execute();

    if (sent > 0) {
      console.log(`Pedidos de confirmação enviados (${slug}): ${sent}`);
    }
  },
);

// Cobranças na maquininha ainda aguardando: confere com a operadora, para
// registrar o pagamento mesmo se ninguém estiver com a tela aberta
const CARD_CHARGES_INTERVAL = 30 * 1000;

const refreshCardCharges = job(
  'Falha ao conferir as cobranças na maquininha',
  () => container.resolve(CardChargeService).refreshPending(),
);

// WhatsApp: vence as mensagens que perderam o sentido, tenta de novo as
// falhas do envio automático e avisa os vencimentos do clube
const WHATSAPP_INTERVAL = 5 * 60 * 1000;
const MEMBERSHIP_REMINDERS_INTERVAL = 60 * 60 * 1000;

const maintainWhatsApp = job(
  'Falha na manutenção das mensagens de WhatsApp',
  () => container.resolve(WhatsAppService).maintain(),
);

const remindMemberships = job(
  'Falha ao avisar os vencimentos do clube',
  async slug => {
    const queued = await container
      .resolve(MembershipRemindersService)
      .execute();

    if (queued > 0) {
      console.log(`Avisos de mensalidade do clube (${slug}): ${queued}`);
    }
  },
);

// Tarefas periódicas do servidor
export default function startJobs(): void {
  setTimeout(sendConfirmationRequests, FIRST_RUN_DELAY);
  setInterval(sendConfirmationRequests, CONFIRMATION_INTERVAL);
  setInterval(refreshCardCharges, CARD_CHARGES_INTERVAL);
  setInterval(maintainWhatsApp, WHATSAPP_INTERVAL);
  setTimeout(remindMemberships, FIRST_RUN_DELAY);
  setInterval(remindMemberships, MEMBERSHIP_REMINDERS_INTERVAL);
}
