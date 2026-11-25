/* ── Reservations ───────────────────────────────────────────────── */
export interface Reservation {
  reservationId: string;
  userId: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  airline: string;
  flightNumber?: string;
  price: string;
  currency: string;
  passengers: number;
  status: 'ACTIVE' | 'CANCELLED';
  bookingUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
}

/* ── Chat ───────────────────────────────────────────────────────── */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

/* ── Flights ────────────────────────────────────────────────────── */
export interface FlightResult {
  id: string;
  airline: string;
  flightNumber?: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  stops: number;
  price?: number;
  currency?: string;
  bookingUrl?: string;
  raw?: Record<string, unknown>;
}

/* ── Search ─────────────────────────────────────────────────────── */
export interface SearchContext {
  origin: string;
  originLabel: string;
  destination: string;
  destinationLabel: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  tripType: 'oneway' | 'roundtrip';
}

/* ── Agents ─────────────────────────────────────────────────────── */
export type AgentId = 'orchestrator' | 'flights' | 'weather' | 'reservations';

export interface AgentDef {
  id: AgentId;
  name: string;
  role: string;
  description: string;
  avatar: string;       // emoji
  color: string;        // CSS color
  gradient: string;     // CSS gradient for card
  online: boolean;
  capabilities: string[];
}

/* ── UI state ───────────────────────────────────────────────────── */
export type MainView = 'home' | 'results' | 'reservations';

export interface InvokePayload {
  prompt: string;
  actor_id?: string;
}

export interface InvokeResponse {
  response?: string;
  error?: string;
}

/* ── Alternative destinations ───────────────────────────────────── */
export interface AlternativeDestination {
  code: string;        // IATA or city code
  name: string;
  country: string;
  description: string;
  imageUrl: string;
  tags: string[];      // e.g. ['Playa', 'Sol', 'Cultura']
  originCode: string;  // departure city to pre-fill search
}
