package main

import (
	"flag"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"

	"github.com/kbinani/screenshot"
	"golang.org/x/image/draw"
)

// getScreenJPEG は0番ディスプレイのキャプチャ画像をJPEGでHTTPクライアントに返します
func getScreenJPEG(w http.ResponseWriter, r *http.Request) {
	// クエリパラメーターでwidthが許容範囲内で指定されていたら、縮小（拡大も？）する。
	// 未指定または許容範囲外の時はgetScreen()に0を渡すようにして原寸として処理する。
	width, err := strconv.Atoi(r.FormValue("width"))
	if err != nil {
		width = 0
	}
	// 許容範囲として設定している値は、監視側・監視対象側どちらもHD～FHD画面を使用している想定の値。
	// FHD画面を1280pxに縮小してもたいていの字は読めるので、もしそのまま見る場合は別の遠隔操作ツールを使うイメージ。
	if width < 160 || width > 1280 {
		width = 0
	}
	// パラメーターチェックが終わったので0番目のキャプチャ画像を取得
	img, err := getScreenZero(width)
	if err != nil {
		// 画像取得でエラーがあった場合は503を返す。
		// たとえばEC2 WindowsインスタンスにRDP接続していないときはscreenshot.CaptureRect()でBitBltが失敗してここにくる
		log.Printf("Error occured in screen capture: %s", err)
		w.WriteHeader(http.StatusServiceUnavailable)
		// panic(err)
		return
	}

	// 最後にJPEG圧縮してクライアントに返す。Encode()はioWriterに流すのでhttp.ResponseWriterそのまま渡せる。
	jpegoption := jpeg.Options{Quality: 50}
	jpeg.Encode(w, img, &jpegoption)
}

// getScreenPNG は0番ディスプレイのキャプチャ画像をPNGでHTTPクライアントに返します。
func getScreenPNG(w http.ResponseWriter, r *http.Request) {
	// 当初転送時の画質とファイルサイズ比較用に用意しただけなのでシンプルに取得して終わり
	img, err := getScreenZero(0)
	if err != nil {
		panic(err)
	}
	png.Encode(w, img)
}

// getScreen()はディスプレイ番号0番の画面全体をキャプチャして、画像を返します。
func getScreenZero(width int) (img *image.RGBA, err error) {
	img, err = getScreen(0, width)
	return
}

// getScreen()は指定されたディスプレイ番号の画面全体をキャプチャして、画像を返します。
func getScreen(i int, width int) (img *image.RGBA, err error) {
	number := screenshot.NumActiveDisplays()
	if number == 0 {
		// アクティブなディスプレイが0個＝ディスプレイが接続されていない
		err = fmt.Errorf("no display exisits.")
		return
	}
	if i > (number - 1) {
		// 最大ディスプレイ番号より大きい値を指定したのでエラー
		err = fmt.Errorf("The specified display number %d does not exists.", i)
		return
	}
	// ここでは縦横サイズが必要なためまずGetDisplayBoundsしてからキャプチャ。
	bounds := screenshot.GetDisplayBounds(i)
	img, err = screenshot.CaptureRect(bounds)
	if err != nil {
		return
	}

	// 必要に応じ拡大・縮小変換する。
	// 横幅優先で、指定された変換後の画像幅が0以下の場合はサイズ無変換で返す（0以下をエラーにするのは呼び出し側の責任）。
	// また横長画像を想定して、縦幅は横幅の縮小比率に合わせて計算する
	srcwidth := bounds.Max.X - bounds.Min.X
	srcheight := bounds.Max.Y - bounds.Min.Y // screenshotの仕様として左上が頂点なのでYはMax=0、Min=マイナス縦幅
	dstwidth := srcwidth
	dstheight := srcheight
	// widthがちゃんと指定してあればそのサイズの横幅（と比率を合わせて縦幅）計算
	if width > 0 {
		dstwidth = width
		dstheight = int(math.Round(float64(dstwidth) / float64(srcwidth) * float64(srcheight)))
	}
	// 縮小前後の縦横サイズが得られたので、縮小画像用のsmallImageを用意して縮小
	if srcwidth != dstwidth {
		smallImage := &image.RGBA{}
		smallImage = image.NewRGBA(image.Rect(0, 0, dstwidth, dstheight))
		// 拡大・縮小アルゴリズムとして golang.org/x/image/draw で用意されている4種類のうち、ApproxBiLinearを使う。
		// 最初は更新間隔が数秒単位なので画質優先でCatmullRomを使用したが、その場合開発環境ではメモリ消費が100MBを超えることが
		// 多かった。そこでApproxBiLnearに変更したところ30～40MB程度に減少したためこれを使う。一覧しての監視としては画質も問題ないと思う。
		draw.ApproxBiLinear.Scale(smallImage, smallImage.Bounds(), img, img.Bounds(), draw.Over, nil)
		img = smallImage
	}

	return img, err
}

// getHostname はコンピュータのホスト名を取得してテキストで返します。
func getHostname(w http.ResponseWriter, r *http.Request) {
	hostname, err := os.Hostname()
	if err != nil {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	// ここはJSONで返すべき？
	fmt.Fprintf(w, "%s", hostname)
}

func main() {
	// ポート番号を実行時引数で受け取る。デフォルトは3400。
	port := flag.Int("port", 3400, "監視側サーバーからの通信を待ち受けるポート番号です。")
	flag.Parse()
	// 負値や65535より大きい値を指定していないかチェック
	if *port < 0 || *port > 65535 {
		fmt.Println("ポート番号は0～65535の間で指定してください。本プログラムを終了します。")
		os.Exit(1)
	}
	portString := fmt.Sprintf(":%d", *port)

	// HTTPサーバとして処理するパスを指定して待ち受け開始。
	http.HandleFunc("/screenpng", getScreenPNG)
	http.HandleFunc("/screenjpeg", getScreenJPEG)
	http.HandleFunc("/hostname", getHostname)
	log.Fatal(http.ListenAndServe(portString, nil))
}
