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

import { toStringArray } from "@atomist/automation-client/lib/internal/util/string";
import { fileExists } from "@atomist/automation-client/lib/project/util/projectUtils";
import * as _ from "lodash";
import {
    BinaryRepositoryProvider,
    DockerRegistryProvider,
    PullRequestsForBranch,
    ResourceProviderStateName,
} from "../../../typings/types";
import {
    predicatePushTest,
    PredicatePushTest,
    pushTest,
    PushTest,
} from "../PushTest";

export const ToDefaultBranch: PushTest = pushTest("Push to default branch", async p =>
    p.push.branch === p.push.repo.defaultBranch ||
    ((!p.push.repo.defaultBranch || p.push.repo.defaultBranch.length === 0) && p.push.branch === "master"));

/**
 * Is this a push originated by Atomist? Note that we can't look at the committer,
 * as if a user invoked a command handler, their credentials will be used
 * @param {PushListenerInvocation} p
 * @return {boolean}
 * @constructor
 */
export const FromAtomist: PushTest = pushTest("Push from Atomist", async p =>
    p.push.after.message.includes("[atomist]"));

/**
 * Match on any push
 * @param {PushListenerInvocation} p
 * @constructor
 */
export const AnyPush: PushTest = pushTest("Any push", async () => true);

/**
 * Return a PushTest testing for the existence of the given file
 * @param {string} path
 * @return {PushTest}
 */
export function hasFile(path: string): PredicatePushTest {
    return predicatePushTest(`HasFile(${path})`,
        async p => !!(await p.getFile(path)));
}

/**
 * PushTest that returns true if project is non empty
 * @type {PredicatePushTest}
 */
export const NonEmpty: PredicatePushTest = predicatePushTest("NonEmpty",
    async p => (await p.totalFileCount()) > 0);

/**
 * Is there at least one file with the given extension?
 * @param {string} extension
 * @return {PredicatePushTest}
 */
export function hasFileWithExtension(extension: string): PredicatePushTest {
    if (!extension) {
        return NonEmpty;
    }
    const extensionToUse = extension.startsWith(".") ? extension : `.${extension}`;
    return predicatePushTest(`HasFileWithExtension(${extensionToUse}})`,
        async p => fileExists(p, `**/*${extensionToUse}`, () => true));
}

/**
 * Is this push to a non-default branch that has an open pull request?
 */
export const IsPushToBranchWithPullRequest: PushTest = pushTest("Push to branch with open pull request", async p => {
    if (p.push.branch === p.push.repo.defaultBranch) {
        return false;
    }
    const result = await p.context.graphClient.query<PullRequestsForBranch.Query, PullRequestsForBranch.Variables>({
        name: "PullRequestsForBranch",
        variables: {
            repo: p.push.repo.name,
            owner: p.push.repo.owner,
            branch: p.push.branch,
        },
    });
    const branch: PullRequestsForBranch.Branches = _.get(result, "Repo[0].branches[0]");
    if (branch && branch.pullRequests && branch.pullRequests.some(pr => pr.state === "open")) {
        return true;
    }
    return false;
});

/**
 * Return a push test that matches the repository owner/repo slug
 * against regular expression.
 * @param re Regular expression to match against using RegExp.test()
 * @return Push test performing the match
 */
export function isRepo(re: RegExp): PushTest {
    return pushTest(`Project owner/name slug matches regular expression ${re.toString()}`,
        async pci => re.test(`${pci.id.owner}/${pci.id.repo}`));
}

/**
 * Return a push test that matches the repository branch
 * against regular expression.
 * @param re Regular expression to match against using RegExp.test()
 * @return Push test performing the match
 */
export function isBranch(re: RegExp): PushTest {
    return pushTest(`Project branch matches regular expression ${re.toString()}`,
        async pci => re.test(pci.push.branch));
}

/**
 * Return a PushTest testing for the existence of the given file containing the pattern
 * @param {string} path
 * @param pattern regex to look for
 * @return {PushTest}
 */
export function hasFileContaining(pattern: string | string[], content: RegExp = /.*/): PushTest {
    return pushTest(`Project has files ${toStringArray(pattern).join(", ")} with content ${content.toString()}`,
        async pci => {
            const files = await pci.project.getFiles(toStringArray(pattern));
            if (files.length === 0) {
                return false;
            }
            for (const file of files) {
                const fc = await file.getContent();
                if (content.test(fc)) {
                    return true;
                }
            }
            return false;
        });
}

/**
 * Return a PushTest that checks if a certain resource provider exists in the graph
 */
export function hasResourceProvider(type: "docker" | "npm" | "maven2", name?: string): PushTest {
    return pushTest(`Workspace has resource provider of type '${type}'`,
        async pci => {
            switch (type) {
                case "docker":
                    const dockerResult = await pci.context.graphClient.query<DockerRegistryProvider.Query, DockerRegistryProvider.Variables>({
                        name: "DockerRegistryProvider",
                        variables: {
                            name,
                        },
                    });
                    const dockerProvider = dockerResult.DockerRegistryProvider[0];
                    if (!!dockerProvider) {
                        return dockerProvider.state.name === ResourceProviderStateName.converged;
                    }
                    return false;
                case "npm":
                case "maven2":
                    const binaryResult = await pci.context.graphClient.query<BinaryRepositoryProvider.Query, BinaryRepositoryProvider.Variables>({
                        name: "BinaryRepositoryProvider",
                        variables: {
                            type: type as any,
                            name,
                        },
                    });
                    const binaryProvider = binaryResult.BinaryRepositoryProvider[0];
                    if (!!binaryProvider) {
                        return binaryProvider.state.name === ResourceProviderStateName.converged;
                    }
                    return false;
                default:
                    return false;
            }
        });
}
