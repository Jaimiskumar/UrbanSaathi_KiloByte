# Green AI Layer 2: Feature and agent allocation

Layer 2 extends the existing LangGraph workflow used by the registered
`BaseAgent` implementations. It does not add a new agent runtime and does not
change Layer 1 model precision settings.

## Allocation and observability

- `GET /api/urbanflow/agents/registry` returns the implemented-agent registry
  and supported feature policies.
- `POST /api/urbanflow/agents/plan` accepts an event or requested feature and
  returns a dry-run allocation with mandatory, conditional, skipped, and
  unavailable agents. Optional `disabledAgents` are ignored for safety-required
  work.
- Existing graph-backed workflows (including camera detections sent via the
  EventBus) return `allocation`, `executionTrace`, `priority`, model usage,
  elapsed latency, and an explicit energy-telemetry status.

Feature policies use the capabilities actually present in the project:

| Feature | Primary workflow |
| --- | --- |
| Route / traffic analysis | `TrafficAgent` |
| Pothole / crack / tree report | `CivicAndRoadHealthAgent` |
| Parking availability / booking | Existing `ParkingSpot` and `ParkingBooking` services; no AI agent |
| Accident / critical hazard | Mandatory `AccidentEmergencyAgent` and `TrafficAgent` |
| Emergency vehicle route | Mandatory `GreenCorridorAgent` and `TrafficAgent` |
| Waterlogging / road blockage | Civic and traffic agents; both mandatory when the road is blocked |
| Encroachment / vendor / hawker | Encroachment validation and civic reporting |
| Illegal parking enforcement | Encroachment evidence validation and enforcement validation |
| Traffic violation | `EnforcementAgent`; a challan is conditional on a validated candidate |

`AuthorityCoordinationAgent`, `EChallanAgent`, `GreenCorridorAgent` (for
accidents), and `VerificationAgent` execute only when their graph dependencies
and outcomes require them. Verification is mandatory after an agent workflow;
it is skipped when allocation correctly selects no agents. A missing mandatory
agent, failed dependency, failed verification, or agent timeout marks the
workflow degraded and remains visible in the trace.

Completed safety results are not cached. Duplicate event IDs share work only
while the same graph execution is in flight; later deliveries execute again
against fresh inputs. Independent specialist agents continue to run in parallel
after being ordered by registry priority.

## Baseline comparison and energy

Each graph result includes a call-count comparison against the prior LangGraph
event routing plus its unconditional verification node. The comparison uses
the actual feature-driven invocations and does **not** claim proportional
energy savings. For example, a parking allocation makes zero AI-agent calls
instead of the legacy graph's unconditional verification call; a pothole
workflow still runs the civic agent and verification, so it is not counted as
an agent-call reduction. A route request may activate the traffic agent where
the old event matrix did not recognize a route-request event.

Task latency is measured by the graph. Task energy is reported unavailable
because the Node orchestrator has no per-request power telemetry or reliable
model/agent energy attribution. Layer 1 detector model and precision metadata
are copied from the inference event when supplied; precision is marked
unreported if the source did not provide it.

Run the allocation tests with:

```powershell
cd backend
npm run agents:allocation:test
```
