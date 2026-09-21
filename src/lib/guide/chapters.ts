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
      {
        id: "custom",
        title: "外部のお仕事①：［テキスト］の型を置いて文字を入れる",
        lead: "クラウドワークスなど外部のお仕事では、「絆」の型は使いません。依頼内容で指定された見た目に、自分で合わせます。",
        steps: [
          { text: "依頼内容から、字幕の指定（フォント・大きさ・色・縁取り・画面のどこに出すか）を書き出す。指定が無い所は、完成見本があれば見本に合わせる" },
          { text: "左下の［エフェクト］→［タイトル］を開き、①検索に「テキスト」と入れる" },
          { text: "②［テキスト］を、③字幕の段（V2）の、最初の音声の頭までドラッグする" },
          { text: "置いた字幕をクリックしてえらび、右上の［インスペクタ］の④文字の欄にセリフを入れる" },
        ],
        image: {
          src: img("ext_text_place"),
          alt: "エフェクトの検索にテキストと入れ、テキストの型をV2に置き、インスペクタの文字の欄にセリフを入れた画面",
          marks: [
            { n: 1, label: "検索に「テキスト」" },
            { n: 2, label: "［テキスト］の型" },
            { n: 3, label: "V2 に置いた字幕" },
            { n: 4, label: "文字の欄" },
          ],
        },
        note: {
          kind: "tip",
          title: "［テキスト+］ではなく［テキスト］",
          body: "検索すると［テキスト+］も出ますが、設定が多くて迷いやすいので、外部のお仕事では［テキスト］を使います。",
        },
      },
      {
        id: "custom-look",
        title: "外部のお仕事②：文字の見た目（フォント・サイズ・カラー）を合わせる",
        steps: [
          { text: "字幕をえらんだまま、インスペクタを少し下にスクロールする" },
          { text: "①［フォント］で指定のフォントをえらぶ（日本語の指定が無ければ Yu Gothic UI などの日本語フォント）" },
          { text: "②［サイズ］に指定の大きさを入れる（例：60）。数字の欄をクリックして、数字を打って Enter", hint: "数字 → Enter" },
          { text: "③［カラー］の四角を押して、指定の色にする" },
          { text: "④ビューアで見え方を確かめる" },
        ],
        image: {
          src: img("ext_text_look"),
          alt: "インスペクタのフォント・サイズ・カラーの行と、サイズを60にして小さくなった字幕がビューアに出た画面",
          marks: [
            { n: 1, label: "フォント" },
            { n: 2, label: "サイズ" },
            { n: 3, label: "カラー" },
            { n: 4, label: "見え方" },
          ],
        },
      },
      {
        id: "custom-position",
        title: "外部のお仕事③：置く場所と縁取りを合わせる",
        steps: [
          { text: "インスペクタをさらに下にスクロールして、①［位置］の Y に数字を入れる。小さいほど下に出ます（画面の下なら 90 くらい、上なら 620 くらい）" },
          { text: "縁取りの指定があれば、［ストローク］を開いて②［サイズ］に太さを入れる（例：4）。色は［カラー］で" },
          { text: "影の指定は［ドロップシャドウ］、文字の下の帯は［背景］で決める（指定が無ければさわらない）" },
          { text: "③ビューアで、指定どおりの場所に出ているか確かめる" },
        ],
        image: {
          src: img("ext_text_position"),
          alt: "インスペクタの位置とストロークの行、画面の下に縁取りつきで出た字幕",
          marks: [
            { n: 1, label: "位置（X・Y）" },
            { n: 2, label: "ストロークのサイズ" },
            { n: 3, label: "画面の下に出た字幕" },
          ],
        },
        note: {
          kind: "warn",
          title: "数字の欄では Ctrl + A を使わない",
          body: "数字の欄で Ctrl + A を押すと、タイムラインの全部のクリップがえらばれて、見た目の変更が全部に入ってしまいます。数字の欄はクリックしてそのまま数字を打ちます。",
        },
      },
      {
        id: "custom-copy",
        title: "外部のお仕事④：1つ目をコピーして増やす",
        lead: "見た目を合わせた1つ目をコピーすれば、2つ目からは文字を変えるだけで済みます。",
        steps: [
          { text: "①見た目を合わせた1つ目の字幕をクリックしてえらび、コピーする", hint: "Ctrl + C" },
          { text: "③赤い線（再生の位置）を、次の音声の頭に動かす（タイムラインの上の時間の目盛りをクリック）" },
          { text: "貼り付けると、②同じ見た目の字幕が再生の位置に置かれる", hint: "Ctrl + V" },
          { text: "貼り付けた字幕をえらび、④文字の欄の文を次のセリフに変え、右はしをその音声の終わりまでドラッグして長さを合わせる" },
        ],
        image: {
          src: img("ext_text_copy"),
          alt: "V2に1つ目と貼り付けた2つ目の字幕が並び、再生の位置が2つ目の上にあり、インスペクタの文字の欄が見える画面",
          marks: [
            { n: 1, label: "1つ目の字幕" },
            { n: 2, label: "貼り付けた2つ目" },
            { n: 3, label: "赤い線（再生の位置）" },
            { n: 4, label: "文字の欄" },
          ],
        },
        note: {
          kind: "warn",
          title: "見た目は最初の1つで決める",
          body: "2つ目からはコピーで増やすので、最初の1つの見た目を依頼内容とよく見くらべてから増やします。あとから全部を直すのは大変です。",
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
      {
        id: "custom",
        title: "外部のお仕事：指定に合わせてテロップを作る",
        lead: "クラウドワークスなど外部のお仕事では、「絆_強調テロップ」は使いません。依頼内容にテロップの指定がある場面だけ、自分で作ります。",
        steps: [
          { text: "依頼内容から、テロップを出す場面・文字・見た目（フォント・大きさ・色・画面のどこに出すか）を書き出す。指定が無い場面には入れない" },
          { text: "［エフェクト］→［タイトル］→［テキスト］を、①テロップの段（字幕より上の段、V3）の、出したい所までドラッグし、右はしを終わりに合わせる" },
          { text: "インスペクタの文字の欄に文字を入れ、［フォント］［サイズ］［カラー］で見た目を合わせる。②［位置］の Y を大きく（例：620）すると画面の上に出る" },
          { text: "赤い線（再生の位置）をテロップの上に動かして、③ビューアで字幕と重なっていないか確かめる" },
        ],
        image: {
          src: img("ext_telop"),
          alt: "V3の段に置いたテキストの型、インスペクタの位置Yを620にして、ビューアの上にテロップが出た画面",
          marks: [
            { n: 1, label: "V3 に置いたテロップ" },
            { n: 2, label: "位置の Y" },
            { n: 3, label: "画面の上に出たテロップ" },
          ],
        },
        note: {
          kind: "tip",
          title: "字幕と同じ見た目にしないとき",
          body: "テロップは字幕より大きく目立たせることが多いです。字幕の型をコピーして作ると同じ見た目になってしまうので、テロップは［テキスト］を新しく置いて作ります。",
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
  {
    slug: "worker",
    no: 11,
    title: "案件を作る・提出動画を検品するパソコンの準備（職員の方へ）",
    summary:
      "「YouTube動画生成」で案件を作ることと、利用者が提出した動画を完成見本と自動で照合することは、事業所のパソコン1台で動く「ワーカー」が行います。その1台を準備します。",
    forStaff: true,
    sections: [
      {
        id: "why",
        title: "なぜ必要か",
        lead: "アプリ（URL）は、テーマを「待機中」のジョブとして受け付けるところと、提出された動画を「順番待ち」として受け取るところまでしかしません。",
        steps: [
          { text: "動画の組み立て（音声を作る・場面の映像を描く・素材ZIPを作る・関門を通す・案件を登録する）は、パソコンの中で動く「YouTube動画生成ワーカー」が行います" },
          { text: "提出動画の検品（長さ・セリフの入れ忘れや重複・字幕の入れ忘れや文言違いを完成見本と照合し、明らかな間違いは利用者へ自動で差し戻す）は、同じパソコンで動く「提出動画の検品ワーカー」が行います" },
          { text: "ワーカーが動いているパソコンが1台も無いと、動画生成は「待機中」のまま、提出動画の照合は「順番待ち」のまま進みません" },
          { text: "ワーカーはインターネット経由でアプリとつながるので、どのパソコンでも構いません。ただし事業所で1台だけにします。セットアップは1回で、2つのワーカーが一緒に入ります" },
        ],
        note: {
          kind: "warn",
          title: "向いているパソコン",
          body: "常に電源が入っているデスクトップパソコン（Windows 10 / 11）。持ち運ぶノートパソコンは、閉じている間に案件が作られないので不向きです。2台で動かすと同じジョブを取り合うので、1台だけにしてください。",
        },
      },
      {
        id: "setup",
        title: "セットアップする（1台に1回だけ）",
        lead: "必要なソフト（Git・Node.js・ffmpeg）を自動で入れ、アプリのコードを取ってきて、パソコン起動時にワーカーが自動で立ち上がるようにします。",
        download: { href: "/guide/setup/kizuna_worker_setup.zip", label: "ワーカー セットアップ用ファイルをダウンロード", size: "6KB" },
        steps: [
          { text: "下の［ワーカー セットアップ用ファイルをダウンロード］を押し、ダウンロードした ZIP を右クリック →［すべて展開］する" },
          { text: "開発担当から受け取った「設定ファイル.txt」を、展開したフォルダ（bat と同じ場所）に入れる" },
          { text: "「セットアップ（職員用）.bat」をダブルクリックする" },
          { text: "「このアプリがデバイスに変更を加えることを許可しますか」と出たら［はい］。ソフトを入れるので数分かかります" },
          { text: "「セットアップが終わりました」と出たら完了。2つのワーカーが自動で起動し、タスクバーに「絆ワーカー」の窓が2つ出ます" },
        ],
        note: {
          kind: "tip",
          title: "設定ファイルが無いとき",
          body: "bat を実行すると、Supabase の URL・service role key・Gemini の API キーの3つを聞かれます。開発担当から受け取った値を貼り付けて Enter を押してください。",
        },
      },
      {
        id: "check",
        title: "動いているか確かめる",
        steps: [
          { text: "タスクバーに「絆ワーカー（YouTube動画生成）」「絆ワーカー（提出動画の検品）」という黒い窓が2つ最小化で出ています。どちらも閉じないでください（閉じるとそのワーカーが止まります）" },
          { text: "職員メニューの「YouTube動画生成」でテーマを登録すると、一覧の「待機中」が数分で進み、5〜6分で「完了」になって案件一覧に現れます" },
          { text: "利用者が動画を提出すると、「提出物レビュー」の「見本との自動照合（機械検品）」に数分で結果が出ます（5分の動画で5分前後）。明らかな間違いがあれば、利用者へは自動で差し戻されています" },
          { text: "パソコンを再起動しても、ワーカーは自動で立ち上がります（スタートアップに登録済み）" },
        ],
      },
      {
        id: "update",
        title: "更新する",
        steps: [
          { text: "開発担当から「更新してください」と連絡があったら、展開したフォルダの「更新（職員用）.bat」をダブルクリックする" },
          { text: "動いているワーカーを止め、コードを最新にして、もう一度起動します。設定はそのままです" },
        ],
      },
      {
        id: "trouble",
        title: "こまったとき",
        steps: [
          { text: "「待機中」や「順番待ち」のまま進まない → ワーカーが動いていません。デスクトップの「絆ワーカーを起動」をダブルクリックするか、パソコンを再起動する" },
          { text: "「失敗」になる → 「絆ワーカー」の窓に赤い文が出ています。その文を開発担当に伝える" },
          { text: "準備がそろっているかを調べたいとき → 「更新（職員用）.bat」を実行すると、最後に ○× の一覧が出ます" },
        ],
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
