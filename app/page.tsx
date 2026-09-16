import ApexWorld from "@/components/ApexWorld";
import ApexOverviewPanel from "@/components/ApexOverviewPanel";

export default function Home() {
  return (
    <main
      id="main"
      style={{ background: "#04080f", color: "#f0ede8", position: "relative", overflow: "hidden" }}
    >
      <ApexOverviewPanel />

      <section style={{ position: "relative", height: "100vh", minHeight: 620 }}>
        <ApexWorld />
      </section>

      <div
        style={{
          position: "absolute", top: 16, right: "clamp(16px,3vw,40px)", zIndex: 40,
          fontFamily: "var(--font-mono)", fontSize: "0.66rem", letterSpacing: "0.24em",
          textTransform: "uppercase", color: "rgba(240,237,232,0.7)",
          border: "1px solid rgba(240,237,232,0.2)", borderRadius: 20, padding: "7px 15px",
          background: "rgba(4,8,15,0.5)", backdropFilter: "blur(6px)",
        }}
      >
        Mulkallah Jarvis
      </div>
    </main>
  );
}
