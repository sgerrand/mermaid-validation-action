# One valid, one invalid block

```mermaid
flowchart TD
  A --> B
```

The next block is broken:

```mermaid
sequenceDiagram
  Alice -> Bob: missing colon
  Bob: response without arrow
```
