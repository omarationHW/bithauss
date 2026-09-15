/**
 * Genera la narración del tutorial con la voz del sistema (macOS `say`,
 * voz Paulina es-MX) a partir de public/audio/<carpeta>/script.json y
 * escribe narration.json con la duración exacta de cada clip.
 *
 *   node scripts/generate-narration.mjs marca-agua
 *
 * Requiere macOS (`say`) y ffmpeg/ffprobe en PATH.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

const folder = process.argv[2];
if (!folder) throw new Error("Uso: node scripts/generate-narration.mjs <carpeta>");
const base = `public/audio/${folder}`;
const items = JSON.parse(readFileSync(`${base}/script.json`, "utf8"));
const out = [];
for (const it of items) {
  const aiff = `${base}/${it.id}.aiff`;
  const wav = `${base}/${it.id}.wav`;
  execSync(`say -v Paulina -r 175 -o "${aiff}" ${JSON.stringify(it.text)}`);
  execSync(`ffmpeg -y -loglevel error -i "${aiff}" -ar 48000 -ac 2 "${wav}"`);
  unlinkSync(aiff);
  const seconds = parseFloat(
    execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${wav}"`).toString(),
  );
  out.push({ id: it.id, file: `audio/${folder}/${it.id}.wav`, text: it.text, seconds });
  console.log(it.id, `${seconds.toFixed(2)}s`);
}
writeFileSync(`${base}/narration.json`, JSON.stringify(out, null, 2));
console.log("total", `${out.reduce((a, b) => a + b.seconds, 0).toFixed(1)}s`);
