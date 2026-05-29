# State diagram fixture

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Working: start
  Working --> Idle: done
  Working --> [*]: cancel
```
