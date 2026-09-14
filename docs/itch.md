# itch.io 掲載の手引き

配布物は `npm run pack:itch` で作る（`dist/ink-trio-itch.zip`）。
配るファイルは `sw.js` の取り込み一覧から導くので、手で並べ直さない。
組んだあと itch の配り方（別オリジンの iframe・深いサブパス）を模して検査し、
盤が組まれて実際に解けること・Service Worker の範囲・コンソールのエラーを見る。

## アップロード

- Kind of project: **HTML**
- 「This file will be played in the browser」に必ずチェック
- zip の直下に `index.html` がある形（スクリプトがそう作る）

## Embed 設定

| 項目 | 値 | 理由 |
|---|---|---|
| Viewport | 960 × 720 | 盤2枚が横に並ぶ幅に余裕を持たせた値 |
| Fullscreen button | ON | 縦に長いので全画面が効く |
| Mobile friendly | ON（Orientation: Portrait） | 縦向き前提の設計。横向きは支えていない |
| Automatically start | OFF | 音の再生許可を取るため、一度クリックさせる |

## 価格

**No payments（Donations 有効）** から始める。「$0 or donate」にすると導線は増えるが、
初動で遊ばれた回数が落ちる。まず遊んでもらい、設計の話を Devlog に書いてから考える。

## Classification / Tags

- Classification: **Game** / Genre: **Puzzle**
- Tags: `puzzle` `logic` `color` `accessibility` `colorblind` `minimalist` `html5` `offline` `pwa`

## 先に踏んだ罠

**itch はゲームを別オリジンの iframe で配る。** サードパーティ Cookie を塞いでいる
利用者では `localStorage` が使えない（iPad Safari の「サイト越えトラッキングを防ぐ」は
**既定でオン**）。つまり itch 版では**日刊の記録も時間走の記録も残らない人がいる**。

- **itch をランキングの本拠地にしない。** GitHub Pages が本拠地、itch は入口
- `storage.js` の `available` が偽のときは本家へ誘導する（遊び自体は壊れない）

---

## タイトル

Ink Trio

## Short description（tagline）

三色のインクを重ねて、お手本と同じ配色をつくる 5×5 パズル。必ず最短手数で解けます。

> EN: Overprint three inks on a 5×5 press bed to match the proof. Every puzzle is solved in exactly the minimum number of moves.

## Full description（日本語）

マゼンタ・イエロー・ブルー。三色のインクを重ねて、左の「色校正」と同じ絵を刷り上げるパズルです。

**遊び方**

- マスを押すと、そこを中心とした 3×3 にインクが乗ります（盤の外へ出た分は切り落とし）
- 乗るインクは押すたびに **マゼンタ → イエロー → ブルー** の順に巡ります。色は選べません
- 重なりは打ち消し合います。同じ色を二度重ねると消え、三色そろうと白になります
- **押せるのは最短手数まで。** だから揃ったときは、必ず最短手数で揃っています

ライツアウトに混色を持ち込んだ遊びですが、中身は別物です。3×3 のスタンプは色ごとに独立した
連立方程式になり、しかも「n手目に乗る色」が固定されているため、最短手数は三色ぶんの単純な
足し算になりません。手で組んだ練習21面が、その勘所を一段ずつ案内します。

**毎日の遊び**

- **日刊** は毎日 5 問（3手・6手・6手・10手・10手）。出題は日付から決まるので、**同じ日は誰が開いても同じ 5 問**です
- 号は消えません。さかのぼって過去の号もいつでも遊べます
- **時間走** は 5 分で 10 手の課題を何問さばけるか。出題は毎回プールから引くので、同じ並びは二度と来ません
- 5 問そろえると結果を写せます。共有テキストは色ではなく、この作品自身の数字表記（0〜7）です

**色が見分けにくくても遊べます**

8色は、一般色覚・P型・D型・T型の4通りで色の差が最大になるよう数値最適化した組です。
インクが乗った7色は**明るさが等間隔の階段**になっているので、色相が分からなくても
明度の順で判別できます。白紙だけが階段から大きく下に外れており、「乗っているか否か」が
一目で分かります。

色に頼らずに配合を読む目印も3種類あります。**帯**（下辺の3本）／**記号**（M・Y・B）／
**数字**（マゼンタ1・イエロー2・ブルー4の合計、0〜7）。どれも位置と形だけで判別できます。

読み上げソフトでは、各マスが「3行2列 パープル」のように位置と配合を名乗ります。
時間を計るのは最初の一手からで、盤を読む時間は計りません。

**そのほか**

- インストール不要。ホーム画面に追加すれば**圏外でも遊べます**
- 外部への送信は一切ありません。進行度は端末の中だけに残ります
- 効果音はその場で合成しています。音源ファイルはありません
- キーボードだけでも遊べます（矢印・Enter・Z・Escape）

MIT License / ソース: https://github.com/m-masaki72/ink-trio

## Full description（English）

Magenta, yellow, blue. Overprint three inks on a 5×5 press bed until it matches the proof on the left.

**How to play**

- Pressing a cell inks the 3×3 around it (anything past the edge is trimmed)
- The ink cycles **magenta → yellow → blue** with every press. You don't get to choose
- Overprints cancel. The same ink twice erases; all three makes white
- **You only get the minimum number of moves.** So if you finish, you finished optimally

It looks like Lights Out with colour mixing, but it isn't. Each colour forms its own
independent system of equations, and because the ink of the n-th move is fixed, the
minimum move count is *not* the sum of the three per-colour minimums. Twenty-one
hand-built practice boards walk you through that, one idea at a time.

**Something for every day**

- **Daily** is five puzzles a day (3, 6, 6, 10, 10 moves). They are derived from the date, so **everyone gets the same five on the same day**
- Issues never expire. You can go back and play any past issue
- **Time run** gives you five minutes to clear as many 10-move boards as you can. Boards are drawn from a pool, so the same run never comes twice
- Finish all five and you can copy your result. The share text uses the game's own colour-free notation (0–7), not coloured squares

**Playable without relying on colour**

The eight colours were numerically optimised so the smallest perceptual difference is
maximised across normal, protan, deutan and tritan vision. The seven inked colours form
an **evenly spaced lightness staircase**, so you can read them by brightness alone.
Blank paper sits well below that staircase, so "inked or not" is instantly readable.

Three non-colour markers are available: **bars** (three strips along the bottom edge),
**letters** (M/Y/B), and **digits** (magenta 1 + yellow 2 + blue 4, giving 0–7).

Screen readers announce each cell as its position and its mix. The clock starts on your
first press — time spent reading the board is never counted.

**Also**

- No install. Add to home screen and it **works offline**
- Nothing is ever sent anywhere. Progress stays on your device
- Sound effects are synthesised on the fly. No audio files
- Fully keyboard playable (arrows, Enter, Z, Escape)

MIT licensed. Source: https://github.com/m-masaki72/ink-trio
