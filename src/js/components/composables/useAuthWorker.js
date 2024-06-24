import {computed, ref} from "vue";
import PrivateWorker from './../../Workers/private/PrivateWorker'
import AuthWorker from './../../Workers/auth-worker.js?worker'

export function useAuthWorker (app, intercept = null) {
    let code = ref(null)
    let state = ref(null)
    const hasCode = computed(() => {
        const urlParams = new URLSearchParams(window.location.search);
        code = urlParams.get('code');
        state = urlParams.get('state');
        return (code && state ) != null
    })
    let authWorker = app.config.globalProperties.$authWorker

    async function  initAuthWorker (code, state) {
        let callback = (event) => {
            console.log("DEBUG_LOG", event.data)
            switch (event.data.type) {
                case 'POPUP':
                    openPopupWindow(event)
                    break
                case 'POPUP_CLOSE' :
                    window.close()
                    break
                case 'REFRESH_AXIOS' :
                    console.log("DEBUG_LOG", "USE_AUTH_WORKER")
                    intercept(event.data.bearer_token.access_token, app)
                    app.config.globalProperties.$app_ready.value = true
                    break
                case 'UPDATE_USER_DATAS' :
                    app.config.globalProperties.$user.init(e.data.user_data)
                    console.log(app.config.globalProperties.$user)
                    break
                default :
                    console.log("DEBUG_LOG", 'Message received from worker:', event.data)
                    break
            }
        }
        authWorker = new PrivateWorker(AuthWorker, 'auth-worker', callback, app)
        app.config.globalProperties.$authWorker = authWorker
        await authWorker.init()
        if(code && state){
            authWorker.worker.postMessage({
                code: code,
                state: state,
                type: 'CODE'
            })
        }
    }
    const init = (async () => {
        if (hasCode.value && !authWorker) {
            await initAuthWorker(code, state).catch(error => {console.log(error)})
        } else if(!authWorker) {
            await initAuthWorker().catch(error => {console.log(error)})
        }
    })
    const openPopupWindow = (event) => {
        const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
        const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;

        const width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
        const height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;

        const systemZoom = width / window.screen.availWidth;
        const left = (width - 400) / 2 / systemZoom + dualScreenLeft
        const top = (height - 600) / 2 / systemZoom + dualScreenTop
        const newWindow = window.open(event.data.url, 'AUTH',
            `
							scrollbars=yes,
							width=${400 / systemZoom},
							height=${600 / systemZoom},
							menubar=no,toolbar=no
							`
        )
        newWindow.moveTo(left, top) // Imposta la posizione a 100 pixel dal bordo superiore
        if (window.focus) newWindow.focus()
    }
    const login = (email, password) => {
        authWorker.worker.postMessage({email: email, password: password, type: 'LOGIN' })
    }
    return { hasCode:hasCode.value, login, init }
}
