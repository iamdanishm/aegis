import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';

// Set the path to the ffmpeg binary
// Set the path to the ffmpeg binary
if (ffmpegPath) {
    if (fs.existsSync(ffmpegPath)) {
        ffmpeg.setFfmpegPath(ffmpegPath);
    } else {
        // Fallback for some windows structures or monorepos
        // Try both .exe and no extension
        const altPathExe = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
        const altPathBin = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg');

        if (fs.existsSync(altPathExe)) {
            ffmpeg.setFfmpegPath(altPathExe);
        } else if (fs.existsSync(altPathBin)) {
            ffmpeg.setFfmpegPath(altPathBin);
        } else {
            console.warn(`[VIDEO-UTILS] Warning: ffmpeg-static binary not found at ${ffmpegPath}, ${altPathExe}, or ${altPathBin}!`);
        }
    }
} else {
    console.warn("[VIDEO-UTILS] Warning: ffmpeg-static binary not found! Video frame extraction may fail.");
}

/**
 * Extracts a high-resolution frame from a video file at a specific timestamp.
 * @param videoPath Absolute path to the source video file
 * @param outputDir Directory to save the extracted frame
 * @param timestamp Timestamp string (HH:MM:SS) to extract, default is 1 sec in
 */
export async function extractFrame(videoPath: string, outputDir: string, timestamp: string = '00:00:01'): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            // Ensure output directory exists
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const filename = `forensic_snapshot_${Date.now()}.jpg`;
            const outputPath = path.join(outputDir, filename);

            console.log(`[VIDEO-UTILS] Extracting forensic frame from ${path.basename(videoPath)}...`);

            ffmpeg(videoPath)
                .screenshots({
                    timestamps: [timestamp],
                    filename: filename,
                    folder: outputDir,
                    size: '1920x1080' // Force high resolution for forensics
                })
                .on('end', () => {
                    console.log(`[VIDEO-UTILS] Frame extracted: ${filename}`);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    console.error(`[VIDEO-UTILS] extraction error:`, err);
                    reject(err);
                });
        } catch (error) {
            reject(error);
        }
    });
}
