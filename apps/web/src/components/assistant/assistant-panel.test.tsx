import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import AssistantPanel from "./assistant-panel";
import { ASSISTANT_NAME, CONVERSATION_STORAGE_KEY, EXAMPLE_PROMPTS } from "@/lib/assistant/constants";

const hit = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  title: "Departamento en Santa Fe",
  type: "DEPARTAMENTO",
  operation: "VENTA",
  price: 5_500_000,
  currency: "MXN",
  area_m2: 180,
  bedrooms: 3,
  bathrooms: 2,
  parking_spaces: 2,
  neighborhood: "Santa Fe",
  city: "Ciudad de México",
  state: "CDMX",
  latitude: 19.36,
  longitude: -99.26,
  distance_km: 1.23,
  featured_image_url: null,
  url_path: "/propiedades/p1",
  ...over,
});

function renderPanel() {
  const ref = createRef<HTMLButtonElement>();
  return render(<AssistantPanel open onOpenChange={() => {}} returnFocusRef={ref} />);
}

describe("AssistantPanel", () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("greets and offers three example prompts", () => {
    renderPanel();
    expect(screen.getByRole("dialog", { name: ASSISTANT_NAME })).toBeInTheDocument();
    for (const p of EXAMPLE_PROMPTS) expect(screen.getByRole("button", { name: p })).toBeInTheDocument();
  });

  it("sends a prompt and renders the cards, with directions only when coordinates exist", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          reply: "Encontré 2 opciones.",
          properties: [hit(), hit({ id: "p2", title: "Sin dirección", latitude: null, longitude: null, price: null, url_path: "/propiedades/p2" })],
          relaxed: true,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: EXAMPLE_PROMPTS[0] }));

    expect(await screen.findByText("Encontré 2 opciones.")).toBeInTheDocument();
    expect(screen.getByText(/Resultados parecidos/)).toBeInTheDocument();
    expect(screen.getByText("$5,500,000 MXN")).toBeInTheDocument();
    expect(screen.getByText("Precio a consultar")).toBeInTheDocument();
    expect(screen.getAllByText("a 1.2 km")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Ver propiedad" }).map((a) => a.getAttribute("href"))).toEqual([
      "/propiedades/p1",
      "/propiedades/p2",
    ]);
    const maps = screen.getAllByRole("link", { name: /Cómo llegar/ });
    expect(maps).toHaveLength(1);
    expect(maps[0]).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=19.36,-99.26");

    // Persisted for the session.
    expect(window.sessionStorage.getItem(CONVERSATION_STORAGE_KEY)).toContain("Encontré 2 opciones.");
  });

  it("sends the bot's previous replies back on a follow-up", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ reply: "Primera", properties: [], relaxed: false })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reply: "Segunda", properties: [], relaxed: false })));
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();
    const box = screen.getByLabelText("Escribe qué propiedad buscas");

    await userEvent.type(box, "casa en Coyoacán{Enter}");
    await screen.findByText("Primera");
    await userEvent.type(box, "¿y más barato?{Enter}");
    await screen.findByText("Segunda");

    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).messages).toEqual([
      { role: "user", content: "casa en Coyoacán" },
      { role: "assistant", content: "Primera" },
      { role: "user", content: "¿y más barato?" },
    ]);
  });

  it("shows the rate-limit message and puts the text back for retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));
    renderPanel();
    const box = screen.getByLabelText("Escribe qué propiedad buscas");
    await userEvent.type(box, "depa{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Vas muy rápido, espera unos segundos");
    expect(box).toHaveValue("depa");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("blocks messages over 500 characters", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();
    const box = screen.getByLabelText("Escribe qué propiedad buscas");
    await userEvent.click(box);
    await userEvent.paste("a".repeat(501));
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
    expect(screen.getByText(/Máximo 500 caracteres/)).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Shift+Enter inserts a newline instead of sending", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();
    const box = screen.getByLabelText("Escribe qué propiedad buscas");
    await userEvent.type(box, "línea 1{Shift>}{Enter}{/Shift}línea 2");
    expect(box).toHaveValue("línea 1\nlínea 2");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("'Nueva búsqueda' clears the conversation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ reply: "Hola", properties: [], relaxed: false }))),
    );
    renderPanel();
    await userEvent.type(screen.getByLabelText("Escribe qué propiedad buscas"), "hola{Enter}");
    await screen.findByText("Hola");
    await userEvent.click(screen.getByRole("button", { name: "Nueva búsqueda" }));
    await waitFor(() => expect(screen.queryByText("Hola")).not.toBeInTheDocument());
    expect(window.sessionStorage.getItem(CONVERSATION_STORAGE_KEY)).toBeNull();
  });

  it("hides the mic when the browser has no voice support", () => {
    renderPanel();
    expect(screen.queryByRole("button", { name: /Hablar/ })).not.toBeInTheDocument();
  });
});
