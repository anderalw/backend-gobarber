import { format } from 'date-fns';

import IClientProfile from '../dtos/IClientProfile';

// Separado por ponto e vírgula e com BOM: o Excel em português abre direto,
// com acentos e colunas certas
const SEPARATOR = ';';

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';

  let text = String(value);

  // Não deixa a planilha interpretar o texto como fórmula
  if (/^[=+\-@]/.test(text)) text = `'${text}`;

  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const day = (value: Date | string | null): string =>
  value ? format(new Date(value), 'dd/MM/yyyy') : '';

const money = (cents: number): string =>
  (cents / 100).toFixed(2).replace('.', ',');

function birthDate(value: string | null): string {
  if (!value) return '';

  const [year, month, date] = value.split('-');

  return `${date}/${month}/${year}`;
}

export default function clientsCsv(clients: IClientProfile[]): string {
  const header = [
    'Nome',
    'Telefone',
    'E-mail',
    'CPF',
    'Nascimento',
    'Atendimentos',
    'Faltas',
    'Última visita',
    'Próximo horário',
    'Total gasto (R$)',
    'Cliente desde',
  ];

  const rows = clients.map(client => [
    client.name,
    client.phone,
    client.email,
    client.cpf,
    birthDate(client.birth_date),
    client.summary.completed,
    client.summary.no_shows,
    day(client.summary.last_visit),
    client.summary.next_appointment
      ? format(new Date(client.summary.next_appointment), 'dd/MM/yyyy HH:mm')
      : '',
    money(client.summary.total_cents),
    day(client.created_at),
  ]);

  return `\uFEFF${[header, ...rows]
    .map(row => row.map(cell).join(SEPARATOR))
    .join('\r\n')}\r\n`;
}
