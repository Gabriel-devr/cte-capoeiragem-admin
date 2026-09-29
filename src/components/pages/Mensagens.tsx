"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Send, Loader2, MessagesSquare, Lock, Check, CheckCheck, Clock, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "../ui/avatar";
import { ScrollArea } from "../ui/scroll-area";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";

import {
  listConversations,
  listMessages,
  markConversationRead,
  resolveMediaUrl,
  sendReply,
  type ConversationListItem,
  type MessageItem,
} from "@/actions/whatsapp_messages_data";
import { formatPhone } from "@/utils/formatters";
import { supabase } from "@/lib/supabase";

function nomeExibicao(c: ConversationListItem) {
  return c.student_name || c.display_name || formatTelefone(c.wa_id);
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// wa_id vem como dígitos + DDI 55 (ex: 557588700086). formatPhone espera o
// número sem DDI, então tiramos o 55 antes de formatar.
function formatTelefone(wa_id: string) {
  const semDDI = wa_id.startsWith("55") ? wa_id.slice(2) : wa_id;
  return formatPhone(semDDI) || wa_id;
}

function horaCurta(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function dataOuHora(iso: string) {
  const data = new Date(iso);
  const hoje = new Date();
  const mesmoDia =
    data.getDate() === hoje.getDate() && data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
  return mesmoDia ? horaCurta(iso) : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function ehMesmoDia(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

// Rótulo do divisor de data na thread (padrão WhatsApp: "Hoje"/"Ontem"/data
// cheia) - sem isso, uma conversa com dias de intervalo fica com todas as
// mensagens misturadas, só com hora, sem indicar quando o dia mudou.
function rotuloData(iso: string) {
  const data = new Date(iso);
  const hoje = new Date();
  if (ehMesmoDia(data, hoje)) return "Hoje";

  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (ehMesmoDia(data, ontem)) return "Ontem";

  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

// Conteúdo da mensagem varia com message_type - imagem/áudio/documento vêm do
// bucket privado whatsapp-media, já resolvidos como Signed URL (media_url)
// pelo listMessages(). Sem media_url (signed url falhou ou ainda não
// disponível) cai no fallback de texto pra não deixar a bolha vazia.
function MessageBody({ m, onImageClick }: { m: MessageItem; onImageClick: (url: string) => void }) {
  if (m.message_type === "image" && m.media_url) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => onImageClick(m.media_url as string)}
          className="block cursor-pointer"
          title="Clique para ampliar"
        >
          <img src={m.media_url} alt="Imagem enviada" className="max-w-full max-h-64 rounded-md object-contain" />
        </button>
        {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
      </div>
    );
  }

  if (m.message_type === "audio" && m.media_url) {
    return <audio controls src={m.media_url} className="max-w-full" />;
  }

  if (m.message_type === "document" && m.media_url) {
    return (
      <a
        href={m.media_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 underline"
      >
        <FileText className="w-4 h-4 shrink-0" />
        {m.media_filename || "Documento"}
      </a>
    );
  }

  return <span className="whitespace-pre-wrap break-words">{m.content}</span>;
}

function StatusIcon({ status }: { status: string }) {
  const className = "w-3.5 h-3.5";
  if (status === "read") return <CheckCheck className={`${className} text-blue-300`} />;
  if (status === "delivered") return <CheckCheck className={className} />;
  if (status === "sent") return <Check className={className} />;
  if (status === "failed") return <AlertCircle className={`${className} text-destructive`} />;
  return <Clock className={className} />;
}

export function Mensagens() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [busca, setBusca] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    const res = await listConversations();
    if (res.result === "sucesso" && res.conversations) {
      setConversations(res.conversations);
    } else {
      toast.error("Erro ao carregar conversas: " + res.details);
    }
    setIsLoadingConversations(false);
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Realtime: qualquer mudança em whatsapp_conversations (nova conversa,
  // mensagem nova mudando o last_message_at, etc) só recarrega a lista -
  // mais simples do que tentar reconciliar em memória e ainda resolve o
  // nome do aluno pra conversas que acabaram de aparecer.
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-conversations-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchMessages = async (conversationId: string) => {
    setIsLoadingMessages(true);
    const res = await listMessages(conversationId);
    if (res.result === "sucesso" && res.messages) {
      setMessages(res.messages);
    } else {
      toast.error("Erro ao carregar mensagens: " + res.details);
    }
    setIsLoadingMessages(false);
  };

  useEffect(() => {
    if (selectedId) fetchMessages(selectedId);
  }, [selectedId]);

  // Marca como lida assim que o admin abre a conversa - atualiza local
  // (badge some na hora) e grava no servidor. Sem isso a conversa fica
  // marcada como não lida na sidebar mesmo depois de aberta.
  useEffect(() => {
    if (!selectedId) return;
    setConversations((prev) => prev.map((c) => (c.id === selectedId ? { ...c, unread: false } : c)));
    markConversationRead(selectedId);
  }, [selectedId]);

  // Realtime da conversa aberta: filtra no servidor por conversation_id, por
  // isso reassina toda vez que a seleção muda.
  useEffect(() => {
    if (!selectedId) return;

    const channel = supabase
      .channel(`whatsapp-messages-${selectedId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${selectedId}` },
        async (payload) => {
          const nova = payload.new as MessageItem;

          // Mensagem nova do cliente chegando na conversa que já está aberta -
          // mantém marcada como lida (senão o badge de não lida acende na
          // sidebar mesmo com o admin olhando pra conversa naquele momento).
          if (nova.direction === "in") markConversationRead(selectedId);

          // Mensagem de mídia: o payload cru do Realtime não tem media_url (essa
          // Signed URL só é calculada no servidor, por listMessages/comMediaUrl) -
          // sem isso a bolha de imagem/áudio/documento chega vazia. Resolve só a
          // URL dessa mensagem em vez de recarregar a conversa inteira (evita o
          // spinner de carregamento apagando a thread por um instante).
          if (nova.media_path) {
            const res = await resolveMediaUrl(nova.media_path);
            const media_url = (res.result === "sucesso" ? res.media_url : null) ?? null;
            setMessages((prev) => (prev.some((m) => m.id === nova.id) ? prev : [...prev, { ...nova, media_url }]));
            return;
          }

          setMessages((prev) => (prev.some((m) => m.id === nova.id) ? prev : [...prev, nova]));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${selectedId}` },
        (payload) => {
          const atualizada = payload.new as MessageItem;
          setMessages((prev) => prev.map((m) => (m.id === atualizada.id ? atualizada : m)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const conversasFiltradas = conversations.filter((c) => {
    if (!busca.trim()) return true;
    const alvo = `${nomeExibicao(c)} ${c.wa_id}`.toLowerCase();
    return alvo.includes(busca.trim().toLowerCase());
  });

  const conversaSelecionada = conversations.find((c) => c.id === selectedId) || null;

  const handleSend = async () => {
    if (!conversaSelecionada || !draft.trim() || isSending) return;

    setIsSending(true);
    const res = await sendReply(conversaSelecionada.id, conversaSelecionada.wa_id, draft.trim());

    if (res.result === "sucesso") {
      setDraft("");
      if (res.message) {
        const nova = res.message;
        setMessages((prev) => (prev.some((m) => m.id === nova.id) ? prev : [...prev, nova]));
      }
      if (res.aviso) toast(res.aviso);
    } else {
      toast.error("Erro ao enviar: " + res.details);
    }
    setIsSending(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden h-[calc(100vh-8rem)] min-h-[500px] flex">
      {/* Lista de conversas */}
      <div className="w-full sm:w-80 shrink-0 border-r border-border flex flex-col min-h-0">
        <div className="p-4 border-b border-border space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <MessagesSquare className="w-5 h-5 text-accent" /> Mensagens
          </h2>
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            </div>
          ) : conversasFiltradas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12 px-4">
              {busca ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda."}
            </p>
          ) : (
            <ul>
              {conversasFiltradas.map((c) => {
                const nome = nomeExibicao(c);
                const ativa = c.id === selectedId;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border/50 transition-colors cursor-pointer ${
                        ativa ? "bg-accent/10" : "hover:bg-muted"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar>
                          <AvatarFallback className="bg-accent/20 text-accent font-semibold">
                            {iniciais(nome)}
                          </AvatarFallback>
                        </Avatar>
                        {c.unread && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent border-2 border-card"
                            title="Mensagem não lida"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate ${c.unread ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                            {nome}
                          </span>
                          {c.last_message_at && (
                            <span className={`text-xs shrink-0 ${c.unread ? "text-accent font-semibold" : "text-muted-foreground"}`}>
                              {dataOuHora(c.last_message_at)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground truncate">{formatTelefone(c.wa_id)}</span>
                          {!c.window_open && (
                            <span title="Janela de 24h fechada">
                              <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </div>

      {/* Thread */}
      <div className="hidden sm:flex flex-1 flex-col min-w-0 min-h-0">
        {!conversaSelecionada ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <MessagesSquare className="w-10 h-10" />
            <p className="text-sm">Selecione uma conversa para ver as mensagens</p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-border flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-accent/20 text-accent font-semibold">
                  {iniciais(nomeExibicao(conversaSelecionada))}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{nomeExibicao(conversaSelecionada)}</p>
                <p className="text-xs text-muted-foreground">{formatTelefone(conversaSelecionada.wa_id)}</p>
              </div>
            </div>

            <ScrollArea className="flex-1 px-4 min-h-0">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-accent animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhuma mensagem ainda.</p>
              ) : (
                <div className="py-4 space-y-2">
                  {messages.map((m, i) => {
                    const anterior = messages[i - 1];
                    const mostrarDivisorData =
                      !anterior || !ehMesmoDia(new Date(m.wa_timestamp), new Date(anterior.wa_timestamp));

                    return (
                      <div key={m.id}>
                        {mostrarDivisorData && (
                          <div className="flex justify-center my-3">
                            <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-3 py-1">
                              {rotuloData(m.wa_timestamp)}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                              m.direction === "out" ? "bg-accent text-white" : "bg-muted text-foreground"
                            }`}
                          >
                            <MessageBody m={m} onImageClick={setLightboxUrl} />
                            <div
                              className={`flex items-center gap-1 mt-1 text-[10px] ${
                                m.direction === "out" ? "text-white/80 justify-end" : "text-muted-foreground"
                              }`}
                            >
                              <span>{horaCurta(m.wa_timestamp)}</span>
                              {m.direction === "out" && <StatusIcon status={m.status} />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t border-border">
              {!conversaSelecionada.window_open ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg px-3 py-3">
                  <Lock className="w-4 h-4 shrink-0" />
                  Janela de 24h fechada — o cliente precisa mandar uma nova mensagem antes que você possa responder livremente.
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Digite uma mensagem..."
                    rows={1}
                    className="bg-input-background resize-none min-h-10 max-h-32"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={isSending || !draft.trim()}
                    className="bg-accent hover:bg-accent/90 text-white cursor-pointer shrink-0"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Lightbox: amplia a imagem clicada sem sair da página */}
      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-2 bg-transparent border-none shadow-none">
          <DialogTitle className="sr-only">Imagem ampliada</DialogTitle>
          {lightboxUrl && (
            <img src={lightboxUrl} alt="Imagem ampliada" className="w-full max-h-[85vh] object-contain rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
