const { spawn } = require('child_process');
const path = require('path');

const canvas = document.getElementById('videoCanvas');
const ctx = canvas.getContext('2d');

function getVideoInfo(videoPath) {
  return new Promise((resolve, reject) => {
    const ffprobeProcess = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-count_packets',
      '-show_entries', 'stream=width,height,avg_frame_rate',
      '-of', 'json',
      videoPath
    ]);

    let output = '';
    ffprobeProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobeProcess.on('close', (code) => {
      if (code === 0) {
        const info = JSON.parse(output);
        resolve(info.streams[0]);
      } else {
        reject(new Error(`ffprobe process exited with code ${code}`));
      }
    });
  });
}

function calculateSize(videoWidth, videoHeight, maxWidth, maxHeight) {
  let scaleFactor = Math.min(maxWidth / videoWidth, maxHeight / videoHeight);
  let newWidth = Math.floor(videoWidth * scaleFactor);
  let newHeight = Math.floor(videoHeight * scaleFactor);
  return { width: newWidth, height: newHeight };
}

async function startVideoPlayback(videoPath) {
  try {
    const videoInfo = await getVideoInfo(videoPath);
    const maxWidth = window.innerWidth;
    const maxHeight = window.innerHeight;
    const { width, height } = calculateSize(videoInfo.width, videoInfo.height, maxWidth, maxHeight);

    canvas.width = width;
    canvas.height = height;

    const ffmpegArgs = [
      '-i', videoPath,
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-vf', `scale=${width}:${height}`,
      '-'
    ];

    // Add any hardware acceleration options you normally use
    // For example: ffmpegArgs.unshift('-hwaccel', 'auto');

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    let buffer = Buffer.alloc(0);
    const frameSize = width * height * 4; // 4 bytes per pixel (RGBA)

    ffmpegProcess.stdout.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= frameSize) {
        const frameData = buffer.slice(0, frameSize);
        buffer = buffer.slice(frameSize);

        const imageData = new ImageData(
          new Uint8ClampedArray(frameData),
          width,
          height
        );
        ctx.putImageData(imageData, 0, 0);
      }
    });

    ffmpegProcess.stderr.on('data', (data) => {
      console.log('FFmpeg Log:', data.toString());
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`FFmpeg process exited with code ${code}`);
    });

    return ffmpegProcess;
  } catch (error) {
    console.error('Error starting video playback:', error);
  }
}

// Replace with the path to your video file
const videoPath = path.join(__dirname, 'video.mp4');
startVideoPlayback(videoPath);

// Handle window resizing
window.addEventListener('resize', () => {
  startVideoPlayback(videoPath);
});
