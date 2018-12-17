/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    goals,
    Goals,
} from "../goal/Goals";
import { PushListenerInvocation } from "../listener/PushListener";
import { PushTest } from "../mapping/PushTest";
import { AnyPush } from "../mapping/support/commonPushTests";
import {
    PredicateMappingTerm,
    toPredicateMapping,
} from "../mapping/support/PredicateMappingTerm";
import { PushRule } from "../mapping/support/PushRule";
import {
    GoalComponent,
    toGoals,
} from "./GoalComponent";

/**
 * PushRule implementation exposed in DSL. Continues fluent API.
 */
export class GoalSetterMapping extends PushRule<Goals> {

    private goalsName: string;

    public get label(): string {
        return this.goalsName;
    }

    constructor(guard1: PushTest, guards: PushTest[], reason?: string) {
        super(guard1, guards, reason);
    }

    public setGoals(goalComponent: GoalComponent): this {
        if (!!goalComponent && (goalComponent as Goals).name) {
            this.goalsName = (goalComponent as Goals).name;
        }
        if (!goalComponent) {
            return this.set(goalComponent as Goals);
        }
        return this.set(toGoals(goalComponent));
    }

    /**
     * Prevent setting any further goals on this push. Ordering matters:
     * goals may previously have been set.
     * @param name name of the empty Goals. Default is "No Goals"
     */
    public setNoMoreGoals(name?: string): void {
        this.setGoals(goals(name || "No Goals").andLock());
    }

}

/**
 * Simple GoalSetter DSL. Allows use of booleans and functions
 * returning boolean in predicate expressions
 * @param {PushTest} guard1
 * @param {PushTest} guards
 */
export function whenPushSatisfies<P extends PushListenerInvocation = PushListenerInvocation>(
    guard1: PredicateMappingTerm<P>,
    ...guards: Array<PredicateMappingTerm<P>>): GoalSetterMapping {
    return new GoalSetterMapping(toPredicateMapping(guard1), guards.map(toPredicateMapping));
}

/**
 * PushRule that matches every push
 * @type {GoalSetterMapping}
 */
export function onAnyPush(): GoalSetterMapping {
    return new GoalSetterMapping(AnyPush, [], "On any push");
}
