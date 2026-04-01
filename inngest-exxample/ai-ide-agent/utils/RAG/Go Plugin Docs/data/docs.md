# Go Plugin Library API Documentation

This document provides comprehensive API documentation for the `go_plugin` library used in Overmind scripts. This library supports building plugins that drive operations on production lines.

## Core Functions & Types

### RegisterPlugin
- **Kind**: FUNCTION
- **Description**: Registers a script plugin at initialization time. Must be called in package `init()` function before host starts.
- **Arguments**:
  - `kind`: String - Unique identifier for the plugin type (e.g., "simple_agv001_wp1_wp2")
  - `pluginMaker`: Configure - Function that creates and configures the plugin instance
- **Returns**: error - Returns error if registration fails (nil registration, already registered, or registry closed)
- **Usage Context**: Called in `init()` function of plugin implementation
- **Example Pattern**:
  ```go
  func init() {
      plugin.RegisterPlugin("my_script_kind", myConfig.Configure)
  }
  ```

### GetPlugin
- **Kind**: FUNCTION
- **Description**: Called by host at startup to retrieve a registered plugin. Not typically used by script developers.
- **Arguments**:
  - `ctx`: context.Context - Cancellable context for plugin initialization
  - `wg`: *sync.WaitGroup - WaitGroup for tracking plugin lifecycle
  - `svc`: HostServices - Services provided by the host to the plugin
  - `kind`: String - The plugin kind identifier to retrieve
- **Returns**: 
  - ScriptPlugin - The initialized plugin instance
  - error - Error if plugin not found or initialization fails
- **Usage Context**: Internal host function, not called by script developers

### CloseRegistrations
- **Kind**: FUNCTION
- **Description**: Called by host to close the registration window. No function registrations allowed after this.
- **Arguments**: None
- **Returns**: None
- **Usage Context**: Internal host function, not called by script developers

## Error Constructors

### NewErrRestartScriptStep
- **Kind**: FUNCTION
- **Description**: Creates a permanent error that signals the sequencer to restart the current step from its pre-stage. Stops retry attempts.
- **Arguments**:
  - `err`: error - The underlying error that caused the restart request
- **Returns**: error - Wrapped permanent error indicating step restart
- **Usage Context**: Return from stage operation functions when current step should restart
- **Behavior**: Sequencer will restart from the beginning of the current step, does not count as an iteration

### NewErrRestartScriptCycle
- **Kind**: FUNCTION
- **Description**: Creates a permanent error that signals the sequencer to restart the entire cycle from the first step. Stops retry attempts and counts as an iteration.
- **Arguments**:
  - `err`: error - The underlying error that caused the cycle restart request
- **Returns**: error - Wrapped permanent error indicating cycle restart
- **Usage Context**: Return from stage operation functions when entire cycle should restart
- **Behavior**: Sequencer will restart from step 0, counts as a completed iteration if counting

### NewErrSkipRestOfScriptStep
- **Kind**: FUNCTION
- **Description**: Creates a permanent error that signals the sequencer to skip remaining stages in current step and move to next step. Stops retry attempts.
- **Arguments**:
  - `err`: error - The underlying error explaining why skip is needed
- **Returns**: error - Wrapped permanent error indicating step skip
- **Usage Context**: Return from stage operation functions when rest of step should be skipped
- **Behavior**: Remaining stages in current step are skipped, moves to next step, does not count as iteration

### ErrScriptStopped
- **Kind**: ERROR_CONSTANT
- **Description**: Sentinel error indicating script was stopped by Overmind control request
- **Value**: errors.New("script stopped")
- **Usage Context**: Checked in error handling to detect stop conditions

## Sequencer Types & Functions

### NewSequencer
- **Kind**: FUNCTION (Generic)
- **Description**: Creates a new Sequencer instance that manages cycling through script steps with built-in retry, pause, and stop handling
- **Type Parameter**: `[T any]` - Generic type for script context passed to all step operations
- **Arguments**:
  - `cfg`: SequencerConfig[T] - Configuration defining steps, iterations, and behavior
  - `pullPlugin`: *PullScriptPlugin - Plugin that manages state and control flow
  - `svc`: HostServicesSubset - Host services subset (logger, metrics, script ID, etc.)
- **Returns**:
  - *Sequencer[T] - Configured sequencer instance
  - error - Error if configuration is invalid
- **Usage Context**: Called in plugin Configure function to create sequencer
- **Behavior**: Applies defaults for missing config (backoff, rate limits, recent steps count)

### Sequencer.Runner
- **Kind**: METHOD (Generic)
- **Description**: Main execution loop for the sequencer. Runs configured steps in sequence, handling retries, pauses, stops, and iterations.
- **Receiver**: *Sequencer[T]
- **Arguments**:
  - `ctx`: context.Context - Cancellable context for shutdown
  - `wg`: *sync.WaitGroup - WaitGroup to signal completion
  - `t`: T - Script context instance passed to all step operations
- **Returns**: None (blocks until context cancelled or iterations complete)
- **Usage Context**: Launch as goroutine in Configure function
- **Behavior**: 
  - Runs configured number of iterations (or forever if IterateForever)
  - Honors PAUSE/STOP/RUNNING control requests
  - Automatically retries failed operations with backoff
  - Updates detailed state with step progress
  - Records metrics for cycles and steps

### SequencerConfig
- **Kind**: STRUCT (Generic)
- **Description**: Configuration for sequencer behavior and step definitions
- **Type Parameter**: `[T any]` - Type of script context
- **Fields**:
  - `Steps`: []*SequencerStep[T] - Ordered list of steps to execute in cycle
  - `Iterations`: int - Number of cycles to run (use IterateForever constant for infinite)
  - `RecentSteps`: int - How many recent steps to track in detailed state (default: 5)
  - `Backoff`: *retry.ExponentialBackoffConfig - Default backoff config for retries (optional)
  - `RateLimitForStepAndCycleFailures`: rate_limiter.Config - Rate limiting for step/cycle failures (optional, default: 0.3 tokens/sec)

### SequencerStep
- **Kind**: STRUCT (Generic)
- **Description**: Defines a single step in the sequencer cycle with multiple stages
- **Type Parameter**: `[T any]` - Type of script context
- **Fields**:
  - `Name`: string - Step name (used in metrics, avoid dynamic values)
  - `Description`: string - Human-readable step description
  - `Stages`: []*SequencerStepStage[T] - Ordered stages within this step (pre, mutate, post, etc.)
  - `Cancel`: func(ctx context.Context, t T) - Optional cleanup function called on step failure or stop (oneshot, no retry)

### SequencerStepStage
- **Kind**: STRUCT (Generic)
- **Description**: Defines a stage within a step (e.g., pre-check, mutate, post-verify)
- **Type Parameter**: `[T any]` - Type of script context
- **Fields**:
  - `Name`: string - Stage name for logging and metrics
  - `Op`: func(ctx context.Context, t T) error - Operation to execute. Return nil for success, error for retry, or wrapped error (NewErrRestart*, NewErrSkip*) for control flow
  - `Backoff`: *retry.ExponentialBackoffConfig - Optional backoff config for this stage's retries (inherits from SequencerConfig if nil)

### IterateForever
- **Kind**: CONSTANT
- **Description**: Constant value (-1) indicating sequencer should run indefinitely
- **Value**: -1
- **Usage Context**: Set as SequencerConfig.Iterations for continuous operation

## PullScriptPlugin Types & Functions

### NewPullScriptPlugin
- **Kind**: FUNCTION
- **Description**: Creates a new PullScriptPlugin that provides partial ScriptPlugin implementation with state management
- **Arguments**:
  - `initState`: *instance.State - Initial script state (mode, timestamps, etc.)
  - `initRequest`: *instance.ControlRequest - Initial control request (typically MODE_STOPPED)
  - `svc`: HostServicesSubset - Host services subset
  - `cycleBuckets`: []float64 - Histogram buckets for cycle duration metrics (nil for defaults)
  - `stepBuckets`: []float64 - Histogram buckets for step duration metrics (nil for defaults)
- **Returns**: *PullScriptPlugin - Configured plugin instance
- **Usage Context**: Called early in Configure function before setting up sequencer
- **Behavior**: Sets up state tracking, observers, and metrics

### PullScriptPlugin.UpdateState
- **Kind**: METHOD
- **Description**: Thread-safe method to update core and detailed state with automatic publish notification
- **Receiver**: *PullScriptPlugin
- **Arguments**:
  - `update`: func(state *instance.State, detailed *instance.VerboseState) (UpdateType, error) - Function that updates state
- **Returns**: None
- **Usage Context**: Called to update script state (tags, alarms, active steps, etc.)
- **Behavior**: 
  - Acquires lock, invokes update function, releases lock
  - Requests state publish if UpdateType indicates core changed or detailed requested
  - Skips publish notification on error

### PullScriptPlugin.UpdateFirstActiveJob
- **Kind**: METHOD
- **Description**: Convenience method to update the first active step report in detailed state
- **Receiver**: *PullScriptPlugin
- **Arguments**:
  - `update`: func(j *instance.StepReport) (UpdateType, error) - Function that updates the step report
- **Returns**: None
- **Usage Context**: Called to update current active step (e.g., add entity IDs, update reason)
- **Behavior**: Updates first item in ActiveSteps array if it exists

### PullScriptPlugin.UncommandedStop
- **Kind**: METHOD
- **Description**: Internally stops the script without external command (e.g., when iterations complete)
- **Receiver**: *PullScriptPlugin
- **Arguments**: None
- **Returns**: None
- **Usage Context**: Called when script decides to stop itself
- **Behavior**: Sets RequestedMode to MODE_STOPPED and notifies observers

### PullScriptPlugin.PeekInSched
- **Kind**: METHOD
- **Description**: Checks for mode transitions, pauses execution if needed, and returns when ready to proceed
- **Receiver**: *PullScriptPlugin
- **Arguments**:
  - `ctx`: context.Context - Cancellable context
- **Returns**:
  - `mode`: instance.Mode - Current mode after transitions
  - `err`: error - ErrRestartScript if transitioned from STOP, context error if cancelled
- **Usage Context**: Called between operations to honor pause/stop requests
- **Behavior**: 
  - Blocks if mode is PAUSED/STOPPED until mode changes to RUNNING
  - Returns ErrRestartScript if coming out of STOPPED
  - Updates state on transitions

### PullScriptPlugin.WatchForInterrupt
- **Kind**: METHOD
- **Description**: Creates a context that cancels when STOP command received, for interrupting long operations
- **Receiver**: *PullScriptPlugin
- **Arguments**:
  - `ctx`: context.Context - Parent context
- **Returns**:
  - context.Context - Child context that cancels on STOP
  - context.CancelCauseFunc - Cancel function to clean up
- **Usage Context**: Used by sequencer to create operation contexts that respect STOP
- **Behavior**: Spawns goroutine watching for STOP, cancels context with ErrScriptStopped cause

### PullScriptPlugin.ScriptState
- **Kind**: METHOD
- **Description**: Returns current script state. Implements ScriptPlugin interface.
- **Receiver**: *PullScriptPlugin
- **Arguments**:
  - `ctx`: context.Context - Context (not currently used)
- **Returns**:
  - instance.State - Cloned current state with detailed state if requested
  - error - Error if cloning fails
- **Usage Context**: Called by host to get state for publishing to Overmind
- **Behavior**: Thread-safe clone of state, includes VerboseState if detailed reporting active

### PullScriptPlugin.Control
- **Kind**: METHOD
- **Description**: Handles control requests from Overmind (START/STOP/PAUSE). Implements ScriptPlugin interface.
- **Receiver**: *PullScriptPlugin
- **Arguments**:
  - `ctx`: context.Context - Context (not currently used)
  - `req`: *instance.ControlRequest - Control request from Overmind
- **Returns**:
  - *instance.ControlResponse - Response indicating ACCEPTED
  - error - Error (currently always nil)
- **Usage Context**: Called by host when Overmind sends control commands
- **Behavior**: Stores request and notifies observers waiting in PeekInSched

### UpdateType
- **Kind**: ENUM (iota)
- **Description**: Indicates what type of state update occurred and whether to publish
- **Values**:
  - `UpdateTypeNone` (0) - No publish needed
  - `UpdateTypeIncludesCore` (1) - Core state changed, always publish
  - `UpdateTypeOnlyDetailed` (2) - Only detailed state changed, publish if detailed requested
- **Usage Context**: Returned from UpdateState and UpdateFirstActiveJob callback functions

## HostServices Interface

### HostServices
- **Kind**: INTERFACE
- **Description**: Services provided by host to plugin. Extends skeleton.Services with script-specific services.
- **Methods**:
  - `Logger()`: *zap.Logger - Get structured logger
  - `Registry()`: *prometheus.Registry - Get metrics registry
  - `RequestingToPublishState()`: None - Non-blocking request to publish state to Overmind
  - `NotifyFatalFailure(lastWill instance.State)`: None - Notify host of fatal error requiring redeployment
  - `MyScriptId()`: string - Get this script's unique identifier
  - `MyEid()`: core.EntityId - Get this script's entity ID for fabric communication
  - `EidNs()`: *eidns.EidNsManager - Get entity ID namespace manager for mapping names to global IDs
  - `GqlClient()`: (*graphql.Client, error) - Get GraphQL client configured for Overmind

### HostServicesSubset
- **Kind**: INTERFACE
- **Description**: Subset of HostServices needed by PullScriptPlugin and Sequencer
- **Methods**:
  - `Logger()`: *zap.Logger
  - `RequestingToPublishState()`: None
  - `Registry()`: *prometheus.Registry
  - `MyScriptId()`: string
  - `NotifyFatalFailure(state instance.State)`: None

## Plugin Interfaces

### ScriptPlugin
- **Kind**: INTERFACE
- **Description**: Core interface that all script plugins must implement to integrate with Overmind
- **Methods**:
  - `Control(ctx context.Context, req *instance.ControlRequest)`: (*instance.ControlResponse, error) - Handle control requests (START/STOP/PAUSE)
  - `ScriptState(ctx context.Context)`: (instance.State, error) - Produce current state for publishing
- **Thread Safety**: All calls from host are guaranteed non-concurrent
- **Usage Context**: Either implement directly or use PullScriptPlugin which implements this

### Configure
- **Kind**: FUNCTION_TYPE
- **Description**: Function signature for plugin configuration/initialization function
- **Arguments**:
  - `ctx`: context.Context - Cancellable context for shutdown
  - `wg`: *sync.WaitGroup - WaitGroup to track plugin lifecycle
  - `svc`: HostServices - Host services available to plugin
- **Returns**:
  - ScriptPlugin - Initialized plugin instance
  - error - Error if initialization fails
- **Usage Context**: Implemented by plugin, registered via RegisterPlugin, called by host at startup
- **Behavior**: Should set up all dependencies, spawn goroutines, return quickly

## Common Patterns

### Basic Sequencer Plugin Structure
```go
type script struct {
    cfg       *Config
    svc       plugin.HostServices
    psp       *plugin.PullScriptPlugin
    eidNs     *eidns.EidNsManager
    gqlClient *graphql.Client
    logger    *zap.Logger
    // ... custom script state
}

func (cfg *Config) Configure(ctx context.Context, wg *sync.WaitGroup, svc plugin.HostServices) (plugin.ScriptPlugin, error) {
    defer wg.Done()
    
    // 1. Set up initial state
    initState := &instance.State{
        ActiveMode:     instance.Mode_MODE_STOPPED,
        RequestedMode:  instance.Mode_MODE_STOPPED,
        RequestedOn:    timestamppb.Now(),
        TransitionedOn: timestamppb.Now(),
    }
    initRequest := &instance.ControlRequest{
        RequestedMode: instance.Mode_MODE_STOPPED,
    }
    
    // 2. Create PullScriptPlugin
    psp := plugin.NewPullScriptPlugin(initState, initRequest, svc, nil, nil)
    
    // 3. Update initial tags/state
    psp.UpdateState(func(state *instance.State, verbose *instance.VerboseState) (plugin.UpdateType, error) {
        state.Tags = &config.TagSet{
            Tags: []*config.Tag{{Key: "description", Value: "My script"}},
        }
        return plugin.UpdateTypeIncludesCore, nil
    })
    
    // 4. Create sequencer
    sequencer, err := plugin.NewSequencer(cfg.SequenceConfig, psp, svc)
    if err != nil {
        return nil, err
    }
    
    // 5. Set up script context
    script := &script{
        cfg:       cfg,
        svc:       svc,
        psp:       psp,
        eidNs:     svc.EidNs(),
        gqlClient: gqlClient,
        logger:    svc.Logger(),
    }
    
    // 6. Launch runner
    wg.Add(1)
    go sequencer.Runner(ctx, wg, script)
    
    return psp, nil
}
```

### Stage Operation Return Values
```go
// Success - continue to next stage
return nil

// Transient error - retry with backoff
return fmt.Errorf("temporary failure: %w", err)

// Restart current step from beginning
return plugin.NewErrRestartScriptStep(fmt.Errorf("need to restart step"))

// Restart entire cycle from step 0
return plugin.NewErrRestartScriptCycle(fmt.Errorf("need to restart cycle"))

// Skip rest of this step's stages, move to next step
return plugin.NewErrSkipRestOfScriptStep(fmt.Errorf("skipping ahead"))
```

### Defining Sequencer Steps
```go
SequenceConfig: plugin.SequencerConfig[*script]{
    Steps: []*plugin.SequencerStep[*script]{
        {
            Name:        "acquire_resources",
            Description: "Acquire AGV lease",
            Stages: []*plugin.SequencerStepStage[*script]{
                {
                    Name: "lease",
                    Op: func(ctx context.Context, s *script) error {
                        // ... perform operation
                        return nil
                    },
                },
            },
            Cancel: func(ctx context.Context, s *script) {
                // ... cleanup on failure
            },
        },
    },
    Iterations: plugin.IterateForever,
}
```

## Key Concepts

### State Management
- **Core State**: Always published (mode, alarms, timestamps)
- **Detailed State**: Only published when requested (active steps, recent steps)
- **UpdateType**: Controls when state is published to Overmind

### Control Flow
- **RUNNING**: Script executes normally
- **PAUSED**: Script blocks in PeekInSched until resumed
- **STOPPED**: Script blocks and sets restart flag when resumed
- **EXITED**: Script terminates

### Error Handling
- **nil**: Success, continue
- **Regular error**: Retry with backoff
- **Permanent error (backoff.Permanent)**: Stop retrying, use wrapped error for control flow
- **Special errors**: NewErrRestart*, NewErrSkip* control sequencer behavior

### Metrics
- Automatically collected per-step and per-cycle
- Duration histograms for successful operations
- Outcome labels: success, stopped, error, restarted, skipped

### Concurrency
- Host guarantees non-concurrent calls to ScriptPlugin methods
- All HostServices methods are concurrency-safe
- PullScriptPlugin state updates are thread-safe
- Script implementations should manage their own concurrency for custom state