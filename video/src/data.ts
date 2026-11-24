// Data the compositions read from public/data (written by scripts/prepare-assets.ts), loaded once
// with delayRender so no frame renders before it arrives.
import { useEffect, useState } from "react";
import { continueRender, delayRender, getInputProps, staticFile } from "remotion";

export interface CardHole {
  readonly x: number;
  readonly y: number;
  readonly punched: boolean;
}

export interface CardData {
  readonly number: number;
  readonly pick: number;
  readonly holes: readonly CardHole[];
  readonly laceMarks: readonly { readonly x: number; readonly y: number }[];
}

export interface ProblemData {
  readonly design: readonly (readonly number[])[];
  readonly palette: readonly string[];
  readonly width: number;
  readonly picks: number;
  readonly lifts: readonly (readonly boolean[])[];
  readonly maxFloat: { readonly warp: number; readonly weft: number };
  readonly violation: { readonly direction: string; readonly side: string; readonly pick: number; readonly end: number; readonly length: number };
  readonly card: {
    readonly width: number;
    readonly height: number;
    readonly holeRadius: number;
    readonly laceRadius: number;
    readonly numberX: number;
    readonly numberY: number;
    readonly cards: readonly CardData[];
  };
}

export interface Excerpts {
  readonly specChain: readonly { readonly file: string; readonly line: number; readonly text: string }[];
  readonly steering: readonly string[];
  readonly hookJson: string;
  readonly hookNames: readonly string[];
  readonly trust: string;
  readonly planted: readonly string[];
  readonly paisley: readonly string[];
  readonly agents: readonly string[];
  readonly mcp: readonly string[];
  readonly power: string;
  readonly cliVerdict: string;
}

export interface Beats {
  readonly length: number;
  readonly beats: Readonly<Record<string, number>>;
}

export interface Data {
  readonly problem: ProblemData;
  readonly excerpts: Excerpts;
  readonly assets: { readonly voice: boolean };
}

let cache: Data | null = null;

async function load(): Promise<Data> {
  const get = async <T,>(name: string): Promise<T> => (await fetch(staticFile(`data/${name}.json`))).json() as Promise<T>;
  const [problem, excerpts, assets] = await Promise.all([get<ProblemData>("problem"), get<Excerpts>("excerpts"), get<{ voice: boolean }>("assets")]);
  return { problem, excerpts, assets };
}

export function useData(): Data | null {
  const [data, setData] = useState<Data | null>(cache);
  const [handle] = useState(() => (cache === null ? delayRender("data") : null));
  useEffect(() => {
    if (cache !== null) return;
    void load().then((value) => {
      cache = value;
      setData(value);
      if (handle !== null) continueRender(handle);
    });
  }, [handle]);
  return data;
}

/**
 * Stems of the mix, each on unless a render passes it as false in --props: the loudness check
 * mutes the voice ({"voice":false}); the sync check keeps only the voice ({"music":false,"effects":false}).
 */
export function mixOn(stem: "voice" | "music" | "effects"): boolean {
  return getInputProps()[stem] !== false;
}
