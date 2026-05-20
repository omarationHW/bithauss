import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrcExclusionNotice } from "./brc-exclusion-notice";

describe("BrcExclusionNotice", () => {
  it("renders the standard exclusion text in default variant", () => {
    render(<BrcExclusionNotice />);
    expect(screen.getByText(/Importante/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no verifica terrenos ni remates hipotecarios/i),
    ).toBeInTheDocument();
  });

  it("renders the compact variant with shorter copy", () => {
    render(<BrcExclusionNotice variant="compact" />);
    expect(
      screen.getByText(/No verificamos terrenos ni remates hipotecarios/i),
    ).toBeInTheDocument();
  });

  it("uses role=note for assistive tech", () => {
    render(<BrcExclusionNotice />);
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("forwards className to the outer container", () => {
    const { container } = render(<BrcExclusionNotice className="custom-x" />);
    expect(container.firstChild).toHaveClass("custom-x");
  });
});
