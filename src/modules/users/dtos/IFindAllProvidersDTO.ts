export default interface IFindAllProvidersDTO {
  except_user_id?: string;
  // Por padrão só vêm os barbeiros ativos
  include_inactive?: boolean;
}
