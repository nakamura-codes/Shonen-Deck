/**
 * Arenas sorteadas a cada partida (2 por anime). A imagem fica em client/public/assets/arenas/<id>.png.
 */
export const ARENAS = [
  // Dragon Ball
  { id: 'torneio_mundial', name: 'Torneio Mundial' },
  { id: 'dragon_ball_arena_cell', name: 'Arena do Cell' },
  // One Piece
  { id: 'marineford', name: 'Marineford' },
  { id: 'one_piece_thousand_sunny', name: 'Thousand Sunny' },
  // Naruto
  { id: 'vale_do_fim', name: 'Vale do Fim' },
  { id: 'naruto_exame_chunin', name: 'Exame Chunin' },
  // Bleach
  { id: 'fortaleza_lunar', name: 'Fortaleza Lunar' },
  { id: 'bleach_soul_society', name: 'Soul Society' },
  // Jujutsu Kaisen
  { id: 'jujutsu_escola_dia', name: 'Escola Jujutsu' },
  { id: 'jujutsu_shibuya', name: 'Shibuya' },
] as const;
