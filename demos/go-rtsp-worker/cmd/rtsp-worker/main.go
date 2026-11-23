package main

import (
 "context"
 "encoding/json"
 "flag"
 "fmt"
 "log"
 "net/http"
 "os"
 "os/signal"
 "path/filepath"
 "strconv"
 "strings"
 "syscall"
 "time"

 "github.com/selvagee/selvagee/demos/go-rtsp-worker/internal/worker"
)
func main(){
 streams:=flag.String("streams","","comma-separated RTSP URLs (use synthetic streams; do not expose credentials)")
 output:=flag.String("output","./segments","output directory")
 listen:=flag.String("listen","127.0.0.1:9090","metrics listen address")
 ffmpeg:=flag.String("ffmpeg","ffmpeg","FFmpeg binary")
 segment:=flag.Int("segment-seconds",30,"segment length")
 flag.Parse()
 if *streams=="" || *segment<1 { log.Fatal("provide -streams and positive -segment-seconds") }
 if err:=os.MkdirAll(*output,0750);err!=nil { log.Fatal(err) }
 ctx,stop:=signal.NotifyContext(context.Background(),syscall.SIGINT,syscall.SIGTERM);defer stop()
 m:=worker.New(nil)
 i:=0
 for _,raw:=range strings.Split(*streams,",") {
  url:=strings.TrimSpace(raw);if url=="" {continue}
  if !strings.HasPrefix(url,"rtsp://") {log.Fatal("only rtsp:// streams accepted")}
  i++;name:=fmt.Sprintf("camera-%d",i)
  path:=filepath.Join(*output,name+"-%Y%m%d-%H%M%S.mp4")
  args:=[]string{"-nostdin","-hide_banner","-loglevel","warning","-rtsp_transport","tcp","-i",url,"-map","0:v:0","-c:v","copy","-an","-f","segment","-segment_time",strconv.Itoa(*segment),"-reset_timestamps","1","-strftime","1",path}
  if err:=m.Start(ctx,worker.Config{Name:name,Binary:*ffmpeg,Args:args,MinBackoff:time.Second,MaxBackoff:30*time.Second});err!=nil {log.Fatal(err)}
 }
 if i==0 {log.Fatal("no streams configured")}
 mux:=http.NewServeMux()
 mux.HandleFunc("/healthz",func(w http.ResponseWriter,r *http.Request){ w.WriteHeader(http.StatusOK);fmt.Fprintln(w,"ok") })
 mux.HandleFunc("/workers",func(w http.ResponseWriter,r *http.Request){w.Header().Set("Content-Type","application/json");_ = json.NewEncoder(w).Encode(m.Snapshot())})
 mux.HandleFunc("/metrics",func(w http.ResponseWriter,r *http.Request){w.Header().Set("Content-Type","text/plain; version=0.0.4");s:=m.Snapshot();active:=0;restarts:=0;for _,x:=range s {if x.State==worker.Running {active++};restarts+=x.Restarts};fmt.Fprintf(w,"# TYPE rtsp_workers_active gauge\nrtsp_workers_active %d\n# TYPE rtsp_worker_restarts_total counter\nrtsp_worker_restarts_total %d\n",active,restarts)})
 server:=&http.Server{Addr:*listen,Handler:mux,ReadHeaderTimeout:5*time.Second}
 go func(){if err:=server.ListenAndServe();err!=nil && err!=http.ErrServerClosed {log.Printf("HTTP error: %v",err);stop()}}()
 log.Printf("started %d synthetic/demo workers; metrics at %s",i,*listen)
 <-ctx.Done()
 shutdownCtx,cancel:=context.WithTimeout(context.Background(),5*time.Second);defer cancel();_ = server.Shutdown(shutdownCtx)
 m.StopAll()
}
