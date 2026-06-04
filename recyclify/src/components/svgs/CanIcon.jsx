/* SVG: drink can / cylinder — used for the "Metal" material type card */
export default function CanIcon({ size = 32, color = 'currentColor', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8z" />
      <path d="M8 2c0 1.1 1.8 2 4 2s4-.9 4-2" />
      <path d="M8 22c0-1.1 1.8-2 4-2s4 .9 4 2" />
      <path d="M10 8h4" />
      <path d="M10 12h4" />
    </svg>
  )
}
