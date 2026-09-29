/* eslint-disable no-console */
import { container } from 'tsyringe';

import SendConfirmationRequestsService from '@modules/appointments/services/SendConfirmationRequestsService';

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

// Tarefas periódicas do servidor (hoje só os pedidos de confirmação)
export default function startJobs(): void {
  setTimeout(sendConfirmationRequests, FIRST_RUN_DELAY);
  setInterval(sendConfirmationRequests, CONFIRMATION_INTERVAL);
}
