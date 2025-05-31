import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  Tooltip,
  Marker,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import io from "socket.io-client";
import "leaflet/dist/leaflet.css";

import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, shadowUrl: iconShadow });

interface Fence {
  name: string;
  lat: number;
  lon: number;
  radius: number;
}
interface GeoEvent {
  hook: string;
  id: string;
  detect: "inside" | "exit" | string;
  coords: [number, number]; // [lon, lat]
  time: string;             // ISO timestamp
  formatted_time: string,
}

export default function MapView() {
  const [fences, setFences] = useState<Fence[]>([]);
  const latest = useRef<Record<string, GeoEvent>>({});
  const insideCount = useRef<Record<string, Set<String>>>({});
  const [, tick] = useState(0);

  // New: keep a history of inside/exit events for the table
  const [history, setHistory] = useState<GeoEvent[]>([]);

  useEffect(() => {
    fetch("http://127.0.0.1:5000/api/geofences")
      .then((r) => r.json())
      .then(setFences);
  }, []);

  useEffect(() => {
    const socket = io("http://127.0.0.1:5000");
    socket.on("geofence_event", (ev: GeoEvent) => {
      // update latest per id
      const prev = latest.current[ev.id];
      if (!prev || new Date(ev.time) > new Date(prev.time)) {
        latest.current = {
          ...latest.current,
          [ev.id]: ev
        };
        tick((c) => c + 1);
      }
      // append to history if inside or exit
      if (ev.detect === "inside" || ev.detect === "exit") {
        setHistory((h) => [...h, ev]);
        const occupants = insideCount.current[ev.hook] ? insideCount.current[ev.hook] : new Set();

        if (ev.detect === "inside") {
          insideCount.current = {
            ...insideCount.current,
            [ev.hook]: occupants.add(ev.id)
          }}
           else {
            occupants.delete(ev.id)
            insideCount.current = {
              ...insideCount.current,
              [ev.hook]: occupants
            }}
          };
        

      }
    );
    return () => {
      socket.disconnect();
    };
  }, []);

  // derive for rendering
  const markerEntries = Object.values(latest.current);
  const tableEntries = history; // all inside/exit events

  return (
    <div className="flex h-screen">
      {/* Map */}
      <div className="w-3/4">
        <MapContainer
          center={[51.903022, 4.481119]}
          zoom={15}
          style={{ height: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {fences.map((f) => {
            console.log(f.name + " " + insideCount.current[f.name]);
            const anyInside = insideCount.current[f.name] ? insideCount.current[f.name].size > 0 : false;
            // markerEntries.some(
            //   (e) => e.hook === f.name && e.detect === "inside"
            // );
            return (
              <Circle
                key={f.name}
                center={[f.lat, f.lon]}
                radius={f.radius}
                pathOptions={{
                  color: anyInside ? "blue" : "red",
                  fillOpacity: 0.2,
                }}
              >
                <Tooltip>{f.name}</Tooltip>
              </Circle>
            );
          })}

          {markerEntries.map((e) => (
            <Marker
              key={e.id}
              position={[e.coords[1], e.coords[0]]}
            >
              <Popup>
                <div>
                  <strong>{e.id}</strong>
                  <br />
                  {e.formatted_time}
                  <br />
                  ({e.detect})
                </div>
              </Popup>
              <Tooltip permanent direction="top">
                {e.id} @ {e.formatted_time}
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Events table */}
      <div className="w-1/4 overflow-auto p-4 bg-gray-10">
        <h2 className="text-xl font-bold mb-2">Geofence Events</h2>
        <table className="w-full table-auto text-sm">
          <thead>
            <tr>
              <th className="px-1 py-1 text-left">Hook</th>
              <th className="px-1 py-1 text-left">ID</th>
              <th className="px-1 py-1 text-left">Type</th>
              <th className="px-1 py-1 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {tableEntries.map((e, i) => (
              <tr key={i} className="border-t">
                <td className="px-1 py-1">{e.hook}</td>
                <td className="px-1 py-1">{e.id}</td>
                <td className="px-1 py-1">{e.detect}</td>
                <td className="px-1 py-1">{e.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
