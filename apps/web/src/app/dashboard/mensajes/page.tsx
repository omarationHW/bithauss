"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Send,
  Search,
  MessageSquare,
  ArrowLeft,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & Mock Data                                                  */
/* ------------------------------------------------------------------ */

interface Message {
  id: number;
  sender: "me" | "them";
  text: string;
  time: string;
}

interface Conversation {
  id: number;
  nombre: string;
  iniciales: string;
  ultimoMensaje: string;
  hora: string;
  sinLeer: number;
  messages: Message[];
}

const conversations: Conversation[] = [
  {
    id: 1,
    nombre: "Ana García López",
    iniciales: "AG",
    ultimoMensaje: "Me interesa agendar una visita al departamento en Polanco.",
    hora: "10:32",
    sinLeer: 2,
    messages: [
      {
        id: 1,
        sender: "them",
        text: "Hola, buenas tardes. Vi el departamento en Polanco de 3 recámaras y me interesa mucho.",
        time: "10:15",
      },
      {
        id: 2,
        sender: "me",
        text: "¡Hola Ana! Claro que sí, es una excelente propiedad. ¿Le gustaría agendar una visita?",
        time: "10:20",
      },
      {
        id: 3,
        sender: "them",
        text: "Sí, por favor. ¿Tendría disponibilidad esta semana?",
        time: "10:25",
      },
      {
        id: 4,
        sender: "me",
        text: "Tengo disponible el jueves a las 11:00 am o el viernes a las 4:00 pm. ¿Cuál le conviene mejor?",
        time: "10:28",
      },
      {
        id: 5,
        sender: "them",
        text: "Me interesa agendar una visita al departamento en Polanco. El jueves a las 11 estaría perfecto.",
        time: "10:32",
      },
    ],
  },
  {
    id: 2,
    nombre: "Roberto Hernández",
    iniciales: "RH",
    ultimoMensaje: "¿Cuál es el precio final de la casa en Coyoacán?",
    hora: "09:45",
    sinLeer: 1,
    messages: [
      {
        id: 1,
        sender: "them",
        text: "Buenos días, quisiera saber más sobre la casa en Coyoacán.",
        time: "09:30",
      },
      {
        id: 2,
        sender: "me",
        text: "Buenos días Roberto. La casa tiene 250m², 4 recámaras, jardín amplio y estacionamiento para 3 autos.",
        time: "09:35",
      },
      {
        id: 3,
        sender: "them",
        text: "¿Cuál es el precio final de la casa en Coyoacán?",
        time: "09:45",
      },
    ],
  },
  {
    id: 3,
    nombre: "María Fernanda Ruiz",
    iniciales: "MR",
    ultimoMensaje: "Perfecto, le envío los documentos del BRC.",
    hora: "Ayer",
    sinLeer: 0,
    messages: [
      {
        id: 1,
        sender: "them",
        text: "Hola, ¿el penthouse en Santa Fe cuenta con certificación BRC?",
        time: "Ayer 14:00",
      },
      {
        id: 2,
        sender: "me",
        text: "Hola María Fernanda. Sí, está en proceso de verificación. En breve tendremos el certificado.",
        time: "Ayer 14:15",
      },
      {
        id: 3,
        sender: "me",
        text: "Perfecto, le envío los documentos del BRC.",
        time: "Ayer 14:20",
      },
    ],
  },
  {
    id: 4,
    nombre: "Jorge Martínez",
    iniciales: "JM",
    ultimoMensaje: "Gracias por la información del local comercial.",
    hora: "Ayer",
    sinLeer: 0,
    messages: [
      {
        id: 1,
        sender: "them",
        text: "Buenas tardes, me interesa el local comercial en Roma Norte para un restaurante.",
        time: "Ayer 11:00",
      },
      {
        id: 2,
        sender: "me",
        text: "¡Hola Jorge! Es una excelente ubicación para restaurante. El local tiene 120m² con terraza.",
        time: "Ayer 11:10",
      },
      {
        id: 3,
        sender: "them",
        text: "Gracias por la información del local comercial.",
        time: "Ayer 11:20",
      },
    ],
  },
  {
    id: 5,
    nombre: "Patricia Díaz",
    iniciales: "PD",
    ultimoMensaje: "¿Aceptan crédito Infonavit?",
    hora: "Lun",
    sinLeer: 3,
    messages: [
      {
        id: 1,
        sender: "them",
        text: "Hola, vi el departamento en la Condesa y me encantó.",
        time: "Lun 16:00",
      },
      {
        id: 2,
        sender: "me",
        text: "¡Hola Patricia! Me da gusto. Es una zona muy demandada. ¿Le gustaría más información?",
        time: "Lun 16:10",
      },
      {
        id: 3,
        sender: "them",
        text: "¿Aceptan crédito Infonavit?",
        time: "Lun 16:15",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MensajesPage() {
  const [selectedId, setSelectedId] = useState(conversations[0]!.id);
  const [newMessage, setNewMessage] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const selected = conversations.find((c) => c.id === selectedId)!;

  const handleSend = () => {
    if (!newMessage.trim()) return;
    // In a real app this would send the message
    setNewMessage("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 outline-none transition-all duration-300 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => {
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
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                    }}
                  >
                    {conv.iniciales}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-sm font-semibold truncate ${
                          isActive ? "text-gray-900" : "text-gray-700"
                        }`}
                      >
                        {conv.nombre}
                      </p>
                      <span className="flex-shrink-0 text-xs text-gray-400">
                        {conv.hora}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <p className="text-xs text-gray-500 truncate pr-2">
                        {conv.ultimoMensaje}
                      </p>
                      {conv.sinLeer > 0 && (
                        <span
                          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{
                            background:
                              "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                          }}
                        >
                          {conv.sinLeer}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
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
          {/* Chat Header */}
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 sm:px-6">
            <button
              onClick={() => setMobileShowChat(false)}
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 sm:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{
                background:
                  "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
              }}
            >
              {selected.iniciales}
            </div>
            <div>
              <p
                className="text-sm font-bold text-gray-900"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                {selected.nombre}
              </p>
              <p className="text-xs text-emerald-500">En línea</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4 sm:p-6">
            <div className="mx-auto max-w-2xl space-y-4">
              {selected.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender === "me" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.sender === "me"
                        ? "text-white"
                        : "border border-gray-100 bg-white text-gray-700"
                    }`}
                    style={
                      msg.sender === "me"
                        ? {
                            background:
                              "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                          }
                        : undefined
                    }
                  >
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    <p
                      className={`mt-1.5 text-right text-[10px] ${
                        msg.sender === "me"
                          ? "text-white/70"
                          : "text-gray-400"
                      }`}
                    >
                      {msg.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 bg-white p-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Escribe un mensaje..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none transition-all duration-300 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
              <button
                onClick={handleSend}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                }}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
