import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { Background } from '../components/Background';
import { IntroLogo } from '../components/IntroLogo';
import { ScreenScene } from '../components/ScreenScene';
import { OutroCTA } from '../components/OutroCTA';

/**
 * 24-second corporate reel @ 30 fps = 720 frames total.
 *
 * Timing:
 *   0–60     (0–2s)   Intro logo + tagline
 *   60–210   (2–7s)   Landing hero — "Compra, renta y certifica"
 *   210–360  (7–12s)  Listado de propiedades — "Catálogo verificado"
 *   360–510  (12–17s) Detalle — "Precio claro · Características privadas"
 *   510–660  (17–22s) Certificación BRC — "Documentos validados por notario"
 *   660–720  (22–24s) Outro CTA
 */
export const Reel20: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />

      <Sequence from={0} durationInFrames={60}>
        <IntroLogo tagline="Inmuebles certificados, sin intermediarios." />
      </Sequence>

      <Sequence from={60} durationInFrames={150}>
        <ScreenScene
          screenshot="home.png"
          eyebrow="Mercado"
          title="Compra, renta y certifica"
          subtitle="Propiedades publicadas con transparencia de precio y verificación documental."
          motion="in"
        />
      </Sequence>

      <Sequence from={210} durationInFrames={150}>
        <ScreenScene
          screenshot="propiedades.png"
          eyebrow="Catálogo"
          title="Filtra y compara"
          subtitle="Casas, departamentos y oficinas en venta o renta. Filtros por ciudad y precio."
          motion="out"
        />
      </Sequence>

      <Sequence from={360} durationInFrames={150}>
        <ScreenScene
          screenshot="detalle.png"
          eyebrow="Ficha"
          title="Cada propiedad, en detalle"
          subtitle="Áreas comunes, características privadas y galería completa. Descarga ficha técnica en PDF."
          motion="in"
        />
      </Sequence>

      <Sequence from={510} durationInFrames={150}>
        <ScreenScene
          screenshot="brc.png"
          eyebrow="Confianza"
          title="Certificación BRC"
          subtitle="Documentos legales validados por notario público. Sello digital verificable."
          motion="static"
        />
      </Sequence>

      <Sequence from={660} durationInFrames={60}>
        <OutroCTA url="bithauss.com" />
      </Sequence>
    </AbsoluteFill>
  );
};
