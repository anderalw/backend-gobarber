// O que cada usuário da equipe pode fazer, por perfil. Sem nenhuma
// permissão, um barbeiro vê e mexe só na própria agenda

export const PERMISSIONS = [
  {
    key: 'agenda.all',
    group: 'Agenda',
    label: 'Ver a agenda de todos os profissionais',
  },
  {
    key: 'agenda.manage',
    group: 'Agenda',
    label: 'Marcar, remarcar, cancelar e bloquear para qualquer profissional',
  },
  { key: 'clients', group: 'Clientes', label: 'Ver e editar os clientes' },
  {
    key: 'cash',
    group: 'Caixa',
    label: 'Receber pagamentos e cobrar na maquininha',
  },
  { key: 'cash.close', group: 'Caixa', label: 'Fechar o caixa do dia' },
  {
    key: 'club',
    group: 'Clube',
    label: 'Assinaturas e mensalidades do clube',
  },
  { key: 'whatsapp', group: 'WhatsApp', label: 'Enviar as mensagens da fila' },
  {
    key: 'reports',
    group: 'Gestão',
    label: 'Ver o faturamento e os indicadores',
  },
  {
    key: 'catalog',
    group: 'Gestão',
    label: 'Cadastros: serviços, motivos de bloqueio e planos do clube',
  },
  {
    key: 'settings',
    group: 'Gestão',
    label: 'Configurações: marca, site, agenda, maquininha e WhatsApp',
  },
  {
    key: 'team',
    group: 'Gestão',
    label: 'Usuários, perfis, profissionais e horários',
  },
] as const;

export type Permission = (typeof PERMISSIONS)[number]['key'];

export const ALL_PERMISSIONS: Permission[] = PERMISSIONS.map(
  permission => permission.key,
);

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

// Perfis com que toda barbearia começa. O de administrador tem sempre
// todas as permissões e não pode ser alterado nem excluído
export const ADMIN_ROLE = 'admin';

export const DEFAULT_ROLES: Array<{
  system_key: string;
  name: string;
  permissions: Permission[];
}> = [
  { system_key: ADMIN_ROLE, name: 'Administrador', permissions: [] },
  {
    system_key: 'reception',
    name: 'Recepção',
    permissions: [
      'agenda.all',
      'agenda.manage',
      'clients',
      'cash',
      'club',
      'whatsapp',
    ],
  },
  { system_key: 'barber', name: 'Barbeiro', permissions: [] },
];
