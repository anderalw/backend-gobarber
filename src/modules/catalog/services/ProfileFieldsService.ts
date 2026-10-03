import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import {
  IAddress,
  addressProblem,
  cleanAddress,
  isValidCpf,
  onlyDigits,
} from '@shared/utils/documents';
import ISettingsRepository from '../repositories/ISettingsRepository';

const SETTING_KEY = 'profile_fields';

// Campos opcionais dos cadastros. O nome sempre aparece; o telefone do
// cliente também (lembretes e WhatsApp dependem dele)
export type ProfileField = 'email' | 'phone' | 'cpf' | 'birth_date' | 'address';

// Onde o cadastro acontece: o cliente no site, a barbearia no balcão
// (agenda e ficha do cliente) e a equipe (página do usuário)
export type ProfileContext = 'client_site' | 'client_counter' | 'staff';

export const CONTEXT_FIELDS: Record<ProfileContext, ProfileField[]> = {
  // No site o e-mail é o login: sempre obrigatório
  client_site: ['cpf', 'birth_date', 'address'],
  client_counter: ['email', 'cpf', 'birth_date', 'address'],
  staff: ['phone', 'cpf', 'birth_date', 'address'],
};

export const FIELD_LABELS: Record<ProfileField, string> = {
  email: 'o e-mail',
  phone: 'o telefone',
  cpf: 'o CPF',
  birth_date: 'a data de nascimento',
  address: 'o endereço',
};

export interface IFieldRule {
  show: boolean;
  required: boolean;
}

export type IProfileFieldRules = Record<
  ProfileContext,
  Partial<Record<ProfileField, IFieldRule>>
>;

// Como uma barbearia nova começa: nada a mais no site; no balcão, o e-mail
// aparece (opcional)
const DEFAULTS: IProfileFieldRules = {
  client_site: {
    cpf: { show: false, required: false },
    birth_date: { show: false, required: false },
    address: { show: false, required: false },
  },
  client_counter: {
    email: { show: true, required: false },
    cpf: { show: false, required: false },
    birth_date: { show: false, required: false },
    address: { show: false, required: false },
  },
  staff: {
    phone: { show: true, required: false },
    cpf: { show: false, required: false },
    birth_date: { show: false, required: false },
    address: { show: false, required: false },
  },
};

export interface IProfileValues {
  email?: string | null;
  phone?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  address?: IAddress | null;
}

// Regras de cada campo e a conferência dos dados de um cadastro
@injectable()
class ProfileFieldsService {
  constructor(
    @inject('SettingsRepository')
    private settingsRepository: ISettingsRepository,
  ) {}

  public async get(): Promise<IProfileFieldRules> {
    const stored = await this.settingsRepository.get(SETTING_KEY);
    let saved: Partial<IProfileFieldRules> = {};

    try {
      saved = stored ? JSON.parse(stored) : {};
    } catch {
      saved = {};
    }

    // Campos novos (de uma versão mais nova) começam com o padrão
    return Object.fromEntries(
      (Object.keys(CONTEXT_FIELDS) as ProfileContext[]).map(context => [
        context,
        Object.fromEntries(
          CONTEXT_FIELDS[context].map(field => [
            field,
            { ...DEFAULTS[context][field], ...saved[context]?.[field] },
          ]),
        ),
      ]),
    ) as IProfileFieldRules;
  }

  public async update(rules: IProfileFieldRules): Promise<IProfileFieldRules> {
    const clean = Object.fromEntries(
      (Object.keys(CONTEXT_FIELDS) as ProfileContext[]).map(context => [
        context,
        Object.fromEntries(
          CONTEXT_FIELDS[context].map(field => {
            const rule = rules[context]?.[field];
            const show = !!rule?.show;

            // Obrigatório só o que aparece
            return [field, { show, required: show && !!rule?.required }];
          }),
        ),
      ]),
    ) as IProfileFieldRules;

    await this.settingsRepository.set(SETTING_KEY, JSON.stringify(clean));

    return clean;
  }

  // Confere os campos opcionais de um cadastro: os escondidos são
  // ignorados, os obrigatórios precisam vir e os que vieram precisam estar
  // certos. Devolve só o que pode ser gravado
  public async check(
    context: ProfileContext,
    input: IProfileValues,
  ): Promise<IProfileValues> {
    const rules = (await this.get())[context];
    const result: IProfileValues = {};

    CONTEXT_FIELDS[context].forEach(field => {
      const rule = rules[field];

      if (!rule?.show) return;

      const value = input[field];
      const empty =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && !value.trim());

      if (empty) {
        if (rule.required) {
          throw new AppError(`Informe ${FIELD_LABELS[field]}.`);
        }

        // Não veio: não mexe no que já estava gravado
        if (value === undefined) return;

        result[field] = null;
        return;
      }

      switch (field) {
        case 'cpf': {
          if (!isValidCpf(String(value))) throw new AppError('CPF inválido.');
          result.cpf = onlyDigits(String(value));
          break;
        }
        case 'birth_date': {
          const text = String(value).slice(0, 10);
          const date = new Date(`${text}T12:00:00`);
          const years = (Date.now() - date.getTime()) / (365.25 * 86400000);

          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
            Number.isNaN(years) ||
            years < 0 ||
            years > 120
          ) {
            throw new AppError('Data de nascimento inválida.');
          }

          result.birth_date = text;
          break;
        }
        case 'address': {
          const problem = addressProblem(value as IAddress);

          if (problem) throw new AppError(problem);

          result.address = cleanAddress(value as IAddress);
          break;
        }
        case 'email':
          result.email = String(value).trim();
          break;
        case 'phone':
          result.phone = String(value).trim();
          break;
        default:
          break;
      }
    });

    return result;
  }
}

export default ProfileFieldsService;
