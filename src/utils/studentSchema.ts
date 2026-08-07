import { z } from "zod";
import { isValidPhone } from "./formatters";

const PHONE_FORMAT_MESSAGE = "Telefone deve estar no formato (00) 0 0000-0000 ou (00) 0000-0000";

export const studentSchema = z.object({
  full_name: z.string().min(1, "Nome completo é obrigatório"),
  nickname: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  telephone: z.string().min(1, "Telefone é obrigatório").refine(isValidPhone, {
    message: PHONE_FORMAT_MESSAGE,
  }),
  birth_date: z.string().optional().or(z.literal("")),
  place_of_birth: z.string().optional(),
  uf: z.string().max(2, "UF deve ter 2 caracteres").optional().or(z.literal("")),
  gender: z.string().optional(),
  full_address: z.string().optional(),
  neighborhood: z.string().optional(),
  cep: z.string().optional(),
  instagram: z.string().optional(),
  shirt_size: z.string().optional(),
  pants_size: z.string().optional(),
  babylook_size: z.string().optional(),
  rg: z.string().optional(),
  cpf: z.string().optional(),
  health: z.object({
    has_special_needs: z.boolean().default(false),
    has_disease: z.boolean().default(false),
    medication_allergy: z.boolean().default(false),
    food_allergy: z.boolean().default(false),
    continuous_medication: z.boolean().default(false),
    psychological_disorder: z.boolean().default(false),
    medical_treatment: z.boolean().default(false),
    additional_info: z.string().optional(),
  }),
  emergency_contacts: z.array(
    z.object({
      contact_name: z.string().min(1, "Nome do contato é obrigatório"),
      relationship_degree: z.string().min(1, "Parentesco é obrigatório"),
      phone: z.string().min(1, "Telefone é obrigatório").refine(isValidPhone, {
        message: PHONE_FORMAT_MESSAGE,
      }),
      additional_info: z.string().optional(),
    })
  ).optional(),
});

export type StudentFormData = z.infer<typeof studentSchema>;
