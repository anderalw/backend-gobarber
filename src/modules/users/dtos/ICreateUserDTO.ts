export default interface ICreateUserDTO {
  name: string;
  email: string;
  password: string;
  role_id?: string | null;
  is_barber?: boolean;
}
