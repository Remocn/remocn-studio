## MODIFIED Requirements

### Requirement: The sidecar dying is reported by the core, once it had been serving

When a sidecar that had reached a serving state stops unexpectedly, the core SHALL report it as its own message carrying the reason line it already writes to the sidecar log, with no path in it. A session that ended because the person asked for a restart SHALL NOT be reported. The report SHALL carry, beside the message and not in it, how long the session had been up and the sidecar's own last account of why it left when that account is one of the fixed lifecycle sentences — its input closing, the core's process being gone, or a named signal — and no other line the sidecar wrote. A launch that never became ready SHALL NOT be reported; it is reported to the person by the studio itself instead.

#### Scenario: A sidecar that had been serving crashes

- **WHEN** the sidecar exits unexpectedly after having served
- **THEN** the core reports it with its exit reason
- **AND** the report carries the session's uptime and the sidecar's last lifecycle sentence, or that it said none

#### Scenario: The person presses Restart

- **WHEN** the sidecar exits because a restart was asked for
- **THEN** nothing is reported and the log records that it restarted on request

#### Scenario: A sidecar that never started

- **WHEN** the sidecar cannot be launched at all
- **THEN** nothing is reported and the person is told by the studio itself
