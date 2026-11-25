import { useState } from 'react';
import { Plane, Cloud, Bookmark, ChevronRight, Loader2 } from 'lucide-react';
import { invokeOrchestrator } from '../api/orchestrator';
import type { AlternativeDestination, SearchContext } from '../types';
import s from './AlternativeDestinations.module.css';

const USER_ID = import.meta.env.VITE_DEFAULT_USER_ID ?? 'default-user';

/** Curated alternatives grouped by origin */
const ALTERNATIVES: Record<string, AlternativeDestination[]> = {
  BOG: [
    {
      code: 'CTG', name: 'Cartagena', country: 'Colombia',
      description: 'Ciudad amurallada, playas paradisíacas y arquitectura colonial. Una joya del Caribe colombiano.',
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop',
      tags: ['Playa', 'Historia', 'Caribe'], originCode: 'BOG',
    },
    {
      code: 'ADZ', name: 'San Andrés', country: 'Colombia',
      description: 'El mar de los 7 colores te espera. Buceo, snorkel y playas blancas en el Caribe.',
      imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80&auto=format&fit=crop',
      tags: ['Playa', 'Buceo', 'Paraíso'], originCode: 'BOG',
    },
    {
      code: 'BAQ', name: 'Barranquilla', country: 'Colombia',
      description: 'La capital del Caribe colombiano, famosa por su Carnaval y su gastronomía.',
      imageUrl: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=600&q=80&auto=format&fit=crop',
      tags: ['Cultura', 'Carnaval', 'Gastronomía'], originCode: 'BOG',
    },
    {
      code: 'MDE', name: 'Medellín', country: 'Colombia',
      description: 'La ciudad de la eterna primavera. Innovación, cultura y clima perfecto todo el año.',
      imageUrl: 'https://images.unsplash.com/photo-1570793000283-a4e415b1a5de?w=600&q=80&auto=format&fit=crop',
      tags: ['Cultura', 'Clima', 'Modernidad'], originCode: 'BOG',
    },
  ],
  MDE: [
    {
      code: 'CTG', name: 'Cartagena', country: 'Colombia',
      description: 'Playas del Caribe a poca distancia. Historia y sol garantizados.',
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop',
      tags: ['Playa', 'Historia', 'Caribe'], originCode: 'MDE',
    },
    {
      code: 'BOG', name: 'Bogotá', country: 'Colombia',
      description: 'La vibrante capital colombiana, llena de museos, restaurantes y vida nocturna.',
      imageUrl: 'https://images.unsplash.com/photo-1512813498716-3e640fed3f39?w=600&q=80&auto=format&fit=crop',
      tags: ['Ciudad', 'Cultura', 'Gastronomía'], originCode: 'MDE',
    },
  ],
};

const DEFAULT_ALTS: AlternativeDestination[] = [
  {
    code: 'CTG', name: 'Cartagena', country: 'Colombia',
    description: 'Playas del Caribe, ciudad amurallada y clima cálido todo el año.',
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop',
    tags: ['Playa', 'Historia', 'Caribe'], originCode: 'BOG',
  },
  {
    code: 'ADZ', name: 'San Andrés', country: 'Colombia',
    description: 'El paraíso del Caribe colombiano con el famoso mar de 7 colores.',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80&auto=format&fit=crop',
    tags: ['Playa', 'Buceo', 'Paraíso'], originCode: 'BOG',
  },
  {
    code: 'CUN', name: 'Cancún', country: 'México',
    description: 'Playas blancas, ruinas mayas y vida nocturna inigualable.',
    imageUrl: 'https://images.unsplash.com/photo-1552074284-5e88ef1aef18?w=600&q=80&auto=format&fit=crop',
    tags: ['Playa', 'Internacional', 'Todo incluido'], originCode: 'BOG',
  },
];

interface Props {
  failedCtx: SearchContext;
  onSearch: (ctx: SearchContext) => void;
  onAskAgent: (prompt: string) => void;
}

export default function AlternativeDestinations({ failedCtx, onSearch, onAskAgent }: Props) {
  const alts = ALTERNATIVES[failedCtx.origin] ?? DEFAULT_ALTS;
  const [weatherMap, setWeatherMap] = useState<Record<string, string>>({});
  const [loadingWeather, setLoadingWeather] = useState<string | null>(null);

  async function fetchWeather(dest: AlternativeDestination) {
    if (weatherMap[dest.code] || loadingWeather === dest.code) return;
    setLoadingWeather(dest.code);
    try {
      const reply = await invokeOrchestrator(
        `¿Cómo estará el clima en ${dest.name}, ${dest.country} el ${failedCtx.departureDate}? Dame un resumen en 2 líneas máximo.`,
        USER_ID,
      );
      setWeatherMap(p => ({ ...p, [dest.code]: reply }));
    } catch {
      setWeatherMap(p => ({ ...p, [dest.code]: 'No se pudo obtener el pronóstico.' }));
    } finally {
      setLoadingWeather(null);
    }
  }

  function goSearch(dest: AlternativeDestination) {
    onSearch({
      origin: failedCtx.origin,
      originLabel: failedCtx.originLabel,
      destination: dest.code,
      destinationLabel: `${dest.name} (${dest.code})`,
      departureDate: failedCtx.departureDate,
      returnDate: failedCtx.returnDate,
      passengers: failedCtx.passengers,
      tripType: failedCtx.tripType,
    });
  }

  return (
    <div className={s.wrap}>
      <div className={s.banner}>
        <div className={s.bannerIcon}>✨</div>
        <div>
          <h2 className={s.bannerTitle}>¡No encontramos vuelos a {failedCtx.destinationLabel}!</h2>
          <p className={s.bannerSub}>
            Pero no te quedes sin viajar — mira estos destinos que podrían encantarte desde{' '}
            <strong>{failedCtx.originLabel}</strong> para el <strong>{failedCtx.departureDate}</strong>.
          </p>
        </div>
        <button
          className={`${s.askBtn} btn-ghost`}
          onClick={() =>
            onAskAgent(
              `No hay vuelos de ${failedCtx.originLabel} a ${failedCtx.destinationLabel} el ${failedCtx.departureDate}. ¿Qué otros destinos recomiendas para ese origen y fecha?`,
            )
          }
        >
          Preguntarle al agente <ChevronRight size={15} />
        </button>
      </div>

      {/* Alternative suggestions */}
      <div className={s.grid}>
        {alts.map(dest => (
          <DestCard
            key={dest.code}
            dest={dest}
            weather={weatherMap[dest.code]}
            loadingWeather={loadingWeather === dest.code}
            onFetchWeather={() => void fetchWeather(dest)}
            onSearch={() => goSearch(dest)}
            onAskAgent={() =>
              onAskAgent(
                `Busca vuelos de ${failedCtx.originLabel} a ${dest.name} (${dest.code}) el ${failedCtx.departureDate} para ${failedCtx.passengers} pasajero${failedCtx.passengers > 1 ? 's' : ''}.`,
              )
            }
          />
        ))}
      </div>

      {/* Date alternatives */}
      <div className={s.dateAlts}>
        <h3 className={s.dateAltsTitle}>¿Cambiar las fechas?</h3>
        <div className={s.dateAltsList}>
          {[-2, -1, 1, 2, 3].map(delta => {
            const d = new Date(failedCtx.departureDate);
            d.setDate(d.getDate() + delta);
            const dateStr = d.toISOString().slice(0, 10);
            return (
              <button
                key={delta}
                className={s.dateAltBtn}
                onClick={() =>
                  onSearch({ ...failedCtx, departureDate: dateStr })
                }
              >
                {delta < 0 ? `${Math.abs(delta)} día${Math.abs(delta) > 1 ? 's' : ''} antes` : `+${delta} día${delta > 1 ? 's' : ''}`}
                <span className={s.dateAltDate}>{dateStr}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DestCard({
  dest, weather, loadingWeather, onFetchWeather, onSearch, onAskAgent,
}: {
  dest: AlternativeDestination;
  weather?: string;
  loadingWeather: boolean;
  onFetchWeather: () => void;
  onSearch: () => void;
  onAskAgent: () => void;
}) {  return (
    <div className={s.card}>
      <div className={s.imgWrap}>
        <img src={dest.imageUrl} alt={dest.name} className={s.img} loading="lazy" />
        <div className={s.imgOverlay}>
          <div className={s.country}>{dest.country}</div>
          <h3 className={s.destName}>{dest.name}</h3>
        </div>
      </div>
      <div className={s.cardBody}>
        <div className={s.tags}>
          {dest.tags.map(t => <span key={t} className={s.tag}>{t}</span>)}
        </div>
        <p className={s.desc}>{dest.description}</p>

        {/* Weather */}
        {weather ? (
          <div className={s.weather}>
            <Cloud size={13} /> <span>{weather}</span>
          </div>
        ) : (
          <button className={s.weatherBtn} onClick={onFetchWeather} disabled={loadingWeather}>
            {loadingWeather ? <Loader2 size={12} className="spin" /> : <Cloud size={12} />}
            {loadingWeather ? 'Consultando clima…' : 'Ver pronóstico del clima'}
          </button>
        )}

        <div className={s.actions}>
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={onSearch}>
            <Plane size={13} /> Buscar vuelos
          </button>
          <button className={`${s.btn} ${s.btnSecondary}`} onClick={onAskAgent}>
            <Bookmark size={13} /> Explorar con agente
          </button>
        </div>
      </div>
    </div>
  );
}
