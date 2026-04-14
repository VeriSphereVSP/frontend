# VeriSphere: A Truth-Staking Protocol
### White Paper — v14.1
**Date:** March 2026
**Contact:** info@verisphere.co

---

## Abstract

VeriSphere is a decentralized protocol for economically evaluating factual claims. Any participant may publish a claim on-chain and any participant may stake tokens to support or challenge it. Claims accumulate a Verity Score derived from the ratio and magnitude of stakes on each side. Evidence links between claims propagate truth-pressure through a directed graph, creating an interconnected epistemic structure where the credibility of each claim depends on the credibility of its evidence.

The protocol operates on the Avalanche C-Chain using the VSP ERC-20 token. All scoring, staking, and evidence-linking logic is implemented in upgradeable Solidity contracts. The protocol is permissionless: any front-end, API, or automated agent may interact with the on-chain contracts directly.

---

## 1. Motivation

Existing information systems lack a mechanism for attaching economic cost to factual assertions. Search engines rank by engagement. Social platforms rank by virality. Encyclopedias rely on editorial consensus. Prediction markets handle binary, terminal events but cannot evaluate persistent, evolving claims such as "nuclear energy is environmentally sustainable" or "dietary saturated fat increases cardiovascular risk."

VeriSphere addresses this gap by introducing a protocol where:

- Publishing a claim requires burning a fee, eliminating zero-cost spam.
- Supporting or challenging a claim requires staking tokens, imposing a cost on both truthful and untruthful assertions.
- Correct positions accrue value over time; incorrect positions lose it.
- Evidence relationships between claims are first-class on-chain objects with their own stake and credibility.

The protocol does not determine truth. It creates economic pressure that makes being wrong expensive and being right profitable, and it makes the resulting score transparent and auditable.

---

## 2. Protocol Overview

### 2.1 Posts

The atomic unit of the protocol is a **post**. Posts are of two types:

- **Claims**: standalone factual assertions (e.g., "Earth's mean radius is approximately 6,371 kilometers").
- **Links**: directed evidence relationships between two claims, annotated as either support or challenge.

Each post is identified by a sequential post ID. Post IDs begin at 1; zero is reserved as a null sentinel. Posts are immutable once created.

### 2.2 Claims

A claim is a single factual assertion stored as a UTF-8 string on-chain. Claims are deduplicated via case-insensitive, whitespace-normalized hashing (lowercase ASCII, collapse whitespace, trim, then keccak256). Attempting to create a duplicate claim reverts with `DuplicateClaim(existingPostId)`.

Publishing a claim requires transferring a posting fee of 1 VSP to the protocol, which burns it. The fee amount is governance-configurable.

### 2.3 Links

A link is a directed edge from one claim to another, annotated as either **support** or **challenge**. The direction is `from → to`, where "from" is the claim providing evidence and "to" is the claim receiving evidence.

Example: if claim S ("Earth is a spheroid") challenges claim F ("Earth is flat"), the link is `S → F` with `isChallenge = true`. This means S is the evidence provider and F is the evidence receiver.

Links are also posts and carry their own post ID, staking pool, and Verity Score. Duplicate links (same from, to, and challenge flag) are rejected. Self-loops are rejected.

The link graph permits cycles. Two claims may challenge each other simultaneously. The Verity Score computation handles cycles through a stack-based visited-node mechanism (Section 4.3).

Creating a link also requires the posting fee, which is burned.

---

## 3. Staking

### 3.1 Positional Staking

Any participant may stake VSP tokens on any post (claim or link) on either side:

- **Support**: assert the claim is true or the evidence link is credible.
- **Challenge**: assert the claim is false or the evidence link is not credible.

Stakes are recorded in a FIFO queue per side per post. Earlier stakes occupy higher-risk, higher-reward positions. Later stakes occupy lower-risk, lower-reward positions.

Stakes may be withdrawn at any time. Withdrawal from the front of the queue (LIFO) shifts remaining stakes forward into riskier positions.

### 3.2 Staking Rate

Each stake accrues or loses value continuously according to an annualized rate determined by:

1. **Truth pressure** — the verity magnitude (`|2A - T| / T`) determines the base strength of the economic force. When VS is exactly neutral (equal support and challenge), no economic effect occurs.
2. **Post size** — the post's total stake relative to a global reference (`sMax`) scales the rate. Larger posts face greater pressure.
3. **Queue position (tranche)** — each lot is assigned to a positional tranche based on its stake-weighted queue position. Earlier tranches earn higher rate multipliers; later tranches earn lower ones. The number of tranches is governance-configurable (default: 10).
4. **Governed bounds** — rates are bounded between a minimum and maximum annual rate, both governance-configurable. The current deployment uses 0% minimum and 100% maximum.

For a stake on the side aligned with the VS sign, value accrues (tokens are minted). For a stake on the opposing side, value is burned. The rate formula is:

```
rBase = rMin + ((rMax - rMin) × v × participation) / RAY²
```

Where `v = |2A - T| × RAY / T` (verity magnitude), `participation = T × RAY / sMax` (post size factor), and `rMin`, `rMax` are time-scaled from their annual values.

Each lot's effective rate is further scaled by its positional tranche weight:

```
positionWeight = (numTranches - tranche) / numTranches
rLot = rBase × positionWeight
delta = lot.amount × rLot / RAY
```

If aligned with VS: `lot.amount += delta`. If opposed: `lot.amount -= min(delta, lot.amount)`.

The global reference `sMax` decays at 0.1% per epoch (day), ensuring that historical peaks do not permanently suppress rates on future posts.

For the full normative specification, see `claim-spec-evm-abi.md`, Appendix A.

---

## 4. Verity Score

### 4.1 Base Verity Score

The base Verity Score reflects the direct stake ratio on a post.

Let `A` = total support stake, `D` = total challenge stake, `T = A + D`.

```
If A > D:   baseVS = +(A / T) × RAY
If D > A:   baseVS = −(D / T) × RAY
If A = D:   baseVS = 0
If T = 0:   baseVS = 0
```

Where `RAY = 10^18` (fixed-point scaling). The VS is clamped to `[-RAY, +RAY]`, corresponding to the range [-100%, +100%].

A post is considered **active** when its total stake meets or exceeds the posting fee. Inactive posts have no effect on other posts' effective VS.

### 4.2 Effective Verity Score

The effective Verity Score of a claim incorporates evidence from incoming links. Link contributions are **stake-weighted**: the parent claim's economic mass flows through the link to the child, not merely a percentage adjustment. This means the total stake on a parent claim determines how much influence it can exert through its evidence links.

#### 4.2.1 Credibility Gate

Only credible claims can influence other claims. A parent claim with effective VS ≤ 0 contributes nothing through its outgoing links. Its links become inert until the community rehabilitates the parent with direct support stakes.

Similarly, a link with base VS ≤ 0 (i.e., the community has challenged the evidence relationship itself) contributes nothing.

This rule prevents three classes of abuse:

- **Credibility laundering**: an attacker creates a deliberately false claim, lets it accumulate challenges, then uses it as a challenge link against a target. Without the credibility gate, the double-negative (discredited parent × challenge link) would produce a positive contribution, hijacking other users' challenge stakes.
- **Poisoned support**: an attacker links a toxic claim as support for a legitimate claim. When the toxic claim is challenged, the support link would become an attack via sign inversion. The credibility gate silences discredited parents regardless of link type.
- **Oscillation and cascades**: in cyclic graphs, sign inversions from negative-VS parents could create feedback loops and unpredictable downstream effects. The credibility gate prevents these by ensuring only positive-VS claims propagate influence.

#### 4.2.2 Stake-Weighted Contribution Formula

For each incoming link to claim C from parent P via link L:

**Step 1: Compute parent mass.**

The parent's economic mass represents its stake-weighted credibility:

```
parentMass = parentEffectiveVS × parentTotalStake / RAY
```

Where `parentEffectiveVS` is in the range `(0, RAY]` (always positive due to the credibility gate) and `parentTotalStake` is in token units (wei). The result is in token units and represents how much economic weight the parent carries.

**Step 2: Distribute across outgoing links.**

A parent's mass is distributed among its outgoing links in proportion to their stake, preventing duplication of influence:

```
linkShare = linkStake / sumOutgoingLinkStake
```

Where `sumOutgoingLinkStake` is the sum of total stake across all active outgoing links from P.

**Step 3: Apply link credibility.**

The link's own Verity Score reflects the community's assessment of whether this evidence relationship is valid:

```
contribution = parentMass × linkShare × linkVS / RAY
```

Where `linkVS` is the base VS of the link post. If `linkVS ≤ 0`, the link is discredited and contributes nothing.

**Step 4: Apply link direction.**

Challenge links invert the contribution:

```
if isChallenge: contribution = -contribution
```

A positive contribution adds to the child's support side. A negative contribution adds to the child's challenge side.

#### 4.2.3 Effective VS Computation

After accumulating all incoming link contributions:

```
totalSupport = directSupport + sum(positive contributions)
totalChallenge = directChallenge + abs(sum(negative contributions))
pool = totalSupport + totalChallenge

effectiveVS = (totalSupport - totalChallenge) / pool × RAY
```

The result is clamped to `[-RAY, +RAY]`.

#### 4.2.4 Example

Claim A has 2 VSP support (VS = +100%). Claim B has 1 VSP support (VS = +100%). A challenges B via a link with 2 VSP support (link VS = +100%).

- parentMass(A) = 1.0 × 2.0 / 1.0 = 2.0 VSP
- sumOutgoing(A) = 2.0 (one outgoing link)
- linkShare = 2.0 / 2.0 = 1.0
- contribution = 2.0 × 1.0 × 1.0 = 2.0
- isChallenge → contribution = -2.0
- B: totalSupport = 1.0, totalChallenge = 0 + 2.0 = 2.0
- pool = 3.0
- effectiveVS(B) = (1.0 - 2.0) / 3.0 = **-33.3%**

The claim with 1 VSP support is pushed negative by the 2 VSP challenger. To defend B, participants can: add direct support to B, challenge claim A (reducing its VS and therefore its mass), or challenge the link itself (reducing its VS to silence it).

### 4.3 Cycle Handling

The link graph permits cycles. The effective VS computation uses a stack-based cycle detection mechanism:

1. When computing `effectiveVS(C)`, maintain a stack of post IDs currently being computed.
2. Before recursing into a parent, check if it is already on the stack.
3. If so, use the parent's **base VS** (not effective VS) as `parentVS`. This breaks the recursion without truncating legitimate deep chains.
4. A hard depth limit of 32 provides additional safety. Beyond this depth, contributions are truncated to zero.

When a cycle is detected, only the cycled post's contribution is zeroed. Other incoming edges of the same parent still compute normally. For example, if computing VS(F) encounters chain F→A→S→F, then F's contribution to S is 0, but A's other incoming edges (if any) are unaffected.

Combined with the credibility gate (Section 4.2.1), cycles are further stabilized: if a claim's effective VS drops to zero or below during computation, it ceases to influence its neighbors, preventing oscillatory feedback.

### 4.4 Conservation of Influence

A claim's economic mass is finite and is distributed — not duplicated — across its outgoing links. If a parent has mass M and three outgoing links with equal stake, each receives M/3. Adding more outgoing links from the same parent dilutes each link's share.

This ensures:
- A single claim cannot amplify influence beyond its own stake-weighted credibility.
- The cost of meaningful influence scales with the stake required to maintain both the parent claim and the link.
- Link spam is self-defeating: each additional link dilutes the attacker's influence per target.

---

## 5. Token Economics

### 5.1 VSP Token

VSP is the native ERC-20 token of the protocol, deployed on Avalanche C-Chain. It has governance-controlled mint and burn functions managed through an Authority contract. VSP supports ERC-2612 permit, enabling gasless approvals.

### 5.2 Posting Fee

The posting fee is 1 VSP, burned upon post creation. The fee amount is governance-configurable.

The posting fee serves two purposes:
- Spam prevention: imposes a cost on publishing claims.
- Activity threshold: a post must accumulate total stake ≥ the posting fee to become active and influence other posts.

### 5.3 Economic Properties

- **Deflationary pressure**: posting fees are burned, reducing supply.
- **Inflationary pressure**: correct stakes accrue value (minted by the StakeEngine).
- **Equilibrium**: the balance between creation (burning) and staking (minting) is governed by protocol parameters.

---

## 6. Smart Contract Architecture

All contracts are deployed as UUPS upgradeable proxies behind a governance-controlled Authority.

| Contract | Purpose |
|----------|---------|
| VSPToken | ERC-20 token with ERC-2612 permit, Authority-controlled mint and burn |
| PostRegistry | Creates claims and links, burns posting fees, stores post metadata |
| LinkGraph | Stores directed evidence edges, enforces self-loop and duplicate prevention |
| StakeEngine | Manages per-post staking queues, computes positional rates, handles withdrawals |
| ScoreEngine | Computes base and effective Verity Scores with stake-weighted propagation |
| ProtocolViews | Read-only aggregation of claim summaries, edge data, and scores |
| PostingFeePolicy | Governance-configurable posting fee |
| StakeRatePolicy | Governance-configurable staking rate bounds |
| ClaimActivityPolicy | Defines the minimum stake threshold for post activation |
| Authority | Role-based access control (minter, burner, governance roles) |

### 6.1 Meta-Transaction Support

All governed contracts (PostRegistry, StakeEngine, LinkGraph) inherit `ERC2771ContextUpgradeable`, which allows a trusted forwarder to submit transactions on behalf of users. The trusted forwarder address is set at deployment and can be updated via UUPS proxy upgrades.

VSPToken supports ERC-2612 permit, enabling signature-based approvals without a separate on-chain transaction.

These primitives allow third-party services to offer gasless interaction with the protocol. The protocol itself does not operate a relay or forwarder — it provides the on-chain hooks that make them possible. Users may always interact with the contracts directly using their own wallet and gas.

### 6.2 Governance

Governance operates through a `TimelockController` that controls parameter changes, contract upgrades, and treasury operations. During the initial phase, governance is managed by a multisig. The protocol is designed to transition to on-chain governance as the ecosystem matures.

Governance can modify:
- Posting fee amount
- Staking rate bounds (min and max APR)
- Activity threshold
- Contract implementations (via UUPS proxy upgrades)
- Authority roles

---

## 7. Design Properties

### 7.1 Permissionless

Any address may create claims, create links, and stake. No registration, reputation, or identity is required. Front-ends, bots, and automated agents interact with the same contracts as human users.

### 7.2 Composable

The protocol exposes all state through standard Solidity view functions. Third-party applications may build on top of the protocol: alternative front-ends, analytics dashboards, AI-powered truth-checking tools, and cross-chain bridges.

### 7.3 Non-Finalizing

Claims never "resolve." The Verity Score is a continuous, live signal that reflects the current state of economic commitment. New evidence, new stakes, and new challenges can shift any claim's score at any time. This makes the protocol suitable for persistent, evolving knowledge — not just terminal predictions.

### 7.4 Adversarial

The protocol is designed for adversarial participants. There is no assumption of good faith. Economic incentives align with truthful behavior: being right is profitable; being wrong is costly. The credibility gate (Section 4.2.1) ensures that discredited claims cannot be weaponized through the evidence graph. The protocol does not enforce truth — it creates conditions under which truth is economically favored.

---

## 8. Deployment

The protocol is deployed on Avalanche C-Chain (chain ID 43113 for testnet, 43114 for mainnet). Avalanche provides sub-second finality, EVM compatibility, and low transaction costs suitable for interactive staking.

The protocol may optionally be deployed on a dedicated Avalanche Subnet for isolated throughput and custom gas economics.

---

## 9. Conclusion

VeriSphere defines a minimal, permissionless protocol for attaching economic consequence to factual assertions. Claims compete in an open market of support and challenge. Evidence links create a directed graph where credibility propagates through stake-weighted connections. Only credible claims — those with positive community support — can influence others, preventing abuse through double-negative exploits or poisoned associations. The Verity Score provides a transparent, continuously updated signal of economic consensus.

The protocol does not determine truth. It makes truth economically consequential.
