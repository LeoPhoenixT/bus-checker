import { ImageResponse } from "next/og";

export const alt = "Bus Checker — KMB bus ETAs and nearby stops in Hong Kong";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #1d4ed8, #2563eb 55%, #0f172a)",
          color: "white",
          display: "flex",
          height: "100%",
          padding: "72px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "0.08em" }}>
            HONG KONG KMB
          </div>
          <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: "-0.04em" }}>
            Bus Checker
          </div>
          <div style={{ fontSize: 42, opacity: 0.9 }}>
            Real-time bus ETAs and nearby stops
          </div>
        </div>
      </div>
    ),
    size,
  );
}
