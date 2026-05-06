function MaintenanceToggleButton({ visible, maintenanceMode, onToggle }) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="bb-add-btn"
      style={{
        display: 'block',
        margin: '18px auto 0 auto',
        width: 'auto',
        maxWidth: 'calc(100vw - 32px)',
        padding: '10px 18px',
        fontSize: '0.95rem',
        fontWeight: 700,
        background: maintenanceMode ? '#ff6600' : '#222',
        color: '#fff',
        border: 'none',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        cursor: 'pointer',
        textAlign: 'center',
      }}
    >
      {maintenanceMode ? 'DISATTIVA MANUTENZIONE' : 'ATTIVA MANUTENZIONE'}
    </button>
  );
}

export default MaintenanceToggleButton;