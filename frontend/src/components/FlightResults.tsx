import { useState } from 'react';
import { Plane, Clock, Layers, ExternalLink, Loader2, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { invokeOrchestrator } from '../api/orchestrator';
import type { SearchContext, FlightResult } from '../types';
import s from './FlightResults.module.css';

const USER_ID = import.meta.env.VITE_DEFAULT_USER_ID ?? 'default-user';

/** Parse raw markdown/text reply from FlightsAgent into FlightResult cards.
 *  Falls back gracefully if parsing fails — shows raw text. */
function parseFlights(raw: string, ctx: SearchContext): FlightResult[] {
  const results: FlightResult[] = [];

  // Try to extract table rows: | Airline | Flight | Depart | Arrive | Dur | Stops | Price | URL |
  const tableRowRe = /\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/g;
  let m;
  let idx = 0;
  while ((m = tableRowRe.exec(raw)) !== null) {
    const [, airline, flightNum, dep, arr, dur, stopsRaw, priceRaw] = m;
    if (airline.toLowerCase().includes('aerol') || airline.toLowerCase() === 'vuelo') continue;
    const stops = stopsRaw.includes('directo') || stopsRaw === '0' ? 0 : parseInt(stopsRaw) || 1;
    const priceNum = parseFloat(priceRaw?.replace(/[^0-9.]/g, '')) || undefined;
    results.push({
      id: `f${idx++}`,
      airline: airline.trim(),
      flightNumber: flightNum.trim() || undefined,
      origin: ctx.origin,
      destination: ctx.destination,
      departureDate: ctx.departureDate,
      departureTime: dep.trim() || undefined,
      arrivalTime: arr.trim() || undefined,
      duration: dur.trim() || undefined,
      stops,
      price: priceNum,
      currency: priceRaw?.includes('USD') ? 'USD' : 'COP',
    });
  }

  return results;
}

interface Props {
  ctx: SearchContext;
  agentReply: string;
  isLoading: boolean;
  onNoResults: () => void;
  onBook: () => void;
}

export default function FlightResults({ ctx, agentReply, isLoading, onNoResults, onBook }: Props) {
  const flights = parseFlights(agentReply, ctx);
  const hasNoResults =
    !isLoading &&
    agentReply &&
    flights.length === 0 &&
    (agentReply.toLowerCase().includes('no encontr') ||
      agentReply.toLowerCase().includes('no hay vuelos') ||
      agentReply.toLowerCase().includes('sin resultado'));

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <div>
          <h2 className={s.title}>
            {ctx.originLabel} → {ctx.destinationLabel}
          </h2>
          <p className={s.sub}>{ctx.departureDate} · {ctx.passengers} pasajero{ctx.passengers > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className={s.loading}>
          <Loader2 size={28} className="spin" />
          <p>Consultando vuelos en tiempo real…</p>
        </div>
      )}

      {/* Parsed flight cards */}
      {!isLoading && flights.length > 0 && (
        <div className={s.list}>
          {flights.map(f => (
            <FlightCard key={f.id} flight={f} onBook={() => onBook()} />
          ))}
        </div>
      )}

      {/* Raw markdown fallback when reply exists but no structured cards */}
      {!isLoading && agentReply && flights.length === 0 && !hasNoResults && (
        <div className={s.rawReply}>
          <ReactMarkdown>{agentReply}</ReactMarkdown>
        </div>
      )}

      {/* No results */}
      {hasNoResults && (
        <div className={s.noResults}>
          <span className={s.noIcon}>😔</span>
          <h3>No encontramos vuelos disponibles</h3>
          <p>No hay vuelos de <strong>{ctx.originLabel}</strong> a <strong>{ctx.destinationLabel}</strong> para el <strong>{ctx.departureDate}</strong>.</p>
          <p>Pero no te preocupes, tenemos alternativas que pueden gustarte.</p>
          <button className="btn-orange" onClick={onNoResults}>
            Ver destinos alternativos →
          </button>
        </div>
      )}
    </div>
  );
}

function FlightCard({ flight: f, onBook }: { flight: FlightResult; onBook: () => void }) {
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);

  async function handleBook() {
    setBooking(true);
    try {
      const prompt = `Crea una reserva simulada para el vuelo ${f.airline}${f.flightNumber ? ' ' + f.flightNumber : ''} de ${f.origin} a ${f.destination} el ${f.departureDate}${f.price ? ' con precio ' + f.price + ' ' + (f.currency ?? 'COP') : ''}. userId: ${import.meta.env.VITE_DEFAULT_USER_ID ?? 'default-user'}.`;
      await invokeOrchestrator(prompt, USER_ID);
      setBooked(true);
      onBook();
    } catch {
      // silent — user can retry
    } finally {
      setBooking(false);
    }
  }

  return (
    <div className={`${s.card} fade-up`}>
      <div className={s.cardLeft}>
        <div className={s.airline}>
          <span className={s.airlineIcon}>✈</span>
          <div>
            <div className={s.airlineName}>{f.airline}</div>
            {f.flightNumber && <div className={s.flightNum}>{f.flightNumber}</div>}
          </div>
        </div>
      </div>

      <div className={s.cardMid}>
        <div className={s.route}>
          <div className={s.routePoint}>
            <div className={s.time}>{f.departureTime ?? '—'}</div>
            <div className={s.airport}>{f.origin}</div>
          </div>
          <div className={s.routeLine}>
            <div className={s.routeDot} />
            <div className={s.routeBar} />
            <Plane size={14} className={s.routePlane} />
            <div className={s.routeBar} />
            <div className={s.routeDot} />
          </div>
          <div className={s.routePoint}>
            <div className={s.time}>{f.arrivalTime ?? '—'}</div>
            <div className={s.airport}>{f.destination}</div>
          </div>
        </div>
        <div className={s.meta}>
          {f.duration && <span><Clock size={12} /> {f.duration}</span>}
          <span><Layers size={12} /> {f.stops === 0 ? 'Directo' : `${f.stops} escala${f.stops > 1 ? 's' : ''}`}</span>
        </div>
      </div>

      <div className={s.cardRight}>
        {f.price ? (
          <>
            <div className={s.price}>{f.price.toLocaleString('es-CO')}</div>
            <div className={s.priceSub}>{f.currency ?? 'COP'} / persona</div>
          </>
        ) : (
          <div className={s.priceNA}>Consultar precio</div>
        )}
        <div className={s.actions}>
          {f.bookingUrl && (
            <a href={f.bookingUrl} target="_blank" rel="noopener noreferrer" className={s.externalBtn}>
              <ExternalLink size={13} /> Ver oferta
            </a>
          )}
          <button
            className={`${s.bookBtn} ${booked ? s.bookBtnBooked : ''}`}
            onClick={handleBook}
            disabled={booking || booked}
          >
            {booking ? <Loader2 size={13} className="spin" /> : booked ? <><CheckCircle size={13} /> Reservado</> : 'Reservar'}
          </button>
        </div>
      </div>
    </div>
  );
}
