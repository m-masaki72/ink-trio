# これからやること

日刊号と時間走は入った。残りは二つ。どちらも急がないが、着手する前に
ここに書いた「決まっていること」と「先に踏んだ罠」を読むこと。
同じところを二度調べ直さないために残してある。

---

## 1. 順位表のサーバー

時間走の順位表と、日刊の分布を出す。いまは記録が端末の中だけにある。

### 決まっていること

- **日刊には順位表を出さない。** 全員が同じ盤面を解く以上、誰か一人が先に開けば
  盤面は世界に知れる。事前に解を用意して最速で押せるので、順位を付ければ嘘になる。
  **分布（自分がどのあたりか）だけ**にする
- **時間走にだけ順位表を置く。** サーバーがその場でプールから配れば事前準備ができず、
  多重アカウントを作っても別の盤が来るだけになる。サーバーが計時すれば申告値の
  書き換えも効かない
- それでも**ボットは防げない**（求解器が同梱で、規則は README にも書いてある）。
  順位表には**名誉制であると明記する**。守れない約束をしない
- 送信は**初回に一度だけ同意を取るオプトイン**。既定は送らない。同意の画面では
  送る中身を具体的に並べる（押した手順・所要時間・表示名・匿名の識別子）

### 基盤

**Cloudflare Workers + D1。** 無料枠は 10万req/日、書込10万行/日、5GB。超過は
課金ではなくエラーになる。この規模なら月0円。

Firebase ではなくこれを選ぶ理由は料金ではない。**`rules.js` `puzzles.js` `daily.js` は
依存ゼロの純粋な ES モジュールなので、Worker がそのまま import できる。**
検証ロジックの移植が要らず、クライアントとサーバーで唯一の出典を共有できる。
Firestore の Security Rules では25マスを XOR して目標と照合する計算ができず、
結局 Cloud Functions を書くことになるので「楽」の利点が消える。

### 入口の案

```
POST /v1/rush/start    → { runId, nonce, puzzles, startedAt }
POST /v1/rush/submit   { runId, nonce, solved:[{slot,seq}], name, turnstile }
POST /v1/daily/submit  { issue, ms:[5], seq:[[…]×5], aid, client, name, turnstile }
GET  /v1/daily/:issue/histogram
GET  /v1/rush/board
POST /v1/erase         { client }
```

置き場（D1）:

```
daily_run ( issue, client, ms, aid, name, at )   PRIMARY KEY (issue, client)
rush_run  ( id, client, day, solved, ms, name, at )
rush_open ( id, client, started, puzzles, nonce )
INDEX rush_by_score ON rush_run(solved DESC, ms ASC)
```

守り: 手順の検証（盤面を再現して目標と一致するか・長さが最短手数か）／
`ms >= 総手数 × 250` の下限で素朴なボットを落とす／使い捨て nonce で
リプレイと直叩きを塞ぐ／Turnstile ＋ レート制限／CORS は
`m-masaki72.github.io` と `html-classic.itch.zone` `html.itch.zone`。

### 着手する前にやること

- **README の「外部への送信は一切ありません」を書き換える。** 黙って消さず、
  「順位表に送るのは、押した手順・所要時間・表示名だけ」と送る中身を具体的に書く。
  この作品の信用はそこで持っている
- **「記録を消す」（`#wipe`）は、先にサーバー側の削除を試みてから手元を消す。**
  匿名の識別子は localStorage にしか無いので、先に消すと**送信済みの記録を
  二度と消せなくなる**。通信できないときは「手元だけ消えます」と正直に出す
- CSP の `<meta>` に `connect-src` を一行足す。`default-src 'none'` は
  書き忘れたディレクティブを静かに殺す

### 未決

- 表示名の扱い。他人に見えるので、不適切な名前が来たときの手当てが要る
- 順位表を全期間の一枚にするか、日ごとに分けるか
- 古い号の分布をいつまで持つか

---

## 2. itch.io へ出す

配布物は道具になった。**手で組まない。**

```sh
npm run pack:itch      # dist/ink-trio-itch.zip
```

配るファイルは `sw.js` の取り込み一覧から導き、組んだあと itch の配り方（別オリジンの
iframe・深いサブパス）を模して検査してから zip にする。掲載の設定と文面（日本語・英語）は
[docs/itch.md](docs/itch.md) にある。

残っているのは **先生が itch.io の Web で公開する作業だけ**。

### 忘れてはいけないこと

**itch はゲームを別オリジンの iframe で配る。** サードパーティ Cookie を塞いでいる
利用者では `localStorage` が使えない（iPad Safari の「サイト越えトラッキングを防ぐ」は
**既定でオン**）。つまり itch 版では日刊も時間走も記録が残らない人がいる。

- **itch をランキングの本拠地にしない。** GitHub Pages が本拠地、itch は入口
- `storage.js` の `available` が偽のときは本家へ誘導する（遊び自体は壊れない）
