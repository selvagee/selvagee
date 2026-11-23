package worker

import (
 "context"
 "errors"
 "fmt"
 "math/rand"
 "os"
 "os/exec"
 "sync"
 "time"
)

type State string
const (
 Stopped State = "stopped"
 Starting State = "starting"
 Running State = "running"
 Retrying State = "retrying"
 Cooldown State = "cooldown"
)
type Snapshot struct { Name string `json:"name"`; State State `json:"state"`; Restarts int `json:"restarts"`; LastError string `json:"last_error,omitempty"` }
type Runner func(context.Context, string, []string) error
type Config struct { Name, Binary string; Args []string; MinBackoff, MaxBackoff time.Duration }
type job struct { cancel context.CancelFunc; done chan struct{}; snapshot Snapshot }
type Manager struct { mu sync.Mutex; jobs map[string]*job; runner Runner }
func New(r Runner) *Manager { if r==nil { r=ExecRunner }; return &Manager{jobs:map[string]*job{},runner:r} }
func ExecRunner(ctx context.Context, binary string, args []string) error {
 cmd:=exec.CommandContext(ctx,binary,args...)
 cmd.Stdout=os.Stdout; cmd.Stderr=os.Stderr
 return cmd.Run()
}
func (m *Manager) Start(parent context.Context,c Config) error {
 if c.Name=="" || c.Binary=="" { return errors.New("name and binary required") }
 if c.MinBackoff<=0 { c.MinBackoff=time.Second }
 if c.MaxBackoff<c.MinBackoff { c.MaxBackoff=30*time.Second; if c.MaxBackoff<c.MinBackoff { c.MaxBackoff=c.MinBackoff } }
 m.mu.Lock(); defer m.mu.Unlock()
 if _,exists:=m.jobs[c.Name]; exists { return fmt.Errorf("worker %q already started",c.Name) }
 ctx,cancel:=context.WithCancel(parent)
 j:=&job{cancel:cancel,done:make(chan struct{}),snapshot:Snapshot{Name:c.Name,State:Starting}}
 m.jobs[c.Name]=j
 go m.run(ctx,c,j)
 return nil
}
func (m *Manager) set(j *job, state State, err error, restart bool) {
 m.mu.Lock(); defer m.mu.Unlock()
 j.snapshot.State=state
 if err!=nil && !errors.Is(err,context.Canceled) { j.snapshot.LastError=err.Error() }
 if restart { j.snapshot.Restarts++ }
}
func (m *Manager) run(ctx context.Context,c Config,j *job) {
 defer close(j.done)
 defer m.set(j,Stopped,nil,false)
 delay:=c.MinBackoff
 for {
  if ctx.Err()!=nil { return }
  m.set(j,Running,nil,false)
  err:=m.runner(ctx,c.Binary,c.Args)
  if ctx.Err()!=nil { return }
  if err==nil { err=errors.New("process exited unexpectedly") }
  m.set(j,Retrying,err,true)
  jitter:=time.Duration(rand.Int63n(int64(delay/4+1)))
  m.set(j,Cooldown,nil,false)
  timer:=time.NewTimer(delay+jitter)
  select { case <-ctx.Done(): if !timer.Stop(){ <-timer.C }; return; case <-timer.C: }
  if delay<c.MaxBackoff/2 { delay*=2 } else { delay=c.MaxBackoff }
 }
}
func (m *Manager) Snapshot() []Snapshot {
 m.mu.Lock(); defer m.mu.Unlock()
 result:=make([]Snapshot,0,len(m.jobs))
 for _,j:=range m.jobs { result=append(result,j.snapshot) }
 return result
}
func (m *Manager) StopAll() {
 m.mu.Lock(); jobs:=make([]*job,0,len(m.jobs)); for _,j:=range m.jobs {jobs=append(jobs,j);j.cancel()};m.mu.Unlock()
 for _,j:=range jobs { <-j.done }
}
