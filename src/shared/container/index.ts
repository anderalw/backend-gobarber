import { container } from 'tsyringe';

import '@modules/users/providers';
import './providers';

import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import AppointmentsRepository from '@modules/appointments/infra/typeorm/repositories/AppointmentsRepository';

import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import UsersRepository from '@modules/users/infra/typeorm/repositories/UsersRepository';

import IUserTokensRepository from '@modules/users/repositories/IUserTokensRepository';
import UserTokensRepository from '@modules/users/infra/typeorm/repositories/UserTokensRepository';

import INotificationsRepository from '@modules/notifications/repositories/INotificationsRepository';
import NotificationsRepository from '@modules/notifications/infra/typeorm/repositories/NotificationsRepository';

import IClientsRepository from '@modules/clients/repositories/IClientsRepository';
import ClientsRepository from '@modules/clients/infra/typeorm/repositories/ClientsRepository';

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
