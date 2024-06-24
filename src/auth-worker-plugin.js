import {useAuthWorker} from "./js/components/composables/useAuthWorker";
import {newRequest} from "./js/components/requests/fetch-component";

const AuthWorkerPlugin = {
    install(app, options) {
        app.config.globalProperties.$newRequest = newRequest
        app.provide('authWorkerPlugin',  {
            useAuthWorker:useAuthWorker(app, options.intercept)
        })
    }
}

export default AuthWorkerPlugin