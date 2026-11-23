package worker

import (
 "context"
 "errors"
 "sync/atomic"
 "testing"
 "time"
)

// A controlled fake process tests cancellation without requiring FFmpeg.
func TestGracefulShutdownCancelsRunner(t *testing.T) {
 entered := make(chan struct{})
 exited := make(chan struct{})
 m := New(func(ctx context.Context, _ string, _ []string) error {
  close(entered)
  <-ctx.Done()
  close(exited)
  return ctx.Err()
 })
 if err := m.Start(context.Background(), Config{Name:"synthetic", Binary:"fake"}); err != nil {t.Fatal(err)}
 select {case <-entered: case <-time.After(time.Second): t.Fatal("runner did not start")}
 m.StopAll()
 select {case <-exited: default: t.Fatal("runner not canceled")}
 if got:=m.Snapshot()[0].State; got!=Stopped {t.Fatalf("expected stopped, got %s",got)}
}
func TestFailuresAreCountedAndVisible(t *testing.T) {
 var attempts atomic.Int32
 m := New(func(ctx context.Context,_ string,_ []string) error {
  attempts.Add(1)
  return errors.New("synthetic connection failure")
 })
 if err:=m.Start(context.Background(),Config{Name:"bad-camera",Binary:"fake",MinBackoff:time.Millisecond,MaxBackoff:4*time.Millisecond});err!=nil {t.Fatal(err)}
 deadline:=time.After(time.Second)
 for {
  s:=m.Snapshot()[0]
  if s.Restarts>=2 {
   if s.LastError!="synthetic connection failure" {t.Fatalf("unexpected error: %q",s.LastError)}
   break
  }
  select {case <-deadline:t.Fatal("retry count did not advance");default:time.Sleep(time.Millisecond)}
 }
 m.StopAll()
 if attempts.Load()<2 {t.Fatal("runner did not retry")}
}
