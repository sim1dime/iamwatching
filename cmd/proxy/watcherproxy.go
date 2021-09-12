package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
)

// getRemoteScreenJPEG はパラメーターで指定されたホストから画面キャプチャを取得した上でそれをHTTPクライアントに返します
func getRemoteScreenJPEG(w http.ResponseWriter, r *http.Request) {
	// クエリパラメーターを順にチェックする
	host := r.FormValue("host")
	if host == "" {
		// リモート監視対象PCのホスト指定がなかったら400（Bad Request）を返す
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	port, err := strconv.Atoi(r.FormValue("port"))
	if err != nil || port < 0 || port > 65535 {
		// リモート監視対象PCのポート番号指定がなかったり範囲内の数値でなかったらデフォルトの3400にする。
		port = 3400
	}
	// クエリパラメーターでwidthが許容範囲内で指定されていなかったら原寸を期待する0にする。
	width, err := strconv.Atoi(r.FormValue("width"))
	if err != nil {
		width = 0
	}
	// クエリパラメーターでcountが許容範囲内で指定されていたら0を指定するる。
	count, err := strconv.Atoi(r.FormValue("count"))
	if err != nil {
		count = 0
	}
	// パラメーターチェックが終わったのでURLを作ってリモート監視対象PCから画像を取得する
	remoteImageURL := fmt.Sprintf("http://%s:%d/screenjpeg?width=%d&count=%d", host, port, width, count)
	res, err := http.Get(remoteImageURL)
	if err != nil {
		log.Printf("Error: getRemoteScreenJPEG, URL: %s\n", remoteImageURL)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	body, err := io.ReadAll(res.Body)
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		// ステータスコードが200以外（は正常な画像を取得できていないはずだから）全部500を返す。
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	// 読み込んだbyte[]であるbodyをそのままResponseWriterで書いて終了
	w.Write(body)

}

// getRemoteHostname はパラメーターで指定された監視対象コンピューターのホスト名を取得してテキストで返します。
func getRemoteHostname(w http.ResponseWriter, r *http.Request) {

	// クエリパラメーターを順にチェックする
	hostname := r.FormValue("host")
	if hostname == "" {
		// リモート監視対象PCのホスト指定がなかったら400（Bad Request）を返す
		w.WriteHeader(http.StatusBadRequest)
	}
	port, err := strconv.Atoi(r.FormValue("port"))
	if err != nil || port < 0 || port > 65535 {
		// リモート監視対象PCのポート番号指定がなかったり範囲内の数値でなかったらデフォルトの3400にする。
		port = 3400
	}
	// パラメーターチェックが終わったのでURLを作ってリモート監視対象PCから画像を取得する
	remoteHostnameURL := fmt.Sprintf("http://%s:%d/hostname", hostname, port)
	res, err := http.Get(remoteHostnameURL)
	if err != nil {
		log.Printf("Error: getRemoteHostname, URL: %s\n", remoteHostnameURL)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	body, err := io.ReadAll(res.Body)
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		// ステータスコードが200以外（は正常なデータを取得できていないはずだから）全部500を返す。
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	// 読み込んだbyte[]であるbodyをそのままResponseWriterで書いて終了
	w.Write(body)
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
	// ポート番号を実行時引数で受け取る。デフォルトは80。
	port := flag.Int("port", 80, "監視側サーバーからの通信を待ち受けるポート番号です。")
	flag.Parse()
	// 負値や65535より大きい値を指定していないかチェック
	if *port < 0 || *port > 65535 {
		fmt.Println("ポート番号は0～65535の間で指定してください。本プログラムを終了します。")
		os.Exit(1)
	}
	portString := fmt.Sprintf(":%d", *port)

	// 取得対象ホスト名・IPアドレスリストの読み込み

	// HTTPサーバとして処理するパスを指定して待ち受け開始。
	// http.HandleFunc("/remotescreenpng", getRemoteScreenPNG)
	http.HandleFunc("/remotescreenjpeg", getRemoteScreenJPEG)
	http.HandleFunc("/remotehostname", getRemoteHostname)
	http.HandleFunc("/hostname", getHostname)
	// このあたりのファイルは将来 go:embed で埋め込んで同じバイナリにしたい
	http.Handle("/", http.FileServer(http.Dir("assets/")))
	log.Fatal(http.ListenAndServe(portString, nil))
}
