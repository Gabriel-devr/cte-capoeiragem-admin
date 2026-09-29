"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Plus, Edit, Trash2, Save, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";

import { aulaAvulsaSchema, aulaSemValorSchema, type AulaAvulsaFormData, type AulaAvulsaPayload, type AulaAvulsaRecord } from "@/utils/aulaAvulsaSchema";
import {
  formatDateInput,
  formatPhone,
  toBRDate,
  toISODate,
  formatCurrencyInput,
  parseCurrencyToNumber,
  numberToCurrencyInput,
} from "@/utils/formatters";

type ActionResult = { result: string; details?: string };

interface AulaAvulsaSectionProps {
  title: string;
  newLabel: string;
  editLabel: string;
  emptyLabel: string;
  successCreateLabel: string;
  successUpdateLabel: string;
  confirmDeleteLabel: string;
  successDeleteLabel: string;
  showValor?: boolean;
  actions: {
    create: (payload: AulaAvulsaPayload) => Promise<ActionResult>;
    list: () => Promise<ActionResult & { data?: AulaAvulsaRecord[] }>;
    update: (id: string, payload: AulaAvulsaPayload) => Promise<ActionResult>;
    delete: (id: string) => Promise<ActionResult>;
  };
}

const defaultValues: AulaAvulsaFormData = {
  nome: "",
  nascimento: "",
  telefone: "",
  data: "",
  valor: "",
};

export function AulaAvulsaSection({
  title,
  newLabel,
  editLabel,
  emptyLabel,
  successCreateLabel,
  successUpdateLabel,
  confirmDeleteLabel,
  successDeleteLabel,
  showValor = true,
  actions,
}: AulaAvulsaSectionProps) {
  const [aulas, setAulas] = useState<AulaAvulsaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<AulaAvulsaFormData>({
    resolver: zodResolver(showValor ? aulaAvulsaSchema : aulaSemValorSchema),
    defaultValues,
  });

  const fetchData = async () => {
    setIsLoading(true);
    const res = await actions.list();
    if (res.result === "sucesso") setAulas(res.data || []);
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleFormattedChange = (fieldName: "nascimento" | "telefone" | "data" | "valor", formatter: (val: string) => string) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      form.setValue(fieldName, formatter(e.target.value));
    };
  };

  const openModal = (aula?: AulaAvulsaRecord) => {
    if (aula) {
      setEditingId(aula.id);
      form.reset({
        nome: aula.nome,
        nascimento: aula.nascimento ? toBRDate(aula.nascimento) : "",
        telefone: aula.telefone || "",
        data: toBRDate(aula.data),
        valor: showValor ? numberToCurrencyInput(aula.valor) : "",
      });
    } else {
      setEditingId(null);
      form.reset(defaultValues);
    }
    setIsModalOpen(true);
  };

  const onSubmit = async (data: AulaAvulsaFormData) => {
    const payload: AulaAvulsaPayload = {
      nome: data.nome,
      nascimento: data.nascimento ? toISODate(data.nascimento) : null,
      telefone: data.telefone || null,
      data: toISODate(data.data),
      valor: showValor ? parseCurrencyToNumber(data.valor) ?? 0 : 0,
    };

    const res = editingId
      ? await actions.update(editingId, payload)
      : await actions.create(payload);

    if (res.result === "sucesso") {
      toast.success(editingId ? successUpdateLabel : successCreateLabel);
      setIsModalOpen(false);
      fetchData();
    } else {
      toast.error("Erro: " + res.details);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(confirmDeleteLabel)) return;
    const res = await actions.delete(id);
    if (res.result === "sucesso") {
      toast.success(successDeleteLabel);
      fetchData();
    } else {
      toast.error("Erro ao excluir: " + res.details);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <CalendarPlus className="w-5 h-5 text-accent" /> {title}
        </h2>
        <Button onClick={() => openModal()} className="bg-accent hover:bg-accent/90 text-white">
          <Plus className="w-4 h-4 mr-2" /> {newLabel}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : aulas.length === 0 ? (
        <div className="text-center py-10 bg-card border border-border rounded-xl">
          <p className="text-muted-foreground">{emptyLabel}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold">Nome</TableHead>
                <TableHead className="font-semibold">Nascimento</TableHead>
                <TableHead className="font-semibold">Telefone</TableHead>
                <TableHead className="font-semibold">Data da aula</TableHead>
                {showValor && <TableHead className="font-semibold">Valor</TableHead>}
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aulas.map((aula) => (
                <TableRow key={aula.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-medium">{aula.nome}</TableCell>
                  <TableCell>{aula.nascimento ? toBRDate(aula.nascimento) : "-"}</TableCell>
                  <TableCell>{aula.telefone || "-"}</TableCell>
                  <TableCell>{toBRDate(aula.data)}</TableCell>
                  {showValor && (
                    <TableCell className="font-semibold text-accent">
                      R$ {Number(aula.valor).toFixed(2)}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openModal(aula)} className="text-accent h-8 w-8 p-0">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(aula.id)} className="text-destructive h-8 w-8 p-0">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-accent" />
              {editingId ? editLabel : newLabel}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Nome *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Nome do aluno"
                        className="bg-input-background border-accent/20 focus:border-accent"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nascimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Data de nascimento</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="DD/MM/AAAA"
                        className="bg-input-background border-accent/20 focus:border-accent"
                        onChange={handleFormattedChange("nascimento", formatDateInput)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Telefone</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="(00) 0 0000-0000"
                        className="bg-input-background border-accent/20 focus:border-accent"
                        onChange={handleFormattedChange("telefone", formatPhone)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Data da aula *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="DD/MM/AAAA"
                        className="bg-input-background border-accent/20 focus:border-accent"
                        onChange={handleFormattedChange("data", formatDateInput)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {showValor && (
                <FormField
                  control={form.control}
                  name="valor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">Valor *</FormLabel>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground font-medium">R$</span>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            className="bg-input-background border-accent/20 focus:border-accent"
                            onChange={handleFormattedChange("valor", formatCurrencyInput)}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="bg-accent hover:bg-accent/90 text-white min-w-[100px]"
                >
                  {form.formState.isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Save className="w-4 h-4 mr-2" />{editingId ? "Salvar" : "Adicionar"}</>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
