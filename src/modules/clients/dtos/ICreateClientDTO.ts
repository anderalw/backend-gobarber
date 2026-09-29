export default interface ICreateClientDTO {
  name: string;
  email: string | null;
  // Hash da senha; null no cadastro feito pelo barbeiro
  password: string | null;
  phone: string;
  // Login com Google
  google_id?: string | null;
}
