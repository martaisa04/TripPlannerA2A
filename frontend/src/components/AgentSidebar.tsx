import type { AgentDef, AgentId } from '../types';
import s from './AgentSidebar.module.css';

export const AGENTS: AgentDef[] = [
  {
    id: 'orchestrator',
    name: 'TripBot',
    role: 'Coordinador de viajes',
    description: 'Tu asesor principal. Busca vuelos, consulta el clima y gestiona reservas en una sola conversación.',
    avatar: '🧭',
    color: '#1a56db',
    gradient: 'linear-gradient(135deg,#1a56db 0%,#3b82f6 100%)',
    online: true,
    capabilities: ['Vuelos', 'Clima', 'Reservas', 'Recomendaciones'],
  },
  {
    id: 'flights',
    name: 'FlyBot',
    role: 'Especialista en vuelos',
    description: 'Busca las mejores opciones de vuelo en tiempo real. Compara aerolíneas, horarios y precios reales.',
    avatar: '✈️',
    color: '#7c3aed',
    gradient: 'linear-gradient(135deg,#7c3aed 0%,#a78bfa 100%)',
    online: true,
    capabilities: ['Búsqueda de vuelos', 'Comparar precios', 'Alternativas'],
  },
  {
    id: 'weather',
    name: 'WeatherBot',
    role: 'Experto en clima',
    description: 'Consulta el pronóstico real para cualquier destino. Te ayuda a elegir la mejor fecha para viajar.',
    avatar: '🌤️',
    color: '#059669',
    gradient: 'linear-gradient(135deg,#059669 0%,#34d399 100%)',
    online: true,
    capabilities: ['Pronóstico', 'Mejor época', 'Clima por ciudad'],
  },
  {
    id: 'reservations',
    name: 'ReservaBot',
    role: 'Gestor de reservas',
    description: 'Administra todas tus reservas. Crea, consulta y cancela con solo pedírselo.',
    avatar: '📋',
    color: '#d97706',
    gradient: 'linear-gradient(135deg,#d97706 0%,#fbbf24 100%)',
    online: true,
    capabilities: ['Crear reserva', 'Mis viajes', 'Cancelar'],
  },
];

interface Props {
  onChat: (agent: AgentDef) => void;
  activeAgentId?: AgentId;
}

export default function AgentSidebar({ onChat, activeAgentId }: Props) {
  return (
    <aside className={s.sidebar}>
      <div className={s.header}>
        <span className={s.headerIcon}>🤖</span>
        <div>
          <div className={s.headerTitle}>Asesores IA</div>
          <div className={s.headerSub}>4 agentes disponibles</div>
        </div>
      </div>

      <div className={s.list}>
        {AGENTS.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isActive={activeAgentId === agent.id}
            onChat={() => onChat(agent)}
          />
        ))}
      </div>

      <div className={s.footer}>
        <span className={s.footerDot} />
        Powered by Amazon Bedrock
      </div>
    </aside>
  );
}

function AgentCard({
  agent,
  isActive,
  onChat,
}: {
  agent: AgentDef;
  isActive: boolean;
  onChat: () => void;
}) {
  return (
    <div className={`${s.card} ${isActive ? s.cardActive : ''}`}>
      <div className={s.cardTop}>
        <div className={s.avatarWrap} style={{ background: agent.gradient }}>
          <span className={s.avatar}>{agent.avatar}</span>
          <span className={s.onlineDot} />
        </div>
        <div className={s.info}>
          <div className={s.name}>{agent.name}</div>
          <div className={s.role}>{agent.role}</div>
        </div>
      </div>

      <p className={s.desc}>{agent.description}</p>

      <div className={s.caps}>
        {agent.capabilities.map((c) => (
          <span key={c} className={s.cap} style={{ color: agent.color, borderColor: agent.color + '33', background: agent.color + '11' }}>
            {c}
          </span>
        ))}
      </div>

      <button
        className={s.chatBtn}
        style={{ background: agent.gradient }}
        onClick={onChat}
      >
        Conversar →
      </button>
    </div>
  );
}
