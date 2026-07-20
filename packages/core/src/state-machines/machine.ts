import { allow, deny, type Decision } from "../result.js";

/** Adjacency map: state → the states reachable from it. */
export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

/**
 * A guard runs only after the transition is known to be structurally legal.
 * Splitting "is this edge on the graph?" from "are the preconditions met?"
 * keeps the graph readable and lets the API always answer the question users
 * actually ask on a 409: what CAN I do from here?
 */
export type Guard<S extends string, C> = (ctx: C, from: S, to: S) => Decision;

export interface StateMachine<S extends string, C> {
  readonly states: readonly S[];
  /** States reachable from `from`, for the `details.allowed` payload (03 §4). */
  allowedFrom(from: S): readonly S[];
  canTransition(from: S, to: S, ctx: C): Decision;
  isTerminal(state: S): boolean;
}

export function defineMachine<S extends string, C>(config: {
  transitions: TransitionMap<S>;
  guards?: readonly Guard<S, C>[];
}): StateMachine<S, C> {
  const { transitions, guards = [] } = config;
  const states = Object.keys(transitions) as S[];

  return {
    states,

    allowedFrom(from: S): readonly S[] {
      return transitions[from] ?? [];
    },

    canTransition(from: S, to: S, ctx: C): Decision {
      const allowed = transitions[from];

      if (allowed === undefined) {
        return deny("INVALID_TRANSITION", `Unknown state '${from}'`, {
          allowed: [],
          knownStates: states,
        });
      }

      if (from === to) {
        return deny("INVALID_TRANSITION", `Already in state '${to}'`, { allowed });
      }

      if (!allowed.includes(to)) {
        // The allowed list is the whole point of this error: a UI that gets a
        // bare "invalid" has to hardcode the graph to render its buttons.
        return deny(
          "INVALID_TRANSITION",
          `Cannot move from '${from}' to '${to}'`,
          { allowed },
        );
      }

      for (const guard of guards) {
        const decision = guard(ctx, from, to);
        if (!decision.ok) return decision;
      }

      return allow();
    },

    isTerminal(state: S): boolean {
      return (transitions[state] ?? []).length === 0;
    },
  };
}
