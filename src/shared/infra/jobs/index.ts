/* eslint-disable no-console */
import { container } from 'tsyringe';

import SendConfirmationRequestsService from '@modules/appointments/services/SendConfirmationRequestsService';
import CardChargeService from '@modules/payments/services/CardChargeService';

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

// Tarefas periódicas do servidor
export default function startJobs(): void {
  setTimeout(sendConfirmationRequests, FIRST_RUN_DELAY);
  setInterval(sendConfirmationRequests, CONFIRMATION_INTERVAL);
  setInterval(refreshCardCharges, CARD_CHARGES_INTERVAL);
}
