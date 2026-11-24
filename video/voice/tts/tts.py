"""Local synthetic narration for the demo video (demo-video Requirement 9).

Run through scripts/tts.ts (`pnpm --filter @jacquard/video tts`), which writes the job file.

  python tts.py synth <jobs.json>   Kokoro-82M: one WAV per job, sentence by sentence, with a
                                    sidecar JSON of each sentence's sample range in the file.
  python tts.py asr <jobs.json>     faster-whisper: a transcript per WAV, written to <out>.

Weights come from Hugging Face at the revisions in models.json, into HF_HUB_CACHE (set by
scripts/tts.ts to a folder outside git). Nothing is sent anywhere: no cloud TTS, account or key.
"""

import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODELS = json.loads((HERE / "models.json").read_text())
KOKORO_RATE = 24000


def fetch(repo: str, filename: str, revision: str) -> str:
    from huggingface_hub import hf_hub_download

    return hf_hub_download(repo_id=repo, filename=filename, revision=revision)


def synth(jobs_file: str) -> None:
    import numpy as np
    import soundfile as sf
    import torch
    from kokoro import KModel, KPipeline

    torch.manual_seed(0)
    spec = MODELS["kokoro"]
    config = fetch(spec["repo"], "config.json", spec["revision"])
    weights = fetch(spec["repo"], "kokoro-v1_0.pth", spec["revision"])
    model = KModel(repo_id=spec["repo"], config=config, model=weights).eval()
    pipelines: dict[str, KPipeline] = {}
    jobs = json.loads(Path(jobs_file).read_text())
    for job in jobs["jobs"]:
        voice = job["voice"]
        lang = voice[0]  # "a" American, "b" British English
        if lang not in pipelines:
            pipelines[lang] = KPipeline(lang_code=lang, repo_id=spec["repo"], model=model)
        voice_file = fetch(spec["repo"], spec["voices"].format(voice=voice), spec["revision"])
        pause = np.zeros(int(round(job["pause"] * KOKORO_RATE)), dtype=np.float32)
        pieces: list = []
        ranges: list[dict] = []
        at = 0
        # Kokoro's decoder adds random noise; a seed per line makes each take repeatable.
        torch.manual_seed(job["seed"])
        for index, sentence in enumerate(job["sentences"]):
            # One call per sentence. The pipeline may still split a long sentence at its own
            # chunk boundary; those chunks are joined without a pause.
            audio = [
                result.audio.detach().cpu().numpy().astype(np.float32)
                for result in pipelines[lang](sentence, voice=voice_file, speed=job["speed"], split_pattern=None)
                if result.audio is not None
            ]
            if not audio:
                raise SystemExit(f"{job['out']}: no audio for sentence {index + 1}: {sentence}")
            clip = np.concatenate(audio)
            if index > 0:
                pieces.append(pause)
                at += len(pause)
            pieces.append(clip)
            ranges.append({"start": at, "end": at + len(clip)})
            at += len(clip)
        out = Path(job["out"])
        out.parent.mkdir(parents=True, exist_ok=True)
        sf.write(out, np.concatenate(pieces), KOKORO_RATE, subtype="PCM_16")
        out.with_suffix(".json").write_text(
            json.dumps({"voice": voice, "speed": job["speed"], "seed": job["seed"], "rate": KOKORO_RATE, "sentences": ranges, "speech": job["sentences"]}, indent=1)
        )
        print(f"{out.name}: {at / KOKORO_RATE:.2f} s", flush=True)


def decode16k(file: str):
    import subprocess

    import numpy as np

    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", "16000", "pipe:1"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def asr(jobs_file: str) -> None:
    from faster_whisper import WhisperModel

    spec = MODELS["whisper"]
    from huggingface_hub import snapshot_download

    path = snapshot_download(repo_id=spec["repo"], revision=spec["revision"])
    model = WhisperModel(path, device="cpu", compute_type="int8")
    jobs = json.loads(Path(jobs_file).read_text())
    results = []
    for item in jobs["files"]:
        # A file, or {"file", "from", "to"} in seconds for one sentence of it. Decoded with ffmpeg
        # to 16 kHz mono (faster-whisper 1.2.1's own decoder does not work with the locked PyAV
        # 19). No prompt: the transcript must come from the audio alone.
        file = item if isinstance(item, str) else item["file"]
        audio = decode16k(file)
        if not isinstance(item, str):
            audio = audio[int(item["from"] * 16000) : int(item["to"] * 16000)]
        segments, _ = model.transcribe(audio, language="en", beam_size=5, condition_on_previous_text=False, vad_filter=False)
        text = " ".join(segment.text.strip() for segment in segments).strip()
        results.append({"file": file, "transcript": text})
        label = Path(file).name if isinstance(item, str) else f"{Path(file).name} from {item['from']:.2f} s"
        print(f"{label}: {text}", flush=True)
    Path(jobs["out"]).write_text(json.dumps(results, indent=1))


if __name__ == "__main__":
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    command, argument = sys.argv[1], sys.argv[2]
    {"synth": synth, "asr": asr}[command](argument)
