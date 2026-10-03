import { Permission } from '../permissions';

export default interface ICreateUserDTO {
  name: string;
  email: string;
  password: string;
  role_id?: string | null;
  is_barber?: boolean;
  own_permissions?: Permission[];
  must_change_password?: boolean;
}
