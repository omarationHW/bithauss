import { ConflictException, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

const logger = new Logger('BrcFreeze');

export const BRC_FROZEN_MESSAGE =
  'Este inmueble tiene un BRC vigente y su información no puede modificarse. ' +
  'Para editarlo, anula el BRC; tendrás que certificarlo de nuevo desde cero.';

/**
 * Migración 041 congela un inmueble con BRC vigente, pero la API escribe con
 * la llave de servicio, que el trigger deja pasar (es la vía de corrección
 * manual de BitHauss). Las rutas que actúan en nombre del dueño tienen que
 * aplicar el mismo candado aquí.
 *
 * Si la función aún no existe (migración sin aplicar) no bloquea; cualquier
 * otro error sí, para no abrir el candado por accidente.
 */
export async function assertNotBrcFrozen(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('property_has_active_brc', {
    p_property_id: propertyId,
  });

  if (error) {
    const missing = error.code === 'PGRST202' || error.code === '42883';
    if (missing) {
      logger.warn('property_has_active_brc no existe: aplica la migración 041');
      return;
    }
    logger.error(`No se pudo verificar el BRC de ${propertyId}: ${error.message}`);
    throw new ConflictException('No se pudo verificar el estado del BRC. Intenta de nuevo.');
  }

  if (data === true) throw new ConflictException(BRC_FROZEN_MESSAGE);
}
