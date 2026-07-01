import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { Background } from '../components/Background';
import { IntroLogo } from '../components/IntroLogo';
import { ScreenScene } from '../components/ScreenScene';
import { OutroCTA } from '../components/OutroCTA';
import { FeatureCards } from '../components/FeatureCards';

/**
 * 78-second deep-dive demo @ 30 fps = 2340 frames.
 *
 *  0–90      (0–3s)   Intro
 *  90–300    (3–10s)  Hero — el problema y la promesa
 *  300–570   (10–19s) Catálogo — filtros y comparación
 *  570–870   (19–29s) Detalle — galería, precio, specs
 *  870–1140  (29–38s) Características — áreas comunes y privadas
 *  1140–1440 (38–48s) Certificación BRC — sello notarial
 *  1440–1740 (48–58s) Para Brokers — registro con campos profesionales
 *  1740–1980 (58–66s) Para Inmobiliarias — registro de empresa
 *  1980–2220 (66–74s) Por qué BitHauss — feature cards
 *  2220–2340 (74–78s) Outro CTA
 */
export const Demo90: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />

      <Sequence from={0} durationInFrames={90}>
        <IntroLogo tagline="La plataforma inmobiliaria con sello notarial." />
      </Sequence>

      <Sequence from={90} durationInFrames={210}>
        <ScreenScene
          screenshot="home.png"
          eyebrow="El problema"
          title="El mercado inmobiliario es opaco."
          subtitle="BitHauss certifica cada propiedad para que compres con la documentación validada y el precio claro."
          motion="in"
        />
      </Sequence>

      <Sequence from={300} durationInFrames={270}>
        <ScreenScene
          screenshot="propiedades.png"
          eyebrow="Catálogo"
          title="Filtra, compara, decide."
          subtitle="Casas, departamentos, oficinas. Filtros por ciudad, precio, operación y certificación."
          motion="out"
        />
      </Sequence>

      <Sequence from={570} durationInFrames={300}>
        <ScreenScene
          screenshot="detalle.png"
          eyebrow="Ficha pública"
          title="Cada propiedad, en detalle."
          subtitle="Galería completa, precio transparente y características visibles desde la primera pantalla."
          motion="in"
        />
      </Sequence>

      <Sequence from={870} durationInFrames={270}>
        <ScreenScene
          screenshot="detalle-caracteristicas.png"
          eyebrow="Especificaciones"
          title="Áreas comunes y privadas, separadas."
          subtitle="Sin mezclar amenidades del edificio con las características de la unidad. Como debe ser."
          motion="static"
        />
      </Sequence>

      <Sequence from={1140} durationInFrames={300}>
        <ScreenScene
          screenshot="detalle-mapa.png"
          eyebrow="Confianza"
          title="Certificación BRC notarial."
          subtitle="Documentos validados por notario público. Sello digital verificable desde la ficha pública."
          motion="in"
        />
      </Sequence>

      <Sequence from={1440} durationInFrames={300}>
        <ScreenScene
          screenshot="registro-broker.png"
          eyebrow="Para corredores"
          title="Tu marca, tu cartera."
          subtitle="Registro profesional con RFC, dirección, dos correos, dos teléfonos y foto. Listo para operar."
          motion="out"
        />
      </Sequence>

      <Sequence from={1740} durationInFrames={240}>
        <ScreenScene
          screenshot="registro-inmobiliaria.png"
          eyebrow="Para inmobiliarias"
          title="Tu empresa en BitHauss."
          subtitle="Registra tu razón social y centraliza la operación de toda tu cartera de propiedades."
          motion="in"
        />
      </Sequence>

      <Sequence from={1980} durationInFrames={240}>
        <FeatureCards />
      </Sequence>

      <Sequence from={2220} durationInFrames={120}>
        <OutroCTA url="bithauss.com" />
      </Sequence>
    </AbsoluteFill>
  );
};
