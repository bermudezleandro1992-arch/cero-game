export default function ConfigWarning() {
  return (
    <div className="page">
      <div className="card config-card">
        <h1>Configuración requerida</h1>
        <p>
          Falta configurar Firebase. Copiá <code>.env.example</code> a <code>.env</code> y
          completá las variables <code>VITE_FIREBASE_*</code>.
        </p>
      </div>
    </div>
  );
}
