# Overmind Sequencer Script Development Guide

This is the definitive reference for building sequencer automation scripts in Overmind. This guide provides everything needed to create functional Go plugins that orchestrate AGV/AMR fleet operations.

---

## Table of Contents

1. [Overmind Architecture Overview](#1-overmind-architecture-overview)
2. [Core Concepts](#2-core-concepts)
3. [The Fabric SDK](#3-the-fabric-sdk)
4. [Entity ID Namespace System](#4-entity-id-namespace-system)
5. [The Plugin Framework](#5-the-plugin-framework)
6. [Building Sequencer Scripts](#6-building-sequencer-scripts)
7. [State Tracking Patterns](#7-state-tracking-patterns)
8. [Common AGV Operations](#8-common-agv-operations)
9. [Error Handling and Flow Control](#9-error-handling-and-flow-control)
10. [Complete Script Examples](#10-complete-script-examples)
11. [Import Reference](#11-import-reference)
12. [Critical Rules and Best Practices](#12-critical-rules-and-best-practices)

---

## 1. Overmind Architecture Overview

### What is Overmind?

Overmind is a distributed fleet management system for orchestrating factory automation, specifically AGV/AMR (Automated Guided Vehicle / Autonomous Mobile Robot) fleets. It consists of:

- **Core Overmind**: The central engine managing track topology, AGV provisioning, routing, and coordination
- **Device Proxies**: Adapter processes that interface with physical/simulated devices
- **Scripts**: Customer/automation logic hosted by Overmind that sequence operations
- **Fabric**: A strongly-typed message bus (protobuf + NATS) for communication between components

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Overmind Core                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ AGV Manager │  │Track Manager│  │   Script Manager    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │            │
│         └────────────────┼─────────────────────┘            │
│                          │                                  │
│                    ┌─────┴─────┐                            │
│                    │  Fabric   │  (NATS + Protobuf)         │
│                    └─────┬─────┘                            │
└──────────────────────────┼──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
  ┌─────┴─────┐      ┌─────┴─────┐      ┌─────┴─────┐
  │Script Host│      │Device Proxy│     │Device Proxy│
  │(Your Code)│      │   AGV 001  │     │   AGV 002  │
  └───────────┘      └────────────┘     └────────────┘
```

### Communication Model

All components communicate over **Fabric**, which provides:
- **State Publishing/Subscribing**: Publish state updates, subscribe to state changes
- **Command Request/Response**: Request actions from other components, respond to requests
- **Entity-based addressing**: Each component has a unique Entity ID

---

## 2. Core Concepts

### Script Types

#### Automation Scripts (Type: `NORMAL`)
- **Purpose**: Control existing infrastructure (AGVs, tracks) in continuous loops
- **Lifecycle**: Run indefinitely or for a specified number of iterations
- **Operations**: Move AGVs, load/unload, wait for signals, coordinate multi-AGV workflows
- **Naming**: Snake_case descriptive names (e.g., `battery_swap_loop`, `assembly_line_feeder`)

#### Provisioning Scripts (Type: `PROVISIONING`)
- **Purpose**: Create new infrastructure (tracks, AGV entities)
- **Lifecycle**: One-time execution (Iterations: 1)
- **Operations**: Create track configurations, provision AGV entities
- **Naming**: Must start with `prov_` (e.g., `prov_track_santa_clara`)

### The ScriptPlugin Interface

Every script must implement this interface:

```go
type ScriptPlugin interface {
    // Handle control requests from Overmind (RUN, PAUSE, STOP, EXIT)
    Control(ctx context.Context, req *instance.ControlRequest) (*instance.ControlResponse, error)
    
    // Return current script state for Overmind to display/track
    ScriptState(ctx context.Context) (instance.State, error)
}
```

**Important**: You almost never implement this directly. Use `PullScriptPlugin` or `Sequencer` helpers.

### Script Modes

Scripts transition between these modes:
- `MODE_STOPPED`: Script is not executing (default startup state)
- `MODE_RUNNING`: Script is actively executing its cycle
- `MODE_PAUSED`: Script execution is temporarily suspended
- `MODE_EXITED`: Script has terminated

### AGV Leasing

**Critical Concept**: Before controlling an AGV, your script MUST acquire a **lease**. Only one entity can hold a lease on an AGV at a time.

```go
// Check if we have the lease
if ctrlState.GetLease().GetTo() == svc.MyScriptId() {
    // We have the lease, can operate
} else {
    // Need to acquire lease first
}
```

---

## 3. The Fabric SDK

### Overview

The Fabric SDK (`lib/fabric/access/go`) provides type-safe access to the Overmind communication fabric. It is auto-generated from protobuf definitions and YAML model specifications.

### SDK Structure

```
lib/fabric/access/go/
├── access.go                    # Main client interface
├── generated/
│   ├── conveyance/
│   │   ├── mobile/
│   │   │   ├── agv/             # AGV state SDK
│   │   │   │   └── agv.go       # ActiveState publish/subscribe
│   │   │   └── agv_manager/     # AGV manager SDK
│   │   │       └── agv_manager.go # Control state, lease, operate commands
│   │   └── track/               # Track manager SDK
│   └── proto/                   # Generated protobuf types
│       ├── conveyance/
│       │   ├── mobile/
│       │   │   ├── agv/         # ActiveState protobuf
│       │   │   └── agv_manager/ # AgvControlState, commands protobuf
│       │   └── track/           # Track protobuf
│       ├── escript/
│       │   └── instance/        # Script instance state protobuf
│       └── meta/
│           ├── commands/        # Command request/response types
│           ├── config/          # Configuration types (Tags, EntityKind)
│           └── domain/          # Domain types (Alarms)
```

### Key SDK Patterns

#### State Publishing
```go
// Publish state to fabric
publishResult, err := agv.ActiveStatePublish(ctx, fabricClient, state, 
    access.PublishWithSource(myEntityId),
    access.PublishWithTarget(targetEntityId))
```

#### State Subscribing
```go
// Subscribe to state updates
sub, err := agv_manager.AgvControlStateSubscribe(ctx, fabricClient,
    access.SubscribeWithTarget(agvEntityId),
    access.SubscribeWithImplicitAck())

// Receive updates
for ctx.Err() == nil {
    prop, err := sub.AwaitNext(ctx)
    if err != nil {
        continue
    }
    state := prop.Property // The actual state
}
```

#### Command Requests
```go
// Request a command
reqResult, err := agv_manager.OperateLeasedAgvRequest(ctx, fabricClient,
    &agv_managerpb.OperateAgvRequest{
        CommandRequest: access.NewCommandRequest(),
        Requestor:      myScriptId,
        Command: &agv_managerpb.AgvCommand{
            WaypointId: "wp1",
        },
    },
    access.RequestWithTarget(agvEntityId))

// Wait for response
response, err := reqResult.Await(ctx)
```

### TrackedState Helpers

The SDK provides `Tracked*State` helpers that manage subscriptions and cache the latest state:

```go
// Create a tracked state (manages subscription internally)
tracker, err := agv_managerspec.NewTrackAgvControlState(
    ctx, wg, fabricClient, agvEntityId, backoff)

// Get current cached state
state, timestamp := tracker.State()

// Wait for next update
state, timestamp = tracker.WaitForUpdate(ctx)

// Get notification channel for select statements
<-tracker.NotificationChan()
```

---

## 4. Entity ID Namespace System

### Overview

The `eidns` (Entity ID Namespace) package manages unique identifiers for all Overmind entities on the fabric.

### Entity ID Format

Entity IDs follow the format: `{prefix}_{type}_{name}`

Examples:
- `om_agv_001` - AGV with ID "001"
- `om_agvm` - The AGV Manager
- `om_trkm` - The Track Manager
- `om_script_my_loop` - A script named "my_loop"
- `om_trk_main_node_wp1` - Node "wp1" on track "main"

### Creating Entity IDs

```go
// From HostServices
eidNs := svc.EidNs()

// AGV entity ID
agvEid := eidns.NewAgvEid(eidNs, "001")  // -> om_agv_001

// AGV Manager entity ID (singleton)
agvMgrEid := eidns.NewAgvManagerEid(eidNs)  // -> om_agvm

// Track Manager entity ID (singleton)
trackMgrEid := eidns.NewTrackManagerEid(eidNs)  // -> om_trkm

// Script entity ID
scriptEid := eidns.NewScriptEid(eidNs, "my_loop")  // -> om_script_my_loop

// Track node entity ID
nodeEid := eidns.NewTrackNodeEid(eidNs, "main", "wp1")  // -> om_trk_main_node_wp1
```

### Parsing Entity IDs

```go
// Parse AGV ID from entity ID
agvId, ok := eidns.ParseAgvEid(eidNs, entityId)
if ok {
    // agvId is "001"
}

// Parse script ID from entity ID
scriptId, ok := eidns.ParseScriptEid(eidNs, entityId)
```

### EntityKindAndName for Reporting

For step reports and UI display:

```go
entityRef := eidNs.NewEntityKindAndName(
    config.EntityKind_ENTITY_KIND_AGV, 
    "001")
// Used in StepReport.EntityIds for UI display
```

### Available Entity Suffixes

| Suffix | Entity Type | Constructor |
|--------|-------------|-------------|
| `agvm` | AGV Manager | `NewAgvManagerEid` |
| `trkm` | Track Manager | `NewTrackManagerEid` |
| `scriptm` | Script Manager | `NewScriptManagerEid` |
| `agv` | AGV | `NewAgvEid` |
| `trk` | Track | `NewTrackEid` |
| `node` | Track Node | `NewTrackNodeEid` |
| `edge` | Track Edge | `NewTrackEdgeEid` |
| `script` | Script Instance | `NewScriptEid` |

---

## 5. The Plugin Framework

### Framework Components

```
lib/fm/script/go_plugin/
├── plugin.go         # ScriptPlugin interface, registration
├── host.go           # HostServices interface, GetPlugin
├── pull_plugin.go    # PullScriptPlugin partial implementation
├── sequencer.go      # Sequencer full implementation
└── registry.go       # Plugin registration internals
```

### HostServices Interface

The host provides these services to your script:

```go
type HostServices interface {
    // From skeleton.Services
    FabricClient() *access.Client      // Access to fabric
    Logger() *zap.Logger               // Structured logging
    Registry() *prometheus.Registry    // Metrics registration
    Mux() *http.ServeMux               // HTTP handler registration
    HealthCheckHandler() healthcheck.Handler
    
    // Script-specific
    RequestingToPublishState()         // Trigger state publication
    NotifyFatalFailure(lastWill instance.State)  // Signal fatal error
    MyScriptId() string                // Get my script identifier
    MyEid() core.EntityId              // Get my entity ID
    EidNs() *eidns.EidNsManager        // Entity ID namespace manager
    GqlClient() (*graphql.Client, error)  // GraphQL client to Overmind
}
```

### Plugin Registration

Scripts register at init time:

```go
func init() {
    plugin.RegisterPlugin("default", myCfg.Configure)
}
```

The `Configure` function signature:

```go
type Configure func(ctx context.Context, wg *sync.WaitGroup, svc HostServices) (ScriptPlugin, error)
```

### PullScriptPlugin Helper

A partial implementation handling control flow:

```go
// Create with initial state
psp := plugin.NewPullScriptPlugin(initState, initRequest, svc, cycleBuckets, stepBuckets)

// Update state safely
psp.UpdateState(func(state *instance.State, verbose *instance.VerboseState) (plugin.UpdateType, error) {
    state.Tags = &config.TagSet{Tags: []*config.Tag{{Key: "status", Value: "ready"}}}
    return plugin.UpdateTypeIncludesCore, nil
})

// Check for control changes (blocks if PAUSED/STOPPED)
mode, err := psp.PeekInSched(ctx)
if err != nil {
    // We were stopped, restart cycle
}

// Get context that cancels on STOP/PAUSE
opCtx, cancel := psp.WatchForInterrupt(ctx)
defer cancel(nil)
```

### Update Types

```go
const (
    UpdateTypeNone         // No update, no publish
    UpdateTypeIncludesCore // Core state changed, always publish
    UpdateTypeOnlyDetailed // Only detailed state, publish if detailed requested
)
```

---

## 6. Building Sequencer Scripts

### The Sequencer Pattern

For 99% of automation scripts, use the `Sequencer` helper. It provides:
- Automatic state machine management
- Step/stage execution with retry
- Proper PAUSE/STOP handling
- Metrics and reporting
- Rate limiting

### Sequencer Configuration

```go
type SequencerConfig[T any] struct {
    Steps      []*SequencerStep[T]  // Ordered list of steps
    Iterations int                   // How many cycles (-1 = forever)
    RecentSteps int                  // Steps to keep in history (default 5)
    Backoff    *retry.ExponentialBackoffConfig  // Default retry config
}
```

### Sequencer Step

```go
type SequencerStep[T any] struct {
    Name        string                          // Step name (used in metrics)
    Description string                          // Human-readable description
    Stages      []*SequencerStepStage[T]        // Stages within this step
    Cancel      func(ctx context.Context, t T, err error)  // Cleanup on error
}
```

### Sequencer Step Stage

```go
type SequencerStepStage[T any] struct {
    Name    string                                    // Stage name
    Op      func(ctx context.Context, t T) error      // The operation
    Backoff *retry.ExponentialBackoffConfig           // Stage-specific retry
}
```

### Complete Script Structure

```go
package dynamic

import (
    "context"
    "sync"
    
    "github.com/Kerrigan-Automation/overmind/public/lib/eidns"
    access "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go"
    agv_managerspec "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/conveyance/mobile/agv_manager"
    "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/escript/instance"
    "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/meta/config"
    plugin "github.com/Kerrigan-Automation/overmind/public/lib/script/go_plugin"
    "go.uber.org/zap"
    "google.golang.org/protobuf/types/known/timestamppb"
)

// Config holds script configuration
type Config struct {
    Description    string
    AgvId          string
    SequenceConfig plugin.SequencerConfig[*script]
}

// script holds runtime state accessible to all stages
type script struct {
    cfg       *Config
    svc       plugin.HostServices
    psp       *plugin.PullScriptPlugin
    seq       *plugin.Sequencer[*script]
    eidNs     *eidns.EidNsManager
    tracker   *agv_managerspec.TrackedAgvControlState
    logger    *zap.Logger
}

// Configure is called by the host to create the script plugin
func (cfg *Config) Configure(ctx context.Context, wg *sync.WaitGroup, svc plugin.HostServices) (plugin.ScriptPlugin, error) {
    defer wg.Done()
    
    // 1. Create initial state (start STOPPED)
    initState := &instance.State{
        ActiveMode:     instance.Mode_MODE_STOPPED,
        RequestedMode:  instance.Mode_MODE_STOPPED,
        RequestedOn:    timestamppb.Now(),
        TransitionedOn: timestamppb.Now(),
    }
    initReq := &instance.ControlRequest{RequestedMode: instance.Mode_MODE_STOPPED}
    
    // 2. Create PullScriptPlugin
    psp := plugin.NewPullScriptPlugin(initState, initReq, svc, nil, nil)
    
    // 3. Set description tag
    psp.UpdateState(func(state *instance.State, verbose *instance.VerboseState) (plugin.UpdateType, error) {
        state.Tags = &config.TagSet{Tags: []*config.Tag{
            {Key: "description", Value: cfg.Description},
        }}
        return plugin.UpdateTypeIncludesCore, nil
    })
    
    // 4. Create script context
    s := &script{
        cfg:    cfg,
        svc:    svc,
        psp:    psp,
        eidNs:  svc.EidNs(),
        logger: svc.Logger(),
    }
    
    // 5. Create sequencer
    seq, err := plugin.NewSequencer(cfg.SequenceConfig, psp, svc)
    if err != nil {
        return nil, err
    }
    s.seq = seq
    
    // 6. Set up state trackers
    wg.Add(1)
    s.tracker, err = agv_managerspec.NewTrackAgvControlState(
        ctx, wg, svc.FabricClient(), 
        eidns.NewAgvEid(s.eidNs, cfg.AgvId), 
        nil)  // Use default backoff
    if err != nil {
        return nil, err
    }
    
    // 7. Start sequencer runner
    wg.Add(1)
    go seq.Runner(ctx, wg, s)
    
    return psp, nil
}

// Register the plugin at init time
func init() {
    defaultCfg := &Config{
        Description: "My automation script",
        AgvId:       "001",
        SequenceConfig: plugin.SequencerConfig[*script]{
            Steps: []*plugin.SequencerStep[*script]{
                {
                    Name:        "step_1",
                    Description: "First step",
                    Stages: []*plugin.SequencerStepStage[*script]{
                        {
                            Name: "do_something",
                            Op: func(ctx context.Context, s *script) error {
                                // Your logic here
                                return nil
                            },
                        },
                    },
                },
            },
            Iterations: plugin.IterateForever,
        },
    }
    plugin.RegisterPlugin("default", defaultCfg.Configure)
}
```

---

## 7. State Tracking Patterns

### Single AGV Tracking

For scripts controlling a single AGV:

```go
// In Configure()
wg.Add(1)
s.agvControlTracker, err = agv_managerspec.NewTrackAgvControlState(
    ctx, wg, svc.FabricClient(), 
    eidns.NewAgvEid(eidNs, agvId),
    nil)  // default backoff

wg.Add(1)
s.agvStateTracker, err = agvspec.NewTrackActiveState(
    ctx, wg, svc.FabricClient(),
    eidns.NewAgvEid(eidNs, agvId),
    nil)

// In stage operation
func doWork(ctx context.Context, s *script) error {
    // Get current state
    ctrlState, _ := s.agvControlTracker.State()
    
    // Wait for specific condition
    for ctx.Err() == nil {
        if ctrlState != nil && ctrlState.GetActiveCommand() == nil {
            break  // AGV is idle
        }
        ctrlState, _ = s.agvControlTracker.WaitForUpdate(ctx)
    }
    return ctx.Err()
}
```

### Multi-AGV Tracking (All AGVs)

For scripts monitoring the entire fleet:

```go
// Custom wrapper for all AGVs
type TrackedAllAgvStatesWrapper struct {
    notification chan struct{}
    stateMu      sync.RWMutex
    states       map[agv.AgvId]*agvpb.ActiveState
    eidNs        *eidns.EidNsManager
    logger       *zap.Logger
}

func NewTrackAllAgvStatesWrapper(ctx context.Context, wg *sync.WaitGroup, 
    fabric *access.Client, eidNs *eidns.EidNsManager, 
    bo *backoff.ExponentialBackOff, logger *zap.Logger) (*TrackedAllAgvStatesWrapper, error) {
    
    defer wg.Done()
    
    opts := []access.SubscribeOpt{
        access.SubscribeWithImplicitAck(),
        access.SubscribeWithTarget(core.EntityIdAny),  // Key: subscribe to ALL
    }
    
    t := &TrackedAllAgvStatesWrapper{
        notification: make(chan struct{}, 1),
        states:       make(map[agv.AgvId]*agvpb.ActiveState),
        eidNs:        eidNs,
        logger:       logger,
    }
    
    wg.Add(1)
    go func() {
        defer wg.Done()
        
        sub, err := agvspec.ActiveStateSubscribe(ctx, fabric, opts...)
        if err != nil {
            return
        }
        defer sub.CancelSubscription(context.Background())
        
        for ctx.Err() == nil {
            prop, err := sub.AwaitNext(ctx)
            if err != nil {
                continue
            }
            
            entityId, _ := prop.Target()
            agvIdStr, ok := eidns.ParseAgvEid(t.eidNs, entityId)
            if !ok {
                continue
            }
            
            t.stateMu.Lock()
            t.states[agv.AgvId(agvIdStr)] = prop.Property
            t.stateMu.Unlock()
            
            select {
            case t.notification <- struct{}{}:
            default:
            }
        }
    }()
    
    return t, nil
}

func (t *TrackedAllAgvStatesWrapper) State(id agv.AgvId) *agvpb.ActiveState {
    t.stateMu.RLock()
    defer t.stateMu.RUnlock()
    return t.states[id]
}

func (t *TrackedAllAgvStatesWrapper) AllStates() map[agv.AgvId]*agvpb.ActiveState {
    t.stateMu.RLock()
    defer t.stateMu.RUnlock()
    result := make(map[agv.AgvId]*agvpb.ActiveState)
    for k, v := range t.states {
        result[k] = v
    }
    return result
}

func (t *TrackedAllAgvStatesWrapper) NotificationChan() <-chan struct{} {
    return t.notification
}
```

### Waiting for Events from Multiple Sources

```go
func (s *script) waitForEvents(ctx context.Context) error {
    select {
    case <-s.agvStates.NotificationChan():
        return nil
    case <-s.agvControlStates.NotificationChan():
        return nil
    case <-s.trackConfig.NotificationChan():
        return nil
    case <-ctx.Done():
        return ctx.Err()
    }
}
```

---

## 8. Common AGV Operations

### Acquiring a Lease

```go
func getAgvLeaseStage(agvId string) *plugin.SequencerStepStage[*script] {
    return &plugin.SequencerStepStage[*script]{
        Name: "lease_agv",
        Op: func(ctx context.Context, s *script) error {
            client := s.svc.FabricClient()
            targetId := eidns.NewAgvManagerEid(s.eidNs)
            
            req := &agv_managerpb.LeaseAgvRequest{
                CommandRequest: access.NewCommandRequest(),
                LeasedTo:       s.svc.MyScriptId(),
                MandatedAgvIds: []string{agvId},
            }
            
            result, err := agv_manager.GetLeaseOnAgvRequest(ctx, client, req,
                access.RequestWithTarget(targetId))
            if err != nil {
                return err  // Will retry
            }
            
            resp, err := result.Await(ctx)
            if err != nil {
                return err
            }
            
            if resp.Response.CommandResponse.GetOutcome() != commands.CommandResponseOutcome_COMMAND_RESPONSE_OUTCOME_ACCEPTED {
                return plugin.NewErrRestartScriptCycle(
                    fmt.Errorf("failed to acquire lease: %s", 
                        resp.Response.CommandResponse.GetDescription()))
            }
            
            return nil
        },
    }
}
```

### Moving an AGV

```go
func moveAgvStage(agvId, waypointId string) *plugin.SequencerStepStage[*script] {
    return &plugin.SequencerStepStage[*script]{
        Name: fmt.Sprintf("move_%s_to_%s", agvId, waypointId),
        Op: func(ctx context.Context, s *script) error {
            client := s.svc.FabricClient()
            targetId := eidns.NewAgvEid(s.eidNs, agvId)
            
            cmdReq := access.NewCommandRequest()
            
            reqResult, err := agv_manager.OperateLeasedAgvRequest(ctx, client,
                &agv_managerpb.OperateAgvRequest{
                    CommandRequest: cmdReq,
                    Requestor:      s.svc.MyScriptId(),
                    Command: &agv_managerpb.AgvCommand{
                        WaypointId: waypointId,
                    },
                },
                access.RequestWithTarget(targetId))
            if err != nil {
                return err
            }
            
            resp, err := reqResult.Await(ctx)
            if err != nil {
                return err
            }
            
            cr := resp.Response.GetCommandResponse()
            if cr.GetOutcome() == commands.CommandResponseOutcome_COMMAND_RESPONSE_OUTCOME_FAILURE {
                // Check if we lost our lease
                if resp.Response.GetResponseCode() == agv_managerpb.OpResponseCode_OP_RESPONSE_CODE_AGV_NOT_LEASED {
                    return plugin.NewErrRestartScriptCycle(
                        fmt.Errorf("lost lease on AGV %s", agvId))
                }
                return fmt.Errorf("move failed: %s", cr.GetDescription())
            }
            
            // Store command ID for tracking
            s.activeCommandId = cmdReq.GetId()
            
            return nil
        },
    }
}
```

### Waiting for Command Completion

```go
func waitForCommandComplete() *plugin.SequencerStepStage[*script] {
    return &plugin.SequencerStepStage[*script]{
        Name: "wait_command_complete",
        Op: func(ctx context.Context, s *script) error {
            for ctx.Err() == nil {
                ctrlState, _ := s.tracker.State()
                if ctrlState == nil {
                    s.tracker.WaitForUpdate(ctx)
                    continue
                }
                
                // Check active command
                if active := ctrlState.GetActiveCommand(); active != nil {
                    if active.CommandInstance.Request.GetId() == s.activeCommandId {
                        state := active.CommandInstance.GetState()
                        switch state {
                        case commands.CommandState_COMMAND_STATE_COMPLETED_SUCCESSFULLY:
                            return nil
                        case commands.CommandState_COMMAND_STATE_FAILED:
                            return plugin.NewErrRestartScriptCycle(
                                fmt.Errorf("command failed: %s", 
                                    active.CommandInstance.GetDetail()))
                        }
                    }
                }
                
                // Check recent commands
                for _, cmd := range ctrlState.GetRecentCommands() {
                    if cmd.CommandInstance.Request.GetId() == s.activeCommandId {
                        if cmd.CommandInstance.GetState() == commands.CommandState_COMMAND_STATE_COMPLETED_SUCCESSFULLY {
                            return nil
                        }
                        if cmd.CommandInstance.GetState() == commands.CommandState_COMMAND_STATE_FAILED {
                            return plugin.NewErrRestartScriptCycle(
                                fmt.Errorf("command failed: %s", 
                                    cmd.CommandInstance.GetDetail()))
                        }
                    }
                }
                
                s.tracker.WaitForUpdate(ctx)
            }
            return ctx.Err()
        },
    }
}
```

### Releasing a Lease

```go
func releaseLeaseStage(agvId string) *plugin.SequencerStepStage[*script] {
    return &plugin.SequencerStepStage[*script]{
        Name: "release_lease",
        Op: func(ctx context.Context, s *script) error {
            client := s.svc.FabricClient()
            targetId := eidns.NewAgvManagerEid(s.eidNs)
            
            req := &agv_managerpb.ReturnLeaseAgvRequest{
                CommandRequest: access.NewCommandRequest(),
                AgvId:          agvId,
                LeasedTo:       s.svc.MyScriptId(),
            }
            
            result, err := agv_manager.ReturnLeaseOnAgvRequest(ctx, client, req,
                access.RequestWithTarget(targetId))
            if err != nil {
                return err
            }
            
            resp, err := result.Await(ctx)
            if err != nil {
                return err
            }
            
            if resp.Response.CommandResponse.GetOutcome() != commands.CommandResponseOutcome_COMMAND_RESPONSE_OUTCOME_ACCEPTED {
                return fmt.Errorf("failed to release lease: %s",
                    resp.Response.CommandResponse.GetDescription())
            }
            
            return nil
        },
    }
}
```

### Load/Unload Operations

```go
func loadPayloadStage(agvId, waypointId string) *plugin.SequencerStepStage[*script] {
    return &plugin.SequencerStepStage[*script]{
        Name: "load_payload",
        Op: func(ctx context.Context, s *script) error {
            client := s.svc.FabricClient()
            targetId := eidns.NewAgvEid(s.eidNs, agvId)
            
            reqResult, err := agv_manager.OperateLeasedAgvRequest(ctx, client,
                &agv_managerpb.OperateAgvRequest{
                    CommandRequest: access.NewCommandRequest(),
                    Requestor:      s.svc.MyScriptId(),
                    Command: &agv_managerpb.AgvCommand{
                        WaypointId: waypointId,
                        PayloadOpRequest: &agvpb.PayloadOpRequest{
                            PayloadOpType: agvpb.PayloadOpType_PAYLOAD_OP_TYPE_LOAD,
                        },
                    },
                },
                access.RequestWithTarget(targetId))
            if err != nil {
                return err
            }
            
            resp, err := reqResult.Await(ctx)
            if err != nil {
                return err
            }
            
            if resp.Response.CommandResponse.GetOutcome() != commands.CommandResponseOutcome_COMMAND_RESPONSE_OUTCOME_ACCEPTED {
                return fmt.Errorf("load failed: %s",
                    resp.Response.CommandResponse.GetDescription())
            }
            
            return nil
        },
    }
}
```

---

## 9. Error Handling and Flow Control

### Error Types and Their Effects

| Error Type | Effect | Use Case |
|------------|--------|----------|
| Regular `error` | Retry with backoff | Transient failures (network, timeout) |
| `NewErrRestartScriptStep(err)` | Restart current step | Need to retry step from beginning |
| `NewErrRestartScriptStepByName(err, name, seq)` | Jump to named step | Conditional flow control |
| `NewErrRestartScriptCycle(err)` | Restart entire cycle | Major failure requiring fresh start |
| `NewErrSkipRestOfScriptStep(err)` | Skip to next step | Step no longer needed |

### Example Flow Control

```go
// Conditional branching based on AGV state
func checkAgvLoadedState(loadStep, unloadStep string) *plugin.SequencerStepStage[*script] {
    return &plugin.SequencerStepStage[*script]{
        Name: "check_loaded",
        Op: func(ctx context.Context, s *script) error {
            state, _ := s.agvStateTracker.State()
            
            for _, bay := range state.GetState().GetBays() {
                if bay.GetOccupied() {
                    // AGV is loaded, go to unload step
                    return plugin.NewErrRestartScriptStepByName(
                        fmt.Errorf("AGV loaded"), unloadStep, s.seq)
                }
            }
            
            // AGV is empty, go to load step
            return plugin.NewErrRestartScriptStepByName(
                fmt.Errorf("AGV empty"), loadStep, s.seq)
        },
    }
}

// Handle lost lease
func handleOperation(ctx context.Context, s *script) error {
    resp, err := doSomething(ctx, s)
    if err != nil {
        return err  // Retry
    }
    
    if resp.ResponseCode == agv_managerpb.OpResponseCode_OP_RESPONSE_CODE_AGV_NOT_LEASED {
        // Lost lease - must restart cycle to re-acquire
        return plugin.NewErrRestartScriptCycle(
            fmt.Errorf("lost lease during operation"))
    }
    
    return nil
}
```

### Cancel Handlers

Clean up when a step fails:

```go
steps := []*plugin.SequencerStep[*script]{
    {
        Name: "operate_agv",
        Stages: [...],
        Cancel: func(ctx context.Context, s *script, err error) {
            // Release any held leases
            for agvId := range s.heldLeases {
                releaseAgvLease(ctx, s, agvId)
            }
            s.logger.Info("cleaned up after failure", zap.Error(err))
        },
    },
}
```

---

## 10. Complete Script Examples

### Simple AGV Loop Script

```go
package dynamic

import (
    "context"
    "fmt"
    "sync"

    "github.com/Kerrigan-Automation/overmind/public/lib/eidns"
    access "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go"
    agv_manager "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/conveyance/mobile/agv_manager"
    agv_managerpb "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/conveyance/mobile/agv_manager"
    "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/escript/instance"
    "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/meta/commands"
    "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/meta/config"
    plugin "github.com/Kerrigan-Automation/overmind/public/lib/script/go_plugin"
    "go.uber.org/zap"
    "google.golang.org/protobuf/types/known/timestamppb"
)

type Config struct {
    Description     string
    AgvId           string
    WaypointA       string
    WaypointB       string
}

type script struct {
    cfg       *Config
    svc       plugin.HostServices
    psp       *plugin.PullScriptPlugin
    seq       *plugin.Sequencer[*script]
    eidNs     *eidns.EidNsManager
    tracker   *agv_manager.TrackedAgvControlState
    hasLease  bool
    logger    *zap.Logger
}

func (cfg *Config) Configure(ctx context.Context, wg *sync.WaitGroup, svc plugin.HostServices) (plugin.ScriptPlugin, error) {
    defer wg.Done()

    initState := &instance.State{
        ActiveMode:     instance.Mode_MODE_STOPPED,
        RequestedMode:  instance.Mode_MODE_STOPPED,
        RequestedOn:    timestamppb.Now(),
        TransitionedOn: timestamppb.Now(),
    }
    initReq := &instance.ControlRequest{RequestedMode: instance.Mode_MODE_STOPPED}

    psp := plugin.NewPullScriptPlugin(initState, initReq, svc, nil, nil)
    psp.UpdateState(func(state *instance.State, verbose *instance.VerboseState) (plugin.UpdateType, error) {
        state.Tags = &config.TagSet{Tags: []*config.Tag{
            {Key: "description", Value: cfg.Description},
        }}
        return plugin.UpdateTypeIncludesCore, nil
    })

    s := &script{
        cfg:    cfg,
        svc:    svc,
        psp:    psp,
        eidNs:  svc.EidNs(),
        logger: svc.Logger(),
    }

    seqCfg := plugin.SequencerConfig[*script]{
        Steps: []*plugin.SequencerStep[*script]{
            {
                Name:        "acquire_lease",
                Description: "Get exclusive control of the AGV",
                Stages: []*plugin.SequencerStepStage[*script]{
                    {Name: "lease", Op: s.acquireLease},
                },
            },
            {
                Name:        "move_to_a",
                Description: "Move AGV to waypoint A",
                Stages: []*plugin.SequencerStepStage[*script]{
                    {Name: "move", Op: func(ctx context.Context, s *script) error {
                        return s.moveToWaypoint(ctx, cfg.WaypointA)
                    }},
                    {Name: "wait", Op: s.waitForIdle},
                },
            },
            {
                Name:        "move_to_b",
                Description: "Move AGV to waypoint B",
                Stages: []*plugin.SequencerStepStage[*script]{
                    {Name: "move", Op: func(ctx context.Context, s *script) error {
                        return s.moveToWaypoint(ctx, cfg.WaypointB)
                    }},
                    {Name: "wait", Op: s.waitForIdle},
                },
            },
        },
        Iterations: plugin.IterateForever,
    }

    seq, err := plugin.NewSequencer(seqCfg, psp, svc)
    if err != nil {
        return nil, err
    }
    s.seq = seq

    wg.Add(1)
    s.tracker, err = agv_manager.NewTrackAgvControlState(
        ctx, wg, svc.FabricClient(),
        eidns.NewAgvEid(s.eidNs, cfg.AgvId),
        nil)
    if err != nil {
        return nil, err
    }

    wg.Add(1)
    go seq.Runner(ctx, wg, s)

    return psp, nil
}

func (s *script) acquireLease(ctx context.Context, _ *script) error {
    // Check if we already have lease
    ctrlState, _ := s.tracker.State()
    if ctrlState != nil && ctrlState.GetLease().GetTo() == s.svc.MyScriptId() {
        s.hasLease = true
        return nil
    }

    client := s.svc.FabricClient()
    targetId := eidns.NewAgvManagerEid(s.eidNs)

    result, err := agv_manager.GetLeaseOnAgvRequest(ctx, client,
        &agv_managerpb.LeaseAgvRequest{
            CommandRequest: access.NewCommandRequest(),
            LeasedTo:       s.svc.MyScriptId(),
            MandatedAgvIds: []string{s.cfg.AgvId},
        },
        access.RequestWithTarget(targetId))
    if err != nil {
        return err
    }

    resp, err := result.Await(ctx)
    if err != nil {
        return err
    }

    if resp.Response.CommandResponse.GetOutcome() != commands.CommandResponseOutcome_COMMAND_RESPONSE_OUTCOME_ACCEPTED {
        return fmt.Errorf("failed to acquire lease: %s",
            resp.Response.CommandResponse.GetDescription())
    }

    s.hasLease = true
    return nil
}

func (s *script) moveToWaypoint(ctx context.Context, waypointId string) error {
    client := s.svc.FabricClient()
    targetId := eidns.NewAgvEid(s.eidNs, s.cfg.AgvId)

    result, err := agv_manager.OperateLeasedAgvRequest(ctx, client,
        &agv_managerpb.OperateAgvRequest{
            CommandRequest: access.NewCommandRequest(),
            Requestor:      s.svc.MyScriptId(),
            Command: &agv_managerpb.AgvCommand{
                WaypointId: waypointId,
            },
        },
        access.RequestWithTarget(targetId))
    if err != nil {
        return err
    }

    resp, err := result.Await(ctx)
    if err != nil {
        return err
    }

    if resp.Response.CommandResponse.GetOutcome() == commands.CommandResponseOutcome_COMMAND_RESPONSE_OUTCOME_FAILURE {
        if resp.Response.GetResponseCode() == agv_managerpb.OpResponseCode_OP_RESPONSE_CODE_AGV_NOT_LEASED {
            s.hasLease = false
            return plugin.NewErrRestartScriptCycle(fmt.Errorf("lost lease"))
        }
        return fmt.Errorf("move failed: %s", resp.Response.CommandResponse.GetDescription())
    }

    return nil
}

func (s *script) waitForIdle(ctx context.Context, _ *script) error {
    for ctx.Err() == nil {
        ctrlState, _ := s.tracker.State()
        if ctrlState != nil && ctrlState.GetActiveCommand() == nil {
            return nil
        }
        s.tracker.WaitForUpdate(ctx)
    }
    return ctx.Err()
}

func init() {
    defaultCfg := &Config{
        Description: "Simple A-B loop",
        AgvId:       "001",
        WaypointA:   "wp1",
        WaypointB:   "wp2",
    }
    plugin.RegisterPlugin("default", defaultCfg.Configure)
}
```

---

## 11. Import Reference

### Required Imports by Category

#### Plugin Framework
```go
import (
    plugin "github.com/Kerrigan-Automation/overmind/public/lib/script/go_plugin"
)
```

#### Entity ID Namespace
```go
import (
    "github.com/Kerrigan-Automation/overmind/public/lib/eidns"
)
```

#### Fabric Access
```go
import (
    access "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go"
)
```

#### Generated SDK (subscribe/request helpers)
```go
import (
    // AGV active state SDK
    agvspec "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/conveyance/mobile/agv"
    // AGV manager SDK (control state, lease, operate)
    agv_managerspec "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/conveyance/mobile/agv_manager"
    // Track SDK
    trackspec "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/conveyance/track"
)
```

#### Generated Protobuf Types
```go
import (
    // AGV protobuf types
    agvpb "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/conveyance/mobile/agv"
    // AGV manager protobuf types
    agv_managerpb "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/conveyance/mobile/agv_manager"
    // Track protobuf types
    trackpb "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/conveyance/track"
    // Script instance types
    "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/escript/instance"
    // Command types
    "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/meta/commands"
    // Config types (TagSet, EntityKind)
    "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/meta/config"
    // Domain types (Alarms)
    "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/meta/domain"
)
```

#### Domain Types
```go
import (
    agv "github.com/Kerrigan-Automation/overmind/public/lib/fm/agv"
)
```

#### Standard Libraries
```go
import (
    "context"
    "fmt"
    "sync"
    "time"

    "go.uber.org/zap"
    "google.golang.org/protobuf/types/known/timestamppb"
    "github.com/cenkalti/backoff/v5"
)
```

#### Fabric Core (rarely needed directly)
```go
import (
    "github.com/Kerrigan-Automation/overmind/public/lib/fabric/core"
)
```

---

## 12. Critical Rules and Best Practices

### Package Name
**ALWAYS** use `package dynamic` for dynamically deployed scripts.

### Import Paths
**ALWAYS** use full import paths:
```go
// CORRECT
import (
    "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/escript/instance"
)

// WRONG - never use relative imports
import (
    "../../lib/fabric/access/go/generated/proto/escript/instance"
)
```

### Instance vs Config Import Confusion
Be careful not to confuse similarly named types:
```go
// Script instance state - from escript/instance
import "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/escript/instance"
state := &instance.State{}

// Configuration types - from meta/config  
import "github.com/Kerrigan-Automation/overmind/public/lib/fabric/access/go/generated/proto/meta/config"
tags := &config.TagSet{}
```

### AGV ID Format
Use 3-digit string format for AGV IDs:
```go
// CORRECT
agvId := "001"
agvId := agv.AgvId("001")

// WRONG
agvId := "AGV001"
agvId := 1
```

### Backoff Configuration
**NEVER** initialize `Config.Backoff` manually in default configs. The system handles it:
```go
// CORRECT - let system handle it
type Config struct {
    Backoff *backoff.ExponentialBackOff  // Leave nil, system provides default
}

// WRONG - don't initialize
type Config struct {
    Backoff *backoff.ExponentialBackOff
}
cfg := &Config{
    Backoff: backoff.NewExponentialBackOff(),  // Don't do this
}
```

### WaitGroup Management
Always match `wg.Add(1)` with `defer wg.Done()`:
```go
func (cfg *Config) Configure(ctx context.Context, wg *sync.WaitGroup, svc plugin.HostServices) (plugin.ScriptPlugin, error) {
    defer wg.Done()  // For the Configure call itself
    
    // For trackers
    wg.Add(1)
    tracker, err := agv_managerspec.NewTrackAgvControlState(ctx, wg, ...)
    
    // For goroutines
    wg.Add(1)
    go seq.Runner(ctx, wg, s)
}
```

### Context Cancellation
Always respect context cancellation in loops:
```go
// CORRECT
for ctx.Err() == nil {
    // do work
}
return ctx.Err()

// WRONG - infinite loop if context canceled
for {
    // do work
}
```

### Lease Management
1. Always acquire lease before operating AGV
2. Check for lease loss in operation responses
3. Release lease on cancel/cleanup
4. Track which AGVs you hold leases for

### State Updates
Use appropriate update types:
```go
// Core state changed - always publish
return plugin.UpdateTypeIncludesCore, nil

// Only detailed state changed - publish only if detailed requested
return plugin.UpdateTypeOnlyDetailed, nil

// Nothing meaningful changed - don't publish
return plugin.UpdateTypeNone, nil
```

### Error Handling Flow
1. Return regular `error` for transient failures (will retry)
2. Use `NewErrRestartScriptStep` when step needs clean restart
3. Use `NewErrRestartScriptCycle` for major failures
4. Use `NewErrRestartScriptStepByName` for conditional branching

### Logging Best Practices
```go
// Use structured logging
s.logger.Info("operation completed",
    zap.String("agv_id", agvId),
    zap.String("waypoint", waypointId),
    zap.Duration("elapsed", time.Since(start)))

// Log errors with context
s.logger.Error("failed to acquire lease",
    zap.String("agv_id", agvId),
    zap.Error(err))
```

### Verification Before Deployment
Always verify compilation before deploying:
1. Check all imports resolve correctly
2. Ensure no syntax errors
3. Verify type compatibility
4. Test with `go build` if possible

---

## Quick Reference Card

### Creating a New Script

1. Create package with `package dynamic`
2. Define `Config` struct with configuration fields
3. Define `script` struct with runtime state
4. Implement `Configure` method on Config
5. Create `SequencerConfig` with steps
6. Set up state trackers
7. Start sequencer runner
8. Register plugin in `init()`

### Essential Types

| Type | Import | Purpose |
|------|--------|---------|
| `plugin.ScriptPlugin` | `lib/fm/script/go_plugin` | Main interface |
| `plugin.PullScriptPlugin` | `lib/fm/script/go_plugin` | State management helper |
| `plugin.Sequencer[T]` | `lib/fm/script/go_plugin` | Step execution engine |
| `plugin.HostServices` | `lib/fm/script/go_plugin` | Host-provided services |
| `instance.State` | `proto/escript/instance` | Script state |
| `instance.Mode` | `proto/escript/instance` | Script modes |
| `config.TagSet` | `proto/meta/config` | UI tags |
| `commands.CommandResponseOutcome` | `proto/meta/commands` | Command results |

### Key Functions

| Function | Purpose |
|----------|---------|
| `plugin.RegisterPlugin(kind, configure)` | Register at init |
| `plugin.NewPullScriptPlugin(...)` | Create state helper |
| `plugin.NewSequencer(cfg, psp, svc)` | Create sequencer |
| `eidns.NewAgvEid(ns, id)` | Create AGV entity ID |
| `eidns.NewAgvManagerEid(ns)` | Get AGV manager entity ID |
| `access.NewCommandRequest()` | Create command request |
| `agv_manager.GetLeaseOnAgvRequest(...)` | Request AGV lease |
| `agv_manager.OperateLeasedAgvRequest(...)` | Send AGV command |
| `agv_manager.ReturnLeaseOnAgvRequest(...)` | Release AGV lease |
