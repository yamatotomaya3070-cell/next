# 動画生成ワーカー用イメージ（Linux）。
# Windows SAPI を使わず VOICEVOX + ffmpeg で完結するため、このPCに依存しない。
FROM node:20-bookworm-slim

# ffmpeg（レンダリング/音声処理）と日本語フォント（字幕/焼き込みテキスト）
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      fonts-noto-cjk \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 依存インストール（tsx / sharp は devDependency のため全依存を入れる）
COPY package.json package-lock.json* ./
RUN npm install

# アプリ本体
COPY . .

# 字幕・焼き込みテキスト用フォント（コンテナ同梱の Noto CJK を使う）
ENV VIDEO_FONT_FILE=/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc
ENV VIDEO_FONT_NAME="Noto Sans CJK JP"
ENV WORKER_POLL_MS=15000

# SCENEパイプライン（ハル/ミナ・教室×黒板テーマ）のワーカーを常駐（--watch）で起動。
# 背景/BGM/オープニング・エンディング等の共通素材は assets/video/ にコミット済みのものを使う
# （image生成APIを都度叩かず、事前生成済みアセットを使い回す設計）。
CMD ["npx", "tsx", "scripts/scene/worker.ts", "--watch"]
