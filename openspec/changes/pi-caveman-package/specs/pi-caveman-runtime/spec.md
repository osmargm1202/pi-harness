## ADDED Requirements

### Requirement: Pi-native caveman package installability
`pi-caveman` SHALL be a Pi-native package hosted from the `osmargm1202/pi-caveman` fork and installable by Pi using `pi install git:github.com/osmargm1202/pi-caveman`.

#### Scenario: Install package from Git spec
- **Given** Pi has network access to `github.com/osmargm1202/pi-caveman`
- **When** user runs `pi install git:github.com/osmargm1202/pi-caveman`
- **Then** Pi SHALL install `pi-caveman` as a package without requiring any files from `pi-harness`
- **And** subsequent Pi sessions SHALL load `pi-caveman` through Pi package discovery

#### Scenario: Package exposes Pi extension metadata
- **Given** `pi-caveman` package has been installed with Pi
- **When** Pi enumerates installed package extensions
- **Then** `pi-caveman` SHALL expose its caveman runtime as a Pi extension using package metadata discoverable by Pi

### Requirement: No SKILL.md runtime dependency
`pi-caveman` SHALL provide caveman runtime behavior without loading or depending on a `skills/caveman/SKILL.md` file.

#### Scenario: Caveman runtime starts without skill file
- **Given** `pi-caveman` is installed
- **And** no `skills/caveman/SKILL.md` is present in `pi-caveman` or `pi-harness`
- **When** a new Pi session starts
- **Then** caveman runtime behavior SHALL still be available
- **And** no prompt behavior SHALL be sourced from `skills/caveman/SKILL.md`

### Requirement: Auto-on default caveman state
`pi-caveman` SHALL auto-enable caveman mode for every new Pi session by default, with default level `full`, unless persistent configuration disables auto-enable or selects another level.

#### Scenario: New session defaults to full caveman mode
- **Given** `pi-caveman` is installed
- **And** user has no caveman configuration override
- **When** a new Pi session starts
- **Then** caveman mode SHALL be enabled automatically
- **And** active caveman level SHALL be `full`
- **And** caveman prompt behavior SHALL apply from session start

#### Scenario: Configuration disables auto-on
- **Given** `pi-caveman` is installed
- **And** persistent caveman configuration sets auto-enable to false
- **When** a new Pi session starts
- **Then** caveman mode SHALL remain disabled
- **And** caveman prompt behavior SHALL NOT apply until user enables it with a caveman command

#### Scenario: Configuration changes default level
- **Given** `pi-caveman` is installed
- **And** persistent caveman configuration sets default level to `lite`
- **When** a new Pi session starts with auto-enable active
- **Then** caveman mode SHALL be enabled
- **And** active caveman level SHALL be `lite`

### Requirement: Upstream-style caveman commands
`pi-caveman` SHALL register upstream-style caveman commands `/caveman`, `/caveman-commit`, `/caveman-review`, `/caveman-compress`, and `/caveman-stats` as Pi commands.

#### Scenario: Core caveman command is available
- **Given** `pi-caveman` is installed
- **When** user invokes `/caveman`
- **Then** Pi SHALL route command to `pi-caveman`
- **And** command SHALL allow user to inspect or change caveman mode state and level

#### Scenario: Commit command is available
- **Given** `pi-caveman` is installed
- **When** user invokes `/caveman-commit`
- **Then** Pi SHALL route command to `pi-caveman`
- **And** command SHALL produce caveman-style commit-message assistance

#### Scenario: Review command is available
- **Given** `pi-caveman` is installed
- **When** user invokes `/caveman-review`
- **Then** Pi SHALL route command to `pi-caveman`
- **And** command SHALL produce caveman-style review assistance

#### Scenario: Compress command is available
- **Given** `pi-caveman` is installed
- **When** user invokes `/caveman-compress`
- **Then** Pi SHALL route command to `pi-caveman`
- **And** command SHALL produce caveman-style compression assistance

#### Scenario: Stats command is available
- **Given** `pi-caveman` is installed
- **When** user invokes `/caveman-stats`
- **Then** Pi SHALL route command to `pi-caveman`
- **And** command SHALL report caveman-related usage or state statistics when available

### Requirement: Shared caveman state session entry
`pi-caveman` SHALL publish current caveman state to Pi session state using session entry key `pi-caveman:state`.

#### Scenario: Session state entry exists when caveman state changes
- **Given** `pi-caveman` is installed
- **When** caveman mode is enabled, disabled, or level changes
- **Then** Pi session state SHALL contain entry `pi-caveman:state`
- **And** entry value SHALL identify whether caveman mode is enabled
- **And** entry value SHALL identify current caveman level when enabled

#### Scenario: Session state reflects startup default
- **Given** `pi-caveman` is installed
- **And** auto-enable is active
- **When** new Pi session starts
- **Then** Pi session state entry `pi-caveman:state` SHALL report enabled state
- **And** it SHALL report configured startup level

### Requirement: Shared caveman state event
`pi-caveman` SHALL emit event `pi-caveman:state` whenever observable caveman state changes.

#### Scenario: Event emitted on startup state publication
- **Given** `pi-caveman` is installed
- **When** new Pi session starts and caveman state is initialized
- **Then** Pi SHALL emit event `pi-caveman:state`
- **And** event payload SHALL match session state entry `pi-caveman:state`

#### Scenario: Event emitted on command state change
- **Given** `pi-caveman` is installed
- **And** caveman mode is enabled at level `full`
- **When** user changes caveman level using `/caveman`
- **Then** Pi SHALL emit event `pi-caveman:state`
- **And** event payload SHALL include updated level

### Requirement: Install behavior verification
`pi-caveman` SHALL include tests or documented verification commands proving Git install, command registration, auto-on startup, configuration overrides, session entry publication, and event emission.

#### Scenario: Verification covers installed package behavior
- **Given** maintainer runs `pi-caveman` verification for installed package behavior
- **When** verification completes
- **Then** evidence SHALL show `pi install git:github.com/osmargm1202/pi-caveman` can install package
- **And** evidence SHALL show new session starts enabled at level `full` by default
- **And** evidence SHALL show registered upstream-style commands route to `pi-caveman`
- **And** evidence SHALL show `pi-caveman:state` session entry and event are produced
