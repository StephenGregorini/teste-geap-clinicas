import { useEffect, useRef, useState, useMemo } from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import PillMarker from "./PillMarker";

// Default bounds for São Paulo region to ensure initial render
const DEFAULT_BOUNDS = {
  south: -24.5,
  west: -47.5,
  north: -19.5,
  east: -42.5,
};

// simple HTML escaper for InfoWindow content
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function MapContent({
  clinicas,
  selectedClinica,
  onSelect,
  userLocation,
  mapId,
}) {
  console.log("MapContent received clinicas:", clinicas);
  const mapRef = useRef(null);
  const map = useRef(null);
  const [bounds, setBounds] = useState(DEFAULT_BOUNDS);
  const [zoom, setZoom] = useState(12);
  const [renderedMarkers, setRenderedMarkers] = useState([]);

  // Inicializa mapa
  useEffect(() => {
    if (!mapRef.current || map.current) return;

    map.current = new google.maps.Map(mapRef.current, {
      center: { lat: -23.55, lng: -46.63 },
      zoom: 12,
      minZoom: 5,
      mapId,
      gestureHandling: "greedy",
      disableDefaultUI: true,
      styles: [
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] },
        { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
      ],
    });

    const updateBounds = () => {
      const b = map.current.getBounds();
      if (b) {
        setBounds(b.toJSON());
        setZoom(map.current.getZoom());
      }
    };

    const idleListener = map.current.addListener("idle", updateBounds);
    const boundsChangedListener = map.current.addListener("bounds_changed", updateBounds);

    // Try to set bounds immediately
    setTimeout(updateBounds, 100);

    return () => {
      google.maps.event.removeListener(idleListener);
      google.maps.event.removeListener(boundsChangedListener);
    };
  }, [mapId]);

  // expose a global helper so parent/list can force focus even if selectedClinica reference doesn't change
  useEffect(() => {
    if (!map.current) return;

    const focusClinic = (c) => {
      if (!c) return;
      const lat = Number(c.latitude);
      const lng = Number(c.longitude);

      // find rendered marker by position
      const matched = renderedMarkers.find((m) => {
        try {
          const p = m.getPosition && m.getPosition();
          if (!p) return false;
          return Math.abs(p.lat() - lat) < 0.000001 && Math.abs(p.lng() - lng) < 0.000001;
        } catch (e) {
          return false;
        }
      });

      try {
        map.current.panTo({ lat, lng });
        map.current.setZoom(15);
      } catch (e) {
        map.current.panTo({ lat, lng });
      }

      if (matched && infoWindowRef.current) {
        const content = `
            <div style="min-width:180px;font-size:13px">
              <strong style="display:block;margin-bottom:6px">${escapeHtml(c.nome_fantasia || "")}</strong>
              ${escapeHtml(c.endereco || "")}<br/>
              ${escapeHtml(c.bairro || "")} - ${escapeHtml(c.cidade || "")}
            </div>
          `;
        try { infoWindowRef.current.close(); } catch (e) {}
        infoWindowRef.current.setContent(content);

        let idleListener = null;
        let timeoutId = null;
        const cleanup = () => {
          try {
            if (idleListener && typeof idleListener.remove === "function") {
              idleListener.remove();
            } else if (idleListener) {
              google.maps.event.removeListener(idleListener);
            }
          } catch (e) {}
          try { if (timeoutId) clearTimeout(timeoutId); } catch (e) {}
        };
        const onIdle = () => {
          try { infoWindowRef.current.open({ anchor: matched, map: map.current }); } catch (e) { infoWindowRef.current.open(map.current, matched); }
          cleanup();
        };
        idleListener = map.current.addListener("idle", onIdle);
        timeoutId = setTimeout(onIdle, 700);
      }
    };

    // attach helpers
    window.__GEAP_focusClinic = focusClinic;
    const handler = (ev) => {
      const payload = ev?.detail;
      if (!payload) return;
      focusClinic(payload);
    };
    window.addEventListener("geap:focusClinic", handler);

    return () => {
      try { delete window.__GEAP_focusClinic; } catch (e) {}
      window.removeEventListener("geap:focusClinic", handler);
    };
  }, [renderedMarkers]);

  // Create markers and a MarkerClusterer (replaces use-supercluster)
  const clustererRef = useRef(null);
  const infoWindowRef = useRef(null);
  useEffect(() => {
    if (!map.current) return;

    if (!window.google?.maps?.marker?.AdvancedMarkerElement) {
      console.warn("Google Maps AdvancedMarkerElement not loaded. Skipping marker rendering.");
      return;
    }

    // ensure a single InfoWindow instance
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow({ content: "" });
    }

    // cleanup previous markers/clusterer
    if (clustererRef.current) {
      try {
        clustererRef.current.clearMarkers();
      } catch (e) {
        // ignore
      }
      clustererRef.current = null;
    }
    renderedMarkers.forEach((m) => m.setMap(null));

    const markers = clinicas
      .filter(
        (c) =>
          typeof c.latitude === "number" &&
          !Number.isNaN(c.latitude) &&
          typeof c.longitude === "number" &&
          !Number.isNaN(c.longitude)
      )
      .map((c) => {
        const lat = Number(c.latitude);
        const lng = Number(c.longitude);
        // create a simple pin for individual clinics (no expanded info shown by default)
        const div = document.createElement("div");
        div.style.width = "36px";
        div.style.height = "44px";
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.justifyContent = "center";
        div.style.cursor = "pointer";
        div.title = c.nome_fantasia || "Clinica";
        div.style.transform = "translateY(-6px)";
        // clearer SVG pin: filled blue outer circle + white center with subtle shadow
        div.innerHTML = `
          <svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="#06b6d4" />
                <stop offset="100%" stop-color="#0ea5e9" />
              </linearGradient>
              <filter id="f" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.22" />
              </filter>
            </defs>
            <g filter="url(#f)">
              <path d="M18 0C11 0 6 5 6 11c0 7.333 9.333 20.333 10.667 22.333.467.533 1.333.533 1.8 0C20.667 31.333 30 18.333 30 11 30 5 25 0 18 0z" fill="url(#g)"/>
              <circle cx="18" cy="11" r="6.2" fill="#fff"/>
              <circle cx="18" cy="11" r="2.6" fill="#075985"/>
            </g>
          </svg>
        `;

        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: map.current,
          position: { lat, lng },
          content: div,
        });

        marker.addListener("click", () => {
          // show InfoWindow with minimal clinic info on click
          const content = `
              <div style="min-width:180px;font-size:13px">
                <strong style="display:block;margin-bottom:6px">${escapeHtml(c.nome_fantasia || "")}</strong>
                ${escapeHtml(c.endereco || "")}<br/>
                ${escapeHtml(c.bairro || "")} - ${escapeHtml(c.cidade || "")}
              </div>
            `;

          // ensure previous info window closed
          try {
            infoWindowRef.current.close();
          } catch (e) {}

          infoWindowRef.current.setContent(content);

          // Pan and zoom to the marker, then open the InfoWindow when the map is idle
          try {
            map.current.panTo({ lat, lng });
            map.current.setZoom(15);
          } catch (e) {
            map.current.panTo({ lat, lng });
          }

          let idleListener = null;
          let timeoutId = null;

          const cleanup = () => {
            try {
              if (idleListener && typeof idleListener.remove === "function") {
                idleListener.remove();
              } else if (idleListener) {
                google.maps.event.removeListener(idleListener);
              }
            } catch (e) {}
            try {
              if (timeoutId) clearTimeout(timeoutId);
            } catch (e) {}
          };

          const onIdle = () => {
            try {
              infoWindowRef.current.open({ anchor: marker, map: map.current });
            } catch (e) {
              infoWindowRef.current.open(map.current, marker);
            }
            cleanup();
          };

          idleListener = map.current.addListener("idle", onIdle);
          // fallback in case "idle" doesn't fire (same center/zoom), open after 700ms
          timeoutId = setTimeout(() => {
            onIdle();
          }, 700);

          onSelect && onSelect(c);
        });

        return marker;
      });

    // create clusterer
    try {
      clustererRef.current = new MarkerClusterer({ markers, map: map.current });
    } catch (e) {
      console.error("Failed to create MarkerClusterer:", e);
    }

    setRenderedMarkers(markers);

    return () => {
      markers.forEach((m) => m.setMap(null));
      if (clustererRef.current) {
        try {
          clustererRef.current.clearMarkers();
        } catch (e) {}
        clustererRef.current = null;
      }
    };
  }, [clinicas, selectedClinica, map.current]);

  // PanTo selectedClinica
  useEffect(() => {
    if (!map.current || !selectedClinica) return;
    const lat = Number(selectedClinica.latitude);
    const lng = Number(selectedClinica.longitude);

    // try to find the rendered marker for this clinic
    const matched = renderedMarkers.find((m) => {
      try {
        const p = m.getPosition && m.getPosition();
        if (!p) return false;
        return Math.abs(p.lat() - lat) < 0.000001 && Math.abs(p.lng() - lng) < 0.000001;
      } catch (e) {
        return false;
      }
    });

    // center and zoom
    try {
      map.current.panTo({ lat, lng });
      map.current.setZoom(15);
    } catch (e) {
      map.current.panTo({ lat, lng });
    }

    // If we have the marker, open the same InfoWindow as marker click would
    if (matched && infoWindowRef.current) {
      const c = selectedClinica;
      const content = `
          <div style="min-width:180px;font-size:13px">
            <strong style="display:block;margin-bottom:6px">${escapeHtml(c.nome_fantasia || "")}</strong>
            ${escapeHtml(c.endereco || "")}<br/>
            ${escapeHtml(c.bairro || "")} - ${escapeHtml(c.cidade || "")}
          </div>
        `;

      try {
        infoWindowRef.current.close();
      } catch (e) {}
      infoWindowRef.current.setContent(content);

      let idleListener = null;
      let timeoutId = null;

      const cleanup = () => {
        try {
          if (idleListener && typeof idleListener.remove === "function") {
            idleListener.remove();
          } else if (idleListener) {
            google.maps.event.removeListener(idleListener);
          }
        } catch (e) {}
        try {
          if (timeoutId) clearTimeout(timeoutId);
        } catch (e) {}
      };

      const onIdle = () => {
        try {
          infoWindowRef.current.open({ anchor: matched, map: map.current });
        } catch (e) {
          infoWindowRef.current.open(map.current, matched);
        }
        cleanup();
      };

      idleListener = map.current.addListener("idle", onIdle);
      timeoutId = setTimeout(onIdle, 700);
    }
  }, [selectedClinica]);

  // PanTo userLocation
  useEffect(() => {
    if (!map.current || !userLocation) return;

    map.current.panTo(userLocation);
    map.current.setZoom(14);
  }, [userLocation]);

  return <div ref={mapRef} style={{ width: "100%", height: "100%" }} />;
}
