'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

type LegalDoc = 'terminos' | 'politica' | 'privacidad'

const legalContent: Record<LegalDoc, { title: string; sections: { heading: string; body: string }[] }> = {
  terminos: {
    title: 'Términos y Condiciones de Uso',
    sections: [
      {
        heading: '1. Identidad del responsable',
        body: 'Bithauss, en lo sucesivo "la empresa", es responsable del sitio web www.bithauss.com y de la prestación de servicios de tecnología aplicada al sector inmobiliario, incluyendo la operación de la primera plataforma en digitalizar el proceso completo de compraventa de inmuebles en México. Para efectos legales, se entenderá como proveedor conforme a la Ley Federal de Protección al Consumidor vigente.',
      },
      {
        heading: '2. Aceptación de los Términos',
        body: 'El acceso, navegación y uso del sitio web implica la aceptación expresa de los presentes Términos y Condiciones. En caso de no aceptar estos términos, el usuario deberá abstenerse de utilizar el sitio y los servicios ofrecidos.',
      },
      {
        heading: '3. Descripción de los servicios',
        body: 'La empresa ofrece una plataforma digital integral para el sector inmobiliario que puede incluir publicación de propiedades, certificación de inmuebles y brokers mediante el Certificado BRC (Bien Raíz Certificado), gestión y operación del proceso de compraventa a distancia, consultoría, soporte, automatización y soluciones digitales como página web, aplicación móvil y plataformas tecnológicas.',
      },
      {
        heading: '4. Certificado BRC — Bien Raíz Certificado',
        body: 'Bithauss emite el Certificado BRC (Bien Raíz Certificado), un Certificado Digital registrado en la Blockchain que garantiza la inmutabilidad y trazabilidad de la información certificada. El Certificado BRC puede amparar tanto propiedades como brokers inmobiliarios registrados en la plataforma, y puede contar con respaldo notarial cuando así se indique en el certificado correspondiente. La inmutabilidad del registro en Blockchain garantiza que la información contenida no puede ser alterada una vez emitido el certificado.',
      },
      {
        heading: '5. Uso permitido del sitio web',
        body: 'El usuario se compromete a utilizar el sitio web de forma lícita, evitando cualquier conducta que pueda afectar la disponibilidad, integridad o confidencialidad de la información, sistemas o servicios. Queda prohibido el uso del sitio para actividades ilícitas, fraudulentas o que vulneren derechos de terceros, incluyendo la publicación de información falsa sobre propiedades o personas, la suplantación de identidad, y cualquier intento de falsificación o alteración de Certificados BRC.',
      },
      {
        heading: '6. Propiedad Intelectual',
        body: 'Los derechos de propiedad intelectual e industrial relacionados con el sitio web, plataformas digitales, servicios, desarrollos, software, código fuente, interfaces, bases de datos, diseños, metodologías de certificación, el sistema BRC, documentación técnica y demás elementos asociados, son propiedad exclusiva de la empresa, sus afiliados, proveedores o licenciantes, y se encuentran protegidos por la Ley Federal del Derecho de Autor, la Ley Federal de Protección a la Propiedad Industrial y los tratados internacionales aplicables.',
      },
      {
        heading: '7. Acceso y Uso de las Plataformas Digitales',
        body: 'El acceso a las plataformas digitales se concede como un derecho de uso limitado, no exclusivo, revocable e intransferible, sujeto al cumplimiento de los presentes Términos y Condiciones. El usuario se obliga a utilizar las plataformas únicamente para los fines autorizados, absteniéndose de realizar cualquier acto que implique reproducción, modificación, distribución, descompilación, ingeniería inversa o acceso indebido.',
      },
      {
        heading: '8. Privacidad y Protección de Datos Personales',
        body: 'La empresa proporciona servicios tecnológicos que permiten a sus clientes gestionar y procesar información a través de plataformas digitales. La empresa actúa exclusivamente como encargada del tratamiento, al proporcionar infraestructura tecnológica y capacidades de procesamiento. Para más información, consulta nuestro Aviso de Privacidad Integral en www.bithauss.com/privacidad.',
      },
      {
        heading: '9. Disponibilidad del Servicio',
        body: 'La empresa implementa medidas razonables para asegurar la disponibilidad del sitio y servicios, sin embargo, no garantiza la continuidad ininterrumpida. Podrán existir interrupciones por mantenimiento, fallas técnicas o causas externas.',
      },
      {
        heading: '10. Seguridad de la Información',
        body: 'La empresa implementa medidas de seguridad administrativas, técnicas y físicas para proteger la información conforme a la legislación aplicable. Estas incluyen mecanismos de control de acceso, protección mediante cifrado en tránsito y en reposo, y procesos de identificación y tratamiento de riesgos de seguridad. La información registrada en Blockchain a través del Certificado BRC goza de las propiedades de inmutabilidad propias de dicha tecnología.',
      },
      {
        heading: '11. Responsabilidad y Garantías',
        body: 'El uso de las plataformas digitales se realiza bajo responsabilidad del usuario. En la máxima medida permitida por la legislación aplicable, la empresa no será responsable por daños indirectos, incidentales, especiales o consecuenciales derivados del uso o imposibilidad de uso de las plataformas o servicios.',
      },
      {
        heading: '12. Modificaciones a los Términos y Servicios',
        body: 'La empresa se reserva el derecho de modificar, actualizar o ajustar en cualquier momento los presentes Términos y Condiciones. Las modificaciones serán publicadas en www.bithauss.com indicando la fecha de su última actualización. El uso continuo de las plataformas digitales después de la publicación de las modificaciones implica la aceptación de los Términos y Condiciones actualizados.',
      },
      {
        heading: '13. Legislación Aplicable y Jurisdicción',
        body: 'Los presentes Términos y Condiciones se rigen por las leyes aplicables en los Estados Unidos Mexicanos. Para la interpretación, cumplimiento y ejecución de estos términos, las partes se someten a la jurisdicción de los tribunales competentes en la Ciudad de México.',
      },
      {
        heading: '14. Medios de Contacto',
        body: 'Para cualquier duda, aclaración, queja o solicitud: contacto@bithauss.com. Para asuntos relacionados con privacidad y protección de datos personales: privacidad@bithauss.com.',
      },
    ],
  },
  politica: {
    title: 'Política de Seguridad de la Información',
    sections: [
      {
        heading: 'Declaración de la Dirección',
        body: 'La Dirección de Bithauss establece, aprueba y comunica la presente política como parte fundamental del marco de seguridad de la información de la plataforma, asegurando la provisión de los recursos necesarios para su implementación, operación, mantenimiento y mejora continua, con el objetivo de garantizar la confidencialidad, integridad, disponibilidad y resiliencia de la información procesada, almacenada y transmitida en la Plataforma Tecnológica.',
      },
      {
        heading: 'Alcance',
        body: 'Esta política aplica a todos los activos de información, procesos, sistemas, aplicaciones, empleados, contratistas y terceros que interactúan con Bithauss en el tratamiento de información de la plataforma tecnológica, y se establece como marco de referencia para definir objetivos de seguridad de la información y asegurar el cumplimiento de los requisitos legales, reglamentarios y contractuales aplicables.',
      },
      {
        heading: 'Compromisos de la Organización',
        body: 'En el marco de esta política, Bithauss se compromete a: alinear los objetivos de seguridad con la estrategia de negocio; integrar la seguridad en los procesos organizacionales; definir y mantener un enfoque basado en riesgos, incluyendo los riesgos específicos asociados a la operación de la Blockchain y al Certificado BRC; garantizar los principios de confidencialidad, integridad, disponibilidad y resiliencia; realizar auditorías internas y revisiones periódicas; y promover la capacitación y concienciación en materia de seguridad entre los colaboradores.',
      },
      {
        heading: 'Responsabilidades',
        body: 'La Dirección de Bithauss es responsable de proporcionar liderazgo, recursos y apoyo para garantizar que las medidas de seguridad de la información cumplan su propósito. Los propietarios de procesos y activos son responsables de la aplicación de medidas de seguridad en su ámbito de trabajo. Todos los colaboradores y terceros deben cumplir con las directrices de esta política y con los controles establecidos por la organización.',
      },
      {
        heading: 'Consideraciones sobre Cambio Climático y Continuidad',
        body: 'Bithauss reconoce que el cambio climático puede constituir un factor relevante que afecte la seguridad de la información y la continuidad de sus operaciones. En consecuencia, la Dirección se compromete a considerar los posibles impactos derivados del cambio climático en el contexto de la seguridad de la información, integrando este aspecto en la valoración de riesgos y en la planificación de la continuidad del negocio.',
      },
      {
        heading: 'Vigencia y Actualización',
        body: 'La presente política entra en vigor a partir de agosto de 2025 y será revisada periódicamente por la Dirección. Cualquier modificación será comunicada a todos los colaboradores, contratistas y terceros relevantes a través de los canales oficiales de Bithauss.',
      },
    ],
  },
  privacidad: {
    title: 'Aviso de Privacidad Integral',
    sections: [
      {
        heading: 'Identidad del Responsable',
        body: 'Bithauss, en su carácter de responsable del tratamiento de datos personales, con domicilio en Ciudad de México, México y portal de internet www.bithauss.com; en cumplimiento de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares vigente, pone a su disposición el presente Aviso de Privacidad Integral.',
      },
      {
        heading: '1. Datos personales que serán tratados',
        body: 'Bithauss recaba y trata las siguientes categorías de datos personales: datos de identificación, datos de contacto, datos laborales y datos financieros o patrimoniales. En el contexto de la plataforma inmobiliaria, también podrán recabarse datos relacionados con la titularidad de bienes inmuebles, así como información necesaria para la emisión del Certificado BRC, incluyendo datos registrales, documentación notarial y la identidad de los brokers inmobiliarios certificados.',
      },
      {
        heading: '2. Finalidades del tratamiento',
        body: 'Los datos personales serán utilizados para: identificación y contacto, integración de expedientes, gestión administrativa, cumplimiento de obligaciones contractuales, fiscales y legales, control de accesos, emisión y gestión del Certificado BRC, verificación de propiedades e identidad de brokers, operación del proceso de compraventa de inmuebles a distancia, y auditorías internas.',
      },
      {
        heading: '3. Consentimiento del titular',
        body: 'El tratamiento de sus datos personales se realizará conforme a los principios establecidos en la legislación aplicable. El consentimiento será tácito para las finalidades primarias, salvo que usted manifieste su oposición. Tratándose de datos personales financieros o patrimoniales, Bithauss recabará su consentimiento expreso previamente a su tratamiento. Tratándose de los datos utilizados para la emisión del Certificado BRC, el titular reconoce que dicha información será registrada en la Blockchain de manera inmutable.',
      },
      {
        heading: '4. Opciones para limitar el uso de datos',
        body: 'El titular podrá limitar el uso o divulgación de sus datos personales mediante solicitud dirigida al correo electrónico privacidad@bithauss.com o mediante escrito presentado en el domicilio señalado en el presente aviso.',
      },
      {
        heading: '5. Transferencia de datos personales',
        body: 'Bithauss podrá transferir sus datos personales a: autoridades competentes en cumplimiento de obligaciones legales, proveedores que prestan servicios necesarios para la operación de la plataforma, notarios públicos y fedatarios en el marco del proceso de compraventa de inmuebles, así como empresas del mismo grupo corporativo que operen bajo políticas internas comunes.',
      },
      {
        heading: '6. Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición)',
        body: 'Usted tiene derecho a acceder a sus datos personales, rectificarlos cuando sean inexactos, cancelarlos cuando considere que no se requieren, así como oponerse a su tratamiento para fines específicos. Para ejercer sus derechos ARCO, envíe su solicitud a privacidad@bithauss.com o acceda al formulario en www.bithauss.com/privacidad. Bithauss dará respuesta en un plazo máximo de veinte días hábiles.',
      },
      {
        heading: '7. Cambios en el Aviso de Privacidad',
        body: 'Bithauss se reserva el derecho de efectuar en cualquier momento modificaciones o actualizaciones al presente Aviso de Privacidad. Dichas modificaciones estarán disponibles a través del sitio web www.bithauss.com. Última actualización: Mayo 2025.',
      },
    ],
  },
}

function Modal({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  const content = legalContent[doc]
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con gradiente igual al de la página */}
        <div className="from-primary to-accent bg-gradient-to-r px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                BitHauss · Legal
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">{content.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {content.sections.map((section) => (
            <div key={section.heading} className="mb-6">
              <h3 className="from-primary to-accent mb-2 bg-gradient-to-r bg-clip-text text-sm font-semibold text-transparent">
                {section.heading}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>

        {/* Footer con botón Aceptar */}
        <div className="border-t border-border/50 bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground text-xs">
              © 2026 BitHauss. Todos los derechos reservados.
            </p>
            <button
              onClick={onClose}
              className="from-primary to-accent hover:shadow-primary/30 rounded-lg bg-gradient-to-r px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:opacity-90 hover:shadow-lg"
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function useLegalModal() {
  const [openDoc, setOpenDoc] = useState<LegalDoc | null>(null)

  const open = (doc: LegalDoc) => setOpenDoc(doc)
  const close = () => setOpenDoc(null)

  const ModalComponent = openDoc ? <Modal doc={openDoc} onClose={close} /> : null

  return { open, ModalComponent }
}
