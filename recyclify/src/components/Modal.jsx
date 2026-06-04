export default function Modal({ modal, onClose }) {
  if (!modal.visible) return null

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3,10,7,.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 150,
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: '100%',
          padding: 30,
          textAlign: 'center',
          background: 'linear-gradient(160deg,var(--panel-2),var(--panel))',
          border: '1px solid var(--line-strong)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
        }}
      >
        {/* icon slot — pass an SVG component as modal.icon */}
        {modal.icon && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, color: 'var(--lime)' }}>
            {modal.icon}
          </div>
        )}
        <h3 style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 24, margin: '0 0 8px' }}>
          {modal.title}
        </h3>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 22, fontWeight: 300, lineHeight: 1.6 }}>
          {modal.text}
        </p>
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={onClose}
        >
          Got it
        </button>
      </div>
    </div>
  )
}
