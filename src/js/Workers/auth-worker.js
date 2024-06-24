import cryptojs from 'crypto-js';
import { newRequest } from '../components/requests/fetch-component'

let requestBeDomain = ""
let requestFeDomain = ""
const uuid = crypto.randomUUID()
self.createRandomString = function(num){
    return [...Array(num)].map(() => Math.random().toString(36)[2]).join('')
}
self.base64Url = function(string){
    return string.toString(cryptojs.enc.Base64)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}
let isFirst = true;
let bearer_token = null
self.public_broadcast_page = new BroadcastChannel('public')
// self.public_broadcast_page.postMessage({code:uuid})
self.private_channel = new BroadcastChannel('auth-worker-' + uuid)
self.private_channel.onmessage = (event) => {
    console.log("DEBUG_LOG", event.data)
    switch(event.data.type){
        case 'SHARE_TOKEN':
            self.updateBearerToken( event.data.token)
            self.postMessage({
                type: "REFRESH_AXIOS",
                bearer_token: bearer_token
            })
            break
    }
}
self.broadcast = new BroadcastChannel('auth-worker')
self.checkTokenExpired = () => {
    setInterval(async () => {
        if(bearer_token && new Date() >= bearer_token.expiration_date){
            await self.refreshToken()
        }
    }, 2000)
}
self.refreshToken =  async () => {
    let params = {
        grant_type: 'refresh_token',
        client_id: 1,
        refresh_token: bearer_token.refresh_token
    }
    await self.tokenRequest(params)
}
self.issueToken =  async (code) => {
    let params = {
        grant_type: 'authorization_code',
        client_id: 1,
        redirect_uri: `${requestFeDomain}/login`,
        code_verifier: self.code_verifier,
        code: code
    }
    await self.tokenRequest(params)
}
self.tokenRequest =  async (params) => {
    await newRequest(requestBeDomain, `${requestBeDomain}/authenticator/token`, 'POST', JSON.stringify(params))
        .then((res) => res.json())
        .then((res) => {
            let t = new Date()
            t.setSeconds(t.getSeconds() + res.expires_in -1);
            self.updateBearerToken( {...res, ...{expiration_date: t}})
            self.postMessage({
                type: "REFRESH_AXIOS",
                bearer_token: bearer_token
            })
            self.broadcast.postMessage({
                type: "UPDATE_TOKEN",
                bearer_token: bearer_token
            })
            self.public_broadcast_page.postMessage({type: 'LOGIN'})
        }).catch((e) => {
            console.log(e)
        })
}

self.broadcast.onmessage =  (async (event) => {
    switch (event.data.type) {
        case 'CHECK':
            if (self.code_request === event.data.state) {
                await self.issueToken(event.data.code)
            }
            break
        case 'UPDATE_TOKEN':
            self.updateBearerToken( event.data.bearer_token)
            self.postMessage({
                type: "REFRESH_AXIOS",
                bearer_token: bearer_token
            })
            break
        case 'RETRIEVE_TOKEN' : {
            let channel_to_respond = new BroadcastChannel('auth-worker-' + event.data.code)
            if (new Date() <= bearer_token.expiration_date) {
                console.log("DEBUG_LOG", "RETRIEVE_TOKEN TOKEN ANCORA VALIDO")
                channel_to_respond.postMessage({type: 'SHARE_TOKEN', token: bearer_token})
            } else {
                await refreshToken();
                self.postMessage({type: 'REFRESH_TOKEN', token: bearer_token})
            }
            break
        }
        case 'CHECK_FIRST' :
            self.broadcast.postMessage({type: 'ALREADY_PRESENT'})
            break
        case 'ALREADY_PRESENT' :
            isFirst = false
            break
        case 'REFRESH_TOKEN' :
            if(event.data.token.hasOwnProperty('token_type')) {
                self.updateBearerToken( event.data.token)
                self.postMessage({
                    type: "REFRESH_AXIOS",
                    bearer_token: bearer_token
                })
            }else{
                self.startTokenRequest();
            }
            break
        default :
            break
    }
})
self.code = crypto.randomUUID()
self.code_request = self.createRandomString(40)
self.code_verifier = self.createRandomString(128)

self.postMessage('ready');
self.broadcast.postMessage({type: 'CHECK_FIRST'});

self.startTokenRequest = () => {
    const url_ = requestBeDomain + "/authenticator/authorize?" +
        "client_id=1" +
        "&redirect_uri=" + requestFeDomain + "/login" +
        "&response_type=code" +
        "&scope=" +
        "&state=" + self.code_request +
        "&code_challenge=" + self.base64Url(cryptojs.SHA256(self.code_verifier)) +
        "&code_challenge_method=S256";
    self.postMessage({
        type: "POPUP",
        url: url_,
    })
}

self.onmessage = async (e) => {
    if(e.data.type && e.data.type !== 'LOGIN') console.log("DEBUG_LOG", e.data)
    switch (e.data.type) {
        case 'LOGIN' : {
            let response_ = await newRequest(requestBeDomain, `${requestBeDomain}/authenticator/login`, 'POST', JSON.stringify({...e.data, ...{code: self.code_request}, ...{code_verifier: self.code_verifier}}))
                .then((res) => res.json())
                .then((res) => {
                    if (res.message !== 'OK' || res.errors) {
                        return {status: false}
                    } else {
                        return {status: true}
                    }
                }).catch(error => {
                    console.log(error)
                })
            if (response_.status) {
                self.startTokenRequest();
            }
            break
        }
        case 'CODE' :
            self.broadcast.postMessage({
                type : 'CHECK',
                code : e.data.code,
                state : e.data.state
            })
            self.postMessage({
                type : 'POPUP_CLOSE'
            })
            break
        case 'INIT_WORKER' :
            requestBeDomain = e.data.url_be
            requestFeDomain = e.data.url_fe
            await newRequest(requestBeDomain, `${requestBeDomain}/authenticator/check-if-logged-in`, 'POST', JSON.stringify({}))
                .then((response) => {
                    if(response.status === 200 && !isFirst){
                        self.broadcast.postMessage({type:'RETRIEVE_TOKEN', code: uuid})
                    }else if(response.status === 200 && isFirst){
                        self.startTokenRequest();
                    }else{
                        throw new Error(response)
                    }
                }).catch(e => console.log(e))
            break
        default :
            break
    }
}

self.updateBearerToken = (token => {
    bearer_token = token
})
self.checkTokenExpired()
