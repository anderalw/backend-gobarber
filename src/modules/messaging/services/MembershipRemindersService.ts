// Sem entidades do TypeORM (que carregam o polyfill), o tsyringe precisa dele
import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';

import BrandingService from '@modules/catalog/services/BrandingService';
import IMembershipsRepository from '@modules/memberships/repositories/IMembershipsRepository';
import {
  GRACE_DAYS,
  stateOf,
} from '@modules/memberships/utils/membershipRules';
import WhatsAppService from './WhatsAppService';
import {
  membershipDueText,
  membershipOverdueText,
} from '../templates/whatsappTexts';

// Com quantos dias de antecedência avisa do vencimento
export const DUE_NOTICE_DAYS = 3;

const price = (cents: number): string =>
  `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

// Tarefa periódica do clube: avisa quem vence nos próximos dias e quem
// atrasou (uma mensagem de cada por vencimento)
@injectable()
class MembershipRemindersService {
  constructor(
    @inject('MembershipsRepository')
    private membershipsRepository: IMembershipsRepository,

    @inject(WhatsAppService)
    private whatsapp: WhatsAppService,

    @inject(BrandingService)
    private branding: BrandingService,
  ) {}

  // Quantas mensagens entraram na fila
  public async execute(): Promise<number> {
    const now = new Date(Date.now());
    const active = await this.membershipsRepository.findByStatus(['active']);
    const { name: shop } = await this.branding.get();
    let queued = 0;

    // eslint-disable-next-line no-restricted-syntax
    for (const membership of active) {
      const { paid_until: paidUntil, client, plan } = membership;

      // eslint-disable-next-line no-continue
      if (!paidUntil || !client || !plan) continue;

      const due = parseISO(paidUntil);
      const daysLeft = differenceInCalendarDays(due, now);
      const overdue = stateOf(membership, now) === 'overdue';
      let message = null;

      if (overdue) {
        // eslint-disable-next-line no-await-in-loop
        message = await this.whatsapp.enqueue({
          kind: 'membership_overdue',
          client,
          body: membershipOverdueText(
            client.name,
            plan.name,
            price(plan.price_cents),
            shop,
          ),
          dedupe_key: `membership_overdue:${membership.id}:${paidUntil}`,
          expires_at: addDays(now, 7),
        });
      } else if (daysLeft >= 0 && daysLeft <= DUE_NOTICE_DAYS) {
        // eslint-disable-next-line no-await-in-loop
        message = await this.whatsapp.enqueue({
          kind: 'membership_due',
          client,
          body: membershipDueText(
            client.name,
            plan.name,
            price(plan.price_cents),
            paidUntil,
            shop,
          ),
          dedupe_key: `membership_due:${membership.id}:${paidUntil}`,
          // Depois da tolerância vira o aviso de atraso
          expires_at: addDays(due, GRACE_DAYS),
        });
      }

      if (message) queued += 1;
    }

    return queued;
  }
}

export default MembershipRemindersService;
