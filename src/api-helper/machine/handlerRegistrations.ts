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
    HandleCommand,
    HandleEvent,
    logger,
    Success,
} from "@atomist/automation-client";
import {
    BaseParameter,
    declareMappedParameter,
    declareParameter,
    declareSecret
} from "@atomist/automation-client/internal/metadata/decoratorSupport";
import { OnCommand } from "@atomist/automation-client/onCommand";
import { eventHandlerFrom } from "@atomist/automation-client/onEvent";
import { CommandDetails } from "@atomist/automation-client/operations/CommandDetails";
import { RemoteRepoRef } from "@atomist/automation-client/operations/common/RepoId";
import { AnyProjectEditor } from "@atomist/automation-client/operations/edit/projectEditor";
import { NoParameters } from "@atomist/automation-client/SmartParameters";
import { Maker, toFactory } from "@atomist/automation-client/util/constructionUtils";
import * as stringify from "json-stringify-safe";
import { CommandListenerInvocation } from "../../api/listener/CommandListener";
import { CommandHandlerRegistration } from "../../api/registration/CommandHandlerRegistration";
import { EditorRegistration } from "../../api/registration/EditorRegistration";
import { EventHandlerRegistration } from "../../api/registration/EventHandlerRegistration";
import { GeneratorRegistration } from "../../api/registration/GeneratorRegistration";
import { ProjectOperationRegistration } from "../../api/registration/ProjectOperationRegistration";
import { createCommand } from "../command/createCommand";
import { editorCommand } from "../command/editor/editorCommand";
import { generatorCommand } from "../command/generator/generatorCommand";
import {
    MachineOrMachineOptions,
    toMachineOptions,
} from "./toMachineOptions";
import {
    DeclarationType,
    MappedParameterOrSecretDeclaration,
    ParametersDefinition,
    ParametersListing
} from "../../api/registration/ParametersDefinition";
import { ParametersBuilder } from "../../api/registration/ParametersBuilder";

export const GeneratorTag = "generator";
export const EditorTag = "editor";

export function editorRegistrationToCommand(sdm: MachineOrMachineOptions, e: EditorRegistration<any>): Maker<HandleCommand> {
    tagWith(e, EditorTag);
    addParametersDefinedInBuilder(e);
    const fun = e.editorCommandFactory || editorCommand;
    return () => fun(
        sdm,
        toEditorFunction(e),
        e.name,
        e.paramsMaker,
        e,
        e.targets || toMachineOptions(sdm).targets,
    );
}

/**
 * Tag the command details with the given tag if it isn't already
 * @param {Partial<CommandDetails>} e
 * @param {string} tag
 */
function tagWith(e: Partial<CommandDetails>, tag: string) {
    if (!e.tags) {
        e.tags = [];
    }
    if (typeof e.tags === "string") {
        e.tags = [e.tags];
    }
    if (!e.tags.includes(tag)) {
        e.tags.push(tag);
    }
}

export function generatorRegistrationToCommand(sdm: MachineOrMachineOptions, e: GeneratorRegistration<any>): Maker<HandleCommand> {
    tagWith(e, GeneratorTag);
    addParametersDefinedInBuilder(e);
    return () => generatorCommand(
        sdm,
        toEditorFunction(e),
        e.name,
        e.paramsMaker,
        e,
    );
}

export function commandHandlerRegistrationToCommand(sdm: MachineOrMachineOptions, c: CommandHandlerRegistration<any>): Maker<HandleCommand> {
    return () => createCommand(
        sdm,
        toOnCommand(c),
        c.name,
        c.paramsMaker,
        c,
    );
}

export function eventHandlerRegistrationToEvent(sdm: MachineOrMachineOptions, e: EventHandlerRegistration<any, any>): Maker<HandleEvent> {
    return () => eventHandlerFrom(
        e.listener,
        e.paramsMaker || NoParameters,
        e.subscription,
        e.name,
        e.description,
        e.tags,
    );
}

function toEditorFunction<PARAMS>(por: ProjectOperationRegistration<PARAMS>): (params: PARAMS) => AnyProjectEditor<PARAMS> {
    if (!!por.editor) {
        return () => por.editor;
    }
    if (!!por.createEditor) {
        return por.createEditor;
    }
    throw new Error(`Registration '${por.name}' is invalid, as it does not specify an editor or createEditor function`);
}

function toOnCommand<PARAMS>(c: CommandHandlerRegistration<PARAMS>): (sdm: MachineOrMachineOptions) => OnCommand<PARAMS> {
    if (!!c.createCommand) {
        return c.createCommand;
    }
    addParametersDefinedInBuilder(c);
    if (!!c.listener) {
        return () => async (context, parameters) => {
            // const opts = toMachineOptions(sdm);
            // TODO will add this. Currently it doesn't work.
            const credentials = undefined; // opts.credentialsResolver.commandHandlerCredentials(context, undefined);
            // TODO do a look up for associated channels
            const ids: RemoteRepoRef[] = undefined;
            const cli: CommandListenerInvocation = {
                commandName: c.name,
                context,
                parameters,
                addressChannels: (msg, opts) => context.messageClient.respond(msg, opts),
                credentials,
                ids,
            };
            logger.debug("Running command listener %s", stringify(cli));
            try {
                await c.listener(cli);
                return Success;
            } catch (err) {
                logger.error("Error executing command '%s': %s", cli.commandName, err.message);
                return {
                    code: 1,
                    message: err.message,
                };
            }
        };
    }
    throw new Error(`Command '${c.name}' is invalid, as it does not specify a listener or createCommand function`);
}

function addParametersDefinedInBuilder<PARAMS>(c: CommandHandlerRegistration<PARAMS>) {
    const oldMaker = c.paramsMaker;
    if (!!c.parameters) {
        c.paramsMaker = () => {
            let paramsInstance;
            if (!!oldMaker) {
                paramsInstance = toFactory(oldMaker)();
            } else {
                paramsInstance = {};
                paramsInstance.__kind = "command-handler";
            }
            const paramListing = toParametersListing(c.parameters);
            paramListing.parameters.forEach(p =>
                declareParameter(paramsInstance, p.name, p));
            paramListing.mappedParameters.forEach(p =>
                declareMappedParameter(paramsInstance, p.name, p.uri, p.required));
            paramListing.secrets.forEach(p =>
                declareSecret(paramsInstance, p.name, p.uri));
            return paramsInstance;
        };
    }
}

function isMappedParameterOrSecretDeclaration(x: any): x is MappedParameterOrSecretDeclaration {
    const maybe = x as MappedParameterOrSecretDeclaration;
    return !!maybe && !!maybe.type;
}

function isParametersListing(p: ParametersDefinition): p is ParametersListing {
    const maybe = p as ParametersListing;
    return maybe.parameters !== undefined && maybe.mappedParameters !== undefined;
}

function toParametersListing(p: ParametersDefinition): ParametersListing {
    if (isParametersListing(p)) {
        return p;
    }
    const builder = new ParametersBuilder();
    for (const name of Object.getOwnPropertyNames(p)) {
        const value = p[name];
        if (isMappedParameterOrSecretDeclaration(value)) {
            switch (value.type) {
                case DeclarationType.mapped :
                    builder.addMappedParameters({name, uri: value.uri, required: value.required});
                    break;
                case DeclarationType.secret :
                    builder.addSecrets({name, uri: value.uri});
                    break;
            }
        } else {
            builder.addParameters({name, ...value});
        }
    }
    return builder;
}