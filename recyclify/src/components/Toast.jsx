import { useEffect, useRef } from 'react'
import CheckIcon from './svgs/CheckIcon'
import AlertIcon from './svgs/AlertIcon'

/* Toast is controlled by a global state object:
   { visible, title, message, type: 'success' | 'error' | 'info' } */
export default function Toast({ toast }) {
  const timerRef = useRef(null)

  const isError = toast.type === 'error'
  const iconColor = isError ? 'var(--danger)' : 'var(--mint)'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 26,
        left: '50%',
        transform: `translateX(-50%) translateY(${toast.visible ? '0' : '120px'})`,
        zIndex: 200,
        background: 'var(--panel-2)',
        border: '1px solid var(--line-strong)',
        borderRadius: 14,
        padding: '14px 22px',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'transform .4s cubic-bezier(.2,.9,.2,1)',
        minWidth: 260,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', color: iconColor }}>
        {isError
          ? <AlertIcon size={22} color={iconColor} />
          : <CheckIcon size={22} color={iconColor} />
        }
      </span>
      <div>
        <b style={{ fontSize: 14 }}>{toast.title}</b>
        {toast.message && (
          <small style={{ color: 'var(--muted)', fontSize: 12, display: 'block' }}>
            {toast.message}
          </small>
        )}
      </div>
    </div>
  )
}
