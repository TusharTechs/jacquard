// Init script for the capture (demo-video 3.3): every connection to an AudioDestinationNode also
// feeds a MediaStreamAudioDestinationNode, recorded by MediaRecorder, so the app's own sounds are
// captured in sync with the picture. The recording start time is kept in wall-clock milliseconds.
(() => {
  const original = AudioNode.prototype.connect;
  const taps = new WeakMap();
  window.__audioTap = { chunks: [], startedAt: null, recorder: null };
  function tapFor(context) {
    let tap = taps.get(context);
    if (tap) return tap;
    const destination = context.createMediaStreamDestination();
    const recorder = new MediaRecorder(destination.stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 256000 });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) window.__audioTap.chunks.push(event.data);
    };
    recorder.start(1000);
    window.__audioTap.startedAt = Date.now();
    window.__audioTap.recorder = recorder;
    tap = destination;
    taps.set(context, tap);
    return tap;
  }
  AudioNode.prototype.connect = function (target, ...rest) {
    const result = original.call(this, target, ...rest);
    if (target instanceof AudioDestinationNode) original.call(this, tapFor(target.context));
    return result;
  };
  window.__stopAudioTap = () =>
    new Promise((resolve) => {
      const tap = window.__audioTap;
      if (tap.recorder === null) return resolve(null);
      tap.recorder.onstop = async () => {
        const blob = new Blob(tap.chunks, { type: "audio/webm" });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
        resolve({ startedAt: tap.startedAt, base64: btoa(binary) });
      };
      tap.recorder.stop();
    });
})();
