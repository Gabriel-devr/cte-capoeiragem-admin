"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, Plus, Edit, Trash2, Search, Filter, Check, Phone, Loader2, AlertCircle } from "lucide-react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

import { studentSchema, type StudentFormData } from "@/utils/studentSchema";
import { createStudent, listStudent, deleteStudent, updateStudentIdentificacao, updateStudentHealth } from "@/actions/student_data";
import { formatPhone, formatCPF, formatCEP, formatDateInput, toBRDate, toISODate, calculateAge, fetchAddressByCEP } from "@/utils/formatters";
import { AulasAvulsas } from "./AulasAvulsas";
import { AulaExperimental } from "./AulaExperimental";

const enrollmentStatusConfig: Record<string, { label: string; className: string }> = {
  active:    { label: "Ativo",     className: "bg-green-100 text-green-700 border-green-200" },
  paused:    { label: "Pausado",   className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  cancelled: { label: "Cancelado", className: "bg-red-100 text-red-700 border-red-200" },
};

export function Students() {
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      full_name: "",
      nickname: "",
      email: "",
      telephone: "",
      birth_date: "",
      place_of_birth: "",
      uf: "",
      gender: "",
      full_address: "",
      neighborhood: "",
      cep: "",
      instagram: "",
      shirt_size: "",
      pants_size: "",
      babylook_size: "",
      rg: "",
      cpf: "",
      health: {
        has_special_needs: false,
        has_disease: false,
        medication_allergy: false,
        food_allergy: false,
        continuous_medication: false,
        psychological_disorder: false,
        medical_treatment: false,
        additional_info: "",
      },
      emergency_contacts: [],
    } as any,
  });

  const { fields: contactFields, append: appendContact, remove: removeContact } = useFieldArray({
    control: form.control,
    name: "emergency_contacts",
  });

  const birthDateValue = useWatch({ control: form.control, name: "birth_date" });
  const computedAge = calculateAge(birthDateValue);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
      const res = await listStudent();
      if (res.result === "sucesso") setStudents(res.students || []);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenModal = (student?: any) => {
    setCurrentStep(1);
    if (student) {
      setEditingStudent(student.student_id);
      const healthData = student.student_health || {};
      form.reset({
        full_name:      student.full_name,
        nickname:       student.nickname || "",
        email:          student.email || "",
        telephone:      student.telephone || "",
        birth_date:     toBRDate(student.birth_date),
        place_of_birth: student.place_of_birth || "",
        uf:             student.uf || "",
        gender:         student.gender || "",
        full_address:   student.full_address || "",
        neighborhood:   student.neighborhood || "",
        cep:            formatCEP(student.cep || ""),
        instagram:      student.instagram || "",
        shirt_size:     student.shirt_size || "",
        pants_size:     student.pants_size || "",
        babylook_size:  student.babylook_size || "",
        rg:             student.rg || "",
        cpf:            student.cpf || "",
        health: {
          has_special_needs:    healthData.has_special_needs ?? false,
          has_disease:          healthData.has_disease ?? false,
          medication_allergy:   healthData.medication_allergy ?? false,
          food_allergy:         healthData.food_allergy ?? false,
          continuous_medication: healthData.continuous_medication ?? false,
          psychological_disorder: healthData.psychological_disorder ?? false,
          medical_treatment:    healthData.medical_treatment ?? false,
          additional_info:      healthData.additional_info || "",
        },
        emergency_contacts: student.emergency_contacts?.length > 0
          ? student.emergency_contacts.map((c: any) => ({
              contact_name:        c.contact_name,
              relationship_degree: c.relationship_degree,
              phone:               c.phone,
              additional_info:     c.additional_info || "",
            }))
          : [],
      });
    } else {
      setEditingStudent(null);
      form.reset({
        full_name: "", nickname: "", email: "", telephone: "",
        birth_date: "", place_of_birth: "", uf: "", gender: "", full_address: "",
        neighborhood: "", cep: "", instagram: "", shirt_size: "", pants_size: "", babylook_size: "",
        rg: "", cpf: "",
        health: {
          has_special_needs: false, has_disease: false, medication_allergy: false,
          food_allergy: false, continuous_medication: false,
          psychological_disorder: false, medical_treatment: false, additional_info: "",
        },
        emergency_contacts: [],
      });
    }
    setCurrentStep(1);
    setIsModalOpen(true);
  };

  const handleFormattedChange = (fieldToUpdate: any, formatter: (val: string) => string) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatter(e.target.value);
      form.setValue(fieldToUpdate, formatted);
    };
  };

  const handleCEPChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCEP(e.target.value);
    form.setValue("cep", formatted);

    if (formatted.replace(/\D/g, "").length === 8) {
      const address = await fetchAddressByCEP(formatted);
      if (address) {
        form.setValue("full_address", address.logradouro || "", { shouldValidate: true });
        form.setValue("neighborhood", address.bairro || "", { shouldValidate: true });
        form.setValue("uf", address.uf || "", { shouldValidate: true });
      } else {
        toast.error("CEP não encontrado");
      }
    }
  };

  const handleFormattedNestedChange = (index: number, fieldName: string, formatter: (val: string) => string) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatter(e.target.value);
      form.setValue(`emergency_contacts.${index}.${fieldName}` as any, formatted);
    };
  };

  const onSubmit = async (data: StudentFormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        birth_date: toISODate(data.birth_date)
      };

      let res;
      if (editingStudent) {
        const idData = { ...payload };
        delete idData.health;
        delete idData.emergency_contacts;
        const resId = await updateStudentIdentificacao(editingStudent, idData);
        const resHealth = await updateStudentHealth(editingStudent, payload.health, payload.emergency_contacts || []);
        res = resId.result === "erro" ? resId : resHealth;
      } else {
        res = await createStudent(payload as any);
      }

      if (res.result === "sucesso") {
        toast.success(editingStudent ? "Aluno atualizado!" : "Aluno cadastrado!");
        setIsModalOpen(false);
        fetchData();
      } else {
        toast.error("Erro: " + res.details);
      }
    } catch {
      toast.error("Erro na submissão");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onError = (errors: any) => {
    const firstError = Object.values(errors).flatMap((e: any) =>
      e.message || (e.root && e.root.message) || "Campo inválido"
    )[0];
    if (firstError) toast.error(`Erro: ${firstError}`, { icon: <AlertCircle className="text-destructive" /> });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este aluno?")) return;
    const res = await deleteStudent(id);
    if (res.result === "sucesso") {
      toast.success("Aluno excluído");
      fetchData();
    } else {
      toast.error("Erro ao excluir: " + res.details);
    }
  };

  const filteredStudents = students.filter((s) => {
    const isNotAdmin = s.profile?.role !== "admin";
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.nickname?.toLowerCase().includes(searchTerm.toLowerCase());
    return isNotAdmin && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Alunos</h1>
          <p className="inline-block text-foreground bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm">Cadastre e acompanhe seus alunos</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-accent hover:bg-accent/90 text-white">
          <Plus className="w-4 h-4 mr-2" /> Novo Aluno
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou apelido..."
            className="pl-10 bg-input-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon"><Filter className="w-4 h-4" /></Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-accent" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="text-left p-4 font-semibold">Nome</th>
                <th className="text-left p-4 font-semibold">Apelido</th>
                <th className="text-left p-4 font-semibold">Matrícula</th>
                <th className="text-left p-4 font-semibold">Contato</th>
                <th className="text-right p-4 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const activeEnrollment = student.enrollments?.find((e: any) => e.status === "active");
                const enrollment = activeEnrollment ?? student.enrollments?.[0];
                const statusCfg = enrollment
                  ? (enrollmentStatusConfig[enrollment.status] ?? enrollmentStatusConfig.active)
                  : null;

                return (
                  <tr key={student.student_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-medium">{student.full_name}</td>
                    <td className="p-4 text-muted-foreground">{student.nickname || "—"}</td>
                    <td className="p-4">
                      {statusCfg ? (
                        <Badge variant="outline" className={`text-xs font-medium ${statusCfg.className}`}>
                          {statusCfg.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem matrícula</span>
                      )}
                    </td>
                    <td className="p-4 flex items-center gap-2 text-sm">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {student.telephone || "—"}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenModal(student)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(student.student_id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="pt-4 border-t border-border grid grid-cols-1 lg:grid-cols-2 gap-8">
        <AulasAvulsas />
        <AulaExperimental />
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStudent ? "Editar Aluno" : "Novo Cadastro de Aluno"}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-center mb-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-colors ${
                  currentStep >= step ? "bg-accent border-accent text-white" : "bg-background border-muted text-muted-foreground"
                }`}>
                  {currentStep > step ? <Check className="w-6 h-6" /> : step}
                </div>
                {step < 3 && <div className={`w-16 h-1 transition-colors ${currentStep > step ? "bg-accent" : "bg-muted"}`} />}
              </div>
            ))}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6">
              {currentStep === 1 && (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="full_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl><Input {...field} className="bg-input-background" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="nickname" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apelido</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} className="bg-input-background" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} className="bg-input-background" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="telephone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ""} 
                          placeholder="(00) 0 0000-0000"
                          className="bg-input-background" 
                          onChange={handleFormattedChange("telephone", formatPhone)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="birth_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="DD/MM/AAAA"
                          className="bg-input-background"
                          onChange={handleFormattedChange("birth_date", formatDateInput)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormItem>
                    <FormLabel>Idade</FormLabel>
                    <FormControl>
                      <Input value={computedAge !== null ? `${computedAge} anos` : "—"} disabled className="bg-input-background" />
                    </FormControl>
                  </FormItem>
                  <FormField control={form.control} name="place_of_birth" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Naturalidade</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} className="bg-input-background" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="uf" render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          maxLength={2}
                          placeholder="Ex: SP"
                          className="bg-input-background"
                          onChange={handleFormattedChange("uf", (val: string) => val.toUpperCase().slice(0, 2))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="gender" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gênero</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="bg-input-background">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Masculino">Masculino</SelectItem>
                          <SelectItem value="Feminino">Feminino</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                          <SelectItem value="Prefiro não informar">Prefiro não informar</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="cpf" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ""} 
                          placeholder="000.000.000-00"
                          className="bg-input-background" 
                          onChange={handleFormattedChange("cpf", formatCPF)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="rg" render={({ field }) => (
                    <FormItem>
                      <FormLabel>RG</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} className="bg-input-background" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="instagram" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instagram</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} placeholder="@usuario" className="bg-input-background" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="shirt_size" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tamanho da Camisa</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="bg-input-background">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Nenhum">Nenhum</SelectItem>
                          <SelectItem value="2 anos">2 anos</SelectItem>
                          <SelectItem value="4 anos">4 anos</SelectItem>
                          <SelectItem value="6 anos">6 anos</SelectItem>
                          <SelectItem value="8 anos">8 anos</SelectItem>
                          <SelectItem value="10 anos">10 anos</SelectItem>
                          <SelectItem value="12 anos">12 anos</SelectItem>
                          <SelectItem value="P adulto">P adulto</SelectItem>
                          <SelectItem value="M adulto">M adulto</SelectItem>
                          <SelectItem value="G adulto">G adulto</SelectItem>
                          <SelectItem value="GG adulto">GG adulto</SelectItem>
                          <SelectItem value="EXG adulto">EXG adulto</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="pants_size" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tamanho da Calça</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="bg-input-background">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Nenhum">Nenhum</SelectItem>
                          <SelectItem value="2 anos">2 anos</SelectItem>
                          <SelectItem value="4 anos">4 anos</SelectItem>
                          <SelectItem value="6 anos">6 anos</SelectItem>
                          <SelectItem value="8 anos">8 anos</SelectItem>
                          <SelectItem value="10 anos">10 anos</SelectItem>
                          <SelectItem value="12 anos">12 anos</SelectItem>
                          <SelectItem value="PP adulto">PP adulto</SelectItem>
                          <SelectItem value="P adulto">P adulto</SelectItem>
                          <SelectItem value="M adulto">M adulto</SelectItem>
                          <SelectItem value="G adulto">G adulto</SelectItem>
                          <SelectItem value="GG adulto">GG adulto</SelectItem>
                          <SelectItem value="EXG adulto">EXG adulto</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="babylook_size" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tamanho de Babylook</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="bg-input-background">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Nenhum">Nenhum</SelectItem>
                          <SelectItem value="P adulto">P adulto</SelectItem>
                          <SelectItem value="M adulto">M adulto</SelectItem>
                          <SelectItem value="G adulto">G adulto</SelectItem>
                          <SelectItem value="GG adulto">GG adulto</SelectItem>
                          <SelectItem value="EXG adulto">EXG adulto</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="cep" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="00000-000"
                          className="bg-input-background"
                          onChange={handleCEPChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="full_address" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Endereço</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} className="bg-input-background" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="neighborhood" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} className="bg-input-background" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Contato de Emergência</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendContact({ contact_name: "", relationship_degree: "", phone: "", additional_info: "" })}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Adicionar Contato
                    </Button>
                  </div>

                  {contactFields.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum contato de emergência adicionado.</p>
                  )}

                  {contactFields.map((contactField, index) => (
                    <div key={contactField.id} className="relative grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border border-border">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-destructive"
                        onClick={() => removeContact(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <FormField control={form.control} name={`emergency_contacts.${index}.contact_name`} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome *</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} className="bg-input-background" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`emergency_contacts.${index}.relationship_degree`} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Grau de Parentesco *</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} className="bg-input-background" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`emergency_contacts.${index}.phone`} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              placeholder="(00) 0 0000-0000"
                              className="bg-input-background"
                              onChange={handleFormattedNestedChange(index, "phone", formatPhone)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`emergency_contacts.${index}.additional_info`} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Informações Adicionais</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} className="bg-input-background" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  ))}
                </div>
                </>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { name: "health.has_special_needs" as const,      label: "PNE (Necessidades Especiais)" },
                      { name: "health.has_disease" as const,            label: "Possui Diagnóstico de Doença" },
                      { name: "health.medication_allergy" as const,     label: "Alergia Medicamentosa" },
                      { name: "health.food_allergy" as const,           label: "Alergia Alimentar" },
                      { name: "health.continuous_medication" as const,  label: "Medicação Contínua" },
                      { name: "health.psychological_disorder" as const, label: "Transtorno Psicológico" },
                      { name: "health.medical_treatment" as const,      label: "Tratamento Médico" },
                    ].map(({ name, label }) => (
                      <FormField key={name} control={form.control} name={name} render={({ field }) => (
                        <div className="flex items-center space-x-3 p-4 rounded-lg border border-border">
                          <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                          <Label>{label}</Label>
                        </div>
                      )} />
                    ))}
                  </div>
                  <FormField control={form.control} name="health.additional_info" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sobre os itens selecionados</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value || ""} className="bg-input-background min-h-32" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}

              {currentStep === 3 && (
                <div className="p-6 bg-muted/30 rounded-xl border border-dashed border-border">
                  <p className="text-muted-foreground mb-4">Confirme os dados antes de finalizar o cadastro.</p>
                  <div className="space-y-2 text-sm">
                    <p><strong>Nome:</strong> {form.getValues("full_name")}</p>
                    <p><strong>Apelido:</strong> {form.getValues("nickname") || "—"}</p>
                    <p><strong>E-mail:</strong> {form.getValues("email") || "—"}</p>
                    <p><strong>Telefone:</strong> {form.getValues("telephone") || "—"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    A matrícula (plano e produtos) será vinculada na seção <strong>Matrículas</strong>.
                  </p>
                </div>
              )}

              <div className="flex justify-between pt-6 border-t border-border">
                <Button type="button" variant="outline" onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : setIsModalOpen(false)}>
                  {currentStep === 1 ? "Cancelar" : "Voltar"}
                </Button>
                {currentStep < 3 ? (
                  <Button type="button" onClick={() => setCurrentStep(currentStep + 1)} className="bg-accent hover:bg-accent/90 text-white">
                    Próximo
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-white min-w-[120px]">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingStudent ? "Salvar" : "Finalizar"}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
