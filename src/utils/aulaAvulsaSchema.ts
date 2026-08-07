import { z } from "zod";
import { isValidPhone } from "./formatters";

export const aulaAvulsaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  nascimento: z.string().optional().or(z.literal("")),
  telefone: z.string().optional().or(z.literal("")).refine((val) => !val || isValidPhone(val), {
    message: "Telefone deve estar no formato (00) 0 0000-0000 ou (00) 0000-0000",
  }),
  data: z.string().min(1, "Data é obrigatória"),
  valor: z.string().min(1, "Valor é obrigatório"),
});

// Mesmos campos, mas sem exigir valor (usado quando o campo Valor fica oculto no form).
export const aulaSemValorSchema = aulaAvulsaSchema.extend({
  valor: z.string(),
});

export type AulaAvulsaFormData = z.infer<typeof aulaAvulsaSchema>;

export interface AulaAvulsaPayload {
  nome: string;
  nascimento: string | null;
  telefone: string | null;
  data: string;
  valor: number;
}

export interface AulaAvulsaRecord extends AulaAvulsaPayload {
  id: string;
}
