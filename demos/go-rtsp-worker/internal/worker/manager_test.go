package worker

import (
 "context"
 "errors"
 "sync/atomic"
 "testing"
 "time"
)
func TestDuplicateStart(t *testing.T){
 m:=New(func(ctx context.Context,_ string,_ []string)error{<-ctx.Done();return ctx.Err()})
 ctx,cancel:=context.WithCancel(context.Background());defer cancel()
 cfg:=Config{Name:"cam1",Binary:"fake"}
 if err:=m.Start(ctx,cfg);err!=nil{t.Fatal(err)}
 if err:=m.Start(ctx,cfg);err==nil{t.Fatal("expected duplicate rejection")}
 m.StopAll()
 if s:=m.Snapshot()[0];s.State!=Stopped {t.Fatalf("state: %s",s.State)}
}
func TestRetryAfterFailure(t *testing.T){
 var calls atomic.Int32
 m:=New(func(ctx context.Context,_ string,_ []string)error{calls.Add(1);return errors.New("stream failed")})
 ctx,cancel:=context.WithCancel(context.Background());defer cancel()
 if err:=m.Start(ctx,Config{Name:"cam1",Binary:"fake",MinBackoff:time.Millisecond,MaxBackoff:2*time.Millisecond});err!=nil{t.Fatal(err)}
 deadline:=time.After(time.Second)
 for calls.Load()<2 {select {case <-deadline:t.Fatal("did not retry");default:time.Sleep(time.Millisecond)}}
 m.StopAll()
 if m.Snapshot()[0].Restarts<1 {t.Fatal("restart counter not updated")}
}
func TestValidation(t *testing.T){m:=New(nil);if m.Start(context.Background(),Config{})==nil {t.Fatal("expected validation error")}}
