// Documentos e endereço brasileiros

export const onlyDigits = (value: string): string => value.replace(/\D/g, '');

// CPF com os dois dígitos verificadores certos (e não todos iguais)
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const check = (length: number): number => {
    const sum = cpf
      .slice(0, length)
      .split('')
      .reduce(
        (total, digit, index) => total + Number(digit) * (length + 1 - index),
        0,
      );
    const rest = (sum * 10) % 11;

    return rest === 10 ? 0 : rest;
  };

  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]);
}

export interface IAddress {
  cep: string;
  street: string;
  number: string;
  complement?: string | null;
  district?: string | null;
  city: string;
  state: string;
}

const STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

// O que falta ou está errado no endereço (null = está certo)
export function addressProblem(address: IAddress): string | null {
  if (onlyDigits(address.cep || '').length !== 8) return 'CEP inválido.';
  if (!address.street?.trim()) return 'Informe a rua do endereço.';
  if (!address.number?.trim()) return 'Informe o número do endereço.';
  if (!address.city?.trim()) return 'Informe a cidade do endereço.';
  if (!STATES.includes((address.state || '').toUpperCase())) {
    return 'Informe a UF do endereço.';
  }

  return null;
}

export function cleanAddress(address: IAddress): IAddress {
  const clean = (value?: string | null): string | null =>
    value?.trim() ? value.trim() : null;

  return {
    cep: onlyDigits(address.cep),
    street: address.street.trim(),
    number: address.number.trim(),
    complement: clean(address.complement),
    district: clean(address.district),
    city: address.city.trim(),
    state: address.state.toUpperCase(),
  };
}
