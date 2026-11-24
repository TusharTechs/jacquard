// Scene 1, the problem (0:00 to 0:21). Everything drawn here is real output: the Peacock butta
// gallery design, its lift plan from @jacquard/engine, its first cards laid out by
// @jacquard/export's cardSheetLayout, and the one float the engine reports over the limit.
import { Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardData, ProblemData } from "../data";
import { Stock } from "../parts";
import { COLOURS, FONTS, FPS } from "../theme";

/** One punched card, drawn from cardSheetLayout's geometry (millimetres scaled to `scale` px). */
export function Card({ card, data, scale, lit = false }: { readonly card: CardData; readonly data: ProblemData; readonly scale: number; readonly lit?: boolean }) {
  const { width, height, holeRadius, laceRadius, numberX, numberY } = data.card;
  return (
    <svg width={width * scale} height={height * scale} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", filter: "drop-shadow(0 6px 10px rgb(60 40 20 / 0.25))" }}>
      <rect x={0.2} y={0.2} width={width - 0.4} height={height - 0.4} rx={1.6} fill={COLOURS.paper} stroke={lit ? COLOURS.brass : COLOURS.lineStrong} strokeWidth={lit ? 0.8 : 0.35} />
      {card.holes.map((hole, index) =>
        hole.punched ? (
          <circle key={index} cx={hole.x} cy={hole.y} r={holeRadius} fill={COLOURS.walnut} />
        ) : (
          <circle key={index} cx={hole.x} cy={hole.y} r={holeRadius * 0.55} fill="none" stroke={COLOURS.line} strokeWidth={0.25} />
        ),
      )}
      {card.laceMarks.map((mark, index) => (
        <circle key={`l${index}`} cx={mark.x} cy={mark.y} r={laceRadius} fill={COLOURS.ink} />
      ))}
      <text x={numberX} y={numberY} fontFamily={FONTS.mono} fontSize={3} fill={COLOURS.ink} textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90 ${numberX} ${numberY})`}>
        {card.number}
      </text>
    </svg>
  );
}

/** 0 to 7 s: the laced chain, one card at a time, each with the app's card clack. */
function CardChain({ data }: { readonly data: ProblemData }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cards = data.card.cards.slice(0, 9);
  const every = Math.round(0.62 * fps);
  const scale = 7.4;
  const gap = 20;
  const step = data.card.height * scale + gap;
  const drift = interpolate(frame, [0, 7 * fps], [140, -220]);
  return (
    <Stock>
      <div style={{ position: "absolute", left: "50%", top: 0, transform: `translate(-50%, ${drift}px)` }}>
        {cards.map((card, index) => {
          const t = spring({ frame: frame - index * every, fps, config: { damping: 18, mass: 0.6 } });
          return (
            <div key={card.number} style={{ position: "absolute", top: index * step, left: -(data.card.width * scale) / 2, opacity: t, transform: `translateY(${(1 - t) * -40}px)` }}>
              <Card card={card} data={data} scale={scale} />
              {/* The lacing between cards. */}
              {index < cards.length - 1 ? (
                <svg width={data.card.width * scale} height={gap} style={{ position: "absolute", top: data.card.height * scale }}>
                  {[0.1, 0.9].map((x) => (
                    <line key={x} x1={data.card.width * scale * x} x2={data.card.width * scale * x} y1={0} y2={gap} stroke={COLOURS.walnut} strokeWidth={3} />
                  ))}
                </svg>
              ) : null}
            </div>
          );
        })}
      </div>
      {cards.map((card, index) => (
        <Sequence key={card.number} from={index * every} durationInFrames={Math.round(1.2 * fps)}>
          <Audio src={staticFile("audio/clack.wav")} volume={0.8} />
        </Sequence>
      ))}
    </Stock>
  );
}

const CELL = 19;

function PaperGrid({ data, row, violation = false, zoom = 1 }: { readonly data: ProblemData; readonly row: number | null; readonly violation?: boolean; readonly zoom?: number }) {
  const { width, picks, design, palette } = data;
  const v = data.violation;
  return (
    <svg width={width * CELL} height={picks * CELL} style={{ display: "block", transform: `scale(${zoom})`, transformOrigin: `${(v.end + v.length / 2) * CELL}px ${(picks - 1 - v.pick) * CELL}px` }}>
      {design.map((cells, pick) =>
        cells.map((region, end) => (
          <rect key={`${pick}-${end}`} x={end * CELL} y={(picks - 1 - pick) * CELL} width={CELL} height={CELL} fill={palette[region] ?? COLOURS.paper} />
        )),
      )}
      {/* The point paper's grid: light lines, a heavier line every 8 cells. */}
      {Array.from({ length: width + 1 }, (_, end) => (
        <line key={`v${end}`} x1={end * CELL} x2={end * CELL} y1={0} y2={picks * CELL} stroke={end % 8 === 0 ? COLOURS.lineStrong : "rgb(60 40 20 / 0.18)"} strokeWidth={end % 8 === 0 ? 1.4 : 1} />
      ))}
      {Array.from({ length: picks + 1 }, (_, line) => (
        <line key={`h${line}`} y1={line * CELL} y2={line * CELL} x1={0} x2={width * CELL} stroke={(picks - line) % 8 === 0 ? COLOURS.lineStrong : "rgb(60 40 20 / 0.18)"} strokeWidth={(picks - line) % 8 === 0 ? 1.4 : 1} />
      ))}
      {row === null ? null : <rect x={-3} y={(picks - 1 - row) * CELL - 3} width={width * CELL + 6} height={CELL + 6} fill="none" stroke={COLOURS.brass} strokeWidth={5} rx={3} />}
      {violation ? (
        <g>
          <rect x={v.end * CELL} y={(picks - 1 - v.pick) * CELL} width={v.length * CELL} height={CELL} fill="none" stroke={COLOURS.violation} strokeWidth={4} />
          {/* Colour is never the only signal: a marker triangle as in the app. */}
          <path d={`M ${v.end * CELL - 16} ${(picks - 1 - v.pick) * CELL + CELL / 2 + 8} l 8 -16 l 8 16 z`} fill={COLOURS.violation} />
        </g>
      ) : null}
    </svg>
  );
}

/** 7 to 14 s: one pick lit on the point paper, and its card beside it. */
function RowToCard({ data }: { readonly data: ProblemData }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const steps = 10;
  const every = Math.round(0.62 * fps);
  const index = Math.min(steps - 1, Math.floor(Math.max(0, frame - 0.4 * fps) / every));
  const card = data.card.cards[index]!;
  const enter = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  return (
    <Stock style={{ opacity: enter }}>
      <div style={{ position: "absolute", left: 120, top: 70 }}>
        <PaperGrid data={data} row={card.pick} />
        <div style={{ fontFamily: FONTS.mono, fontSize: 26, color: COLOURS.inkMuted, marginTop: 14 }}>point paper · pick {card.pick}</div>
      </div>
      <div style={{ position: "absolute", left: 1000, top: 360 }}>
        <Card card={card} data={data} scale={5.6} lit />
        <div style={{ fontFamily: FONTS.mono, fontSize: 26, color: COLOURS.inkMuted, marginTop: 18 }}>card {card.number} · one card per pick</div>
      </div>
      {Array.from({ length: steps }, (_, step) => (
        <Sequence key={step} from={Math.round(0.4 * fps) + step * every} durationInFrames={Math.round(1.2 * fps)}>
          <Audio src={staticFile("audio/tick.wav")} volume={0.9} />
        </Sequence>
      ))}
    </Stock>
  );
}

/** 14 to 21 s: the float over the limit, found by the engine, eased into view. */
function LongFloat({ data }: { readonly data: ProblemData }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = interpolate(spring({ frame: frame - 0.6 * fps, fps, config: { damping: 30 } }), [0, 1], [1, 2.1]);
  const label = interpolate(frame, [1.6 * fps, 2.2 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const v = data.violation;
  const limit = v.direction === "weft" ? data.maxFloat.weft : data.maxFloat.warp;
  return (
    <Stock>
      <div style={{ position: "absolute", left: 120, top: 70, width: data.width * CELL, height: data.picks * CELL, overflow: "hidden", borderRadius: 4 }}>
        <PaperGrid data={data} row={null} violation zoom={zoom} />
      </div>
      <div style={{ position: "absolute", left: 1000, top: 380, opacity: label }}>
        <div style={{ fontFamily: FONTS.display, fontSize: 60, fontWeight: 600, color: COLOURS.ink }}>A float too long</div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 30, color: COLOURS.violation, marginTop: 18 }}>
          ▲ {v.direction} float · pick {v.pick} · end {v.end} · length {v.length}
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 28, color: COLOURS.inkMuted, marginTop: 10 }}>limit {limit} in this loom profile</div>
      </div>
    </Stock>
  );
}

export function ProblemScene({ data }: { readonly data: ProblemData }) {
  return (
    <>
      <Sequence durationInFrames={7 * FPS}>
        <CardChain data={data} />
      </Sequence>
      <Sequence from={7 * FPS} durationInFrames={7 * FPS}>
        <RowToCard data={data} />
      </Sequence>
      <Sequence from={14 * FPS} durationInFrames={7 * FPS}>
        <LongFloat data={data} />
      </Sequence>
    </>
  );
}
