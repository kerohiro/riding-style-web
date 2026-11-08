# RIDE ATLAS

iPhoneのSafariでGPS・IMUを記録し、バイクの走行経路・加速度・推定リーン角を振り返る静的Webアプリ。

## 公開サイト

https://kerohiro.github.io/riding-style-web/

iPhoneでSafariから開きます。アプリのインストールやXcodeの署名は不要です。「共有 → ホーム画面に追加」でも利用できます（オフライン動作は非対応）。

## 機能

- 速度・合成加速度・推定リーン角の軌跡カラー
- 地図の傾斜表示、水平加速度の矢印、リーン角を表す模式的な3D柱
- タイムラインと地図クリックによるサンプル選択・再生
- 回転できるThree.jsの車体姿勢・3D加速度ベクトル
- GPSとDeviceMotionの取得、直立基準設定、最大10Hzのサンプル記録
- IndexedDBへの保存、約5秒ごとのチェックポイント、走行ライブラリ
- JSON入出力、ネイティブSwift版の既存JSON（2001年基準の日時）読込
- キー不要のOpenStreetMap（MapLibre）と、APIキーを使うGoogle Maps切替
- Apple Mapで選択位置を開くリンク

## 計測

1. 停車し、iPhoneを車体に縦向き・画面をライダー側・背面を前方に固定。
2. 「① センサーを許可」。位置情報も記録開始時に許可。
3. 車体を直立させ「② 直立基準を設定」。以後は固定方向を変更しない。
4. 「記録開始」。画面を表示したまま使用。
5. 停車して「終了して保存」。必要に応じJSONを書き出す。

画面非表示・別アプリ・ロック時は停止して保存を試みます。強制終了時の完全な保存は保証できません。ブラウザのデータ削除で走行データも消えるので、JSONでバックアップしてください。

## 地図

初期状態はOpenStreetMapです。3Dは傾斜した平面地図とデータの立体表現であり、実地形の標高メッシュではありません。

Google Mapsを使用するには、Google CloudでMaps JavaScript APIと課金を有効にしたAPIキーを用意し、右上の地図設定で入力してください。キーはこのブラウザのlocalStorageに保存し、GitHubへ送信しません。HTTPリファラー制限を `https://kerohiro.github.io/*` に、API制限をMaps JavaScript APIに設定してください。Google Mapsの料金・利用制限は利用者側の設定に依存します。傾斜は地図の地域・ズーム・対応状況に依存し、標準地図のリーン柱はGoogle側では表示しません。

Apple Mapの地図埋込は未実装です（MapKit JSの認証設定が別途必要）。選択位置をApple Mapで開けます。

## 精度と制限

- リーン角は `accelerationIncludingGravity - acceleration` の反対方向から重力方向を推定し、キャリブレーションした車体軸へ射影して求めます。ブラウザ・OSごとの符号やセンサー融合の差、旋回中の持続加速度、振動の影響があります。実走精度は未検証です。安全判断や計測器としての利用を想定しません。
- 加速度は車体座標（右・前・上が正）、m/s²。角速度の生値はブラウザ仕様のdeg/s（Swift版はrad/s）。ブラウザが線形加速度を返さない場合は欠測として表示します。
- GPS速度・方位が無効なら欠測扱いです。地図上の加速度矢印は車体水平成分をGPS進行方向で投影した参考値で、リーン・ピッチまで補正した対地ベクトルではありません。
- GPSは水平精度50m以内、3秒以内の最新値をIMUに紐付けます。10Hzの独立測位ではありません。
- 軌跡は最大約1200セグメント（Google側約800）に間引いて表示します。保存データは間引きません。記録・JSON読込は50万サンプルまで。長時間の実機負荷は未検証です。
- DEMOは合成データです。実際の道路に沿った実走ログではありません。
- データはブラウザ内にのみ保存。GitHubに走行データやキーをアップロードしません。地図・フォントの取得時は各提供元と通信します。ブラウザ間・端末間の同期や、バックグラウンド記録はありません。

## 開発

Node.js 22以降:

```sh
npm ci
npm test
npm run dev
npm run build
```

`dist/` を静的ホスティングできます。相対パスのためGitHub PagesのプロジェクトURLに対応しています。センサー実測はHTTPSまたはlocalhostが必要で、MacのLAN内HTTP URLをiPhoneで開くだけでは動作しません。

## GitHub Pages

Settings → Pages → Source: **GitHub Actions**。
`main` へのpushで `.github/workflows/pages.yml` がテスト・ビルドし、`dist/` のみを公開します。ソースコードにGoogleキーや実走行データを含めないでください。

## 検証

- 自動テスト：リーン角符号・車体座標変換、経路・JSONの往復、不正データ拒否、Swift日時互換、欠測値、地図上の方向投影。
- ブラウザ：デモ表示、色切替、保存・ライブラリから読込、デスクトップ・390px幅。
- iPhoneセンサー実測とGoogle Maps APIキーによる動作確認は未実施。

仕様参照：[W3C Device Orientation and Motion](https://www.w3.org/TR/orientation-event/)、[MDN requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/requestPermission_static)、[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)。
