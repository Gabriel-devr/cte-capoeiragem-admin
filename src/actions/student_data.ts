"use server"

import { createClientServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authGuard";

export interface StudentPayload {
    full_name: string;
    nickname?: string;
    email?: string;
    telephone?: string;
    birth_date?: string;
    place_of_birth?: string;
    uf?: string;
    gender?: string;
    full_address?: string;
    neighborhood?: string;
    cep?: string;
    instagram?: string;
    shirt_size?: string;
    pants_size?: string;
    babylook_size?: string;
    rg?: string;
    cpf?: string;
    health: {
        has_special_needs: boolean;
        has_disease: boolean;
        medication_allergy: boolean;
        food_allergy: boolean;
        continuous_medication: boolean;
        psychological_disorder: boolean;
        medical_treatment: boolean;
        additional_info?: string;
    };
    emergency_contacts?: Array<{
        contact_name: string;
        relationship_degree: string;
        phone: string;
        additional_info?: string;
    }>;
}

export async function createStudent(data: StudentPayload) {
    try {
        const supabase = await createClientServer();
        const guard = await assertAdmin(supabase);
        if (!guard.ok) return { result: "erro", details: guard.details };

        const { data: studentRecord, error: studentError } = await supabase
            .from('student')
            .insert({
                full_name: data.full_name,
                nickname: data.nickname || null,
                email: data.email || null,
                telephone: data.telephone || null,
                birth_date: data.birth_date || null,
                place_of_birth: data.place_of_birth || null,
                uf: data.uf || null,
                gender: data.gender || null,
                full_address: data.full_address || null,
                neighborhood: data.neighborhood || null,
                cep: data.cep || null,
                instagram: data.instagram || null,
                shirt_size: data.shirt_size || null,
                pants_size: data.pants_size || null,
                babylook_size: data.babylook_size || null,
                rg: data.rg || null,
                cpf: data.cpf || null
            })
            .select('student_id')
            .single();

        if (studentError || !studentRecord) throw studentError;

        const newStudentId = studentRecord.student_id;

        const { error: healthError } = await supabase
            .from('student_health')
            .insert({ student_id: newStudentId, ...data.health });
        if (healthError) throw healthError;

        if (data.emergency_contacts && data.emergency_contacts.length > 0) {
            const contactsToInsert = data.emergency_contacts.map(contact => ({
                student_id: newStudentId,
                ...contact
            }));
            const { error: contactsError } = await supabase.from('emergency_contacts').insert(contactsToInsert);
            if (contactsError) throw contactsError;
        }

        revalidatePath('/dashboard/students');
        return { result: "sucesso" };
    } catch (err: any) {
        return { result: "erro", details: err.message };
    }
}

export async function listStudent() {
    try {
        const supabase = await createClientServer();
        const guard = await assertAdmin(supabase);
        if (!guard.ok) return { result: "erro", details: guard.details };
        const { data: students, error } = await supabase
            .from('student')
            .select(`
                *,
                student_health (*),
                emergency_contacts (*),
                enrollments (*, plano (*)),
                profile (role)
            `)
            .order('full_name', { ascending: true });

        if (error) throw error;
        return { result: "sucesso", students };
    } catch (err: any) {
        return { result: "erro", details: err.message };
    }
}

export async function updateStudentIdentificacao(id: string, data: Partial<StudentPayload>) {
    try {
        const supabase = await createClientServer();
        const guard = await assertAdmin(supabase);
        if (!guard.ok) return { result: "erro", details: guard.details };
        const { error } = await supabase
            .from('student')
            .update({
                full_name: data.full_name,
                nickname: data.nickname || null,
                telephone: data.telephone || null,
                birth_date: data.birth_date || null,
                email: data.email || null,
                place_of_birth: data.place_of_birth || null,
                uf: data.uf || null,
                gender: data.gender || null,
                full_address: data.full_address || null,
                neighborhood: data.neighborhood || null,
                cep: data.cep || null,
                instagram: data.instagram || null,
                shirt_size: data.shirt_size || null,
                pants_size: data.pants_size || null,
                babylook_size: data.babylook_size || null,
                rg: data.rg || null,
                cpf: data.cpf || null
            })
            .eq('student_id', id);

        if (error) throw error;
        revalidatePath('/dashboard/alunos');
        return { result: "sucesso" };
    } catch (err: any) {
        return { result: "erro", details: err.message };
    }
}

export async function updateStudentHealth(
    student_id: string,
    healthData: StudentPayload['health'],
    emergencyContacts?: StudentPayload['emergency_contacts']
) {
    try {
        const supabase = await createClientServer();
        const guard = await assertAdmin(supabase);
        if (!guard.ok) return { result: "erro", details: guard.details };
        const { error } = await supabase
            .from('student_health')
            .update(healthData)
            .eq('student_id', student_id);

        if (error) throw error;

        const { error: deleteError } = await supabase
            .from('emergency_contacts')
            .delete()
            .eq('student_id', student_id);
        if (deleteError) throw deleteError;

        if (emergencyContacts && emergencyContacts.length > 0) {
            const contactsToInsert = emergencyContacts.map(contact => ({
                student_id,
                ...contact
            }));
            const { error: contactsError } = await supabase.from('emergency_contacts').insert(contactsToInsert);
            if (contactsError) throw contactsError;
        }

        revalidatePath('/dashboard/alunos');
        return { result: "sucesso" };
    } catch (err: any) {
        return { result: "erro", details: err.message };
    }
}

export async function deleteStudent(id: string) {
    try {
        const supabase = await createClientServer();
        const guard = await assertAdmin(supabase);
        if (!guard.ok) return { result: "erro", details: guard.details };
        const { error } = await supabase.from('student').delete().eq('student_id', id);
        if (error) {
            // 23503 = foreign_key_violation. Deixado de propósito: matrícula,
            // transações financeiras e cobranças não têm ON DELETE
            // CASCADE/SET NULL, então a exclusão é bloqueada enquanto esse
            // histórico existir, em vez de apagá-lo junto com o aluno.
            if (error.code === '23503') {
                return {
                    result: "erro",
                    details: "Este aluno possui matrícula, cobrança e/ou histórico financeiro vinculado e não pode ser excluído. Cancele a matrícula em vez de excluir o cadastro.",
                };
            }
            throw error;
        }
        revalidatePath('/dashboard/alunos');
        return { result: "sucesso" };
    } catch (err: any) {
        return { result: "erro", details: err.message };
    }
}