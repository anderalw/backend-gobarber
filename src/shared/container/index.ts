import { container } from 'tsyringe';

import '@modules/users/providers';
import './providers';

import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import AppointmentsRepository from '@modules/appointments/infra/typeorm/repositories/AppointmentsRepository';

import ITimeBlocksRepository from '@modules/appointments/repositories/ITimeBlocksRepository';
import TimeBlocksRepository from '@modules/appointments/infra/typeorm/repositories/TimeBlocksRepository';

import IBlockReasonsRepository from '@modules/appointments/repositories/IBlockReasonsRepository';
import BlockReasonsRepository from '@modules/appointments/infra/typeorm/repositories/BlockReasonsRepository';
import IAppointmentSeriesRepository from '@modules/appointments/repositories/IAppointmentSeriesRepository';
import AppointmentSeriesRepository from '@modules/appointments/infra/typeorm/repositories/AppointmentSeriesRepository';
import IWaitlistRepository from '@modules/appointments/repositories/IWaitlistRepository';
import ICashClosingsRepository from '@modules/appointments/repositories/ICashClosingsRepository';
import CashClosingsRepository from '@modules/appointments/infra/typeorm/repositories/CashClosingsRepository';
import WaitlistRepository from '@modules/appointments/infra/typeorm/repositories/WaitlistRepository';

import IClientNotifier from '@modules/appointments/notifier/IClientNotifier';
import CompositeClientNotifier from '@modules/appointments/notifier/CompositeClientNotifier';
import IWhatsAppMessagesRepository from '@modules/messaging/repositories/IWhatsAppMessagesRepository';
import WhatsAppMessagesRepository from '@modules/messaging/infra/typeorm/repositories/WhatsAppMessagesRepository';
import ManualWhatsAppProvider from '@modules/messaging/providers/WhatsAppProvider/implementations/ManualWhatsAppProvider';
import SimulatorWhatsAppProvider from '@modules/messaging/providers/WhatsAppProvider/implementations/SimulatorWhatsAppProvider';

import ITenantsRepository from '@modules/tenants/repositories/ITenantsRepository';
import TenantsRepository from '@modules/tenants/infra/typeorm/repositories/TenantsRepository';

import IRolesRepository from '@modules/users/repositories/IRolesRepository';
import RolesRepository from '@modules/users/infra/typeorm/repositories/RolesRepository';

import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import UsersRepository from '@modules/users/infra/typeorm/repositories/UsersRepository';

import IUserTokensRepository from '@modules/users/repositories/IUserTokensRepository';
import UserTokensRepository from '@modules/users/infra/typeorm/repositories/UserTokensRepository';

import INotificationsRepository from '@modules/notifications/repositories/INotificationsRepository';
import NotificationsRepository from '@modules/notifications/infra/typeorm/repositories/NotificationsRepository';

import ICardChargesRepository from '@modules/payments/repositories/ICardChargesRepository';
import CardChargesRepository from '@modules/payments/infra/typeorm/repositories/CardChargesRepository';
import ITerminalDevicesRepository from '@modules/payments/repositories/ITerminalDevicesRepository';
import IMembershipPlansRepository from '@modules/memberships/repositories/IMembershipPlansRepository';
import MembershipPlansRepository from '@modules/memberships/infra/typeorm/repositories/MembershipPlansRepository';
import IMembershipsRepository from '@modules/memberships/repositories/IMembershipsRepository';
import MembershipsRepository from '@modules/memberships/infra/typeorm/repositories/MembershipsRepository';
import IMembershipPaymentsRepository from '@modules/memberships/repositories/IMembershipPaymentsRepository';
import MembershipPaymentsRepository from '@modules/memberships/infra/typeorm/repositories/MembershipPaymentsRepository';
import TerminalDevicesRepository from '@modules/payments/infra/typeorm/repositories/TerminalDevicesRepository';
import SimulatorTerminalProvider from '@modules/payments/providers/TerminalProvider/implementations/SimulatorTerminalProvider';
import IGoogleTokenProvider from '@modules/clients/providers/GoogleTokenProvider/models/IGoogleTokenProvider';
import GoogleAuthTokenProvider from '@modules/clients/providers/GoogleTokenProvider/implementations/GoogleAuthTokenProvider';
import IClientsRepository from '@modules/clients/repositories/IClientsRepository';
import ClientsRepository from '@modules/clients/infra/typeorm/repositories/ClientsRepository';
import IClientTokensRepository from '@modules/clients/repositories/IClientTokensRepository';
import ClientTokensRepository from '@modules/clients/infra/typeorm/repositories/ClientTokensRepository';

import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import ProviderSchedulesRepository from '@modules/users/infra/typeorm/repositories/ProviderSchedulesRepository';

import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import ServicesRepository from '@modules/catalog/infra/typeorm/repositories/ServicesRepository';

import ISettingsRepository from '@modules/catalog/repositories/ISettingsRepository';
import SettingsRepository from '@modules/catalog/infra/typeorm/repositories/SettingsRepository';

container.registerSingleton<IAppointmentsRepository>(
  'AppointmentsRepository',
  AppointmentsRepository,
);

container.registerSingleton<ITimeBlocksRepository>(
  'TimeBlocksRepository',
  TimeBlocksRepository,
);

container.registerSingleton<ICashClosingsRepository>(
  'CashClosingsRepository',
  CashClosingsRepository,
);

container.registerSingleton<IWaitlistRepository>(
  'WaitlistRepository',
  WaitlistRepository,
);

container.registerSingleton<IAppointmentSeriesRepository>(
  'AppointmentSeriesRepository',
  AppointmentSeriesRepository,
);

container.registerSingleton<IBlockReasonsRepository>(
  'BlockReasonsRepository',
  BlockReasonsRepository,
);

container.registerSingleton<IClientNotifier>(
  'ClientNotifier',
  // E-mail e WhatsApp
  CompositeClientNotifier,
);

container.registerSingleton<IUsersRepository>(
  'UsersRepository',
  UsersRepository,
);

container.registerSingleton<IUserTokensRepository>(
  'UserTokensRepository',
  UserTokensRepository,
);

container.registerSingleton<INotificationsRepository>(
  'NotificationsRepository',
  NotificationsRepository,
);

container.registerSingleton<ICardChargesRepository>(
  'CardChargesRepository',
  CardChargesRepository,
);

container.registerSingleton<IMembershipPlansRepository>(
  'MembershipPlansRepository',
  MembershipPlansRepository,
);

container.registerSingleton<IMembershipsRepository>(
  'MembershipsRepository',
  MembershipsRepository,
);

container.registerSingleton<IMembershipPaymentsRepository>(
  'MembershipPaymentsRepository',
  MembershipPaymentsRepository,
);

container.registerSingleton<IWhatsAppMessagesRepository>(
  'WhatsAppMessagesRepository',
  WhatsAppMessagesRepository,
);

container.registerSingleton('ManualWhatsAppProvider', ManualWhatsAppProvider);

// Uma instância só: as mensagens simuladas ficam na memória dela
container.registerSingleton(
  'SimulatorWhatsAppProvider',
  SimulatorWhatsAppProvider,
);

container.registerSingleton<ITerminalDevicesRepository>(
  'TerminalDevicesRepository',
  TerminalDevicesRepository,
);

// Uma instância só: as cobranças simuladas ficam na memória dela
container.registerSingleton(
  'SimulatorTerminalProvider',
  SimulatorTerminalProvider,
);

container.registerSingleton<IGoogleTokenProvider>(
  'GoogleTokenProvider',
  GoogleAuthTokenProvider,
);

container.registerSingleton<IClientTokensRepository>(
  'ClientTokensRepository',
  ClientTokensRepository,
);

container.registerSingleton<IClientsRepository>(
  'ClientsRepository',
  ClientsRepository,
);

container.registerSingleton<IProviderSchedulesRepository>(
  'ProviderSchedulesRepository',
  ProviderSchedulesRepository,
);
container.registerSingleton<IServicesRepository>(
  'ServicesRepository',
  ServicesRepository,
);

container.registerSingleton<ISettingsRepository>(
  'SettingsRepository',
  SettingsRepository,
);

container.registerSingleton<ITenantsRepository>(
  'TenantsRepository',
  TenantsRepository,
);

container.registerSingleton<IRolesRepository>(
  'RolesRepository',
  RolesRepository,
);
