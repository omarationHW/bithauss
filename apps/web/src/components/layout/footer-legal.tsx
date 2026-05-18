'use client'

import { useLegalModal } from './legal-modal'

export function FooterLegal() {
  const { open, ModalComponent } = useLegalModal()

  return (
    <>
      {ModalComponent}
      <ul className="space-y-2.5">
        <li>
          <button
            onClick={() => open('terminos')}
            className="text-sm text-background transition-colors hover:text-background/70 text-left"
          >
            Términos y Condiciones
          </button>
        </li>
        <li>
          <button
            onClick={() => open('politica')}
            className="text-sm text-background transition-colors hover:text-background/70 text-left"
          >
            Política de Seguridad
          </button>
        </li>
        <li>
          <button
            onClick={() => open('privacidad')}
            className="text-sm text-background transition-colors hover:text-background/70 text-left"
          >
            Aviso de Privacidad
          </button>
        </li>
      </ul>
    </>
  )
}
