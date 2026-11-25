import { useState } from 'react';
import { Plane, ArrowLeftRight, Calendar, Users, Search } from 'lucide-react';
import type { SearchContext } from '../types';
import s from './HeroSearch.module.css';

/* Popular Colombian + international routes */
const CITIES = [
  { code: 'BOG', label: 'Bogotá', country: 'Colombia' },
  { code: 'MDE', label: 'Medellín', country: 'Colombia' },
  { code: 'CLO', label: 'Cali', country: 'Colombia' },
  { code: 'CTG', label: 'Cartagena', country: 'Colombia' },
  { code: 'SMR', label: 'Santa Marta', country: 'Colombia' },
  { code: 'ADZ', label: 'San Andrés', country: 'Colombia' },
  { code: 'BAQ', label: 'Barranquilla', country: 'Colombia' },
  { code: 'PEI', label: 'Pereira', country: 'Colombia' },
  { code: 'BGA', label: 'Bucaramanga', country: 'Colombia' },
  { code: 'MAD', label: 'Madrid', country: 'España' },
  { code: 'MIA', label: 'Miami', country: 'EE.UU.' },
  { code: 'CUN', label: 'Cancún', country: 'México' },
  { code: 'LIM', label: 'Lima', country: 'Perú' },
  { code: 'GRU', label: 'São Paulo', country: 'Brasil' },
  { code: 'EZE', label: 'Buenos Aires', country: 'Argentina' },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  onSearch: (ctx: SearchContext) => void;
  initialContext?: Partial<SearchContext>;
}

export default function HeroSearch({ onSearch, initialContext }: Props) {
  const [tripType, setTripType] = useState<'oneway' | 'roundtrip'>(initialContext?.tripType ?? 'oneway');
  const [origin, setOrigin] = useState(initialContext?.origin ?? 'BOG');
  const [destination, setDestination] = useState(initialContext?.destination ?? '');
  const [depDate, setDepDate] = useState(initialContext?.departureDate ?? today());
  const [retDate, setRetDate] = useState(initialContext?.returnDate ?? '');
  const [passengers, setPassengers] = useState(initialContext?.passengers ?? 1);
  const [originQ, setOriginQ] = useState('');
  const [destQ, setDestQ] = useState('');
  const [showOriginDrop, setShowOriginDrop] = useState(false);
  const [showDestDrop, setShowDestDrop] = useState(false);

  const originCity = CITIES.find(c => c.code === origin);
  const destCity = CITIES.find(c => c.code === destination);

  const filteredOrigin = CITIES.filter(c =>
    c.code !== destination &&
    (c.label.toLowerCase().includes(originQ.toLowerCase()) || c.code.toLowerCase().includes(originQ.toLowerCase()))
  );
  const filteredDest = CITIES.filter(c =>
    c.code !== origin &&
    (c.label.toLowerCase().includes(destQ.toLowerCase()) || c.code.toLowerCase().includes(destQ.toLowerCase()))
  );

  function swap() {
    const tmp = origin; setOrigin(destination); setDestination(tmp);
  }

  function handleSearch() {
    if (!origin || !destination || !depDate) return;
    const originCity = CITIES.find(c => c.code === origin);
    const destCity = CITIES.find(c => c.code === destination);
    onSearch({
      origin,
      originLabel: originCity ? `${originCity.label} (${origin})` : origin,
      destination,
      destinationLabel: destCity ? `${destCity.label} (${destination})` : destination,
      departureDate: depDate,
      returnDate: tripType === 'roundtrip' ? retDate : undefined,
      passengers,
      tripType,
    });
  }

  return (
    <div className={s.hero}>
      {/* Background */}
      <div className={s.heroBg}>
        <img
          src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1600&q=80&auto=format&fit=crop"
          alt="Avión en vuelo"
          className={s.heroBgImg}
        />
        <div className={s.heroBgOverlay} />
      </div>

      {/* Content */}
      <div className={s.heroContent}>
        <h1 className={s.heroTitle}>¿A dónde quieres viajar?</h1>
        <p className={s.heroSub}>Busca, compara y reserva tus vuelos con la ayuda de tus agentes IA</p>

        {/* Search box */}
        <div className={s.box}>
          {/* Trip type */}
          <div className={s.tripType}>
            {(['oneway', 'roundtrip'] as const).map(t => (
              <button
                key={t}
                className={`${s.tripBtn} ${tripType === t ? s.tripActive : ''}`}
                onClick={() => setTripType(t)}
              >
                {t === 'oneway' ? 'Solo ida' : 'Ida y vuelta'}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div className={s.fields}>
            {/* Origin */}
            <div className={s.fieldWrap}>
              <label className={s.fieldLabel}><Plane size={13} /> Origen</label>
              <div className={s.fieldInner} onClick={() => { setShowOriginDrop(true); setOriginQ(''); }}>
                <div className={s.cityCode}>{origin || '---'}</div>
                <div className={s.cityName}>{originCity ? originCity.label : 'Seleccionar'}</div>
              </div>
              {showOriginDrop && (
                <CityDropdown
                  query={originQ}
                  onQuery={setOriginQ}
                  cities={filteredOrigin}
                  onSelect={c => { setOrigin(c.code); setShowOriginDrop(false); }}
                  onClose={() => setShowOriginDrop(false)}
                />
              )}
            </div>

            {/* Swap */}
            <button className={s.swapBtn} onClick={swap} title="Intercambiar origen y destino">
              <ArrowLeftRight size={16} />
            </button>

            {/* Destination */}
            <div className={s.fieldWrap}>
              <label className={s.fieldLabel}><Plane size={13} style={{ transform: 'scaleX(-1)' }} /> Destino</label>
              <div className={s.fieldInner} onClick={() => { setShowDestDrop(true); setDestQ(''); }}>
                <div className={s.cityCode}>{destination || '---'}</div>
                <div className={s.cityName}>{destCity ? destCity.label : 'Seleccionar'}</div>
              </div>
              {showDestDrop && (
                <CityDropdown
                  query={destQ}
                  onQuery={setDestQ}
                  cities={filteredDest}
                  onSelect={c => { setDestination(c.code); setShowDestDrop(false); }}
                  onClose={() => setShowDestDrop(false)}
                />
              )}
            </div>

            {/* Departure */}
            <div className={s.fieldWrap}>
              <label className={s.fieldLabel}><Calendar size={13} /> Ida</label>
              <input
                type="date"
                className={s.dateInput}
                value={depDate}
                min={today()}
                onChange={e => setDepDate(e.target.value)}
              />
            </div>

            {/* Return */}
            {tripType === 'roundtrip' && (
              <div className={s.fieldWrap}>
                <label className={s.fieldLabel}><Calendar size={13} /> Vuelta</label>
                <input
                  type="date"
                  className={s.dateInput}
                  value={retDate}
                  min={depDate}
                  onChange={e => setRetDate(e.target.value)}
                />
              </div>
            )}

            {/* Passengers */}
            <div className={s.fieldWrap}>
              <label className={s.fieldLabel}><Users size={13} /> Pasajeros</label>
              <div className={s.passField}>
                <button className={s.passBtn} onClick={() => setPassengers(p => Math.max(1, p - 1))}>−</button>
                <span className={s.passNum}>{passengers}</span>
                <button className={s.passBtn} onClick={() => setPassengers(p => Math.min(9, p + 1))}>+</button>
              </div>
            </div>

            {/* Search button */}
            <button
              className={s.searchBtn}
              onClick={handleSearch}
              disabled={!origin || !destination || !depDate}
            >
              <Search size={18} />
              Buscar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CityDropdown({
  query, onQuery, cities, onSelect, onClose,
}: {
  query: string;
  onQuery: (q: string) => void;
  cities: typeof CITIES;
  onSelect: (c: typeof CITIES[0]) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className={s.dropOverlay} onClick={onClose} />
      <div className={s.dropdown}>
        <input
          autoFocus
          className={s.dropSearch}
          placeholder="Buscar ciudad o aeropuerto…"
          value={query}
          onChange={e => onQuery(e.target.value)}
        />
        <div className={s.dropList}>
          {cities.slice(0, 8).map(c => (
            <button key={c.code} className={s.dropItem} onClick={() => onSelect(c)}>
              <span className={s.dropCode}>{c.code}</span>
              <span className={s.dropLabel}>{c.label}</span>
              <span className={s.dropCountry}>{c.country}</span>
            </button>
          ))}
          {cities.length === 0 && <div className={s.dropEmpty}>Sin resultados</div>}
        </div>
      </div>
    </>
  );
}
