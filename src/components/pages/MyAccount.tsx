"use client";

import { motion } from "motion/react";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useAuth } from "../../contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { updatePassword } from "@/actions/user_data";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";

const passwordSchema = z.object({
  newPassword: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(6, "A confirmação de senha é obrigatória"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export function MyAccount() {
  const { user } = useAuth();

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    }
  });

  const onPasswordSubmit = async (data: any) => {
    const res = await updatePassword(data.newPassword);
    if (res.result === "sucesso") {
      toast.success("Senha alterada com sucesso!");
      passwordForm.reset();
    } else {
      toast.error("Erro ao alterar senha: " + res.details);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-foreground mb-2">Minha Conta</h1>
        <p className="inline-block text-foreground bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm">Configurações da sua conta de administrador</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-xl p-6 shadow-lg"
      >
        <p className="text-sm text-muted-foreground">
          Logado como <span className="font-semibold text-foreground">{user?.email}</span>
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl p-6 shadow-lg"
      >
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-accent" /> Configurações de Segurança
        </h3>

        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nova senha *</FormLabel>
                  <FormControl><Input {...field} type="password" placeholder="••••••••" className="bg-input-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar nova senha *</FormLabel>
                  <FormControl><Input {...field} type="password" placeholder="••••••••" className="bg-input-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <Button type="submit" disabled={passwordForm.formState.isSubmitting} className="bg-accent hover:bg-accent/90 text-white min-w-[150px]">
              {passwordForm.formState.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Alterar senha"}
            </Button>
          </form>
        </Form>
      </motion.div>
    </div>
  );
}
