// scripts/practice/buildPracticeKeys.ts が作るファイル。手で書きかえない。
import type { PracticeKeys } from "./keys";

export const PRACTICE_KEYS: PracticeKeys = {
  "dv-export": {
    "durationSec": 25.79,
    "maxMb": 5
  },
  "cut-basics": {
    "speechSec": 17.82
  },
  "cut-remove": {
    "cleanSpeechSec": 36.08,
    "rawSpeechSec": 42.65,
    "extraToleranceSec": 0.14,
    "lostToleranceSec": 0.6
  },
  "cut-ma": {
    "speechSec": 34.55
  },
  "bgm": {
    "durationSec": 60.71,
    "voiceStart": 3.47,
    "voiceEnd": 52.95
  },
  "voice-level": {
    "sceneSec": [
      23.68,
      16.84,
      13.61
    ],
    "levelDb": [
      0,
      -2.99,
      1.26
    ]
  }
};
