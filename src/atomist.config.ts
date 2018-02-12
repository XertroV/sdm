import { Configuration } from "@atomist/automation-client/configuration";
import * as appRoot from "app-root-path";
import { touchEditor } from "./handlers/commands/editors/user/touchEditor";
import { HelloWorld } from "./handlers/commands/HelloWorld";
import { ActOnRepoCreation } from "./handlers/events/repo/ActOnRepoCreation";
import { CloudFoundryDeployOnArtifactStatus } from "./software-delivery-machine/blueprint/CloudFoundryDeployOnArtifactStatus";
import { LocalMavenBuildOnSucessStatus } from "./software-delivery-machine/blueprint/LocalMavenBuildOnScanSuccessStatus";
import { davosEditor } from "./software-delivery-machine/commands/editors/davosEditor";
import { NotifyOnDeploy } from "./software-delivery-machine/blueprint/notifyOnDeploy";
import { VerifyEndpoint } from "./software-delivery-machine/blueprint/verifyEndpoint";
import { ScanOnPushForMaven } from "./software-delivery-machine/blueprint/scanOnPush";

// tslint:disable-next-line:no-var-requires
const pj = require(`${appRoot.path}/package.json`);

const token = process.env.GITHUB_TOKEN;

export const configuration: Configuration = {
    name: pj.name,
    version: pj.version,
    teamIds: ["T5964N9B7"], // <-- run @atomist pwd in your slack team to obtain the team id
    commands: [
        HelloWorld,
        () => davosEditor,
        () => touchEditor,
    ],
    events: [
        ActOnRepoCreation,
        () => ScanOnPushForMaven,
        () => LocalMavenBuildOnSucessStatus,
        () => CloudFoundryDeployOnArtifactStatus,
        () => NotifyOnDeploy,
        () => VerifyEndpoint,
    ],
    token,
    http: {
        enabled: true,
        auth: {
            basic: {
                enabled: false,
            },
            bearer: {
                enabled: false,
            },
        },
    },
};
