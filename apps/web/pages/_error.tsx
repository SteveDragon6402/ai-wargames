function ErrorPage({ statusCode }: { statusCode?: number }) {
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
      <h1 style={{ color: "#f2f2f2", fontWeight: 600 }}>
        {statusCode ? `${statusCode} – Server Error` : "Client Error"}
      </h1>
      <p>Something went wrong. Please try again later.</p>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: { res?: { statusCode: number }; err?: { statusCode: number } }) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 500;
  return { statusCode };
};

export default ErrorPage;
