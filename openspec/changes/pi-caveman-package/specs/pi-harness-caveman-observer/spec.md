## REMOVED Requirements

### Requirement: Harness-owned caveman runtime extension
`pi-harness` SHALL NOT ship or load `extensions/caveman.ts` as caveman runtime source for this change.

#### Scenario: Harness package no longer contains caveman extension
- **Given** `pi-harness` package contents are built or inspected
- **When** package file list is checked
- **Then** `extensions/caveman.ts` SHALL be absent
- **And** no package metadata SHALL expose `extensions/caveman.ts` as an extension

### Requirement: Harness-owned caveman skill prompt
`pi-harness` SHALL NOT ship `skills/caveman/SKILL.md` as a caveman runtime or prompt source for this change.

#### Scenario: Harness package no longer contains caveman skill
- **Given** `pi-harness` package contents are built or inspected
- **When** package file list is checked
- **Then** `skills/caveman/SKILL.md` SHALL be absent
- **And** no `pi-harness` package metadata SHALL expose caveman as a bundled skill

### Requirement: Agent-status caveman coupling
`pi-harness` `agent-status` extension SHALL NOT import, render, configure, persist, or control caveman state.

#### Scenario: Agent-status renders without caveman state
- **Given** `pi-harness` is installed
- **When** `agent-status` extension renders status output
- **Then** output SHALL NOT include caveman mode, caveman level, or caveman controls
- **And** extension SHALL NOT read `pi-caveman:state`

#### Scenario: Agent-status has no caveman imports
- **Given** `pi-harness` source is inspected
- **When** imports and runtime dependencies for `extensions/agent-status.ts` are checked
- **Then** no dependency SHALL reference caveman state helpers, caveman commands, or `pi-caveman` runtime modules

## ADDED Requirements

### Requirement: Harness minimal optional caveman observer
`pi-harness` minimal footer MAY observe caveman status only through shared Pi session entry key `pi-caveman:state` and event name `pi-caveman:state`; it SHALL NOT own caveman runtime state, commands, prompt behavior, or persistence.

#### Scenario: Minimal footer observes installed pi-caveman state
- **Given** `pi-harness` minimal footer is active
- **And** `pi-caveman` is installed and has published session entry `pi-caveman:state`
- **When** minimal footer renders
- **Then** footer MAY display caveman enabled/disabled state and level based only on `pi-caveman:state`
- **And** footer SHALL NOT mutate caveman state
- **And** footer SHALL NOT invoke caveman commands or load caveman prompt rules

#### Scenario: Minimal footer updates from shared event
- **Given** `pi-harness` minimal footer is active
- **And** `pi-caveman` is installed
- **When** Pi emits event `pi-caveman:state`
- **Then** footer MAY update displayed caveman status from event payload
- **And** footer SHALL treat event payload as observer data only

#### Scenario: Minimal footer remains silent without pi-caveman
- **Given** `pi-harness` minimal footer is active
- **And** `pi-caveman` is not installed
- **When** footer renders
- **Then** footer SHALL NOT show caveman UI
- **And** footer SHALL NOT show placeholder, error, warning, or disabled caveman indicator
- **And** footer SHALL continue rendering non-caveman footer content normally

### Requirement: Harness no-install behavior
`pi-harness` SHALL run without installed `pi-caveman` and SHALL NOT provide caveman commands, caveman prompt behavior, caveman persistence, or caveman UI in that state.

#### Scenario: No-install session has no caveman behavior
- **Given** `pi-harness` is installed
- **And** `pi-caveman` is not installed
- **When** a new Pi session starts
- **Then** caveman mode SHALL NOT auto-enable from `pi-harness`
- **And** `pi-harness` SHALL NOT inject caveman prompt rules
- **And** `pi-harness` SHALL NOT create or persist caveman configuration
- **And** commands `/caveman`, `/caveman-commit`, `/caveman-review`, `/caveman-compress`, and `/caveman-stats` SHALL NOT be provided by `pi-harness`

#### Scenario: No-install session does not emit caveman state
- **Given** `pi-harness` is installed
- **And** `pi-caveman` is not installed
- **When** a new Pi session starts
- **Then** `pi-harness` SHALL NOT create session entry `pi-caveman:state`
- **And** `pi-harness` SHALL NOT emit event `pi-caveman:state`

### Requirement: Harness installed-observer behavior
When `pi-caveman` is installed beside `pi-harness`, `pi-harness` SHALL remain a passive observer and SHALL delegate all caveman runtime ownership to `pi-caveman`.

#### Scenario: Installed pi-caveman owns commands and prompt behavior
- **Given** `pi-harness` is installed
- **And** `pi-caveman` is installed
- **When** a new Pi session starts
- **Then** any caveman auto-enable behavior SHALL originate from `pi-caveman`
- **And** upstream-style caveman commands SHALL be registered by `pi-caveman`, not `pi-harness`
- **And** caveman prompt behavior SHALL be sourced from `pi-caveman`, not `pi-harness`

#### Scenario: Installed pi-caveman owns state persistence
- **Given** `pi-harness` is installed
- **And** `pi-caveman` is installed
- **When** caveman state or level changes
- **Then** persistent caveman configuration SHALL be written by `pi-caveman`
- **And** `pi-harness` SHALL NOT persist caveman configuration

### Requirement: Harness verification coverage for extraction
`pi-harness` SHALL include tests or documented verification commands proving absent-package behavior, optional minimal observation when `pi-caveman` publishes shared state, removal of `extensions/caveman.ts`, and removal of agent-status caveman coupling.

#### Scenario: Verification covers no-install behavior
- **Given** maintainer runs `pi-harness` verification without `pi-caveman` installed
- **When** verification completes
- **Then** evidence SHALL show no caveman UI appears in minimal footer
- **And** evidence SHALL show `agent-status` does not render caveman status
- **And** evidence SHALL show `pi-harness` does not register caveman commands
- **And** evidence SHALL show `pi-harness` does not create `pi-caveman:state`

#### Scenario: Verification covers observer-only behavior
- **Given** maintainer runs `pi-harness` verification with simulated or installed `pi-caveman` publishing `pi-caveman:state`
- **When** minimal footer renders
- **Then** evidence SHALL show footer can display observed caveman status
- **And** evidence SHALL show footer behavior depends only on `pi-caveman:state` session entry or event
- **And** evidence SHALL show `pi-harness` does not mutate or persist caveman state
