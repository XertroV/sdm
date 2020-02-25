/*
 * Copyright © 2020 Atomist, Inc.
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

import { Configuration } from "@atomist/automation-client/lib/configuration";
import {
    EventHandler,
    Value,
} from "@atomist/automation-client/lib/decorators";
import { subscription } from "@atomist/automation-client/lib/graph/graphQL";
import {
    EventFired,
    HandleEvent,
} from "@atomist/automation-client/lib/HandleEvent";
import { HandlerContext } from "@atomist/automation-client/lib/HandlerContext";
import {
    HandlerResult,
    Success,
} from "@atomist/automation-client/lib/HandlerResult";
import { GitCommandGitProject } from "@atomist/automation-client/lib/project/git/GitCommandGitProject";
import { logger } from "@atomist/automation-client/lib/util/logger";
import * as _ from "lodash";
import { resolveCredentialsPromise } from "../../../../api-helper/machine/handlerRegistrations";
import {
    AddressChannels,
    AddressNoChannels,
} from "../../../../api/context/addressChannels";
import { PreferenceStoreFactory } from "../../../../api/context/preferenceStore";
import { createSkillContext } from "../../../../api/context/skillContext";
import {
    PushListener,
    PushListenerInvocation,
} from "../../../../api/listener/PushListener";
import { CredentialsResolver } from "../../../../spi/credentials/CredentialsResolver";
import { RepoRefResolver } from "../../../../spi/repo-ref/RepoRefResolver";
import * as schema from "../../../../typings/types";

/**
 * A new repo has been created, and it has some code in it.
 */
@EventHandler("On repo creation", subscription("OnFirstPushToRepo"))
export class OnFirstPushToRepo
    implements HandleEvent<schema.OnFirstPushToRepo.Subscription> {

    @Value("")
    public configuration: Configuration;

    constructor(private readonly actions: PushListener[],
                private readonly repoRefResolver: RepoRefResolver,
                private readonly credentialsFactory: CredentialsResolver,
                private readonly preferenceStoreFactory: PreferenceStoreFactory) {
    }

    public async handle(event: EventFired<schema.OnFirstPushToRepo.Subscription>,
                        context: HandlerContext): Promise<HandlerResult> {
        const push = event.data.Push[0];

        if (!!push.before) {
            logger.debug(`Done: Not a new commit on ${push.repo.name}`);
            return Success;
        }

        if (push.branch !== push.repo.defaultBranch) {
            logger.debug(`Done: Not push to the default branch on ${push.repo.name}`);
            return Success;
        }

        const screenName = _.get(push, "after.committer.person.chatId.screenName");
        const id = this.repoRefResolver.toRemoteRepoRef(push.repo, { sha: push.after.sha });
        const credentials = await resolveCredentialsPromise(this.credentialsFactory.eventHandlerCredentials(context, id));
        const preferences = this.preferenceStoreFactory(context);

        let addressChannels: AddressChannels;
        if (!screenName) {
            addressChannels = AddressNoChannels;
        } else {
            addressChannels = m => context.messageClient.addressUsers(m, screenName);
        }

        const project = await GitCommandGitProject.cloned(credentials, id);
        const invocation: PushListenerInvocation = {
            id,
            context,
            addressChannels,
            preferences,
            configuration: this.configuration,
            credentials,
            project,
            push,
            skill: createSkillContext(context),
        };
        await Promise.all(this.actions
            .map(l => l(invocation)),
        );
        return Success;
    }
}
