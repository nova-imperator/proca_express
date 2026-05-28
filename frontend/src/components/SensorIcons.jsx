// Stroke icons for the device sensor cards. Each is a self-contained SVG that
// inherits `currentColor` so the parent can tint it per metric.
const base = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
};

export function ThermometerIcon() {
  return (
    <svg {...base}>
      <path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z" />
    </svg>
  );
}
export function DropletIcon() {
  return (
    <svg {...base}>
      <path d="M12 2.5s6 6.5 6 10.5a6 6 0 0 1-12 0c0-4 6-10.5 6-10.5Z" />
    </svg>
  );
}
export function SunIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
export function ShockIcon() {
  // Accelerometer / impact — a zig-zag activity line.
  return (
    <svg {...base}>
      <path d="M22 12h-4l-3 8-6-16-3 8H2" />
    </svg>
  );
}
export function BatteryIcon() {
  return (
    <svg {...base}>
      <rect x="2" y="7" width="16" height="10" rx="2" />
      <line x1="22" y1="11" x2="22" y2="13" />
    </svg>
  );
}
export function ClockIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
