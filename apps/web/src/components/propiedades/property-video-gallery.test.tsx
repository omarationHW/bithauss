import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PropertyVideoGallery } from "./property-video-gallery";
import { splitPropertyMedia } from "@/lib/property-video";

const IMAGE_ROW = {
  id: "m1",
  url: "https://cdn.test/foto.jpg",
  media_type: "IMAGE",
  sort_order: 0,
};

const UPLOAD_ROW = {
  id: "m2",
  url: "https://cdn.test/storage/v1/object/public/property-videos/u/p/v.mp4",
  media_type: "VIDEO",
  provider: "UPLOAD",
  thumbnail_url: null,
  sort_order: 1,
};

const YOUTUBE_ROW = {
  id: "m3",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  media_type: "VIDEO",
  provider: "YOUTUBE",
  thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  sort_order: 2,
};

describe("Ficha pública · galería sin video", () => {
  it("no renderiza absolutamente nada cuando la propiedad no tiene video", () => {
    // The ficha must look byte-for-byte like it did before the feature.
    const { container } = render(<PropertyVideoGallery videos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("las filas de imagen nunca llegan a la galería de video", () => {
    const { images, videos } = splitPropertyMedia([IMAGE_ROW, UPLOAD_ROW]);
    expect(images).toEqual([IMAGE_ROW]);
    expect(videos).toEqual([UPLOAD_ROW]);

    const { container } = render(<PropertyVideoGallery videos={images} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Ficha pública · galería con video", () => {
  it("reproduce un archivo subido con preload=metadata y poster", () => {
    const { container } = render(
      <PropertyVideoGallery
        videos={[UPLOAD_ROW]}
        posterFallback="https://cdn.test/foto.jpg"
      />,
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    // Never download the whole file just to open the ficha.
    expect(video).toHaveAttribute("preload", "metadata");
    expect(video).toHaveAttribute("poster", "https://cdn.test/foto.jpg");
    expect(video).toHaveAttribute("src", UPLOAD_ROW.url);
    expect(video).not.toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("controls");
    expect(screen.getByRole("heading", { name: /Video de la propiedad/i })).toBeInTheDocument();
  });

  it("muestra una facada de YouTube y sólo carga el iframe al hacer clic", async () => {
    const user = userEvent.setup();
    const { container } = render(<PropertyVideoGallery videos={[YOUTUBE_ROW]} />);

    // No third-party frame before the click.
    expect(container.querySelector("iframe")).toBeNull();
    const facade = screen.getByRole("button", { name: /Reproducir el video.*YouTube/i });
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      YOUTUBE_ROW.thumbnail_url,
    );

    await user.click(facade);

    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    // Rebuilt from the id through the allowlist, on the -nocookie host.
    expect(iframe).toHaveAttribute(
      "src",
      expect.stringContaining("youtube-nocookie.com/embed/dQw4w9WgXcQ"),
    );
    expect(iframe!.getAttribute("sandbox")).toContain("allow-scripts");
    expect(iframe!.getAttribute("sandbox")).not.toContain("allow-forms");
    expect(iframe!.getAttribute("sandbox")).not.toContain("allow-top-navigation");
  });

  it("descarta una fila con URL externa no permitida", () => {
    const { container } = render(
      <PropertyVideoGallery
        videos={[
          {
            id: "bad",
            url: "https://youtube.com.evil.tld/watch?v=dQw4w9WgXcQ",
            media_type: "VIDEO",
            provider: "YOUTUBE",
          },
        ]}
      />,
    );
    // Nothing renders rather than framing an attacker-controlled host.
    expect(container).toBeEmptyDOMElement();
  });

  it("ofrece un selector cuando hay más de un video", () => {
    render(<PropertyVideoGallery videos={[UPLOAD_ROW, YOUTUBE_ROW]} />);
    expect(screen.getByRole("button", { name: "Video 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Video 2" })).toBeInTheDocument();
  });
});
