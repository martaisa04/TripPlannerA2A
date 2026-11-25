import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { invokeOrchestrator } from '../api/orchestrator';
import type { ChatMessage } from '../types';
import styles from './ChatPanel.module.css';

const DEFAULT_USER_ID = (import.meta.env.VITE_DEFAULT_USER_ID as string) ?? 'default-user';

function generateId() {
  return Math.random().toString(36).slice(2);
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '¡Hola! Soy tu asistente de viajes. Puedo ayudarte a **buscar vuelos**, **consultar el clima** y **gestionar tus reservas**.\n\nAlgunos ejemplos:\n- *"Busca vuelos de Bogotá a Madrid para el 15 de diciembre"*\n- *"¿Cómo estará el clima en Barcelona el 20 de diciembre?"*\n- *"Muéstrame mis reservas activas"*\n- *"Quiero cancelar mi reserva TRP-A1B2C3D4"*',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const loadingMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await invokeOrchestrator(text, DEFAULT_USER_ID);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: response, isLoading: false }
            : m,
        ),
      );
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'Error desconocido';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? {
                ...m,
                content: `❌ **Error al contactar al agente:**\n\n${errorText}`,
                isLoading: false,
              }
            : m,
        ),
      );
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.messages}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${msg.role === 'user' ? styles.user : styles.assistant}`}
          >
            <div className={styles.bubble}>
              {msg.isLoading ? (
                <span className={styles.typing}>
                  <span /><span /><span />
                </span>
              ) : (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              )}
            </div>
            <span className={styles.time}>
              {msg.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputArea}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu consulta... (Enter para enviar, Shift+Enter para nueva línea)"
          rows={1}
          disabled={isLoading}
        />
        <button
          className={styles.sendBtn}
          onClick={() => void handleSend()}
          disabled={!input.trim() || isLoading}
          aria-label="Enviar"
        >
          {isLoading ? <Loader2 size={18} className={styles.spin} /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
