// ════════════════════════════════════════════════════════════
// BASE DE DATOS MAESTRA DE TIENDAS — Panamá
// Cadenas: Super 99, El Machetazo, El Fuerte
// gpsAprox: false = coordenada exacta (de la fuente oficial)
//           true  = aproximada (afinar pegando link de Google Maps)
// Fuente Super 99: super99.com/sucursales
// ════════════════════════════════════════════════════════════

export const TIENDAS_PANAMA = [
  // ───────────── SUPER 99 — Ciudad de Panamá ─────────────
  { chain: 'Super 99', name: '99 San Miguelito',     ciudad: 'San Miguelito', provincia: 'Panamá', lat: 9.0300, lng: -79.5083, gpsAprox: false },
  { chain: 'Super 99', name: '99 Paitilla',          ciudad: 'Panamá',        provincia: 'Panamá', lat: 8.9784, lng: -79.5146, gpsAprox: false },
  { chain: 'Super 99', name: '99 Tumba Muerto',      ciudad: 'Panamá',        provincia: 'Panamá', lat: 8.9999, lng: -79.5350, gpsAprox: false },
  { chain: 'Super 99', name: '99 Brisas del Golf',   ciudad: 'Panamá',        provincia: 'Panamá', lat: 9.0693, lng: -79.4555, gpsAprox: false },
  { chain: 'Super 99', name: '99 Villa Lucre',       ciudad: 'San Miguelito', provincia: 'Panamá', lat: 9.0411, lng: -79.4806, gpsAprox: false },
  { chain: 'Super 99', name: '99 Vía Porras',        ciudad: 'Panamá',        provincia: 'Panamá', lat: 8.9922, lng: -79.5196, gpsAprox: false },
  { chain: 'Super 99', name: '99 San Francisco',     ciudad: 'Panamá',        provincia: 'Panamá', lat: 8.9921, lng: -79.5023, gpsAprox: false },
  { chain: 'Super 99', name: '99 Condado del Rey',   ciudad: 'Panamá',        provincia: 'Panamá', lat: 9.0377, lng: -79.5316, gpsAprox: false },
  { chain: 'Super 99', name: '99 El Dorado',         ciudad: 'Panamá',        provincia: 'Panamá', lat: 9.0078, lng: -79.5375, gpsAprox: false },
  { chain: 'Super 99', name: '99 Costa del Este',    ciudad: 'Panamá',        provincia: 'Panamá', lat: 9.0162, lng: -79.4677, gpsAprox: false },
  { chain: 'Super 99', name: '99 Chanis',            ciudad: 'Panamá',        provincia: 'Panamá', lat: 9.0177, lng: -79.4865, gpsAprox: false },
  { chain: 'Super 99', name: '99 La Cabima',         ciudad: 'San Miguelito', provincia: 'Panamá', lat: 9.1064, lng: -79.5382, gpsAprox: false },
  { chain: 'Super 99', name: '99 Albrook Mall',      ciudad: 'Panamá',        provincia: 'Panamá', lat: 8.9767, lng: -79.5532, gpsAprox: false },
  { chain: 'Super 99', name: '99 Los Andes',         ciudad: 'San Miguelito', provincia: 'Panamá', lat: 9.0503, lng: -79.5098, gpsAprox: false },
  { chain: 'Super 99', name: '99 La Doña',           ciudad: 'Tocumen',       provincia: 'Panamá', lat: 9.1019, lng: -79.3844, gpsAprox: false },
  { chain: 'Super 99', name: '99 Río Abajo',         ciudad: 'Panamá',        provincia: 'Panamá', lat: 9.0130, lng: -79.5043, gpsAprox: false },
  { chain: 'Super 99', name: '99 Plaza Tocumen',     ciudad: 'Tocumen',       provincia: 'Panamá', lat: 9.0610, lng: -79.4247, gpsAprox: false },
  { chain: 'Super 99', name: '99 Mañanitas',         ciudad: 'Tocumen',       provincia: 'Panamá', lat: 9.0805, lng: -79.4111, gpsAprox: false },
  { chain: 'Super 99', name: '99 Los Pueblos',       ciudad: 'Panamá',        provincia: 'Panamá', lat: 9.0488, lng: -79.4531, gpsAprox: false },
  { chain: 'Super 99', name: '99 Villa Zaita',       ciudad: 'Panamá',        provincia: 'Panamá', lat: 9.0749, lng: -79.5256, gpsAprox: false },
  { chain: 'Super 99', name: '99 Megamall',          ciudad: 'San Miguelito', provincia: 'Panamá', lat: 9.0850, lng: -79.3820, gpsAprox: true },
  { chain: 'Super 99', name: '99 Bethania',          ciudad: 'Panamá',        provincia: 'Panamá', lat: 9.0080, lng: -79.5230, gpsAprox: true },
  { chain: 'Super 99', name: '99 Los Andes Mall',    ciudad: 'San Miguelito', provincia: 'Panamá', lat: 9.0510, lng: -79.5090, gpsAprox: true },
  { chain: 'Super 99', name: '99 El Faro',           ciudad: 'Panamá',        provincia: 'Panamá', lat: 9.0130, lng: -79.4700, gpsAprox: true },
  { chain: 'Super 99', name: '99 Pedregal',          ciudad: 'Panamá',        provincia: 'Panamá', lat: 9.0680, lng: -79.4760, gpsAprox: true },
  { chain: 'Super 99', name: '99 Balboa',            ciudad: 'Panamá',        provincia: 'Panamá', lat: 8.9560, lng: -79.5650, gpsAprox: true },
  { chain: 'Super 99', name: '99 Vista Hermosa',     ciudad: 'San Miguelito', provincia: 'Panamá', lat: 9.0420, lng: -79.4920, gpsAprox: true },
  { chain: 'Super 99', name: '99 Calidonia',         ciudad: 'Panamá',        provincia: 'Panamá', lat: 8.9710, lng: -79.5340, gpsAprox: true },
  { chain: 'Super 99', name: '99 Transístmica',      ciudad: 'Panamá',        provincia: 'Panamá', lat: 9.0300, lng: -79.5300, gpsAprox: true },
  { chain: 'Super 99', name: '99 San Lorenzo',       ciudad: 'San Miguelito', provincia: 'Panamá', lat: 9.1307, lng: -79.5337, gpsAprox: false },
  { chain: 'Super 99', name: '99 Montemadero',       ciudad: 'San Miguelito', provincia: 'Panamá', lat: 9.1307, lng: -79.5337, gpsAprox: true },

  // ───────────── SUPER 99 — Panamá Oeste ─────────────
  { chain: 'Super 99', name: '99 El Coco',           ciudad: 'La Chorrera', provincia: 'Panamá Oeste', lat: 8.8737, lng: -79.7992, gpsAprox: false },
  { chain: 'Super 99', name: '99 Plaza Italia',      ciudad: 'La Chorrera', provincia: 'Panamá Oeste', lat: 8.8882, lng: -79.7712, gpsAprox: false },
  { chain: 'Super 99', name: "99 On D' Go Chorrera", ciudad: 'La Chorrera', provincia: 'Panamá Oeste', lat: 8.8774, lng: -79.7629, gpsAprox: false },
  { chain: 'Super 99', name: '99 Valle Hermoso',     ciudad: 'Arraiján',    provincia: 'Panamá Oeste', lat: 8.9278, lng: -79.7291, gpsAprox: false },
  { chain: 'Super 99', name: '99 Brisas de Arraiján',ciudad: 'Arraiján',    provincia: 'Panamá Oeste', lat: 8.9736, lng: -79.7086, gpsAprox: false },
  { chain: 'Super 99', name: '99 Vacamonte',         ciudad: 'Arraiján',    provincia: 'Panamá Oeste', lat: 8.9151, lng: -79.7057, gpsAprox: false },
  { chain: 'Super 99', name: '99 Town Center Arraiján', ciudad: 'Burunga',  provincia: 'Panamá Oeste', lat: 8.9597, lng: -79.6558, gpsAprox: false },

  // ───────────── SUPER 99 — Provincias Centrales ─────────────
  { chain: 'Super 99', name: '99 Penonomé',          ciudad: 'Penonomé',  provincia: 'Coclé',    lat: 8.5084, lng: -80.3640, gpsAprox: false },
  { chain: 'Super 99', name: '99 Santiago',          ciudad: 'Santiago',  provincia: 'Veraguas', lat: 8.1018, lng: -80.9805, gpsAprox: true },
  { chain: 'Super 99', name: '99 Coronado',          ciudad: 'Coronado',  provincia: 'Panamá Oeste', lat: 8.5200, lng: -80.0400, gpsAprox: true },
  { chain: 'Super 99', name: '99 Chitré',            ciudad: 'Chitré',    provincia: 'Herrera',  lat: 7.9540, lng: -80.4263, gpsAprox: false },
  { chain: 'Super 99', name: '99 Río Hato',          ciudad: 'Río Hato',  provincia: 'Coclé',    lat: 8.3730, lng: -80.1568, gpsAprox: false },
  { chain: 'Super 99', name: "99 On D'Go Aguadulce", ciudad: 'Aguadulce', provincia: 'Coclé',    lat: 8.2484, lng: -80.5532, gpsAprox: false },

  // ───────────── SUPER 99 — Colón ─────────────
  { chain: 'Super 99', name: '99 Colón 2000',        ciudad: 'Colón', provincia: 'Colón', lat: 9.3590, lng: -79.9010, gpsAprox: true },
  { chain: 'Super 99', name: '99 Sabanitas',         ciudad: 'Colón', provincia: 'Colón', lat: 9.3490, lng: -79.8137, gpsAprox: false },
  { chain: 'Super 99', name: '99 Puerto Escondido',  ciudad: 'Colón', provincia: 'Colón', lat: 9.3403, lng: -79.8739, gpsAprox: false },
  { chain: 'Super 99', name: '99 Colón Centro',      ciudad: 'Colón', provincia: 'Colón', lat: 9.3604, lng: -79.9059, gpsAprox: false },

  // ───────────── SUPER 99 — Chiriquí ─────────────
  { chain: 'Super 99', name: '99 San Mateo',         ciudad: 'David',  provincia: 'Chiriquí', lat: 8.4280, lng: -82.4392, gpsAprox: false },
  { chain: 'Super 99', name: '99 Plaza Corotú',      ciudad: 'David',  provincia: 'Chiriquí', lat: 8.4443, lng: -82.4234, gpsAprox: false },
  { chain: 'Super 99', name: '99 Bugaba',            ciudad: 'Bugaba', provincia: 'Chiriquí', lat: 8.5152, lng: -82.6210, gpsAprox: false },

  // ───────────── EL MACHETAZO ─────────────
  { chain: 'El Machetazo', name: 'Machetazo Hato Montaña', ciudad: 'Arraiján',    provincia: 'Panamá Oeste', lat: 8.9430, lng: -79.7430, gpsAprox: true },
  { chain: 'El Machetazo', name: 'Machetazo Calidonia',    ciudad: 'Panamá',      provincia: 'Panamá',       lat: 8.9685, lng: -79.5320, gpsAprox: true },
  { chain: 'El Machetazo', name: 'Machetazo Chitré',       ciudad: 'Chitré',      provincia: 'Herrera',      lat: 7.9620, lng: -80.4310, gpsAprox: true },
  { chain: 'El Machetazo', name: 'Machetazo Costa Sur',    ciudad: 'Juan Díaz',   provincia: 'Panamá',       lat: 9.0080, lng: -79.4520, gpsAprox: true },
  { chain: 'El Machetazo', name: 'Machetazo Coronado',     ciudad: 'Chame',       provincia: 'Panamá Oeste', lat: 8.4290, lng: -79.9880, gpsAprox: true },
  { chain: 'El Machetazo', name: 'Machetazo MetroMall',    ciudad: 'San Miguelito',provincia: 'Panamá',      lat: 9.0680, lng: -79.4490, gpsAprox: true },
  { chain: 'El Machetazo', name: 'Machetazo Santa Ana',    ciudad: 'Panamá',      provincia: 'Panamá',       lat: 8.9530, lng: -79.5360, gpsAprox: true },
  { chain: 'El Machetazo', name: 'Machetazo Santiago',     ciudad: 'Santiago',    provincia: 'Veraguas',     lat: 8.1020, lng: -80.9900, gpsAprox: true },
  { chain: 'El Machetazo', name: 'Machetazo Penonomé',     ciudad: 'Penonomé',    provincia: 'Coclé',        lat: 8.5180, lng: -80.3570, gpsAprox: true },
  { chain: 'El Machetazo', name: 'Machetazo Tocumen',      ciudad: 'Tocumen',     provincia: 'Panamá',       lat: 9.0850, lng: -79.3850, gpsAprox: true },

  // ───────────── EL FUERTE ─────────────
  { chain: 'El Fuerte', name: 'El Fuerte Westland',      ciudad: 'Arraiján',      provincia: 'Panamá Oeste', lat: 8.9189, lng: -79.7975, gpsAprox: true },
  { chain: 'El Fuerte', name: 'El Fuerte Burunga',       ciudad: 'Burunga',       provincia: 'Panamá Oeste', lat: 8.9590, lng: -79.6560, gpsAprox: true },
  { chain: 'El Fuerte', name: 'El Fuerte San Miguelito', ciudad: 'San Miguelito', provincia: 'Panamá',       lat: 9.0470, lng: -79.5300, gpsAprox: true },
  { chain: 'El Fuerte', name: 'El Fuerte Villa Zaíta',   ciudad: 'Panamá',        provincia: 'Panamá',       lat: 9.0749, lng: -79.5256, gpsAprox: true },
]
