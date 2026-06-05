// Logo de FreshCo — ícono (sol + hoja + fruta) + wordmark
export default function Logo({ size = 'md', light = false }) {
  const px = size === 'lg' ? 60 : size === 'sm' ? 30 : 42
  const fs = size === 'lg' ? 38 : size === 'sm' ? 20 : 26

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size === 'sm' ? 8 : 11 }}>
      <svg width={px} height={px} viewBox="0 0 48 48" fill="none" aria-hidden>
        {/* hoja verde */}
        <ellipse cx="13" cy="14" rx="10" ry="5.2" fill="#8CC63F" transform="rotate(-38 13 14)" />
        <path d="M7 18 Q13 13 19 9" stroke="#5FA516" strokeWidth="1.2" fill="none" />
        {/* sol amarillo */}
        <circle cx="22" cy="26" r="16" fill="#FFD400" />
        {/* fruta naranja */}
        <circle cx="34" cy="15" r="7" fill="#F7941E" />
        <circle cx="31" cy="12.5" r="1.8" fill="#fff" opacity="0.75" />
        {/* burbuja azul */}
        <circle cx="30" cy="33" r="3.4" fill="#0096DB" />
      </svg>
      <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: fs, lineHeight: 1, letterSpacing: '-0.5px' }}>
        <span style={{ color: light ? '#FFFFFF' : 'var(--azul)' }}>Fresh</span>
        <span style={{ color: light ? '#FFD400' : 'var(--azul-osc)' }}>Co</span>
      </div>
    </div>
  )
}
