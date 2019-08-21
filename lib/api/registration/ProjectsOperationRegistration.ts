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

import {
    Maker,
    RepoFilter,
} from "@atomist/automation-client";
import { RepoTargets } from "../machine/RepoTargets";
import { ProjectPredicate } from "../mapping/PushTest";
import { CommandRegistration } from "./CommandRegistration";

/**
 * Superclass for all registrations that can apply to one or more projects.
 */
export interface ProjectsOperationRegistration<PARAMS> extends CommandRegistration<PARAMS> {

    /**
     * Allow customization of the repositories that an inspection targets.
     */
    targets?: Maker<RepoTargets>;

    /**
     * Additionally, programmatically limit repositories to inspect, by id
     */
    repoFilter?: RepoFilter;

    /**
     * Programmatically limit repositories to inspect, by a project predicate.
     * This can look inside project.
     */
    projectTest?: ProjectPredicate;

    /**
     * Configure the concurrency behavior of running project operations
     * on many repos
     */
    concurrency?: {
        /** Maximum number of concurrent project operations would be executing */
        maxConcurrent?: number;
        /** Indicate if a Job scheduling is required; even for only one project operation */
        requiresJob?: boolean;
    };
}
