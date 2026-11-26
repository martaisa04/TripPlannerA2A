/**
 * Cliente para el API Gateway de reservas.
 * Las llamadas van a /api/reservations/* que el proxy de Vite redirige al API Gateway.
 */

import type { Reservation } from '../types';

const BASE = '/api/reservations';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export async function listReservations(userId: string, status?: 'ACTIVE' | 'CANCELLED'): Promise<{ reservations: Reservation[]; count: number }> {
  const params = new URLSearchParams({ userId });
  if (status) params.set('status', status);
  return request(`?${params}`);
}

export async function getReservation(reservationId: string, userId: string): Promise<{ reservation: Reservation }> {
  return request(`/${reservationId}?userId=${encodeURIComponent(userId)}`);
}

export async function cancelReservation(reservationId: string, userId: string): Promise<{ message: string; reservation: Reservation }> {
  return request(`/${reservationId}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ userId }),
  });
}

export interface UpdateReservationPayload {
  userId: string;
  returnDate?: string;
  passengers?: number;
  notes?: string;
  airline?: string;
  flightNumber?: string;
  bookingUrl?: string;
}

export async function updateReservation(
  reservationId: string,
  payload: UpdateReservationPayload,
): Promise<{ message: string; reservation: Reservation }> {
  return request(`/${reservationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
