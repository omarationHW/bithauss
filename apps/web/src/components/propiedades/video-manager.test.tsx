import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  VideoManager,
  hasPendingVideoUploads,
  type PropertyVideoDraft,
  type VideoUploadTask,
} from "./video-manager";
import { MAX_PROPERTY_VIDEOS, MAX_VIDEO_FILE_BYTES } from "@/lib/property-video";

/* ------------------------------------------------------------------ */
/*  Harness — mirrors how alta/edición own the list                    */
/* ------------------------------------------------------------------ */

function Harness({
  initial = [],
  startUpload,
  onItems,
}: {
  initial?: PropertyVideoDraft[];
  startUpload?: (
    file: File,
    onProgress: (p: number) => void,
    contentType?: string,
  ) => VideoUploadTask;
  onItems?: (items: PropertyVideoDraft[]) => void;
}) {
  const [items, setItems] = useState<PropertyVideoDraft[]>(initial);
  onItems?.(items);
  return (
    <VideoManager items={items} onChange={setItems} startUpload={startUpload} />
  );
}

/** Real ISO base media header (size + "ftypisom"), padded to 16 bytes. */
const MP4_BYTES = (() => {
  const bytes = new Uint8Array(16);
  bytes.set([0x00, 0x00, 0x00, 0x20], 0);
  const marker = "ftypisom";
  for (let i = 0; i < marker.length; i++) bytes[4 + i] = marker.charCodeAt(i);
  return bytes;
})();

/** Builds a File whose reported size can be forced (jsdom keeps the content). */
function makeFile(name: string, size: number, type = "video/mp4"): File {
  const file = new File([MP4_BYTES], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/** Upload driver the test can resolve/progress by hand. */
function manualUploader() {
  let progressFn: ((p: number) => void) | null = null;
  let resolveFn: ((url: string) => void) | null = null;
  let rejectFn: ((err: Error) => void) | null = null;
  const abort = vi.fn();

  const start = (_file: File, onProgress: (p: number) => void): VideoUploadTask => {
    progressFn = onProgress;
    return {
      promise: new Promise<string>((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
      }),
      abort,
    };
  };

  return {
    start,
    abort,
    progress: (p: number) => progressFn?.(p),
    resolve: (url: string) => resolveFn?.(url),
    reject: (err: Error) => rejectFn?.(err),
  };
}

const urlInput = () => screen.getByLabelText(/YouTube o Vimeo/i);
const addButton = () => screen.getByRole("button", { name: "Agregar video" });

function readyExternal(url: string, key: string): PropertyVideoDraft {
  return {
    key,
    provider: "YOUTUBE",
    url,
    externalId: key,
    thumbnailUrl: null,
    title: null,
    status: "ready",
    progress: 100,
    error: null,
  };
}

/* ------------------------------------------------------------------ */
/*  Agregar por URL                                                    */
/* ------------------------------------------------------------------ */

describe("VideoManager · agregar por liga", () => {
  it("agrega un video de YouTube y lo normaliza", async () => {
    const user = userEvent.setup();
    let latest: PropertyVideoDraft[] = [];
    render(<Harness onItems={(items) => (latest = items)} />);

    await user.type(
      urlInput(),
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL999",
    );
    await user.click(addButton());

    await waitFor(() => expect(latest).toHaveLength(1));
    expect(
      within(screen.getByRole("listitem")).getByText(/YouTube/),
    ).toBeInTheDocument();
    expect(latest[0]!.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(latest[0]!.provider).toBe("YOUTUBE");
    // The input is cleared so the next link can be pasted straight away.
    expect(urlInput()).toHaveValue("");
  });

  it("agrega un video de Vimeo", async () => {
    const user = userEvent.setup();
    let latest: PropertyVideoDraft[] = [];
    render(<Harness onItems={(items) => (latest = items)} />);

    await user.type(urlInput(), "https://vimeo.com/123456789");
    await user.click(addButton());

    await waitFor(() => expect(latest).toHaveLength(1));
    expect(latest[0]!.provider).toBe("VIMEO");
    expect(latest[0]!.url).toBe("https://vimeo.com/123456789");
  });

  it("rechaza una liga inválida con un mensaje anunciado", async () => {
    const user = userEvent.setup();
    let latest: PropertyVideoDraft[] = [];
    render(<Harness onItems={(items) => (latest = items)} />);

    await user.type(urlInput(), "https://youtube.com.evil.tld/watch?v=dQw4w9WgXcQ");
    await user.click(addButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/solo videos de YouTube o Vimeo/i);
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(latest).toHaveLength(0);
  });

  it("rechaza una liga con esquema javascript:", async () => {
    const user = userEvent.setup();
    let latest: PropertyVideoDraft[] = [];
    render(<Harness onItems={(items) => (latest = items)} />);

    await user.type(urlInput(), "javascript:alert(1)");
    await user.click(addButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/no es válida/i);
    expect(latest).toHaveLength(0);
  });

  it("rechaza duplicados", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[readyExternal("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "a")]}
      />,
    );

    await user.type(urlInput(), "https://youtu.be/dQw4w9WgXcQ");
    await user.click(addButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/ya está agregado/i);
  });
});

/* ------------------------------------------------------------------ */
/*  Límite por propiedad                                               */
/* ------------------------------------------------------------------ */

describe("VideoManager · máximo por propiedad", () => {
  it(`no deja pasar de ${MAX_PROPERTY_VIDEOS} videos`, async () => {
    const user = userEvent.setup();
    const full = [
      readyExternal("https://www.youtube.com/watch?v=aaaaaaaaaaa", "a"),
      readyExternal("https://www.youtube.com/watch?v=bbbbbbbbbbb", "b"),
      readyExternal("https://www.youtube.com/watch?v=ccccccccccc", "c"),
    ].slice(0, MAX_PROPERTY_VIDEOS);

    let latest: PropertyVideoDraft[] = [];
    render(<Harness initial={full} onItems={(items) => (latest = items)} />);

    expect(
      screen.getByText(new RegExp(`máximo de ${MAX_PROPERTY_VIDEOS} videos`, "i")),
    ).toBeInTheDocument();

    await user.type(urlInput(), "https://youtu.be/dQw4w9WgXcQ");
    await user.click(addButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      new RegExp(`${MAX_PROPERTY_VIDEOS} videos por propiedad`, "i"),
    );
    expect(latest).toHaveLength(MAX_PROPERTY_VIDEOS);
  });
});

/* ------------------------------------------------------------------ */
/*  Archivos                                                           */
/* ------------------------------------------------------------------ */

describe("VideoManager · archivos", () => {
  it("rechaza un archivo con formato no admitido", async () => {
    const uploader = manualUploader();
    let latest: PropertyVideoDraft[] = [];
    render(
      <Harness startUpload={uploader.start} onItems={(items) => (latest = items)} />,
    );

    // fireEvent (not user.upload) on purpose: user-event filters by the
    // `accept` attribute, but `accept` is only a picker hint — a drag & drop
    // or a tampered picker delivers the file anyway, so the manager must
    // reject it on its own.
    fireEvent.change(screen.getByLabelText("Subir video de la propiedad"), {
      target: { files: [makeFile("plano.pdf", 1024, "application/pdf")] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Formato no admitido.*MP4, WebM o MOV/i,
    );
    expect(latest).toHaveLength(0);
  });

  it("rechaza un archivo que excede el tamaño máximo y dice por qué", async () => {
    const user = userEvent.setup();
    const uploader = manualUploader();
    let latest: PropertyVideoDraft[] = [];
    render(
      <Harness startUpload={uploader.start} onItems={(items) => (latest = items)} />,
    );

    await user.upload(
      screen.getByLabelText("Subir video de la propiedad"),
      makeFile("enorme.mp4", MAX_VIDEO_FILE_BYTES + 1),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/máximo permitido es 200 MB/i);
    expect(latest).toHaveLength(0);
  });

  it("muestra el progreso real de la subida y la marca como lista al terminar", async () => {
    const user = userEvent.setup();
    const uploader = manualUploader();
    let latest: PropertyVideoDraft[] = [];
    render(
      <Harness startUpload={uploader.start} onItems={(items) => (latest = items)} />,
    );

    await user.upload(
      screen.getByLabelText("Subir video de la propiedad"),
      makeFile("recorrido.mp4", 5 * 1024 * 1024),
    );

    const bar = await screen.findByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(hasPendingVideoUploads(latest)).toBe(true);

    uploader.progress(45);
    await waitFor(() =>
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "45"),
    );
    expect(screen.getByText(/Subiendo… 45%/)).toBeInTheDocument();

    uploader.resolve("https://cdn.test/property-videos/u/p/v.mp4");

    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
    expect(latest[0]!.status).toBe("ready");
    expect(latest[0]!.url).toBe("https://cdn.test/property-videos/u/p/v.mp4");
    expect(hasPendingVideoUploads(latest)).toBe(false);
  });

  it("permite cancelar una subida en curso", async () => {
    const user = userEvent.setup();
    const uploader = manualUploader();
    let latest: PropertyVideoDraft[] = [];
    render(
      <Harness startUpload={uploader.start} onItems={(items) => (latest = items)} />,
    );

    await user.upload(
      screen.getByLabelText("Subir video de la propiedad"),
      makeFile("recorrido.mp4", 5 * 1024 * 1024),
    );
    await screen.findByRole("progressbar");

    await user.click(screen.getByRole("button", { name: /Cancelar la subida/i }));

    expect(uploader.abort).toHaveBeenCalled();
    await waitFor(() => expect(latest).toHaveLength(0));
  });

  it("ofrece reintentar cuando la subida falla", async () => {
    const user = userEvent.setup();
    const uploader = manualUploader();
    render(<Harness startUpload={uploader.start} />);

    await user.upload(
      screen.getByLabelText("Subir video de la propiedad"),
      makeFile("recorrido.mp4", 1024),
    );
    await screen.findByRole("progressbar");

    uploader.reject(new Error("Se interrumpió la conexión durante la subida del video."));

    const retry = await screen.findByRole("button", { name: /Reintentar/i });
    expect(screen.getByText(/Se interrumpió la conexión/)).toBeInTheDocument();

    await user.click(retry);
    await waitFor(() => expect(screen.getByRole("progressbar")).toBeInTheDocument());
  });
});

/* ------------------------------------------------------------------ */
/*  Orden y borrado                                                    */
/* ------------------------------------------------------------------ */

describe("VideoManager · orden y borrado", () => {
  it("elimina un video de la lista", async () => {
    const user = userEvent.setup();
    let latest: PropertyVideoDraft[] = [];
    render(
      <Harness
        initial={[
          readyExternal("https://www.youtube.com/watch?v=aaaaaaaaaaa", "a"),
          readyExternal("https://www.youtube.com/watch?v=bbbbbbbbbbb", "b"),
        ]}
        onItems={(items) => (latest = items)}
      />,
    );

    const rows = screen.getAllByRole("listitem");
    await user.click(within(rows[0]!).getByRole("button", { name: /^Eliminar/i }));

    await waitFor(() => expect(latest).toHaveLength(1));
    expect(latest[0]!.key).toBe("b");
  });

  it("reordena y permite marcar otro como principal", async () => {
    const user = userEvent.setup();
    let latest: PropertyVideoDraft[] = [];
    render(
      <Harness
        initial={[
          readyExternal("https://www.youtube.com/watch?v=aaaaaaaaaaa", "a"),
          readyExternal("https://www.youtube.com/watch?v=bbbbbbbbbbb", "b"),
        ]}
        onItems={(items) => (latest = items)}
      />,
    );

    await user.click(
      within(screen.getAllByRole("listitem")[1]!).getByRole("button", {
        name: /Hacer principal/i,
      }),
    );
    await waitFor(() => expect(latest[0]!.key).toBe("b"));

    await user.click(
      within(screen.getAllByRole("listitem")[0]!).getByRole("button", {
        name: /Mover después/i,
      }),
    );
    await waitFor(() => expect(latest[0]!.key).toBe("a"));
  });
});
