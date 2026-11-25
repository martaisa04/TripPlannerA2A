import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader2, Plane, X, AlertTriangle, CalendarCheck, MapPin, Clock } from 'lucide-react';
import { listReservations, cancelReservation } from '../api/reservations';
import type { Reservation } from '../types';
import s from './ReservationsPanel.module.css';

const DEFAULT_USER_ID = import.meta.env.VITE_DEFAULT_USER_ID ?? 'default-user';

type StatusFilter = 'ALL' | 'ACTIVE' | 'CANCELLED';

export default function ReservationsPanel() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const status = filter === 'ALL' ? undefined : filter;
      const data = await listReservations(DEFAULT_USER_ID, status);
      setReservations(data.reservations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar reservas');
    } finally { setIsLoading(false); }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function handleCancel() {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      const result = await cancelReservation(cancelTarget.reservationId, DEFAULT_USER_ID);
      setReservations(prev => prev.map(r => r.reservationId === cancelTarget.reservationId ? result.reservation : r));
      setSuccessMsg(`Reserva ${cancelTarget.reservationId} cancelada exitosamente.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cancelar');
    } finally { setIsCancelling(false); setCancelTarget(null); }
  }

  const filtered = filter === 'ALL' ? reservations : reservations.filter(r => r.status === filter);
  const activeCount = reservations.filter(r => r.status === 'ACTIVE').length;

  return (
    <div className={s.page}>
      {/* Page header */}
      <div className={s.pageHeader}>
        <div>
          <h2 className={s.pageTitle}>Mis Reservas</h2>
          <p className={s.pageSub}>{activeCount} reserva{activeCount !== 1 ? 's' : ''} activa{activeCount !== 1 ? 's' : ''}</p>
        </div>
        <button className={s.refreshBtn} onClick={() => void load()} disabled={isLoading}>
          {isLoading ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className={s.filters}>
        {(['ALL', 'ACTIVE', 'CANCELLED'] as StatusFilter[]).map(f => (
          <button
            key={f}
            className={`${s.filterBtn} ${filter === f ? s.filterActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'ALL' ? 'Todas' : f === 'ACTIVE' ? '✓ Activas' : '✕ Canceladas'}
          </button>
        ))}
      </div>

      {successMsg && <div className={s.toast}>{successMsg}</div>}
      {error    && <div className={s.error}>{error}</div>}

      {isLoading && reservations.length === 0 ? (
        <div className={s.empty}><Loader2 size={32} className="spin" /><p>Cargando…</p></div>
      ) : filtered.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}><CalendarCheck size={48} /></div>
          <h3>Sin reservas {filter === 'ACTIVE' ? 'activas' : filter === 'CANCELLED' ? 'canceladas' : ''}</h3>
          <p>Busca un vuelo y crea tu primera reserva.</p>
        </div>
      ) : (
        <div className={s.grid}>
          {filtered.map(r => (
            <ReservationCard key={r.reservationId} reservation={r} onCancel={() => setCancelTarget(r)} />
          ))}
        </div>
      )}

      {/* Cancel dialog */}
      {cancelTarget && (
        <div className={s.overlay} onClick={() => setCancelTarget(null)}>
          <div className={s.dialog} onClick={e => e.stopPropagation()}>
            <AlertTriangle size={32} color="var(--warning)" />
            <h3>Cancelar reserva</h3>
            <p>¿Confirmas la cancelación de <strong>{cancelTarget.reservationId}</strong>?</p>
            <div className={s.dialogRoute}>
              <span>{cancelTarget.origin}</span>
              <span>→</span>
              <span>{cancelTarget.destination}</span>
              <span>·</span>
              <span>{cancelTarget.departureDate}</span>
              <span>·</span>
              <span>{cancelTarget.airline}</span>
            </div>
            <p className={s.dialogWarn}>Esta acción no se puede deshacer.</p>
            <div className={s.dialogActions}>
              <button className={s.btnBack} onClick={() => setCancelTarget(null)} disabled={isCancelling}>Volver</button>
              <button className={s.btnCancel} onClick={() => void handleCancel()} disabled={isCancelling}>
                {isCancelling ? <Loader2 size={14} className="spin" /> : <X size={14} />}
                Confirmar cancelación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReservationCard({ reservation: r, onCancel }: { reservation: Reservation; onCancel: () => void }) {
  return (
    <div className={`${s.card} ${r.status === 'CANCELLED' ? s.cardCancelled : ''} fade-up`}>
      {/* Status stripe */}
      <div className={`${s.stripe} ${r.status === 'ACTIVE' ? s.stripeActive : s.stripeCancelled}`} />

      <div className={s.cardInner}>
        {/* Route */}
        <div className={s.routeRow}>
          <div className={s.routeCity}>
            <div className={s.cityCode}>{r.origin}</div>
          </div>
          <div className={s.routeMid}>
            <div className={s.routeLine}>
              <div className={s.routeDot} />
              <div className={s.routeBar} />
              <Plane size={14} className={s.routePlane} />
              <div className={s.routeBar} />
              <div className={s.routeDot} />
            </div>
            <div className={s.airline}>{r.airline}{r.flightNumber && r.flightNumber !== 'N/A' ? ` · ${r.flightNumber}` : ''}</div>
          </div>
          <div className={s.routeCity}>
            <div className={s.cityCode}>{r.destination}</div>
          </div>
        </div>

        {/* Meta */}
        <div className={s.meta}>
          <span><Clock size={12} /> {r.departureDate}</span>
          {r.returnDate && <span><Clock size={12} /> Regreso: {r.returnDate}</span>}
          <span><MapPin size={12} /> {r.passengers} pasajero{r.passengers > 1 ? 's' : ''}</span>
        </div>

        {/* Footer */}
        <div className={s.footer}>
          <div className={s.footerLeft}>
            <span className={`${s.badge} ${r.status === 'ACTIVE' ? s.badgeActive : s.badgeCancelled}`}>
              {r.status === 'ACTIVE' ? 'Activa' : 'Cancelada'}
            </span>
            {r.price && (
              <span className={s.price}>
                {Number(r.price).toLocaleString('es-CO')} {r.currency}
              </span>
            )}
          </div>
          <div className={s.footerRight}>
            <span className={s.resId}>{r.reservationId}</span>
            {r.bookingUrl && (
              <a href={r.bookingUrl} target="_blank" rel="noopener noreferrer" className={s.externalLink}>
                Ver ↗
              </a>
            )}
            {r.status === 'ACTIVE' && (
              <button className={s.cancelBtn} onClick={onCancel}>
                <X size={12} /> Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
