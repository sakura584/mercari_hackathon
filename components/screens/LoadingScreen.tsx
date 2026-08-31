export function LoadingScreen({ message }: { message: string }) {
  return (
    <section className="screen active">
      <div className="screen-scroll">
        <div className="card">
          <div className="spinner" />
          <div>{message}</div>
        </div>
      </div>
    </section>
  );
}
