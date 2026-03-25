"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Search,
  MessageSquare,
  ArrowLeft,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "../_context/user-context";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Participant {
  id: string;
  fullName: string;
  initials: string;
  avatarUrl: string | null;
}

interface ConversationItem {
  id: string;
  subject: string | null;
  updatedAt: string;
  participant: Participant;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHr < 24) return `hace ${diffHr} h`;
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays} días`;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return time;
  if (isYesterday) return `Ayer ${time}`;
  return `${date.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} ${time}`;
}

function getInitials(firstName: string, lastName: string): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  return (firstName || lastName || "??").slice(0, 2).toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MensajesPage() {
  const { user } = useUser();
  const supabase = createClient();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // New conversation modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newConvEmail, setNewConvEmail] = useState("");
  const [newConvSubject, setNewConvSubject] = useState("");
  const [newConvError, setNewConvError] = useState("");
  const [creatingConv, setCreatingConv] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  /* ---------------------------------------------------------------- */
  /*  Auto-scroll                                                      */
  /* ---------------------------------------------------------------- */

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /* ---------------------------------------------------------------- */
  /*  Fetch conversations                                              */
  /* ---------------------------------------------------------------- */

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    const { data: participantRows, error: partErr } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (partErr || !participantRows?.length) {
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    const convIds = participantRows.map((r) => r.conversation_id);

    // Fetch conversation metadata
    const { data: convRows } = await supabase
      .from("conversations")
      .select("id, subject, created_at, updated_at")
      .in("id", convIds)
      .order("updated_at", { ascending: false });

    if (!convRows?.length) {
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    // For each conversation, get other participants, last message, and unread count
    const items: ConversationItem[] = [];

    for (const conv of convRows) {
      // Other participants
      const { data: otherParts } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conv.id)
        .neq("user_id", user.id);

      let participant: Participant = {
        id: "",
        fullName: "Usuario",
        initials: "??",
        avatarUrl: null,
      };

      if (otherParts?.length) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, avatar_url")
          .eq("id", otherParts[0]!.user_id)
          .maybeSingle();

        if (profile) {
          const firstName = profile.first_name ?? "";
          const lastName = profile.last_name ?? "";
          participant = {
            id: profile.id,
            fullName: `${firstName} ${lastName}`.trim() || "Usuario",
            initials: getInitials(firstName, lastName),
            avatarUrl: profile.avatar_url ?? null,
          };
        }
      }

      // Last message
      const { data: lastMsgRows } = await supabase
        .from("messages")
        .select("content, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const lastMsg = lastMsgRows?.[0] ?? null;

      // Unread count
      const { count: unreadCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conv.id)
        .neq("sender_id", user.id)
        .eq("is_read", false);

      items.push({
        id: conv.id,
        subject: conv.subject,
        updatedAt: conv.updated_at,
        participant,
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: lastMsg?.created_at ?? null,
        unreadCount: unreadCount ?? 0,
      });
    }

    setConversations(items);
    setLoadingConversations(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  /* ---------------------------------------------------------------- */
  /*  Fetch messages for selected conversation                         */
  /* ---------------------------------------------------------------- */

  const fetchMessages = useCallback(
    async (conversationId: string) => {
      if (!user) return;
      setLoadingMessages(true);

      const { data } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, is_read, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      setMessages(
        (data ?? []).map((m) => ({
          id: m.id,
          conversationId: m.conversation_id,
          senderId: m.sender_id,
          content: m.content,
          createdAt: m.created_at,
          isRead: m.is_read,
        }))
      );
      setLoadingMessages(false);

      // Mark unread messages as read
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id)
        .eq("is_read", false);

      // Update local unread count
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        )
      );
    },
    [user, supabase]
  );

  useEffect(() => {
    if (selectedId) fetchMessages(selectedId);
  }, [selectedId, fetchMessages]);

  /* ---------------------------------------------------------------- */
  /*  Real-time subscription                                           */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!user || conversations.length === 0) return;

    const convIds = conversations.map((c) => c.id);

    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMsg = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            content: string;
            is_read: boolean;
            created_at: string;
          };

          if (!convIds.includes(newMsg.conversation_id)) return;

          // If we're viewing this conversation, add message and mark read
          if (newMsg.conversation_id === selectedId) {
            setMessages((prev) => [
              ...prev,
              {
                id: newMsg.id,
                conversationId: newMsg.conversation_id,
                senderId: newMsg.sender_id,
                content: newMsg.content,
                createdAt: newMsg.created_at,
                isRead: newMsg.is_read,
              },
            ]);

            if (newMsg.sender_id !== user.id) {
              supabase
                .from("messages")
                .update({ is_read: true })
                .eq("id", newMsg.id)
                .then();
            }
          }

          // Update conversation list preview
          setConversations((prev) =>
            prev.map((c) =>
              c.id === newMsg.conversation_id
                ? {
                    ...c,
                    lastMessage: newMsg.content,
                    lastMessageAt: newMsg.created_at,
                    updatedAt: newMsg.created_at,
                    unreadCount:
                      newMsg.sender_id !== user.id &&
                      newMsg.conversation_id !== selectedId
                        ? c.unreadCount + 1
                        : c.unreadCount,
                  }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, conversations.length, selectedId, supabase]);

  /* ---------------------------------------------------------------- */
  /*  Send message                                                     */
  /* ---------------------------------------------------------------- */

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedId || !user || sendingMessage) return;

    const content = newMessage.trim();
    setNewMessage("");
    setSendingMessage(true);

    const { error } = await supabase.from("messages").insert({
      conversation_id: selectedId,
      sender_id: user.id,
      content,
    });

    if (error) {
      setNewMessage(content); // restore on failure
    } else {
      // Update conversation updated_at
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedId);
    }

    setSendingMessage(false);
  };

  /* ---------------------------------------------------------------- */
  /*  New conversation                                                 */
  /* ---------------------------------------------------------------- */

  const handleCreateConversation = async () => {
    if (!user || !newConvEmail.trim()) return;
    setNewConvError("");
    setCreatingConv(true);

    // Find user by email
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .eq("email", newConvEmail.trim().toLowerCase())
      .maybeSingle();

    if (!targetProfile) {
      // Try auth users via profile email match — fallback: search by id won't help,
      // so we'll also try matching the email in auth metadata isn't accessible.
      // Let's check if there's an email column in profiles:
      const { data: altProfile } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .ilike("email", newConvEmail.trim())
        .maybeSingle();

      if (!altProfile) {
        setNewConvError("No se encontró un usuario con ese correo electrónico.");
        setCreatingConv(false);
        return;
      }

      await createConversationWith(altProfile);
      return;
    }

    await createConversationWith(targetProfile);
  };

  const createConversationWith = async (targetProfile: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  }) => {
    if (!user) return;

    if (targetProfile.id === user.id) {
      setNewConvError("No puedes iniciar una conversación contigo mismo.");
      setCreatingConv(false);
      return;
    }

    // Check if conversation already exists between these two users
    const { data: existingParticipations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (existingParticipations?.length) {
      for (const ep of existingParticipations) {
        const { data: otherPart } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", ep.conversation_id)
          .eq("user_id", targetProfile.id)
          .maybeSingle();

        if (otherPart) {
          // Conversation already exists — select it
          setSelectedId(ep.conversation_id);
          setMobileShowChat(true);
          setShowNewModal(false);
          setNewConvEmail("");
          setNewConvSubject("");
          setCreatingConv(false);
          return;
        }
      }
    }

    // Create new conversation
    const { data: newConv, error: convErr } = await supabase
      .from("conversations")
      .insert({
        subject: newConvSubject.trim() || null,
      })
      .select("id")
      .single();

    if (convErr || !newConv) {
      setNewConvError("Error al crear la conversación. Inténtalo de nuevo.");
      setCreatingConv(false);
      return;
    }

    // Add both participants
    const { error: partErr } = await supabase
      .from("conversation_participants")
      .insert([
        { conversation_id: newConv.id, user_id: user.id },
        { conversation_id: newConv.id, user_id: targetProfile.id },
      ]);

    if (partErr) {
      setNewConvError("Error al agregar participantes.");
      setCreatingConv(false);
      return;
    }

    const firstName = targetProfile.first_name ?? "";
    const lastName = targetProfile.last_name ?? "";

    const newItem: ConversationItem = {
      id: newConv.id,
      subject: newConvSubject.trim() || null,
      updatedAt: new Date().toISOString(),
      participant: {
        id: targetProfile.id,
        fullName: `${firstName} ${lastName}`.trim() || "Usuario",
        initials: getInitials(firstName, lastName),
        avatarUrl: targetProfile.avatar_url ?? null,
      },
      lastMessage: null,
      lastMessageAt: null,
      unreadCount: 0,
    };

    setConversations((prev) => [newItem, ...prev]);
    setSelectedId(newConv.id);
    setMobileShowChat(true);
    setShowNewModal(false);
    setNewConvEmail("");
    setNewConvSubject("");
    setCreatingConv(false);
  };

  /* ---------------------------------------------------------------- */
  /*  Filter conversations by search                                   */
  /* ---------------------------------------------------------------- */

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.participant.fullName.toLowerCase().includes(q) ||
      (c.lastMessage?.toLowerCase().includes(q) ?? false) ||
      (c.subject?.toLowerCase().includes(q) ?? false)
    );
  });

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (!user) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
            style={{ fontFamily: "Barlow, Inter, sans-serif" }}
          >
            Mensajes
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Comunícate con tus prospectos y clientes.
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
          style={{
            background:
              "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
          }}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nueva conversación</span>
        </button>
      </div>

      {/* Split Layout */}
      <div className="flex h-[calc(100vh-280px)] min-h-[500px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {/* ========================================================== */}
        {/*  Left: Conversation List                                    */}
        {/* ========================================================== */}
        <div
          className={`w-full flex-shrink-0 border-r border-gray-100 sm:w-80 lg:w-96 ${
            mobileShowChat ? "hidden sm:flex" : "flex"
          } flex-col`}
        >
          {/* Search */}
          <div className="border-b border-gray-100 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar conversación..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 outline-none transition-all duration-300 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <p className="mt-3 text-sm text-gray-400">
                  Cargando conversaciones...
                </p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <MessageSquare className="h-12 w-12 text-gray-200" />
                <p className="mt-4 text-sm font-medium text-gray-500">
                  {searchQuery
                    ? "No se encontraron conversaciones"
                    : "No tienes conversaciones aún"}
                </p>
                {!searchQuery && (
                  <p className="mt-1 text-xs text-gray-400">
                    Inicia una nueva conversación para comenzar.
                  </p>
                )}
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = conv.id === selectedId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setSelectedId(conv.id);
                      setMobileShowChat(true);
                    }}
                    className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-4 text-left transition-colors duration-200 ${
                      isActive ? "bg-blue-50/60" : "hover:bg-gray-50"
                    }`}
                  >
                    {/* Avatar */}
                    {conv.participant.avatarUrl ? (
                      <img
                        src={conv.participant.avatarUrl}
                        alt={conv.participant.fullName}
                        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{
                          background:
                            "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                        }}
                      >
                        {conv.participant.initials}
                      </div>
                    )}

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p
                          className={`text-sm font-semibold truncate ${
                            isActive ? "text-gray-900" : "text-gray-700"
                          }`}
                        >
                          {conv.participant.fullName}
                        </p>
                        <span className="flex-shrink-0 text-xs text-gray-400">
                          {conv.lastMessageAt
                            ? formatTimeAgo(conv.lastMessageAt)
                            : formatTimeAgo(conv.updatedAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between">
                        <p className="text-xs text-gray-500 truncate pr-2">
                          {conv.lastMessage ?? conv.subject ?? "Sin mensajes"}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span
                            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{
                              background:
                                "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                            }}
                          >
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================== */}
        {/*  Right: Chat Panel                                          */}
        {/* ========================================================== */}
        <div
          className={`flex flex-1 flex-col ${
            mobileShowChat ? "flex" : "hidden sm:flex"
          }`}
        >
          {!selected ? (
            /* No conversation selected */
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <MessageSquare className="h-16 w-16 text-gray-200" />
              <p className="mt-4 text-sm font-medium text-gray-500">
                Selecciona una conversación para ver los mensajes
              </p>
              <p className="mt-1 text-xs text-gray-400">
                O inicia una nueva conversación con el botón de arriba.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 sm:px-6">
                <button
                  onClick={() => setMobileShowChat(false)}
                  className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 sm:hidden"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                {selected.participant.avatarUrl ? (
                  <img
                    src={selected.participant.avatarUrl}
                    alt={selected.participant.fullName}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                    }}
                  >
                    {selected.participant.initials}
                  </div>
                )}
                <div>
                  <p
                    className="text-sm font-bold text-gray-900"
                    style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                  >
                    {selected.participant.fullName}
                  </p>
                  {selected.subject && (
                    <p className="text-xs text-gray-400">{selected.subject}</p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto bg-gray-50/50 p-4 sm:p-6"
              >
                {loadingMessages ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    <p className="mt-3 text-sm text-gray-400">
                      Cargando mensajes...
                    </p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <MessageSquare className="h-10 w-10 text-gray-200" />
                    <p className="mt-3 text-sm text-gray-400">
                      No hay mensajes aún. Envía el primero.
                    </p>
                  </div>
                ) : (
                  <div className="mx-auto max-w-2xl space-y-4">
                    {messages.map((msg) => {
                      const isMine = msg.senderId === user.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${
                            isMine ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                              isMine
                                ? "text-white"
                                : "border border-gray-100 bg-white text-gray-700"
                            }`}
                            style={
                              isMine
                                ? {
                                    background:
                                      "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                                  }
                                : undefined
                            }
                          >
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {msg.content}
                            </p>
                            <p
                              className={`mt-1.5 text-right text-[10px] ${
                                isMine ? "text-white/70" : "text-gray-400"
                              }`}
                            >
                              {formatMessageTime(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-gray-100 bg-white p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={sendingMessage}
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none transition-all duration-300 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sendingMessage || !newMessage.trim()}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                    }}
                  >
                    {sendingMessage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  New Conversation Modal                                       */}
      {/* ============================================================ */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                Nueva conversación
              </h3>
              <button
                onClick={() => {
                  setShowNewModal(false);
                  setNewConvEmail("");
                  setNewConvSubject("");
                  setNewConvError("");
                }}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Correo del destinatario
                </label>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={newConvEmail}
                  onChange={(e) => {
                    setNewConvEmail(e.target.value);
                    setNewConvError("");
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none transition-all duration-300 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Asunto{" "}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Consulta sobre propiedad en Polanco"
                  value={newConvSubject}
                  onChange={(e) => setNewConvSubject(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none transition-all duration-300 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {newConvError && (
                <p className="text-sm text-red-500">{newConvError}</p>
              )}

              <button
                onClick={handleCreateConversation}
                disabled={creatingConv || !newConvEmail.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                }}
              >
                {creatingConv ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Iniciar conversación"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
