/**
 * DaVinci Resolve 動画編集の教科書（どの動画・どの案件でも使う共通の操作）。
 * 手順書(ManualStep.guide)から "章slug#節id" で参照される。
 * 画像は public/guide/img、操作動画は public/guide/video に置く。
 */

export interface GuideMark {
  /** 画像の赤い番号 */
  n: number;
  label: string;
}

export interface GuideStep {
  text: string;
  /** キー操作などの補足 */
  hint?: string;
}

export interface GuideSection {
  id: string;
  title: string;
  lead?: string;
  steps: GuideStep[];
  image?: { src: string; alt: string; marks?: GuideMark[] };
  note?: { kind: "tip" | "warn"; title: string; body: string };
  /** この節で使うファイル（public に置いたもの） */
  download?: { href: string; label: string; size: string };
}

export interface GuideChapter {
  slug: string;
  no: number;
  title: string;
  summary: string;
  /** 職員向けの章（利用者の一覧では後ろに回す） */
  forStaff?: boolean;
  /** 操作動画（ナレーション付き）。未収録なら undefined */
  video?: { src: string; poster?: string };
  sections: GuideSection[];
}

const img = (name: string) => `/guide/img/${name}.jpg`;
// 操作動画は poc/guide/build_video.mjs で作る（画面録画＋ナレーション）
const vid = (slug: string) => ({ src: `/guide/video/${slug}.mp4`, poster: `/guide/video/${slug}.jpg` });

export const GUIDE_CHAPTERS: GuideChapter[] = [
  {
    slug: "screen",
    video: vid("screen"),
    no: 1,
    title: "DaVinci の画面の見方",
    summary: "どこに何があるかを覚えます。手順書に出てくる場所の名前は、ぜんぶこの章の名前です。",
    sections: [
      {
        id: "map",
        title: "編集の画面（エディット）",
        lead: "動画を作る作業は、ほとんどこの画面で行います。",
        steps: [
          { text: "①メディアプール：読み込んだ素材（映像・音声・画像）が並ぶ場所" },
          { text: "②ビューア：いまの動画の見え方を確認する場所" },
          { text: "③インスペクタ：えらんだものの文字・大きさ・音量などを変える場所" },
          { text: "④エフェクト：字幕やテロップの型（タイトル）を探す場所" },
          { text: "⑤タイムライン：素材を横に並べて、動画の順番と長さを決める場所" },
          { text: "⑥ページの切りかえ：左から順に、メディア・カット・エディット・Fusion・カラー・Fairlight・デリバー" },
        ],
        image: {
          src: img("g_screen_map"),
          alt: "DaVinci Resolve のエディット画面。6つの場所に番号つきの赤い枠",
          marks: [
            { n: 1, label: "メディアプール" },
            { n: 2, label: "ビューア" },
            { n: 3, label: "インスペクタ" },
            { n: 4, label: "エフェクト" },
            { n: 5, label: "タイムライン" },
            { n: 6, label: "ページの切りかえ" },
          ],
        },
        note: {
          kind: "tip",
          title: "タイムラインの段（トラック）",
          body: "V1・V2…は映像や文字の段で、数字が大きいほど上に重なって見えます。A1・A2…は音の段です。",
        },
      },
      {
        id: "keys",
        title: "よく使うキー",
        steps: [
          { text: "1つ前にもどす", hint: "Ctrl + Z" },
          { text: "保存する（こまめに押す）", hint: "Ctrl + S" },
          { text: "再生・停止", hint: "スペース" },
          { text: "えらんだものを消す（うしろは詰めない）", hint: "Backspace" },
          { text: "タイムライン全体を画面に入れる", hint: "Shift + Z" },
        ],
        note: {
          kind: "warn",
          title: "Delete キーに注意",
          body: "Delete で消すと、うしろにある素材が前に詰められて時間がずれます。消すときは Backspace を使います。",
        },
      },
    ],
  },
  {
    slug: "project",
    no: 2,
    title: "プロジェクトを作る・開く・保存する",
    summary: "動画1本につき、プロジェクトを1つ作ります。",
    sections: [
      {
        id: "new",
        title: "新しいプロジェクトを作る",
        steps: [
          { text: "右下の家のマークを押して、プロジェクトの一覧を出す" },
          { text: "①［新規プロジェクト］を押す" },
          { text: "動画の名前（たとえば「新NISA_自分の名前」）を入れて、［作成］を押す" },
        ],
        image: {
          src: img("g_new_project"),
          alt: "プロジェクト一覧の右下にある新規プロジェクトのボタンに赤い枠",
          marks: [{ n: 1, label: "新規プロジェクト" }],
        },
      },
      {
        id: "rename",
        title: "名前を変える",
        steps: [
          { text: "プロジェクトの一覧で、名前を変えたいプロジェクトを右クリックして［名前を変更…］を押す" },
          { text: "①に新しい名前を入れて、②［OK］を押す" },
        ],
        image: {
          src: img("b3_rename"),
          alt: "プロジェクト名を変更する小さな画面。名前の欄とOKボタンに赤い印",
          marks: [
            { n: 1, label: "新しい名前" },
            { n: 2, label: "OK" },
          ],
        },
      },
      {
        id: "save",
        title: "保存する",
        steps: [
          { text: "作業のとちゅうで、こまめに Ctrl + S を押す", hint: "Ctrl + S" },
          { text: "DaVinci が急にとじても、開きなおせば最後に保存したところから続けられます" },
        ],
      },
    ],
  },
  {
    slug: "import",
    video: vid("import"),
    no: 3,
    title: "素材を入れる",
    summary: "支給された素材を、フォルダごとメディアプールに入れます。",
    sections: [
      {
        id: "drag",
        title: "フォルダごとドラッグして入れる",
        steps: [
          { text: "エクスプローラーで「素材」フォルダを開き、DaVinci の横に並べる" },
          { text: "フォルダの中をクリックして、Ctrl + A で中のフォルダを全部えらぶ", hint: "Ctrl + A" },
          { text: "①えらんだフォルダを、DaVinci の左上（メディアプール）までドラッグしてはなす" },
        ],
        image: {
          src: img("b5_drag_folders"),
          alt: "エクスプローラーでフォルダを全部えらび、DaVinciの左上へドラッグする矢印",
          marks: [{ n: 1, label: "フォルダを全部えらんで左上へドラッグ" }],
        },
        note: {
          kind: "tip",
          title: "［メディアの読み込み］を使わない理由",
          body: "右クリックの［メディアの読み込み］では、フォルダの中のフォルダが入りません。ドラッグがいちばん確実です。",
        },
      },
      {
        id: "check",
        title: "入ったか確かめる",
        steps: [{ text: "メディアプールに音声・映像・画像のアイコンが並べば成功です" }],
        image: { src: img("b6_pool_filled"), alt: "メディアプールに素材のアイコンがたくさん並んだ画面" },
      },
    ],
  },
  {
    slug: "arrange",
    video: vid("arrange"),
    no: 4,
    title: "素材を並べる",
    summary: "オープニング・場面の映像・セリフ・BGM・エンディングをタイムラインに並べます。絆の案件はボタン1つで並びます。",
    sections: [
      {
        id: "auto",
        title: "絆の案件：スクリプトで一気に並べる",
        lead: "素材の読み込みまで終わったら使います。ファイル名の番号順に、決まった間隔で並びます。",
        steps: [
          { text: "①上のメニューの［ワークスペース］を押す" },
          { text: "②［スクリプト］にマウスを乗せて、③［絆_素材を並べる］を押す" },
          { text: "30秒ほど待つ。並べ終わると、ビューアに「並べ終わりました。」と出ます" },
        ],
        image: {
          src: img("arrange_menu"),
          alt: "ワークスペースメニューを開き、スクリプトの中の絆_素材を並べるに赤い枠",
          marks: [
            { n: 1, label: "ワークスペース" },
            { n: 2, label: "スクリプト" },
            { n: 3, label: "絆_素材を並べる" },
          ],
        },
        note: {
          kind: "tip",
          title: "メニューに出てこないとき",
          body: "パソコンの準備（職員の方の作業）がまだです。職員の方に声をかけてください。",
        },
      },
      {
        id: "auto-done",
        title: "並べ終わったか確かめる",
        steps: [
          { text: "①ビューアに「並べ終わりました。」と、映像・セリフ・BGMの本数が出ていれば完了です" },
          { text: "②タイムラインに、セリフ（A1）とBGM（A2）が最後のエンディングまで並んでいます" },
          { text: "「置けなかったもの」と赤く出たときは、職員の方に声をかけてください" },
        ],
        image: {
          src: img("arrange_done"),
          alt: "ビューアに並べ終わりましたというメッセージ、タイムラインにセリフとBGMが並んだ画面",
          marks: [
            { n: 1, label: "完了のお知らせ" },
            { n: 2, label: "並んだ素材" },
          ],
        },
        note: {
          kind: "tip",
          title: "お知らせを消したいとき",
          body: "お知らせは、タイムラインの先頭にある緑の印（マーカー）です。再生の位置を少し右に動かすと消えます。書き出した動画には出ません。",
        },
      },
      {
        id: "manual-voices",
        title: "自分で並べる①：セリフの音声を順番どおりに入れる",
        lead: "外部のお仕事など、スクリプトが使えないときのやり方です。",
        steps: [
          { text: "メディアプール上の①表示の切り替えを押し、②［リストビュー］を選ぶ" },
          { text: "虫めがねを押して、検索の欄に音声のファイル名に共通する文字（例：_0）を入れる" },
          { text: "一覧のどれか1つをクリックして、Ctrl + A で全部えらぶ", hint: "Ctrl + A" },
          { text: "上のメニュー［編集］→［タイムラインの末尾に追加］を押す" },
        ],
        image: {
          src: img("b7_list_view"),
          alt: "メディアプール上部の表示切り替えメニューで、リストビューに赤い四角",
          marks: [
            { n: 1, label: "表示の切り替え" },
            { n: 2, label: "リストビュー" },
          ],
        },
      },
      {
        id: "manual-append",
        title: "［タイムラインの末尾に追加］の場所",
        steps: [{ text: "①［編集］を押し、②［タイムラインの末尾に追加］を押す" }],
        image: {
          src: img("b9_append_menu"),
          alt: "編集メニューを開き、タイムラインの末尾に追加に赤い四角",
          marks: [
            { n: 1, label: "編集" },
            { n: 2, label: "タイムラインの末尾に追加" },
          ],
        },
      },
      {
        id: "manual-video",
        title: "自分で並べる②：映像を置いて長さを合わせる",
        steps: [
          { text: "映像を、V1 の段の、その場面の最初の音声の頭までドラッグする" },
          { text: "映像の右はしにマウスを乗せ、左右の矢印の形になったら、その場面の最後の音声の終わりまでドラッグする" },
        ],
        image: {
          src: img("b13_trim_video"),
          alt: "映像クリップの右はしをつかんで、場面の最後の音声の終わりに合わせている画面",
          marks: [
            { n: 1, label: "映像の右はし" },
            { n: 2, label: "その場面の音声が終わる所" },
          ],
        },
        note: {
          kind: "tip",
          title: "見えにくいとき",
          body: "タイムラインの右上の［＋］を押すと、段が横に広がって合わせやすくなります。",
        },
      },
    ],
  },
  {
    slug: "subtitles",
    video: vid("subtitles"),
    no: 5,
    title: "字幕を入れる",
    summary: "セリフ1本に字幕を1つ入れます。字幕の型を置いて、長さを合わせて、文字を貼ります。",
    sections: [
      {
        id: "place",
        title: "字幕の型を置く",
        lead: "型は話す人ごとに色が決まっています。音声ファイル名の最後に書いてある人の型を使います。",
        steps: [
          { text: "左下の［エフェクト］で［タイトル］を開き、検索に「絆」と入れる" },
          { text: "①話す人の字幕の型を、字幕の段（V3）の、その音声の頭までドラッグする" },
        ],
        image: {
          src: img("b16_drag_subtitle"),
          alt: "字幕の型を、V3の段の先頭へドラッグする矢印",
          marks: [{ n: 1, label: "字幕の型を V3 の音声の頭へ" }],
        },
      },
      {
        id: "length",
        title: "長さを音声に合わせる",
        steps: [{ text: "②字幕の右はしを、その音声の終わりまでドラッグする" }],
        image: {
          src: img("b17_trim_subtitle"),
          alt: "字幕クリップの右はしを、下の音声の終わりに合わせている画面",
          marks: [{ n: 2, label: "字幕の右はし" }],
        },
      },
      {
        id: "text",
        title: "文字を入れる",
        steps: [
          { text: "作業指示一覧のセリフの文をコピーする", hint: "Ctrl + C" },
          { text: "字幕をクリックしてえらび、③インスペクタの文字の欄を全部えらんで貼る", hint: "Ctrl + A → Ctrl + V" },
          { text: "赤い線（再生の位置）を字幕の上に動かして、④ビューアで見え方を確かめる" },
        ],
        image: {
          src: img("b18_type_subtitle"),
          alt: "インスペクタの文字の欄にセリフを貼り、ビューアに字幕が表示された画面",
          marks: [
            { n: 3, label: "文字の欄" },
            { n: 4, label: "見え方" },
          ],
        },
      },
    ],
  },
  {
    slug: "telop",
    video: vid("telop"),
    no: 6,
    title: "強調テロップを入れる",
    summary: "画面の上に出る、黄色い大きな文字です。作業指示一覧に文字が書いてある場面だけ入れます。",
    sections: [
      {
        id: "place",
        title: "テロップを置いて文字を入れる",
        steps: [
          { text: "①［絆_強調テロップ］を、強調テロップの段（V4）までドラッグする。始まりと終わりは作業指示一覧の補足に合わせる" },
          { text: "テロップをえらび、②インスペクタの文字の欄に作業指示一覧の「強調テロップ」の文を貼る" },
          { text: "③ビューアの上に黄色い文字が出れば完成です" },
        ],
        image: {
          src: img("b19_telop"),
          alt: "V4の段に強調テロップを置き、文字の欄に文を入れ、ビューア上にテロップが出た画面",
          marks: [
            { n: 1, label: "V4 のテロップ" },
            { n: 2, label: "文字の欄" },
            { n: 3, label: "見え方" },
          ],
        },
        note: {
          kind: "warn",
          title: "文字が二重にならないように",
          body: "作業指示一覧の強調テロップの欄が空いている場面には入れません。図や数字の映像には、はじめから文字が入っています。",
        },
      },
    ],
  },
  {
    slug: "audio",
    video: vid("audio"),
    no: 7,
    title: "BGM と音量",
    summary: "BGM を声より小さくして、セリフがはっきり聞こえるようにします。",
    sections: [
      {
        id: "volume",
        title: "BGM の音量を下げる",
        steps: [
          { text: "Ctrl を押しながら、①BGM の段にあるBGMを全部クリックしてえらぶ", hint: "Ctrl + クリック" },
          { text: "右上の［インスペクタ］を開き、②ボリュームの数字に -20 と入れて Enter", hint: "-20 → Enter" },
          { text: "声の大きさはさわりません（支給した声は、ちょうどよい大きさにしてあります）" },
        ],
        image: {
          src: img("b15_bgm_volume"),
          alt: "BGMの段のBGMを全部えらび、インスペクタのボリュームに-20と入れた画面",
          marks: [
            { n: 1, label: "えらんだBGM" },
            { n: 2, label: "ボリューム" },
          ],
        },
      },
    ],
  },
  {
    slug: "export",
    video: vid("export"),
    no: 8,
    title: "動画を書き出す",
    summary: "できあがった動画を、提出できる MP4 ファイルにします。",
    sections: [
      {
        id: "preset",
        title: "書き出しの設定をえらぶ",
        steps: [
          { text: "Ctrl + S で保存してから、いちばん下のロケットのマーク（デリバー）を押す", hint: "Ctrl + S" },
          { text: "②プリセットを押し、③［絆_YouTube_720p］を選ぶ。形式や大きさはこれで全部そろいます" },
        ],
        note: {
          kind: "warn",
          title: "［絆_YouTube_720p］が一覧に無いとき",
          body: "［絆_素材を並べる］を実行すると自動で入ります。それでも無いときは、そのパソコンの準備（職員の方の作業）がまだです。急ぐときは、プリセットをえらばずに、フォーマット［MP4］・コーデック［H.264］・解像度［1280 × 720］・フレームレート［24］にして書き出せば同じ仕上がりになります。",
        },
        image: {
          src: img("b21_preset_pick"),
          alt: "プリセットの一覧を開き、絆_YouTube_720pに赤い四角",
          marks: [
            { n: 2, label: "プリセット" },
            { n: 3, label: "絆_YouTube_720p" },
          ],
        },
      },
      {
        id: "render",
        title: "名前と場所を決めて書き出す",
        steps: [
          { text: "①ファイル名に、提出する名前を入れる" },
          { text: "②［ブラウズ］を押して、保存する場所を選ぶ" },
          { text: "③［レンダーキューに追加］を押す" },
          { text: "④［すべてレンダー］を押す。右上の数字が 100% になれば完了です" },
        ],
        image: {
          src: img("b22_render_settings"),
          alt: "デリバー画面。ファイル名、ブラウズ、レンダーキューに追加、すべてレンダーに赤い印",
          marks: [
            { n: 1, label: "ファイル名" },
            { n: 2, label: "ブラウズ" },
            { n: 3, label: "レンダーキューに追加" },
            { n: 4, label: "すべてレンダー" },
          ],
        },
      },
      {
        id: "check",
        title: "書き出した動画を確かめる",
        steps: [
          { text: "書き出した動画を最初から最後まで再生する" },
          { text: "映像の順番・字幕の文と色・テロップを、作業指示一覧とくらべる。声がBGMに消されていないかも聞く" },
        ],
      },
    ],
  },
  {
    slug: "trouble",
    no: 9,
    title: "こまったとき",
    summary: "よくある困りごとと、なおし方です。",
    sections: [
      {
        id: "undo",
        title: "まちがえて、変な所に置いてしまった",
        steps: [{ text: "Ctrl + Z で1つ前にもどります。何回でももどせます", hint: "Ctrl + Z" }],
      },
      {
        id: "shifted",
        title: "音声が前に詰められて、ずれてしまった",
        steps: [{ text: "Delete で消すと、うしろが詰まります。Ctrl + Z でもどして、Backspace で消しなおします" }],
      },
      {
        id: "no-template",
        title: "タイトルに「絆」の型や、スクリプトが出てこない",
        steps: [{ text: "パソコンの準備がまだです。職員の方に声をかけてください" }],
      },
      {
        id: "crash",
        title: "DaVinci が急にとじてしまった",
        steps: [{ text: "もう一度開くと、最後に保存したところから続けられます。作業中はこまめに Ctrl + S を押します" }],
      },
    ],
  },
  {
    slug: "setup",
    no: 10,
    title: "パソコンの準備（職員の方へ）",
    summary: "1台のパソコンで、最初に1回だけ行います。利用者の方の作業はありません。",
    forStaff: true,
    sections: [
      {
        id: "install",
        title: "DaVinci Resolve を入れる",
        steps: [
          { text: "DaVinci Resolve 21（無料版）をインストールして、1回起動する" },
          { text: "画面が英語なら、［DaVinci Resolve］→［Preferences］→［User］→［UI Settings］→［Language］を日本語にして再起動する" },
        ],
        note: {
          kind: "warn",
          title: "バージョンを 21 にそろえる",
          body: "「素材を並べる」スクリプトは、DaVinci Resolve 20.2.2 より前の版では BGM が並ばない不具合があります。全部のパソコンを 21 にそろえてください。",
        },
      },
      {
        id: "bat",
        title: "字幕の型・スクリプト・書き出し設定を入れる",
        lead: "パソコン1台ごとに1回だけ。これをしていないパソコンでは、「絆」の字幕の型、［絆_素材を並べる］、書き出しの［絆_YouTube_720p］が出てきません。",
        download: { href: "/guide/setup/kizuna_davinci_setup.zip", label: "セットアップ用ファイルをダウンロード", size: "13KB" },
        steps: [
          { text: "下の［セットアップ用ファイルをダウンロード］を押し、ダウンロードした ZIP を右クリック →［すべて展開］する" },
          { text: "DaVinci をとじる" },
          { text: "展開したフォルダの「セットアップ（職員用）.bat」をダブルクリックする" },
          { text: "「セットアップが終わりました」と出たら、何かキーを押してとじる" },
          { text: "DaVinci を開き、［エフェクト］→［タイトル］で「絆」の型が4つ出ること、［ワークスペース］→［スクリプト］に［絆_素材を並べる］が出ることを確かめる" },
        ],
        note: {
          kind: "tip",
          title: "Mac のとき",
          body: "bat は Windows 専用です。Mac では「字幕とテロップ」の中身を ~/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Templates/Edit/Titles へ、「スクリプト」の中身を …/Fusion/Scripts/Utility へ手でコピーします。",
        },
      },
    ],
  },
];

export function getGuideChapter(slug: string): GuideChapter | undefined {
  return GUIDE_CHAPTERS.find((c) => c.slug === slug);
}

/** 手順書の guide 参照（"subtitles#place" など）を、教科書ページの URL にする */
export function guideHref(basePath: string, ref: string): string | null {
  const [slug, section] = ref.split("#");
  const chapter = getGuideChapter(slug);
  if (!chapter) return null;
  const hasSection = section && chapter.sections.some((s) => s.id === section);
  return `${basePath}/${chapter.slug}${hasSection ? `#${section}` : ""}`;
}

/** 手順書の guide 参照から、リンクに出す章と節の名前を返す */
export function guideLabel(ref: string): string | null {
  const [slug, section] = ref.split("#");
  const chapter = getGuideChapter(slug);
  if (!chapter) return null;
  const sec = chapter.sections.find((s) => s.id === section);
  return sec ? `${chapter.title}／${sec.title}` : chapter.title;
}
