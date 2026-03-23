/**
 * Generate a simple sine wave WAV file for testing.
 * Usage: node generate-sample.mjs [output.wav] [duration_seconds]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const outputFile = process.argv[2] || path.join(__dirname, 'sample.wav');
const durationSec = parseFloat(process.argv[3] || '5');
const sampleRate = 48000;
const numChannels = 1;
const bitsPerSample = 16;
const frequency = 440; // A4 note

const numSamples = Math.floor(sampleRate * durationSec);
const bytesPerSample = bitsPerSample / 8;
const dataSize = numSamples * numChannels * bytesPerSample;

// WAV header (44 bytes)
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + dataSize, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);            // Subchunk1Size (PCM)
header.writeUInt16LE(1, 20);             // AudioFormat (PCM)
header.writeUInt16LE(numChannels, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
header.writeUInt16LE(numChannels * bytesPerSample, 32);
header.writeUInt16LE(bitsPerSample, 34);
header.write('data', 36);
header.writeUInt32LE(dataSize, 40);

// Generate sine wave data
const data = Buffer.alloc(dataSize);
for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  // Mix two frequencies for a more pleasant sound
  const sample = Math.sin(2 * Math.PI * frequency * t) * 0.3
               + Math.sin(2 * Math.PI * (frequency * 1.5) * t) * 0.2;
  const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
  data.writeInt16LE(intSample, i * bytesPerSample);
}

fs.writeFileSync(outputFile, Buffer.concat([header, data]));
console.log(`Generated: ${outputFile} (${durationSec}s, ${sampleRate}Hz, ${frequency}Hz sine)`);
