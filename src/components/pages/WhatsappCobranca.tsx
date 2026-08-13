"use client";

import { useEffect, useState } from "react";
import { Send, Loader2, Users, History } from "lucide-react";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

import {
  listCobrancas,
  enviarCobrancas,
  listHistoricoAluno,
  type CobrancaItem,
  type HistoricoMensagem,
} from "@/actions/whatsapp_data";
import { formatPhone, toBRDate } from "@/utils/formatters";
import { COBRANCA_TEMPLATES, COBRANCA_TEMPLATE_IDS, TAXA_MATRICULA, type CobrancaTemplateId } from "@/utils/whatsappTemplates";

const statusConfig: Record<HistoricoMensagem["status"], { label: string; className: string }> = {
  pending:   { label: "Pendente",  className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  sent:      { label: "Enviada",   className: "bg-green-100 text-green-700 border-green-200" },
  failed:    { label: "Falhou",    className: "bg-red-100 text-red-700 border-red-200" },
  cancelled: { label: "Cancelada", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

function formatValor(valor: number) {
  return `R$ ${valor.toFixed(2)}`;
}

type TipoValor = "desconto" | "original" | "familia" | "bolsa_integral" | "bolsa_parcial";

// Categoria do aluno conforme o plano dele - bolsa integral (gratuidade) e
// bolsa parcial têm modos dedicados no toggle abaixo, separados dos modos de
// preço "normais" (desconto/integral/família), que valem só pra quem não é
// bolsista.
function categoriaItem(item: CobrancaItem): "bolsa_integral" | "bolsa_parcial" | "regular" {
  if (item.bolsa_integral) return "bolsa_integral";
  if (item.bolsa_parcial) return "bolsa_parcial";
  return "regular";
}

// Define se o aluno pertence à aba selecionada no toggle - é o que filtra
// quem aparece na tabela (bolsista só aparece na aba de bolsa dele, nunca
// nas abas de preço "normais", e vice-versa).
function pertenceAoModo(item: CobrancaItem, tipoValor: TipoValor): boolean {
  const categoria = categoriaItem(item);
  if (tipoValor === "bolsa_integral") return categoria === "bolsa_integral";
  if (tipoValor === "bolsa_parcial") return categoria === "bolsa_parcial";
  if (categoria !== "regular") return false;
  if (tipoValor === "desconto") return item.valor_desconto != null;
  if (tipoValor === "familia") return item.valor_familia != null;
  return true;
}

function valorDisponivel(item: CobrancaItem, tipoValor: TipoValor): boolean {
  // Bolsa integral é gratuidade - nunca há valor a cobrar, então o checkbox
  // fica sempre bloqueado, mesmo no modo "Bolsa Integral" (que só serve pra
  // deixar esses alunos visíveis/identificáveis na lista, não pra enviar).
  if (item.bolsa_integral) return false;
  return pertenceAoModo(item, tipoValor);
}

// Valor "de tabela" do plano no modo selecionado, sem a taxa de matrícula -
// usado só pra saber qual dos preços cadastrados bate com o que vai ser
// cobrado (destaque na coluna Valor). O valor de fato cobrado é valorCobrado.
function valorBase(item: CobrancaItem, tipoValor: TipoValor) {
  if (tipoValor === "desconto") return item.valor_desconto ?? item.valor_original;
  if (tipoValor === "familia") return item.valor_familia ?? item.valor_original;
  // "original" e "bolsa_parcial" cobram o valor_original - pra bolsa parcial
  // é o próprio valor já reduzido pela bolsa, cadastrado no plano.
  return item.valor_original;
}

// Valor final que entra no {{2}} do template - soma a taxa única de
// matrícula (R$45) quando essa for a primeira cobrança do aluno (ver
// taxa_matricula_pendente, calculado no servidor).
function valorCobrado(item: CobrancaItem, tipoValor: TipoValor) {
  const base = valorBase(item, tipoValor);
  return item.taxa_matricula_pendente ? base + TAXA_MATRICULA : base;
}

const MENSAGEM_ABA_VAZIA: Record<TipoValor, string> = {
  desconto: "Nenhum aluno com preço de desconto cadastrado.",
  original: "Nenhum aluno com matrícula ativa.",
  familia: "Nenhum aluno com preço família cadastrado.",
  bolsa_parcial: "Nenhum aluno com bolsa parcial no momento.",
  bolsa_integral: "Nenhum aluno com bolsa integral (gratuidade) no momento.",
};

export function WhatsappCobranca() {
  const [cobrancas, setCobrancas] = useState<CobrancaItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const [tipoValor, setTipoValor] = useState<TipoValor>("desconto");
  const [templateId, setTemplateId] = useState<CobrancaTemplateId>("cobranca_mensalidade_aluno");
  const [isSending, setIsSending] = useState(false);

  const [historicoAluno, setHistoricoAluno] = useState<CobrancaItem | null>(null);
  const [historico, setHistorico] = useState<HistoricoMensagem[]>([]);
  const [isLoadingHistorico, setIsLoadingHistorico] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    const cobrancasRes = await listCobrancas();

    if (cobrancasRes.result === "sucesso" && cobrancasRes.cobrancas) {
      setCobrancas(cobrancasRes.cobrancas);
    } else {
      toast.error("Erro ao carregar alunos: " + cobrancasRes.details);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cada aba mostra só os alunos que pertencem a ela (bolsista só aparece na
  // aba de bolsa dele) - "selecionaveis" é o subconjunto de "visiveis" que
  // pode de fato ser marcado/enviado (bolsa integral aparece na aba dele mas
  // nunca é selecionável, porque é gratuidade).
  const visiveis = cobrancas.filter((c) => pertenceAoModo(c, tipoValor));
  const selecionaveis = cobrancas.filter((c) => valorDisponivel(c, tipoValor));

  const handleSetTipoValor = (novoTipo: TipoValor) => {
    setTipoValor(novoTipo);
    // Remove da seleção alunos cujo plano não tem esse tipo de valor cadastrado.
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of cobrancas) {
        if (next.has(c.student_id) && !valorDisponivel(c, novoTipo)) next.delete(c.student_id);
      }
      return next;
    });
  };

  const toggleSelected = (item: CobrancaItem) => {
    if (!valorDisponivel(item, tipoValor)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.student_id)) next.delete(item.student_id);
      else next.add(item.student_id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === selecionaveis.length && selecionaveis.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selecionaveis.map((c) => c.student_id)));
    }
  };

  const handleVerHistorico = async (item: CobrancaItem) => {
    setHistoricoAluno(item);
    setIsLoadingHistorico(true);
    setHistorico([]);
    const res = await listHistoricoAluno(item.student_id);
    if (res.result === "sucesso" && res.historico) {
      setHistorico(res.historico);
    } else {
      toast.error("Erro ao carregar histórico: " + res.details);
    }
    setIsLoadingHistorico(false);
  };

  const podeEnviar = selected.size > 0;

  const handleEnviar = async () => {
    const selecionados = cobrancas.filter((c) => selected.has(c.student_id));

    if (selecionados.length === 0) {
      toast.error("Selecione ao menos um aluno.");
      return;
    }

    const semTelefone = selecionados.filter((c) => !c.telephone);
    if (semTelefone.length > 0) {
      toast.error(`${semTelefone.length} aluno(s) selecionado(s) sem telefone cadastrado.`);
      return;
    }

    setIsSending(true);
    const payload = selecionados.map((item) => ({
      student_id: item.student_id,
      full_name: item.full_name,
      telephone: item.telephone as string,
      valor: valorCobrado(item, tipoValor),
    }));

    const res = await enviarCobrancas(payload, templateId);

    if (res.result === "sucesso") {
      const ignoradosMsg = res.ignorados ? ` (${res.ignorados} já tinham cobrança de hoje pendente e foram ignorados)` : "";
      toast.success(`Cobrança enviada para ${res.enviados} aluno(s)!${ignoradosMsg}`);
      setSelected(new Set());
    } else {
      toast.error("Erro ao enviar cobranças: " + res.details);
    }
    setIsSending(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Enviar cobrança */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-lg space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Send className="w-5 h-5 text-accent" /> Enviar cobrança
          </h3>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Template (aprovado na Meta)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COBRANCA_TEMPLATE_IDS.map((id) => {
              const tpl = COBRANCA_TEMPLATES[id];
              const isSelected = templateId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTemplateId(id)}
                  className={`text-left rounded-lg border p-3 space-y-1 transition-colors cursor-pointer ${
                    isSelected
                      ? "border-accent bg-accent/10 ring-1 ring-accent"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{tpl.label}</span>
                    <Badge
                      variant="outline"
                      className={
                        tpl.category === "UTILITY"
                          ? "bg-blue-100 text-blue-700 border-blue-200"
                          : "bg-orange-100 text-orange-700 border-orange-200"
                      }
                    >
                      {tpl.category === "UTILITY" ? "Utilitário" : "Marketing"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{tpl.description}</p>
                </button>
              );
            })}
          </div>

          <div className="bg-muted border border-border rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap">
            {COBRANCA_TEMPLATES[templateId].body}
          </div>
          <p className="text-xs text-muted-foreground">
            Esse texto é fixo — é o template aprovado no WhatsApp Business, não dá pra editar por aqui.{" "}
            <code className="bg-background px-1 rounded mx-1">{"{{1}}"}</code> vira o primeiro nome do aluno e{" "}
            <code className="bg-background px-1 rounded mx-1">{"{{2}}"}</code> vira o valor escolhido abaixo.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Valor a cobrar</label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={tipoValor === "desconto" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSetTipoValor("desconto")}
              className={tipoValor === "desconto" ? "bg-accent hover:bg-accent/90 text-accent-foreground cursor-pointer" : "cursor-pointer"}
            >
              Com desconto
            </Button>
            <Button
              type="button"
              variant={tipoValor === "original" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSetTipoValor("original")}
              className={tipoValor === "original" ? "bg-accent hover:bg-accent/90 text-accent-foreground cursor-pointer" : "cursor-pointer"}
            >
              Valor integral
            </Button>
            <Button
              type="button"
              variant={tipoValor === "familia" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSetTipoValor("familia")}
              className={tipoValor === "familia" ? "bg-accent hover:bg-accent/90 text-accent-foreground cursor-pointer" : "cursor-pointer"}
            >
              Preço família
            </Button>
            <Button
              type="button"
              variant={tipoValor === "bolsa_parcial" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSetTipoValor("bolsa_parcial")}
              className={tipoValor === "bolsa_parcial" ? "bg-accent hover:bg-accent/90 text-accent-foreground cursor-pointer" : "cursor-pointer"}
            >
              Bolsa Parcial
            </Button>
            <Button
              type="button"
              variant={tipoValor === "bolsa_integral" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSetTipoValor("bolsa_integral")}
              className={tipoValor === "bolsa_integral" ? "bg-accent hover:bg-accent/90 text-accent-foreground cursor-pointer" : "cursor-pointer"}
            >
              Bolsa Integral
            </Button>
          </div>
          {tipoValor === "bolsa_integral" ? (
            <p className="text-xs text-muted-foreground">
              Alunos com bolsa integral (gratuidade) não pagam mensalidade — eles aparecem aqui só pra identificação, não é possível selecioná-los nem enviar cobrança.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Define qual valor entra no lugar de <code className="bg-muted px-1 rounded">{"{{2}}"}</code> — vale pra todos os alunos selecionados neste envio.
            </p>
          )}
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" /> Selecione os alunos <span className="text-destructive">*</span>
          </h4>

          {cobrancas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum aluno com matrícula ativa.</p>
          ) : visiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{MENSAGEM_ABA_VAZIA[tipoValor]}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === selecionaveis.length && selecionaveis.length > 0}
                      onCheckedChange={toggleSelectAll}
                      disabled={selecionaveis.length === 0}
                      className="cursor-pointer"
                    />
                  </TableHead>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Apelido</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((item) => {
                  const disponivel = valorDisponivel(item, tipoValor);
                  const base = disponivel ? valorBase(item, tipoValor) : null;
                  const cobrado = disponivel ? valorCobrado(item, tipoValor) : null;
                  return (
                  <TableRow key={item.student_id} className={!disponivel ? "opacity-60" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(item.student_id)}
                        onCheckedChange={() => toggleSelected(item)}
                        disabled={!disponivel}
                        title={!disponivel ? "Bolsa integral (gratuidade) — não é possível enviar cobrança" : undefined}
                        className="cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.nickname || "—"}</TableCell>
                    <TableCell>{item.plano_nome}</TableCell>
                    <TableCell>
                      {item.bolsa_integral ? (
                        <span className="text-xs text-muted-foreground">Gratuidade — sem cobrança</span>
                      ) : !disponivel ? (
                        <span className="text-xs text-destructive">Sem valor cadastrado</span>
                      ) : (
                      <div className="flex flex-col leading-tight gap-0.5">
                        {(
                          [
                            { key: "desconto", value: item.valor_desconto },
                            { key: "original", value: item.valor_original },
                            { key: "familia", value: item.valor_familia },
                          ] as { key: TipoValor; value: number | null }[]
                        )
                          .filter((v) => v.value != null)
                          .map(({ key, value }) => (
                            <span
                              key={key}
                              className={value === base ? "font-semibold text-accent" : "text-xs text-muted-foreground line-through"}
                            >
                              {formatValor(value as number)}
                            </span>
                          ))}
                        {item.taxa_matricula_pendente && cobrado != null && (
                          <span className="text-[11px] font-medium text-accent">
                            + taxa matrícula R$ {TAXA_MATRICULA.toFixed(2)} = {formatValor(cobrado)}
                          </span>
                        )}
                      </div>
                      )}
                    </TableCell>
                    <TableCell className={!item.telephone ? "text-destructive" : ""}>
                      {item.telephone ? formatPhone(item.telephone) : "Sem telefone"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Ver histórico de mensagens"
                        onClick={() => handleVerHistorico(item)}
                        className="text-muted-foreground cursor-pointer"
                      >
                        <History className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleEnviar}
            disabled={isSending || !podeEnviar}
            className="bg-accent hover:bg-accent/90 text-white cursor-pointer"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Enviar cobranças ({selected.size})</>}
          </Button>
        </div>
      </div>

      {/* Modal: histórico de mensagens do aluno */}
      <Dialog open={!!historicoAluno} onOpenChange={(open) => !open && setHistoricoAluno(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Histórico de mensagens — {historicoAluno?.nickname || historicoAluno?.full_name}
            </DialogTitle>
          </DialogHeader>

          {isLoadingHistorico ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            </div>
          ) : historico.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma cobrança enviada para este aluno ainda.</p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {historico.map((h) => (
                <div key={h.id} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{toBRDate(h.scheduled_date)}</span>
                    <Badge variant="outline" className={statusConfig[h.status].className}>
                      {statusConfig[h.status].label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{h.mensagem}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
