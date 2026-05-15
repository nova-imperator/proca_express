// Inline SVG brand mark — no extra dependency, scales perfectly.
export default function BrandMark({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pe-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#pe-grad)" />
      <path
        d="M11 22V10h5.2c2.65 0 4.4 1.55 4.4 4s-1.75 4-4.4 4H14v4h-3Zm3-6.4h2.1c1 0 1.6-.6 1.6-1.6s-.6-1.6-1.6-1.6H14v3.2Z"
        fill="white"
      />
    </svg>
  );
}
