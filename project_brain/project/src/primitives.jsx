// Kaenal — icons & primitives
// Inline SVG icons (Lucide-style) + shared UI primitives

const Icon = ({ name, size = 16, stroke = 2, className = '' }) => {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} style={{ flexShrink: 0 }}>
      {typeof paths === 'string'
        ? <g dangerouslySetInnerHTML={{ __html: paths }} />
        : paths}
    </svg>
  );
};

const ICONS = {
  logo: '<path d="M3 12 L12 3 L21 12 L12 21 Z" fill="currentColor" fill-opacity="0.15"/><path d="M3 12 L12 3 L21 12 L12 21 Z"/><path d="M8 12 L12 8 L16 12 L12 16 Z" fill="currentColor"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  clipboard: '<path d="M9 2h6a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V4a2 2 0 0 1 2-2Z"/><path d="M9 12l2 2 4-4"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  brain: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
  reports: '<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  mapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  arrowUp: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  arrowDown: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  trending: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  paperclip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  package: '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  command: '<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>',
  logOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  panelLeft: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>',
  tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  gitBranch: '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  folderOpen: '<path d="M6 14l1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  bot: '<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  server: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2.5"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 8 11 8a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 1 13s4 8 11 8a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>',
  truck: '<path d="M5 18a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/><path d="M19 18a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/><path d="M14 16V4H1v12h2"/><path d="M14 8h4l4 4v4h-2"/><path d="M14 16h-3"/>',
  award: '<circle cx="12" cy="8" r="6"/><polyline points="8.21 13.89 7 22 12 19 17 22 15.79 13.88"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>',
  signal: '<line x1="2" y1="20" x2="2" y2="20"/><line x1="6" y1="20" x2="6" y2="16"/><line x1="10" y1="20" x2="10" y2="12"/><line x1="14" y1="20" x2="14" y2="8"/><line x1="18" y1="20" x2="18" y2="4"/>',
  battery: '<rect x="2" y="7" width="18" height="10" rx="2"/><line x1="22" y1="11" x2="22" y2="13"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="17"/><line x1="17" y1="14" x2="17" y2="21"/><line x1="14" y1="20" x2="17" y2="20"/><line x1="20" y1="14" x2="20" y2="17"/><line x1="20" y1="20" x2="21" y2="20"/>',
  pen: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.78A6 6 0 0 0 5 13.5 4 4 0 0 0 6.5 21h11Z"/>',
  cloudOff: '<path d="M22 17.5a4.5 4.5 0 0 0-3.66-4.43"/><path d="M5 13.5A4 4 0 0 0 6.5 21h10.18"/><path d="M16 9a6 6 0 0 0-9.86-2.51"/><line x1="2" y1="2" x2="22" y2="22"/>',
  thumbsUp: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  presets: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  history: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
  filePdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="7" y="17" font-size="6" font-weight="700" fill="currentColor" stroke="none">PDF</text>',
  fileXls: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="8" y="17" font-size="6" font-weight="700" fill="currentColor" stroke="none">XLS</text>',
  fileImg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="9" cy="14" r="1.5"/><polyline points="8 18 11 15 14 18 18 14"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  drag: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  pieChart: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  barChart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  lineChart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>',
  hash: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
  type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
};

// —— User hover card ——
// Derive a plausible work email from a display name (handles diacritics).
const userEmail = (u) => {
  if (u.email) return u.email;
  const slug = u.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.');
  return `${slug}@kaenal.io`;
};
// Stable presence per user (deterministic, no random churn on re-render).
const PRESENCE = { online: { dot: '#22c55e', label: 'Active now' }, away: { dot: '#f59e0b', label: 'Away' }, offline: { dot: '#94a3b8', label: 'Offline' } };
const userPresence = (u) => {
  const key = (u.id || u.initials || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return [ 'online', 'online', 'away', 'online', 'offline' ][key % 5];
};

const UserHoverCard = ({ user, anchorRect, onEnter, onLeave }) => {
  if (!anchorRect) return null;
  const W = 256;
  const gap = 10;
  let left = anchorRect.left + anchorRect.width / 2 - W / 2;
  left = Math.max(12, Math.min(left, window.innerWidth - W - 12));
  const below = anchorRect.bottom + 150 < window.innerHeight || anchorRect.top < 160;
  const top = below ? anchorRect.bottom + gap : anchorRect.top - gap;
  const pres = PRESENCE[userPresence(user)];
  return ReactDOM.createPortal(
    <div
      onMouseEnter={onEnter} onMouseLeave={onLeave}
      style={{
        position: 'fixed', left, top, width: W, zIndex: 9999,
        transform: below ? 'none' : 'translateY(-100%)',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg, 12px)', boxShadow: 'var(--shadow-lg, 0 16px 40px rgba(15,23,42,0.18))',
        padding: 16, animation: 'k-hovercard-in 110ms ease-out', transformOrigin: below ? 'top' : 'bottom',
      }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', background: user.color, color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 600, flexShrink: 0, letterSpacing: '0.02em',
        }}>{user.initials}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.25 }}>{user.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 1 }}>{user.role}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: pres.dot, flexShrink: 0 }}/>
        {pres.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7, fontSize: 12, color: 'var(--text-muted)' }}>
        <Icon name="mail" size={13} stroke={1.6}/>
        <span style={{ fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail(user)}</span>
      </div>
    </div>,
    document.body
  );
};

// —— Avatar ——
const Avatar = ({ user, size = 28, hoverCard = true }) => {
  const u = typeof user === 'string' ? userById(user) : user;
  const [rect, setRect] = React.useState(null);
  const ref = React.useRef(null);
  const timer = React.useRef(null);
  if (!u) return null;

  const show = () => {
    clearTimeout(timer.current);
    if (ref.current) setRect(ref.current.getBoundingClientRect());
  };
  const hide = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setRect(null), 120);
  };

  return (
    <span
      ref={ref}
      onMouseEnter={hoverCard ? show : undefined}
      onMouseLeave={hoverCard ? hide : undefined}
      style={{ display: 'inline-flex', flexShrink: 0 }}>
      <span style={{
        width: size, height: size, borderRadius: '50%',
        background: u.color, color: 'white',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 600, flexShrink: 0,
        letterSpacing: '0.02em', cursor: hoverCard ? 'default' : 'inherit',
      }}>{u.initials}</span>
      {hoverCard && rect && <UserHoverCard user={u} anchorRect={rect} onEnter={show} onLeave={hide}/>}
    </span>
  );
};

// —— Status / Priority / Risk badges ——
const STATUS_STYLES = {
  draft:       { label: 'Draft',       bg: 'rgba(167,139,250,0.12)', fg: '#7c3aed', dot: '#a78bfa' },
  scheduled:   { label: 'Scheduled',   bg: 'rgba(59,130,246,0.12)',  fg: 'var(--primary-700)', dot: '#3b82f6' },
  open:        { label: 'Open',        bg: 'rgba(59,130,246,0.12)',  fg: 'var(--primary-700)', dot: '#3b82f6' },
  assigned:    { label: 'Assigned',    bg: 'rgba(99,102,241,0.12)',  fg: '#4f46e5', dot: '#6366f1' },
  in_progress: { label: 'In Progress', bg: 'rgba(245,158,11,0.14)',  fg: 'var(--warning-700)', dot: '#f59e0b' },
  resolved:    { label: 'Resolved',    bg: 'rgba(34,197,94,0.14)',   fg: 'var(--success-700)', dot: '#22c55e' },
  verified:    { label: 'Verified',    bg: 'rgba(16,185,129,0.14)',  fg: '#047857', dot: '#10b981' },
  closed:      { label: 'Closed',      bg: 'rgba(100,116,139,0.16)', fg: '#475569', dot: '#64748b' },
  completed:   { label: 'Completed',   bg: 'rgba(34,197,94,0.14)',   fg: 'var(--success-700)', dot: '#22c55e' },
  overdue:     { label: 'Overdue',     bg: 'rgba(220,38,38,0.12)',   fg: 'var(--danger-700)', dot: '#dc2626' },
  escalated:   { label: 'Escalated',   bg: 'rgba(236,72,153,0.12)',  fg: '#be185d', dot: '#ec4899' },
  cancelled:   { label: 'Cancelled',   bg: 'rgba(100,116,139,0.16)', fg: '#475569', dot: '#64748b' },
  active:      { label: 'Active',      bg: 'rgba(245,158,11,0.14)',  fg: 'var(--warning-700)', dot: '#f59e0b' },
  pending:     { label: 'Pending',     bg: 'rgba(100,116,139,0.16)', fg: '#475569', dot: '#94a3b8' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.open;
  return (
    <span className="k-chip" style={{ background: s.bg, color: s.fg }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }}/>
      {s.label}
    </span>
  );
};

const PRIORITY_STYLES = {
  critical: { label: 'Critical', bg: 'rgba(220,38,38,0.12)', fg: '#b91c1c' },
  major:    { label: 'Major',    bg: 'rgba(234,88,12,0.14)', fg: '#c2410c' },
  minor:    { label: 'Minor',    bg: 'rgba(245,158,11,0.14)', fg: '#b45309' },
};
const PriorityBadge = ({ priority }) => {
  const p = PRIORITY_STYLES[priority] || PRIORITY_STYLES.minor;
  return <span className="k-chip" style={{ background: p.bg, color: p.fg, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>{p.label}</span>;
};

const RISK_STYLES = {
  critical: { label: 'Critical', bg: 'rgba(220,38,38,0.12)', fg: '#b91c1c' },
  major:    { label: 'Major',    bg: 'rgba(234,88,12,0.14)', fg: '#c2410c' },
  high:     { label: 'High',     bg: 'rgba(234,88,12,0.14)', fg: '#c2410c' },
  medium:   { label: 'Medium',   bg: 'rgba(245,158,11,0.14)', fg: '#b45309' },
  minor:    { label: 'Minor',    bg: 'rgba(245,158,11,0.14)', fg: '#b45309' },
  low:      { label: 'Low',      bg: 'rgba(34,197,94,0.14)', fg: '#15803d' },
  info:     { label: 'Info',     bg: 'rgba(99,102,241,0.12)', fg: '#4338ca' },
};
const RiskBadge = ({ risk }) => {
  if (!risk) return <span style={{ color: 'var(--text-subtle)' }}>—</span>;
  const r = RISK_STYLES[risk] || { label: String(risk).charAt(0).toUpperCase() + String(risk).slice(1), bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' };
  return <span className="k-chip" style={{ background: r.bg, color: r.fg }}>{r.label}</span>;
};

// —— Entity link ——
const EntityLink = ({ id, onClick, muted = false }) => (
  <button onClick={onClick}
    style={{
      fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
      color: muted ? 'var(--text-muted)' : 'var(--accent)',
      padding: 0, display: 'inline-flex', alignItems: 'center',
    }}
    onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
    onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
  >{id}</button>
);

// —— Empty state ——
const EmptyState = ({ icon = 'clipboard', title, body, action }) => (
  <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
    <div style={{ display: 'inline-flex', padding: 16, borderRadius: '50%', background: 'var(--bg-subtle)', marginBottom: 16 }}>
      <Icon name={icon} size={32} stroke={1.5} />
    </div>
    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
    {body && <div style={{ fontSize: 13, marginBottom: 16 }}>{body}</div>}
    {action}
  </div>
);

// —— Segmented control ——
const Segmented = ({ options, value, onChange, size = 'md' }) => (
  <div style={{
    display: 'inline-flex', padding: 3, background: 'var(--bg-subtle)',
    borderRadius: 'var(--r-md)', border: '1px solid var(--border)', gap: 2,
  }}>
    {options.map(o => (
      <button key={o.value} onClick={() => onChange(o.value)}
        style={{
          padding: size === 'sm' ? '4px 10px' : '6px 12px',
          fontSize: size === 'sm' ? 12 : 13, fontWeight: 500,
          borderRadius: 'var(--r-sm)',
          background: value === o.value ? 'var(--surface)' : 'transparent',
          color: value === o.value ? 'var(--text)' : 'var(--text-muted)',
          boxShadow: value === o.value ? 'var(--shadow-xs)' : 'none',
          transition: 'all 120ms',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>{o.icon && <Icon name={o.icon} size={14}/>}{o.label}</button>
    ))}
  </div>
);

Object.assign(window, {
  Icon, Avatar, StatusBadge, PriorityBadge, RiskBadge,
  EntityLink, EmptyState, Segmented,
  STATUS_STYLES, PRIORITY_STYLES, RISK_STYLES,
});

// —— Global imperative toast — lightweight feedback for any action button ——
// Usage: kToast('Export started — audit-pack.pdf')
window.kToast = (message) => {
  let host = document.getElementById('k-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'k-toast-host';
    host.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999;display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none;';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.style.cssText = 'background:var(--text);color:var(--surface);padding:12px 18px;border-radius:var(--r-md);box-shadow:var(--shadow-lg);display:flex;align-items:center;gap:10px;font-size:13px;font-weight:500;max-width:420px;animation:slideUpToast 200ms ease-out;cursor:pointer;pointer-events:auto;';
  el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  const span = document.createElement('span');
  span.textContent = message;
  el.appendChild(span);
  el.onclick = () => el.remove();
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 200ms';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 220);
  }, 3200);
};
