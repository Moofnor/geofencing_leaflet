import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Circle, Tooltip, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import io from "socket.io-client";

// ensure the default icon URLs are correct
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, shadowUrl: iconShadow });

interface Fence { name: string; lat: number; lon: number; radius: number; }
interface Event { hook: string; id: string; detect: string; coords: [number, number]; }

export default function MapView() {
  const [fences, setFences] = useState<Fence[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  // track which IDs are inside per hook
  const insideMap = useRef<Record<string, Set<string>>>({});
  // current markers for “inside” points
  const [markers, setMarkers] = useState<Record<string, [number,number]>>({});

  // 1) load fences once
  useEffect(() => {
    fetch("http://127.0.0.1:5000/api/geofences")
      .then(r => r.json())
      .then(setFences);
  }, []);

  // 2) connect to websocket for geofence events
  useEffect(() => {
    const socket = io("http://127.0.0.1:5000");
    socket.on("geofence_event", (ev: Event) => {
      setEvents(evts => [ev, ...evts].slice(0,50)); // keep last 50
      setMarkers(mk => {
        const copy = { ...mk };
        const ins = insideMap.current;
        ins[ev.hook] ??= new Set();

        if (ev.detect === "inside") {
          ins[ev.hook].add(ev.id);
          copy[`${ev.hook}:${ev.id}`] = [ev.coords[1], ev.coords[0]]; // [lat,lon]
        } else {
          ins[ev.hook].delete(ev.id);
          delete copy[`${ev.hook}:${ev.id}`];
        }
        return copy;
      });
    });
    return () => { socket.disconnect() };
  }, []);

  return (
    <div className="flex h-screen">
      {/* Left: map */}
      <div className="w-3/4">
        <MapContainer center={[52.0,4.35]} zoom={13} style={{ height: "100%" }}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {fences.map(f => {
            const isInside = insideMap.current[f.name]?.size > 0;
            return (
              <Circle
                key={f.name}
                center={[f.lat, f.lon]}
                radius={f.radius}
                pathOptions={{ color: isInside ? "blue" : "red", fillOpacity: 0.2 }}
              >
                <Tooltip permanent>{f.name}</Tooltip>
              </Circle>
            );
          })}
          {Object.entries(markers).map(([key, pos]) => (
            <Marker key={key} position={pos}>
              <Popup>{key.split(":")[1]}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Right: events table */}
      <div className="w-1/4 overflow-auto p-4 bg-gray-10">
        <h2 className="text-xl font-bold mb-2">Geofence Events</h2>
        <table className="w-full table-auto text-sm">
          <thead>
            <tr>
              <th className="px-1 py-1 text-left">Time</th>
              <th className="px-1 py-1 text-left">Hook</th>
              <th className="px-1 py-1 text-left">ID</th>
              <th className="px-1 py-1 text-left">Type</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e,i) => (
              <tr key={i} className="border-t">
                <td className="px-1 py-1">{e.time}</td>
                <td className="px-1 py-1">{e.hook}</td>
                <td className="px-1 py-1">{e.id}</td>
                <td className="px-1 py-1">{e.detect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
