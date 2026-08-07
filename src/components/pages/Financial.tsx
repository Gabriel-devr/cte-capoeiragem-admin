"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  DollarSign, Plus, Trash2, CheckCircle, Clock,
  Loader2, BadgeCheck, Pencil, X, Check, Receipt, MessageSquare
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

import {
  listTransactions,
  createTransaction,
  marcarComoPago,
  deleteTransaction,
  updateTransaction,
} from "@/actions/financial_data";
import { listStudent } from "@/actions/student_data";
import { formatDateInput, toBRDate, toISODate } from "@/utils/formatters";
import { WhatsappCobranca } from "./WhatsappCobranca";

interface Transaction {
  id: string;
  title: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  student: { full_name: string; nickname: string | null } | null;
}

interface Student {
  student_id: string;
  full_name: string;
  nickname: string | null;
  enrollments?: { status: string }[];
}

type FilterStatus = "all" | "pending" | "paid";

function formatDate(date: string | null) {
  if (!date) return "—";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export function Financial() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");

  // Formulário de nova cobrança
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedDate, setSelectedDate] = useState(toBRDate(new Date().toISOString().split("T")[0]));
  const [selectedStatus, setSelectedStatus] = useState<"pending" | "paid">("pending");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    const [txRes, studentsRes] = await Promise.all([
      listTransactions(),
      listStudent(),
    ]);
    if (txRes.result === "sucesso") setTransactions((txRes.data as Transaction[]) || []);
    if (studentsRes.result === "sucesso") setStudents((studentsRes.students as Student[]) || []);
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Alunos com matrícula ativa — usados no dropdown de nova cobrança
  const enrolledStudents = students.filter(
    (s) => s.enrollments?.some((e) => e.status === "active")
  );

  const filtered = transactions.filter((t) =>
    filter === "all" ? true : t.status === filter
  );

  const pendingCount = transactions.filter((t) => t.status === "pending").length;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRegistrar = async () => {
    if (!selectedStudent) {
      toast.error("Selecione um aluno.");
      return;
    }
    setIsSubmitting(true);
    const res = await createTransaction(selectedStudent, toISODate(selectedDate), selectedStatus);
    setIsSubmitting(false);
    if (res.result === "sucesso") {
      toast.success("Cobrança registrada!");
      setSelectedStudent("");
      fetchData();
    } else {
      toast.error("Erro: " + res.details);
    }
  };

  const handleMarcarPago = async (id: string) => {
    setMarkingId(id);
    const res = await marcarComoPago(id);
    setMarkingId(null);
    if (res.result === "sucesso") {
      toast.success("Pagamento confirmado!");
      fetchData();
    } else {
      toast.error("Erro: " + res.details);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta cobrança?")) return;
    setDeletingId(id);
    const res = await deleteTransaction(id);
    setDeletingId(null);
    if (res.result === "sucesso") {
      toast.success("Cobrança excluída.");
      fetchData();
    } else {
      toast.error("Erro: " + res.details);
    }
  };

  const handleStartEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditAmount(String(tx.amount));
    setEditDate(toBRDate(tx.due_date));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditAmount("");
    setEditDate("");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const amount = parseFloat(editAmount.replace(",", "."));
    if (isNaN(amount) || amount < 0) {
      toast.error("Valor inválido.");
      return;
    }
    setIsSavingEdit(true);
    const res = await updateTransaction(editingId, amount, toISODate(editDate));
    setIsSavingEdit(false);
    if (res.result === "sucesso") {
      toast.success("Cobrança atualizada!");
      setEditingId(null);
      fetchData();
    } else {
      toast.error("Erro: " + res.details);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground mb-2">Financeiro</h1>
        <p className="inline-block text-foreground bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm">
          Registre e acompanhe os pagamentos dos alunos matriculados
        </p>
      </motion.div>

      <Tabs defaultValue="transacoes">
        <TabsList>
          <TabsTrigger value="transacoes" className="gap-2 cursor-pointer">
            <Receipt className="w-4 h-4" /> Transações
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2 cursor-pointer">
            <MessageSquare className="w-4 h-4" /> Cobranças via WhatsApp
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transacoes" className="space-y-8">

      {/* ── Formulário de nova cobrança ─────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card border border-border rounded-xl p-5 shadow-sm"
      >
        <p className="text-sm font-semibold text-foreground mb-4">Nova Cobrança</p>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          {/* Aluno matriculado */}
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Aluno Matriculado <span className="text-destructive">*</span>
            </label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger className="bg-input-background border-accent/20 focus:border-accent">
                <SelectValue placeholder="Selecione o aluno" />
              </SelectTrigger>
              <SelectContent>
                {enrolledStudents.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    Nenhum aluno com matrícula ativa
                  </SelectItem>
                ) : (
                  enrolledStudents.map((s) => (
                    <SelectItem key={s.student_id} value={s.student_id}>
                      {s.full_name}{s.nickname ? ` (${s.nickname})` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Data */}
          <div className="w-full sm:w-44">
            <label className="text-xs text-muted-foreground mb-1.5 block">Data de Vencimento</label>
            <input
              type="text"
              placeholder="DD/MM/AAAA"
              value={selectedDate}
              onChange={(e) => setSelectedDate(formatDateInput(e.target.value))}
              className="w-full h-10 px-3 rounded-md border border-accent/20 bg-input-background text-sm focus:outline-none focus:border-accent"
            />
          </div>

          {/* Status */}
          <div className="w-full sm:w-36">
            <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
            <Select
              value={selectedStatus}
              onValueChange={(v) => setSelectedStatus(v as "pending" | "paid")}
            >
              <SelectTrigger className="bg-input-background border-accent/20 focus:border-accent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleRegistrar}
            disabled={isSubmitting}
            className="bg-accent hover:bg-accent/90 text-white w-full sm:w-auto shrink-0 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <><Plus className="w-4 h-4 mr-2" />Registrar</>
            )}
          </Button>
        </div>
      </motion.div>

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "pending", "paid"] as FilterStatus[]).map((f) => {
          const labels = { all: "Todos", pending: "Pendentes", paid: "Pagos" };
          const isActive = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all cursor-pointer ${
                isActive
                  ? "bg-accent text-white border-accent"
                  : "bg-card text-muted-foreground border-border hover:border-accent/40"
              }`}
            >
              {labels[f]}
              {f === "pending" && pendingCount > 0 && (
                <span
                  className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-white/20" : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tabela ──────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 text-accent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <DollarSign className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <p className="font-medium text-foreground mb-1">Nenhuma cobrança encontrada</p>
          <p className="text-sm text-muted-foreground">
            Registre uma nova cobrança usando o formulário acima.
          </p>
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
                <TableHead className="font-semibold">Descrição</TableHead>
                <TableHead className="font-semibold">Valor</TableHead>
                <TableHead className="font-semibold">Vencimento</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tx) => (
                <TableRow key={tx.id} className="hover:bg-muted/20 transition-colors">

                  {/* Coluna Aluno */}
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">
                        {tx.student?.full_name ?? "—"}
                      </p>
                      {tx.student?.nickname && (
                        <p className="text-xs text-muted-foreground">{tx.student.nickname}</p>
                      )}
                    </div>
                  </TableCell>

                  {/* Descrição */}
                  <TableCell className="text-sm text-foreground">{tx.title}</TableCell>

                  {/* Valor — editável inline */}
                  <TableCell>
                    {editingId === tx.id ? (
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-24 h-8 px-2 rounded-md border border-accent/40 bg-input-background text-sm focus:outline-none focus:border-accent"
                        step="0.01"
                        min="0"
                      />
                    ) : (
                      <span className="font-semibold text-accent">
                        R$ {Number(tx.amount).toFixed(2)}
                      </span>
                    )}
                  </TableCell>

                  {/* Data de vencimento — editável inline */}
                  <TableCell className="text-sm">
                    {editingId === tx.id ? (
                      <input
                        type="text"
                        placeholder="DD/MM/AAAA"
                        value={editDate}
                        onChange={(e) => setEditDate(formatDateInput(e.target.value))}
                        className="h-8 px-2 w-28 rounded-md border border-accent/40 bg-input-background text-sm focus:outline-none focus:border-accent"
                      />
                    ) : (
                      formatDate(tx.due_date)
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    {tx.status === "paid" ? (
                      <Badge
                        variant="outline"
                        className="bg-green-100 text-green-700 border-green-200 text-xs font-medium"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />Pago
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs font-medium"
                      >
                        <Clock className="w-3 h-3 mr-1" />Pendente
                      </Badge>
                    )}
                  </TableCell>

                  {/* Ações */}
                  <TableCell className="text-right">
                    {editingId === tx.id ? (
                      // Modo edição: Salvar / Cancelar
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={isSavingEdit}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 w-8 p-0 cursor-pointer"
                          title="Salvar alterações"
                        >
                          {isSavingEdit
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Check className="w-4 h-4" />
                          }
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                          className="text-muted-foreground hover:text-foreground h-8 w-8 p-0 cursor-pointer"
                          title="Cancelar edição"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      // Modo normal: Confirmar / Editar / Excluir
                      <div className="flex justify-end gap-1">
                        {tx.status !== "paid" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarcarPago(tx.id)}
                            disabled={markingId === tx.id}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 w-8 p-0 cursor-pointer"
                            title="Confirmar pagamento"
                          >
                            {markingId === tx.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <BadgeCheck className="w-4 h-4" />
                            }
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEdit(tx)}
                          className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 h-8 w-8 p-0 cursor-pointer"
                          title="Editar cobrança"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(tx.id)}
                          disabled={deletingId === tx.id}
                          className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0 cursor-pointer"
                          title="Excluir cobrança"
                        >
                          {deletingId === tx.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />
                          }
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      )}

        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsappCobranca />
        </TabsContent>
      </Tabs>
    </div>
  );
}
