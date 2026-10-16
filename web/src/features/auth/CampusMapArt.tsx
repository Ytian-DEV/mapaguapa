/**
 * Decorative map of streets around campus for the auth panel (frame 01).
 * Pure illustration: no real data, hidden from assistive tech.
 */
export function CampusMapArt() {
  const blocks: Array<[number, number, number, number]> = [];
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      blocks.push([col * 96 + 12, row * 92 + 10, 76 + ((row + col) % 3) * 6, 64]);
    }
  }

  return (
    <svg aria-hidden="true" className="auth-art" focusable="false" preserveAspectRatio="xMidYMid slice" viewBox="0 0 860 830">
      <g className="auth-art__blocks">
        {blocks.map(([x, y, w, h]) => (
          <rect height={h} key={`${x}-${y}`} rx={6} width={w} x={x} y={y} />
        ))}
      </g>
      <path className="auth-art__river" d="M-20 470 C 140 430, 260 520, 430 480 S 720 420, 880 470" />
      <path className="auth-art__road" d="M-20 210 C 160 150, 330 260, 520 190 S 760 150, 880 200" />
      <path className="auth-art__road" d="M200 -20 C 210 200, 190 420, 230 840" />
      <path className="auth-art__road" d="M610 -20 C 590 240, 640 520, 600 840" />
      <path className="auth-art__road auth-art__road--thin" d="M-20 660 C 220 640, 520 700, 880 620" />
      {[
        [240, 240],
        [690, 182],
        [538, 352],
        [120, 330],
        [410, 300],
      ].map(([cx, cy]) => (
        <g className="auth-art__pin" key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r={16} />
          <circle cx={cx} cy={cy} r={6} />
        </g>
      ))}
    </svg>
  );
}
