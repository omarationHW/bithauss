import { Config } from '@remotion/cli/config';

// 1080p MP4 with H.264 — universal playback target.
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(2);
