// Saves a file in the browser (6.1): a Blob, an object URL, a temporary anchor that is clicked,
// then the URL is revoked. The document and URL functions are injectable for tests.

export interface DownloadFile {
  readonly name: string;
  readonly blob: Blob;
}

/** What the export panel calls to save a file. */
export type Downloader = (file: DownloadFile) => void;

export interface DownloadEnv {
  readonly document: Document;
  readonly createObjectURL: (blob: Blob) => string;
  readonly revokeObjectURL: (url: string) => void;
}

function browserEnv(): DownloadEnv {
  return {
    document,
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  };
}

/** Clicks a temporary `<a download>` for the file and revokes its object URL afterwards. */
export function downloadFile(file: DownloadFile, env: DownloadEnv = browserEnv()): void {
  const url = env.createObjectURL(file.blob);
  try {
    const anchor = env.document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    env.document.body.appendChild(anchor);
    try {
      anchor.click();
    } finally {
      anchor.remove();
    }
  } finally {
    // Revoke on the next task so the browser has started the download.
    setTimeout(() => env.revokeObjectURL(url), 0);
  }
}
