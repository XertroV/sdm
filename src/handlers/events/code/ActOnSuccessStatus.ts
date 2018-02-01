/*
 * Copyright © 2017 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { GraphQL } from "@atomist/automation-client";
import { EventFired, EventHandler, HandleEvent, HandlerContext, } from "@atomist/automation-client/Handlers";
import { OnSuccessStatus } from "../../../typings/types";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { GitCommandGitProject } from "@atomist/automation-client/project/git/GitCommandGitProject";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import { build } from "./mavenBuild";
import { ProgressLog, slackProgressLog } from "./DeploymentChain";
import { addressChannelsFor } from "../../commands/editors/toclient/addressChannels";

@EventHandler("On repo creation",
    GraphQL.subscriptionFromFile("graphql/subscription/OnSuccessStatus.graphql"))
export class ActOnSuccessStatus implements HandleEvent<OnSuccessStatus.Subscription> {

    public handle(event: EventFired<OnSuccessStatus.Subscription>, ctx: HandlerContext): Promise<any> {

        // TODO this is horrid
        const commit = event.data.Status[0].commit;

        const msg = `Saw a success status: ${JSON.stringify(event)}`;
        console.log(msg);

        const id = new GitHubRepoRef(commit.repo.owner, commit.repo.name, commit.sha);

        // TODO get this from handler properly
        const creds = {token: process.env.GITHUB_TOKEN};

        const addr = addressChannelsFor(commit.repo, ctx);

        // TODO check what status
        return GitCommandGitProject.cloned(creds, id)
            .then(p => {
                return doBuild(p, slackProgressLog(commit.repo, ctx))
                    .then(() => addr(`Finished building ${p.id.owner}/${p.id.repo}:${p.id.sha}`));
            });
    }
}

function doBuild(p: GitProject, log: ProgressLog): Promise<any> {
    const b = build(p);
    // deployment.childProcess.addListener("exit", closeListener);
    b.stdout.on("data", what => log.write(what.toString()));

    return new Promise((resolve, reject) => {
        // Pipe/use stream
        b.on("end", resolve);
        b.on("exit", resolve);
        b.on("close", resolve);
        b.on("error", reject);
    });
}
