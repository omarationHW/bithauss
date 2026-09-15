import type { OnboardingRole, TourId, TourStep } from "./types";

/**
 * Contenido de los recorridos. Los `target` corresponden a atributos
 * `data-tour="..."` en las pantallas; si un elemento no está en pantalla
 * (p.ej. la barra lateral en móvil) el motor salta ese paso.
 */

function dashboardSteps(role: OnboardingRole): TourStep[] {
  const isBroker = role !== "VENDEDOR";
  return [
    {
      title: "Tu panel en 1 minuto",
      body: "Te mostramos dónde está cada cosa y cuál es el camino para publicar tu primera propiedad y certificarla. Puedes saltarlo cuando quieras.",
      nextLabel: "Vamos",
    },
    {
      target: "nav:menu",
      title: "Tu menú",
      body: "Desde aquí abres el menú con todas las secciones del panel.",
      placement: "bottom",
    },
    {
      target: "nav:/dashboard",
      title: "Dashboard",
      body: "Tu resumen: propiedades activas, certificaciones en curso y actividad reciente. Siempre puedes volver aquí.",
      placement: "right",
    },
    {
      target: "nav:/dashboard/propiedades",
      title: "Mis Propiedades",
      body: "Aquí publicas y administras tus inmuebles. Es el primer paso: sin una propiedad publicada no hay nada que certificar.",
      placement: "right",
    },
    ...(isBroker
      ? [
          {
            target: "nav:/dashboard/leads",
            title: "Leads",
            body: "Los compradores interesados en tus propiedades llegan aquí. Da seguimiento a cada uno y cambia su estado conforme avanza.",
            placement: "right" as const,
          },
        ]
      : []),
    {
      target: "nav:/dashboard/expedientes",
      title: "Certificados BRC",
      body: "El corazón de BitHauss: aquí solicitas la certificación BRC (Bien Raíz Certificado) y sigues cada expediente hasta que el notario emite tu certificado.",
      placement: "right",
    },
    ...(isBroker
      ? [
          {
            target: "nav:/dashboard/membresia",
            title: "Membresía",
            body: "Tu plan define cuántas propiedades puedes publicar y los descuentos en certificaciones. Puedes cambiarlo en cualquier momento.",
            placement: "right" as const,
          },
        ]
      : []),
    {
      target: "nav:notificaciones",
      title: "Notificaciones",
      body: "Te avisamos aquí cuando un expediente cambia de estado, llega un mensaje o un comprador se interesa en tu propiedad.",
      placement: "bottom",
    },
    {
      target: "dash:primeros-pasos",
      title: "Tus primeros pasos",
      body: "Esta tarjeta te lleva de la mano: se va marcando sola conforme avanzas y desaparece cuando termines. Empieza por el primer paso pendiente.",
      placement: "bottom",
    },
    {
      target: "dash:acciones",
      title: "Acciones rápidas",
      body: "Accesos directos a lo que más vas a usar. Cuando quieras publicar, empieza aquí.",
      placement: "left",
    },
    {
      title: "¡Listo para empezar!",
      body: "Publica tu primera propiedad: toma unos 5 minutos y te guiamos sección por sección. Si prefieres, explora el panel a tu ritmo.",
      nextLabel: "Terminar",
      ctaHref: "/dashboard/propiedades/nueva",
      ctaLabel: "Publicar mi primera propiedad",
    },
  ];
}

const nuevaPropiedadSteps: TourStep[] = [
  {
    title: "Publica tu propiedad en 6 secciones",
    body: "Solo los campos marcados con * son obligatorios. Puedes guardar como borrador y terminar después; nada se pierde.",
    nextLabel: "Vamos",
  },
  {
    target: "nueva:basica",
    title: "1 · Información básica",
    body: "Título, tipo de inmueble y operación (venta o renta). Un buen título dice qué es y dónde está: \"Departamento 2 rec. en Polanco\".",
    placement: "top",
  },
  {
    target: "nueva:precio",
    title: "2 · Precio",
    body: "Escribe el precio real: se usa para calcular la tarifa de certificación. Si no quieres mostrarlo al público, desactiva \"Publicar precio\".",
    placement: "top",
  },
  {
    target: "nueva:caracteristicas",
    title: "3 · Características",
    body: "Los campos cambian según el tipo de inmueble que elegiste arriba. Entre más completo, mejor posiciona tu propiedad.",
    placement: "top",
  },
  {
    target: "nueva:ubicacion",
    title: "4 · Ubicación",
    body: "Escribe el código postal y se llenan colonia, ciudad y estado. La dirección exacta puede quedar oculta: solo se muestra colonia y ciudad.",
    placement: "top",
  },
  {
    target: "nueva:imagenes",
    title: "5 · Imágenes",
    body: "Sube al menos 3 fotos con buena luz. La primera es la portada que verán los compradores.",
    placement: "top",
  },
  {
    target: "nueva:publicar",
    title: "6 · Publicar",
    body: "Cuando termines, publica. Si aún te falta algo, \"Guardar como borrador\" deja todo listo para continuar después.",
    placement: "top",
    nextLabel: "Entendido",
  },
];

const solicitarBrcSteps: TourStep[] = [
  {
    title: "Certifica tu propiedad",
    body: "El BRC es la validación notarial de que tu inmueble está en regla. Sube los documentos, revisa el costo y envía la solicitud; un notario hará el resto.",
    nextLabel: "Vamos",
  },
  {
    target: "brc:documentos",
    title: "Documentos",
    body: "Los marcados como obligatorios son indispensables; los opcionales solo aplican en casos concretos (lee la nota de cada uno). Aceptamos PDF, JPG y PNG.",
    placement: "top",
  },
  {
    target: "brc:validacion",
    title: "Validación automática",
    body: "Al subir cada archivo lo leemos con IA y te decimos si parece el documento correcto. Si no podemos validarlo, no te preocupes: el notario lo revisa manualmente.",
    placement: "top",
  },
  {
    target: "brc:notas",
    title: "Notas para el notario",
    body: "Opcional. Cualquier situación particular del inmueble (herencia, crédito vigente, etc.) ayuda a agilizar la revisión.",
    placement: "top",
  },
  {
    target: "brc:pago",
    title: "Costo y envío",
    body: "La tarifa depende del valor de la propiedad y se calcula aquí. Al pagar, tu expediente entra a revisión y verás cada avance en Certificados BRC.",
    placement: "top",
    nextLabel: "Entendido",
  },
];

/** Evento que la pantalla de expedientes escucha para abrir el modal "Nueva Solicitud". */
export const EXPEDIENTES_NUEVA_SOLICITUD_EVENT = "bh:expedientes:nueva-solicitud";

/**
 * Recorrido de "Certificados BRC". Recibe si el usuario ya tiene propiedades
 * porque sin ellas no hay nada que certificar: el recorrido lo lleva primero
 * a publicar. Con propiedades, explica el flujo y cierra abriendo el modal
 * de nueva solicitud (no hay un id de propiedad al que navegar).
 */
function expedientesSteps(hasProperties: boolean): TourStep[] {
  if (!hasProperties) {
    return [
      {
        title: "Para certificar necesitas una propiedad publicada",
        body: "El certificado BRC se emite sobre un inmueble concreto. Aquí verás tus expedientes en cuanto solicites tu primera certificación, pero antes hay que publicar la propiedad.",
        nextLabel: "Vamos",
      },
      {
        target: "exp:vacio-cta",
        title: "Primero publica, después certifica",
        body: "Este botón te lleva a publicar tu propiedad. Cuando esté lista, vuelve aquí y desde \"Nueva Solicitud\" eliges la propiedad, subes los documentos y un notario la valida.",
        placement: "top",
      },
      {
        title: "Empieza por tu propiedad",
        body: "Publicarla toma unos 5 minutos y te guiamos sección por sección. Al terminar, la certificación está a un clic desde esta pantalla.",
        nextLabel: "Después",
        ctaHref: "/dashboard/propiedades/nueva",
        ctaLabel: "Publicar mi primera propiedad",
      },
    ];
  }
  return [
    {
      title: "Cómo certificar una propiedad",
      body: "El BRC (Bien Raíz Certificado) es la validación notarial de que tu inmueble está en regla. Te mostramos cómo solicitarlo y dónde seguir cada expediente.",
      nextLabel: "Vamos",
    },
    {
      target: "exp:resumen",
      title: "Tu resumen",
      body: "De un vistazo: cuántas solicitudes llevas, cuáles están en revisión, cuántos certificados tienes y si alguna fue rechazada.",
      placement: "bottom",
    },
    {
      target: "exp:nueva",
      title: "Nueva Solicitud",
      body: "Aquí empieza todo: eliges la propiedad, subes los documentos, pagas la tarifa y un notario valida el expediente hasta emitir tu certificado.",
      placement: "bottom",
    },
    {
      target: "exp:lista",
      title: "Tus expedientes",
      body: "Cada expediente aparece aquí con su estado y avance. Cuando el notario apruebe o pida corregir un documento, te avisamos en las notificaciones.",
      placement: "top",
    },
    {
      title: "¿Empezamos?",
      body: "Elige la propiedad que quieres certificar y te llevamos paso a paso por los documentos y el pago.",
      nextLabel: "Después",
      ctaEvent: EXPEDIENTES_NUEVA_SOLICITUD_EVENT,
      ctaLabel: "Nueva Solicitud",
    },
  ];
}

export interface TourContext {
  /** El usuario tiene al menos una propiedad (no archivada). */
  hasProperties: boolean;
}

export function getTourSteps(
  tour: TourId,
  role: OnboardingRole,
  ctx: TourContext = { hasProperties: true },
): TourStep[] {
  switch (tour) {
    case "dashboard":
      return dashboardSteps(role);
    case "nueva-propiedad":
      return nuevaPropiedadSteps;
    case "solicitar-brc":
      return solicitarBrcSteps;
    case "expedientes":
      return expedientesSteps(ctx.hasProperties);
  }
}

/** Qué recorrido corresponde a cada ruta cuando se visita por primera vez. */
export function tourForPath(pathname: string): TourId | null {
  if (pathname === "/dashboard") return "dashboard";
  if (pathname === "/dashboard/propiedades/nueva") return "nueva-propiedad";
  if (/^\/dashboard\/propiedades\/[^/]+\/solicitar-brc$/.test(pathname)) return "solicitar-brc";
  if (pathname === "/dashboard/expedientes") return "expedientes";
  return null;
}
