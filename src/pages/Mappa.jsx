import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import MobileBottomNav from '../components/MobileBottomNav';
import useIsMobile from '../hooks/useIsMobile';
import { addEvent } from '../lib/sharedDataApi';

const initialView = {
  lat: 41.9028,
  lng: 12.4964,
  zoom: 6,
};

const navigationFollowZoom = 17;

const travelModes = [
  { value: 'driving', label: 'Auto' },
  { value: 'walking', label: 'A piedi' },
  { value: 'cycling', label: 'Bici' },
];

const travelModeToProfile = {
  driving: 'driving',
  walking: 'foot',
  cycling: 'bike',
};

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function normalizeRoutePath(path) {
  if (!Array.isArray(path)) return [];
  return path
    .map(point => {
      if (Array.isArray(point) && point.length >= 2) {
        const lat = Number(point[0]);
        const lng = Number(point[1]);
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
      }
      if (point && typeof point === 'object') {
        const lat = Number(point.lat);
        const lng = Number(point.lng);
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
      }
      return null;
    })
    .filter(Boolean);
}

function haversineDistanceKm(a, b) {
  if (!a || !b) return null;
  const toRad = value => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return earthRadiusKm * c;
}

function geolocationErrorMessage(error) {
  const code = error?.code;
  if (code === 1) {
    if (!window.isSecureContext) {
      return 'GPS bloccato: su smartphone il browser richiede HTTPS per la posizione precisa.';
    }
    return 'Permesso posizione negato. Abilita la localizzazione per il browser.';
  }
  if (code === 2) {
    return 'Posizione non disponibile. Verifica GPS/rete e riprova.';
  }
  if (code === 3) {
    return 'Timeout GPS. Sto riprovando...';
  }
  return 'Impossibile aggiornare la posizione durante la navigazione.';
}

function buildStepText(step) {
  const name = step?.name?.trim();
  const street = name ? ` su ${name}` : '';
  const type = step?.maneuver?.type || '';
  const modifier = step?.maneuver?.modifier || '';

  if (type === 'depart') return `Parti${street}`;
  if (type === 'arrive') return 'Arrivo a destinazione';
  if (type === 'roundabout') {
    const exit = step?.maneuver?.exit;
    return exit ? `Entra nella rotonda e prendi l'uscita ${exit}${street}` : `Entra nella rotonda${street}`;
  }
  if (modifier === 'left') return `Svolta a sinistra${street}`;
  if (modifier === 'right') return `Svolta a destra${street}`;
  if (modifier === 'slight left') return `Mantieni la sinistra${street}`;
  if (modifier === 'slight right') return `Mantieni la destra${street}`;
  if (modifier === 'sharp left') return `Svolta bruscamente a sinistra${street}`;
  if (modifier === 'sharp right') return `Svolta bruscamente a destra${street}`;
  return `Continua${street}`;
}

async function reverseGeocode(lat, lng) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
    { headers: { Accept: 'application/json' } },
  );

  if (!response.ok) throw new Error('Reverse geocode non disponibile');

  const data = await response.json();
  return data?.display_name || `Punto selezionato (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
}

async function geocodeSuggestions(query) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/json' } },
  );

  if (!response.ok) throw new Error('Errore ricerca luogo');

  const data = await response.json();
  return (data || []).map(item => ({
    lat: Number(item.lat),
    lng: Number(item.lon),
    label: item.display_name,
  }));
}

function Mappa() {
  const isMobile = useIsMobile();
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const navigationWatchRef = useRef(null);
  const navigationMarkerRef = useRef(null);
  const followNavigationRef = useRef(true);

  const [status, setStatus] = useState('');
  const [startQuery, setStartQuery] = useState('');
  const [stopQuery, setStopQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [stopSuggestions, setStopSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);

  const [currentPosition, setCurrentPosition] = useState(null);
  const [startPosition, setStartPosition] = useState(null);
  const [stopPosition, setStopPosition] = useState(null);
  const [destinationPosition, setDestinationPosition] = useState(null);

  const [routeInfo, setRouteInfo] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [routeLabel, setRouteLabel] = useState('');
  const [directions, setDirections] = useState([]);

  const [travelMode, setTravelMode] = useState('driving');
  const [activeField, setActiveField] = useState('start');
  const [showSearchPanel, setShowSearchPanel] = useState(true);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationDistanceKm, setNavigationDistanceKm] = useState(null);
  const [followNavigation, setFollowNavigation] = useState(true);

  useEffect(() => {
    followNavigationRef.current = followNavigation;
  }, [followNavigation]);

  const [eventForm, setEventForm] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    startTime: '',
    endTime: '',
    note: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function setupMap() {
      if (!mapRef.current || leafletMapRef.current) return;

      const leaflet = await import('leaflet');
      const L = leaflet.default;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
        iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
        shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
      });

      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([initialView.lat, initialView.lng], initialView.zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      leafletMapRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);

      map.on('click', event => {
        void handleMapClick(event.latlng.lat, event.latlng.lng);
      });

      if (!cancelled) {
        setStatus('Cerca una posizione e crea il percorso.');

        const savedRouteRaw = sessionStorage.getItem('mapRoute');
        if (savedRouteRaw) {
          try {
            const savedRoute = JSON.parse(savedRouteRaw);
            sessionStorage.removeItem('mapRoute');

            const normalizedRoute = {
              ...savedRoute,
              path: normalizeRoutePath(savedRoute?.path),
              distanceKm: savedRoute?.distanceKm ?? savedRoute?.distance ?? '',
              durationMin: savedRoute?.durationMin ?? savedRoute?.duration ?? '',
            };

            // Imposta anche gli stati necessari per abilitare i bottoni
            if (savedRoute?.start) {
              setStartPosition(savedRoute.start);
              setStartQuery(savedRoute.start.label || 'Partenza');
            }
            if (savedRoute?.stop) {
              setStopPosition(savedRoute.stop);
              setStopQuery(savedRoute.stop.label || 'Sosta');
            }
            if (savedRoute?.end) {
              setDestinationPosition(savedRoute.end);
              setDestinationQuery(savedRoute.end.label || 'Destinazione');
            }
            // Imposta anche routeInfo e routePath
            setRouteInfo({
              distanceKm: normalizedRoute.distanceKm,
              durationMin: normalizedRoute.durationMin,
            });
            setRoutePath(normalizedRoute.path);

            if (normalizedRoute.path.length > 0) {
              setShowSearchPanel(false);
              setShowRoutePanel(true);
              setStatus('Percorso caricato dall evento.');
              window.requestAnimationFrame(() => {
                void renderRoute(normalizedRoute);
              });
            }
          } catch {
            sessionStorage.removeItem('mapRoute');
          }
        }
      }
    }

    setupMap();

    return () => {
      cancelled = true;
      if (navigationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(navigationWatchRef.current);
        navigationWatchRef.current = null;
      }
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      markersLayerRef.current = null;
      routeLayerRef.current = null;
      navigationMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (startQuery.trim().length < 3) {
      setStartSuggestions([]);
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setTimeout(async () => {
      try {
        const suggestions = await geocodeSuggestions(startQuery.trim());
        if (!cancelled) setStartSuggestions(suggestions);
      } catch {
        if (!cancelled) setStartSuggestions([]);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [startQuery]);

  useEffect(() => {
    let cancelled = false;
    if (stopQuery.trim().length < 3) {
      setStopSuggestions([]);
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setTimeout(async () => {
      try {
        const suggestions = await geocodeSuggestions(stopQuery.trim());
        if (!cancelled) setStopSuggestions(suggestions);
      } catch {
        if (!cancelled) setStopSuggestions([]);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [stopQuery]);

  useEffect(() => {
    let cancelled = false;
    if (destinationQuery.trim().length < 3) {
      setDestinationSuggestions([]);
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setTimeout(async () => {
      try {
        const suggestions = await geocodeSuggestions(destinationQuery.trim());
        if (!cancelled) setDestinationSuggestions(suggestions);
      } catch {
        if (!cancelled) setDestinationSuggestions([]);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [destinationQuery]);

  function updateMarkers(points) {
    if (!markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    import('leaflet').then(leaflet => {
      const L = leaflet.default;
      const makeIcon = (label, color) => L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:${color};border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:#fff;font-weight:700;font-size:12px;line-height:1;">${label}</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      points.forEach(point => {
        const isStart = point.kind === 'start';
        const isStop = point.kind === 'stop';
        const marker = L.marker([point.lat, point.lng], {
          draggable: true,
          icon: makeIcon(isStart ? 'A' : isStop ? 'S' : 'B', isStart ? '#00c853' : isStop ? '#00a6ff' : '#ff6600'),
        }).addTo(markersLayerRef.current).bindPopup(point.label);

        marker.on('dragend', async event => {
          const nextLatLng = event.target.getLatLng();
          const nextLabel = await reverseGeocode(nextLatLng.lat, nextLatLng.lng).catch(() => point.label);
          const nextPoint = {
            lat: nextLatLng.lat,
            lng: nextLatLng.lng,
            label: nextLabel,
            kind: point.kind,
          };

          if (point.kind === 'start') {
            setStartPosition(nextPoint);
            setStartQuery(nextLabel);
          } else if (point.kind === 'stop') {
            setStopPosition(nextPoint);
            setStopQuery(nextLabel);
          } else {
            setDestinationPosition(nextPoint);
            setDestinationQuery(nextLabel);
          }
          setStatus('Punto aggiornato dalla mappa.');
        });
      });
    });
  }

  function clearRoute() {
    stopNavigation(false);
    if (routeLayerRef.current) routeLayerRef.current.clearLayers();
    setRouteInfo(null);
    setRoutePath([]);
    setRouteLabel('');
    setDirections([]);
    setNavigationDistanceKm(null);
  }

  function stopNavigation(updateStatus = true) {
    if (navigationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(navigationWatchRef.current);
      navigationWatchRef.current = null;
    }
    if (navigationMarkerRef.current) {
      navigationMarkerRef.current.remove();
      navigationMarkerRef.current = null;
    }
    setIsNavigating(false);
    setNavigationDistanceKm(null);
    if (updateStatus) {
      setStatus('Navigazione interrotta.');
    }
  }

  async function startNavigation() {
    if (!destinationPosition) {
      setStatus('Imposta una destinazione prima di avviare la navigazione.');
      return;
    }
    if (!navigator.geolocation) {
      setStatus('Geolocalizzazione non disponibile su questo dispositivo.');
      return;
    }

    stopNavigation(false);
    setIsNavigating(true);
    setFollowNavigation(true);
    setStatus('Navigazione attiva...');

    if (!window.isSecureContext) {
      setStatus('Attenzione: su molti smartphone il GPS live funziona solo in HTTPS.');
    }

    const leaflet = await import('leaflet');
    const L = leaflet.default;

    try {
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 15000,
          timeout: 20000,
        });
      });
    } catch (error) {
      stopNavigation(false);
      setStatus(geolocationErrorMessage(error));
      return;
    }

    navigationWatchRef.current = navigator.geolocation.watchPosition(
      position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const point = { lat, lng, label: 'Posizione attuale', kind: 'start' };
        setCurrentPosition(point);

        const remaining = haversineDistanceKm(point, destinationPosition);
        setNavigationDistanceKm(Number.isFinite(remaining) ? remaining : null);

        if (leafletMapRef.current) {
          if (!navigationMarkerRef.current) {
            const motoIcon = L.icon({
              iconUrl: '/moto-marker.svg',
              iconSize: [42, 42],
              iconAnchor: [21, 31],
              popupAnchor: [0, -28],
            });
            navigationMarkerRef.current = L.marker([lat, lng], { icon: motoIcon }).addTo(leafletMapRef.current);
          } else {
            navigationMarkerRef.current.setLatLng([lat, lng]);
          }

          if (followNavigationRef.current) {
            leafletMapRef.current.setView([lat, lng], navigationFollowZoom, { animate: true });
          }
        }

        if (Number.isFinite(remaining)) {
          if (remaining < 0.05) {
            stopNavigation(false);
            setStatus('Sei arrivato a destinazione.');
          } else {
            setStatus(`Navigazione attiva. Mancano circa ${remaining.toFixed(2)} km.`);
          }
        }
      },
      error => {
        if (error?.code === 3) {
          setStatus(geolocationErrorMessage(error));
          return;
        }
        stopNavigation(false);
        setStatus(geolocationErrorMessage(error));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 30000,
      },
    );
  }

  function swapPoints() {
    if (!startPosition && !destinationPosition) return;

    const nextStart = destinationPosition ? { ...destinationPosition, kind: 'start' } : null;
    const nextDestination = startPosition ? { ...startPosition, kind: 'destination' } : null;

    setStartPosition(nextStart);
    setDestinationPosition(nextDestination);
    setStopPosition(stopPosition ? { ...stopPosition, kind: 'stop' } : null);
    setStartQuery(nextStart?.label || '');
    setStopQuery(stopPosition?.label || '');
    setDestinationQuery(nextDestination?.label || '');
    setActiveField('start');
    clearRoute();
    setShowRoutePanel(false);
  }

  async function selectLocation(type, suggestion) {
    const point = { lat: suggestion.lat, lng: suggestion.lng, label: suggestion.label, kind: type };
    clearRoute();
    setStartSuggestions([]);
    setStopSuggestions([]);
    setDestinationSuggestions([]);
    setActiveField(type);

    if (type === 'start') {
      setStartPosition(point);
      setStartQuery(point.label);
    } else if (type === 'stop') {
      setStopPosition(point);
      setStopQuery(point.label);
    } else {
      setDestinationPosition(point);
      setDestinationQuery(point.label);
    }

    if (leafletMapRef.current) {
      leafletMapRef.current.setView([point.lat, point.lng], 12);
      updateMarkers([
        ...(type === 'start' && point ? [point] : startPosition ? [{ ...startPosition, kind: 'start' }] : []),
        ...(type === 'stop' && point ? [point] : stopPosition ? [{ ...stopPosition, kind: 'stop' }] : []),
        ...(type === 'destination' && point ? [point] : destinationPosition ? [{ ...destinationPosition, kind: 'destination' }] : []),
      ]);
    }

    setStatus(type === 'start' ? 'Partenza impostata.' : type === 'stop' ? 'Sosta impostata.' : 'Destinazione impostata.');
  }

  async function handleMapClick(lat, lng) {
    const label = await reverseGeocode(lat, lng).catch(() => `Punto selezionato (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
    const kind = activeField === 'start' || activeField === 'stop' || activeField === 'destination'
      ? activeField
      : !startPosition
        ? 'start'
        : !stopPosition
          ? 'stop'
          : 'destination';
    await selectLocation(kind, { lat, lng, label });
  }

  async function renderRoute(routeData) {
    if (!routeLayerRef.current || !leafletMapRef.current || !markersLayerRef.current) return;

    const leaflet = await import('leaflet');
    const L = leaflet.default;

    const latLngs = normalizeRoutePath(routeData.path);
    if (!latLngs.length) throw new Error('Percorso non disponibile');

    routeLayerRef.current.clearLayers();
    markersLayerRef.current.clearLayers();

    const makeIcon = (label, color) => L.divIcon({
      className: '',
      html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:${color};border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:#fff;font-weight:700;font-size:12px;line-height:1;">${label}</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });

    const polyline = L.polyline(latLngs, {
      color: '#ff6600',
      weight: 6,
      opacity: 0.95,
    }).addTo(routeLayerRef.current);

    if (routeData.start) {
      L.marker([routeData.start.lat, routeData.start.lng], {
        icon: makeIcon('A', '#00c853'),
      }).addTo(markersLayerRef.current).bindPopup(`Partenza: ${routeData.start.label}`);
    }
    if (routeData.stop) {
      L.marker([routeData.stop.lat, routeData.stop.lng], {
        icon: makeIcon('S', '#00a6ff'),
      }).addTo(markersLayerRef.current).bindPopup(`Sosta: ${routeData.stop.label}`);
    }
    if (routeData.end) {
      L.marker([routeData.end.lat, routeData.end.lng], {
        icon: makeIcon('B', '#ff6600'),
      }).addTo(markersLayerRef.current).bindPopup(`Destinazione: ${routeData.end.label}`);
    }

    leafletMapRef.current.invalidateSize();
    leafletMapRef.current.fitBounds(polyline.getBounds(), { padding: [40, 40] });

    setRoutePath(latLngs);
    setRouteInfo({
      distanceKm: routeData.distanceKm ?? routeData.distance ?? '',
      durationMin: routeData.durationMin ?? routeData.duration ?? '',
    });
    setDirections((routeData.steps || []).map(step => ({
      text: buildStepText(step),
      distance: formatDistance(step.distance),
      duration: formatDuration(step.duration),
    })));
    if (routeData.start && routeData.end) {
      const middle = routeData.stop ? ` -> ${routeData.stop.label}` : '';
      setRouteLabel(`${routeData.start.label}${middle} -> ${routeData.end.label}`);
    }
  }

  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus('Geolocalizzazione non disponibile su questo dispositivo.');
      return;
    }

    setStatus('Recupero posizione attuale...');
    navigator.geolocation.getCurrentPosition(
      async position => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: 'Posizione attuale',
          kind: 'start',
        };
        setCurrentPosition(point);
        setStartPosition(point);
        setStartQuery('Posizione attuale');
        setActiveField('start');
        setStatus('Posizione attuale impostata come partenza.');

        if (leafletMapRef.current) {
          leafletMapRef.current.setView([point.lat, point.lng], 14);
          updateMarkers([
            point,
            ...(stopPosition ? [{ ...stopPosition, kind: 'stop' }] : []),
            ...(destinationPosition ? [{ ...destinationPosition, kind: 'destination' }] : []),
          ]);
        }
      },
      () => setStatus('Impossibile ottenere la posizione attuale.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleCreateRoute() {
    if (!startPosition || !destinationPosition) {
      setStatus('Imposta sia la partenza sia la destinazione.');
      return;
    }

    try {
      setStatus('Calcolo percorso...');
      const profile = travelModeToProfile[travelMode] || 'driving';
      const viaPoints = [
        `${startPosition.lng},${startPosition.lat}`,
        ...(stopPosition ? [`${stopPosition.lng},${stopPosition.lat}`] : []),
        `${destinationPosition.lng},${destinationPosition.lat}`,
      ];
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/${profile}/${viaPoints.join(';')}?overview=full&geometries=geojson&steps=true&alternatives=false`,
      );
      if (!response.ok) throw new Error('Percorso non disponibile');

      const data = await response.json();
      const route = data?.routes?.[0];
      const coordinates = route?.geometry?.coordinates;
      if (!route || !coordinates?.length) throw new Error('Percorso non trovato');

      const latLngs = coordinates.map(([lng, lat]) => [lat, lng]);
      await renderRoute({
        start: startPosition,
        stop: stopPosition,
        end: destinationPosition,
        path: latLngs,
        distanceKm: (route.distance / 1000).toFixed(1),
        durationMin: Math.round(route.duration / 60),
        steps: (route?.legs || []).flatMap(leg => leg?.steps || []),
      });

      setShowSearchPanel(false);
      setShowRoutePanel(false);
      setIsNavigating(false);
      setNavigationDistanceKm(null);
      setFollowNavigation(true);
      setEventForm(prev => ({
        ...prev,
        title: prev.title || `Percorso: ${startPosition.label}${stopPosition ? ` -> ${stopPosition.label}` : ''} -> ${destinationPosition.label}`,
        startTime: prev.startTime || new Date().toTimeString().slice(0, 5),
        endTime: prev.endTime || new Date(Date.now() + route.duration * 1000).toTimeString().slice(0, 5),
      }));
      setStatus('Percorso creato sulla mappa.');
    } catch {
      setStatus('Impossibile calcolare il percorso.');
    }
  }

  function handleCreateEventFromRoute() {
    if (!routeInfo || !startPosition || !destinationPosition) {
      setStatus('Crea prima il percorso.');
      return;
    }
    setShowEventModal(true);
  }

  async function handleSaveRouteEvent(e) {
    e.preventDefault();

    if (!routeInfo || !startPosition || !destinationPosition) {
      setStatus('Crea prima il percorso.');
      return;
    }

    if (!eventForm.title.trim() || !eventForm.date || !eventForm.startTime || !eventForm.endTime) {
      setStatus('Compila titolo, giorno, ora inizio e fine.');
      return;
    }

    try {
      const [startHour, startMinute] = eventForm.startTime.split(':');
      const [endHour, endMinute] = eventForm.endTime.split(':');
      const [year, month, day] = eventForm.date.split('-');
      const start = new Date(Number(year), Number(month) - 1, Number(day), Number(startHour), Number(startMinute));
      const end = new Date(Number(year), Number(month) - 1, Number(day), Number(endHour), Number(endMinute));

      await addEvent({
        title: eventForm.title.trim(),
        start,
        end,
        note: eventForm.note.trim(),
        image: '',
        mapRoute: {
          start: startPosition,
          stop: stopPosition,
          end: destinationPosition,
          path: routePath,
          distance: routeInfo.distanceKm,
          duration: routeInfo.durationMin,
        },
      });

      setShowEventModal(false);
      setStatus('Evento creato con il percorso.');
    } catch {
      setStatus('Impossibile creare l evento dal percorso.');
    }
  }

  const hasRoute = Boolean(routeInfo && startPosition && destinationPosition);

  return (
    <>
      <div
        className="bb-page"
        style={{
          background: '#111',
          color: '#fff',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 'calc(var(--bb-app-height, 100dvh) - var(--bb-mobile-bottom-nav-height, 0px))',
          overflow: 'hidden',
        }}
      >
        {!isMobile && <Link to="/" className="bb-back-btn" style={{ position: 'fixed', top: '24px', left: 'auto', right: '24px', zIndex: 7600, pointerEvents: 'auto' }}>&#8592; Home</Link>}

        <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 0 }} />

        <div style={{ position: 'fixed', left: '10px', right: '10px', top: isMobile ? 'calc(10px + env(safe-area-inset-top))' : '94px', zIndex: 7200, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', pointerEvents: 'auto' }}>
            <button
              type="button"
              onClick={() => setShowSearchPanel(prev => !prev)}
              style={{
                background: showSearchPanel ? '#ff6600' : '#222',
                color: '#fff',
                border: 'none',
                borderRadius: '14px',
                padding: '10px 14px',
                boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {showSearchPanel ? 'Nascondi ricerca' : 'Cerca'}
            </button>

            <button
              type="button"
              onClick={handleCreateEventFromRoute}
              disabled={!hasRoute}
              style={{
                background: hasRoute ? '#ff6600' : '#555',
                color: '#fff',
                border: 'none',
                borderRadius: '14px',
                padding: '10px 14px',
                boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: hasRoute ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
              }}
            >
              Aggiungi evento
            </button>
          </div>
        </div>

        {showSearchPanel && (
          <div style={{ position: 'fixed', left: '10px', right: '10px', top: isMobile ? 'calc(58px + env(safe-area-inset-top))' : '142px', zIndex: 7100, pointerEvents: 'none', maxWidth: '720px' }}>
            <div style={{ pointerEvents: 'auto', background: 'rgba(18,18,18,0.92)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '10px', boxShadow: '0 4px 18px rgba(0,0,0,0.35)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={startQuery}
                    onFocus={() => setActiveField('start')}
                    onChange={e => setStartQuery(e.target.value)}
                    placeholder="Partenza"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: 'none', boxSizing: 'border-box' }}
                  />
                  {startSuggestions.length > 0 && startQuery.trim().length >= 3 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#222', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 6px 18px rgba(0,0,0,0.35)', zIndex: 2 }}>
                      {startSuggestions.map(suggestion => (
                        <button
                          key={`${suggestion.lat}-${suggestion.lng}-${suggestion.label}`}
                          type="button"
                          onClick={() => selectLocation('start', suggestion)}
                          style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={stopQuery}
                    onFocus={() => setActiveField('stop')}
                    onChange={e => setStopQuery(e.target.value)}
                    placeholder="Sosta (opzionale)"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: 'none', boxSizing: 'border-box' }}
                  />
                  {stopSuggestions.length > 0 && stopQuery.trim().length >= 3 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#222', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 6px 18px rgba(0,0,0,0.35)', zIndex: 2 }}>
                      {stopSuggestions.map(suggestion => (
                        <button
                          key={`${suggestion.lat}-${suggestion.lng}-${suggestion.label}`}
                          type="button"
                          onClick={() => selectLocation('stop', suggestion)}
                          style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={destinationQuery}
                    onFocus={() => setActiveField('destination')}
                    onChange={e => setDestinationQuery(e.target.value)}
                    placeholder="Dove vuoi andare?"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: 'none', boxSizing: 'border-box' }}
                  />
                  {destinationSuggestions.length > 0 && destinationQuery.trim().length >= 3 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#222', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 6px 18px rgba(0,0,0,0.35)', zIndex: 2 }}>
                      {destinationSuggestions.map(suggestion => (
                        <button
                          key={`${suggestion.lat}-${suggestion.lng}-${suggestion.label}`}
                          type="button"
                          onClick={() => selectLocation('destination', suggestion)}
                          style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" className="bb-add-btn" style={{ marginLeft: 0, minWidth: 0, flex: '1 1 150px', height: '38px', fontSize: '0.82rem', padding: '6px 10px' }} onClick={handleUseCurrentLocation}>
                    Posizione attuale
                  </button>
                  <button type="button" className="bb-event-btn" style={{ width: '100%', minWidth: 0, flex: '1 1 150px', height: '38px', fontSize: '0.82rem', padding: '6px 10px' }} onClick={handleCreateRoute}>
                    Crea percorso
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" className="bb-add-btn" style={{ marginLeft: 0, minWidth: 0, flex: '1 1 150px', height: '38px', fontSize: '0.82rem', padding: '6px 10px' }} onClick={swapPoints}>
                    Inverti
                  </button>
                  <button
                    type="button"
                    className="bb-event-btn"
                    style={{ width: '100%', minWidth: 0, flex: '1 1 150px', height: '38px', fontSize: '0.82rem', padding: '6px 10px' }}
                    onClick={() => {
                      setStartPosition(null);
                      setStopPosition(null);
                      setDestinationPosition(null);
                      setStartQuery('');
                      setStopQuery('');
                      setDestinationQuery('');
                      setCurrentPosition(null);
                      setActiveField('start');
                      setShowSearchPanel(true);
                      setShowRoutePanel(false);
                      clearRoute();
                      setStatus('Mappa pulita.');
                    }}
                  >
                    Pulisci
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {travelModes.map(mode => {
                    const active = travelMode === mode.value;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => setTravelMode(mode.value)}
                        style={{
                          flex: '1 1 90px',
                          minWidth: 0,
                          height: '36px',
                          borderRadius: '999px',
                          border: 'none',
                          background: active ? '#ff6600' : '#333',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>

                {hasRoute && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="bb-event-btn"
                      style={{ width: '100%', minWidth: 0, flex: '1 1 220px', height: '38px', fontSize: '0.82rem', padding: '6px 10px' }}
                      onClick={isNavigating ? () => stopNavigation(true) : () => { void startNavigation(); }}
                    >
                      {isNavigating ? 'Ferma navigazione' : 'Avvia navigazione'}
                    </button>
                    {isNavigating && (
                      <button
                        type="button"
                        className="bb-add-btn"
                        style={{ marginLeft: 0, minWidth: 0, flex: '1 1 220px', height: '38px', fontSize: '0.82rem', padding: '6px 10px' }}
                        onClick={() => setFollowNavigation(prev => !prev)}
                      >
                        {followNavigation ? 'Segui: ON' : 'Segui: OFF'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={{ position: 'fixed', left: '10px', right: '10px', bottom: 'calc(12px + var(--bb-mobile-bottom-nav-height, 0px) + env(safe-area-inset-bottom))', zIndex: 6900, pointerEvents: 'none', maxWidth: '720px' }}>
          {status && (
            <div style={{ pointerEvents: 'auto', background: 'rgba(18,18,18,0.92)', border: '1px solid rgba(255,255,255,0.12)', color: '#ffb366', borderRadius: '14px', padding: '10px 12px', boxShadow: '0 4px 18px rgba(0,0,0,0.35)' }}>
              {status}
            </div>
          )}

          {routeInfo && (
            <div style={{ pointerEvents: 'auto', marginTop: '8px' }}>
              {showRoutePanel ? (
                <div style={{ background: 'rgba(18,18,18,0.92)', borderRadius: '14px', padding: '10px 12px', color: '#fff', boxShadow: '0 4px 18px rgba(0,0,0,0.35)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ color: '#ff6600', fontWeight: 700 }}>{routeLabel || 'Percorso'}</div>
                    <button type="button" onClick={() => setShowRoutePanel(false)} style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '999px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.78rem' }}>
                      Chiudi
                    </button>
                  </div>
                  <div style={{ fontSize: '0.82rem', marginBottom: '6px' }}>Distanza: {routeInfo.distanceKm} km | Tempo: {routeInfo.durationMin} min</div>
                  {isNavigating && (
                    <div style={{ fontSize: '0.82rem', marginBottom: '6px', color: '#9be4ff' }}>
                      Navigazione attiva{Number.isFinite(navigationDistanceKm) ? ` · Mancano ${navigationDistanceKm.toFixed(2)} km` : ''} · Segui: {followNavigation ? 'ON' : 'OFF'}
                    </div>
                  )}
                  {directions.length > 0 && (
                    <div style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                      {directions.slice(0, 8).map((step, index) => (
                        <div key={`${step.text}-${index}`} style={{ padding: '6px 0', borderTop: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{index + 1}. {step.text}</div>
                          <div style={{ fontSize: '0.76rem', color: '#bbb' }}>{step.distance}{step.duration ? ` · ${step.duration}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setShowRoutePanel(true)} style={{ background: '#222', color: '#fff', border: 'none', borderRadius: '14px', padding: '10px 12px', boxShadow: '0 4px 18px rgba(0,0,0,0.35)', cursor: 'pointer', fontWeight: 700 }}>
                    Mostra dettagli percorso
                  </button>
                  <button
                    type="button"
                    onClick={isNavigating ? () => stopNavigation(true) : () => { void startNavigation(); }}
                    style={{ background: isNavigating ? '#004a7d' : '#ff6600', color: '#fff', border: 'none', borderRadius: '14px', padding: '10px 12px', boxShadow: '0 4px 18px rgba(0,0,0,0.35)', cursor: 'pointer', fontWeight: 700 }}
                  >
                    {isNavigating ? 'Ferma navigazione' : 'Avvia navigazione'}
                  </button>
                  {isNavigating && (
                    <button
                      type="button"
                      onClick={() => setFollowNavigation(prev => !prev)}
                      style={{ background: followNavigation ? '#0b6b3a' : '#555', color: '#fff', border: 'none', borderRadius: '14px', padding: '10px 12px', boxShadow: '0 4px 18px rgba(0,0,0,0.35)', cursor: 'pointer', fontWeight: 700 }}
                    >
                      {followNavigation ? 'Segui: ON' : 'Segui: OFF'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {currentPosition && (
            <div style={{ pointerEvents: 'auto', marginTop: '8px', background: 'rgba(18,18,18,0.82)', borderRadius: '12px', padding: '8px 10px', color: '#9a9a9a', fontSize: '0.78rem' }}>
              Posizione attuale: {currentPosition.lat.toFixed(5)}, {currentPosition.lng.toFixed(5)}
            </div>
          )}
        </div>

        {showEventModal && (
          <div style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: 'calc(var(--bb-mobile-bottom-nav-height, 0px) + env(safe-area-inset-bottom))', zIndex: 7500, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <form onSubmit={handleSaveRouteEvent} style={{ width: '100%', maxWidth: '480px', background: '#222', color: '#fff', borderRadius: '18px', padding: '18px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <h2 style={{ margin: 0, color: '#ff6600', fontSize: '1.15rem' }}>Crea evento</h2>
                <button type="button" onClick={() => setShowEventModal(false)} style={{ background: 'none', border: 'none', color: '#ff6600', fontSize: '1.6rem', cursor: 'pointer' }}>&times;</button>
              </div>

              <input
                type="text"
                value={eventForm.title}
                onChange={e => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Titolo evento"
                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={e => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="time"
                    value={eventForm.startTime}
                    onChange={e => setEventForm(prev => ({ ...prev, startTime: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', boxSizing: 'border-box' }}
                  />
                  <input
                    type="time"
                    value={eventForm.endTime}
                    onChange={e => setEventForm(prev => ({ ...prev, endTime: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <textarea
                value={eventForm.note}
                onChange={e => setEventForm(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Note evento"
                rows={4}
                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', boxSizing: 'border-box', resize: 'vertical' }}
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="bb-add-btn" style={{ flex: 1, marginLeft: 0, height: '40px', padding: '6px 10px', fontSize: '0.85rem' }} onClick={() => setShowEventModal(false)}>
                  Annulla
                </button>
                <button type="submit" className="bb-event-btn" style={{ flex: 1, minWidth: 0, height: '40px', padding: '6px 10px', fontSize: '0.85rem' }}>
                  Salva evento
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <MobileBottomNav />
    </>
  );
}

export default Mappa;

