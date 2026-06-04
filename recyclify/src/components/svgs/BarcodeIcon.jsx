/* SVG: barcode — represents a scannable product barcode */
export default function BarcodeIcon({ size = 20, color = 'currentColor', ...props }) {
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
      <path d="M3 5v1M3 10v4M3 19v1M8 5v6M8 16v4M13 5v1M13 10v4M13 19v1M18 5v6M18 16v4M21 5v1M21 10v4M21 19v1" />
    </svg>
  )
}
