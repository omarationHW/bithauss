import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  PropertyFieldsSection,
  AmenitiesAnsweredField,
  EMPTY_PROPERTY_FIELD_VALUES,
  clearHiddenFieldValues,
  clearHiddenAmenities,
  validatePropertyFieldValues,
  propertyFieldValuesToDb,
  propertyFieldValuesFromDb,
  focusFirstInvalidField,
  propertyFieldDomId,
  type PropertyFieldValues,
  type SectionFieldKey,
} from "./property-fields-section";
import type { PropertyFieldError } from "@/lib/property-fields";

/* ------------------------------------------------------------------ */
/*  Harness: a minimal form that behaves like alta/edición             */
/* ------------------------------------------------------------------ */

const CONTEXT = {
  price: "3500000",
  currency: "MXN",
  amenities: [] as string[],
  amenitiesAnswered: true,
};

function Harness({
  initialType = "CASA",
  initialValues = EMPTY_PROPERTY_FIELD_VALUES,
  onSubmit,
}: {
  initialType?: string;
  initialValues?: PropertyFieldValues;
  onSubmit?: (payload: Record<string, unknown>) => void;
}) {
  const [type, setType] = useState(initialType);
  const [values, setValues] = useState<PropertyFieldValues>(initialValues);
  const [errors, setErrors] = useState<PropertyFieldError[]>([]);

  function changeType(next: string) {
    setType(next);
    // Same rule the pages apply: fields that stopped applying are cleared.
    setValues((prev) => clearHiddenFieldValues(next, prev));
    setErrors([]);
  }

  function submit() {
    const found = validatePropertyFieldValues(type, values, CONTEXT).filter(
      (e) => e.field !== "price" && e.field !== "currency",
    );
    setErrors(found);
    if (found.length > 0) {
      focusFirstInvalidField(found);
      return;
    }
    onSubmit?.(propertyFieldValuesToDb(type, values));
  }

  return (
    <div>
      <label htmlFor="tipo">Tipo de inmueble</label>
      <select id="tipo" value={type} onChange={(e) => changeType(e.target.value)}>
        {["CASA", "DEPARTAMENTO", "TERRENO", "LOCAL_COMERCIAL", "HOTEL", "EDIFICIO"].map(
          (t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ),
        )}
      </select>

      <PropertyFieldsSection
        type={type}
        values={values}
        onChange={(field, value) => {
          setValues((prev) => ({ ...prev, [field]: value }));
          setErrors((prev) => prev.filter((e) => e.field !== field));
        }}
        errors={errors}
      />

      <button type="button" onClick={submit}>
        Publicar
      </button>
    </div>
  );
}

/** Fill every REQUIRED numeric control currently on screen. */
async function fillRequiredNumbers(user: ReturnType<typeof userEvent.setup>) {
  const inputs = screen.getAllByRole("spinbutton");
  for (const input of inputs) {
    if (input.getAttribute("aria-required") === "true") {
      await user.type(input, "100");
    }
  }
}

beforeEach(() => {
  // jsdom has no layout engine.
  Element.prototype.scrollIntoView = vi.fn();
});

/* ------------------------------------------------------------------ */

describe("<PropertyFieldsSection>", () => {
  it("renderiza el conjunto de campos del tipo seleccionado", () => {
    render(<Harness initialType="CASA" />);

    expect(screen.getByLabelText(/M² de construcción/)).toBeInTheDocument();
    expect(screen.getByLabelText(/M² totales del terreno/)).toBeInTheDocument();
    expect(screen.getByLabelText(/No\. de recámaras/)).toBeInTheDocument();
    // Casa no tiene privados ni "nivel en el que se encuentra".
    expect(screen.queryByLabelText(/No\. de privados/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Nivel en el que se encuentra/)).not.toBeInTheDocument();
  });

  it("marca los obligatorios con asterisco y aria-required", () => {
    render(<Harness initialType="CASA" />);

    const required = screen.getByLabelText(/M² de construcción \*/);
    expect(required).toHaveAttribute("aria-required", "true");

    const optional = screen.getByLabelText(/No\. de baños \(opcional\)/);
    expect(optional).not.toHaveAttribute("aria-required", "true");
  });

  it("cambiar el tipo re-renderiza el conjunto correcto de campos", async () => {
    const user = userEvent.setup();
    render(<Harness initialType="CASA" />);

    await user.selectOptions(screen.getByLabelText("Tipo de inmueble"), "TERRENO");

    // Terreno: sólo superficie de terreno y antigüedad.
    expect(screen.getByLabelText(/M² totales del terreno/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Antigüedad/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/M² de construcción/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/No\. de recámaras/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/No\. de baños/)).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: /Amueblado/ })).not.toBeInTheDocument();
  });

  it("usa la etiqueta del tipo: hotel cuenta habitaciones, edificio unidades", async () => {
    const user = userEvent.setup();
    render(<Harness initialType="HOTEL" />);
    expect(screen.getByLabelText(/No\. de habitaciones/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Tipo de inmueble"), "EDIFICIO");
    expect(screen.getByLabelText(/No\. de departamentos \/ unidades/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/habitaciones/)).not.toBeInTheDocument();
  });

  it("cambiar de tipo limpia los valores de los campos que dejaron de aplicar", async () => {
    const user = userEvent.setup();
    render(<Harness initialType="CASA" />);

    const bedrooms = screen.getByLabelText(/No\. de recámaras/);
    await user.type(bedrooms, "4");
    expect(bedrooms).toHaveValue(4);

    // Casa → Terreno → Casa: las recámaras no deben "reaparecer".
    await user.selectOptions(screen.getByLabelText("Tipo de inmueble"), "TERRENO");
    await user.selectOptions(screen.getByLabelText("Tipo de inmueble"), "CASA");

    expect(screen.getByLabelText(/No\. de recámaras/)).toHaveValue(null);
  });

  it("no guarda basura de un tipo anterior", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness initialType="CASA" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/No\. de recámaras/), "4");
    await user.selectOptions(screen.getByLabelText("Tipo de inmueble"), "TERRENO");
    await user.type(screen.getByLabelText(/M² totales del terreno/), "800");
    await user.click(screen.getByRole("button", { name: "Publicar" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.area_total).toBe(800);
    expect(payload.bedrooms).toBeNull();
    expect(payload.is_furnished).toBeNull();
  });

  describe("'¿Aplica traspaso?'", () => {
    it("sólo aparece en Local Comercial", async () => {
      const user = userEvent.setup();
      render(<Harness initialType="CASA" />);
      expect(
        screen.queryByRole("radiogroup", { name: /¿Aplica traspaso\?/ }),
      ).not.toBeInTheDocument();

      await user.selectOptions(
        screen.getByLabelText("Tipo de inmueble"),
        "LOCAL_COMERCIAL",
      );
      expect(
        screen.getByRole("radiogroup", { name: /¿Aplica traspaso\?/ }),
      ).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText("Tipo de inmueble"), "HOTEL");
      expect(
        screen.queryByRole("radiogroup", { name: /¿Aplica traspaso\?/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe("checkboxes 'forzar a responder'", () => {
    it("no arrancan respondidos", () => {
      render(<Harness initialType="CASA" />);
      const group = screen.getByRole("radiogroup", { name: /Amueblado/ });
      expect(within(group).getByRole("radio", { name: "Sí" })).not.toBeChecked();
      expect(within(group).getByRole("radio", { name: "No" })).not.toBeChecked();
    });

    it("no se pueden dejar sin responder: el envío falla y no se envía", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<Harness initialType="CASA" onSubmit={onSubmit} />);

      await fillRequiredNumbers(user);
      await user.click(screen.getByRole("button", { name: "Publicar" }));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(
        screen.getByText("Indica si el inmueble está amueblado."),
      ).toBeInTheDocument();
      expect(screen.getByText("Indica si el inmueble tiene terraza.")).toBeInTheDocument();
    });

    it("'No' es una respuesta válida y se guarda como false", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<Harness initialType="CASA" onSubmit={onSubmit} />);

      await fillRequiredNumbers(user);
      await user.click(
        within(screen.getByRole("radiogroup", { name: /Amueblado/ })).getByRole("radio", {
          name: "No",
        }),
      );
      await user.click(
        within(screen.getByRole("radiogroup", { name: /Terraza/ })).getByRole("radio", {
          name: "Sí",
        }),
      );
      await user.click(screen.getByRole("button", { name: "Publicar" }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const payload = onSubmit.mock.calls[0]![0] as Record<string, unknown>;
      expect(payload.is_furnished).toBe(false);
      expect(payload.has_terrace).toBe(true);
    });
  });

  describe("envío con un obligatorio faltante", () => {
    it("muestra el error, no envía y enfoca el primer campo inválido", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<Harness initialType="DEPARTAMENTO" onSubmit={onSubmit} />);

      await user.click(screen.getByRole("button", { name: "Publicar" }));

      expect(onSubmit).not.toHaveBeenCalled();
      const built = screen.getByLabelText(/M² de construcción/);
      expect(built).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByText("Ingresa los m² de construcción.")).toBeInTheDocument();
      // Matrix row order: área construida is the first offending control.
      expect(document.activeElement).toBe(built);
    });

    it("el error desaparece al corregir el campo", async () => {
      const user = userEvent.setup();
      render(<Harness initialType="DEPARTAMENTO" />);

      await user.click(screen.getByRole("button", { name: "Publicar" }));
      expect(screen.getByText("Ingresa los m² de construcción.")).toBeInTheDocument();

      await user.type(screen.getByLabelText(/M² de construcción/), "90");
      expect(
        screen.queryByText("Ingresa los m² de construcción."),
      ).not.toBeInTheDocument();
    });
  });
});

/* ------------------------------------------------------------------ */
/*  <AmenitiesAnsweredField>                                           */
/* ------------------------------------------------------------------ */

describe("<AmenitiesAnsweredField>", () => {
  it("confirma 'sin amenidades' como respuesta válida", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AmenitiesAnsweredField
        answered={false}
        onChange={onChange}
        selectedCount={0}
        required
      />,
    );

    expect(
      screen.getByText(/marca esta casilla para confirmar que la propiedad no tiene/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Pure helpers                                                       */
/* ------------------------------------------------------------------ */

describe("helpers", () => {
  const filled: PropertyFieldValues = {
    ...EMPTY_PROPERTY_FIELD_VALUES,
    area_built: "120",
    area_total: "300",
    bedrooms: "3",
    bathrooms: "2",
    is_furnished: true,
    has_terrace: false,
  };

  it("clearHiddenFieldValues borra sólo lo que el tipo oculta", () => {
    const cleaned = clearHiddenFieldValues("TERRENO", filled);
    expect(cleaned.area_total).toBe("300"); // Terreno sí pide superficie
    expect(cleaned.area_built).toBe("");
    expect(cleaned.bedrooms).toBe("");
    expect(cleaned.bathrooms).toBe("");
    expect(cleaned.is_furnished).toBeNull();
    expect(cleaned.has_terrace).toBeNull();
  });

  it("clearHiddenAmenities borra la respuesta cuando el tipo no pide amenidades", () => {
    expect(clearHiddenAmenities("CASA", ["Alberca"], true)).toEqual({
      amenities: ["Alberca"],
      amenitiesAnswered: true,
    });
    expect(clearHiddenAmenities("BODEGA", ["Alberca"], true)).toEqual({
      amenities: [],
      amenitiesAnswered: false,
    });
  });

  it("propertyFieldValuesToDb escribe null en los campos ocultos", () => {
    const payload = propertyFieldValuesToDb("TERRENO", filled);
    expect(payload.area_total).toBe(300);
    expect(payload.bedrooms).toBeNull();
    expect(payload.area_built).toBeNull();
    expect(payload.has_terrace).toBeNull();
  });

  it("propertyFieldValuesFromDb distingue null de 0", () => {
    const values = propertyFieldValuesFromDb({
      area_built: 90,
      bedrooms: 0,
      bathrooms: null,
      is_furnished: false,
      has_terrace: null,
      applies_traspaso: true,
    });
    expect(values.area_built).toBe("90");
    expect(values.bedrooms).toBe("0");
    expect(values.bathrooms).toBe("");
    expect(values.is_furnished).toBe(false);
    expect(values.has_terrace).toBeNull();
    expect(values.applies_traspaso).toBe(true);
  });

  it("propertyFieldDomId es estable (lo usa el foco al primer inválido)", () => {
    const field: SectionFieldKey = "area_built";
    expect(propertyFieldDomId(field)).toBe("pf-area_built");
  });
});
