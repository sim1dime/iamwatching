// Vue.jsを使いアプリケーションのメインロジックを記述したファイルです。
// 合わせてtarget-screenというコンポーネントも定義しています。
// author: sim1dime

const Watcher = {
    data() {
        return {
            screenImageWidth: 320,    // 一覧での画面サイズ
            aspectRatio: '16:9',      // 一覧での画面比率
            refreshInterval: 5,       // 画面更新間隔
            portNumber: 3400,         // 各監視対象と通信するポート番号
            targets: [],              // 監視対象画面一覧の各画面に必要な情報の配列
            intervalId: -1,           // 監視画面の更新をsetInterval()で行う際に生成されるID（停止に必要）
            isAutoRefresh: false,     // 自動監視での更新を行うかどうか
            showConfiguration: true   // 設定画面を表示するかどうか。trueで表示する。
        }
    },
    methods: {
      // ポート番号は1文字ずつ入力で反映されても困るため、明示的に反映させる。合わせてバリデーションする。
      applyPortNumber() {
          // 妥当でない値は強制的にデフォルトに戻す（本当はエラー表示なりが必要だと思う
          // 条件は、数値のみの文字列、数値としては1024以上65535以下。
          const portNumberString = this.$refs.portNumber.value;
          if (/^\d+$/.test(portNumberString) == false) {
              this.portNumber = 3400;
              return;
          }
          const portNumber = Number(portNumberString);
          if (portNumber < 1024 || interval > 65535) {
              this.portNumber = 3400;
              return;
          }
          this.portNumber = portNumberString;
          // this.portNumber自体はwatchで変更検知時の処理をしているので、そちらでバリデーションでもよい？
      },
      // refreshAllScreenImage は呼び出されるとすべての監視画面を一度更新します。
      refreshAllScreenImage() {
          const now = Math.round(Date.now() / 1000);
          // 監視対象の変数を配列の順序で直接変更したいのでforループが良いはず。
          for (let i = 0; i < this.targets.length; i++) {
              // 100ミリ秒ずつ待って実行する（このため監視数によっては監視間隔超えるかも）
              setTimeout(function(){}, 100);
              // countは以前単純に0からインクリメントしていたけど、URLにつけてキャッシュを取ってこさせない目的なので現在時刻秒にする
              this.targets[i].count = now;
          }
      },
      // 設定画面の表示・非表示切り替えを行います。
      toggleConfigurationVisibility() {
          this.showConfiguration = !this.showConfiguration;
      },
      // 監視対象指定リストテキストエリアの内容をパースしてtargetsの配列を差し替えます。
      applyTargetCsv() {
          const csv = window.document.querySelector('#target-csv').value;
          if (csv.length == 0) {
              return null;
          }
          // 行の分割と、画像URL生成に必要なデータの取得
          const rows = csv.split(/\r?\n/);
          const port = this.portNumber;
          const width = this.screenImageWidth;
          let newTargets = [];
          for (let i = 0; i < rows.length; i++) {
              // match()はグローバルフラグ（g）のない正規表現で一致全体とキャプチャグループをArrayで返す。
              // 戻り値は、rows[i]の1行分全体と、カンマおよびタブが初めて登場するまでと、それ以降の3要素配列。
              // カンマやタブで終わったりカンマやタブがなかったら、最後の要素は長さ0文字列になる。
              const matches = rows[i].match(/^([^,\t]+)[,\t]?(.*)$/);
              // 最終行などが空行で長さ0文字列の場合は戻り値がnullになるため、その行は処理せず次の行へ進む。
              if (matches == null) {
                  continue;
              }
              // IPアドレスまたはホストの指定がなければその行は処理せず次の行へ進む。
              const host = matches[1].trim();
              if (host.length == 0) {
                  continue;
              }
              // v-forのkeyに使うためこのループのカウンタをidにする。
              let target = {id: i, host: '', imageUrl: '', width: width, comment: '', count: 0};
              target.host = host;
              target.comment = matches[2].trim();
              target.imageUrl = this.getScreenImageUrl(target.host, port, width);
              newTargets.push(target);
          }
          this.targets = newTargets;
  
      },
      // 各監視画面の画像ダブルクリック時に実行され、その監視画面だけを指定した本アプリHTMLファイルを別ウィンドウで開きます。
      showSingleScreen(target) {
          // 引数の target はコンポーネントが親からもらったものと同じ名前で同じ値を詰めなおしたもの。
          
          // このページのhash（#）以降のフラグメントを削除したURLを取得し、新しいフラグメント識別子を追加する。
          const fragment = "#single-" + this.refreshInterval + "-" + this.portNumber + "-" + target.host ;
          const newUrl = window.location.toString().replace(window.location.hash, '').concat(fragment);
          window.open(newUrl, '_blank');
      },
    // 与えられたIPアドレスまたはホスト名、ポート番号、画像幅を使って監視サーバー経由で監視対象から画像を取得するURLを返します。
    getScreenImageUrl(remoteHost, remotePortNumber, width) {
        let hostAndPort = window.location.host;
        let encodedRemoteHost = encodeURI(remoteHost);
        return "http://" + hostAndPort + "/remotescreenjpeg?width=" + width + "&host=" + encodedRemoteHost + "&port=" + remotePortNumber;
    },
      // 監視画面ページのURLのフラグメントを分解してホスト名、ポート番号、インターバルを取得して返す。取れなければnullを返す。
      getParameterFromFragment(fragment) {
          // match()はグローバルフラグ（g）のない正規表現で一致全体とキャプチャグループをArrayで返す。
          const matches = fragment.match(/^#single-(\d+)-(\d+)-(.+)$/);
          console.log(matches);
          // うまくとれていれば、元文字列、更新間隔、ポート番号、ホストで長さ4配列。
          if (matches.length != 4) {
              return null;
          }
          const param = {
                 host: matches[3],
                 portNumber: matches[2],
                 interval: matches[1]
          };
          console.log(param);
          return param;
      },
      // 監視対象画面を1段階拡大または縮小する
      changeTargetScreenSizeOneStep(isEnlarge) {
          let s = document.querySelector('#image-width');
          let i = s.selectedIndex;
  
          if (isEnlarge && i < s.options.length - 1) {
              this.screenImageWidth = s.options[i + 1].value;
          }
          else if (!isEnlarge && i > 0) {
              this.screenImageWidth = s.options[i - 1].value;
          }
      },
      // 監視対象画面を1段階拡大する
      enlargeTargetScreenSizeOneStep() {
          this.changeTargetScreenSizeOneStep(true);
      },
      // 監視対象画面を1段階縮小する
      reduceTargetScreenSizeOneStep() {
          this.changeTargetScreenSizeOneStep(false);
      }
    },
    computed: {
        // 監視画面幅とアスペクト比設定から、縦幅を計算する。アスペクト比が未知のものの場合は1:1とする。
        calculatedImageHeight() {
          let ratiomap = new Map();
          ratiomap.set('16:9', 9.0/16.0);
          ratiomap.set('4:3', 3.0/4.0);
          ratiomap.set('5:4', 4.0/5.0);
          
          if (ratiomap.has(this.aspectRatio)) {
              return Math.round(this.screenImageWidth * ratiomap.get(this.aspectRatio));
          }
          else {
              return this.width * 1;
          }
  
        }
    },
    watch: {
        // 監視画面サイズ設定が変わった場合、各監視対象画面のプロパティを変える必要があるためwatchする
        screenImageWidth(newWidth, oldWidth) {
            // 次のmapのスコープではthisが上書きされるので先にselfとして取得しておく。
            const self = this;
            let newTargets = this.targets.map(function(t){
                // 変更が必要なのはURLと監視画面幅
                t.imageUrl = self.getScreenImageUrl(t.host, self.portNumber, newWidth);
                t.width = newWidth;
                return t;
            });
            // 最後に一括差し替え
            this.targets = newTargets;   
        },
        // ポート番号指定が変わった場合、各監視対象画面のプロパティを変える必要があるため監視する
        portNumber(newPortNumber, oldPortNumber) {
          // 次のmapのスコープではthisが上書きされるので先にselfとして取得しておく。
          const self = this;
          let newTargets = this.targets.map(function(t){
                // 変更が必要なのはURLのみ
                t.imageUrl = self.getScreenImageUrl(t.host, newPortNumber, t.width);
                return t;
            });
            // 最後に一括差し替え
            this.targets = newTargets;   
        },
        // 自動監視のON/OFF（isAutoRefreshのtrue/false）が変わった場合、setInterval()による自動監視の実行・停止を追従させる
        isAutoRefresh(newIsAutoRefresh, oldIsAutoRefresh) {
          if (newIsAutoRefresh) {
              // インターバルについてチェックしないとSetInterval()の動作がやばいのでチェックする。
              // 更新間隔の秒数であるため、数値のみかつ1～300の範囲のみとし、条件に合わない場合は5にリセットする。
              if (/^\d+$/.test(this.refreshInterval) == false) {
                  this.refreshInterval = 5;
              }
              let interval = Number(this.refreshInterval);
              if (interval < 1 || interval > 300) {
                  this.refreshInterval = 5;
                  interval = 5;
              }
              // 繰り返しそのものはsetInterval()で行わせるため、全監視画面更新メソッドを登録して終わり。
              this.intervalId = setInterval(this.refreshAllScreenImage, interval * 1000);
              // [監視開始]ボタンの有効・無効はisAutoReresh変数にバインドしているのでここでは操作しない
      
          }
          else if (this.intervalId > 0) {
              // newIsAutoRefresh == falseつまり停止指示で、
              // またthis.intervalId > 0つまりすでにsetInterval()で自動監視されている場合止める。
              clearInterval(this.intervalId);
              // 連続してクリックしてしまった場合などの対策として0にしておく。
              this.intervalId = 0;
              // [監視開始]ボタンの有効・無効はisAutoReresh変数にバインドしているのでここでは操作しない
          }
        },
        refreshInterval(newRefreshInterval, oldRefreshInterval) {
          // 自動更新中に間隔が変更された場合、自動更新を止める。
          if (this.isAutoRefresh) {
              this.isAutoRefresh = false;
          }
        }
    },
    mounted: function() {
        
      // ページ離脱時に監視対象リストの保存せずに終了してよいかどうかを確認するよう設定する。
      // ただしこのあとの1画面表示の場合は確認せず閉じるようにする。
      let preventUnload = function(e) {
          e.preventDefault();
          // Chromium系やFirefoxではメッセージが出ないがnullやundefined以外が必要なので一応追加する。
          e.returnValue = "監視対象リストの内容は失われます。クリップボードにコピーして保存してください。";
      }
      window.addEventListener("beforeunload", preventUnload);
  
      // マウント完了時に、URL（用途からするとローカルファイルパス）のhash指定があれば
      // その指定内容から自動的に１台分の監視設定を行う。あと最大画面表示想定なのでいったん設定画面はたたむ。
      // 想定される形式は以下
      // file://path/to/watcher.html#single-<Interval>-<Port Number>-<Host>
      // ホスト名やコメントは含まない想定なので、手動で追加が必要。
      let hashString = window.location.hash;
      if (hashString.length == 0) {
          return;
      }
      let param = this.getParameterFromFragment(hashString);
      if (param === null) {
          return;
      }
      // 想定にあったhash指定だったのでこれをもとに監視設定を行う。画面幅は最大の1280px。
      const width = 1280;
      this.screenImageWidth = width;
      this.portNumber = param.portNumber;
      this.refreshInterval = param.interval;
      const newTargets = [
          {
             id: 0,
             host: param.host,
             imageUrl: this.getScreenImageUrl(param.host, param.portNumber, width),
             width: width,
             comment: '',
             count: 0
          }
      ];
      this.targets = newTargets;
      // 監視対象コメントにも一言追加しておく。ただこれは何かバインディングしている値ではないので実際は「リスト反映」が必要。
      window.document.querySelector('#target-csv').value = param.host + ',自動設定1台監視';
      // 1台表示として開始する場合は設定画面非表示を初期設定とする。
      this.showConfiguration = false;
      // 終了時に確認しないようにする。
      window.removeEventListener("beforeunload", preventUnload);
    },
    destroyed: function() {
      // destroyされるときはもう使わないから空でOK（なはず……）
    }
  }
  const app = Vue.createApp(Watcher)
  
  // 監視画面マシン1台分のコンポーネント
  app.component('target-screen', {
      props: {
        host: String,
        imageUrl: String,
        width: Number,      // Validatorつけたい
        height: Number,
        comment: String,
        count: Number
      },
      template: `
        <div class='target-screen' :style='newScreenImageSize'>
          <div class='header'>
            <p class='hostname'>{{screenName}}</p>
            <p class='close-button'><!-- ikonate.comのSVGアイコン利用 -->
              <svg role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-labelledby="closeIconTitle">
                <title id="closeIconTitle">Close</title>
                <path d="M6.34314575 6.34314575L17.6568542 17.6568542M6.34314575 17.6568542L17.6568542 6.34314575"></path>
              </svg>
            </p>
          </div>
          <img class='screen-image' :src='screenImageUrlWithCount' @dblclick='screenDoubleClick'>
          <p class='no-image-message'>表示できる画像がありません。</p>
        </div>
      `,
      methods: {
          // 監視画面ダブルクリック時の親へのイベント発火用メソッド
          screenDoubleClick() {
              const target = {
                      id: -1, // これはpropsでもらっておらずわからないため-1にする。-1という値に意味はない。
                      host: String(this.host),
                      imageUrl: this.screenImageUrlWithCount,
                      width: this.width,
                      comment: String(this.comment),
                      count: 0 
              }
              this.$emit('screen-double-click', target);
          }
      },
      computed: {
          // 指定されたwidth,heightによる新しいスタイル設定を返す。
          newScreenImageSize() {
              // target-screenで定義しているCSS変数を上書きすることで内部の要素をまとめてサイズ変更する
              // このため、target-screenテンプレートのCSSでは必ず --screen-width 変数を定義しておくこと。
              console.log(this.width + "x" + this.height);
              return ("--screen-width: " + this.width + "px; --screen-height: " + this.height + "px;");
          },
          // 自動更新のためのカウントを追加したURLの作成
          screenImageUrlWithCount() {
              // URLでwidthパラメーターは指定済みと想定して &count=... を追加するだけ。
              return this.imageUrl + "&count=" + this.count;
  
          },
          // 各監視画面上部に表示するIPアドレス等について、内容をチェックしてあるものだけ返す。
          screenName() {
              let name = this.host;
              if (this.comment != null && this.comment.length > 0) {
                  name = name + " | " + this.comment;
              }
              return name;
          }
      }
  });
  
  
  
  
  // 最後にマウント
  app.mount('#app')