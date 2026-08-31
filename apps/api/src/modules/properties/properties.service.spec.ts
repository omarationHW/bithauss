import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import {
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertyFilters,
} from './properties.service';

/**
 * Validates the DTOs exactly as the global ValidationPipe does, so these tests
 * cover the rules the API actually enforces on the wire.
 */
function errorsFor(cls: new () => object, payload: Record<string, unknown>): string[] {
  const instance = plainToInstance(cls, payload);
  return validateSync(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: false,
  }).map((e) => e.property);
}

const BASE_CREATE = {
  title: 'Local comercial en Roma Norte',
  type: 'LOCAL_COMERCIAL',
  operation: 'VENTA',
  price: 4_500_000,
  currency: 'MXN',
  city: 'Ciudad de México',
  state: 'CDMX',
};

describe('PropertiesService DTOs · operación TRASPASO retirada', () => {
  it('acepta las operaciones vigentes al crear', () => {
    for (const operation of ['VENTA', 'RENTA', 'VENTA_RENTA']) {
      expect(errorsFor(CreatePropertyDto, { ...BASE_CREATE, operation })).toEqual([]);
    }
  });

  it('rechaza TRASPASO al crear: dejó de ser una operación', () => {
    // Ahora es el atributo "¿Aplica traspaso?" del local comercial.
    expect(errorsFor(CreatePropertyDto, { ...BASE_CREATE, operation: 'TRASPASO' })).toEqual(
      ['operation'],
    );
  });

  it('rechaza TRASPASO al actualizar', () => {
    expect(errorsFor(UpdatePropertyDto, { operation: 'TRASPASO' })).toEqual(['operation']);
    expect(errorsFor(UpdatePropertyDto, { operation: 'RENTA' })).toEqual([]);
  });

  it('sigue permitiendo FILTRAR por TRASPASO: las filas históricas existen', () => {
    // El valor no se puede borrar del enum de Postgres y las propiedades
    // publicadas antes del cambio deben seguir siendo alcanzables.
    expect(errorsFor(PropertyFilters, { operation: 'TRASPASO' })).toEqual([]);
    expect(errorsFor(PropertyFilters, { operation: 'INVENTADA' })).toEqual(['operation']);
  });
});

describe('PropertiesService DTOs · campos nuevos de la matriz', () => {
  it('acepta los campos de la matriz del cliente', () => {
    expect(
      errorsFor(CreatePropertyDto, {
        ...BASE_CREATE,
        age_years: 12,
        private_units: 4,
        is_furnished: false,
        has_terrace: true,
        applies_traspaso: true,
        amenities_answered: true,
      }),
    ).toEqual([]);
  });

  it('valida los rangos de antigüedad y privados', () => {
    expect(errorsFor(CreatePropertyDto, { ...BASE_CREATE, age_years: -1 })).toEqual([
      'age_years',
    ]);
    expect(errorsFor(CreatePropertyDto, { ...BASE_CREATE, age_years: 900 })).toEqual([
      'age_years',
    ]);
    expect(errorsFor(CreatePropertyDto, { ...BASE_CREATE, private_units: 99_999 })).toEqual(
      ['private_units'],
    );
  });

  it('los tri-estado son opcionales en el DTO: ausente = sin responder', () => {
    // El "forzar a responder" se aplica contra la matriz (validators), no con
    // un @IsNotEmpty aquí, porque depende del tipo de inmueble.
    expect(errorsFor(CreatePropertyDto, BASE_CREATE)).toEqual([]);
    expect(
      errorsFor(CreatePropertyDto, { ...BASE_CREATE, is_furnished: 'quizá' }),
    ).toEqual(['is_furnished']);
  });
});
