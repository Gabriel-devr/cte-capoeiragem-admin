"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ClipboardList, Plus, Edit, XCircle, Save, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";

import { matriculaSchema, type MatriculaFormData } from "@/utils/matriculaSchema";
import { createMatricula, listMatriculas, updateMatricula, cancelarMatricula } from "@/actions/matricula_data";
import { listStudent } from "@/actions/student_data";
import { listPlanos } from "@/actions/plano_data";
import { formatDateInput, toBRDate, toISODate } from "@/utils/formatters";

interface Matricula {
  id: string;
  student_id: string;
  plano_id: string;
  start_date: string;
  end_date: string | null;
  status: "active" | "paused" | "cancelled" | null;
  observacoes: string | null;
  taxa_matricula: boolean | null;
  student: { student_id: string; full_name: string; nickname: string | null } | null;
  plano: {
    id_plano: string;
    nome_plano: string;
    preco_original: number;
    preco_desconto: number | null;
    periodos: { nome_periodo: string } | null;
  } | null;
}

interface Student {
  student_id: string;
  full_name: string;
  nickname: string | null;
}

interface Plano {
  id_plano: string;
  nome_plano: string;
  preco_original: number;
  preco_desconto: number | null;
}

const statusConfig = {
  active:    { label: "Ativo",     className: "bg-green-100 text-green-700 border-green-200" },
  paused:    { label: "Pausado",   className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  cancelled: { label: "Cancelado", className: "bg-red-100 text-red-700 border-red-200" },
};

function formatDate(date: string | null) {
  if (!date) return "—";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function formatPrice(plano: Matricula["plano"]) {
  if (!plano) return "—";
  return `R$ ${Number(plano.preco_desconto ?? plano.preco_original).toFixed(2)}`;
}

export function Matriculas() {
  const [matriculas, setMatriculas]   = useState<Matricula[]>([]);
  const [students, setStudents]       = useState<Student[]>([]);
  const [planos, setPlanos]           = useState<Plano[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const form = useForm<MatriculaFormData>({
    resolver: zodResolver(matriculaSchema),
    defaultValues: {
      student_id:  "",
      plano_id:    "",
      start_date:  new Date().toISOString().split("T")[0],
      end_date:    "",
      status:      "active",
      observacoes: "",
      taxa_matricula: true,
    },
  });

  const fetchData = async () => {
    setIsLoading(true);
    const [matriculasRes, studentsRes, planosRes] = await Promise.all([
      listMatriculas(),
      listStudent(),
      listPlanos(),
    ]);
    if (matriculasRes.result === "sucesso") setMatriculas((matriculasRes.matriculas as Matricula[]) || []);
    if (studentsRes.result === "sucesso")   setStudents((studentsRes.students as Student[]) || []);
    if (planosRes.result === "sucesso")     setPlanos((planosRes.planos as Plano[]) || []);
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openModal = (matricula?: Matricula) => {
    if (matricula) {
      setEditingId(matricula.id);
      form.reset({
        student_id:  matricula.student_id,
        plano_id:    matricula.plano_id,
        start_date:  toBRDate(matricula.start_date),
        end_date:    toBRDate(matricula.end_date) || "",
        status:      matricula.status ?? "active",
        observacoes: matricula.observacoes || "",
        taxa_matricula: matricula.taxa_matricula ?? true,
      });
    } else {
      setEditingId(null);
      form.reset({
        student_id:  "",
        plano_id:    "",
        start_date:  toBRDate(new Date().toISOString().split("T")[0]),
        end_date:    "",
        status:      "active",
        observacoes: "",
        taxa_matricula: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleFormattedChange = (fieldToUpdate: any, formatter: (val: string) => string) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatter(e.target.value);
      form.setValue(fieldToUpdate, formatted);
    };
  };

  const onSubmit = async (data: MatriculaFormData) => {
    const payload = {
      ...data,
      start_date: toISODate(data.start_date),
      end_date: data.end_date ? toISODate(data.end_date) : undefined,
    };
    const res = editingId
      ? await updateMatricula(editingId, payload)
      : await createMatricula(payload);

    if (res.result === "sucesso") {
      toast.success(editingId ? "Matrícula atualizada!" : "Matrícula criada com sucesso!");
      setIsModalOpen(false);
      fetchData();
    } else {
      toast.error("Erro: " + res.details);
    }
  };

  const handleCancelar = async (id: string) => {
    if (!confirm("Cancelar esta matrícula? O histórico será mantido.")) return;
    setCancellingId(id);
    const res = await cancelarMatricula(id);
    setCancellingId(null);
    if (res.result === "sucesso") {
      toast.success("Matrícula cancelada.");
      fetchData();
    } else {
      toast.error("Erro: " + res.details);
    }
  };

  const availableStudents = students.filter(s => {
    if (s.profile?.role === 'admin') return false;
    const isActive = matriculas.some(m => m.student_id === s.student_id && (m.status === 'active' || !m.status));
    const isEditingThisStudent = editingId && matriculas.find(m => m.id === editingId)?.student_id === s.student_id;
    return !isActive || isEditingThisStudent;
  });

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-start"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Matrículas</h1>
          <p className="inline-block text-foreground bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm">Gerencie as matrículas dos alunos da Escola CTE Capoeiragem</p>
        </div>
        <Button onClick={() => openModal()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Plus className="w-5 h-5 mr-2" />
          Nova matrícula
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 text-accent animate-spin" />
        </div>
      ) : matriculas.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <ClipboardList className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma matrícula cadastrada</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold">Aluno</TableHead>
                <TableHead className="font-semibold">Plano</TableHead>
                <TableHead className="font-semibold">Valor</TableHead>
                <TableHead className="font-semibold">Início</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matriculas.map((m) => {
                const status = m.status ?? "active";
                const config = statusConfig[status] ?? statusConfig.active;
                return (
                  <TableRow key={m.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{m.student?.full_name ?? "—"}</p>
                        {m.student?.nickname && (
                          <p className="text-xs text-muted-foreground">{m.student.nickname}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{m.plano?.nome_plano ?? "—"}</p>
                        {m.plano?.periodos?.nome_periodo && (
                          <p className="text-xs text-muted-foreground">{m.plano.periodos.nome_periodo}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-accent">{formatPrice(m.plano)}</TableCell>
                    <TableCell className="text-sm">{formatDate(m.start_date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs font-medium ${config.className}`}>
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openModal(m)} className="text-accent h-8 w-8 p-0" title="Editar">
                          <Edit className="w-4 h-4" />
                        </Button>
                        {status !== "cancelled" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelar(m.id)}
                            disabled={cancellingId === m.id}
                            className="text-destructive h-8 w-8 p-0"
                            title="Cancelar matrícula"
                          >
                            {cancellingId === m.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <XCircle className="w-4 h-4" />
                            }
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </motion.div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-accent" />
              {editingId ? "Editar matrícula" : "Nova matrícula"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="student_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">Aluno *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!!editingId}>
                        <FormControl>
                          <SelectTrigger className="bg-input-background border-accent/20 focus:border-accent">
                            <SelectValue placeholder="Selecione o aluno" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableStudents.map((s) => (
                            <SelectItem key={s.student_id} value={s.student_id}>
                              {s.full_name}{s.nickname ? ` (${s.nickname})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="plano_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">Plano *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-input-background border-accent/20 focus:border-accent">
                            <SelectValue placeholder="Selecione o plano" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {planos.map((p) => (
                            <SelectItem key={p.id_plano} value={p.id_plano}>
                              {p.nome_plano} — R$ {Number(p.preco_desconto ?? p.preco_original).toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="taxa_matricula"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between bg-accent/10 border border-accent/20 rounded-lg px-4 py-3 gap-3">
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-medium text-foreground !mt-0">Cobrar taxa única de matrícula</FormLabel>
                    </div>
                    <span className="font-semibold text-accent">R$ 45,00</span>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="start_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de início *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value || ""} 
                        placeholder="DD/MM/AAAA"
                        className="bg-input-background" 
                        onChange={handleFormattedChange("start_date", formatDateInput)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="end_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de fim (opcional)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value || ""} 
                        placeholder="DD/MM/AAAA"
                        className="bg-input-background" 
                        onChange={handleFormattedChange("end_date", formatDateInput)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-input-background border-accent/20 focus:border-accent">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="paused">Pausado</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Informações adicionais sobre a matrícula..."
                        className="bg-input-background border-accent/20 focus:border-accent resize-none"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                    <><Save className="w-4 h-4 mr-2" />{editingId ? "Salvar" : "Matricular"}</>
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
