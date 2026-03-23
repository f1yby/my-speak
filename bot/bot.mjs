/**
 * My-Speak Audio Bot
 *
 * Connects to a deployed My-Speak server, creates a "test" VOICE channel,
 * joins it, and loops an audio file continuously via WebRTC/mediasoup.
 *
 * Prerequisites:
 *   - Node.js >= 20
 *   - ffmpeg installed on the system (for audio decoding)
 *   - npm install (in the bot/ directory)
 *
 * Usage:
 *   node bot.mjs --url https://speak.f1yby.space:8443 --password <server_password>
 *   node bot.mjs --url https://speak.f1yby.space:8443 --password <server_password> --audio ./music.mp3
 *   node bot.mjs --url https://speak.f1yby.space:8443 --password <server_password> --channel "my-channel"
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Device } from 'mediasoup-client';

// Polyfill WebRTC for Node.js using @roamhq/wrtc
import wrtc from '@roamhq/wrtc';
const { RTCAudioSource } = wrtc.nonstandard;
globalThis.RTCPeerConnection = wrtc.RTCPeerConnection;
globalThis.RTCSessionDescription = wrtc.RTCSessionDescription;
globalThis.RTCIceCandidate = wrtc.RTCIceCandidate;
globalThis.MediaStream = wrtc.MediaStream;
globalThis.MediaStreamTrack = wrtc.MediaStreamTrack;

// --------------- Config ---------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    url: 'https://speak.f1yby.space:8443',
    password: '',
    username: 'AudioBot',
    channel: 'test',
    audio: path.join(__dirname, 'sample.wav'),
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        config.url = args[++i];
        break;
      case '--password':
        config.password = args[++i];
        break;
      case '--username':
        config.username = args[++i];
        break;
      case '--channel':
        config.channel = args[++i];
        break;
      case '--audio':
        config.audio = args[++i];
        break;
      case '--help':
        console.log(`
My-Speak Audio Bot

Options:
  --url <url>         Server URL (default: https://speak.f1yby.space:8443)
  --password <pwd>    Server password (required)
  --username <name>   Bot username (default: AudioBot)
  --channel <name>    Voice channel name (default: test)
  --audio <file>      Audio file to loop (default: ./sample.wav)
  --help              Show this help
        `);
        process.exit(0);
    }
  }

  if (!config.password) {
    console.error('Error: --password is required');
    process.exit(1);
  }

  return config;
}

// --------------- Audio Decoder (ffmpeg → raw PCM) ---------------

class AudioLooper {
  constructor(filePath) {
    this.filePath = filePath;
    this.process = null;
    this.running = false;
    this.onData = null;
  }

  /**
   * Start ffmpeg to decode audio to raw PCM (48kHz, mono, s16le),
   * looping infinitely using -stream_loop.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this._spawn();
  }

  _spawn() {
    if (!this.running) return;

    // ffmpeg decodes the file to raw PCM: 48kHz, mono, signed 16-bit little-endian
    // -stream_loop -1 means infinite loop
    this.process = spawn('ffmpeg', [
      '-re',                   // Read at native frame rate
      '-stream_loop', '-1',    // Loop forever
      '-i', this.filePath,
      '-acodec', 'pcm_s16le',
      '-ar', '48000',
      '-ac', '1',
      '-f', 's16le',
      'pipe:1',
    ], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    this.process.stdout.on('data', (chunk) => {
      if (this.onData) {
        this.onData(chunk);
      }
    });

    this.process.on('close', (code) => {
      console.log(`[AudioLooper] ffmpeg exited with code ${code}`);
      if (this.running) {
        console.log('[AudioLooper] Restarting ffmpeg...');
        setTimeout(() => this._spawn(), 1000);
      }
    });

    this.process.on('error', (err) => {
      console.error('[AudioLooper] ffmpeg error:', err.message);
    });

    console.log('[AudioLooper] ffmpeg started, looping:', this.filePath);
  }

  stop() {
    this.running = false;
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}

// --------------- Fake Audio Track (PCM → WebRTC) ---------------

/**
 * Creates a fake MediaStreamTrack that pushes PCM audio frames
 * from ffmpeg into the mediasoup-client producer.
 *
 * @roamhq/wrtc provides RTCAudioSource in its nonstandard API
 * to create audio tracks from raw PCM data.
 */
class FakeAudioTrack {
  constructor() {
    this.source = new RTCAudioSource();
    this.track = this.source.createTrack();
    this.sampleRate = 48000;
    this.channels = 1;
    this.samplesPerFrame = 960; // 20ms at 48kHz
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Feed raw PCM s16le data.
   * Splits into 20ms frames and sends to the WebRTC track.
   */
  pushPCM(pcmData) {
    this.buffer = Buffer.concat([this.buffer, pcmData]);
    const frameBytes = this.samplesPerFrame * this.channels * 2; // 2 bytes per sample (s16le)

    while (this.buffer.length >= frameBytes) {
      const frame = this.buffer.subarray(0, frameBytes);
      this.buffer = this.buffer.subarray(frameBytes);

      // Convert Buffer to Int16Array samples
      const samples = new Int16Array(frame.buffer, frame.byteOffset, this.samplesPerFrame);

      try {
        this.source.onData({
          samples,
          sampleRate: this.sampleRate,
          bitsPerSample: 16,
          channelCount: this.channels,
          numberOfFrames: this.samplesPerFrame,
        });
      } catch (e) {
        // Ignore errors when track is not ready yet
      }
    }
  }

  getTrack() {
    return this.track;
  }
}

// --------------- Bot Logic ---------------

async function main() {
  const config = parseArgs();
  const baseURL = `${config.url}/api`;

  console.log('=== My-Speak Audio Bot ===');
  console.log(`Server:   ${config.url}`);
  console.log(`Username: ${config.username}`);
  console.log(`Channel:  ${config.channel}`);
  console.log(`Audio:    ${config.audio}`);
  console.log('');

  // Verify audio file exists
  if (!fs.existsSync(config.audio)) {
    console.error(`Error: Audio file not found: ${config.audio}`);
    console.error('Please provide an audio file with --audio <path>');
    console.error('Or place a sample.wav in the bot/ directory');
    process.exit(1);
  }

  // Verify ffmpeg is available
  try {
    spawn('ffmpeg', ['-version'], { stdio: 'ignore' }).on('error', () => {
      throw new Error('ffmpeg not found');
    });
  } catch {
    console.error('Error: ffmpeg is required but not found. Please install it.');
    process.exit(1);
  }

  const api = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false }),
  });

  // Step 1: Login
  console.log('[Bot] Logging in...');
  let token;
  try {
    const res = await api.post('/auth/login', {
      password: config.password,
      username: config.username,
    });
    token = res.data.data.token;
    console.log(`[Bot] Logged in as "${config.username}", token: ${token.substring(0, 8)}...`);
  } catch (err) {
    console.error('[Bot] Login failed:', err.response?.data || err.message);
    process.exit(1);
  }

  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

  // Step 2: Create VOICE channel "test" (or use existing)
  let channelId;
  try {
    console.log(`[Bot] Creating voice channel "${config.channel}"...`);
    const res = await api.post('/channels', {
      name: config.channel,
      type: 'VOICE',
    });
    channelId = res.data.data.id;
    console.log(`[Bot] Channel created: ${channelId}`);
  } catch (err) {
    if (err.response?.data?.error?.code === 'NAME_EXISTS') {
      console.log(`[Bot] Channel "${config.channel}" already exists, fetching...`);
      const res = await api.get('/channels');
      const ch = res.data.data.find((c) => c.name === config.channel);
      if (!ch) {
        console.error('[Bot] Channel not found after NAME_EXISTS error');
        process.exit(1);
      }
      channelId = ch.id;
      console.log(`[Bot] Using existing channel: ${channelId}`);
    } else {
      console.error('[Bot] Failed to create channel:', err.response?.data || err.message);
      process.exit(1);
    }
  }

  // Step 3: Connect Socket.IO
  console.log('[Bot] Connecting Socket.IO...');
  const socket = io(config.url, {
    auth: { token },
    transports: ['websocket'],
    rejectUnauthorized: false,
  });

  await new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log(`[Bot] Socket connected: ${socket.id}`);
      resolve();
    });
    socket.on('connect_error', (err) => {
      console.error('[Bot] Socket connection error:', err.message);
      reject(err);
    });
    setTimeout(() => reject(new Error('Socket connection timeout')), 10000);
  });

  // Step 4: Join voice channel
  console.log(`[Bot] Joining voice channel ${channelId}...`);

  const joinedData = await new Promise((resolve, reject) => {
    socket.once('voice:joined', (data) => resolve(data));
    socket.emit('voice:join', channelId);
    setTimeout(() => reject(new Error('voice:join timeout')), 10000);
  });

  console.log('[Bot] Joined voice channel, RTP capabilities received');
  console.log('[Bot] Existing users:', joinedData.users?.length || 0);

  // Step 5: Initialize mediasoup Device
  const device = new Device();
  await device.load({ routerRtpCapabilities: joinedData.rtpCapabilities });
  console.log('[Bot] mediasoup Device loaded');

  // Step 6: Create send transport
  const sendTransportParams = await new Promise((resolve) => {
    socket.emit('voice:create-transport', resolve);
  });

  if (sendTransportParams.error) {
    console.error('[Bot] Failed to create send transport:', sendTransportParams.error);
    process.exit(1);
  }

  const sendTransport = device.createSendTransport({
    id: sendTransportParams.id,
    iceParameters: sendTransportParams.iceParameters,
    iceCandidates: sendTransportParams.iceCandidates,
    dtlsParameters: sendTransportParams.dtlsParameters,
  });

  sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
    try {
      await new Promise((resolve, reject) => {
        socket.emit('voice:connect-transport', {
          transportId: sendTransportParams.id,
          dtlsParameters,
        }, (result) => {
          if (result.error) reject(new Error(result.error));
          else resolve();
        });
      });
      callback();
    } catch (error) {
      errback(error);
    }
  });

  sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
    try {
      const result = await new Promise((resolve) => {
        socket.emit('voice:produce', {
          transportId: sendTransportParams.id,
          kind,
          rtpParameters,
        }, resolve);
      });
      if (result.error) {
        errback(new Error(result.error));
      } else {
        callback({ id: result.producerId });
      }
    } catch (error) {
      errback(error);
    }
  });

  // Create recv transport too (required by server protocol)
  const recvTransportParams = await new Promise((resolve) => {
    socket.emit('voice:create-transport', resolve);
  });

  socket.emit('voice:set-transport', {
    sendTransportId: sendTransportParams.id,
    recvTransportId: recvTransportParams.id,
  });

  console.log('[Bot] Transports created');

  // Step 7: Create fake audio track and produce
  const fakeAudio = new FakeAudioTrack();
  const track = fakeAudio.getTrack();

  console.log('[Bot] Producing audio...');
  const producer = await sendTransport.produce({
    track,
    codecOptions: {
      opusStereo: false,
      opusDtx: true,
    },
  });

  console.log(`[Bot] Producer created: ${producer.id}`);

  // Step 8: Start audio looper
  const looper = new AudioLooper(config.audio);
  looper.onData = (pcmData) => {
    fakeAudio.pushPCM(pcmData);
  };
  looper.start();

  // Emit speaking state
  socket.emit('voice:speaking', true);

  console.log('');
  console.log('=== Bot is now playing audio in loop ===');
  console.log('Press Ctrl+C to stop');
  console.log('');

  // Graceful shutdown
  function cleanup() {
    console.log('\n[Bot] Shutting down...');
    socket.emit('voice:speaking', false);
    looper.stop();
    producer?.close();
    sendTransport?.close();
    socket.emit('voice:leave');
    socket.disconnect();
    console.log('[Bot] Disconnected. Bye!');
    process.exit(0);
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep alive
  setInterval(() => {
    // Periodic keepalive / status log
  }, 30000);
}

main().catch((err) => {
  console.error('[Bot] Fatal error:', err);
  process.exit(1);
});
