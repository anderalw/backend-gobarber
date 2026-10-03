import { Joi } from 'celebrate';

// Campos extras dos cadastros (as regras de mostrar/obrigatório ficam no
// ProfileFieldsService): aqui só o formato
const text = (max: number) => Joi.string().trim().max(max).allow('', null);

export default {
  cpf: text(20),
  birth_date: text(10),
  address: Joi.object({
    cep: text(9),
    street: text(120),
    number: text(20),
    complement: text(80),
    district: text(80),
    city: text(80),
    state: text(2),
  }).allow(null),
};
