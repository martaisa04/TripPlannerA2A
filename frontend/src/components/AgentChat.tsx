import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Minimize2, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { invokeOrchestratorStream } from '../api/orchestrator';
import type { AgentDef, ChatMessage, SearchContext } from '../types';
import s from './AgentChat.module.css';

const USER_ID = import.meta.env.VITE_DEFAULT_USER_ID ?? 'default-user';

function uid() { return Math.random().toString(36).slice(2); }

function buildWelcome(agent: AgentDef, ctx?: SearchContext): string {
  const base = `¡Hola! Soy **${agent.name}**, ${agent.role.toLowerCase()}. ${agent.description}`;
  if (!ctx) return base + '\n\n¿En qué te puedo ayudar hoy?';
  return (
    base +
    `\n\nVeo que estás buscando vuelos de **${ctx.originLabel}** a **${ctx.destinationLabel}** el **${ctx.departureDate}** para ${ctx.passengers} pasajero${ctx.passengers > 1 ? 's' : ''}.\n\n¿Quieres que te ayude con esa búsqueda o tienes alguna otra consulta?`
  );
}

/** Detecta si la respuesta indica que no hubo resultados */
export function detectNoResults(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    (lower.includes('no encontr') || lower.includes('no hay vuelos') || lower.includes('sin resultados') || lower.includes('no se encontraron')) &&
    (lower.includes('vuelo') || lower.includes('disponib'))
  );
}

interface Props {
  agent: AgentDef;
  onClose: () => void;
  searchContext?: SearchContext;
  initialPrompt?: string;
  onNoResults?: (origin: string, destination: string, date: string) => void;
}

export default function AgentChat({ agent, onClose, searchContext, initialPrompt, onNoResults }: Props) {
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', content: buildWelcome(agent, searchContext), timestamp: new Date() },
  ]);
  const [input, setInput] = useState(initialPrompt ?? '');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Auto-send if initialPrompt provided
  useEffect(() => {
    if (initialPrompt) void send(initialPrompt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text: string = input) {
    text = text.trim();
    if (!text || loading) return;
    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text, timestamp: new Date() };
    const loadingMsg: ChatMessage = { id: uid(), role: 'assistant', content: '', timestamp: new Date(), isLoading: true };
    setMessages(p => [...p, userMsg, loadingMsg]);
    setInput('');
    setLoading(true);
    try {
      let accumulated = '';
      let firstChunk = true;

      for await (const chunk of invokeOrchestratorStream(text, USER_ID)) {
        accumulated += chunk;

        // Al llegar el primer chunk, quitar el indicador de carga
        if (firstChunk) {
          firstChunk = false;
          setMessages(p => p.map(m =>
            m.id === loadingMsg.id
              ? { ...m, content: accumulated, isLoading: false }
              : m,
          ));
        } else {
          // Actualizar el contenido con cada chunk adicional
          setMessages(p => p.map(m =>
            m.id === loadingMsg.id
              ? { ...m, content: accumulated }
              : m,
          ));
        }
      }

      // Si no llegó ningún chunk, quitar el indicador
      if (firstChunk) {
        setMessages(p => p.map(m =>
          m.id === loadingMsg.id
            ? { ...m, content: '(sin respuesta)', isLoading: false }
            : m,
        ));
      }

      // Detectar si no hay resultados de vuelos
      if (detectNoResults(accumulated) && searchContext && onNoResults) {
        onNoResults(searchContext.origin, searchContext.destination, searchContext.departureDate);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setMessages(p => p.map(m =>
        m.id === loadingMsg.id
          ? { ...m, content: `❌ ${msg}`, isLoading: false }
          : m,
      ));
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  return (
    <div className={`${s.window} ${minimized ? s.minimized : ''} fade-up`}>
      {/* Header */}
      <div className={s.header} style={{ background: agent.gradient }}>
        <div className={s.headerLeft}>
          <span className={s.avatar}>{agent.avatar}</span>
          <div>
            <div className={s.name}>{agent.name}</div>
            <div className={s.status}>● En línea</div>
          </div>
        </div>
        <div className={s.controls}>
          <button className={s.ctrl} onClick={() => setMinimized(v => !v)} title={minimized ? 'Expandir' : 'Minimizar'}>
            {minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button className={s.ctrl} onClick={onClose} title="Cerrar"><X size={14} /></button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div className={s.messages}>
            {messages.map(msg => (
              <div key={msg.id} className={`${s.msg} ${msg.role === 'user' ? s.user : s.bot}`}>
                {msg.role === 'assistant' && (
                  <span className={s.botAvatar} style={{ background: agent.gradient }}>{agent.avatar}</span>
                )}
                <div className={`${s.bubble} ${msg.role === 'user' ? s.bubbleUser : s.bubbleBot}`}>
                  {msg.isLoading ? (
                    <span className={s.typing}><span /><span /><span /></span>
                  ) : (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className={s.inputRow}>
            <textarea
              ref={textareaRef}
              className={s.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder="Escribe aquí…"
              rows={1}
              disabled={loading}
            />
            <button
              className={s.sendBtn}
              style={{ background: agent.gradient }}
              onClick={() => void send()}
              disabled={!input.trim() || loading}
            >
              {loading ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
