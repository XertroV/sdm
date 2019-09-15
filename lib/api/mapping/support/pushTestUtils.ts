/*
 * Copyright © 2019 Atomist, Inc.
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

import { logger } from "@atomist/automation-client";
import { LruCache } from "../../../api-helper/project/support/LruCache";
import { PushListenerInvocation } from "../../listener/PushListener";
import { isMapping } from "../Mapping";
import {
    predicatePushTest,
    ProjectPredicate,
    PushTest,
} from "../PushTest";

import * as pred from "./predicateUtils";

/**
 * Return the opposite of this push test
 */
export const not = pred.whenNot;

/**
 * Wrap all these PushTests or ProjectPredicates in a single PushTest
 * AND: Return true if all are satisfied
 */
export const and = allSatisfied;

/**
 * Wrap all these PushTests or ProjectPredicates in a single PushTest
 * OR: Return true if any is satisfied
 */
export const or = anySatisfied;

export type PushTestOrProjectPredicate = PushTest | ProjectPredicate;

/**
 * Wrap all these PushTests or ProjectPredicates in a single PushTest
 * AND: Return true if all are satisfied
 * @param {PushTest} pushTests
 * @return {PushTest}
 */
export function allSatisfied(...pushTests: PushTestOrProjectPredicate[]): PushTest {
    const asPushTests = pushTests.map(p => isMapping(p) ? p : predicatePushTest(p.name, p));
    return pred.all(asPushTests);
}

/**
 * Wrap all these PushTests or ProjectPredicates in a single PushTest
 * OR: Return true if any is satisfied
 * @param {PushTest} pushTests
 * @return {PushTest}
 */
export function anySatisfied(...pushTests: PushTestOrProjectPredicate[]): PushTest {
    const asPushTests = pushTests.map(p => isMapping(p) ? p : predicatePushTest(p.name, p));
    return pred.any(asPushTests);
}

const pushTestResultMemory = new LruCache<boolean>(1000);

/**
 * Cache the PushTest results for this push. The results will be cached based
 * on the name of the pushTest and the ID of the push. Make sure your push test
 * has a unique name!
 * @param {PushTest} pt
 * @return {PushTest}
 */
export function memoize(pt: PushTest): PushTest {
    return {
        name: pt.name,
        mapping: async pti => {
            const key = ptCacheKey(pt, pti);
            let result = pushTestResultMemory.get(key);
            if (result === undefined) {
                result = await pt.mapping(pti);
                logger.debug(`Evaluated push test [%s] to %s: cache stats=%j`, pt.name, result, pushTestResultMemory.stats);
                pushTestResultMemory.put(key, result);
            } else {
                logger.debug("Push test [%s] result was cached: " + result);
            }
            return result;
        },
        structure: pt.structure,
    };
}

function ptCacheKey(pt: PushTest, pti: PushListenerInvocation): string {
    return pti.push.id + "_" + pt.name;
}
