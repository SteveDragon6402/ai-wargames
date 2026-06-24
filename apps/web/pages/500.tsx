export default function Custom500() {
  return (
    <div
      style={{
        padding: "2rem",
        fontFamily: "Inter, system-ui, sans-serif",
        background: "#101010",
        color: "#bdbdbd",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ color: "#f2f2f2", fontWeight: 600 }}>500 – Server Error</h1>
      <p>Something went wrong. Please try again later.</p>
    </div>
  );
}
