/**
 * Formata um número de telefone no padrão (00) 0000-0000 (fixo/celular
 * antigo, 10 dígitos) ou (00) 0 0000-0000 (celular com o 9º dígito, 11
 * dígitos). O 9º dígito fica isolado entre parênteses e o resto do número
 * — essa é a máscara usada em todo o app por causa do envio de cobranças
 * via WhatsApp (ver buildWaId, que depende da contagem exata de dígitos).
 */
export const formatPhone = (value: string) => {
  if (!value) return "";
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  if (numbers.length <= 10) {
    return numbers.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return numbers.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, "($1) $2 $3-$4");
};

/**
 * Valida se um telefone (formatado ou não) tem exatamente 10 dígitos
 * — (00) 0000-0000 — ou 11 dígitos — (00) 0 0000-0000. Qualquer outra
 * contagem é rejeitada, pois quebraria o envio de cobranças via WhatsApp.
 */
export const isValidPhone = (value: string): boolean => {
  const numbers = value.replace(/\D/g, "");
  return numbers.length === 10 || numbers.length === 11;
};

/**
 * Normaliza um telefone de aluno pro mesmo formato do wa_id que o WhatsApp
 * usa (dígitos + DDI 55, sem o 9 extra do celular - a Cloud API manda o
 * wa_id de números BR já sem esse dígito). Precisa ficar consistente com a
 * normalização equivalente feita em SQL (coluna gerada whatsapp_id do
 * student) e no workflow n8n de recebimento, senão o mesmo contato vira
 * duas conversas diferentes.
 */
export const buildWaId = (telephone: string | null | undefined): string | null => {
  if (!telephone) return null;
  const digits = telephone.replace(/\D/g, "");
  if (!digits) return null;
  const local = digits.length === 11 && digits[2] === "9" ? digits.slice(0, 2) + digits.slice(3) : digits;
  return `55${local}`;
};

/**
 * Formata um CPF no padrão XXX.XXX.XXX-XX
 */
export const formatCPF = (value: string) => {
  if (!value) return "";
  const numbers = value.replace(/\D/g, "");
  return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

/**
 * Formata uma data de nascimento para exibição (YYYY-MM-DD para DD/MM/YYYY)
 * Útil para campos que não são input type="date"
 */
export const formatDateToBR = (dateStr: string) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
};

/**
 * Formata um input de data digitado livremente para DD/MM/YYYY
 */
export const formatDateInput = (value: string) => {
  if (!value) return "";
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 4) return numbers.replace(/(\d{2})(\d{1,2})/, "$1/$2");
  return numbers.replace(/(\d{2})(\d{2})(\d{1,4})/, "$1/$2/$3").slice(0, 10);
};

export const toBRDate = (isoDate: string | null | undefined) => {
  if (!isoDate) return "";
  if (isoDate.includes("/")) return isoDate; 
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
};

export const toISODate = (brDate: string | null | undefined) => {
  if (!brDate) return "";
  if (brDate.includes("-")) return brDate; 
  const [day, month, year] = brDate.split("/");
  if (!year || year.length < 4) return "";
  return `${year}-${month}-${day}`;
};

/**
 * Calcula a idade a partir de uma data de nascimento no formato DD/MM/AAAA
 */
export const calculateAge = (brDate: string | null | undefined): number | null => {
  if (!brDate) return null;
  const [day, month, year] = brDate.split("/");
  if (!day || !month || !year || year.length < 4) return null;
  const birth = new Date(Number(year), Number(month) - 1, Number(day));
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age--;
  return age >= 0 ? age : null;
};

/**
 * Formata um input de preço digitado livremente para o padrão BR (1.234,56),
 * inserindo os centavos e separadores de milhar conforme o usuário digita.
 */
export const formatCurrencyInput = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return "";
  const cents = numbers.replace(/^0+(?=\d)/, "").padStart(3, "0");
  const intPart = cents.slice(0, -2);
  const decPart = cents.slice(-2);
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withThousands},${decPart}`;
};

/**
 * Converte um preço formatado no padrão BR (1.234,56) para número (1234.56)
 */
export const parseCurrencyToNumber = (value: string | null | undefined): number | undefined => {
  if (!value) return undefined;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return isNaN(n) ? undefined : n;
};

/**
 * Formata um número como string no padrão BR para preencher um input de preço
 */
export const numberToCurrencyInput = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Limpa toda formatação, deixando apenas números
 */
export const stripNonDigits = (value: string) => {
  if (!value) return "";
  return value.replace(/\D/g, "");
};

/**
 * Formata um CEP no padrão XXXXX-XXX
 */
export const formatCEP = (value: string) => {
  if (!value) return "";
  const numbers = value.replace(/\D/g, "");
  return numbers.replace(/(\d{5})(\d{1,3})/, "$1-$2").slice(0, 9);
};

export interface CEPAddress {
  logradouro: string;
  bairro: string;
  uf: string;
  erro?: boolean;
}

/**
 * Busca endereço a partir de um CEP usando a API ViaCEP.
 * Retorna null se o CEP for inválido, não encontrado ou em caso de falha de rede.
 */
export const fetchAddressByCEP = async (cep: string): Promise<CEPAddress | null> => {
  const numbers = stripNonDigits(cep);
  if (numbers.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${numbers}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
};
