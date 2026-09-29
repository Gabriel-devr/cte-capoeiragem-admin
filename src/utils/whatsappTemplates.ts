// Redação exata dos templates de cobrança aprovados na Meta Business Manager
// (WABA 1668957044185908, todos pt_BR, 2 variáveis: {{1}} = primeiro nome do
// aluno, {{2}} = valor). Fica num arquivo compartilhado (sem "use server")
// porque tanto a server action que envia a cobrança quanto a tela que exibe
// o preview pro admin precisam do mesmo texto - se algum template for
// reaprovado/editado na Meta, atualizar só aqui.
//
// category reflete a categoria cadastrada na Meta (UTILITY x MARKETING) -
// templates MARKETING entram no limite semanal de marketing por destinatário
// e o cliente pode optar por não recebê-los, diferente de UTILITY.

// Taxa única de matrícula (cobrada quando o admin marca "Cobrar taxa única de
// matrícula" na tela de Matrículas - ver taxa_matricula em enrollments). Fica
// aqui pra ser a mesma referência usada tanto no cadastro da matrícula quanto
// no cálculo do valor da primeira cobrança via WhatsApp.
export const TAXA_MATRICULA = 45;

export type CobrancaTemplateId =
  | "cobranca_mensalidade_aluno"
  | "desconto_ate_amanha"
  | "vence_hoje"
  | "mensalidade_em_aberto";

interface CobrancaTemplateDef {
  id: CobrancaTemplateId;
  label: string;
  description: string;
  category: "UTILITY" | "MARKETING";
  language: string;
  body: string;
}

export const COBRANCA_TEMPLATES: Record<CobrancaTemplateId, CobrancaTemplateDef> = {
  cobranca_mensalidade_aluno: {
    id: "cobranca_mensalidade_aluno",
    label: "Lembrete padrão",
    description: "Lembrete genérico de vencimento próximo, sem prazo específico.",
    category: "UTILITY",
    language: "pt_BR",
    body: `Olá, {{1}}! Tudo bem?

Passando para lembrar que a mensalidade do seu plano com desconto na Escola CTE Capoeiragem está próxima do vencimento.

💰 Valor: R$ {{2}}
💰 Chave Pix: 33.644.045/0001-58 - (CNPJ Flavia Nunes Veiga)

Após realizar o pagamento, por favor, envie o comprovante por aqui para darmos baixa no sistema.

Se tiver qualquer dúvida ou se o pagamento já foi realizado, pode desconsiderar esta mensagem. Estamos à disposição! Axé! 👊🏿 🙏🏿`,
  },
  desconto_ate_amanha: {
    id: "desconto_ate_amanha",
    label: "Véspera do vencimento",
    description: "Aviso de que o vencimento é amanhã.",
    category: "UTILITY",
    language: "pt_BR",
    body: `Olá, {{1}}! Tudo bem?

Passando para lembrar que a mensalidade do seu plano com desconto na Escola CTE Capoeiragem é até amanhã.

💰 Valor: R$ {{2}}
💰 Chave Pix: 33.644.045/0001-58 - (CNPJ Flavia Nunes Veiga)

Após realizar o pagamento, por favor, envie o comprovante por aqui para darmos baixa no sistema.

Se tiver qualquer dúvida ou se o pagamento já foi realizado, pode desconsiderar esta mensagem. Estamos à disposição! Axé! 👊🏿 🙏🏿`,
  },
  vence_hoje: {
    id: "vence_hoje",
    label: "Dia do vencimento",
    description: "Aviso de que a mensalidade vence hoje.",
    category: "UTILITY",
    language: "pt_BR",
    body: `Olá, {{1}}! Tudo bem?

Passando para lembrar que a mensalidade do seu plano com desconto na Escola CTE Capoeiragem *vence hoje*.

💰 Valor: R$ {{2}}
💰 Chave Pix: 33.644.045/0001-58 - (CNPJ Flavia Nunes Veiga)

Após realizar o pagamento, por favor, envie o comprovante por aqui para darmos baixa no sistema.

Se tiver qualquer dúvida ou se o pagamento já foi realizado, pode desconsiderar esta mensagem. Estamos à disposição! Axé! 👊🏿 🙏🏿`,
  },
  mensalidade_em_aberto: {
    id: "mensalidade_em_aberto",
    label: "Pós-vencimento",
    description: "Cobrança de mensalidade já em aberto.",
    category: "UTILITY",
    language: "pt_BR",
    body: `Olá, {{1}}! Tudo bem?

Passando para lembrar que a sua mensalidade na Escola CTE Capoeiragem *está em aberto*.

💰 Valor: R$ {{2}}
💰 Chave Pix: 33.644.045/0001-58 - (CNPJ Flavia Nunes Veiga)

Após realizar o pagamento, por favor, envie o comprovante por aqui para darmos baixa no sistema.

Se tiver qualquer dúvida ou se o pagamento já foi realizado, pode desconsiderar esta mensagem. Estamos à disposição! Axé! 👊🏿 🙏🏿`,
  },
};

export const COBRANCA_TEMPLATE_IDS = Object.keys(COBRANCA_TEMPLATES) as CobrancaTemplateId[];

export function isCobrancaTemplateId(value: string): value is CobrancaTemplateId {
  return value in COBRANCA_TEMPLATES;
}

export function renderTemplateCobranca(templateId: CobrancaTemplateId, primeiroNome: string, valor: number) {
  return COBRANCA_TEMPLATES[templateId].body.replace("{{1}}", primeiroNome).replace("{{2}}", valor.toFixed(2));
}
