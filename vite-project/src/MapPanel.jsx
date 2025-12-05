import { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import Supercluster from 'supercluster';
import L from 'leaflet';

import "leaflet/dist/leaflet.css";

const defaultCenter = [-15.788497, -47.879873];

// 1. Converte os dados das clínicas para o formato GeoJSON que o Supercluster entende.
const useGeoJsonPoints = (clinicas) => {
  return useMemo(() => {
    return clinicas
      .filter(c => c.latitude && c.longitude)
      .map(clinica => ({
        type: "Feature",
        properties: {
          cluster: false,
          ...clinica
        },
        geometry: {
          type: "Point",
          coordinates: [parseFloat(clinica.longitude), parseFloat(clinica.latitude)]
        }
      }));
  }, [clinicas]);
};

// 2. Componente invisível que sincroniza o estado do mapa (bounds, zoom) com nosso estado React
const MapSync = ({ setBounds, setZoom }) => {
  const map = useMap();

  useMapEvents({
    zoomend: (e) => setZoom(e.target.getZoom()),
    moveend: (e) => setBounds(e.target.getBounds().toBBoxString().split(',').map(Number)),
  });

  // Seta o estado inicial
  useEffect(() => {
    setBounds(map.getBounds().toBBoxString().split(',').map(Number));
    setZoom(map.getZoom());
  }, [map, setBounds, setZoom]);

  return null;
};

// 3. O componente que move o mapa para a clínica selecionada
function FlyToSelected({ clinica }) {
  const map = useMap();
  useEffect(() => {
    if (!clinica || !clinica.latitude || !clinica.longitude) return;
    const lat = parseFloat(clinica.latitude);
    const lng = parseFloat(clinica.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      map.flyTo([lat, lng], 15, { duration: 0.6 });
    }
  }, [clinica, map]);
  return null;
}

// Novo componente para voar para a localização do usuário
function FlyToUserLocation({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.flyTo([location.lat, location.lng], 14, { duration: 0.8 });
    }
  }, [location, map]);
  return null;
}

// 4. O componente principal do Mapa
function MapPanel({ clinicas = [], selectedClinica, onSelect, userLocation }) {
  const [bounds, setBounds] = useState(null);
  const [zoom, setZoom] = useState(5);

  const points = useGeoJsonPoints(clinicas);

  // 5. O motor do Supercluster, memoizado para alta performance
  const supercluster = useMemo(() => {
    const index = new Supercluster({
      radius: 60,
      maxZoom: 16,
    });
    index.load(points);
    return index;
  }, [points]);

  // 6. Calcula os clusters/marcadores a serem exibidos na tela
  const clusters = useMemo(() => {
    if (!bounds) return [];
    return supercluster.getClusters(bounds, zoom);
  }, [supercluster, bounds, zoom]);

  return (
    <div className="w-full h-[360px] border border-[#E4E6EA] rounded-xl overflow-hidden bg-white shadow-sm">
      <MapContainer center={defaultCenter} zoom={zoom} scrollWheelZoom className="w-full h-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapSync setBounds={setBounds} setZoom={setZoom} />
        <FlyToSelected clinica={selectedClinica} />
        <FlyToUserLocation location={userLocation} />

        {clusters.map(cluster => {
          const [longitude, latitude] = cluster.geometry.coordinates;
          const { cluster: isCluster, point_count: pointCount } = cluster.properties;

          // 7. Se for um cluster, mostra o ícone de agrupamento
          if (isCluster) {
            const clusterIcon = L.divIcon({
              html: `<div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background-color: #0C77E1; color: white; font-weight: 600; font-size: 14px; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${pointCount}</div>`,
              className: "bg-transparent border-0",
              iconSize: [40, 40],
            });

            return (
              <Marker
                key={`cluster-${cluster.id}`}
                position={[latitude, longitude]}
                icon={clusterIcon}
                eventHandlers={{
                  click: (e) => {
                    const expansionZoom = Math.min(supercluster.getClusterExpansionZoom(cluster.id), 18);
                    const map = e.target._map;
                    map.flyTo([latitude, longitude], expansionZoom, { duration: 0.5 });
                  },
                }}
              />
            );
          }

          // 8. Se for um ponto único, mostra o marcador da clínica
          const clinicPointIcon = L.divIcon({
            html: `<img src="https://cdn-icons-png.flaticon.com/512/1484/1484884.png" style="width: 32px; height: 32px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));">`,
            className: "bg-transparent border-0",
            iconSize: [32, 32],
            iconAnchor: [16, 32] // Âncora na ponta inferior central do pino
          });

          return (
            <Marker
              key={cluster.properties.clinica_id}
              position={[latitude, longitude]}
              icon={clinicPointIcon}
              eventHandlers={{ click: () => onSelect(cluster.properties) }}
            >
              <Popup>
                <b>{cluster.properties.nome_fantasia}</b><br />
                {cluster.properties.logradouro}, {cluster.properties.numero}<br />
                {cluster.properties.bairro}<br />
                {cluster.properties.cidade}/{cluster.properties.uf}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export default MapPanel;

