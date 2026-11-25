import { useState } from 'react';
import { CalendarCheck, Home, Menu, X as XIcon } from 'lucide-react';
import HeroSearch from './components/HeroSearch';
import FlightResults from './components/FlightResults';
import AlternativeDestinations from './components/AlternativeDestinations';
import ReservationsPanel from './components/ReservationsPanel';
import AgentSidebar, { AGENTS } from './components/AgentSidebar';
import AgentChat from './components/AgentChat';
import { invokeOrchestrator } from './api/orchestrator';
import type { SearchContext, AgentDef, MainView } from './types';
import s from './App.module.css';

const USER_ID = import.meta.env.VITE_DEFAULT_USER_ID ?? 'default-user';

export default function App() {
  /* ── View state ─────────────────────────────────────────────── */
  const [view, setView] = useState<MainView>('home');
  const [searchCtx, setSearchCtx] = useState<SearchContext | null>(null);
  const [agentReply, setAgentReply] = useState('');
  const [searching, setSearching] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile

  /* ── Active agent chat ──────────────────────────────────────── */
  const [activeAgent, setActiveAgent] = useState<AgentDef | null>(null);
  const [chatInitialPrompt, setChatInitialPrompt] = useState<string | undefined>();

  /* ── Search handler ─────────────────────────────────────────── */
  async function handleSearch(ctx: SearchContext) {
    setSearchCtx(ctx);
    setView('results');
    setShowAlternatives(false);
    setAgentReply('');
    setSearching(true);
    try {
      const prompt = `Busca vuelos de ${ctx.originLabel} a ${ctx.destinationLabel} el ${ctx.departureDate} para ${ctx.passengers} pasajero${ctx.passengers > 1 ? 's' : ''}${ctx.returnDate ? `, con regreso el ${ctx.returnDate}` : ''}. Moneda COP. Presenta los resultados en una tabla con columnas: Aerolínea, Vuelo, Salida, Llegada, Duración, Escalas, Precio. Si no hay vuelos disponibles, dilo claramente.`;
      const reply = await invokeOrchestrator(prompt, USER_ID);
      setAgentReply(reply);
    } catch (err) {
      setAgentReply(`❌ Error al consultar vuelos: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setSearching(false);
    }
  }

  /* ── Open agent chat ────────────────────────────────────────── */
  function openAgent(agent: AgentDef, prompt?: string) {
    setActiveAgent(agent);
    setChatInitialPrompt(prompt);
  }

  /* ── Open orchestrator for alternative destinations ─────────── */
  function askOrchestratorFromAlts(prompt: string) {
    openAgent(AGENTS[0], prompt);
  }

  return (
    <div className={s.root}>
      {/* ── Top Nav ──────────────────────────────────────────── */}
      <header className={s.nav}>
        <div className={s.navLeft}>
          <button className={s.mobileMenu} onClick={() => setSidebarOpen(v => !v)}>
            {sidebarOpen ? <XIcon size={20} /> : <Menu size={20} />}
          </button>
          <div className={s.logo} onClick={() => setView('home')} style={{ cursor: 'pointer' }}>
            <span className={s.logoMark}>✈</span>
            <span className={s.logoText}>TripPlanner</span>
            <span className={s.logoA2A}>A2A</span>
          </div>
        </div>

        <nav className={s.navLinks}>
          <button className={`${s.navLink} ${view === 'home' || view === 'results' ? s.navActive : ''}`} onClick={() => setView('home')}>
            <Home size={15} /> Inicio
          </button>
          <button className={`${s.navLink} ${view === 'reservations' ? s.navActive : ''}`} onClick={() => setView('reservations')}>
            <CalendarCheck size={15} /> Mis Reservas
          </button>
        </nav>

        <div className={s.navRight}>
          <div className={s.agentsBadge} onClick={() => setSidebarOpen(v => !v)}>
            <span className={s.agentsDot} />
            4 agentes activos
          </div>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className={s.body}>
        {/* Mobile sidebar overlay */}
        {sidebarOpen && <div className={s.mobileOverlay} onClick={() => setSidebarOpen(false)} />}

        {/* ── Main area ─────────────────────────────────────── */}
        <main className={s.main}>
          {view === 'home' && (
            <>
              <HeroSearch onSearch={handleSearch} />
              <div className={s.mainContent}>
                <FeaturedDestinations onSearch={handleSearch} />
              </div>
            </>
          )}

          {view === 'results' && searchCtx && (
            <>
              <HeroSearch onSearch={handleSearch} initialContext={searchCtx} />
              <div className={s.mainContent}>
                {!showAlternatives ? (
                  <FlightResults
                    ctx={searchCtx}
                    agentReply={agentReply}
                    isLoading={searching}
                    onNoResults={() => setShowAlternatives(true)}
                    onBook={() => setView('reservations')}
                  />
                ) : (
                  <AlternativeDestinations
                    failedCtx={searchCtx}
                    onSearch={handleSearch}
                    onAskAgent={askOrchestratorFromAlts}
                  />
                )}
              </div>
            </>
          )}

          {view === 'reservations' && (
            <div className={s.mainContent} style={{ paddingTop: 24 }}>
              <ReservationsPanel />
            </div>
          )}
        </main>

        {/* ── Agent Sidebar ──────────────────────────────────── */}
        <div className={`${s.sidebar} ${sidebarOpen ? s.sidebarOpen : ''}`}>
          <AgentSidebar
            onChat={agent => { openAgent(agent); setSidebarOpen(false); }}
            activeAgentId={activeAgent?.id}
          />
        </div>
      </div>

      {/* ── Floating Agent Chat ───────────────────────────────── */}
      {activeAgent && (
        <AgentChat
          agent={activeAgent}
          onClose={() => { setActiveAgent(null); setChatInitialPrompt(undefined); }}
          searchContext={searchCtx ?? undefined}
          initialPrompt={chatInitialPrompt}
          onNoResults={(_o, _d, _date) => setShowAlternatives(true)}
        />
      )}
    </div>
  );
}

/* ── Featured destinations on home ──────────────────────────────── */
const FEATURED = [
  { code: 'CTG', name: 'Cartagena', origin: 'BOG', label: 'Desde Bogotá', img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80&auto=format&fit=crop', tag: 'Caribe' },
  { code: 'ADZ', name: 'San Andrés', origin: 'BOG', label: 'Desde Bogotá', img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&q=80&auto=format&fit=crop', tag: 'Playa' },
  { code: 'MDE', name: 'Medellín', origin: 'BOG', label: 'Desde Bogotá', img: 'https://images.unsplash.com/photo-1570793000283-a4e415b1a5de?w=500&q=80&auto=format&fit=crop', tag: 'Ciudad' },
  { code: 'MIA', name: 'Miami', origin: 'BOG', label: 'Desde Bogotá', img: 'https://images.unsplash.com/photo-1506966953602-c20cc11f75e3?w=500&q=80&auto=format&fit=crop', tag: 'Internacional' },
  { code: 'CUN', name: 'Cancún', origin: 'BOG', label: 'Desde Bogotá', img: 'https://images.unsplash.com/photo-1552074284-5e88ef1aef18?w=500&q=80&auto=format&fit=crop', tag: 'Todo incluido' },
  { code: 'MAD', name: 'Madrid', origin: 'BOG', label: 'Desde Bogotá', img: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=500&q=80&auto=format&fit=crop', tag: 'Europa' },
];

function FeaturedDestinations({ onSearch }: { onSearch: (ctx: SearchContext) => void }) {
  function goSearch(dest: typeof FEATURED[0]) {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 30);
    onSearch({
      origin: dest.origin,
      originLabel: `Bogotá (${dest.origin})`,
      destination: dest.code,
      destinationLabel: `${dest.name} (${dest.code})`,
      departureDate: tomorrow.toISOString().slice(0, 10),
      passengers: 1,
      tripType: 'oneway',
    });
  }

  return (
    <section>
      <div className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>Destinos populares</h2>
        <p className={s.sectionSub}>Los favoritos de nuestros viajeros</p>
      </div>
      <div className={s.destGrid}>
        {FEATURED.map(d => (
          <button key={d.code} className={s.destCard} onClick={() => goSearch(d)}>
            <img src={d.img} alt={d.name} className={s.destImg} loading="lazy" />
            <div className={s.destOverlay}>
              <span className={s.destTag}>{d.tag}</span>
              <div className={s.destInfo}>
                <div className={s.destName}>{d.name}</div>
                <div className={s.destFrom}>{d.label}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
