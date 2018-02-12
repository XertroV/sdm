
import axios from "axios";

import { VerifyOnEndpointStatus } from "../../handlers/events/delivery/VerifyOnEndpointStatus";

export const VerifyEndpoint = new VerifyOnEndpointStatus(
    url => {
        return axios.get(url)
            .then(resp => {
                console.log(`Verification: The status of ${url} was ${resp.data.status}`);
                if (resp.status !== 200) {
                    return Promise.reject(`Unexpected response: ${resp.data.status}`);
                }
                return Promise.resolve();
            });
            // Let a failure go through
    },
);
