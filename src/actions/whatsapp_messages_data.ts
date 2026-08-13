"use server"

import { createClientServer, supabaseAdm } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authGuard";
import { buildWaId } from "@/utils/formatters";
import { sendTextMessage } from "@/lib/whatsapp/client";
import { findOrCreateConversation } from "@/lib/whatsapp/conversations";

const JANELA_24H_MS = 24 * 60 * 60 * 1000;

export interface ConversationListItem {
  id: string;
  student_id: string | null;
  wa_id: string;
  display_name: string | null;
  last_message_at: string | null;
  last_customer_message_at: string | null;
  last_read_at: string | null;
  created_at: string;
  student_name: string | null;
  window_open: boolean;
  unread: boolean;
}

export interface MessageItem {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  content: string;
  whatsapp_message_id: string | null;
  status: string;
  wa_timestamp: string;
  created_at: string;
  message_type: "text" | "image" | "audio" | "document";
  media_path: string | null;
  media_url: string | null;
  mime_type: string | null;
  media_filename: string | null;
}

const MESSAGE_COLUMNS =
  "id, conversation_id, direction, content, whatsapp_message_id, status, wa_timestamp, created_at, message_type, media_path, mime_type, media_filename";

// Signed URL de curta duração pro bucket privado whatsapp-media - o path
// sozinho não abre o arquivo (bucket não é público), só serve como referência
// pra gerar essa URL sob demanda quando a tela de Mensagens carrega.
const MEDIA_SIGNED_URL_TTL_SECONDS = 60 * 60;

async function comMediaUrl(mensagens: MessageItem[]): Promise<MessageItem[]> {
  return Promise.all(
    mensagens.map(async (m) => {
      if (!m.media_path) return { ...m, media_url: null };
      const { data, error } = await supabaseAdm.storage
        .from("whatsapp-media")
        .createSignedUrl(m.media_path, MEDIA_SIGNED_URL_TTL_SECONDS);
      return { ...m, media_url: error ? null : data.signedUrl };
    })
  );
}

// Resolve só a Signed URL de uma mídia específica - usado pra completar, no
// client, uma mensagem que chegou pelo canal Realtime (o payload cru do
// Postgres não tem media_url, só listMessages/comMediaUrl calcula isso).
// Evita ter que recarregar a conversa inteira só pra exibir uma imagem/áudio/
// documento novo.
export async function resolveMediaUrl(media_path: string) {
  try {
    const supabase = await createClientServer();
    const guard = await assertAdmin(supabase);
    if (!guard.ok) return { result: "erro", details: guard.details };

    const { data, error } = await supabaseAdm.storage
      .from("whatsapp-media")
      .createSignedUrl(media_path, MEDIA_SIGNED_URL_TTL_SECONDS);

    if (error) throw error;
    return { result: "sucesso", media_url: data.signedUrl };
  } catch (err: any) {
    return { result: "erro", details: err.message };
  }
}

export async function listConversations() {
  try {
    const supabase = await createClientServer();
    const guard = await assertAdmin(supabase);
    if (!guard.ok) return { result: "erro", details: guard.details };

    const { data: conversations, error } = await supabase
      .from("whatsapp_conversations")
      .select("id, student_id, wa_id, display_name, last_message_at, last_customer_message_at, last_read_at, created_at")
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error) throw error;

    // Busca os alunos vinculados numa segunda query (em vez de select embed
    // via FK) pra não depender de uma foreign key declarada entre
    // whatsapp_conversations.student_id e student.student_id.
    const studentIds = Array.from(
      new Set((conversations || []).map((c) => c.student_id).filter((id): id is string => !!id))
    );

    const studentsById = new Map<string, { full_name: string; nickname: string | null }>();
    if (studentIds.length > 0) {
      const { data: students, error: studentsError } = await supabase
        .from("student")
        .select("student_id, full_name, nickname")
        .in("student_id", studentIds);
      if (studentsError) throw studentsError;
      for (const s of students || []) {
        studentsById.set(s.student_id, { full_name: s.full_name, nickname: s.nickname });
      }
    }

    const now = Date.now();
    const result: ConversationListItem[] = (conversations || []).map((c) => {
      const student = c.student_id ? studentsById.get(c.student_id) : undefined;
      return {
        ...c,
        student_name: student ? student.nickname || student.full_name : null,
        window_open: !!c.last_customer_message_at && now - new Date(c.last_customer_message_at).getTime() < JANELA_24H_MS,
        // Não lida = o cliente mandou mensagem depois da última vez que o
        // admin abriu essa conversa (last_read_at null = nunca abriu).
        unread:
          !!c.last_customer_message_at &&
          (!c.last_read_at || new Date(c.last_customer_message_at).getTime() > new Date(c.last_read_at).getTime()),
      };
    });

    return { result: "sucesso", conversations: result };
  } catch (err: any) {
    return { result: "erro", details: err.message };
  }
}

// Marca a conversa como lida até agora - chamada quando o admin abre a
// conversa e de novo a cada mensagem nova recebida enquanto ela está aberta,
// pra ela nunca aparecer como não lida enquanto está sendo vista. Usa
// supabaseAdm (Service Role) pelo mesmo motivo do resto do arquivo: a RLS de
// whatsapp_conversations só libera escrita pro Service Role.
export async function markConversationRead(conversation_id: string) {
  try {
    const supabase = await createClientServer();
    const guard = await assertAdmin(supabase);
    if (!guard.ok) return { result: "erro", details: guard.details };

    const { error } = await supabaseAdm
      .from("whatsapp_conversations")
      .update({ last_read_at: new Date().toISOString() })
      .eq("id", conversation_id);

    if (error) throw error;
    return { result: "sucesso" };
  } catch (err: any) {
    return { result: "erro", details: err.message };
  }
}

export async function listMessages(conversation_id: string) {
  try {
    const supabase = await createClientServer();
    const guard = await assertAdmin(supabase);
    if (!guard.ok) return { result: "erro", details: guard.details };

    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select(MESSAGE_COLUMNS)
      .eq("conversation_id", conversation_id)
      .order("wa_timestamp", { ascending: true });

    if (error) throw error;
    const messages = await comMediaUrl((data || []) as MessageItem[]);
    return { result: "sucesso", messages };
  } catch (err: any) {
    return { result: "erro", details: err.message };
  }
}

// Grava a resposta como "pending" e envia de verdade via Graph API na hora - só é
// chamada quando a janela de 24h está aberta (checado abaixo), então é sempre texto
// livre. A UI reflete o status final (sent/failed) via Supabase Realtime, sem
// precisar de polling.
export async function sendReply(conversation_id: string, wa_id: string, content: string) {
  try {
    const supabase = await createClientServer();
    const guard = await assertAdmin(supabase);
    if (!guard.ok) return { result: "erro", details: guard.details };

    const texto = content.trim();
    if (!texto) return { result: "erro", details: "Mensagem vazia." };

    const { data: conversation, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select("last_customer_message_at")
      .eq("id", conversation_id)
      .single();

    if (convError) throw convError;

    const windowOpen =
      !!conversation.last_customer_message_at &&
      Date.now() - new Date(conversation.last_customer_message_at).getTime() < JANELA_24H_MS;

    if (!windowOpen) {
      return {
        result: "erro",
        details: "Janela de 24h fechada - não é possível responder com mensagem livre. É preciso usar um template aprovado.",
      };
    }

    const agora = new Date().toISOString();

    // supabaseAdm (Service Role) a partir daqui: mesma razão do
    // findOrCreateConversationForStudent acima - RLS dessas tabelas só libera
    // escrita pro Service Role, então com o client de sessão essas
    // gravações falhavam silenciosamente e a mensagem ficava presa em
    // "pending" pra sempre mesmo enviada com sucesso pela Graph API.
    const { data: inserted, error: insertError } = await supabaseAdm
      .from("whatsapp_messages")
      .insert({
        conversation_id,
        direction: "out",
        content: texto,
        status: "pending",
        wa_timestamp: agora,
      })
      .select(MESSAGE_COLUMNS)
      .single();

    if (insertError) throw insertError;

    const { error: updateError } = await supabaseAdm
      .from("whatsapp_conversations")
      .update({ last_message_at: agora })
      .eq("id", conversation_id);

    if (updateError) throw updateError;

    revalidatePath("/dashboard/mensagens");

    const sendResult = await sendTextMessage({ to: wa_id, body: texto });

    if (!sendResult.ok) {
      await supabaseAdm.from("whatsapp_messages").update({ status: "failed" }).eq("id", inserted.id);
      return {
        result: "sucesso",
        message: { ...inserted, status: "failed" } as MessageItem,
        aviso: `Mensagem salva, mas o envio falhou: ${sendResult.error}`,
      };
    }

    const { data: sent } = await supabaseAdm
      .from("whatsapp_messages")
      .update({ status: "sent", whatsapp_message_id: sendResult.whatsappMessageId })
      .eq("id", inserted.id)
      .select(MESSAGE_COLUMNS)
      .single();

    return { result: "sucesso", message: (sent ?? inserted) as MessageItem };
  } catch (err: any) {
    return { result: "erro", details: err.message };
  }
}

async function findOrCreateConversationForStudent(
  params: { student_id: string; telephone: string | null; display_name: string }
): Promise<string | null> {
  const waId = buildWaId(params.telephone);
  if (!waId) return null;

  // Usa supabaseAdm (Service Role) em vez do client de sessão do admin: as
  // policies de RLS de whatsapp_conversations/whatsapp_messages só liberam
  // escrita pro Service Role (mesmo client usado pela rota de webhook), então
  // criar uma conversa nova por aqui com o client de sessão falhava sempre -
  // best-effort silencioso, então nunca aparecia erro nenhum, só a conversa
  // não era criada e a cobrança sumia da tela Mensagens.
  return findOrCreateConversation(supabaseAdm, {
    waId,
    studentId: params.student_id,
    displayName: params.display_name,
  });
}

// Espelha no histórico unificado (whatsapp_messages) uma cobrança disparada pela
// régua automática de whatsapp_data.ts, pra ela aparecer junto com o resto da
// conversa do aluno na tela de Mensagens. Best-effort: se falhar (ex: telefone
// inválido, RLS ainda não configurado), não deve travar o envio da cobrança em si -
// que já ficou registrado em whatsapp_cobrancas_agendadas independente disso.
// O messageId retornado é gravado por enviarCobrancas como mirror_message_id na
// linha de whatsapp_cobrancas_agendadas, pra depois do envio de verdade essa linha
// espelho também ser atualizada de "pending" pra "sent"/"failed".
export async function logOutboundCobranca(params: {
  student_id: string;
  telephone: string | null;
  display_name: string;
  content: string;
}): Promise<{ ok: boolean; messageId?: string }> {
  try {
    const supabase = await createClientServer();
    const guard = await assertAdmin(supabase);
    if (!guard.ok) return { ok: false };

    const conversationId = await findOrCreateConversationForStudent(params);
    if (!conversationId) return { ok: false };

    const agora = new Date().toISOString();

    const { data: inserted, error } = await supabaseAdm
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversationId,
        direction: "out",
        content: params.content,
        status: "pending",
        wa_timestamp: agora,
      })
      .select("id")
      .single();

    if (error) throw error;

    await supabaseAdm.from("whatsapp_conversations").update({ last_message_at: agora }).eq("id", conversationId);

    return { ok: true, messageId: inserted.id };
  } catch (err) {
    console.error("Falha ao espelhar cobrança em whatsapp_messages:", err);
    return { ok: false };
  }
}
