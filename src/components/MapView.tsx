import { MapContainer, TileLayer, Circle, Tooltip } from "react-leaflet";
import { useEffect, useState } from "react";

export default function MapView() {
  const [fences, setFences] = useState([]);

  useEffect(() => {
    fetch("http://127.0.0.1:5000/api/geofences")
      .then((res) => res.json())
      .then(setFences);
  }, []);

  return (
    <MapContainer center={[52.0, 4.35]} zoom={13} style={{ height: "100vh" }}>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {fences.map((f, i) => (
        <Circle
          key={i}
          center={[f.lat, f.lon]}
          radius={f.radius}
          pathOptions={{ color: "red", fillOpacity: 0.2 }}
        >
          <Tooltip permanent>{f.name}</Tooltip>
        </Circle>
      ))}
    </MapContainer>
  );
}
